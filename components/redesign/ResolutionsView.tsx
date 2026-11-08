"use client";

import React from "react";
import { Vote, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Resolution, Ballot, ApartmentLot } from "@/lib/redesign/condo";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { Role as ApiRole, VoteChoice } from "@/types/enums";
import { voteChoiceToFr, formatDateFrShort } from "@/components/redesign/apiMappers";
import { canCastVote } from "@/lib/permissions";

type MeetingApi = { _id: string; title?: string; status?: string };
type ResolutionApi = {
  _id: string;
  title: string;
  requiredMajority?: number;
  meeting?: MeetingApi;
};
type VoteApi = {
  _id: string;
  resolution?: string | { _id?: string };
  apartment?: { _id?: string; number?: string };
  choice?: string;
  weight?: number;
  votedAt?: string;
};
type AptApi = { _id: string; number: string; floor?: number; shares?: number; owner?: { name?: string } };

type SessionRes = { user?: { role?: string } };

export const ResolutionsView: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [resolutions, setResolutions] = React.useState<Resolution[]>([]);
  const [ballots, setBallots] = React.useState<Ballot[]>([]);
  const [lots, setLots] = React.useState<ApartmentLot[]>([]);
  const [sessionRole, setSessionRole] = React.useState<string | null>(null);

  const [votingResolutionId, setVotingResolutionId] = React.useState<string | null>(null);
  const [selectedAptId, setSelectedAptId] = React.useState<string>("");
  const [selectedVote, setSelectedVote] = React.useState<"POUR" | "CONTRE" | "ABSTENTION">("POUR");

  const mapResolution = React.useCallback((r: ResolutionApi): Resolution => {
    const mid = typeof r.meeting === "object" && r.meeting?._id ? r.meeting._id : String(r.meeting ?? "");
    return {
      id: r._id,
      meetingId: mid,
      title: r.title,
      meetingName: typeof r.meeting === "object" ? r.meeting?.title ?? "Assemblée" : "Assemblée",
      requiredMajority: r.requiredMajority ?? 50,
      status: "En attente",
      votesPour: 0,
      votesContre: 0,
      votesAbstention: 0,
    };
  }, []);

  const mapVoteToBallot = React.useCallback((v: VoteApi): Ballot | null => {
    const resId =
      typeof v.resolution === "object" && v.resolution && "_id" in v.resolution
        ? String(v.resolution._id)
        : String(v.resolution ?? "");
    const apt = v.apartment;
    if (!resId || !apt?.number) return null;
    return {
      id: v._id,
      resolutionId: resId,
      resolutionTitle: "",
      lotNumber: `Lot ${apt.number}`,
      vote: voteChoiceToFr(v.choice || ""),
      tantiemes: v.weight ?? 0,
      date: formatDateFrShort(v.votedAt),
    };
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sess = (await fetch("/api/auth/session").then((r) => r.json())) as SessionRes;
      setSessionRole(sess?.user?.role ?? null);

      const [resJson, voteJson, aptJson] = await Promise.all([
        fetchWithOffline<{ data: ResolutionApi[] }>("/api/resolutions?limit=100"),
        fetchWithOffline<{ data: VoteApi[] }>("/api/votes?limit=500"),
        fetchWithOffline<{ data: AptApi[] }>("/api/apartments?limit=500"),
      ]);

      const resList = (resJson.data || []).map(mapResolution);
      setResolutions(resList);

      const bl = (voteJson.data || []).map(mapVoteToBallot).filter(Boolean) as Ballot[];
      setBallots(bl);

      setLots(
        (aptJson.data || []).map((a) => ({
          id: a._id,
          lotNumber: a.number,
          residenceId: "",
          floor: a.floor ?? 0,
          surfaceM2: 0,
          tantiemes: a.shares ?? 0,
          occupied: true,
          ownerName: a.owner?.name ?? "—",
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
      setResolutions([]);
      setBallots([]);
    } finally {
      setLoading(false);
    }
  }, [mapResolution, mapVoteToBallot]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (lots.length && !selectedAptId) setSelectedAptId(lots[0].id);
  }, [lots, selectedAptId]);

  const canVote = canCastVote(sessionRole as ApiRole | undefined);

  const handleVoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!votingResolutionId || !selectedAptId) return;
    setError(null);
    setSuccess(null);
    const choiceApi =
      selectedVote === "POUR" ? VoteChoice.FOR : selectedVote === "CONTRE" ? VoteChoice.AGAINST : VoteChoice.ABSTAIN;
    try {
      await fetchWithOffline("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution: votingResolutionId,
          apartment: selectedAptId,
          choice: choiceApi,
        }),
      });
      setSuccess("Vote enregistré.");
      setVotingResolutionId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vote refusé");
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Démocratie Participative
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
            Résolutions & Votes en Ligne
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Décompte des suffrages par tantièmes et validation juridique des majorités requises
          </p>
        </div>
      </div>

      {(error || success) && (
        <div className="space-y-2">
          {error && (
            <div
              role="alert"
              className="glass-card rounded-3xl p-4 border border-rose-500/25 bg-rose-500/10 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div
              role="status"
              className="glass-card rounded-3xl p-4 border border-emerald-500/25 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="glass-card rounded-3xl p-10 animate-pulse min-h-[200px]" />
      ) : resolutions.length === 0 ? (
        <div className="glass-card rounded-3xl p-8 text-center text-xs text-slate-500">Aucune résolution.</div>
      ) : (
        <div className="space-y-5">
          {resolutions.map((res) => {
            const resBallots = ballots.filter((b) => b.resolutionId === res.id);
            const pourTantiemes = resBallots.filter((b) => b.vote === "POUR").reduce((s, b) => s + b.tantiemes, 0);
            const contreTantiemes = resBallots.filter((b) => b.vote === "CONTRE").reduce((s, b) => s + b.tantiemes, 0);
            const totalExpressed = pourTantiemes + contreTantiemes;
            const pourPct = totalExpressed > 0 ? Math.round((pourTantiemes / totalExpressed) * 100) : 0;

            return (
              <div key={res.id} className="p-6 rounded-3xl glass-card space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{res.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {res.meetingName} · Majorité requise :{" "}
                      <strong className="text-slate-900 dark:text-white font-mono">{res.requiredMajority} %</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full ${
                        pourPct >= res.requiredMajority
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {pourPct >= res.requiredMajority ? "Adoptée" : "En délibération"}
                    </span>
                    {canVote && (
                      <button
                        type="button"
                        onClick={() => setVotingResolutionId(res.id)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
                      >
                        <Vote className="w-3.5 h-3.5" />
                        <span>Exprimer un vote</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono font-semibold">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      POUR : {pourTantiemes} tantièmes ({pourPct} %)
                    </span>
                    <span className="text-rose-600 dark:text-rose-400">
                      CONTRE : {contreTantiemes} tantièmes ({100 - pourPct} %)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-white/[0.08] h-2.5 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${pourPct}%` }} />
                    <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${100 - pourPct}%` }} />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Suffrages exprimés ({resBallots.length}) :
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {resBallots.map((b) => (
                      <div
                        key={b.id}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05] text-xs flex items-center gap-2"
                      >
                        <span className="font-bold text-slate-900 dark:text-white">{b.lotNumber}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({b.tantiemes} t.)</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            b.vote === "POUR"
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                              : b.vote === "CONTRE"
                                ? "bg-rose-500/20 text-rose-700 dark:text-rose-400"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {b.vote}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canVote && votingResolutionId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn"
          onClick={() => setVotingResolutionId(null)}
        >
          <div className="w-full max-w-md glass-card rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/[0.08]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Exprimer un vote de copropriétaire</h3>
              <button
                onClick={() => setVotingResolutionId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleVoteSubmit(e)} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Lot votant</label>
                <select
                  value={selectedAptId}
                  onChange={(e) => setSelectedAptId(e.target.value)}
                  className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                >
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      Lot {l.lotNumber} ({l.tantiemes} tantièmes) - {l.ownerName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Choix du suffrage</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["POUR", "CONTRE", "ABSTENTION"] as const).map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setSelectedVote(choice)}
                      className={`py-2.5 rounded-xl font-bold text-xs border transition-all ${
                        selectedVote === choice
                          ? choice === "POUR"
                            ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/20"
                            : choice === "CONTRE"
                              ? "bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-500/20"
                              : "bg-slate-600 text-white border-slate-500"
                          : "bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-slate-500">
                Le vote n’est possible que si l’assemblée générale est au statut « ouverte » (OPEN) côté serveur.
              </p>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setVotingResolutionId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-md shadow-blue-500/20"
                >
                  Confirmer le vote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
