import type { NextAuthConfig } from "next-auth";
import { Role } from "@/types/enums";

/**
 * Configuration légère Auth.js (v5) sans dépendance Node.js lourde (Mongoose, bcrypt).
 * Utilisable dans le proxy et le middleware sans impacter les performances de démarrage.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 jours
    updateAge: 24 * 60 * 60,   // 24 heures
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage =
        nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/register");

      if (isAuthPage) {
        return true;
      }
      return isLoggedIn;
    },
    jwt({ token, user }) {
      // Lors de la connexion initiale, user contient les données renvoyées par authorize()
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role;
      }
      return token;
    },
    session({ session, token }) {
      // Propagation de l'id et du rôle typé dans l'objet session client/serveur
      if (token && session.user) {
        session.user.id = (token.id as string) ?? (token.sub as string);
        session.user.role = (token.role as Role) ?? Role.RESIDENT;
      }
      return session;
    },
  },
  providers: [],
};

export default authConfig;
