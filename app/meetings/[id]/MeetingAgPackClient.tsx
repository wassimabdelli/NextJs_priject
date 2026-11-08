"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  FileText,
  Users,
  CheckCircle2,
  ArrowLeft,
  Download,
  PenLine,
  Video,
  Sparkles,
  Copy,
  ExternalLink,
  Upload,
  RefreshCw,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Role } from "@/types/enums";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function MeetingAgPackClient({ id }: { id: string }) {
  const [role, setRole] = useState<Role | null>(null);
  const [meeting, setMeeting] = useState<any>(null);
  const [quorum, setQuorum] = useState<any>(null);
  const [apartments, setApartments] = useState<any[]>([]);
  const [presence, setPresence] = useState<Record<string, boolean>>({});
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: number;
  } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await fetch("/api/auth/session").then((r) => r.json());
      setRole(session?.user?.role || null);

      const [mRes, qRes] = await Promise.all([
        fetch(`/api/meetings/${id}`),
        fetch(`/api/meetings/${id}/quorum`),
      ]);
      const mData = await mRes.json();
      const qData = await qRes.json();
      if (!mRes.ok) throw new Error(mData.error || "Assemblée introuvable");
      if (!qRes.ok) throw new Error(qData.error || "Quorum indisponible");

      setMeeting(mData);
      setTranscriptDraft(mData.transcript || "");
      setQuorum(qData.quorum);
      setApartments(qData.apartments || []);
      const map: Record<string, boolean> = {};
      for (const a of qData.apartments || []) map[a._id] = false;
      for (const a of qData.attendees || []) {
        map[String(a.apartment)] = !!a.present;
      }
      setPresence(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  const isManagement = role === Role.ADMIN || role === Role.SYNDIC;

  const generateAgenda = async () => {
    setBusy(true);
    const res = await fetch(`/api/meetings/${id}/agenda`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Échec génération");
      return;
    }
    setMessage("Ordre du jour généré depuis les données métier");
    await load();
  };

  const generateMeet = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/meetings/${id}/meet`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Échec lien visio");
      return;
    }
    setMessage("Lien Jitsi généré et sauvegardé");
    await load();
  };

  const saveTranscript = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/meetings/${id}/transcript`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: transcriptDraft }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Échec sauvegarde transcript");
      return;
    }
    setMessage("Transcription sauvegardée");
    await load();
  };

  const runAiPack = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/meetings/${id}/ai-pack`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Échec IA");
      return;
    }
    setMessage(
      `Pack AG généré par IA (${data.source === "gemini" ? "Gemini" : "fallback"})`
    );
    await load();
  };

  const uploadRecording = (file: File) => {
    if (file.size === 0) {
      setError(
        "Fichier vide (0 octet) — choisis l'enregistrement .webm qui a une taille > 0"
      );
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError("Fichier trop gros (max 100 Mo pour l'upload IA)");
      return;
    }

    setBusy(true);
    setError(null);
    setUploadProgress(0);
    setMessage("Envoi de l'enregistrement…");

    const fd = new FormData();
    fd.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/meetings/${id}/recording`);

    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      const pct = Math.min(99, Math.round((ev.loaded / ev.total) * 100));
      setUploadProgress(pct);
      if (pct >= 100 || ev.loaded >= ev.total) {
        setMessage("Transcription de l'enregistrement en cours…");
      }
    };

    xhr.onload = async () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}");
        if (xhr.status < 200 || xhr.status >= 300) {
          throw new Error(data.error || "Échec upload / transcription");
        }
        setUploadedFile({ name: file.name, size: file.size });
        setTranscriptDraft(data.transcript || "");
        setMessage("Enregistrement transcrit — ODJ + brouillon PV mis à jour");
        await load();
        setUploadProgress(null);
      } catch (e) {
        setUploadedFile(null);
        setUploadProgress(null);
        setError(e instanceof Error ? e.message : "Échec");
      } finally {
        setBusy(false);
      }
    };

    xhr.onerror = () => {
      setUploadedFile(null);
      setUploadProgress(null);
      setBusy(false);
      setError("Échec réseau pendant l'upload");
    };

    xhr.send(fd);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const saveAttendance = async () => {
    const attendees = Object.entries(presence).map(([apartment, present]) => ({
      apartment,
      present,
    }));
    const res = await fetch(`/api/meetings/${id}/quorum`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendees }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Échec présence");
      return;
    }
    setQuorum(data.quorum);
    setMessage(
      data.quorum.reached
        ? `Quorum atteint (${data.quorum.percentage} %)`
        : `Quorum non atteint (${data.quorum.percentage} %)`
    );
  };

  const signMinutes = async () => {
    const res = await fetch(`/api/meetings/${id}/minutes`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Échec signature");
      return;
    }
    setMessage("PV signé et archivé");
    await load();
  };

  const copyMeet = async () => {
    if (!meeting?.meetUrl) return;
    await navigator.clipboard.writeText(meeting.meetUrl);
    setMessage("Lien visio copié");
  };

  return (
    <AppLayout>
      <div className="sp-page">
        <Link
          href="/meetings"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-600 hover:text-sky-600 dark:text-slate-400"
        >
          <ArrowLeft className="size-4" aria-hidden /> Retour aux AG
        </Link>

        {error && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden /> {message}
          </div>
        )}

        {loading || !meeting ? (
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
        ) : (
          <>
            <div className="sp-page-header">
              <h1 className="sp-title text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                {meeting.title}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <Calendar className="size-4" aria-hidden />
                {new Date(meeting.date).toLocaleString("fr-FR")}
                {meeting.location ? ` · ${meeting.location}` : ""}
                <Badge>{meeting.status}</Badge>
              </p>
            </div>

            <Card className="border-sky-200 dark:border-sky-900">
              <CardContent className="space-y-3 p-4">
                <h2 className="flex items-center gap-2 text-balance text-lg font-semibold text-slate-900 dark:text-white">
                  <Video className="size-5 text-sky-600" aria-hidden /> 1. Visioconférence (Meet)
                </h2>
                {meeting.meetUrl ? (
                  <div className="space-y-2">
                    <a
                      href={meeting.meetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-sm font-semibold text-sky-600 underline"
                    >
                      {meeting.meetUrl}
                    </a>
                    <p className="text-[11px] text-slate-500">
                      Fournisseur : {meeting.meetProvider || "jitsi"}
                      {meeting.meetCreatedAt
                        ? ` · créé le ${new Date(meeting.meetCreatedAt).toLocaleString("fr-FR")}`
                        : ""}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <a
                        href={meeting.meetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1"
                      >
                        <Button variant="primary" className="min-h-[44px] w-full gap-2">
                          <ExternalLink className="h-4 w-4" /> Rejoindre
                        </Button>
                      </a>
                      <Button
                        variant="outline"
                        className="min-h-[44px] flex-1 gap-2"
                        onClick={copyMeet}
                      >
                        <Copy className="h-4 w-4" /> Copier le lien
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Aucun lien encore — génère une salle Jitsi (gratuite) pour cette AG.
                  </p>
                )}
                {isManagement && (
                  <Button
                    variant="outline"
                    className="min-h-[44px] w-full"
                    onClick={generateMeet}
                    disabled={busy}
                  >
                    {meeting.meetUrl ? "Régénérer le lien Jitsi" : "Générer un lien Meet (Jitsi)"}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Transcription + IA */}
            {isManagement && (
              <Card>
                <CardContent className="space-y-3 p-4">
                  <h2 className="flex items-center gap-2 font-bold">
                    <Sparkles className="h-4 w-4 text-sky-500" /> Transcription → Pack AG (IA)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Le syndic enregistre sur Jitsi (fichier .webm dans Téléchargements),
                    puis upload ici. L&apos;IA transcrit et remplit ODJ + brouillon de PV.
                    Tu peux aussi coller un texte manuellement.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,video/webm,video/mp4,.webm"
                    aria-label="Uploader un enregistrement Jitsi"
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadRecording(f);
                      e.target.value = "";
                    }}
                  />

                  {uploadedFile && uploadProgress === null ? (
                    <div className="rounded-xl border border-emerald-400 bg-emerald-50 p-4 dark:border-emerald-600 dark:bg-emerald-950/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                            2. Enregistrement chargé
                          </p>
                          <p className="mt-1 truncate text-xs font-medium text-emerald-800 dark:text-emerald-300">
                            {uploadedFile.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                            {formatFileSize(uploadedFile.size)} · prêt pour le pack IA
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 shrink-0 gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                          onClick={openFilePicker}
                          disabled={busy}
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                          Re-téléverser
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`rounded-xl border border-dashed p-4 ${
                        uploadProgress !== null
                          ? "border-sky-500 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/50"
                          : "border-sky-400 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/40"
                      }`}
                    >
                      <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">
                        2. Upload enregistrement Jitsi (.webm)
                      </p>
                      <p className="mt-1 text-pretty text-xs text-slate-600 dark:text-slate-400">
                        {uploadProgress !== null
                          ? uploadProgress < 100
                            ? `Envoi en cours… ${uploadProgress} %`
                            : "Fichier reçu — transcription IA en cours…"
                          : "Choisis le fichier dans Téléchargements (ex. SyndicPro-AG-….webm, pas celui à 0 octet)."}
                      </p>

                      {uploadProgress !== null ? (
                        <div className="mt-3 space-y-2" aria-live="polite">
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-sky-200/80 dark:bg-sky-900">
                            <div
                              className="h-full rounded-full bg-sky-600 transition-[width] duration-200"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                          <p className="text-[11px] font-semibold text-sky-800 dark:text-sky-300">
                            {uploadProgress}%
                          </p>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="primary"
                          className="mt-3 min-h-11 gap-2"
                          onClick={openFilePicker}
                          disabled={busy}
                        >
                          <Upload className="h-4 w-4" aria-hidden />
                          Choisir un fichier
                        </Button>
                      )}
                    </div>
                  )}
                  <textarea
                    className="min-h-40 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    placeholder="Ex. : Ouverture à 18h… Discussion sur l'ascenseur… Vote pour travaux façade adopté…"
                    value={transcriptDraft}
                    onChange={(e) => setTranscriptDraft(e.target.value)}
                    aria-label="Transcription de l'assemblée"
                  />
                  {meeting.transcriptSavedAt && (
                    <p className="text-[11px] text-slate-500">
                      Dernière sauvegarde :{" "}
                      {new Date(meeting.transcriptSavedAt).toLocaleString("fr-FR")}
                    </p>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      className="min-h-[44px] flex-1"
                      onClick={saveTranscript}
                      disabled={busy || transcriptDraft.trim().length < 20}
                    >
                      Sauvegarder la transcription
                    </Button>
                    <Button
                      variant="primary"
                      className="min-h-[44px] flex-1 gap-2"
                      onClick={runAiPack}
                      disabled={busy}
                    >
                      <Sparkles className="h-4 w-4" /> Générer Pack AG (IA)
                    </Button>
                  </div>
                  {meeting.aiMinutesDraft && (
                    <div className="rounded-xl bg-slate-50 p-3 text-xs whitespace-pre-wrap dark:bg-slate-800/60">
                      <p className="mb-2 font-bold text-slate-700 dark:text-slate-200">
                        Brouillon PV IA
                        {meeting.aiGeneratedAt
                          ? ` · ${new Date(meeting.aiGeneratedAt).toLocaleString("fr-FR")}`
                          : ""}
                      </p>
                      {meeting.aiMinutesDraft}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-bold">
                    <FileText className="h-4 w-4 text-sky-500" /> Ordre du jour
                  </h2>
                  {isManagement && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[44px]"
                      onClick={generateAgenda}
                      disabled={busy}
                    >
                      Auto-générer (données)
                    </Button>
                  )}
                </div>
                {(meeting.agendaItems?.length
                  ? meeting.agendaItems
                  : (meeting.agenda || "").split("\n").filter(Boolean)
                ).length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Aucun ordre du jour — auto-génère depuis les données, ou via
                    transcription + IA.
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                    {(meeting.agendaItems?.length
                      ? meeting.agendaItems
                      : (meeting.agenda || "").split("\n").filter(Boolean)
                    ).map((line: string, i: number) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-4">
                <h2 className="flex items-center gap-2 font-bold">
                  <Users className="h-4 w-4 text-sky-500" /> Quorum
                </h2>
                {quorum && (
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {quorum.presentShares} / {quorum.totalShares} tantièmes
                      </span>
                      <span
                        className={
                          quorum.reached
                            ? "font-bold text-emerald-600"
                            : "font-bold text-amber-600"
                        }
                      >
                        {quorum.percentage} % (requis {quorum.requiredPercentage} %)
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className={`h-full ${quorum.reached ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${Math.min(100, quorum.percentage)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">Source : {quorum.source}</p>
                  </div>
                )}

                {isManagement && (
                  <>
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {apartments.map((a) => (
                        <label
                          key={a._id}
                          className="flex min-h-[44px] items-center justify-between gap-2 rounded-lg px-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <span>
                            Lot {a.number} · {a.shares} tantièmes
                            {a.owner?.name ? ` · ${a.owner.name}` : ""}
                          </span>
                          <input
                            type="checkbox"
                            checked={!!presence[a._id]}
                            onChange={(e) =>
                              setPresence((prev) => ({
                                ...prev,
                                [a._id]: e.target.checked,
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <Button
                      variant="primary"
                      className="min-h-[44px] w-full"
                      onClick={saveAttendance}
                    >
                      Enregistrer la présence
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-4">
                <h2 className="flex items-center gap-2 font-bold">
                  <PenLine className="h-4 w-4 text-sky-500" /> Procès-verbal
                </h2>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <a
                    href={`/api/meetings/${id}/minutes`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1"
                  >
                    <Button variant="outline" className="min-h-[44px] w-full gap-2">
                      <Download className="h-4 w-4" /> Télécharger le PDF
                    </Button>
                  </a>
                  {isManagement && (
                    <Button
                      variant="primary"
                      className="min-h-[44px] flex-1 gap-2"
                      onClick={signMinutes}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Signer & archiver
                    </Button>
                  )}
                </div>
                {meeting.minutesSignedAt && (
                  <p className="text-xs text-emerald-600">
                    Signé le {new Date(meeting.minutesSignedAt).toLocaleString("fr-FR")}
                    {meeting.minutesDocumentUrl
                      ? ` · ${meeting.minutesDocumentUrl}`
                      : ""}
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
