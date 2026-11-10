"use client";

import React from "react";
import Link from "next/link";
import {
  Users,
  Video,
  FileText,
  CheckCircle,
  ExternalLink,
  Sparkles,
  Download,
  Radio,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { useResidence } from "@/hooks/useResidence";
import { MeetingStatus, Role } from "@/types/enums";

type AptRow = {
  _id: string;
  number?: string;
  shares?: number;
  owner?: { name?: string } | string;
};

type MeetingRow = {
  _id: string;
  title: string;
  date?: string;
  location?: string;
  status?: string;
  meetLink?: string;
  meetUrl?: string;
  transcript?: string;
  /** API : string multi-lignes OU (legacy UI) liste d’items */
  agenda?: string | Array<{ title?: string; description?: string } | string>;
  agendaItems?: string[];
  residence?: { _id?: string; name?: string } | string;
  aiMinutesDraft?: string;
};

/** Normalise agenda / agendaItems (API string | string[]) vers une liste de libellés. */
function normalizeAgendaItems(meeting: MeetingRow | null | undefined): string[] {
  if (!meeting) return [];
  if (Array.isArray(meeting.agendaItems) && meeting.agendaItems.length > 0) {
    return meeting.agendaItems.map((t) => String(t).trim()).filter(Boolean);
  }
  const raw = meeting.agenda;
  if (!raw) return [];
  if (typeof raw === "string") {
    return raw
      .split(/\n+/)
      .map((l) => l.replace(/^\d+\.\s*/, "").trim())
      .filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item) =>
        typeof item === "string" ? item : item.title || item.description || ""
      )
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

type QuorumPayload = {
  quorum?: {
    presentShares?: number;
    totalShares?: number;
    percentage?: number;
    reached?: boolean;
  };
  attendees?: Array<{ apartment: string; present: boolean; shares?: number }>;
  apartments?: AptRow[];
};

const MEETING_STATUS_UI: Record<string, { label: string; badgeClass: string }> = {
  [MeetingStatus.PLANNED]: {
    label: "Planifiée",
    badgeClass: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  [MeetingStatus.OPEN]: {
    label: "En cours",
    badgeClass: "border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
  [MeetingStatus.CLOSED]: {
    label: "Clôturée",
    badgeClass: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
};

/** Renvoie demain à 18h00 au format local YYYY-MM-DDTHH:mm pour l'input datetime-local. */
function defaultMeetingDateTime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Assemblées : UI redesign exacte + APIs meetings / quorum / AI pack. */
export const MeetingsView: React.FC = () => {
  const { residences, selectedId: activeResidenceId } = useResidence();

  const [meetings, setMeetings] = React.useState<MeetingRow[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [sessionRole, setSessionRole] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const [current, setCurrent] = React.useState<MeetingRow | null>(null);
  const [apartments, setApartments] = React.useState<AptRow[]>([]);
  const [presence, setPresence] = React.useState<Record<string, boolean>>({});
  const [quorumPct, setQuorumPct] = React.useState(0);
  const [presentShares, setPresentShares] = React.useState(0);
  const [totalShares, setTotalShares] = React.useState(0);
  const [meetsThreshold, setMeetsThreshold] = React.useState(false);
  const [transcriptText, setTranscriptText] = React.useState("");
  const [aiGenerating, setAiGenerating] = React.useState(false);
  const [showPdfAlert, setShowPdfAlert] = React.useState(false);

  // Modal de création d'une AG (ADMIN / SYNDIC)
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [createResidenceId, setCreateResidenceId] = React.useState("");
  const [createTitle, setCreateTitle] = React.useState("");
  const [createDate, setCreateDate] = React.useState(defaultMeetingDateTime);
  const [createLocation, setCreateLocation] = React.useState("");
  const [createStatus, setCreateStatus] = React.useState<MeetingStatus>(MeetingStatus.PLANNED);
  const [createAgenda, setCreateAgenda] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  const loadList = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, sess] = await Promise.all([
        fetchWithOffline<{ data: MeetingRow[] }>("/api/meetings?limit=50"),
        fetch("/api/auth/session")
          .then((r) => r.json())
          .catch(() => null),
      ]);
      setMeetings(res.data || []);
      if (sess?.user?.role) {
        setSessionRole(String(sess.user.role));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement AG");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadList();
  }, [loadList]);

  const canCreate = sessionRole === Role.ADMIN || sessionRole === Role.SYNDIC;

  const openCreateModal = () => {
    setCreateError(null);
    setCreateResidenceId((prev) => prev || activeResidenceId || residences[0]?._id || "");
    setCreateDate(defaultMeetingDateTime());
    setShowCreateModal(true);
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const targetResidence = createResidenceId || activeResidenceId || residences[0]?._id || "";
    if (!targetResidence) {
      setCreateError("Veuillez sélectionner une résidence.");
      return;
    }
    const cleanTitle = createTitle.trim();
    if (cleanTitle.length < 3) {
      setCreateError("L'intitulé doit contenir au moins 3 caractères.");
      return;
    }
    const parsedDate = new Date(createDate);
    if (!createDate || Number.isNaN(parsedDate.getTime())) {
      setCreateError("Veuillez saisir une date valide.");
      return;
    }

    setCreating(true);
    try {
      await fetchWithOffline("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residence: targetResidence,
          title: cleanTitle,
          date: parsedDate.toISOString(),
          location: createLocation.trim() || undefined,
          agenda: createAgenda.trim() || undefined,
          status: createStatus,
        }),
      });
      setShowCreateModal(false);
      setCreateTitle("");
      setCreateLocation("");
      setCreateAgenda("");
      setCreateStatus(MeetingStatus.PLANNED);
      setMessage(`Assemblée « ${cleanTitle} » créée avec succès.`);
      await loadList();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Impossible de créer l'assemblée générale."
      );
    } finally {
      setCreating(false);
    }
  };

  const openSession = async (id: string) => {
    setSelectedId(id);
    setError(null);
    setMessage(null);
    try {
      const [mRes, qRes] = await Promise.all([
        fetchWithOffline<{ data: MeetingRow }>(`/api/meetings/${id}`),
        fetchWithOffline<QuorumPayload>(`/api/meetings/${id}/quorum`),
      ]);
      const meeting = mRes.data || (mRes as unknown as MeetingRow);
      setCurrent(meeting);
      setTranscriptText(meeting.transcript || meeting.aiMinutesDraft || "");

      const apts = qRes.apartments || [];
      setApartments(apts);
      const nextPresence: Record<string, boolean> = {};
      for (const a of apts) nextPresence[a._id] = false;
      for (const att of qRes.attendees || []) {
        nextPresence[String(att.apartment)] = !!att.present;
      }
      setPresence(nextPresence);

      const q = qRes.quorum || {};
      setPresentShares(q.presentShares || 0);
      setTotalShares(q.totalShares || apts.reduce((s, a) => s + (a.shares || 0), 0));
      setQuorumPct(q.percentage || 0);
      setMeetsThreshold(!!q.reached || (q.percentage || 0) >= 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ouvrir la session");
      setSelectedId(null);
    }
  };

  const persistPresence = async (next: Record<string, boolean>) => {
    if (!selectedId) return;
    try {
      const attendees = Object.entries(next).map(([apartment, present]) => ({
        apartment,
        present,
      }));
      const qRes = await fetchWithOffline<QuorumPayload>(`/api/meetings/${selectedId}/quorum`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendees }),
      });
      const q = qRes.quorum || {};
      setPresentShares(q.presentShares || 0);
      setTotalShares(q.totalShares || totalShares);
      setQuorumPct(q.percentage || 0);
      setMeetsThreshold(!!q.reached || (q.percentage || 0) >= 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur quorum");
    }
  };

  const toggleAttendance = (aptId: string) => {
    const next = { ...presence, [aptId]: !presence[aptId] };
    setPresence(next);
    // recalcul local immédiat
    let present = 0;
    let total = 0;
    for (const a of apartments) {
      total += a.shares || 0;
      if (next[a._id]) present += a.shares || 0;
    }
    setPresentShares(present);
    setTotalShares(total);
    const pct = total > 0 ? Math.round((present / total) * 10000) / 100 : 0;
    setQuorumPct(pct);
    setMeetsThreshold(pct >= 50);
    void persistPresence(next);
  };

  const saveTranscript = async () => {
    if (!selectedId) return;
    try {
      await fetchWithOffline(`/api/meetings/${selectedId}/transcript`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptText }),
      });
      setMessage("Transcription enregistrée.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec sauvegarde transcript");
    }
  };

  const handleAiPack = async () => {
    if (!selectedId) return;
    setAiGenerating(true);
    setError(null);
    setMessage(null);
    try {
      // Sauvegarde d'abord le transcript si besoin
      if (transcriptText.trim().length >= 20) {
        await fetchWithOffline(`/api/meetings/${selectedId}/transcript`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: transcriptText }),
        });
      }
      const res = await fetch(`/api/meetings/${selectedId}/ai-pack`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec pack IA");
      if (data.aiMinutesDraft) setTranscriptText(data.aiMinutesDraft);
      if (Array.isArray(data.agendaItems) && current) {
        setCurrent({
          ...current,
          agendaItems: data.agendaItems,
          agenda: data.agendaItems.join("\n"),
        });
      }
      setMessage("Pack AG généré par IA (ODJ + brouillon PV).");
      await openSession(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur IA");
    } finally {
      setAiGenerating(false);
    }
  };

  const residenceName = (m: MeetingRow) =>
    typeof m.residence === "object" && m.residence?.name
      ? m.residence.name
      : "Résidence";

  const agendaItems = normalizeAgendaItems(current);

  if (loading) {
    return (
      <div className="h-40 animate-pulse rounded-3xl glass-card" aria-busy="true" />
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          {message}
        </div>
      )}

      {selectedId && current ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.08]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Gouvernance Légale & AG
                </span>
                <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  <Radio className="h-2.5 w-2.5 animate-pulse text-emerald-500" /> Session
                </span>
              </div>
              <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {current.title}
              </h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {residenceName(current)} ·{" "}
                {current.date ? new Date(current.date).toLocaleDateString("fr-FR") : "—"} ·{" "}
                {current.location || "—"}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setCurrent(null);
                  loadList();
                }}
                className="rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-slate-200 dark:hover:bg-white/[0.08]"
              >
                Liste des AG
              </button>
              <Link
                href={`/meetings/${selectedId}`}
                className="rounded-xl border border-blue-500/25 bg-blue-600/10 px-3.5 py-2 text-xs font-bold text-blue-600 dark:text-blue-400"
              >
                Pack AG complet
              </Link>
              <button
                type="button"
                onClick={handleAiPack}
                disabled={aiGenerating}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{aiGenerating ? "Génération..." : "Générer Pack AG (IA)"}</span>
              </button>
            </div>
          </div>

          <div className="space-y-3 rounded-3xl glass-card p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Video className="h-4 w-4 text-blue-500" />
              <h3>1. Visioconférence (Meet / Jitsi)</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Session vidéo synchronisée pour les copropriétaires participants à distance.
            </p>
            <div className="flex flex-col items-stretch gap-3 pt-2 sm:flex-row sm:items-center">
              <input
                type="text"
                readOnly
                value={
                  current.meetLink ||
                  `https://meet.jit.si/SyndicPro-${selectedId.slice(-8)}`
                }
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs text-slate-700 dark:border-white/[0.08] dark:bg-slate-800 dark:text-slate-200"
              />
              <a
                href={
                  current.meetLink ||
                  `https://meet.jit.si/SyndicPro-${selectedId.slice(-8)}`
                }
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/10 px-4 py-2 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-600/20 dark:text-blue-400"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Rejoindre la salle Meet</span>
              </a>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl glass-card p-6">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-white/[0.06]">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Users className="h-4 w-4 text-blue-500" />
                <h3>Suivi du Quorum légal</h3>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  meetsThreshold
                    ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "border border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400"
                }`}
              >
                {meetsThreshold ? "Quorum légal atteint" : "Quorum insuffisant (<50%)"}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200/60 bg-slate-50/80 p-4 dark:border-white/[0.04] dark:bg-white/[0.02]">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                <span className="font-mono text-slate-800 dark:text-white">
                  {presentShares} / {totalShares} tantièmes représentés
                </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {quorumPct}% (seuil légal: 50 %)
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, quorumPct)}%` }}
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Feuille de présence par lot (cochez pour actualiser en direct le calcul) :
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {apartments.map((lot) => {
                  const isChecked = !!presence[lot._id];
                  const ownerName =
                    typeof lot.owner === "object" ? lot.owner?.name : undefined;
                  return (
                    <button
                      key={lot._id}
                      type="button"
                      onClick={() => toggleAttendance(lot._id)}
                      className={`flex cursor-pointer items-center justify-between rounded-2xl border p-3 text-xs transition-all ${
                        isChecked
                          ? "border-blue-500/35 bg-blue-600/10 font-semibold text-slate-900 dark:bg-blue-600/20 dark:text-white"
                          : "border-slate-200/60 bg-slate-50/60 text-slate-600 hover:bg-slate-100 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-slate-400 dark:hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                            isChecked
                              ? "border-blue-500 bg-blue-600 text-white"
                              : "border-slate-300 bg-white dark:border-white/20 dark:bg-white/5"
                          }`}
                        >
                          {isChecked && <CheckCircle className="h-3.5 w-3.5" />}
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          Lot {lot.number || "—"}
                        </span>
                        {ownerName && (
                          <span className="text-slate-500 dark:text-slate-400">
                            · {ownerName}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-300">
                        {lot.shares || 0} tantièmes
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-3xl glass-card p-6">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <FileText className="h-4 w-4 text-blue-500" />
              Ordre du jour arrêté
            </h3>
            <ul className="mt-2 space-y-2">
              {agendaItems.length === 0 ? (
                <li className="text-xs text-slate-500">Aucun point — générez le pack IA.</li>
              ) : (
                agendaItems.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 rounded-2xl border border-slate-200/60 bg-slate-50/80 p-3 text-xs text-slate-700 dark:border-white/[0.04] dark:bg-white/[0.02] dark:text-slate-200"
                  >
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {idx + 1}.
                    </span>
                    <span className="font-medium">{item.replace(/^\d+\.\s*/, "")}</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="space-y-4 rounded-3xl glass-card p-6">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-white/[0.06]">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <FileText className="h-4 w-4 text-blue-500" />
                Procès-verbal de séance (PV officiel)
              </h3>
            </div>

            <textarea
              rows={6}
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Notes de séance, résolutions votées et déclarations..."
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-900 dark:border-white/[0.08] dark:bg-slate-800 dark:text-white"
            />

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={saveTranscript}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200"
              >
                Enregistrer le transcript
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPdfAlert(true);
                  setTimeout(() => setShowPdfAlert(false), 3000);
                }}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Télécharger le PDF certifié</span>
              </button>
              <Link
                href={`/meetings/${selectedId}`}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                <span>Signer & archiver (page complète)</span>
              </Link>
            </div>

            {showPdfAlert && (
              <div className="animate-fadeIn rounded-2xl border border-emerald-500/30 bg-emerald-500/15 p-3.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Ouvrez le pack AG complet pour exporter le PV PDF.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.08]">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Gouvernance
              </span>
              <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Assemblées Générales
              </h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Planification des AG, pack IA, quorum et procès-verbaux
              </p>
            </div>
            {canCreate && (
              <button
                type="button"
                onClick={openCreateModal}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                <span>Créer une AG</span>
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-3xl glass-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200/80 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5">Titre</th>
                    <th className="px-4 py-3.5">Résidence</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5">Statut</th>
                    <th className="px-4 py-3.5">Lieu</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                  {meetings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                        <p>Aucune assemblée pour le moment.</p>
                        {canCreate && (
                          <button
                            type="button"
                            onClick={openCreateModal}
                            className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600/10 px-4 py-2 text-xs font-bold text-blue-600 hover:bg-blue-600 hover:text-white dark:text-blue-400 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Planifier la première AG</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    meetings.map((m) => {
                      const statusInfo =
                        MEETING_STATUS_UI[m.status || ""] || {
                          label: m.status || "Planifiée",
                          badgeClass:
                            "border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300",
                        };
                      return (
                        <tr
                          key={m._id}
                          className="transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.02]"
                        >
                          <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                            {m.title}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                            {residenceName(m)}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-500 dark:text-slate-400">
                            {m.date ? new Date(m.date).toLocaleDateString("fr-FR") : "—"}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusInfo.badgeClass}`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                            {m.location || "—"}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => openSession(m._id)}
                              className="min-h-[44px] rounded-xl border border-blue-500/25 bg-blue-600/10 px-3 py-1.5 text-xs font-bold text-blue-600 shadow-xs transition-all hover:bg-blue-600 hover:text-white dark:text-blue-400"
                            >
                              Ouvrir la session
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-ag-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md animate-fadeIn dark:bg-black/60"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-lg glass-card rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-4 dark:border-white/[0.08]">
              <h3 id="create-ag-title" className="text-base font-bold text-slate-900 dark:text-white">
                Créer une Assemblée Générale
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMeeting} className="mt-4 space-y-4 text-xs">
              {createError && (
                <div
                  role="alert"
                  className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-800 dark:text-rose-200"
                >
                  {createError}
                </div>
              )}

              <div>
                <label className="mb-1 block font-semibold text-slate-600 dark:text-slate-300">
                  Résidence *
                </label>
                <select
                  required
                  value={createResidenceId}
                  onChange={(e) => setCreateResidenceId(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-base md:text-xs text-slate-900 dark:border-white/[0.1] dark:bg-slate-800 dark:text-white"
                >
                  {residences.length === 0 ? (
                    <option value="">Aucune résidence disponible</option>
                  ) : (
                    residences.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name} ({r.city})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-600 dark:text-slate-300">
                  Intitulé de l’AG *
                </label>
                <input
                  required
                  minLength={3}
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Ex : Assemblée Générale Ordinaire 2026"
                  className="min-h-[44px] w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-base md:text-xs text-slate-900 dark:border-white/[0.1] dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-600 dark:text-slate-300">
                    Date & heure *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={createDate}
                    onChange={(e) => setCreateDate(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-base md:text-xs text-slate-900 dark:border-white/[0.1] dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-600 dark:text-slate-300">
                    Statut initial
                  </label>
                  <select
                    value={createStatus}
                    onChange={(e) => setCreateStatus(e.target.value as MeetingStatus)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-base md:text-xs text-slate-900 dark:border-white/[0.1] dark:bg-slate-800 dark:text-white"
                  >
                    <option value={MeetingStatus.PLANNED}>Planifiée</option>
                    <option value={MeetingStatus.OPEN}>En cours (ouverte)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-600 dark:text-slate-300">
                  Lieu / Visioconférence
                </label>
                <input
                  value={createLocation}
                  onChange={(e) => setCreateLocation(e.target.value)}
                  placeholder="Ex : Hall d'entrée & Visioconférence"
                  className="min-h-[44px] w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-base md:text-xs text-slate-900 dark:border-white/[0.1] dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-600 dark:text-slate-300">
                  Ordre du jour (un point par ligne)
                </label>
                <textarea
                  rows={4}
                  value={createAgenda}
                  onChange={(e) => setCreateAgenda(e.target.value)}
                  placeholder={"1. Approbation des comptes 2025\n2. Budget prévisionnel 2026\n3. Travaux des parties communes"}
                  className="w-full rounded-2xl border border-slate-200/80 bg-slate-50 p-3 text-base md:text-xs text-slate-900 dark:border-white/[0.1] dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="min-h-[44px] rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-200 dark:bg-white/[0.05] dark:text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating || residences.length === 0}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 font-bold text-white shadow-md disabled:opacity-50"
                >
                  {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{creating ? "Création…" : "Créer l’AG"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
