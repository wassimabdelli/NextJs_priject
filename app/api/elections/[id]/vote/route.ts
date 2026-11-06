import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import {
  withAuth,
  getResidentApartmentIds,
  getResidentResidenceIds,
  type AuthUser,
} from "@/lib/auth-guard";
import { Election } from "@/models/Election";
import { ElectionVote } from "@/models/ElectionVote";
import { Apartment } from "@/models/Apartment";
import { electionVoteSchema } from "@/lib/validations/election";
import { Role, ElectionPhase } from "@/types/enums";
import { checkAndProgressElection } from "@/lib/elections/workflow";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * POST /api/elections/[id]/vote
 * Enregistre le suffrage d'un électeur (Phase 2).
 * Rôles autorisés : ADMIN, SYNDIC, OWNER (Strictement interdit à TENANT).
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthUser, context?: unknown) => {
    if (user.role === Role.TENANT) {
      throw new HttpError(403, "Les locataires ne disposent pas du droit de vote aux élections de syndic");
    }

    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) {
      throw new HttpError(400, "Identifiant d'élection invalide");
    }

    const body = await parseBody(req, electionVoteSchema);

    const rawElection = await Election.findById(id);
    if (!rawElection) {
      throw new HttpError(404, "Élection introuvable");
    }

    const election = await checkAndProgressElection(rawElection);

    if (election.phase !== ElectionPhase.VOTING) {
      throw new HttpError(
        400,
        election.phase === ElectionPhase.CANDIDACY
          ? "Le scrutin n'est pas encore ouvert (Phase de candidature en cours)"
          : "Le scrutin est clôturé"
      );
    }

    if (new Date() >= new Date(election.votingEndDate)) {
      throw new HttpError(400, "La période de vote est expirée");
    }

    // Vérifie que le candidat sélectionné est bien inscrit
    const candidateExists = election.candidates.some(
      (c: any) => c.user.toString() === body.candidate
    );
    if (!candidateExists) {
      throw new HttpError(404, "Candidat non inscrit à cette élection");
    }

    // Vérifie le rattachement de l'électeur pour un OWNER
    if (user.role === Role.OWNER) {
      const myResidences = await getResidentResidenceIds(user.id);
      if (!myResidences.includes(election.residence.toString())) {
        throw new HttpError(403, "Vous devez être copropriétaire de cette résidence pour voter");
      }
    }

    // Vérifie l'unicité du vote
    const existingVote = await ElectionVote.findOne({
      election: election._id,
      voter: user.id,
    });
    if (existingVote) {
      throw new HttpError(409, "Vous avez déjà voté pour cette élection");
    }

    // Calcul du poids du vote selon les tantièmes du copropriétaire
    let weight = 100;
    if (user.role === Role.OWNER) {
      const myAptIds = await getResidentApartmentIds(user.id);
      const myApts = await Apartment.find({
        _id: { $in: myAptIds },
        residence: election.residence,
      });
      const shares = myApts.reduce((sum, apt) => sum + (apt.shares || 0), 0);
      if (shares > 0) weight = shares;
    }

    const vote = await ElectionVote.create({
      election: election._id,
      voter: user.id,
      candidate: body.candidate,
      weight,
      votedAt: new Date(),
    });

    return json({ success: true, voteId: vote._id, weight }, 201);
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.OWNER] }
);

