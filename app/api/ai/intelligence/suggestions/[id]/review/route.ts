import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import { resolveIntelligenceResidenceScope } from "@/lib/ai-intelligence/access";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { canManageAnnouncement } from "@/lib/announcements/access";
import { Announcement } from "@/models/Announcement";
import { Role } from "@/types/enums";
import { intelligenceReviewSchema } from "@/lib/ai-intelligence/schemas";
import { canTransitionIntelligenceReview } from "@/lib/ai-intelligence/review";

type RouteContext = { params: Promise<{ id: string }> };

export const PATCH = withAuth(
  async (req: NextRequest, user: AuthUser, context?: RouteContext) => {
    const { id } = await (context?.params ?? Promise.resolve({ id: "" }));
    if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant de suggestion invalide");
    const input = await parseBody(req, intelligenceReviewSchema);
    const announcement = await Announcement.findById(id).lean();
    if (!announcement?.intelligenceSource) throw new HttpError(404, "Suggestion introuvable");

    const residenceId = String(announcement.residence);
    const scope = await resolveIntelligenceResidenceScope(user, residenceId);
    if (!canManageAnnouncement(user, announcement, scope)) {
      throw new HttpError(404, "Suggestion introuvable");
    }

    const currentStatus = announcement.intelligenceSource.reviewStatus;
    if (!canTransitionIntelligenceReview(currentStatus, input.status)) {
      throw new HttpError(409, "Cette décision de revue n'est pas autorisée depuis le statut actuel.");
    }

    const updated = await Announcement.findOneAndUpdate(
      { _id: id, "intelligenceSource.reviewStatus": currentStatus },
      { $set: { "intelligenceSource.reviewStatus": input.status } },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) throw new HttpError(409, "La suggestion a été modifiée simultanément. Rechargez-la.");
    return json({ success: true, announcement: updated });
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
