import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import { withAuth, getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { JoinRequest, JoinRequestStatus } from "@/models/JoinRequest";
import { joinRequestRejectSchema } from "@/lib/validations/join-request";
import { Role } from "@/types/enums";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * PATCH /api/join-requests/[id]/reject
 * Refuse une demande de rattachement avec motif facultatif.
 * Rôles autorisés : ADMIN, SYNDIC
 */
export const PATCH = withAuth(
  async (req: NextRequest, user: AuthUser, context?: unknown) => {
    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) {
      throw new HttpError(400, "Identifiant de demande invalide");
    }

    const body = await parseBody(req, joinRequestRejectSchema).catch(() => ({}));

    const request = await JoinRequest.findById(id);
    if (!request) {
      throw new HttpError(404, "Demande introuvable");
    }

    if (request.status !== JoinRequestStatus.PENDING) {
      throw new HttpError(400, "Cette demande a déjà été traitée");
    }

    if (user.role === Role.SYNDIC) {
      const syndicResidences = await getSyndicResidenceIds(user.id);
      if (!syndicResidences.includes(request.residence.toString())) {
        throw new HttpError(403, "Vous n'administrez pas la résidence concernée");
      }
    }

    request.status = JoinRequestStatus.REJECTED;
    const { rejectionReason } = body as { rejectionReason?: string };
    if (rejectionReason) {
      request.rejectionReason = rejectionReason;
    }
    request.reviewedBy = user.id as any;
    request.reviewedAt = new Date();
    await request.save();

    const populated = await JoinRequest.findById(request._id)
      .populate("residence", "name address city")
      .populate("user", "name email phone")
      .populate("reviewedBy", "name email")
      .lean();

    return json(populated, 200);
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);

