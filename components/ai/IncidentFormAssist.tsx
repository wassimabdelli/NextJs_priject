"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AIDuplicateWarning, type PossibleDuplicate } from "./AIDuplicateWarning";
import { AIError } from "./AIError";
import { AILoading } from "./AILoading";
import { AIResultCard } from "./AIResultCard";

type Suggestion = {
  title: string;
  category: string;
  priority: string;
  specialty: string;
  probableCause: string;
  safetyRisk: boolean;
};

const CATEGORY: Record<string, string> = {
  PLUMBING: "Plomberie",
  ELECTRICITY: "Électricité",
  ELEVATOR: "Ascenseur",
  CLEANING: "Nettoyage",
  SECURITY: "Sécurité",
  OTHER: "Autre",
};

const PRIORITY: Record<string, string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  URGENT: "Urgente",
};

type Props = {
  title: string;
  description: string;
  residenceId: string;
  onApply: (value: { title?: string; category: string; priority: string }) => void;
  onMatchesChange?: (matches: PossibleDuplicate[]) => void;
  extraActions?: (item: PossibleDuplicate) => React.ReactNode;
};

export function IncidentFormAssist({
  title,
  description,
  residenceId,
  onApply,
  onMatchesChange,
  extraActions,
}: Props) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [duplicateResults, setDuplicateResults] = useState<{
    checkKey: string;
    matches: PossibleDuplicate[];
  }>({ checkKey: "", matches: [] });
  const [loading, setLoading] = useState<"" | "triage" | "dup">("");
  const [error, setError] = useState("");
  const lastChecked = useRef("");
  const autoChecks = useRef(0);
  const activeRequest = useRef<"" | "triage" | "dup">("");

  const canAnalyze = description.trim().length >= 10;
  const draftText = description.trim();
  const currentCheckKey = `${residenceId}:${title.trim()}:${draftText}`;
  const matches = useMemo(
    () => draftText.length >= 20 && duplicateResults.checkKey === currentCheckKey
      ? duplicateResults.matches
      : [],
    [currentCheckKey, draftText.length, duplicateResults]
  );

  useEffect(() => {
    onMatchesChange?.(matches);
  }, [matches, onMatchesChange]);

  useEffect(() => {
    if (draftText.length < 20) {
      lastChecked.current = "";
      onMatchesChange?.([]);
    }
  }, [draftText, onMatchesChange]);

  const analyze = async () => {
    if (!canAnalyze || activeRequest.current) return;
    activeRequest.current = "triage";
    setLoading("triage");
    setError("");
    try {
      const form = new FormData();
      form.append("title", title || description.slice(0, 80));
      form.append("description", description);
      const response = await fetch("/api/ai/triage", { method: "POST", body: form });
      const data: { data?: Suggestion; error?: string } = await response.json();
      if (!response.ok || !data.data) {
        throw new Error(data.error ?? "Analyse indisponible.");
      }
      setSuggestion(data.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Analyse impossible.");
    } finally {
      activeRequest.current = "";
      setLoading("");
    }
  };

  const checkDuplicates = useCallback(async (auto = false, force = false) => {
    const text = description.trim();
    const checkKey = `${residenceId}:${title.trim()}:${text}`;
    if (!residenceId || text.length < 20 || activeRequest.current) return;
    if (auto && autoChecks.current >= 3) return;
    if (!force && lastChecked.current === checkKey) return;

    lastChecked.current = checkKey;
    if (auto) autoChecks.current += 1;
    activeRequest.current = "dup";
    setLoading("dup");
    setError("");
    try {
      const response = await fetch("/api/ai/incidents/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || text.slice(0, 80),
          description: text,
          residenceId,
        }),
      });
      const data: { possibleDuplicates?: PossibleDuplicate[]; error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Recherche impossible.");
      setDuplicateResults({
        checkKey,
        matches: data.possibleDuplicates ?? [],
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Recherche impossible.");
    } finally {
      activeRequest.current = "";
      setLoading("");
    }
  }, [description, residenceId, title]);

  useEffect(() => {
    if (!residenceId || description.trim().length < 20 || autoChecks.current >= 3) return;
    const timer = window.setTimeout(() => void checkDuplicates(true), 2500);
    return () => window.clearTimeout(timer);
  }, [checkDuplicates, description, residenceId]);

  return (
    <div className="space-y-3 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-sky-50/60 p-3 dark:border-indigo-900 dark:from-indigo-950/30 dark:to-sky-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          Assistance IA facultative
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canAnalyze || loading !== ""}
            onClick={() => void analyze()}
          >
            Analyser ma description
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={loading !== "" || !residenceId || description.trim().length < 20}
            onClick={() => void checkDuplicates(false, true)}
          >
            Vérifier les doublons
          </Button>
        </div>
      </div>

      {loading && (
        <AILoading label={loading === "dup" ? "Recherche de réclamations similaires…" : "Analyse en cours…"} />
      )}
      {error && <AIError message={error} />}

      {suggestion && (
        <AIResultCard title="Suggestion — à vérifier">
          <div className="space-y-2">
            <p>
              <strong>Catégorie :</strong> {CATEGORY[suggestion.category] ?? suggestion.category}
              {" · "}
              <strong>Priorité :</strong> {PRIORITY[suggestion.priority] ?? suggestion.priority}
              {" · "}
              <strong>Métier :</strong> {suggestion.specialty}
            </p>
            <p><strong>Cause possible :</strong> {suggestion.probableCause}</p>
            {suggestion.safetyRisk && (
              <p role="alert" className="rounded-lg bg-rose-100 p-2 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                Risque potentiel pour la sécurité : en cas de danger immédiat, contactez les secours.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onApply({
                    title: title.trim() ? undefined : suggestion.title,
                    category: suggestion.category,
                    priority: suggestion.priority,
                  });
                  setSuggestion(null);
                }}
              >
                Appliquer
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSuggestion(null)}>
                Ignorer
              </Button>
            </div>
          </div>
        </AIResultCard>
      )}

      <AIDuplicateWarning
        matches={matches}
        context="Correspondance possible uniquement. Vous pouvez envoyer votre signalement quand même."
        renderExtra={extraActions}
      />
    </div>
  );
}
