"use client";

import React from 'react';
import {
  Vote,
  Clock,
  Calendar,
  Send,
  UserCheck,
  CheckCircle2,
  Plus,
  Crown,
  X,
  FastForward,
} from 'lucide-react';
import type { ElectionCandidate } from '@/lib/redesign/condo';
import { fetchWithOffline } from '@/lib/offline/apiClient';
import { ElectionPhase, Role } from '@/types/enums';
import { useResidence } from '@/hooks/useResidence';
import { canCastVote } from '@/lib/permissions';

/** Réponse liste GET /api/elections */
type ElectionsListResponse = { data: ElectionApi[]; meta: { page: number; limit: number; total: number } };

type ElectionApi = {
  _id: string;
  title: string;
  phase: string;
  candidacyEndDate: string;
  votingEndDate: string;
  residence?: { _id?: string; name?: string; city?: string };
  candidates?: Array<{
    user: string | { toString(): string };
    name: string;
    statement?: string;
    registeredAt: string;
  }>;
  winner?: { name?: string; votesCount?: number; votesWeight?: number };
};

type ElectionDetailResponse = {
  election: ElectionApi;
  hasVoted: boolean;
  isCandidate: boolean;
  votesTally?: Record<string, { count: number; weight: number }>;
};

const emptyResidence = { id: '', name: '—', city: '—', address: '', totalLots: 0, syndicName: '' };

/**
 * Élections redesign : données réelles via /api/elections (liste, détail, candidature, vote).
 * Les phases affichées suivent strictement election.phase renvoyé par l’API.
 */
