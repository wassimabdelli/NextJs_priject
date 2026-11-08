import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { canManageAnnouncement, getAnnouncementResidenceIds } from "@/lib/announcements/access";
import { getAnnouncementReadStats } from "@/lib/announcements/readStats";
import { Announcement } from "@/models/Announcement";
import { AnnouncementAudience, Role } from "@/types/enums";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withAuth(async (_req: NextRequest, user: AuthUser, context?: RouteContext) => {
  if (user.role !== Role.ADMIN && user.role !== Role.SYNDIC) {
    throw new HttpError(403, "Statistiques réservées à ADMIN et SYNDIC");
  }
  const { id } = await (context?.params ?? Promise.resolve({ id: "" }));
  if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant invalide");
  const announcement = await Announcement.findById(id).select("residence audience").lean();
  if (!announcement) throw new HttpError(404, "Annonce introuvable");
  const residenceIds = await getAnnouncementResidenceIds(user);
  if (!canManageAnnouncement(user, announcement, residenceIds)) {
    throw new HttpError(404, "Annonce introuvable");
  }
  if (announcement.audience && announcement.audience === AnnouncementAudience.TECHNICIANS) {
    return json({
      totalEligibleResidents: 0,
      readCount: 0,
      unreadCount: 0,
      readPercentage: 0,
    });
  }
  return json(await getAnnouncementReadStats(id, String(announcement.residence)));
});
