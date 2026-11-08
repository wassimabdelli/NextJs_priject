"use client";

import { Activity, AlertTriangle, ClipboardList, Megaphone, Repeat2 } from "lucide-react";

type Props = {
  metrics: {
    openComplaints: number;
    attentionCount: number;
    recurringPatternsCount: number;
    recentComplaintCount: number;
    publishedAnnouncementsCount: number;
  };
};

export default function AIOverviewCards({ metrics }: Props) {
  const cards = [
    { label: "Réclamations ouvertes", value: metrics.openComplaints, description: "Encore non résolues", icon: ClipboardList },
    { label: "À examiner", value: metrics.attentionCount, description: "Règles de suivi transparentes", icon: AlertTriangle },
    { label: "Similarités détectées", value: metrics.recurringPatternsCount, description: "Rapprochements possibles", icon: Repeat2 },
    { label: "Réclamations récentes", value: metrics.recentComplaintCount, description: "Période sélectionnée", icon: Activity },
    { label: "Annonces publiées", value: metrics.publishedAnnouncementsCount, description: "Période sélectionnée", icon: Megaphone },
  ];

  return (
    <section aria-label="Indicateurs" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map(({ label, value, description, icon: Icon }) => (
        <article key={label} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-900 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
            <span className="rounded-2xl bg-gradient-to-br from-indigo-50 to-sky-50 p-3 dark:from-indigo-950/70 dark:to-sky-950/50"><Icon aria-hidden="true" className="h-5 w-5 text-indigo-600 dark:text-indigo-300" /></span>
          </div>
          <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{value.toLocaleString("fr-FR")}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </article>
      ))}
    </section>
  );
}
