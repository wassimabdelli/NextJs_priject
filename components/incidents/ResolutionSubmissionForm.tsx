"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { IncidentStatus } from "@/types/enums";
import { compressIncidentImage } from "./compressIncidentImage";

export interface ResolutionData {
  resolutionDescription?: string;
  resolutionPhotos: string[];
  resolutionSubmittedAt?: string;
  resolutionConfirmedAt?: string;
  resolutionRejectedAt?: string;
  resolutionFeedback?: string;
  resolvedAt?: string;
  status?: IncidentStatus;
}

export function ResolutionSubmissionForm({
  incidentId,
  onSubmitted,
}: {
  incidentId: string;
  onSubmitted: (data: ResolutionData) => void;
}) {
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files).slice(0, Math.max(0, 3 - photos.length));
    try {
      const compressed = await Promise.all(selected.map(compressIncidentImage));
      setPhotos((current) => [...current, ...compressed].slice(0, 3));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de lire la photo.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/resolution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, photos }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible d'envoyer la preuve.");
      onSubmitted(result);
      setDescription("");
      setPhotos([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer la preuve.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="resolution-description" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Travaux effectués</label>
        <textarea id="resolution-description" rows={4} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} required placeholder="Décrivez l'intervention et le résultat obtenu..." className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      </div>
      <div className="space-y-2">
        <span className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Photos justificatives (3 maximum)</span>
        <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={(event) => void addPhotos(event.target.files)} />
        <div className="flex flex-wrap gap-2">
          {photos.map((photo, index) => (
            <div key={photo} className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={`Photo justificative ${index + 1}`} className="h-full w-full object-cover" />
              <button type="button" onClick={() => setPhotos((current) => current.filter((_, item) => item !== index))} aria-label="Supprimer la photo" className="absolute right-1 top-1 rounded-full bg-slate-900/80 p-1 text-white"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {photos.length < 3 && (
            <button type="button" onClick={() => fileInput.current?.click()} className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <Camera className="h-5 w-5 text-sky-500" /> Ajouter
            </button>
          )}
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      <Button type="submit" isLoading={loading} disabled={!description.trim()} className="w-full">Envoyer la preuve de résolution</Button>
    </form>
  );
}
