"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, FileEdit, LoaderCircle, Sparkles, X } from "lucide-react";
import type { AnnouncementSuggestion, RecurringPattern } from "@/types/ai-intelligence";
import { AIBadge } from "@/components/ai/AIBadge";

type Props = {
  pattern?: RecurringPattern;
  suggestion?: AnnouncementSuggestion;
  previewOnly?: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type ReviewStatus = AnnouncementSuggestion["source"]["reviewStatus"];
type DraftResponse = {
  success?: boolean;
  created?: boolean;
  error?: string;
  message?: string;
  announcement?: {
    _id?: string;
    id?: string;
    title?: string;
    content?: string;
    intelligenceSource?: { reviewStatus?: ReviewStatus };
  };
};

function messageFrom(payload: { error?: string; message?: string }) {
  return payload.error ?? payload.message ?? "La demande n’a pas pu aboutir.";
}

export default function AnnouncementDraftDialog({ pattern, suggestion, previewOnly = false, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(suggestion?.title ?? "");
  const [content, setContent] = useState(suggestion?.content ?? "");
  const [announcementId, setAnnouncementId] = useState(suggestion?.id ?? "");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>(suggestion?.source.reviewStatus ?? "DRAFT");
  const [audience, setAudience] = useState(suggestion?.audience ?? "RESIDENTS");
  const [language, setLanguage] = useState("FR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const request = async (url: string, method: string, body: unknown) => {
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload: DraftResponse = await response.json();
    if (!response.ok) throw new Error(messageFrom(payload));
    return payload;
  };

  const generateDraft = async () => {
    if (!pattern) return;
    setLoading(true);
    setError("");
    try {
      const payload = await request("/api/ai/intelligence/announcements", "POST", {
        residenceId: pattern.residenceId,
        patternId: pattern.id,
        incidentIds: pattern.complaintIds,
        audience,
        language,
      });
      const announcement = payload.announcement;
      if (!announcement) throw new Error("Le brouillon n’a pas été retourné par le serveur.");
      setAnnouncementId(announcement._id ?? announcement.id ?? "");
      setTitle(announcement.title ?? "");
      setContent(announcement.content ?? "");
      const returnedStatus = announcement.intelligenceSource?.reviewStatus;
      if (returnedStatus) setReviewStatus(returnedStatus);
      setNotice(payload.created === false
        ? "Un brouillon existe déjà pour ce groupe; il est prêt à être relu."
        : "Brouillon créé et enregistré. Il reste à relire avant toute publication.");
      onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async () => {
    if (!announcementId) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/announcements/${encodeURIComponent(announcementId)}`, "PATCH", { title, content });
      setNotice("Brouillon enregistré.");
      onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  };

  const updateReview = async (nextStatus: "UNDER_REVIEW" | "APPROVED" | "REJECTED") => {
    if (!announcementId) return;
    if (nextStatus === "REJECTED" && !window.confirm("Confirmer le rejet de cette suggestion ?")) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/ai/intelligence/suggestions/${encodeURIComponent(announcementId)}/review`, "PATCH", { status: nextStatus });
      setReviewStatus(nextStatus);
      setNotice(nextStatus === "APPROVED" ? "Suggestion approuvée. Elle n’a pas été publiée." : nextStatus === "REJECTED" ? "Suggestion rejetée." : "Suggestion transmise pour examen.");
      onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  };

  const canEdit = !previewOnly && reviewStatus === "DRAFT" && Boolean(announcementId);
  const titleText = previewOnly ? "Aperçu de la suggestion" : suggestion ? "Réviser le brouillon" : "Créer un brouillon";

  return (
    <div role="presentation" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="announcement-draft-title" className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-2xl sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600"><FileEdit aria-hidden="true" className="h-4 w-4" />Révision humaine requise</span><AIBadge label="Brouillon IA" /></div><h2 id="announcement-draft-title" className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{titleText}</h2><p className="mt-1 text-sm text-slate-500">Aucune annonce n’est publiée ni envoyée automatiquement.</p></div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-slate-800"><X aria-hidden="true" className="h-5 w-5" /></button>
        </header>

        {!announcementId && pattern && !previewOnly && <div className="mt-5 space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60"><p className="font-medium text-slate-900 dark:text-white">{pattern.title}</p><p className="mt-1 text-sm text-slate-500">{pattern.evidence}</p><p className="mt-2 text-xs text-slate-400">{pattern.complaintCount} réclamations · {pattern.periodLabel}</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Langue<select value={language} onChange={(event) => setLanguage(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800"><option value="FR">Français</option><option value="AR">العربية</option><option value="EN">English</option></select></label>
            <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Destinataires<select value={audience} onChange={(event) => setAudience(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800"><option value="RESIDENTS">Résidents</option><option value="ALL">Tous</option><option value="TECHNICIANS">Techniciens</option></select></label>
          </div>
          <button type="button" disabled={loading} onClick={() => void generateDraft()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Générer et enregistrer le brouillon</button>
        </div>}

        {announcementId && <>
          <div className="mt-5 space-y-4">
            <label className="block space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Titre<input disabled={!canEdit} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:disabled:bg-slate-800/60" /></label>
            <label className="block space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Contenu<textarea disabled={!canEdit} value={content} onChange={(event) => setContent(event.target.value)} maxLength={20_000} rows={8} className="w-full rounded-xl border border-slate-200 bg-white p-3 leading-6 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:disabled:bg-slate-800/60" /></label>
            <p className="text-xs text-slate-500">Statut de revue : <span className="font-semibold">{reviewStatus === "UNDER_REVIEW" ? "À examiner" : reviewStatus === "APPROVED" ? "Approuvée" : reviewStatus === "REJECTED" ? "Refusée" : "Brouillon"}</span></p>
            {reviewStatus === "APPROVED" && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">Approuvée, mais toujours non publiée. Pour publier via le workflow existant : <Link className="font-semibold underline" href={`/announcements?announcement=${encodeURIComponent(announcementId)}`} onClick={onClose}>ouvrir l’annonce</Link>.</p>}
          </div>
        </>}

        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}

        <footer className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Fermer</button>
          {canEdit && <button type="button" disabled={loading} onClick={() => void saveDraft()} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{loading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}Enregistrer</button>}
          {!previewOnly && announcementId && reviewStatus === "DRAFT" && <button type="button" disabled={loading} onClick={() => void updateReview("UNDER_REVIEW")} className="min-h-[44px] rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-60">Soumettre à la revue</button>}
          {!previewOnly && announcementId && reviewStatus === "UNDER_REVIEW" && <>
            <button type="button" disabled={loading} onClick={() => void updateReview("REJECTED")} className="min-h-[44px] rounded-xl border border-rose-200 px-4 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-60 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40">Rejeter</button>
            <button type="button" disabled={loading} onClick={() => void updateReview("APPROVED")} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60"><Check aria-hidden="true" className="h-4 w-4" />Approuver</button>
          </>}
        </footer>
      </section>
    </div>
  );
}
