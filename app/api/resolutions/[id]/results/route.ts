import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json } from "@/lib/api";
import { withAuth, type AuthUser, getSyndicResidenceIds, getResidentResidenceIds } from "@/lib/auth-guard";
import { Resolution } from "@/models/Resolution";
import { Meeting } from "@/models/Meeting";
import { Apartment } from "@/models/Apartment";
import { Vote } from "@/models/Vote";
import { Role } from "@/types/enums";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * GET /api/resolutions/[id]/results
 * Renvoie le dépouillement complet et pondéré d'une résolution :
 * - Totaux pondérés : FOR, AGAINST, ABSTAIN
 * - Adoptée : oui / non (selon requiredMajority)
 * - Quorum atteint : oui / non (selon les tantièmes de l'AG)
 */
export const GET = withAuth(
  async (req: NextRequest, user: AuthUser, context?: unknown) => {
    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) {
      throw new HttpError(400, "Identifiant de résolution invalide");
    }

    const resolution = await Resolution.findById(id);
    if (!resolution) {
      throw new HttpError(404, "Résolution introuvable");
    }

    const meeting = await Meeting.findById(resolution.meeting);
    if (!meeting) {
      throw new HttpError(404, "Assemblée générale introuvable");
    }

    // Contrôle d'accès au niveau résidence
    if (user.role === Role.SYNDIC) {
      const syndicRes = await getSyndicResidenceIds(user.id);
      if (!syndicRes.includes(meeting.residence.toString())) {
        throw new HttpError(403, "Vous n'administrez pas cette résidence");
      }
    } else if (user.role === Role.RESIDENT) {
      const resRes = await getResidentResidenceIds(user.id);
      if (!resRes.includes(meeting.residence.toString())) {
        throw new HttpError(403, "Vous ne faites pas partie de cette résidence");
      }
    }

    // Calculs pondérés
    const tally = await resolution.countVotes();
    const isAdopted = await resolution.isAdopted();
    const isQuorumReached = await meeting.isQuorumReached();

    const expressedVotes = tally.FOR + tally.AGAINST;
    const totalVotedWeight = tally.FOR + tally.AGAINST + tally.ABSTAIN;
    const approvalRate = expressedVotes > 0 ? (tally.FOR / expressedVotes) * 100 : 0;

    // Récupération des totaux de copropriété pour contexte
    const totalShares = await Apartment.totalShares(meeting.residence);
    const resolutionIds = await Resolution.find({ meeting: meeting._id }).distinct("_id");
    const votingApartmentIds = await Vote.find({ resolution: { $in: resolutionIds } }).distinct("apartment");
    const [presentRow] = await Apartment.aggregate<{ total: number }>([
      { $match: { _id: { $in: votingApartmentIds } } },
      { $group: { _id: null, total: { $sum: "$shares" } } },
    ]);
    const presentShares = presentRow?.total ?? 0;

    // Nombre de bulletins physiques/enregistrés
    const voteCount = await Vote.countDocuments({ resolution: resolution._id });

    return json(
      {
        resolution: {
          _id: resolution._id,
          title: resolution.title,
          description: resolution.description,
          requiredMajority: resolution.requiredMajority,
          meeting: resolution.meeting,
        },
        tally,
        expressedVotes,
        totalVotedWeight,
        approvalRate: Math.round(approvalRate * 100) / 100,
        isAdopted,
        isQuorumReached,
        quorum: {
          totalShares,
          presentShares,
          percentage: totalShares > 0 ? Math.round((presentShares / totalShares) * 10000) / 100 : 0,
          requiredPercentage: 50,
        },
        voteCount,
      },
      200
    );
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT] }
);
