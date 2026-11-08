"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AIError } from "@/components/ai/AIError";
import { AIDuplicateReview } from "@/components/ai/AIDuplicateReview";
import { AIPriorityPanel } from "@/components/ai/AIPriorityPanel";
import { IncidentAIReview } from "@/components/ai/IncidentAIReview";
import { AIBadge } from "@/components/ai/AIBadge";
import type { IncidentDTO } from "@/types/api";

type ReplyFacts = {
  ageDays: number;
  assigned: boolean;
  waitingDays: number | null;
};

type Props = {
  incident: IncidentDTO;
  residenceId: string;
  onInspect: (id: string) => void;
  onPriorityApplied: (priority: IncidentDTO["priority"]) => void;
  onResolutionCheckSaved: (check: NonNullable<IncidentDTO["aiResolutionCheck"]>) => void;
  canVerify: boolean;
  goToDiscussion: () => void;
};

function daysSince(date: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));
}

export function IncidentAIContext({
  incident,
  residenceId,
  onInspect,
  onPriorityApplied,
  onResolutionCheckSaved,
  canVerify,
  goToDiscussion,
}: Props) {
  const [reply, setReply] = useState("");
  const [replyFacts, setReplyFacts] = useState<ReplyFacts | null>(null);
  const [loadingReply, setLoadingReply] = useState(false);
  const [replyError, setReplyError] = useState("");
  const assignedTo =
    typeof incident.assignedTo === "object" && incident.assignedTo
      ? incident.assignedTo
      : undefined;
  const technicianName =
    assignedTo?.name ||
    assignedTo?.email ||
    (incident.assignedTo ? "Technicien assigné" : "Non assigné");

  const proposeReply = async () => {
    setLoadingReply(true);
    setReplyError("");
    setReplyFacts(null);
    try {
      const response = await fetch(
        `/api/ai/incidents/${encodeURIComponent(incident._id)}/reply`,
        { method: "POST" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Proposition de réponse indisponible.");
      setReply(data.reply as string);
      setReplyFacts(data.facts as ReplyFacts);
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "Proposition de réponse indisponible.");
    } finally {
      setLoadingReply(false);
    }
  };

  const copyReply = async () => {
    if (!reply.trim()) return false;
    try {
      await navigator.clipboard.writeText(reply);
      setReplyError("");
      return true;
    } catch {
      setReplyError("Impossible de copier le brouillon. Vérifiez les autorisations du navigateur.");
      return false;
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 text-sm dark:border-indigo-900 dark:bg-indigo-950/20 sm:grid-cols-3">
        <h3 className="sm:col-span-3 text-sm font-bold text-indigo-950 dark:text-indigo-100">
          Ce dossier en un coup d&apos;œil
        </h3>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ancienneté</p>
          <p className="mt-1 font-bold text-slate-900 dark:text-white">{daysSince(incident.reportedAt)} j</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Technicien</p>
          <p className="mt-1 font-bold text-slate-900 dark:text-white">{technicianName}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Photos jointes</p>
          <p className="mt-1 font-bold text-slate-900 dark:text-white">{incident.photos?.length ?? 0}</p>
        </div>
      </section>

      <IncidentAIReview
        incidentId={incident._id}
        aiTriage={incident.aiTriage}
        aiResolutionCheck={incident.aiResolutionCheck}
        resolutionPhotos={incident.resolutionPhotos ?? []}
        showTriage
        canVerify={canVerify}
        onResolutionCheckSaved={onResolutionCheckSaved}
      />

      <AIPriorityPanel
        incidentId={incident._id}
        description={`${incident.title}\n${incident.description}`.slice(0, 4000)}
        currentPriority={incident.priority}
        onApplied={onPriorityApplied}
      />

      <AIDuplicateReview
        incidentId={incident._id}
        residenceId={residenceId}
        title={incident.title}
        description={incident.description}
        onInspect={onInspect}
      />

      <section className="space-y-3 rounded-2xl border border-sky-200 p-4 dark:border-sky-900">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-900 dark:text-white">Proposer une réponse</h3><AIBadge label="Brouillon IA" /></div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Préparez un brouillon à relire avant de répondre au résident.
          </p>
        </div>
        {!reply && (
          <Button type="button" disabled={loadingReply} isLoading={loadingReply} onClick={() => void proposeReply()}>
            Proposer une réponse
          </Button>
        )}
        {replyFacts?.waitingDays !== null && replyFacts?.waitingDays !== undefined && (
          <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Dernier message du résident sans réponse depuis {replyFacts.waitingDays} j
          </p>
        )}
        {reply && (
          <>
            <textarea
              aria-label="Brouillon de réponse à modifier"
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              maxLength={1500}
              rows={5}
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void copyReply()}>Copier</Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  if (await copyReply()) goToDiscussion();
                }}
              >
                Utiliser dans la discussion
              </Button>
              <Button type="button" variant="ghost" disabled={loadingReply} isLoading={loadingReply} onClick={() => void proposeReply()}>
                Régénérer
              </Button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Brouillon IA : relisez et modifiez avant envoi. Rien n&apos;est envoyé automatiquement.
            </p>
          </>
        )}
        {replyError && <AIError message={replyError} />}
      </section>
    </div>
  );
}
