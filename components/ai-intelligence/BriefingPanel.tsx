"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, RefreshCw, Repeat2, Sparkles } from "lucide-react";
import { incidentCategoryLabel } from "@/types/enums";
import { AIBadge } from "@/components/ai/AIBadge";

type BriefingPanelProps = {
  recurringHref?: string;
};

type BriefingResponse = {
  facts: {
    generatedAt: string;
    criticalUnassigned: Array<{
      id: string;
      title: string;
      residence: string;
      hoursOpen: number;
    }>;
    staleOverSevenDays: number;
    resolvedLast24h: number;
    recurring: Array<{
      patternId: string;
      residenceId: string;
      category: string;
      count: number;
      sharedTerms: string[];
    }>;
  };
  narrative: {
    summary: string;
    observations: string[];
    recommendations: string[];
  } | null;
  narrativeUnavailable: boolean;
};

type Technician = {
  _id: string;
  name?: string;
  email: string;
};

function categoryName(category: string) {
  return category in incidentCategoryLabel
    ? incidentCategoryLabel[category as keyof typeof incidentCategoryLabel]
    : category;
}

function BriefingSkeleton() {
  return (
    <section aria-label="Chargement du briefing" aria-busy="true" className="space-y-4">
      <div className="h-36 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
        ))}
      </div>
    </section>
  );
}

