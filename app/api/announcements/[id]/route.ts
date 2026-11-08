import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { canManageAnnouncement, canReadAnnouncement, getAnnouncementResidenceIds } from "@/lib/announcements/access";
import { publishDueAnnouncements } from "@/lib/announcements/publication";
import { Announcement } from "@/models/Announcement";
import { notifyAnnouncementPublished, recordAnnouncementActivity } from "@/lib/notifications/events";
import { announcementUpdateSchema } from "@/lib/validations/announcement";
import { isIntelligenceAnnouncementPublishable } from "@/lib/ai-intelligence/review";
import { AnnouncementStatus, Role } from "@/types/enums";

type RouteContext = { params: Promise<{ id: string }> };

async function loadAnnouncement(context: RouteContext) {
  const { id } = await context.params;
  if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant invalide");
  const announcement = await Announcement.findById(id).lean();
  if (!announcement) throw new HttpError(404, "Annonce introuvable");
  return announcement;
}

export const GET = withAuth(async (_req: NextRequest, user: AuthUser, context?: RouteContext) => {
  if (!context) throw new HttpError(400, "Contexte de route manquant");
  const residenceIds = await getAnnouncementResidenceIds(user);
  await publishDueAnnouncements(residenceIds);
  const announcement = await loadAnnouncement(context);
  if (!canReadAnnouncement(user, announcement, residenceIds)) {
    throw new HttpError(404, "Annonce introuvable");
  }
  const populated = await Announcement.findById(announcement._id)
    .populate({ path: "author", select: "name" })
    .populate({ path: "residence", select: "name city" })
    .lean();
  return json({
    ...populated,
    category: populated?.category ?? "GENERAL",
    priority: populated?.priority ?? "NORMAL",
    audience: populated?.audience ?? "RESIDENTS",
    status: populated?.status ?? AnnouncementStatus.PUBLISHED,
    attachments: populated?.attachments ?? [],
  });
});

export const PATCH = withAuth(async (req: NextRequest, user: AuthUser, context?: RouteContext) => {
  if (user.role !== Role.ADMIN && user.role !== Role.SYNDIC) {
    throw new HttpError(403, "Modification réservée à ADMIN et SYNDIC");
  }
  if (!context) throw new HttpError(400, "Contexte de route manquant");
  const residenceIds = await getAnnouncementResidenceIds(user);
  await publishDueAnnouncements(residenceIds);
  const current = await loadAnnouncement(context);
  if (!canManageAnnouncement(user, current, residenceIds)) {
    throw new HttpError(404, "Annonce introuvable");
  }
  const { id } = await context.params;
  const body = await parseBody(req, announcementUpdateSchema);
  const targetResidence = body.residence ?? String(current.residence);
  if (residenceIds && !residenceIds.includes(targetResidence)) {
    throw new HttpError(403, "Vous ne gérez pas cette résidence");
  }
  const update: Record<string, unknown> = { ...body };
  if (body.residence) update.residence = new mongoose.Types.ObjectId(body.residence);
  const nextStatus = body.status ?? current.status ?? AnnouncementStatus.PUBLISHED;
  if (!isIntelligenceAnnouncementPublishable(current.intelligenceSource, nextStatus)) {
    throw new HttpError(409, "Cette suggestion IA doit être approuvée avant publication ou programmation.");
  }
  const nextScheduledAt = body.scheduledAt !== undefined ? body.scheduledAt : current.scheduledAt;
  const nextExpiresAt = body.expiresAt !== undefined ? body.expiresAt : current.expiresAt;
  if (nextStatus === AnnouncementStatus.SCHEDULED && (!nextScheduledAt || nextScheduledAt <= new Date())) {
    throw new HttpError(400, "La date planifiée doit être dans le futur");
  }
  const publicationTime = nextStatus === AnnouncementStatus.SCHEDULED
    ? nextScheduledAt
    : nextStatus === AnnouncementStatus.PUBLISHED && body.status === AnnouncementStatus.PUBLISHED
    ? new Date()
    : current.publishedAt;
  if (nextExpiresAt && publicationTime && nextExpiresAt <= publicationTime) {
    throw new HttpError(400, "L'expiration doit suivre la publication");
  }
  if (body.status === AnnouncementStatus.PUBLISHED) {
    update.publishedAt = new Date();
    update.scheduledAt = null;
  } else if (body.status === AnnouncementStatus.SCHEDULED) {
    update.publishedAt = nextScheduledAt;
  }
  const shouldNotify = body.status === AnnouncementStatus.PUBLISHED && current.status !== AnnouncementStatus.PUBLISHED;
  const shouldRecordArchive = body.status === AnnouncementStatus.ARCHIVED && current.status !== AnnouncementStatus.ARCHIVED;
  const updateFilter: Record<string, unknown> = { _id: id };
  if (shouldNotify || shouldRecordArchive) {
    if (current.status === undefined) updateFilter.status = { $exists: false };
    else updateFilter.status = current.status;
  }
  const updated = await Announcement.findOneAndUpdate(
    updateFilter,
    { $set: update },
    { new: true, runValidators: true }
  ).populate({ path: "author", select: "name" }).populate({ path: "residence", select: "name city" }).lean();
  if (!updated) {
    if (shouldNotify) throw new HttpError(409, "L'annonce a été modifiée simultanément. Rechargez-la puis réessayez.");
    throw new HttpError(404, "Annonce introuvable");
  }
  if (shouldNotify) {
    await notifyAnnouncementPublished(
      updated,
      `announcement:${updated._id}:published:${new Date(updated.publishedAt).toISOString()}`,
      user.id
    );
  }
  if (shouldRecordArchive) {
    await recordAnnouncementActivity(
      updated,
      "ARCHIVED",
      `announcement:${updated._id}:archived:${new Date(updated.updatedAt ?? new Date()).toISOString()}`,
      user.id
    );
  }
  return json(updated);
});

export const DELETE = withAuth(async (_req: NextRequest, user: AuthUser, context?: RouteContext) => {
  if (user.role !== Role.ADMIN && user.role !== Role.SYNDIC) {
    throw new HttpError(403, "Archivage réservé à ADMIN et SYNDIC");
  }
  if (!context) throw new HttpError(400, "Contexte de route manquant");
  const residenceIds = await getAnnouncementResidenceIds(user);
  await publishDueAnnouncements(residenceIds);
  const announcement = await loadAnnouncement(context);
  if (!canManageAnnouncement(user, announcement, residenceIds)) {
    throw new HttpError(404, "Annonce introuvable");
  }
  const archivedAt = new Date();
  const archiveResult = await Announcement.updateOne(
    { _id: announcement._id, status: { $ne: AnnouncementStatus.ARCHIVED } },
    { $set: { status: AnnouncementStatus.ARCHIVED, scheduledAt: null, updatedAt: archivedAt } }
  );
  if (archiveResult.modifiedCount > 0) {
    await recordAnnouncementActivity(
      announcement,
      "ARCHIVED",
      `announcement:${announcement._id}:archived:${archivedAt.toISOString()}`,
      user.id
    );
  }
  return json({ success: true, status: AnnouncementStatus.ARCHIVED });
});
