import mongoose, { type PipelineStage } from "mongoose";
import type { NextRequest } from "next/server";
import { HttpError, json, parseBody } from "@/lib/api";
import { getAnnouncementResidenceIds } from "@/lib/announcements/access";
import { explainManagementReport } from "@/lib/ai/management-reports";
import { reportInputSchema } from "@/lib/ai/schemas";
import { getEligibleResidentIdsByResidence, getReadCountsByAnnouncement } from "@/lib/announcements/readStats";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Announcement } from "@/models/Announcement";
import { Residence } from "@/models/Residence";
import { AnnouncementAudience, AnnouncementStatus, Role } from "@/types/enums";

function rangeDate(value?: string, end = false) {
  if (!value) return undefined;
  const parsed = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new HttpError(400, "Période de dates invalide");
  return parsed;
}

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (user.role !== Role.ADMIN && user.role !== Role.SYNDIC) throw new HttpError(403, "Rapports réservés à ADMIN et SYNDIC");
  const input = await parseBody(req, reportInputSchema);
  const from = rangeDate(input.from);
  const to = rangeDate(input.to, true);
  if (from && to && from > to) throw new HttpError(400, "La date de début doit précéder la date de fin");
  const residenceIds = await getAnnouncementResidenceIds(user);
  if (!residenceIds && user.role !== Role.ADMIN) throw new HttpError(403, "Aucune résidence autorisée");
  const baseMatch: Record<string, unknown> = {};
  if (residenceIds) baseMatch.residence = { $in: residenceIds.map((id) => new mongoose.Types.ObjectId(id)) };
  if (from || to) baseMatch.publishedAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };

  const [byStatus, byCategory, byResidence] = await Promise.all([
    Announcement.aggregate([
      { $match: baseMatch as PipelineStage.Match["$match"] },
      { $group: { _id: { $ifNull: ["$status", AnnouncementStatus.PUBLISHED] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Announcement.aggregate([
      { $match: baseMatch as PipelineStage.Match["$match"] },
      { $group: { _id: { $ifNull: ["$category", "GENERAL"] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Announcement.aggregate([
      { $match: baseMatch as PipelineStage.Match["$match"] },
      { $group: { _id: "$residence", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]),
  ]);
  const now = new Date();
  const readMatch: Record<string, unknown> = {
    ...baseMatch,
    $and: [
      { $or: [{ status: AnnouncementStatus.PUBLISHED }, { status: { $exists: false } }] },
      { $or: [{ audience: { $in: [AnnouncementAudience.RESIDENTS, AnnouncementAudience.ALL] } }, { audience: { $exists: false } }] },
      { $or: [{ scheduledAt: null }, { scheduledAt: { $exists: false } }, { scheduledAt: { $lte: now } }] },
      { $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] },
    ],
  };
  const eligibleAnnouncements = await Announcement.find(readMatch).select("_id residence").lean();
  const residenceKeys = [...new Set(eligibleAnnouncements.map((item) => String(item.residence)))];
  const eligibleByResidence = await getEligibleResidentIdsByResidence(residenceKeys);
  const readCounts = await getReadCountsByAnnouncement(eligibleAnnouncements.map((item) => ({
    id: String(item._id),
    residenceId: String(item.residence),
  })), eligibleByResidence);
  let eligibleReads = 0;
  let readCount = 0;
  const readsByResidence = new Map<string, { eligible: number; read: number }>();
  for (const item of eligibleAnnouncements) {
    const residenceId = String(item.residence);
    const eligible = eligibleByResidence.get(residenceId)?.size ?? 0;
    const reads = Math.min(readCounts.get(String(item._id)) ?? 0, eligible);
    eligibleReads += eligible;
    readCount += reads;
    const row = readsByResidence.get(residenceId) ?? { eligible: 0, read: 0 };
    row.eligible += eligible;
    row.read += reads;
    readsByResidence.set(residenceId, row);
  }
  const unreadCount = Math.max(0, eligibleReads - readCount);
  const residenceNames = await Residence.find({
    _id: { $in: byResidence.map((item) => item._id) },
  }).select("name").lean();
  const residenceNameById = new Map(residenceNames.map((item) => [String(item._id), item.name]));
  const result = await explainManagementReport(user.id, "announcements", {
    scope: user.role === Role.ADMIN ? "global" : "managed residences",
    period: { from: input.from ?? null, to: input.to ?? null },
    total: byStatus.reduce((sum, item) => sum + item.count, 0),
    byStatus: byStatus.map((row) => ({ status: row._id, count: row.count })),
    byCategory: byCategory.map((row) => ({ category: row._id, count: row.count })),
    readStatistics: {
      eligibleResidentImpressions: eligibleReads,
      readCount,
      unreadCount,
      readPercentage: eligibleReads ? Math.round((readCount / eligibleReads) * 100) : 0,
      announcementCount: eligibleAnnouncements.length,
    },
    residenceComparisons: byResidence.map((row) => {
      const readership = readsByResidence.get(String(row._id)) ?? { eligible: 0, read: 0 };
      return {
        residence: residenceNameById.get(String(row._id)) ?? "Residence",
        announcementCount: row.count,
        readCount: readership.read,
        eligibleReadCount: readership.eligible,
        readPercentage: readership.eligible ? Math.round((readership.read / readership.eligible) * 100) : 0,
      };
    }),
  });
  return json(result);
});
