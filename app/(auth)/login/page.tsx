"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Building2, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { saveOfflineSession } from "@/lib/offline/db";
import { ROLE_HOME, isRouteAllowed } from "@/lib/permissions";
import { Role } from "@/types/enums";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Sécurité anti-open redirect : n'accepte que les chemins relatifs
  const rawCallbackUrl = searchParams.get("callbackUrl") || "";
  const requestedCallbackUrl =
    rawCallbackUrl.startsWith("/") && !rawCallbackUrl.startsWith("//")
      ? rawCallbackUrl
      : "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Veuillez renseigner votre email et votre mot de passe.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await signIn("credentials", {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (res?.error) {
        setErrorMessage("Email ou mot de passe incorrect.");
        setLoading(false);
        return;
      }

      let targetUrl = "/dashboard";

      // Récupération de la session fraîche pour hydrater le stockage Dexie hors-ligne et calculer la route autorisée
      try {
        const sessionRes = await fetch("/api/auth/session");
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          const rawRole = sessionData?.user?.role as string | undefined;
          const userRole: Role =
            rawRole === "RESIDENT" || !rawRole ? Role.OWNER : (rawRole as Role);

          if (sessionData?.user?.id) {
            await saveOfflineSession({
              id: sessionData.user.id,
              name: sessionData.user.name || "Utilisateur",
              email: sessionData.user.email || email,
              role: userRole,
              expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
            });
          }

          const defaultHome = ROLE_HOME[userRole] || "/dashboard";
          const callbackPathname = requestedCallbackUrl.split("?")[0];

          // Si l'utilisateur est un résident (OWNER/TENANT) ou un autre rôle, on vérifie que callbackUrl lui est autorisée
          // et n'est pas une route admin protégée (sinon redirection vers son dashboard spécifique)
          if (
            requestedCallbackUrl &&
            callbackPathname !== "/login" &&
            callbackPathname !== "/register" &&
            callbackPathname !== "/forbidden" &&
            isRouteAllowed(callbackPathname, userRole)
          ) {
            targetUrl = requestedCallbackUrl;
          } else {
            targetUrl = defaultHome;
          }
        }
      } catch (err) {
        console.warn("[Login] Sauvegarde de session hors-ligne différée :", err);
      }

      // Redirection sécurisée vers la route autorisée
      router.replace(targetUrl);
      window.location.href = targetUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Une erreur est survenue lors de la connexion.";
      setErrorMessage(msg);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh w-full flex-col justify-center bg-[#f4f5f7] px-4 py-8 sm:px-6 lg:px-8 dark:bg-slate-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-[1.5rem] bg-sky-500 text-white shadow-sm">
            <Building2 className="size-7" aria-hidden />
          </div>
          <h1 className="mt-5 text-balance text-3xl font-bold text-slate-900 sm:text-4xl dark:text-white">
            Syndic<span className="text-sky-500">Pro</span>
          </h1>
          <p className="mt-2 text-pretty text-sm text-slate-600 dark:text-slate-400">
            Connectez-vous pour accéder à votre espace de copropriété
          </p>
        </div>

        <div className="sp-card mt-8 rounded-[1.5rem] border border-slate-200/80 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Champ Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Adresse email
              </label>
              <div className="mt-1.5">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  className="block w-full rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            {/* Champ Mot de passe */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Mot de passe
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 pr-11 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Soumission : pill tactile (Button) */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading}
              isLoading={loading}
              className="w-full justify-center text-base font-semibold shadow-sm"
            >
              {loading ? "Connexion en cours..." : "Se connecter"}
            </Button>
          </form>

          {/* Lien vers inscription */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Pas encore de compte ?{" "}
              <Link
                href="/register"
                className="font-semibold text-sky-500 hover:text-sky-600 dark:text-sky-400"
              >
                Créer un compte (propriétaire ou locataire)
              </Link>
            </p>
          </div>
        </div>

        {/* Note démonstration */}
        <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Comptes de test : admin@syndicpro.tn | syndic@syndicpro.tn | tech@syndicpro.tn | resident@syndicpro.tn
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#f4f5f7]">
          <Loader2 className="size-8 animate-spin text-sky-500" aria-hidden />
          <span className="sr-only">Chargement</span>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
