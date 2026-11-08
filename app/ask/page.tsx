"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import AskPanel from "@/components/ai/AskPanel";

export default function AskPage() {
  return (
    <AppLayout>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-widest text-sky-700 dark:text-sky-300">
            SyndicPro · Interrogation
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Poser une question à vos réclamations
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Les réponses s&apos;appuient uniquement sur les réclamations que votre rôle
            vous autorise à consulter. Chaque réponse cite ses sources.
          </p>
        </header>
        <AskPanel />
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            Comment ça marche
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Votre question est filtrée par périmètre (résidence, rôle, auteur).</li>
            <li>Une recherche par similarité sémantique remonte les 6 dossiers les plus proches.</li>
            <li>Un modèle de génération rédige la réponse à partir de ces 6 dossiers uniquement.</li>
            <li>Aucune réclamation hors de votre périmètre n&apos;est envoyée au modèle.</li>
          </ul>
        </section>
      </main>
    </AppLayout>
  );
}
