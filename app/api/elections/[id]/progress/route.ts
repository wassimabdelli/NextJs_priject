import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Election } from "@/models/Election";
import { Role, ElectionPhase } from "@/types/enums";
import { checkAndProgressElection } from "@/lib/elections/workflow";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * POST /api/elections/[id]/progress
 * Permet à un administrateur d'avancer manuellement de phase (pour test ou clôture anticipée).
 * Rôles autorisés : ADMIN
 */
export const POST = withAuth(
  async (_req: NextRequest, _user: AuthUser, context?: unknown) => {
    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) {
      throw new HttpError(400, "Identifiant invalide");
    }

    const election = await Election.findById(id);
    if (!election) {
      throw new HttpError(404, "Élection introuvable");
    }

    if (election.phase === ElectionPhase.CANDIDACY) {
      // Clôture anticipée des candidatures -> passage aux votes
      election.candidacyEndDate = new Date();
    } else if (election.phase === ElectionPhase.VOTING) {
      // Clôture anticipée des votes -> résultats
      election.votingEndDate = new Date();
    }

    await election.save();
    const updated = await checkAndProgressElection(election);

    return json(updated, 200);
  },
  { roles: [Role.ADMIN] }
);

