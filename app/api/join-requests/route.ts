import type { NextRequest } from "next/server";
import { HttpError, json, parseBody } from "@/lib/api";
import { withAuth, getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { JoinRequest, JoinRequestStatus } from "@/models/JoinRequest";
import { Residence } from "@/models/Residence";
import { joinRequestCreateSchema } from "@/lib/validations/join-request";
import { Role } from "@/types/enums";

/**
 * GET /api/join-requests
 * Liste les demandes de rattachement.
 * - ADMIN : toutes les demandes
 * - SYNDIC : demandes pour les résidences gérées
 * - OWNER / TENANT : ses propres demandes
 */
export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));
  const statusParam = searchParams.get("status");

  const query: Record<string, any> = {};
  if (statusParam && Object.values(JoinRequestStatus).includes(statusParam as any)) {
    query.status = statusParam;
  }

  if (user.role === Role.ADMIN) {
    // Tout voir
  } else if (user.role === Role.SYNDIC) {
    const residenceIds = await getSyndicResidenceIds(user.id);
    query.residence = { $in: residenceIds };
  } else {
    // Résident / Propriétaire / Locataire : uniquement ses demandes
    query.user = user.id;
  }

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    JoinRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("residence", "name address city")
      .populate("user", "name email phone")
      .populate("reviewedBy", "name email")
      .lean(),
    JoinRequest.countDocuments(query),
  ]);

  return json({
    data,
    meta: {
      page,
      limit,
      total,
    },
  });
});

/**
 * POST /api/join-requests
 * Crée une nouvelle demande de rattachement à une résidence.
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthUser) => {
    const body = await parseBody(req, joinRequestCreateSchema);

    const residence = await Residence.findById(body.residence).lean();
    if (!residence) {
      throw new HttpError(404, "Résidence introuvable");
    }

    const existing = await JoinRequest.findOne({
      user: user.id,
      residence: body.residence,
      status: JoinRequestStatus.PENDING,
    });
    if (existing) {
      throw new HttpError(409, "Une demande de rattachement est déjà en attente pour cette résidence");
    }

    const requestedRole = user.role === Role.TENANT ? Role.TENANT : Role.OWNER;

    const request = await JoinRequest.create({
      user: user.id,
      residence: body.residence,
      apartmentNumber: body.apartmentNumber,
      requestedRole,
      residentType: body.residentType,
      message: body.message,
      status: JoinRequestStatus.PENDING,
    });

    const populated = await JoinRequest.findById(request._id)
      .populate("residence", "name address city")
      .populate("user", "name email phone")
      .lean();

    return json(populated, 201);
  },
  { roles: [Role.OWNER, Role.TENANT, Role.ADMIN, Role.SYNDIC] }
);

