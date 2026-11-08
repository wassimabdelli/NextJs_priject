import mongoose from "mongoose";
import type { PipelineStage } from "mongoose";
import type { NextRequest } from "next/server";
import { HttpError, json } from "@/lib/api";
import { getAnnouncementResidenceIds } from "@/lib/announcements/access";
import { publishDueAnnouncements } from "@/lib/announcements/publication";
import { getEligibleResidentIdsByResidence, getReadCountsByAnnouncement } from "@/lib/announcements/readStats";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Announcement } from "@/models/Announcement";
import { Residence } from "@/models/Residence";
import { AnnouncementStatus, Role } from "@/types/enums";

interface StatsAnnouncementRow {
  _id: mongoose.Types.ObjectId;
  residence: mongoose.Types.ObjectId;
}

export const GET = withAuth(async (_req: NextRequest, user: AuthUser) => {
  if (user.role !== Role.ADMIN && user.role !== Role.SYNDIC) {
    throw new HttpError(403, "Statistiques réservées à ADMIN et SYNDIC");
  }
  const residenceIds = await getAnnouncementResidenceIds(user);
  if (!residenceIds && user.role !== Role.ADMIN) throw new HttpError(403, "Accès interdit");
  await publishDueAnnouncements(residenceIds);
  const filter = residenceIds
    ? { residence: { $in: residenceIds.map((id) => new mongoose.Types.ObjectId(id)) } }
    : {};
  const now = new Date();
  const rows = await Announcement.aggregate([
    { $match: filter as PipelineStage.Match["$match"] },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        published: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $or: [{ $eq: ["$status", AnnouncementStatus.PUBLISHED] }, { $eq: [{ $type: "$status" }, "missing"] }] },
                  { $or: [{ $eq: [{ $ifNull: ["$scheduledAt", null] }, null] }, { $lte: ["$scheduledAt", now] }] },
                  { $or: [{ $eq: [{ $ifNull: ["$expiresAt", null] }, null] }, { $gt: ["$expiresAt", now] }] },
                ],
              },
              1,
              0,
            ],
          },
        },
        scheduled: { $sum: { $cond: [{ $eq: ["$status", AnnouncementStatus.SCHEDULED] }, 1, 0] } },
        drafts: { $sum: { $cond: [{ $eq: ["$status", AnnouncementStatus.DRAFT] }, 1, 0] } },
        expired: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $or: [{ $eq: ["$status", AnnouncementStatus.PUBLISHED] }, { $eq: [{ $type: "$status" }, "missing"] }] },
                  { $ne: [{ $ifNull: ["$expiresAt", null] }, null] },
                  { $lte: ["$expiresAt", now] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  const eligibleAnnouncementFilter: Record<string, unknown> = {
    ...filter,
    $and: [
      {
        $or: [
          { status: AnnouncementStatus.PUBLISHED },
          { status: { $exists: false } },
        ],
      },
      {
        $or: [
          { audience: { $in: ["RESIDENTS", "ALL"] } },
          { audience: { $exists: false } },
        ],
      },
      { $or: [{ scheduledAt: null }, { scheduledAt: { $exists: false } }, { scheduledAt: { $lte: now } }] },
      { $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] },
    ],
  };
  const published = await Announcement.aggregate<StatsAnnouncementRow>([
    { $match: eligibleAnnouncementFilter as PipelineStage.Match["$match"] },
    { $project: { _id: 1, residence: 1 } },
  ]);
  const publishedResidenceIds = [...new Set(published.map((item) => String(item.residence)))];
  const eligibleByResidence = await getEligibleResidentIdsByResidence(publishedResidenceIds);
  const readsByAnnouncement = await getReadCountsByAnnouncement(published.map((item) => ({
      id: String(item._id),
      residenceId: String(item.residence),
    })), eligibleByResidence);

  const totalsByResidence = new Map<string, { eligible: number; read: number }>();
  let eligibleTotal = 0;
  let readTotal = 0;
  for (const announcement of published) {
    const residenceId = String(announcement.residence);
    const eligible = eligibleByResidence.get(residenceId)?.size ?? 0;
    const reads = Math.min(readsByAnnouncement.get(String(announcement._id)) ?? 0, eligible);
    const total = totalsByResidence.get(residenceId) ?? { eligible: 0, read: 0 };
    total.eligible += eligible;
    total.read += reads;
    totalsByResidence.set(residenceId, total);
    eligibleTotal += eligible;
    readTotal += reads;
  }
  const residenceNames = await Residence.find({
    _id: { $in: [...totalsByResidence.keys()] },
  }).select("name").lean();
  const nameByResidence = new Map(residenceNames.map((item) => [String(item._id), item.name]));

  return json({
    total: rows[0]?.total ?? 0,
    published: rows[0]?.published ?? 0,
    scheduled: rows[0]?.scheduled ?? 0,
    drafts: rows[0]?.drafts ?? 0,
    expired: rows[0]?.expired ?? 0,
    averageReadPercentage: eligibleTotal ? Math.round((readTotal / eligibleTotal) * 100) : 0,
    byResidence: [...totalsByResidence].map(([id, value]) => ({
      residenceId: id,
      residenceName: nameByResidence.get(id) ?? "Résidence",
      readCount: value.read,
      eligibleReadCount: value.eligible,
      readPercentage: value.eligible ? Math.round((value.read / value.eligible) * 100) : 0,
    })),
  });
});
