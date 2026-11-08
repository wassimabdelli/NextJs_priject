"use client";

import { ArrowUpRight, FileEdit, Megaphone, Sparkles } from "lucide-react";
import Link from "next/link";
import type { AnnouncementSuggestion, CommunicationOpportunity, RecurringPattern } from "@/types/ai-intelligence";
import { AIBadge } from "@/components/ai/AIBadge";

type Props = {
  opportunities: CommunicationOpportunity[];
  suggestions: AnnouncementSuggestion[];
  patterns: RecurringPattern[];
  onCreateDraft: (pattern: RecurringPattern) => void;
  onEditDraft: (suggestion: AnnouncementSuggestion) => void;
  onPreview: (suggestion: AnnouncementSuggestion) => void;
};

const reviewLabel: Record<AnnouncementSuggestion["source"]["reviewStatus"], string> = {
  DRAFT: "Brouillon",
  UNDER_REVIEW: "À examiner",
  APPROVED: "Approuvée",
  REJECTED: "Refusée",
};

const reviewStyle: Record<AnnouncementSuggestion["source"]["reviewStatus"], string> = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  UNDER_REVIEW: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  APPROVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export default function CommunicationOpportunities({ opportunities, suggestions, patterns, onCreateDraft, onEditDraft, onPreview }: Props) {
  const patternById = new Map(patterns.map((pattern) => [pattern.id, pattern]));
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Occasions de communication</h2>
        <p className="mt-1 text-sm text-slate-500">Suggestions factuelles à examiner. Aucun message n’est publié automatiquement.</p>
      </header>
      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex items-center gap-2"><Megaphone aria-hidden="true" className="h-5 w-5 text-indigo-600" /><h3 className="font-semibold text-slate-900 dark:text-white">À évaluer</h3></div>
          {!opportunities.length ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/60">Aucune opportunité de communication n’est signalée par les données actuelles.</p> : (
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {opportunities.map((item) => {
                const pattern = patternById.get(item.patternId);
                return <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                  <p className="font-medium text-slate-900 dark:text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
                  <p className="mt-2 text-xs text-slate-400">{[item.residenceName, `${item.complaintCount} réclamations`].filter(Boolean).join(" · ")}</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.suggestedAction}</p>
                  {pattern && <button type="button" onClick={() => onCreateDraft(pattern)} className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900"><Sparkles aria-hidden="true" className="h-4 w-4" />Préparer un brouillon</button>}
                </li>;
              })}
            </ul>
          )}
        </article>
        <article className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex items-center gap-2"><FileEdit aria-hidden="true" className="h-5 w-5 text-indigo-600" /><h3 className="font-semibold text-slate-900 dark:text-white">Brouillons et revues</h3></div>
          {!suggestions.length ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/60">Aucun brouillon de communication IA pour le périmètre sélectionné.</p> : (
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {suggestions.map((item) => <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${reviewStyle[item.source.reviewStatus]}`}>{reviewLabel[item.source.reviewStatus]}</span>
                  <span className="text-xs text-slate-400">{new Date(item.source.generatedAt).toLocaleDateString("fr-FR")}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2"><h4 className="font-semibold text-slate-900 dark:text-white">{item.title}</h4><AIBadge label="Brouillon IA" /></div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{item.content}</p>
                <p className="mt-2 text-xs text-slate-400">{[item.residenceName, item.source.language, `${item.source.incidentIds.length} références liées`].filter(Boolean).join(" · ")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onPreview(item)} className="min-h-[44px] rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Aperçu</button>
                  {item.source.reviewStatus !== "REJECTED" && item.source.reviewStatus !== "APPROVED" && <button type="button" onClick={() => onEditDraft(item)} className="min-h-[44px] rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Modifier / examiner</button>}
                  {item.source.reviewStatus === "APPROVED" && item.status !== "PUBLISHED" && <Link href={`/announcements?announcement=${encodeURIComponent(item.id)}`} className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-300">Ouvrir les annonces <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>}
                </div>
              </li>)}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
