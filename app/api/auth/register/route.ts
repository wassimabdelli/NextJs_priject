import type { NextRequest } from "next/server";
import { HttpError, handle, isDuplicateKeyError, json, parseBody } from "@/lib/api";
import { User } from "@/models/User";
import { registerSchema } from "@/lib/validations/auth";
import { hashPassword } from "@/lib/password";
import { Role } from "@/types/enums";

/**
 * POST /api/auth/register
 * Inscription publique d'un utilisateur.
 * Règle de sécurité : Seuls les rôles OWNER et TENANT sont autorisés.
 * Les rôles ADMIN et SYNDIC sont strictement interdits.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const data = await parseBody(req, registerSchema);
    const normalizedEmail = data.email.toLowerCase().trim();

    if (data.role !== Role.OWNER && data.role !== Role.TENANT) {
      throw new HttpError(400, "Seuls les rôles Propriétaire (OWNER) et Locataire (TENANT) sont autorisés");
    }

    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      throw new HttpError(409, "Un compte avec cette adresse email existe déjà");
    }

    const passwordHash = await hashPassword(data.password);

    try {
      const user = await User.create({
        name: data.name,
        email: normalizedEmail,
        passwordHash,
        phone: data.phone,
        role: data.role,
        isActive: true,
      });

      return json(
        {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        },
        201
      );
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new HttpError(409, "Un compte avec cette adresse email existe déjà");
      }
      throw err;
    }
  });
}
