"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, CalendarDays, RefreshCw } from "lucide-react";
import AskPanel from "@/components/ai/AskPanel";
import AIOverviewCards from "./AIOverviewCards";
import BriefingPanel from "./BriefingPanel";
import AnnouncementDraftDialog from "./AnnouncementDraftDialog";
import AnnouncementImpact from "./AnnouncementImpact";
import AIExplanationDialog from "./AIExplanationDialog";
import AIIntelligenceSkeleton from "./AIIntelligenceSkeleton";
import CommunicationOpportunities from "./CommunicationOpportunities";
import ComplaintTrends from "./ComplaintTrends";
import NeedsAttention from "./NeedsAttention";
import RecurringIssues from "./RecurringIssues";
import type {
  AIIntelligenceResponse,
  AnnouncementImpactItem,
  AnnouncementSuggestion,
  IntelligenceAnalyticsApiData,
  RecurringPattern,
} from "@/types/ai-intelligence";
import { incidentCategoryLabel } from "@/types/enums";

function localDate(date: Date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 10);
}

function displayDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}

function categoryName(category: string) {
  return category in incidentCategoryLabel
    ? incidentCategoryLabel[category as keyof typeof incidentCategoryLabel]
    : category;
}

function normalizeData(api: IntelligenceAnalyticsApiData): AIIntelligenceResponse {
  const recurringPatterns: RecurringPattern[] = api.recurringProblems.map((pattern) => ({
    id: pattern.id,
    residenceId: pattern.residenceId,
    title: pattern.detectionMethod === "category_count"
      ? `Plusieurs réclamations · ${categoryName(pattern.category)}`
      : pattern.detectionMethod === "semantic_embedding"
      ? `Descriptions de sens proche · ${categoryName(pattern.category)}`
      : pattern.sharedTerms.length
      ? `Descriptions similaires : ${pattern.sharedTerms.slice(0, 3).join(" · ")}`
      : `Réclamations similaires · ${categoryName(pattern.category)}`,
    patternType: pattern.detectionMethod === "category_count" ? "category" : "description",
    complaintCount: pattern.count,
    category: pattern.category,
    location: pattern.location ?? undefined,
    periodLabel: `Du ${displayDate(pattern.firstReportedAt)} au ${displayDate(pattern.latestReportedAt)}`,
    evidence: pattern.detectionMethod === "category_count"
      ? "Au moins trois réclamations de cette résidence ont la même catégorie. Les descriptions ne montrent pas de rapprochement textuel suffisant : vérifiez manuellement s’il s’agit du même problème."
      : pattern.detectionMethod === "semantic_embedding"
      ? "Les descriptions ont un sens proche selon leur représentation multilingue. Vérifiez les réclamations : cette similarité ne confirme pas une cause commune."
      : `Chevauchement textuel détecté${pattern.sharedTerms.length ? ` autour de : ${pattern.sharedTerms.join(", ")}` : ""}. Cela suggère une similarité de description, pas une cause commune confirmée.`,
    complaintIds: pattern.incidentIds,
    evidenceLevel: pattern.evidenceLevel,
    detectionMethod: pattern.detectionMethod,
    reviewStatus: pattern.reviewStatus,
    patternKey: pattern.patternKey,
    sharedTerms: pattern.sharedTerms,
    statuses: pattern.statuses,
    priorities: pattern.priorities,
  }));
  const suggestions: AnnouncementSuggestion[] = api.announcementSuggestions.map((suggestion) => ({
    ...suggestion,
    residenceName: api.residences.find((residence) => residence.id === suggestion.residenceId)?.name,
  }));
  const announcementImpact: AnnouncementImpactItem[] = api.announcementEffectiveness.comparisons.map((comparison) => {
    const publishedAt = comparison.publishedAt ?? api.lastUpdated;
    const publishedMs = new Date(publishedAt).getTime();
    return {
      id: comparison.announcementId,
      title: comparison.title,
      publishedAt,
      category: comparison.category,
      beforeCount: comparison.beforeCount,
      afterCount: comparison.afterCount,
      beforePeriod: comparison.beforePeriod
        ? { start: comparison.beforePeriod.from, end: comparison.beforePeriod.to }
        : { start: new Date(publishedMs - 30 * 86_400_000).toISOString(), end: publishedAt },
      afterPeriod: comparison.afterPeriod
        ? { start: comparison.afterPeriod.from, end: comparison.afterPeriod.to }
        : { start: publishedAt, end: new Date(publishedMs + 30 * 86_400_000).toISOString() },
      sufficientData: comparison.status === "available",
      limitation: comparison.reason,
      percentageChange: comparison.beforeCount && comparison.afterCount !== undefined
        ? Number((((comparison.afterCount - comparison.beforeCount) / comparison.beforeCount) * 100).toFixed(1))
        : undefined,
    };
  });

  return {
    metrics: api.metrics,
    recurringPatterns,
    attentionComplaints: api.attentionComplaints,
    trends: api.trendSeries.map((point) => ({
      period: point.date,
      count: point.complaints,
      unresolvedCount: point.unresolved,
    })),
    categories: api.categories,
    statuses: api.statuses,
    communicationOpportunities: api.communicationOpportunities.map((opportunity) => ({
      ...opportunity,
      residenceName: opportunity.residenceName
        ?? api.residences.find((residence) => residence.id === opportunity.residenceId)?.name,
    })),
    announcementImpact,
    announcementSuggestions: suggestions,
    residences: api.residences,
    lastUpdated: api.lastUpdated,
    complaintComparison: {
      current: api.comparison.currentComplaintCount,
      previous: api.comparison.previousComplaintCount,
      change: api.comparison.change,
      changePercent: api.comparison.changePercent,
    },
    analysisCoverage: api.analysisCoverage,
  };
}

