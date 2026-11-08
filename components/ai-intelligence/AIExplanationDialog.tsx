"use client";

import { useState } from "react";
import { LoaderCircle, Sparkles, X } from "lucide-react";
import type { RecurringPattern } from "@/types/ai-intelligence";
import { AIBadge } from "@/components/ai/AIBadge";

type Explanation = { summary: string; observations: string[]; recommendations: string[] };

export default function AIExplanationDialog({ pattern, onClose }: { pattern: RecurringPattern; onClose: () => void }) {
  const [result, setResult] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const explain = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai/intelligence/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          residenceId: pattern.residenceId,
          patternId: pattern.id,
          incidentIds: pattern.complaintIds,
        }),
      });
      const payload: { data?: Explanation; error?: string; message?: string } = await response.json();
      if (!response.ok || !payload.data) throw new Error(payload.error ?? payload.message ?? "L’explication n’a pas pu être générée.");
      setResult(payload.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div role="presentation" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="ai-explanation-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-2xl sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div><span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600"><Sparkles aria-hidden="true" className="h-4 w-4" />Analyse à la demande</span><h2 id="ai-explanation-title" className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">Expliquer ce rapprochement</h2></div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-slate-800"><X aria-hidden="true" className="h-5 w-5" /></button>
        </header>
        <div className="mt-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60"><p className="font-medium text-slate-900 dark:text-white">{pattern.title}</p><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{pattern.evidence}</p><p className="mt-3 text-xs text-slate-500">{pattern.complaintCount} réclamations · {pattern.periodLabel}</p></div>
        {!result && !error && <p className="mt-4 text-sm text-slate-500">L’explication utilise uniquement les informations autorisées de ce groupe et n’est générée qu’après votre demande.</p>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
        {result && <div className="mt-5 space-y-4 text-sm leading-6 text-slate-700 dark:text-slate-300"><AIBadge label="Explication IA" /><p>{result.summary}</p><div><h3 className="font-semibold text-slate-900 dark:text-white">Observations</h3><ul className="mt-1 list-disc space-y-1 pl-5">{result.observations.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div><div><h3 className="font-semibold text-slate-900 dark:text-white">Pistes d’action</h3><ul className="mt-1 list-disc space-y-1 pl-5">{result.recommendations.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div><p className="rounded-lg border border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-700">Une similarité observée ne confirme pas une cause commune et ne démontre pas de causalité.</p></div>}
        <footer className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Fermer</button>
          <button type="button" disabled={loading} onClick={() => void explain()} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-60">{loading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden="true" className="h-4 w-4" />}{result ? "Regénérer" : "Générer l’explication"}</button>
        </footer>
      </section>
    </div>
  );
}
