"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ResolutionData } from "./ResolutionSubmissionForm";

export function ResolutionReview({
  incidentId,
  resolution,
  onUpdated,
  onPhotoClick,
  canRespond,
}: {
  incidentId: string;
  resolution: ResolutionData;
  onUpdated: (data: ResolutionData) => void;
  onPhotoClick: (photo: string) => void;
  canRespond: boolean;
}) {
  const [feedback, setFeedback] = useState("");
  const [rejectionForm, setRejectionForm] = useState(false);
  const [loading, setLoading] = useState<"confirm" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirmed = Boolean(resolution.resolutionConfirmedAt);
  const resolvedWithoutConfirmation = resolution.status === "RESOLVED" && !confirmed;

  const send = async (action: "confirm" | "reject") => {
    setLoading(action);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/resolution/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        ...(action === "reject" ? { body: JSON.stringify({ feedback }) } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible d'enregistrer votre réponse.");
      onUpdated(result);
      setRejectionForm(false);
      setFeedback("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer votre réponse.");
    } finally {
      setLoading(null);
    }
  };

  if (!resolution.resolutionSubmittedAt) {
    return <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">Aucune preuve de résolution n&apos;a encore été soumise.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Preuve envoyée le {new Date(resolution.resolutionSubmittedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-100">{resolution.resolutionDescription}</p>
        {resolution.resolutionPhotos.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {resolution.resolutionPhotos.map((photo, index) => (
              <button key={`${photo.slice(0, 32)}-${index}`} type="button" onClick={() => onPhotoClick(photo)} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={`Preuve photo ${index + 1}`} className="aspect-video w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {confirmed ? (
        <div role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5" /> Résolution confirmée.
        </div>
      ) : resolvedWithoutConfirmation ? (
        <div role="status" className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          L&apos;incident est marqué comme résolu, sans confirmation du résident.
        </div>
      ) : resolution.resolutionRejectedAt && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="flex items-center gap-2 font-semibold"><XCircle className="h-4 w-4" /> Problème signalé comme non résolu</p>
          <p className="mt-1 whitespace-pre-wrap">{resolution.resolutionFeedback}</p>
        </div>
      )}

      {!confirmed && !resolvedWithoutConfirmation && canRespond && (
        <div className="space-y-3">
          {rejectionForm ? (
            <form onSubmit={(event) => { event.preventDefault(); void send("reject"); }} className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <label htmlFor="resolution-feedback" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Expliquez pourquoi le problème persiste</label>
              <textarea id="resolution-feedback" rows={3} maxLength={1000} value={feedback} onChange={(event) => setFeedback(event.target.value)} required className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setRejectionForm(false)}>Annuler</Button>
                <Button type="submit" variant="danger" size="sm" disabled={!feedback.trim()} isLoading={loading === "reject"}>Envoyer le retour</Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void send("confirm")} isLoading={loading === "confirm"}><CheckCircle2 className="h-4 w-4" /> Confirmer la résolution</Button>
              <Button variant="outline" onClick={() => setRejectionForm(true)}><XCircle className="h-4 w-4" /> Problème non résolu</Button>
            </div>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
