"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AILoading } from "./AILoading";
import { AIError } from "./AIError";
import { AIDuplicateWarning, type PossibleDuplicate } from "./AIDuplicateWarning";
import { AIBadge } from "./AIBadge";

export function AIDuplicateReview({
  incidentId,
  residenceId,
  title,
  description,
  onInspect,
}: {
  incidentId: string;
  residenceId: string;
  title: string;
  description: string;
  onInspect: (id: string) => void;
}) {
  const [matches, setMatches] = useState<PossibleDuplicate[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState("");
  const [feedback, setFeedback] = useState("");

  const search = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/ai/incidents/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId, residenceId, title, description }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Recherche impossible.");
      setMatches(data.possibleDuplicates);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Recherche impossible."); }
    finally { setLoading(false); }
  };

  const review = async (targetIncidentId: string, action: "LINK" | "DISMISS") => {
    setReviewingId(targetIncidentId); setError("");
    try {
      const response = await fetch(`/api/incidents/${incidentId}/duplicates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetIncidentId, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible d’enregistrer votre décision.");
      setMatches((current) => current.filter((item) => item.incidentId !== targetIncidentId));
      setFeedback(action === "LINK" ? "Incidents liés comme dossiers associés." : "Correspondance écartée.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Action impossible."); }
    finally { setReviewingId(""); }
  };

  return <section className="space-y-3 rounded-xl border border-sky-200 p-3 dark:border-sky-900">
    <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-slate-900 dark:text-white">Incidents similaires</h3><AIBadge label="Rapprochement IA" /></div>
    <Button type="button" variant="outline" className="min-h-[44px] focus-visible:ring-2 focus-visible:ring-sky-500" disabled={loading} onClick={() => void search()}>Rechercher des incidents potentiellement similaires</Button>
    <p className="text-xs text-slate-500">Les rapprochements sont des suggestions; un syndic doit examiner et décider avant de lier ou d’écarter.</p>
    {loading && <AILoading label="Analyse des incidents autorisés…" />}
    {error && <AIError message={error} />}
    {feedback && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{feedback}</p>}
    <AIDuplicateWarning matches={matches} context="Correspondance possible uniquement; vérifiez le dossier avant de lier ou d’écarter." />
    {matches.map((item) => <div key={item.incidentId} className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => onInspect(item.incidentId)}>Voir le dossier</Button>
      <Button type="button" size="sm" disabled={Boolean(reviewingId)} onClick={() => void review(item.incidentId, "LINK")}>Lier comme incident associé</Button>
      <Button type="button" variant="ghost" size="sm" disabled={Boolean(reviewingId)} onClick={() => void review(item.incidentId, "DISMISS")}>Écarter cette correspondance</Button>
      {reviewingId === item.incidentId && <AILoading label="Enregistrement…" />}
    </div>)}
  </section>;
}