export default function BriefingPanel({ recurringHref = "#recurring" }: BriefingPanelProps) {
  const router = useRouter();
  const [data, setData] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [recommendationDecisions, setRecommendationDecisions] = useState<Record<string, "APPLIED" | "IGNORED">>({});
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [technicianError, setTechnicianError] = useState("");
  const [selectedTechnicians, setSelectedTechnicians] = useState<Record<string, string>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignFeedback, setAssignFeedback] = useState<{
    id: string;
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [draftingPatternId, setDraftingPatternId] = useState<string | null>(null);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    void fetch("/api/users?role=TECHNICIAN&limit=50")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Impossible de charger les techniciens.");
        }
        return payload;
      })
      .then((payload: Technician[] | { data?: Technician[] }) => {
        if (!active) return;
        const list = Array.isArray(payload) ? payload : payload.data ?? [];
        setTechnicians(list);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setTechnicianError(requestError instanceof Error ? requestError.message : "Impossible de charger les techniciens.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const loadBriefing = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/ai/briefing${refresh ? "?refresh=1" : ""}`, {
        cache: "no-store",
      });
      const payload: BriefingResponse & { error?: string; message?: string } = await response.json();
      if (!response.ok || !payload.facts) {
        throw new Error(payload.error ?? payload.message ?? "Impossible de charger le briefing.");
      }
      setData(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Impossible de charger le briefing.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const assignTechnician = async (incident: BriefingResponse["facts"]["criticalUnassigned"][number]) => {
    const assignedTo = selectedTechnicians[incident.id];
    if (!assignedTo || assigningId) return;

    setAssigningId(incident.id);
    setAssignFeedback(null);
    try {
      const response = await fetch(`/api/incidents/${encodeURIComponent(incident.id)}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo }),
      });
      const payload: { error?: string } = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Impossible d'assigner le technicien.");
      }

      setData((current) => current && ({
        ...current,
        facts: {
          ...current.facts,
          criticalUnassigned: current.facts.criticalUnassigned.filter((item) => item.id !== incident.id),
        },
      }));
      const technician = technicians.find((item) => item._id === assignedTo);
      setAssignFeedback({
        id: incident.id,
        kind: "success",
        message: `Assigné : ${technician?.name || technician?.email || "Technicien"}`,
      });
    } catch (requestError) {
      setAssignFeedback({
        id: incident.id,
        kind: "error",
        message: requestError instanceof Error
          ? requestError.message
          : "Impossible d'assigner le technicien.",
      });
    } finally {
      setAssigningId(null);
    }
  };

  const prepareAnnouncementDraft = async (pattern: BriefingResponse["facts"]["recurring"][number]) => {
    if (draftingPatternId) return;
    setDraftingPatternId(pattern.patternId);
    setDraftErrors((current) => ({ ...current, [pattern.patternId]: "" }));
    try {
      const analyticsResponse = await fetch("/api/ai/intelligence/analytics", { cache: "no-store" });
      const analyticsPayload: {
        data?: {
          recurringProblems?: Array<{ id: string; incidentIds?: string[] }>;
        };
        error?: string;
        message?: string;
      } = await analyticsResponse.json();
      if (!analyticsResponse.ok) {
        throw new Error(analyticsPayload.error ?? analyticsPayload.message ?? "Impossible de charger les dossiers similaires.");
      }

      const matchingPattern = analyticsPayload.data?.recurringProblems?.find(
        (candidate) => candidate.id === pattern.patternId
      );
      const incidentIds = matchingPattern?.incidentIds;
      if (!incidentIds || incidentIds.length < 2) {
        throw new Error("Les dossiers de ce rapprochement ne sont plus disponibles pour préparer un brouillon.");
      }

      const response = await fetch("/api/ai/intelligence/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residenceId: pattern.residenceId,
          patternId: pattern.patternId,
          incidentIds,
        }),
      });
      const payload: {
        announcement?: { _id?: string; id?: string };
        error?: string;
        message?: string;
      } = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? payload.message ?? "Impossible de préparer le brouillon.");
      }
      const announcementId = payload.announcement?._id ?? payload.announcement?.id;
      if (!announcementId) {
        throw new Error("Le brouillon a été créé, mais son identifiant est manquant.");
      }
      router.push(`/announcements?announcement=${encodeURIComponent(announcementId)}`);
    } catch (requestError) {
      setDraftErrors((current) => ({
        ...current,
        [pattern.patternId]: requestError instanceof Error
          ? requestError.message
          : "Impossible de préparer le brouillon.",
      }));
    } finally {
      setDraftingPatternId(null);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadBriefing(), 0);
    return () => window.clearTimeout(timer);
  }, [loadBriefing]);

  if (loading && !data) return <BriefingSkeleton />;

  if (!data) {
    return (
      <section role="status" className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {error || "Le briefing est momentanément indisponible."}
          </p>
          <button type="button" onClick={() => void loadBriefing()} className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            Réessayer
          </button>
        </div>
      </section>
    );
  }

  const { facts, narrative } = data;

  return (
    <section aria-labelledby="daily-briefing-title" className="space-y-4">
      <header className="flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-500 p-5 text-white shadow-sm dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950 dark:ring-1 dark:ring-white/10 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 id="daily-briefing-title" className="text-xl font-semibold sm:text-2xl">
            Bonjour 👋 Voici ce qui demande votre attention
          </h2>
          <p className="mt-2 text-sm text-indigo-50">
            Briefing du {new Date(facts.generatedAt).toLocaleString("fr-FR")}
          </p>
        </div>
        <button
          type="button"
          disabled={refreshing}
          onClick={() => void loadBriefing(true)}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60"
        >
          <RefreshCw aria-hidden="true" className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-900/70 dark:bg-rose-950/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-800 dark:text-rose-200">
            <AlertTriangle aria-hidden="true" className="h-4 w-4" />
            Urgentes non assignées
          </div>
          {facts.criticalUnassigned.length ? (
            <ul className="mt-3 space-y-2">
              {facts.criticalUnassigned.map((incident) => (
                <li key={incident.id} className="rounded-xl border border-rose-200 bg-white/80 p-3 dark:border-rose-900 dark:bg-slate-900/70">
                  <div>
                    <span className="block font-medium text-slate-900 dark:text-white">{incident.title}</span>
                    <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">
                      {[incident.residence, `il y a ${incident.hoursOpen} h`].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <label className="mt-3 block">
                    <span className="sr-only">Technicien pour {incident.title}</span>
                    <select
                      aria-label={`Technicien pour ${incident.title}`}
                      value={selectedTechnicians[incident.id] ?? ""}
                      onChange={(event) => setSelectedTechnicians((current) => ({
                        ...current,
                        [incident.id]: event.target.value,
                      }))}
                      className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="">Choisir un technicien</option>
                      {technicians.map((technician) => (
                        <option key={technician._id} value={technician._id}>
                          {technician.name || technician.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!selectedTechnicians[incident.id] || assigningId !== null}
                    aria-busy={assigningId === incident.id}
                    onClick={() => void assignTechnician(incident)}
                    className="mt-2 inline-flex min-h-[40px] w-full items-center justify-center rounded-lg bg-rose-700 px-3 text-xs font-semibold text-white hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {assigningId === incident.id ? "Assignation…" : "Assigner"}
                  </button>
                  {assignFeedback?.id === incident.id && assignFeedback.kind === "error" && (
                    <p role="alert" className="mt-2 rounded-lg border border-rose-300 bg-rose-100 p-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
                      {assignFeedback.message}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push(`/incidents?incident=${encodeURIComponent(incident.id)}`)}
                    className="mt-2 min-h-[44px] text-xs font-medium text-rose-800 underline underline-offset-2 hover:text-rose-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-rose-200 dark:hover:text-white"
                  >
                    Ouvrir le dossier
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Aucune réclamation urgente non assignée</p>
          )}
          {assignFeedback?.kind === "success" && (
            <p role="status" className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              {assignFeedback.message}
            </p>
          )}
          {technicianError && (
            <p role="alert" className="mt-3 rounded-lg border border-rose-300 bg-rose-100 p-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
              {technicianError}
            </p>
          )}
        </article>

        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/70 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
            <Clock3 aria-hidden="true" className="h-4 w-4" />
            À relancer
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">
            {facts.staleOverSevenDays.toLocaleString("fr-FR")}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            réclamations ouvertes depuis plus de 7 jours
          </p>
        </article>

        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/70 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            Résolues récemment
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">
            {facts.resolvedLast24h.toLocaleString("fr-FR")}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">résolues ces dernières 24 h</p>
        </article>

        <article className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900/70 dark:bg-indigo-950/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-800 dark:text-indigo-200">
            <Repeat2 aria-hidden="true" className="h-4 w-4" />
            Similarités à examiner
          </div>
          {facts.recurring.length ? (
            <ul className="mt-3 space-y-3">
              {facts.recurring.map((pattern) => (
                <li key={pattern.patternId}>
                  <a href={recurringHref} className="font-medium text-slate-900 underline decoration-indigo-300 underline-offset-2 dark:text-white">
                    {categoryName(pattern.category)} · {pattern.count} réclamations
                  </a>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    Similarité observée, cause commune non confirmée
                  </p>
                  <button
                    type="button"
                    disabled={draftingPatternId !== null}
                    aria-busy={draftingPatternId === pattern.patternId}
                    onClick={() => void prepareAnnouncementDraft(pattern)}
                    className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-indigo-300 px-3 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-800 dark:text-indigo-200 dark:hover:bg-indigo-950/70"
                  >
                    {draftingPatternId === pattern.patternId && (
                      <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                    )}
                    Préparer un brouillon
                  </button>
                  {draftErrors[pattern.patternId] && (
                    <p role="alert" className="mt-2 rounded-lg border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                      {draftErrors[pattern.patternId]}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Aucune similarité textuelle récente à examiner.</p>
          )}
        </article>
      </div>

      {data.narrativeUnavailable && (
        <p role="status" className="text-xs text-slate-500 dark:text-slate-400">
          La synthèse IA est indisponible pour le moment; les indicateurs calculés restent disponibles.
        </p>
      )}

      {narrative && (
        <aside className="rounded-2xl border border-indigo-200 bg-white p-5 dark:border-indigo-900/70 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            <AIBadge label="Synthèse rédigée par IA" />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{narrative.summary}</p>
          {narrative.observations.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
              {narrative.observations.map((observation, index) => <li key={`${index}-${observation}`}>{observation}</li>)}
            </ul>
          )}
          {narrative.recommendations.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Pistes de réflexion</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Ces choix sont temporaires et ne modifient ni n’enregistrent aucune donnée.</p>
              <ul className="mt-2 space-y-2">
                {narrative.recommendations.map((recommendation, index) => {
                  const key = `${index}-${recommendation}`;
                  const decision = recommendationDecisions[key];
                  return (
                    <li key={key} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
                      <p className="text-sm text-slate-600 dark:text-slate-300">{recommendation}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          aria-pressed={decision === "APPLIED"}
                          onClick={() => setRecommendationDecisions((current) => ({ ...current, [key]: "APPLIED" }))}
                          className={`min-h-[44px] rounded-lg px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${decision === "APPLIED" ? "bg-indigo-700 text-white" : "border border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/50"}`}
                        >
                          Appliquer
                        </button>
                        <button
                          type="button"
                          aria-pressed={decision === "IGNORED"}
                          onClick={() => setRecommendationDecisions((current) => ({ ...current, [key]: "IGNORED" }))}
                          className={`min-h-[44px] rounded-lg px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${decision === "IGNORED" ? "bg-slate-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                        >
                          Ignorer
                        </button>
                        {decision && (
                          <span role="status" className="text-xs text-slate-500 dark:text-slate-400">
                            {decision === "APPLIED" ? "Retenue comme piste à examiner" : "Piste ignorée"}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>
      )}
    </section>
  );
}
