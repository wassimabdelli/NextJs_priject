import type { NextRequest } from "next/server";
import { HttpError, json, parseBody } from "@/lib/api";
import {
  withAuth,
  getResidentResidenceIds,
  getSyndicResidenceIds,
  type AuthUser,
} from "@/lib/auth-guard";
import { Election } from "@/models/Election";
import { Residence } from "@/models/Residence";
import { Announcement } from "@/models/Announcement";
import { electionCreateSchema } from "@/lib/validations/election";
import { Role, ElectionPhase } from "@/types/enums";
import { checkAndProgressElection } from "@/lib/elections/workflow";

/**
 * GET /api/elections
 * Liste les élections selon la résidence de l'utilisateur.
 * Rôles autorisés : ADMIN, SYNDIC, OWNER (Strictement interdit à TENANT).
 */
export const GET = withAuth(
  async (req: NextRequest, user: AuthUser) => {
    if (user.role === Role.TENANT) {
      throw new HttpError(403, "Les locataires n'ont pas accès aux élections du syndic");
    }

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));
    const residenceId = searchParams.get("residence");

    const query: Record<string, any> = {};

    if (user.role === Role.ADMIN) {
      if (residenceId) query.residence = residenceId;
    } else if (user.role === Role.SYNDIC) {
      const myResidences = await getSyndicResidenceIds(user.id);
      query.residence = residenceId && myResidences.includes(residenceId) ? residenceId : { $in: myResidences };
    } else if (user.role === Role.OWNER) {
      const myResidences = await getResidentResidenceIds(user.id);
      query.residence = residenceId && myResidences.includes(residenceId) ? residenceId : { $in: myResidences };
    }

    const skip = (page - 1) * limit;
    const elections = await Election.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("residence", "name city address")
      .populate("createdBy", "name email");

    // Progression automatique des phases selon la date
    const updatedElections = await Promise.all(
      elections.map((e) => checkAndProgressElection(e))
    );

    const total = await Election.countDocuments(query);

    return json({
      data: updatedElections,
      meta: {
        page,
        limit,
        total,
      },
    });
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.OWNER] }
);

/**
 * POST /api/elections
 * Lance une nouvelle élection pour une résidence (Phase 0 -> Phase 1).
 * Rôles autorisés : ADMIN (et SYNDIC).
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthUser) => {
    if (user.role !== Role.ADMIN && user.role !== Role.SYNDIC) {
      throw new HttpError(403, "Seul un administrateur peut lancer une élection de syndic");
    }

    const body = await parseBody(req, electionCreateSchema);

    const residence = await Residence.findById(body.residence);
    if (!residence) {
      throw new HttpError(404, "Résidence introuvable");
    }

    // Vérifie qu'il n'y a pas déjà une élection en cours (CANDIDACY ou VOTING)
    const activeElection = await Election.findOne({
      residence: body.residence,
      phase: { $in: [ElectionPhase.CANDIDACY, ElectionPhase.VOTING] },
    });
    if (activeElection) {
      throw new HttpError(409, "Une élection est déjà en cours pour cette résidence");
    }

    const candidacyEndStr = new Date(body.candidacyEndDate).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const votingEndStr = new Date(body.votingEndDate).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const election = await Election.create({
      residence: body.residence,
      title: body.title,
      createdBy: user.id,
      phase: ElectionPhase.CANDIDACY,
      candidacyEndDate: body.candidacyEndDate,
      votingEndDate: body.votingEndDate,
      candidates: [],
      announcements: {
        candidacyAnnounced: true,
        votingAnnounced: false,
        resultsAnnounced: false,
      },
    });

    // Création automatique de l'annonce d'ouverture
    await Announcement.create({
      residence: body.residence,
      author: user.id,
      title: `🗳️ ${body.title} : Appel à candidatures`,
      content: `L'élection du nouveau syndic de la résidence est officiellement lancée. Les copropriétaires souhaitant postuler peuvent déposer leur candidature jusqu'au ${candidacyEndStr}. La période de vote débutera immédiatement après pour s'achever le ${votingEndStr}.`,
      isPinned: true,
      publishedAt: new Date(),
    });

    const populated = await Election.findById(election._id)
      .populate("residence", "name city address")
      .populate("createdBy", "name email");

    return json(populated, 201);
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);

