"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { AIError } from "@/components/ai/AIError";
import { AIResultCard } from "@/components/ai/AIResultCard";
import { Button } from "@/components/ui/Button";

export type AiTriageSuggestion = {
  title: string;
  description: string;
  category: string;
  priority: string;
  specialty: string;
  probableCause: string;
  safetyRisk: boolean;
  confidence: number;
  reasoning: string;
};

type Props = {
  title: string;
  description: string;
  files: File[];
  onApply: (suggestion: {
    title: string;
    description: string;
    category: string;
    priority: string;
  }) => void;
  onSuggestionAccepted?: (suggestion: AiTriageSuggestion) => void;
};

const CATEGORY_LABELS: Record<string, string> = {
  PLUMBING: "Plomberie",
  ELECTRICITY: "Électricité",
  ELEVATOR: "Ascenseur",
  CLEANING: "Nettoyage",
  SECURITY: "Sécurité",
  OTHER: "Autre",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  URGENT: "Urgente",
};

export default function AiTriagePanel({
  title,
  description,
  files,
  onApply,
  onSuggestionAccepted,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiTriageSuggestion | null>(null);
  const analysisRef = useRef<() => Promise<void>>(async () => {});
  const latestRequest = useRef({
    title,
    description,
    files,
    onApply,
    onSuggestionAccepted,
  });

  useEffect(() => {
    latestRequest.current = {
      title,
      description,
      files,
      onApply,
      onSuggestionAccepted,
    };
  }, [description, files, onApply, onSuggestionAccepted, title]);

  useEffect(() => {
    analysisRef.current = async () => {
      const request = latestRequest.current;
      if (request.files.length === 0) return;
      setLoading(true);
      setError(null);
      setResult(null);
      const formData = new FormData();
      if (request.title.trim()) formData.append("title", request.title);
      if (request.description.trim()) formData.append("description", request.description);
      request.files.slice(0, 3).forEach((file) => formData.append("images", file));

      try {
        const response = await fetch("/api/ai/triage", {
          method: "POST",
          body: formData,
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Erreur IA");
        const suggestion = json.data as AiTriageSuggestion;
        setResult(suggestion);
        request.onApply(suggestion);
        request.onSuggestionAccepted?.(suggestion);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Erreur IA");
      } finally {
        setLoading(false);
      }
    };
  }, []);

  useEffect(() => {
    if (files.length > 0) void analysisRef.current();
  }, [files]);

  if (files.length === 0) return null;

  return (
    <div className="space-y-3">
      {files.length > 0 && (
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300" aria-live="polite">
          {loading
            ? "Analyse de la photo en cours avec Gemini…"
            : result
              ? "Suggestions Gemini appliquées aux champs — vérifiez-les avant l'envoi."
              : "La photo sera analysée par Gemini."}
        </p>
      )}

      {error && <AIError message={error} />}
      {error && files.length > 0 && (
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          isLoading={loading}
          onClick={() => void analysisRef.current()}
        >
          <RefreshCw className="h-4 w-4" />
          Réessayer l&apos;analyse
        </Button>
      )}

      {result && (
        <AIResultCard title="Suggestion IA — à vérifier">
          <div className="space-y-3">
            <p><span className="font-semibold">Titre suggéré : </span>{result.title}</p>
            <p><span className="font-semibold">Description suggérée : </span>{result.description}</p>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Catégorie</dt>
                <dd className="font-medium">{CATEGORY_LABELS[result.category] ?? result.category}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Priorité</dt>
                <dd className="font-medium">{PRIORITY_LABELS[result.priority] ?? result.priority}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Spécialité conseillée</dt>
                <dd className="font-medium">{result.specialty}</dd>
              </div>
            </dl>

            <p>
              <span className="font-semibold">Cause probable : </span>
              {result.probableCause}
            </p>

            {result.safetyRisk && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Risque potentiel pour la sécurité : vérifiez la situation rapidement.
              </p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              « Autre » indique uniquement que le problème ne correspond pas aux catégories principales. Le titre, la description et la priorité restent proposés. Vérifiez toutes les suggestions avant l&apos;envoi.
            </p>
          </div>
        </AIResultCard>
      )}
    </div>
  );
}
