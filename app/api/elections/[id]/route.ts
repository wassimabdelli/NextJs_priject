import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Election } from "@/models/Election";
import { ElectionVote } from "@/models/ElectionVote";
import { Role, ElectionPhase } from "@/types/enums";
import { checkAndProgressElection } from "@/lib/elections/workflow";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * GET /api/elections/[id]
 * Détails complets d'une élection avec état de vote de l'utilisateur connecté.
 */
export const GET = withAuth(
  async (_req: NextRequest, user: AuthUser, context?: unknown) => {
    if (user.role === Role.TENANT) {
      throw new HttpError(403, "Accès refusé");
    }

    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) {
      throw new HttpError(400, "Identifiant invalide");
    }

    let election = await Election.findById(id)
      .populate("residence", "name city address")
      .populate("createdBy", "name email");

    if (!election) {
      throw new HttpError(404, "Élection introuvable");
    }

    const currentElection = await checkAndProgressElection(election);
    if (!currentElection) {
      throw new HttpError(404, "Élection introuvable");
    }

    // Vérifie si l'utilisateur a déjà voté
    const userVote = await ElectionVote.findOne({
      election: currentElection._id,
      voter: user.id,
    }).lean();

    // Vérifie si l'utilisateur est candidat
    const isCandidate = currentElection.candidates.some(
      (c: any) => c.user.toString() === user.id
    );

    // Décompte des voix si élection terminée ou pour admin
    let votesTally: Record<string, { count: number; weight: number }> = {};
    if (currentElection.phase === ElectionPhase.COMPLETED || user.role === Role.ADMIN) {
      const tally = await ElectionVote.aggregate([
        { $match: { election: currentElection._id } },
        {
          $group: {
            _id: "$candidate",
            count: { $sum: 1 },
            weight: { $sum: "$weight" },
          },
        },
      ]);
      for (const t of tally) {
        votesTally[t._id.toString()] = { count: t.count, weight: t.weight };
      }
    }

    return json({
      election: currentElection,
      hasVoted: !!userVote,
      votedCandidateId: userVote?.candidate?.toString() || null,
      isCandidate,
      votesTally,
    });
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.OWNER] }
);

