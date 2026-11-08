import type { NextRequest } from "next/server";
import { HttpError, isDuplicateKeyError, isValidObjectId, json } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { canReadAnnouncement, getAnnouncementResidenceIds } from "@/lib/announcements/access";
import { publishDueAnnouncements } from "@/lib/announcements/publication";
import { Announcement } from "@/models/Announcement";
import AnnouncementRead from "@/models/AnnouncementRead";
import { Role } from "@/types/enums";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withAuth(async (_req: NextRequest, user: AuthUser, context?: RouteContext) => {
  if ((user.role !== Role.OWNER && user.role !== Role.TENANT)) throw new HttpError(403, "Seuls les résidents peuvent confirmer la lecture");
  const { id } = await (context?.params ?? Promise.resolve({ id: "" }));
  if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant invalide");
  const residenceIds = await getAnnouncementResidenceIds(user);
  await publishDueAnnouncements(residenceIds);
  const announcement = await Announcement.findById(id).lean();
  if (!announcement) throw new HttpError(404, "Annonce introuvable");
  if (!canReadAnnouncement(user, announcement, residenceIds)) {
    throw new HttpError(404, "Annonce introuvable");
  }
  let read;
  try {
    read = await AnnouncementRead.findOneAndUpdate(
      { announcement: announcement._id, resident: user.id },
      { $setOnInsert: { announcement: announcement._id, resident: user.id, readAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    read = await AnnouncementRead.findOne({ announcement: announcement._id, resident: user.id }).lean();
  }
  return json({ announcementId: id, readAt: read?.readAt ?? new Date() });
});