export default function AIIntelligenceDashboard() {
  const router = useRouter();
  const [data, setData] = useState<AIIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(() => localDate(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(() => localDate(new Date()));
  const [residence, setResidence] = useState("");
  const [selectedPattern, setSelectedPattern] = useState<RecurringPattern | null>(null);
  const [draftPattern, setDraftPattern] = useState<RecurringPattern | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AnnouncementSuggestion | null>(null);
  const [previewSuggestion, setPreviewSuggestion] = useState<AnnouncementSuggestion | null>(null);
  const [complaintIds, setComplaintIds] = useState<string[] | null>(null);
  const [reviewingPatternId, setReviewingPatternId] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (residence) params.set("residence", residence);
    return params.toString();
  }, [from, to, residence]);

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/ai/intelligence/analytics${query ? `?${query}` : ""}`, {
        method: "GET",
        cache: "no-store",
      });
      const payload: { success?: boolean; data?: IntelligenceAnalyticsApiData; error?: string; message?: string } = await response.json();
      if (!response.ok || !payload.data) {
        if (response.status === 403) throw new Error("Accès réservé aux comptes ADMIN et SYNDIC autorisés.");
        throw new Error(payload.error ?? payload.message ?? "Impossible de charger les données d’intelligence.");
      }
      setData(normalizeData(payload.data));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Une erreur inattendue est survenue.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const refreshAfterSave = () => { void loadData(true); };
  const openComplaint = (id: string) => router.push(`/incidents?incident=${encodeURIComponent(id)}`);
  const reviewPattern = async (pattern: RecurringPattern, status: "CONFIRMED" | "DISMISSED" | "CLEAR") => {
    setReviewingPatternId(pattern.id);
    setError("");
    try {
      const response = await fetch("/api/ai/intelligence/patterns/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          residenceId: pattern.residenceId,
          patternId: pattern.id,
          incidentIds: pattern.complaintIds,
          status,
        }),
      });
      const result: { error?: string; message?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? result.message ?? "Le retour n'a pas été enregistré.");
      await loadData(true);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Le retour n'a pas été enregistré.");
    } finally {
      setReviewingPatternId("");
    }
  };

  if (loading && !data) return <AIIntelligenceSkeleton />;

  if (!data && error) {
    return (
      <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 dark:border-rose-900 dark:bg-rose-950/30">
        <h1 className="font-semibold text-rose-900 dark:text-rose-100">Impossible de charger AI Intelligence</h1>
        <p className="mt-2 text-sm text-rose-800 dark:text-rose-200">{error}</p>
        <button type="button" onClick={() => void loadData()} className="mt-4 min-h-[44px] rounded-lg bg-rose-700 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2">Réessayer</button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8 pb-10">
      <header className="flex flex-col justify-between gap-5 rounded-3xl bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-500 p-5 text-white shadow-lg shadow-sky-900/10 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950 dark:ring-1 dark:ring-white/10 sm:p-7 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2"><span className="rounded-xl bg-white/15 p-2"><BrainCircuit aria-hidden="true" className="h-5 w-5 text-white" /></span><span className="text-sm font-semibold text-sky-50 dark:text-indigo-200">SYNDICPRO INTELLIGENCE</span></div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">AI Intelligence</h1>
          <p className="mt-2 max-w-2xl text-sm text-sky-50 dark:text-slate-300">Analysez les réclamations, les tendances et les communications de vos résidences.</p>
        </div>
        <button type="button" disabled={refreshing} onClick={() => void loadData(true)} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-sky-800 shadow-sm transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60 dark:bg-white dark:text-sky-900 dark:hover:bg-sky-100"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Actualiser</button>
      </header>

      <section aria-label="Filtres de l'analyse" className="sticky top-16 z-20 space-y-3 rounded-2xl border border-slate-200/90 bg-white/90 p-3 shadow-sm backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/90 sm:p-4">
        <div className="flex flex-nowrap items-end gap-3 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
          <label className="flex shrink-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">Du<input type="date" max={to || localDate(new Date())} value={from} onChange={(event) => setFrom(event.target.value)} className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" /></label>
          <label className="flex shrink-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">Au<input type="date" max={localDate(new Date())} min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" /></label>
          {data.residences.length > 1 && <label className="flex shrink-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">Résidence<select value={residence} onChange={(event) => setResidence(event.target.value)} className="min-h-[44px] min-w-44 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><option value="">Toutes mes résidences</option>{data.residences.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-100 pt-3 dark:border-slate-800" aria-label="Filtres actifs">
          {from && <button type="button" onClick={() => setFrom("")} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-sky-50 px-3 text-xs font-semibold text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:bg-sky-950 dark:text-sky-200">Du {displayDate(from)}<span aria-hidden="true">×</span></button>}
          {to && <button type="button" onClick={() => setTo("")} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-sky-50 px-3 text-xs font-semibold text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:bg-sky-950 dark:text-sky-200">Au {displayDate(to)}<span aria-hidden="true">×</span></button>}
          {residence && <button type="button" onClick={() => setResidence("")} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-sky-50 px-3 text-xs font-semibold text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:bg-sky-950 dark:text-sky-200">{data.residences.find((item) => item.id === residence)?.name ?? "Résidence"}<span aria-hidden="true">×</span></button>}
          {(from || to || residence) && <button type="button" onClick={() => { setFrom(""); setTo(""); setResidence(""); }} className="min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold text-slate-600 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-300">Effacer les filtres</button>}
        </div>
      </section>

      <BriefingPanel />
      <AskPanel />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        <span className="inline-flex items-center gap-2"><CalendarDays aria-hidden="true" className="h-4 w-4" />Période du {displayDate(from || data.lastUpdated)} au {displayDate(to || data.lastUpdated)}</span>
        <span>Mise à jour : {new Date(data.lastUpdated).toLocaleString("fr-FR")}</span>
      </div>
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><p>{error} Les dernières données chargées restent affichées.</p><button type="button" onClick={() => void loadData(true)} className="font-semibold underline">Réessayer</button></div>}

      <AIOverviewCards metrics={data.metrics} />
      {data.complaintComparison && <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">Période précédente : {data.complaintComparison.previous.toLocaleString("fr-FR")} réclamations · évolution du volume : {data.complaintComparison.change > 0 ? "+" : ""}{data.complaintComparison.change.toLocaleString("fr-FR")}{data.complaintComparison.changePercent === null ? "" : ` (${data.complaintComparison.changePercent > 0 ? "+" : ""}${data.complaintComparison.changePercent} %)`}. Cette comparaison ne prouve aucune causalité.</p>}
      {(data.analysisCoverage?.patternAnalysisTruncated || data.analysisCoverage?.attentionAnalysisTruncated) && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Le volume des réclamations dépasse la limite d’échantillonnage pour une partie de l’analyse. Les tendances agrégées restent exactes, mais certains rapprochements ou éléments à examiner peuvent manquer.</p>}

      <section id="recurring" className="scroll-mt-6">
        <div className="mb-4"><h2 className="text-lg font-semibold text-slate-900 dark:text-white">Problèmes récurrents possibles</h2><p className="mt-1 text-sm text-slate-500">Rapprochements fondés sur le sens des descriptions, leurs mots ou leur catégorie. Ils ne confirment pas une cause commune.</p></div>
        <RecurringIssues
          patterns={data.recurringPatterns}
          onExplain={setSelectedPattern}
          onViewComplaints={setComplaintIds}
          onReview={(pattern, status) => void reviewPattern(pattern, status)}
          reviewingPatternId={reviewingPatternId}
        />
      </section>

      <section>
        <div className="mb-4"><h2 className="text-lg font-semibold text-slate-900 dark:text-white">À examiner</h2><p className="mt-1 text-sm text-slate-500">Règles déterministes basées sur le statut, la priorité et les éléments liés.</p></div>
        <NeedsAttention complaints={data.attentionComplaints} onOpen={openComplaint} />
      </section>

      <ComplaintTrends data={data.trends} categories={data.categories} statuses={data.statuses} />

      <CommunicationOpportunities
        opportunities={data.communicationOpportunities}
        suggestions={data.announcementSuggestions}
        patterns={data.recurringPatterns}
        onCreateDraft={setDraftPattern}
        onEditDraft={setSelectedSuggestion}
        onPreview={setPreviewSuggestion}
      />

      <AnnouncementImpact
        items={data.announcementImpact}
        emptyReason="Une comparaison apparaîtra après publication d’une annonce IA approuvée et après observation des deux périodes de 30 jours."
      />

      {selectedPattern && <AIExplanationDialog key={selectedPattern.id} pattern={selectedPattern} onClose={() => setSelectedPattern(null)} />}
      {draftPattern && <AnnouncementDraftDialog key={`new-${draftPattern.id}`} pattern={draftPattern} onClose={() => setDraftPattern(null)} onSaved={refreshAfterSave} />}
      {selectedSuggestion && <AnnouncementDraftDialog key={`edit-${selectedSuggestion.id}`} suggestion={selectedSuggestion} onClose={() => setSelectedSuggestion(null)} onSaved={refreshAfterSave} />}
      {previewSuggestion && <AnnouncementDraftDialog key={`preview-${previewSuggestion.id}`} suggestion={previewSuggestion} previewOnly onClose={() => setPreviewSuggestion(null)} onSaved={refreshAfterSave} />}
      {complaintIds && <div role="presentation" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setComplaintIds(null); }}><section role="dialog" aria-modal="true" aria-labelledby="supporting-complaints-title" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-2xl"><div className="flex items-center justify-between gap-3"><h2 id="supporting-complaints-title" className="font-semibold text-slate-900 dark:text-white">Réclamations justificatives</h2><button type="button" onClick={() => setComplaintIds(null)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Fermer</button></div><p className="mt-1 text-sm text-slate-500">Ouvrez une réclamation dans le module existant.</p><ul className="mt-4 space-y-2">{complaintIds.map((id) => <li key={id}><button type="button" onClick={() => openComplaint(id)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-50 dark:border-slate-700 dark:text-indigo-300 dark:hover:bg-indigo-950/40"><span>Ouvrir la réclamation</span><span className="font-mono text-xs text-slate-400">{id}</span></button></li>)}</ul></section></div>}
    </div>
  );
}
