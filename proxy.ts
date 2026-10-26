import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { NextResponse } from "next/server";
import { ROLE_HOME, isRouteAllowed } from "@/lib/permissions";
import { Role } from "@/types/enums";

const { auth } = NextAuth(authConfig);

/**
 * Proxy Next.js 16 (remplaçant officiel de middleware.ts).
 * Exécute le contrôle d'accès aux pages de manière légère sans importer Mongoose.
 */
export const proxy = auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // Désactivation en production de /api-docs si ENABLE_API_DOCS n'est pas activé
  if (
    pathname.startsWith("/api-docs") &&
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_API_DOCS !== "true"
  ) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const isLoggedIn = !!req.auth?.user;
  const userRole = (req.auth?.user?.role as Role) || Role.RESIDENT;

  const isAuthPage = pathname === "/login" || pathname === "/register";

  // 1. Utilisateur connecté qui se rend sur /login ou /register -> redirection vers sa page d'accueil
  if (isLoggedIn && isAuthPage) {
    const homeUrl = ROLE_HOME[userRole] || "/dashboard";
    return NextResponse.redirect(new URL(homeUrl, nextUrl.origin));
  }

  // 2. Utilisateur non connecté sur une page protégée -> redirection vers /login avec callbackUrl
  if (!isLoggedIn && !isAuthPage) {
    if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }
    // Évite l'open redirect en ne gardant que le chemin relatif
    const callbackPath = `${pathname}${nextUrl.search}`;
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", callbackPath);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Utilisateur connecté tentant d'accéder à une route interdite pour son rôle
  if (isLoggedIn && !isRouteAllowed(pathname, userRole)) {
    return NextResponse.redirect(new URL("/forbidden", nextUrl.origin));
  }

  return NextResponse.next();
});

export default proxy;

export const config = {
  matcher: [
    /*
     * Exclut :
     * - api/auth (authentification)
     * - _next/static, _next/image (ressources internes Next.js)
     * - favicon.ico, sw.js, manifest.webmanifest (PWA et offline obligatoires)
     * - icons/ (icônes PWA)
     * - offline (page de secours PWA)
     * - fichiers statiques avec extensions (.svg, .png, .jpg, etc.)
     */
    "/((?!api/auth|_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.webmanifest|icons/|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