export const ElectionsView: React.FC = () => {
  const { residences, selectedId, selected, setSelectedId, loading: residenceLoading } = useResidence();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [sessionUser, setSessionUser] = React.useState<{ id: string; role?: string; name?: string } | null>(null);

  const [elections, setElections] = React.useState<ElectionApi[]>([]);
  const [activeElectionId, setActiveElectionId] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState<ElectionDetailResponse | null>(null);

  const [statement, setStatement] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  // Modal création (ADMIN / SYNDIC)
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [residencesForCreate, setResidencesForCreate] = React.useState<Array<{ _id: string; name: string; city: string }>>([]);
  const [newResidenceId, setNewResidenceId] = React.useState('');
  const [newTitle, setNewTitle] = React.useState('Élection du nouveau syndic');
  const [candidacyEndInput, setCandidacyEndInput] = React.useState('');
  const [votingEndInput, setVotingEndInput] = React.useState('');

  const election = details?.election ?? null;
  const phase = election?.phase as (typeof ElectionPhase)[keyof typeof ElectionPhase] | undefined;

  const residenceForHeader = selected
    ? { id: selected._id, name: selected.name, city: selected.city, address: selected.address ?? '', totalLots: selected.totalApartments ?? 0, syndicName: '' }
    : emptyResidence;

  // Dates par défaut pour le modal création
  React.useEffect(() => {
    const now = new Date();
    const d1 = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const d2 = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
    setCandidacyEndInput(d1.toISOString().slice(0, 16));
    setVotingEndInput(d2.toISOString().slice(0, 16));
  }, []);

  const loadElectionDetails = React.useCallback(async (id: string) => {
    const d = await fetchWithOffline<ElectionDetailResponse>(`/api/elections/${id}`);
    setDetails(d);
  }, []);

  const loadData = React.useCallback(async () => {
    setError(null);
    setSuccess(null);
    try {
      setLoading(true);
      const sess = await fetch('/api/auth/session').then((r) => r.json());
      setSessionUser(sess?.user ?? null);

      if (sess?.user?.role === Role.TENANT) {
        setError("Les locataires n'ont pas accès aux élections du syndic.");
        setElections([]);
        setDetails(null);
        setActiveElectionId(null);
        return;
      }

      const residenceParam = selectedId ? `&residence=${encodeURIComponent(selectedId)}` : '';
      const listRes = await fetchWithOffline<ElectionsListResponse>(`/api/elections?limit=100${residenceParam}`);
      const list = listRes?.data ?? [];
      setElections(list);

      const active =
        list.find((e) => e.phase === ElectionPhase.CANDIDACY || e.phase === ElectionPhase.VOTING) ||
        list[0] ||
        null;

      if (active) {
        setActiveElectionId(active._id);
        await loadElectionDetails(active._id);
      } else {
        setActiveElectionId(null);
        setDetails(null);
      }

      if (sess?.user?.role === Role.ADMIN || sess?.user?.role === Role.SYNDIC) {
        const avail = await fetch('/api/residences/available').then((r) => r.json());
        if (avail?.data?.length) {
          setResidencesForCreate(avail.data);
          setNewResidenceId((prev) => prev || avail.data[0]._id);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [selectedId, loadElectionDetails]);

  React.useEffect(() => {
    if (residenceLoading) return;
    loadData();
  }, [residenceLoading, loadData]);

  const apiPhaseStep: 1 | 2 | 3 =
    phase === ElectionPhase.CANDIDACY ? 1 : phase === ElectionPhase.VOTING ? 2 : phase === ElectionPhase.COMPLETED ? 3 : 1;

  const mapCandidatesForList = (): ElectionCandidate[] => {
    if (!election?.candidates?.length) return [];
    const tally = details?.votesTally ?? {};
    return election.candidates.map((c) => {
      const uid = typeof c.user === 'string' ? c.user : String(c.user);
      const t = tally[uid];
      return {
        id: uid,
        name: c.name,
        lotNumber: '—',
        registeredDate: new Date(c.registeredAt).toLocaleDateString('fr-FR'),
        statement: c.statement?.trim() || '—',
        votesCount: t?.count ?? 0,
      };
    });
  };

  const handleSubmitCandidacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeElectionId || phase !== ElectionPhase.CANDIDACY) return;
    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      await fetchWithOffline(`/api/elections/${activeElectionId}/candidates`, {
        method: 'POST',
        body: JSON.stringify({ statement: statement.trim() || undefined }),
      });
      setSuccess('Candidature enregistrée.');
      setStatement('');
      await loadElectionDetails(activeElectionId);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (candidateUserId: string) => {
    if (!activeElectionId || phase !== ElectionPhase.VOTING) return;
    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      await fetchWithOffline<{ success: boolean; weight?: number }>(`/api/elections/${activeElectionId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ candidate: candidateUserId }),
      });
      setSuccess('Vote enregistré.');
      await loadElectionDetails(activeElectionId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de vote');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResidenceId) {
      setError('Veuillez sélectionner une résidence');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await fetchWithOffline('/api/elections', {
        method: 'POST',
        body: JSON.stringify({
          residence: newResidenceId,
          title: newTitle.trim(),
          candidacyEndDate: new Date(candidacyEndInput).toISOString(),
          votingEndDate: new Date(votingEndInput).toISOString(),
        }),
      });
      setSuccess('Élection créée.');
      setShowCreateModal(false);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de création');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProgressPhase = async () => {
    if (!activeElectionId || sessionUser?.role !== Role.ADMIN) return;
    if (!confirm("Avancer cette élection à la phase suivante ?")) return;
    try {
      setSubmitting(true);
      await fetchWithOffline(`/api/elections/${activeElectionId}/progress`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setSuccess('Phase mise à jour.');
      await loadElectionDetails(activeElectionId);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const candidates = mapCandidatesForList();
  const canShowAdminActions =
    sessionUser?.role === Role.ADMIN || sessionUser?.role === Role.SYNDIC;
  const canParticipate = canCastVote(sessionUser?.role as Role | undefined);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-800 dark:text-rose-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
          {success}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Démocratie Participative
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-bold">
              Copropriété
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
            Élections du Conseil & Syndic
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Scrutin démocratique pour l’élection du bureau gestionnaire de votre copropriété
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {residences.length > 1 && (
            <select
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-slate-200"
            >
              {residences.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-xs font-bold text-slate-700 dark:text-slate-300">
            {residenceForHeader.name}
          </div>
          {canShowAdminActions && (
            <button
              type="button"
              onClick={() => {
                if (selectedId) setNewResidenceId(selectedId);
                setShowCreateModal(true);
              }}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/10 px-3.5 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-600/20 dark:text-blue-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Lancer une élection
            </button>
          )}
        </div>
      </div>

      {loading && <p className="text-xs text-slate-500">Chargement…</p>}

      {!loading && elections.length === 0 && !error && (
        <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-8 text-center dark:border-white/[0.08] dark:bg-white/[0.02]">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Aucune élection pour cette résidence</p>
          {sessionUser?.role === Role.ADMIN && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white"
            >
              <Plus className="h-4 w-4" />
              Lancer la première élection
            </button>
          )}
        </div>
      )}

      {election && (
        <div className="p-6 rounded-3xl glass-card space-y-6 shadow-xl">
          <div className="border-b border-slate-200/80 dark:border-white/[0.06] pb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-blue-600 dark:text-blue-400 font-bold">
                {(election.residence?.name || residenceForHeader.name).toUpperCase()} (
                {(election.residence?.city || residenceForHeader.city).toUpperCase()})
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{election.title}</h2>
            </div>
            {sessionUser?.role === Role.ADMIN && phase !== ElectionPhase.COMPLETED && (
              <button
                type="button"
                onClick={handleProgressPhase}
                disabled={submitting}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-800 dark:text-amber-200 min-h-[44px]"
              >
                <FastForward className="h-3.5 w-3.5" />
                {phase === ElectionPhase.CANDIDACY ? 'Passer aux votes' : 'Clôturer & proclamer'}
              </button>
            )}
          </div>

          {/* 3-Phase Stepper — état visuel = phase API uniquement */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 bg-slate-100/90 dark:bg-black/30 rounded-2xl border border-slate-200/80 dark:border-white/[0.06]">
            <div
              className={`p-3 rounded-xl text-left transition-all ${
                apiPhaseStep === 1
                  ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span className="text-[10px] block font-mono uppercase font-bold text-blue-600 dark:text-blue-200">Phase 1</span>
              <span className="text-sm font-bold block mt-0.5">Candidatures</span>
            </div>
            <div
              className={`p-3 rounded-xl text-left transition-all ${
                apiPhaseStep === 2
                  ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span className="text-[10px] block font-mono uppercase font-bold text-blue-600 dark:text-blue-200">Phase 2</span>
              <span className="text-sm font-bold block mt-0.5">Scrutin & Votes</span>
            </div>
            <div
              className={`p-3 rounded-xl text-left transition-all ${
                apiPhaseStep === 3
                  ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span className="text-[10px] block font-mono uppercase font-bold text-blue-600 dark:text-blue-200">Phase 3</span>
              <span className="text-sm font-bold block mt-0.5">Résultats</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50/80 dark:bg-white/[0.02] p-4 rounded-2xl border border-slate-200/60 dark:border-white/[0.04]">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                Fin des candidatures :{' '}
                <strong className="text-slate-900 dark:text-white font-mono">
                  {new Date(election.candidacyEndDate).toLocaleString('fr-FR')}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
              <span>
                Clôture des votes :{' '}
                <strong className="text-slate-900 dark:text-white font-mono">
                  {new Date(election.votingEndDate).toLocaleString('fr-FR')}
                </strong>
              </span>
            </div>
          </div>

          {/* Phase 3 — résultats */}
          {phase === ElectionPhase.COMPLETED && election.winner && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-center space-y-3">
              <Crown className="mx-auto h-10 w-10 text-amber-500" />
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Syndic élu</h3>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{election.winner.name}</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {election.winner.votesCount ?? 0} suffrages · {election.winner.votesWeight ?? 0} tantièmes
              </p>
            </div>
          )}

          {/* Phases 1 & 2 : formulaire + liste */}
          {phase !== ElectionPhase.COMPLETED && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              <div className="space-y-4">
                {canParticipate && (
                  <>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                      <UserCheck className="w-4 h-4 text-blue-500" />
                      <h3>Déposer ma candidature</h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      En tant que copropriétaire en règle de vos cotisations, vous êtes éligible pour administrer la copropriété.
                    </p>

                    {phase === ElectionPhase.CANDIDACY &&
                      (details?.isCandidate ? (
                        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                          <CheckCircle2 className="h-5 w-5 shrink-0" />
                          Vous êtes déjà candidat.
                        </div>
                      ) : (
                        <form onSubmit={handleSubmitCandidacy} className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                              Profession de foi ou motivation
                            </label>
                            <textarea
                              rows={4}
                              value={statement}
                              onChange={(e) => setStatement(e.target.value)}
                              placeholder="Vos engagements pour l’immeuble, votre vision financière, vos disponibilités..."
                              className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] rounded-2xl p-3 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none font-medium"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={submitting}
                            className="w-full min-h-[44px] py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{submitting ? 'Envoi…' : 'Se porter candidat'}</span>
                          </button>
                        </form>
                      ))}

                    {phase === ElectionPhase.VOTING && (
                      <p className="text-xs text-slate-500 italic">Les candidatures sont closes — votez depuis la liste à droite.</p>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Vote className="w-4 h-4 text-blue-500" />
                    <h3>Candidats en lice ({candidates.length})</h3>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                    {phase === ElectionPhase.CANDIDACY ? 'Phase 1' : phase === ElectionPhase.VOTING ? 'Phase 2' : '—'}
                  </span>
                </div>

                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {candidates.map((cand) => (
                    <div
                      key={cand.id}
                      className="p-4 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.12] transition-colors space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 shrink-0 rounded-xl bg-blue-600/15 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center border border-blue-500/30">
                            {cand.name[0]}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{cand.name}</h4>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {cand.lotNumber} · Inscrit le {cand.registeredDate}
                            </span>
                          </div>
                        </div>

                        {canParticipate && phase === ElectionPhase.VOTING && !details?.hasVoted && (
                          <button
                            type="button"
                            onClick={() => handleVote(cand.id)}
                            disabled={submitting}
                            className="shrink-0 min-h-[44px] px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white dark:text-blue-400 border border-blue-500/25 text-xs font-bold transition-all shadow-xs"
                          >
                            Voter ({cand.votesCount})
                          </button>
                        )}
                        {canParticipate && phase === ElectionPhase.VOTING && details?.hasVoted && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Vote enregistré</span>
                        )}
                        {phase === ElectionPhase.CANDIDACY && (
                          <span className="text-[10px] font-mono text-slate-500">{cand.votesCount} voix</span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-white/60 dark:bg-black/20 p-2.5 rounded-xl border border-slate-200/40 dark:border-white/[0.04]">
                        « {cand.statement} »
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Décompte détaillé phase terminée */}
          {phase === ElectionPhase.COMPLETED && candidates.length > 0 && (
            <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Décompte par candidat</h4>
              {candidates.map((c) => (
                <div key={c.id} className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-white">{c.name}</span>
                  <span>{c.votesCount} vote(s)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowCreateModal(false)}
        >
          <div className="w-full max-w-md glass-card rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/[0.08]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Lancer une élection</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateElection} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Résidence *</label>
                <select
                  required
                  value={newResidenceId}
                  onChange={(e) => setNewResidenceId(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-base text-slate-900 dark:border-white/[0.1] dark:bg-slate-800 dark:text-white"
                >
                  {residencesForCreate.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.name} ({r.city})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Intitulé *</label>
                <input
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-base text-slate-900 dark:border-white/[0.1] dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Fin candidatures *</label>
                <input
                  type="datetime-local"
                  required
                  value={candidacyEndInput}
                  onChange={(e) => setCandidacyEndInput(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-base text-slate-900 dark:border-white/[0.1] dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Fin des votes *</label>
                <input
                  type="datetime-local"
                  required
                  value={votingEndInput}
                  onChange={(e) => setVotingEndInput(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-base text-slate-900 dark:border-white/[0.1] dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="min-h-[44px] rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700 dark:bg-white/[0.04] dark:text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[44px] rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 font-bold text-white shadow-md"
                >
                  {submitting ? 'Création…' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
