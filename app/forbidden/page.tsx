"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, Home, ArrowLeft } from "lucide-react";
import { getOfflineSession } from "@/lib/offline/db";
import { ROLE_HOME } from "@/lib/permissions";
import { Role } from "@/types/enums";

export default function ForbiddenPage() {
  const [role, setRole] = useState<Role>(Role.RESIDENT);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role) {
          setRole(data.user.role as Role);
        } else {
          getOfflineSession().then((offline) => {
            if (offline?.role) setRole(offline.role);
          });
        }
      })
      .catch(() => {
        getOfflineSession().then((offline) => {
          if (offline?.role) setRole(offline.role);
        });
      });
  }, []);

  const homeUrl = ROLE_HOME[role] || "/dashboard";

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-100 text-rose-600 shadow-lg shadow-rose-500/10 dark:bg-rose-950/50 dark:text-rose-400">
        <ShieldAlert className="h-10 w-10" />
      </div>

      <span className="mt-6 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
        Erreur 403 — Accès Restreint
      </span>

      <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
        Accès Interdit à cette ressource
      </h1>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 sm:text-base dark:text-slate-400">
        Votre compte actuel (rôle : <strong>{role}</strong>) ne possède pas les permissions requises pour consulter ou administrer cette page.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href={homeUrl}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-500/20 transition-all hover:bg-sky-600"
        >
          <Home className="h-4 w-4" />
          Retour à l'accueil
        </Link>
        <Link
          href="/login"
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Changer de compte
        </Link>
      </div>
    </div>
  );
}
