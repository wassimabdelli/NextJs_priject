"use client";

import Link from "next/link";
import { WifiOff, RefreshCw, Home, AlertCircle } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 ring-8 ring-amber-500/5 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/5">
        <WifiOff className="h-12 w-12 stroke-[1.75]" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
        Vous êtes hors ligne
      </h1>

      <p className="mt-3 max-w-md text-base text-slate-600 dark:text-slate-400">
        Cette page n’a pas encore été mise en cache sur cet appareil. Vos données
        déjà consultées (charges, incidents, annonces) restent accessibles depuis
        le tableau de bord.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-500 active:scale-95"
        >
          <Home className="h-4 w-4" />
          Tableau de bord hors ligne
        </Link>
        <button
          onClick={() => {
            if (typeof window !== "undefined") window.location.reload();
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" />
          Réessayer la connexion
        </button>
      </div>

      <div className="mt-8 flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
        <AlertCircle className="h-4 w-4 text-sky-500" />
        <span>Les signalements d&apos;incidents et paiements saisis hors ligne seront synchronisés automatiquement.</span>
      </div>
    </div>
  );
}
