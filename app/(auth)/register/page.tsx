"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Building2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { saveOfflineSession } from "@/lib/offline/db";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"OWNER" | "TENANT">("OWNER");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage("Le mot de passe doit comporter au moins 8 caractères.");
      return;
    }

    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMessage("Le mot de passe doit contenir au moins une lettre et un chiffre.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    try {
      // 1. Appel de création de compte
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password,
          confirmPassword,
          phone: phone.trim() || undefined,
          role,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Une erreur est survenue lors de l'inscription.");
      }

      // 2. Connexion automatique suite à la création
      const signInRes = await signIn("credentials", {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (signInRes?.ok) {
        // Enregistrement offline
        try {
          const sessionRes = await fetch("/api/auth/session");
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            if (sessionData?.user?.id) {
              await saveOfflineSession({
                id: sessionData.user.id,
                name: sessionData.user.name || name,
                email: sessionData.user.email || email,
                role: sessionData.user.role || role,
                expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
              });
            }
          }
        } catch {
          // ignore
        }
        window.location.href = "/dashboard";
      } else {
        router.push("/login");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'inscription";
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
            Créer un <span className="text-sky-500">compte</span>
          </h1>
          <p className="mt-2 text-pretty text-sm text-slate-600 dark:text-slate-400">
            Rejoignez votre copropriété SyndicPro
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Profil / Rôle */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Vous êtes
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("OWNER")}
                  className={`flex min-h-[44px] items-center justify-center rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                    role === "OWNER"
                      ? "border-sky-500/80 bg-sky-500/10 text-sky-700 shadow-sm dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500"
                      : "border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                  }`}
                >
                  Propriétaire
                </button>
                <button
                  type="button"
                  onClick={() => setRole("TENANT")}
                  className={`flex min-h-[44px] items-center justify-center rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                    role === "TENANT"
                      ? "border-sky-500/80 bg-sky-500/10 text-sky-700 shadow-sm dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500"
                      : "border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                  }`}
                >
                  Locataire
                </button>
              </div>
            </div>
            {/* Nom complet */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Nom complet
              </label>
              <div className="mt-1.5">
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jean Dupont"
                  className="block w-full rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            {/* Email */}
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

            {/* Téléphone (optionnel) */}
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Téléphone <span className="text-xs text-slate-400 font-normal">(optionnel)</span>
              </label>
              <div className="mt-1.5">
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+216 -- --- ---"
                  className="block w-full rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Mot de passe <span className="text-xs text-slate-400 font-normal">(min 8 car., lettre + chiffre)</span>
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
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

            {/* Confirmation du mot de passe */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Confirmer le mot de passe
              </label>
              <div className="mt-1.5">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading}
              isLoading={loading}
              className="mt-2 w-full justify-center text-base font-semibold shadow-sm"
            >
              {loading ? "Création du compte..." : "Créer mon compte"}
            </Button>
          </form>

          {/* Lien retour connexion */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Vous possédez déjà un compte ?{" "}
              <Link
                href="/login"
                className="font-semibold text-sky-500 hover:text-sky-600 dark:text-sky-400"
              >
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
