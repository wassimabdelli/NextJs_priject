"use client";

import { ArrowUpRight, Check, LoaderCircle, MapPin, Repeat2, X } from "lucide-react";
import type { RecurringPattern } from "@/types/ai-intelligence";
import { incidentCategoryLabel, incidentStatusLabel, priorityLabel } from "@/types/enums";

type Props = {
  patterns: RecurringPattern[];
  onExplain: (pattern: RecurringPattern) => void;
  onViewComplaints: (ids: string[]) => void;
  onReview: (pattern: RecurringPattern, status: "CONFIRMED" | "DISMISSED" | "CLEAR") => void;
  reviewingPatternId: string;
};

const categoryLabel = (category?: string) =>
  category && category in incidentCategoryLabel
    ? incidentCategoryLabel[category as keyof typeof incidentCategoryLabel]
    : category ?? "Autre";

export default function RecurringIssues({ patterns, onExplain, onViewComplaints, onReview, reviewingPatternId }: Props) {
  if (!patterns.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300"><Repeat2 aria-hidden="true" className="h-7 w-7" /></span>
        <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">Aucun rapprochement détecté</h3>
        <p className="mt-1 text-sm text-slate-500">Un rapprochement apparaîtra lorsque les descriptions fourniront suffisamment d’éléments.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {patterns.map((pattern) => (
        <article key={pattern.id} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition-colors hover:border-indigo-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">{pattern.evidenceLevel === "category_only" ? "Même catégorie · à vérifier" : pattern.detectionMethod === "semantic_embedding" ? "Sens similaire · multilingue" : "Similarité textuelle"}</span>
                {pattern.reviewStatus && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${pattern.reviewStatus === "CONFIRMED" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{pattern.reviewStatus === "CONFIRMED" ? "Confirmé par le gestionnaire" : "Écarté par le gestionnaire"}</span>}
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{categoryLabel(pattern.category)}</span>
                {pattern.evidenceLevel !== "category_only" && <span className="text-xs text-slate-500">Éléments {pattern.evidenceLevel === "moderate" ? "modérés" : "faibles"}</span>}
              </div>
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{pattern.title}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{pattern.evidence}</p>
              <p className="mt-2 text-xs text-slate-500">
                Statuts : {Object.entries(pattern.statuses).map(([status, count]) => `${incidentStatusLabel[status as keyof typeof incidentStatusLabel] ?? status} ${count}`).join(" · ") || "—"}
                {" · "}Priorités : {Object.entries(pattern.priorities).map(([priority, count]) => `${priorityLabel[priority as keyof typeof priorityLabel] ?? priority} ${count}`).join(" · ") || "—"}
              </p>
              {pattern.location && <p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><MapPin aria-hidden="true" className="h-3.5 w-3.5" />{pattern.location}</p>}
              <p className="mt-2 text-xs text-slate-400">{pattern.periodLabel}</p>
            </div>
            <div className="flex shrink-0 flex-row flex-wrap items-center gap-x-4 gap-y-2 sm:flex-col sm:items-end sm:justify-center">
              <span className="text-2xl font-semibold text-slate-900 dark:text-white">{pattern.complaintCount}</span>
              <span className="text-xs text-slate-500">réclamations liées</span>
              <button type="button" onClick={() => onExplain(pattern)} className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300">Expliquer <ArrowUpRight aria-hidden="true" className="ml-1 inline h-4 w-4" /></button>
              <button type="button" onClick={() => onViewComplaints(pattern.complaintIds)} className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-300 dark:hover:text-white">Voir les réclamations</button>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button
                  type="button"
                  disabled={reviewingPatternId === pattern.id}
                  onClick={() => onReview(pattern, pattern.reviewStatus === "CONFIRMED" ? "CLEAR" : "CONFIRMED")}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-emerald-200 px-2.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-emerald-900 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                >
                  {reviewingPatternId === pattern.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {pattern.reviewStatus === "CONFIRMED" ? "Annuler la confirmation" : "Confirmer"}
                </button>
                <button
                  type="button"
                  disabled={reviewingPatternId === pattern.id}
                  onClick={() => onReview(pattern, pattern.reviewStatus === "DISMISSED" ? "CLEAR" : "DISMISSED")}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <X className="h-3.5 w-3.5" />
                  {pattern.reviewStatus === "DISMISSED" ? "Annuler le rejet" : "Écarter"}
                </button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
