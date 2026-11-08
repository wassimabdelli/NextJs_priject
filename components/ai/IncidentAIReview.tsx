"use client";

import { useState } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { AIError } from "@/components/ai/AIError";
import { Button } from "@/components/ui/Button";
import { AIBadge } from "./AIBadge";

type AiTriage = {
  probableCause?: string;
  specialty?: string;
  safetyRisk?: boolean;
};

type AiResolutionCheck = {
  verdict?: string;
  explanation?: string;
  confidence?: number;
  checkedAt?: string;
};

type Props = {
  incidentId: string;
  aiTriage?: AiTriage;
  aiResolutionCheck?: AiResolutionCheck;
  resolutionPhotos: string[];
  showTriage: boolean;
  canVerify: boolean;
  onResolutionCheckSaved: (check: AiResolutionCheck) => void;
};

const VERDICT_LABELS: Record<string, string> = {
  FIXED: "Semble résolu",
  PARTIALLY_FIXED: "Partiellement résolu",
  NOT_FIXED: "Semble non résolu",
  UNCLEAR: "Impossible à déterminer",
};

export function IncidentAIReview({
  incidentId,
  aiTriage,
  aiResolutionCheck,
  resolutionPhotos,
  showTriage,
  canVerify,
  onResolutionCheckSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestCheck, setLatestCheck] = useState<AiResolutionCheck | undefined>();
  const resolutionCheck = latestCheck ?? aiResolutionCheck;
  const hasTriage = showTriage && Boolean(aiTriage);
  const canRequestCheck = canVerify && resolutionPhotos.length > 0;

  if (!hasTriage && !resolutionCheck && !canRequestCheck) return null;

  async function verifyResolution() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/ai-verify`, {
        method: "POST",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Vérification IA indisponible");
      setLatestCheck(json.data as AiResolutionCheck);
      onResolutionCheckSaved(json.data as AiResolutionCheck);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Vérification IA indisponible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900 dark:bg-sky-950/20">
      <h3 className="flex items-center gap-2 text-sm font-bold text-sky-900 dark:text-sky-200">
        <Sparkles className="h-4 w-4" />
        Assistance IA <AIBadge />
      </h3>

      {hasTriage && (
        <div className="space-y-2 rounded-xl bg-white/70 p-3 text-sm dark:bg-slate-900/50">
          <h4 className="font-semibold text-slate-900 dark:text-white">Analyse IA</h4>
          {aiTriage?.probableCause && <p><span className="font-semibold">Cause probable : </span>{aiTriage.probableCause}</p>}
          {aiTriage?.specialty && <p><span className="font-semibold">Spécialité : </span>{aiTriage.specialty}</p>}
          {aiTriage?.safetyRisk && (
            <p className="flex items-start gap-2 font-semibold text-rose-700 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Risque potentiel pour la sécurité
            </p>
          )}
        </div>
      )}

      {resolutionCheck && (
        <div className="space-y-1 rounded-xl bg-white/70 p-3 text-sm dark:bg-slate-900/50">
          <h4 className="font-semibold text-slate-900 dark:text-white">Vérification de la résolution</h4>
          <p>
            <span className="font-semibold">Avis : </span>
            {VERDICT_LABELS[resolutionCheck.verdict ?? ""] ?? resolutionCheck.verdict ?? "Non disponible"}
          </p>
          {resolutionCheck.explanation && <p>{resolutionCheck.explanation}</p>}
        </div>
      )}

      {canRequestCheck && (
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          isLoading={loading}
          onClick={verifyResolution}
        >
          Vérifier la résolution avec l&apos;IA
        </Button>
      )}

      {error && <AIError message={error} />}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Avis indicatif uniquement : il ne modifie pas le statut de la réclamation.
      </p>
    </section>
  );
}
