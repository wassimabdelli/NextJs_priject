"use client";

import React, { useEffect, useState } from "react";
import {
  Vote as VoteIcon,
  Crown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  UserCheck,
  Calendar,
  Send,
  FastForward,
  PlusCircle,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Role, ElectionPhase } from "@/types/enums";
import { useResidence } from "@/hooks/useResidence";
import { ResidencePicker } from "@/components/layout/ResidencePicker";

export default function ElectionsPage() {
  const [elections, setElections] = useState<any[]>([]);
  const [activeElectionId, setActiveElectionId] = useState<string | null>(null);
  const [electionDetails, setElectionDetails] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sélecteur de résidence
  const { residences: myResidences, selectedId: selectedResidenceId, setSelectedId: setSelectedResidenceId, loading: residenceLoading } = useResidence();

  // Candidacy form
  const [statement, setStatement] = useState("");
  // Vote selection
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

  // New election modal state for Admin
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [residences, setResidences] = useState<any[]>([]);
  const [newResidenceId, setNewResidenceId] = useState("");
  const [newTitle, setNewTitle] = useState("Élection du nouveau syndic");
  const [candidacyEndInput, setCandidacyEndInput] = useState("");
  const [votingEndInput, setVotingEndInput] = useState("");

  const loadData = async (residenceId?: string | null) => {
    try {
      setLoading(true);
      setError(null);
      setActiveElectionId(null);
      setElectionDetails(null);

      // Session
      const sessionRes = await fetch("/api/auth/session").then((r) => r.json());
      setCurrentUser(sessionRes?.user || null);

      if (sessionRes?.user?.role === Role.TENANT) {
        setError("Les locataires n'ont pas accès aux élections du syndic.");
        setLoading(false);
        return;
      }

      // Elections filtrées par résidence sélectionnée
      const url = residenceId
        ? `/api/elections?residence=${residenceId}`
        : "/api/elections";
      const res = await fetch(url);
      if (res.status === 403) {
        setError("Accès interdit aux locataires.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      const list = data?.data || [];
      setElections(list);

      const active = list.find(
        (e: any) => e.phase === ElectionPhase.CANDIDACY || e.phase === ElectionPhase.VOTING
      ) || list[0];

      if (active) {
        setActiveElectionId(active._id);
        await loadElectionDetails(active._id);
      }

      // Chargement des résidences pour le modal de création (Admin/Syndic)
      if (sessionRes?.user?.role === Role.ADMIN || sessionRes?.user?.role === Role.SYNDIC) {
        const resList = await fetch("/api/residences/available").then((r) => r.json());
        if (resList?.data) {
          setResidences(resList.data);
          if (resList.data.length > 0 && !newResidenceId) {
            setNewResidenceId(resList.data[0]._id);
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  const loadElectionDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/elections/${id}`);
      if (res.ok) {
        const details = await res.json();
        setElectionDetails(details);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    // Dates par défaut pour le modal (1 semaine + 2 semaines)
    const now = new Date();
    const d1 = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const d2 = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
    setCandidacyEndInput(d1.toISOString().slice(0, 16));
    setVotingEndInput(d2.toISOString().slice(0, 16));
  }, []);

  // Recharge les élections à chaque changement de résidence sélectionnée
  useEffect(() => {
    if (residenceLoading) return; // Attend que le hook ait chargé les résidences
    loadData(selectedResidenceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResidenceId, residenceLoading]);

  const handleSelectElection = async (id: string) => {
    setActiveElectionId(id);
    await loadElectionDetails(id);
  };

  // Submit candidacy
  const handleApplyCandidacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeElectionId) return;
    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/elections/${activeElectionId}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statement }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de candidature");

      setSuccess("Félicitations ! Votre candidature au poste de syndic a été enregistrée.");
      setStatement("");
      await loadElectionDetails(activeElectionId);
      await loadData(selectedResidenceId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  };

  // Cast vote
  const handleCastVote = async () => {
    if (!activeElectionId || !selectedCandidate) {
      setError("Veuillez sélectionner un candidat");
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/elections/${activeElectionId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate: selectedCandidate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors du vote");

      setSuccess(`Votre vote a été validé avec succès (${data.weight} tantièmes pris en compte) !`);
      await loadElectionDetails(activeElectionId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  };

  // Admin fast forward phase
  const handleProgressPhase = async () => {
    if (!activeElectionId) return;
    if (!confirm("Voulez-vous avancer immédiatement cette élection à la phase suivante ?")) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/elections/${activeElectionId}/progress`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'avancement");

      setSuccess("Phase avancée avec succès ! Les annonces automatiques ont été générées.");
      await loadElectionDetails(activeElectionId);
      await loadData(selectedResidenceId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  // Admin create election
  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResidenceId) {
      setError("Veuillez sélectionner une résidence");
      return;
    }
    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch("/api/elections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residence: newResidenceId,
          title: newTitle.trim(),
          candidacyEndDate: new Date(candidacyEndInput).toISOString(),
          votingEndDate: new Date(votingEndInput).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible de créer l'élection");

      setSuccess("Élection lancée avec succès ! L'annonce d'appel à candidatures a été publiée.");
      setShowCreateModal(false);
      await loadData(selectedResidenceId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de création");
    } finally {
      setSubmitting(false);
    }
  };

  const currentElection = electionDetails?.election;
  const phase = currentElection?.phase;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-balance text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
                Élections du Syndic
              </h1>
              <Badge variant="info">Copropriété</Badge>
            </div>
            <p className="text-pretty text-xs text-slate-500 sm:text-sm dark:text-slate-400">
              Scrutin démocratique pour l&apos;élection du gestionnaire de votre copropriété
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Sélecteur de résidence — visible seulement si l'utilisateur a plusieurs résidences */}
            <ResidencePicker
              residences={myResidences}
              selectedId={selectedResidenceId}
              onChange={setSelectedResidenceId}
            />

            {(currentUser?.role === Role.ADMIN || currentUser?.role === Role.SYNDIC) && (
              <Button
                variant="primary"
                onClick={() => {
                  // Pré-sélectionne la résidence active dans le modal
                  if (selectedResidenceId) setNewResidenceId(selectedResidenceId);
                  setShowCreateModal(true);
                }}
                className="gap-2 min-h-[44px] text-xs sm:min-h-[38px]"
              >
                <PlusCircle className="h-4 w-4" />
                Lancer une élection
              </Button>
            )}
          </div>
        </div>

        {/* Notifications Alertes */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Modal de création d'élection (Phase 0 -> Phase 1) */}
        {showCreateModal && (
          <div className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-lg shadow-sm">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <VoteIcon className="h-5 w-5 text-sky-500" />
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Paramétrer l&apos;élection du syndic
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    aria-label="Fermer"
                    className="flex size-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <X className="size-5 shrink-0" aria-hidden />
                  </button>
                </div>

                <form onSubmit={handleCreateElection} className="space-y-4">
                  <Select
                    label="Résidence concernée *"
                    value={newResidenceId}
                    onChange={(e) => setNewResidenceId(e.target.value)}
                    options={residences.map((r) => ({
                      value: r._id,
                      label: `${r.name} (${r.city})`,
                    }))}
                    required
                  />

                  <Input
                    label="Intitulé de l'élection *"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex : Élection du syndic 2026-2027"
                    required
                  />

                  <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3.5 space-y-3 dark:border-sky-900/40 dark:bg-sky-950/20">
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-900 dark:text-sky-300">
                      <Clock className="h-4 w-4 text-sky-500" />
                      <span>Calendrier des 2 phases</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Fin de la Phase 1 (Candidatures) & Lancement Phase 2 (Votes) *
                      </label>
                      <input
                        type="datetime-local"
                        value={candidacyEndInput}
                        onChange={(e) => setCandidacyEndInput(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        required
                      />
                      <p className="text-[10px] text-slate-500">
                        Date à laquelle les candidatures se ferment et les votes s&apos;ouvrent avec annonce automatique.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Fin de la Phase 2 (Clôture des votes & Proclamation) *
                      </label>
                      <input
                        type="datetime-local"
                        value={votingEndInput}
                        onChange={(e) => setVotingEndInput(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        required
                      />
                      <p className="text-[10px] text-slate-500">
                        Date à laquelle le scrutin s&apos;arrête, le gagnant est proclamé syndic et l&apos;annonce officielle est publiée.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateModal(false)}
                    >
                      Annuler
                    </Button>
                    <Button type="submit" variant="primary" disabled={submitting}>
                      {submitting ? "Lancement..." : "Lancer l'élection"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Aucune élection */}
        {!loading && elections.length === 0 && (
          <Card className="text-center p-8 space-y-4">
            <VoteIcon className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600" />
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
                {myResidences.length > 1 && selectedResidenceId
                  ? `Aucune élection pour ${myResidences.find((r) => r._id === selectedResidenceId)?.name ?? "cette résidence"}`
                  : "Aucune élection enregistrée pour votre résidence"}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                L&apos;administrateur système lancera le prochain scrutin lorsqu&apos;un mandat de syndic arrivera à échéance.
              </p>
            </div>
            {currentUser?.role === Role.ADMIN && (
              <Button onClick={() => setShowCreateModal(true)} variant="primary" className="mx-auto">
                <PlusCircle className="h-4 w-4 mr-2" />
                Lancer la première élection
              </Button>
            )}
          </Card>
        )}

        {/* Détails de l'élection sélectionnée */}
        {currentElection && (
          <div className="space-y-6">
            {/* Carte principale avec indicateur de phase */}
            <Card className="overflow-hidden border-sky-300 dark:border-sky-800/60 shadow-sm">
              <div className="bg-sky-600 p-6 text-white">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sky-100 text-xs font-semibold uppercase">
                      <Building2 className="h-4 w-4" />
                      <span>{currentElection.residence?.name} ({currentElection.residence?.city})</span>
                    </div>
                    <h2 className="text-balance mt-1 text-2xl font-black">
                      {currentElection.title}
                    </h2>
                  </div>

                  {currentUser?.role === Role.ADMIN && phase !== ElectionPhase.COMPLETED && (
                    <Button
                      size="sm"
                      onClick={handleProgressPhase}
                      disabled={submitting}
                      className="gap-1.5 bg-white/20 hover:bg-white/30 text-white border-0 text-xs font-semibold backdrop-blur-md"
                      title="Avancer immédiatement à la phase suivante (Test démo)"
                    >
                      <FastForward className="h-3.5 w-3.5" />
                      {phase === ElectionPhase.CANDIDACY
                        ? "Passer aux votes (Phase 2)"
                        : "Clôturer & Proclamer (Phase 3)"}
                    </Button>
                  )}
                </div>

                {/* Étapes des 3 phases */}
                <div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/20 pt-4 text-center">
                  <div className={`p-2 rounded-xl transition-all ${phase === ElectionPhase.CANDIDACY ? "bg-white text-sky-900 font-bold shadow-sm" : "text-white/80"}`}>
                    <span className="block text-[10px] font-semibold uppercase">Phase 1</span>
                    <span className="text-xs sm:text-sm">Candidatures</span>
                  </div>
                  <div className={`p-2 rounded-xl transition-all ${phase === ElectionPhase.VOTING ? "bg-white text-sky-900 font-bold shadow-sm" : "text-white/80"}`}>
                    <span className="block text-[10px] font-semibold uppercase">Phase 2</span>
                    <span className="text-xs sm:text-sm">Scrutin & Votes</span>
                  </div>
                  <div className={`p-2 rounded-xl transition-all ${phase === ElectionPhase.COMPLETED ? "bg-white text-sky-900 font-bold shadow-sm" : "text-white/80"}`}>
                    <span className="block text-[10px] font-semibold uppercase">Phase 3</span>
                    <span className="text-xs sm:text-sm">Résultats</span>
                  </div>
                </div>
              </div>

              {/* Calendrier et dates clés */}
              <CardContent className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Clock className="h-4 w-4 text-sky-500 shrink-0" />
                  <span>
                    Fin des candidatures :{" "}
                    <strong>{new Date(currentElection.candidacyEndDate).toLocaleString("fr-FR")}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Calendar className="size-4 shrink-0 text-sky-600" />
                  <span>
                    Clôture des votes :{" "}
                    <strong>{new Date(currentElection.votingEndDate).toLocaleString("fr-FR")}</strong>
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* ======================================================== */}
            {/* PHASE 3 : RÉSULTATS & NOUVEAU SYNDIC ÉLU                 */}
            {/* ======================================================== */}
            {phase === ElectionPhase.COMPLETED && (
              <Card className="border-amber-400 bg-amber-50/90 dark:border-amber-700/60 dark:bg-amber-950/25">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
                    <Crown className="size-8" />
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase text-amber-600 dark:text-amber-400">
                      Nouveau Syndic Élu
                    </span>
                    <h3 className="text-balance mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">
                      {currentElection.winner?.name || "Aucun candidat désigné"}
                    </h3>
                    <p className="text-pretty mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
                      Le dépouillement officiel a été clôturé. Le nouveau syndic est désormais officiellement rattaché à l&apos;administration de la résidence.
                    </p>
                  </div>

                  {currentElection.winner && (
                    <div className="inline-flex items-center gap-4 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                      <div>
                        <span className="tabular-nums text-2xl font-black text-slate-900 dark:text-white">
                          {currentElection.winner.votesCount}
                        </span>
                        <span className="block text-[11px] text-slate-500 uppercase">Suffrages</span>
                      </div>
                      <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                      <div>
                        <span className="tabular-nums text-2xl font-black text-amber-600 dark:text-amber-400">
                          {currentElection.winner.votesWeight}
                        </span>
                        <span className="block text-[11px] text-slate-500 uppercase">Tantièmes</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ======================================================== */}
            {/* PHASE 1 : FORMULAIRE DE CANDIDATURE                     */}
            {/* ======================================================== */}
            {phase === ElectionPhase.CANDIDACY && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Formulaire pour postuler */}
                <Card className="md:col-span-1 border-sky-200 dark:border-sky-800">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                      <UserCheck className="h-5 w-5 text-sky-500" />
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        Déposer ma candidature
                      </h3>
                    </div>

                    {electionDetails?.isCandidate ? (
                      <div className="rounded-xl bg-emerald-50 p-4 text-center space-y-2 dark:bg-emerald-950/40">
                        <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
                        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          Vous êtes officiellement candidat(e) à cette élection.
                        </p>
                      </div>
                    ) : (
                      <form onSubmit={handleApplyCandidacy} className="space-y-3">
                        <p className="text-xs text-slate-500">
                          En tant que copropriétaire, vous êtes éligible pour administrer la copropriété.
                        </p>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            Profession de foi ou motivation
                          </label>
                          <textarea
                            rows={4}
                            value={statement}
                            onChange={(e) => setStatement(e.target.value)}
                            placeholder="Vos engagements pour l'immeuble, vos disponibilités..."
                            className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </div>
                        <Button
                          type="submit"
                          variant="primary"
                          disabled={submitting}
                          className="w-full gap-2 min-h-[44px] text-xs"
                        >
                          <Send className="h-4 w-4" />
                          {submitting ? "Enregistrement..." : "Se porter candidat"}
                        </Button>
                      </form>
                    )}
                  </CardContent>
                </Card>

                {/* Liste des candidats enregistrés */}
                <Card className="md:col-span-2">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        Candidats en lice ({currentElection.candidates?.length || 0})
                      </h3>
                      <Badge variant="info">Phase 1 en cours</Badge>
                    </div>

                    {currentElection.candidates?.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        Aucun candidat n&apos;a encore postulé. Soyez le premier !
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {currentElection.candidates.map((cand: any, idx: number) => (
                          <div
                            key={idx}
                            className="rounded-2xl border border-slate-200 p-4 bg-white dark:bg-slate-900/60 dark:border-slate-800 space-y-2"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 font-bold text-xs dark:text-sky-400">
                                {cand.name.charAt(0)}
                              </div>
                              <div>
                                <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                                  {cand.name}
                                </h4>
                                <span className="text-[10px] text-slate-400">
                                  Inscrit le {new Date(cand.registeredAt).toLocaleDateString("fr-FR")}
                                </span>
                              </div>
                            </div>
                            {cand.statement && (
                              <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg">
                                « {cand.statement} »
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ======================================================== */}
            {/* PHASE 2 : BULLETINS DE VOTE                             */}
            {/* ======================================================== */}
            {phase === ElectionPhase.VOTING && (
              <Card>
                <CardContent className="p-6 space-y-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <VoteIcon className="h-5 w-5 text-sky-500" />
                        Scrutin ouvert — Exprimez votre suffrage
                      </h3>
                      <p className="text-xs text-slate-500">
                        Votre vote est pondéré selon les tantièmes de vos lots dans la copropriété
                      </p>
                    </div>

                    {electionDetails?.hasVoted && (
                      <Badge variant="success">✅ Vous avez voté</Badge>
                    )}
                  </div>

                  {electionDetails?.hasVoted ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 text-center space-y-2 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                      <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-300">
                        Votre bulletin a bien été pris en compte dans l&apos;urne électronique
                      </h4>
                      <p className="text-xs text-slate-500">
                        Les résultats définitifs seront proclamés le{" "}
                        {new Date(currentElection.votingEndDate).toLocaleDateString("fr-FR")}.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {currentElection.candidates.map((cand: any) => {
                          const isSelected = selectedCandidate === cand.user.toString();
                          return (
                            <div
                              key={cand.user.toString()}
                              onClick={() => setSelectedCandidate(cand.user.toString())}
                              className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                                isSelected
                                  ? "border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20 dark:bg-sky-950/40"
                                  : "border-slate-200 bg-white hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                                  {cand.name}
                                </h4>
                                <div
                                  className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                    isSelected
                                      ? "border-sky-500 bg-sky-500"
                                      : "border-slate-300 dark:border-slate-600"
                                  }`}
                                >
                                  {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                </div>
                              </div>
                              {cand.statement && (
                                <p className="mt-2 text-xs text-slate-500 line-clamp-3 italic">
                                  « {cand.statement} »
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button
                          variant="primary"
                          disabled={!selectedCandidate || submitting}
                          onClick={handleCastVote}
                          className="gap-2 min-h-[44px] px-6 text-sm"
                        >
                          <VoteIcon className="h-4 w-4" />
                          {submitting ? "Validation..." : "Confirmer mon vote"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Dépouillement des votes (Phase 3 ou Admin) */}
            {(phase === ElectionPhase.COMPLETED || currentUser?.role === Role.ADMIN) &&
              currentElection.candidates?.length > 0 && (
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Décompte des suffrages par candidat
                    </h3>

                    <div className="space-y-3">
                      {currentElection.candidates.map((cand: any) => {
                        const tally =
                          electionDetails?.votesTally?.[cand.user.toString()] || {
                            count: 0,
                            weight: 0,
                          };
                        const isWinner =
                          currentElection.winner?.user?.toString() === cand.user.toString();

                        return (
                          <div
                            key={cand.user.toString()}
                            className="flex items-center justify-between rounded-xl border border-slate-100 p-3 bg-slate-50/50 dark:bg-slate-900/40 dark:border-slate-800"
                          >
                            <div className="flex items-center gap-2">
                              {isWinner && <Crown className="h-4 w-4 text-amber-500" />}
                              <span className="font-semibold text-xs text-slate-900 dark:text-white">
                                {cand.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-slate-500">
                                <strong>{tally.count}</strong> vote(s)
                              </span>
                              <span className="font-bold text-sky-600 dark:text-sky-400">
                                {tally.weight} tantièmes
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

