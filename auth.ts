import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "./auth.config";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Resident } from "@/models/Resident";
import { Role, ResidentType, values } from "@/types/enums";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/lib/password";
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from "@/lib/rate-limit";

/**
 * Normalise tout rôle résident potentiel (ex: "RESIDENT" ou fiche Resident)
 * vers un rôle système reconnu par le middleware (OWNER ou TENANT).
 */
function normalizeResidentRole(rawRole?: string, residentType?: string): Role {
  if (rawRole && (values(Role) as string[]).includes(rawRole)) {
    return rawRole as Role;
  }
  if (residentType === ResidentType.TENANT) {
    return Role.TENANT;
  }
  return Role.OWNER;
}

/**
 * Initialisation principale de Auth.js (v5) avec le provider Credentials et Mongoose.
 * Ce fichier tourne sur le runtime Node.js et a accès complet à MongoDB et bcryptjs.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Identifiants",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        // 1. Validation de surface avec Zod
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;
        const normalizedEmail = email.toLowerCase().trim();
        const rateLimitKey = `login:${normalizedEmail}`;

        // 2. Limitation du taux de tentatives (in-memory)
        const rateCheck = checkRateLimit(rateLimitKey);
        if (!rateCheck.allowed) {
          throw new Error("Trop de tentatives de connexion. Veuillez patienter 15 minutes.");
        }

        // 3. Recherche dans la base MongoDB (Collection User OU rattachement via Resident)
        await connectDB();
        let user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");
        const residentDoc = await Resident.findOne({
          email: normalizedEmail,
          isActive: { $ne: false },
        }).lean();

        // Si l'utilisateur n'a pas été trouvé directement par email dans User mais possède une fiche Resident liée
        if (!user && residentDoc?.user) {
          user = await User.findById(residentDoc.user).select("+passwordHash");
        }

        // Message générique si inexistant ou inactif (ne pas révéler si l'email existe)
        if (!user || user.isActive === false || !user.passwordHash) {
          recordFailedAttempt(rateLimitKey);
          return null;
        }

        // 4. Vérification du hash bcrypt
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          recordFailedAttempt(rateLimitKey);
          return null;
        }

        // Synchronisation automatique de la fiche Resident si non encore rattachée au User
        if (residentDoc && !residentDoc.user) {
          await Resident.updateOne({ _id: residentDoc._id }, { $set: { user: user._id } });
        }

        // Résolution du rôle résident (OWNER / TENANT) tout en préservant les rôles staff (ADMIN, SYNDIC, TECHNICIAN)
        const resolvedRole = normalizeResidentRole(user.role, residentDoc?.type);

        // Réinitialisation du limiteur en cas de succès
        resetRateLimit(rateLimitKey);

        // 5. Retourne l'utilisateur sécurisé (sans le hash de mot de passe)
        return {
          id: user._id.toString(),
          name: user.name || residentDoc?.fullName || "Résident",
          email: user.email,
          role: resolvedRole,
        };
      },
    }),
  ],
});
