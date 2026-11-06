import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import {
  withAuth,
  getResidentResidenceIds,
  getSyndicResidenceIds,
  type AuthUser,
} from "@/lib/auth-guard";
import { Election } from "@/models/Election";
import { User } from "@/models/User";
import { electionCandidateSchema } from "@/lib/validations/election";
import { Role, ElectionPhase } from "@/types/enums";
import { checkAndProgressElection } from "@/lib/elections/workflow";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * POST /api/elections/[id]/candidates
 * Dépose la candidature de l'utilisateur connecté pour l'élection de syndic.
 * Rôles autorisés : ADMIN, SYNDIC, OWNER (Strictement interdit à TENANT).
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthUser, context?: unknown) => {
    if (user.role === Role.TENANT) {
      throw new HttpError(403, "Les locataires ne peuvent pas se présenter à l'élection de syndic");
    }

    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) {
      throw new HttpError(400, "Identifiant invalide");
    }

    const body = await parseBody(req, electionCandidateSchema).catch(() => ({}));

    const rawElection = await Election.findById(id);
    if (!rawElection) {
      throw new HttpError(404, "Élection introuvable");
    }

    const election = await checkAndProgressElection(rawElection);

    if (election.phase !== ElectionPhase.CANDIDACY) {
      throw new HttpError(
        400,
        "La période de dépôt des candidatures (Phase 1) est terminée"
      );
    }

    if (new Date() >= new Date(election.candidacyEndDate)) {
      throw new HttpError(400, "La date limite de dépôt des candidatures est dépassée");
    }

    // Vérifie le rattachement à la résidence pour les copropriétaires
    if (user.role === Role.OWNER) {
      const myResidences = await getResidentResidenceIds(user.id);
      if (!myResidences.includes(election.residence.toString())) {
        throw new HttpError(403, "Vous devez être copropriétaire de cette résidence pour candidater");
      }
    } else if (user.role === Role.SYNDIC) {
      const myResidences = await getSyndicResidenceIds(user.id);
      if (!myResidences.includes(election.residence.toString())) {
        throw new HttpError(403, "Vous n'administrez pas cette résidence");
      }
    }

    // Vérifie si déjà candidat
    const alreadyCandidate = election.candidates.some(
      (c: any) => c.user.toString() === user.id
    );
    if (alreadyCandidate) {
      throw new HttpError(409, "Vous avez déjà déposé votre candidature");
    }

    const applicant = await User.findById(user.id).lean();

    election.candidates.push({
      user: user.id as any,
      name: applicant?.name || user.name || "Candidat",
      email: applicant?.email || user.email || undefined,
      statement: (body as any)?.statement,
      registeredAt: new Date(),
    });

    await election.save();

    return json(election, 201);
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.OWNER] }
);

