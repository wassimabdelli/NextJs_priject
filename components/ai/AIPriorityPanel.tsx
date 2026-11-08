"use client";

import { useState } from "react";
import { AIError } from "./AIError";
import { AILoading } from "./AILoading";
import { AIRecommendation, type PrioritySuggestion } from "./AIRecommendation";
import { AIBadge } from "./AIBadge";

export function AIPriorityPanel({
  incidentId,
  description,
  currentPriority,
  onApplied,
}: {
  incidentId: string;
  description: string;
  currentPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  onApplied: (priority: PrioritySuggestion["suggestedPriority"]) => void;
}) {
  const [result, setResult] = useState<PrioritySuggestion | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const getRecommendation = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/ai/incidents/priority", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Recommandation indisponible.");
      setResult(data as PrioritySuggestion);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Recommandation impossible."); }
    finally { setLoading(false); }
  };
  const apply = async () => {
    if (!result) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/incidents/${incidentId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: result.suggestedPriority }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible d’appliquer la priorité.");
      onApplied(result.suggestedPriority);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Mise à jour impossible."); }
    finally { setSaving(false); }
  };
  return <section className="space-y-2 rounded-xl border border-sky-200 p-3 dark:border-sky-900">
    <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-slate-900 dark:text-white">Priorité recommandée</h3><AIBadge /></div>
    {!result && <button type="button" disabled={loading} onClick={() => void getRecommendation()} className="min-h-[44px] rounded-lg border border-sky-300 px-3 text-sm font-semibold text-sky-800 transition-colors hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50 dark:border-sky-800 dark:text-sky-200 dark:hover:bg-sky-950/40">Suggérer une priorité avec l’IA</button>}
    {loading && <AILoading />}
    {error && <AIError message={error} />}
    {result && <AIRecommendation result={result} onAccept={!saving && ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(result.suggestedPriority) >= ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(currentPriority) ? () => void apply() : undefined} />}
    {result && ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(result.suggestedPriority) < ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(currentPriority) && <p className="text-xs text-amber-700 dark:text-amber-300">La suggestion est inférieure à la priorité humaine actuelle; elle ne sera pas appliquée automatiquement.</p>}
    {saving && <AILoading label="Enregistrement de la priorité…" />}
  </section>;
}
