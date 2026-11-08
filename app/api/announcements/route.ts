import type { NextRequest } from "next/server";
import mongoose, { type PipelineStage } from "mongoose";
import { HttpError, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { getAnnouncementResidenceIds } from "@/lib/announcements/access";
import { publishedAnnouncementFilter } from "@/lib/announcements/visibility";
import { publishDueAnnouncements } from "@/lib/announcements/publication";
import AnnouncementRead from "@/models/AnnouncementRead";
import { Announcement } from "@/models/Announcement";
import { Residence } from "@/models/Residence";
import { getEligibleResidentIdsByResidence, getReadCountsByAnnouncement } from "@/lib/announcements/readStats";
import { notifyAnnouncementPublished } from "@/lib/notifications/events";
import {
  announcementCreateSchema,
  announcementListQuerySchema,
} from "@/lib/validations/announcement";
import { Role, AnnouncementStatus } from "@/types/enums";

function validDate(value: string | undefined, end = false) {
  if (!value) return undefined;
  const parsed = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, "Période de dates invalide");
  }
  return parsed;
}

function safeSearch(value: string) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function relationId(value: unknown) {
  if (value && typeof value === "object" && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const parsed = announcementListQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) throw new HttpError(400, "Filtres invalides", parsed.error.flatten());
  const query = parsed.data;
  const residenceIds = await getAnnouncementResidenceIds(user);
  await publishDueAnnouncements(residenceIds);
  const conditions: Record<string, unknown>[] = [];

  if (residenceIds) {
    conditions.push({
      residence: { $in: residenceIds.map((id) => new mongoose.Types.ObjectId(id)) },
    });
  }
  if (query.residence) {
    if (residenceIds && !residenceIds.includes(query.residence)) {
      throw new HttpError(403, "Vous n'avez pas accès à cette résidence");
    }
    conditions.push({ residence: new mongoose.Types.ObjectId(query.residence) });
  }

  if (user.role === Role.ADMIN || user.role === Role.SYNDIC) {
    const now = new Date();
    if (query.status === "EXPIRED") {
      conditions.push({
        $and: [
          { $or: [{ status: AnnouncementStatus.PUBLISHED }, { status: { $exists: false } }] },
          { $or: [{ scheduledAt: null }, { scheduledAt: { $exists: false } }, { scheduledAt: { $lte: now } }] },
          { expiresAt: { $lte: now } },
        ],
      });
    } else if (query.status) {
      conditions.push(query.status === AnnouncementStatus.PUBLISHED
        ? {
            $and: [
              { $or: [{ status: AnnouncementStatus.PUBLISHED }, { status: { $exists: false } }] },
              { $or: [{ scheduledAt: null }, { scheduledAt: { $exists: false } }, { scheduledAt: { $lte: now } }] },
              { $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] },
            ],
          }
        : { status: query.status });
    }
    if (query.audience) conditions.push({ audience: query.audience });
  } else {
    conditions.push(publishedAnnouncementFilter());
    conditions.push(user.role === Role.RESIDENT
      ? {
          $or: [
            { audience: { $in: ["RESIDENTS", "ALL"] } },
            { audience: { $exists: false } },
          ],
        }
      : { audience: { $in: ["TECHNICIANS", "ALL"] } });
  }

  if (query.category) conditions.push({ category: query.category });
  if (query.priority) conditions.push({ priority: query.priority });
  const from = validDate(query.from);
  const to = validDate(query.to, true);
  if (from && to && from > to) throw new HttpError(400, "La date de début doit précéder la date de fin");
  if (from || to) {
    const dateRange = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
    conditions.push({
      $or: [
        { publishedAt: dateRange },
        { scheduledAt: dateRange },
      ],
    });
  }
  if (query.q) {
    const regex = safeSearch(query.q);
    conditions.push({ $or: [{ title: regex }, { content: regex }] });
  }

  if (user.role === Role.RESIDENT && query.read) {
    const readIds = await AnnouncementRead.distinct("announcement", { resident: user.id });
    conditions.push(query.read === "true"
      ? { _id: { $in: readIds } }
      : { _id: { $nin: readIds } });
  }

  const filter = conditions.length ? { $and: conditions } : {};
  const [announcements, total] = await Promise.all([
    (async () => {
      if (query.sort === "priority") {
        const ordered = await Announcement.aggregate<{ _id: mongoose.Types.ObjectId }>([
          { $match: filter as PipelineStage.Match["$match"] },
          {
            $addFields: {
              priorityRank: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$priority", "URGENT"] }, then: 4 },
                    { case: { $eq: ["$priority", "HIGH"] }, then: 3 },
                    { case: { $eq: ["$priority", "NORMAL"] }, then: 2 },
                  ],
                  default: 1,
                },
              },
            },
          },
          { $sort: { isPinned: -1, priorityRank: -1, publishedAt: -1 } },
          { $skip: (query.page - 1) * query.limit },
          { $limit: query.limit },
          { $project: { _id: 1 } },
        ]);
        if (!ordered.length) return [];
        const results = await Announcement.find({ _id: { $in: ordered.map((item) => item._id) } })
          .populate({ path: "author", select: "name" })
          .populate({ path: "residence", select: "name city" })
          .lean();
        const byId = new Map(results.map((item) => [String(item._id), item]));
        return ordered.map((item) => byId.get(String(item._id))).filter((item) => item !== undefined);
      }
      const sort: Record<string, 1 | -1> = query.sort === "oldest"
        ? { isPinned: -1, publishedAt: 1 }
        : { isPinned: -1, publishedAt: -1 };
      return Announcement.find(filter)
        .sort(sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate({ path: "author", select: "name" })
        .populate({ path: "residence", select: "name city" })
        .lean();
    })(),
    Announcement.countDocuments(filter),
  ]);
  const readIds = user.role === Role.RESIDENT
    ? new Set((await AnnouncementRead.distinct("announcement", {
        resident: user.id,
        announcement: { $in: announcements.map((item) => item._id) },
      })).map(String))
    : new Set<string>();
  const canViewReadStats = user.role === Role.ADMIN || user.role === Role.SYNDIC;
  const residenceKeys = canViewReadStats
    ? [...new Set(announcements.map((item) => relationId(item.residence)))]
    : [];
  const eligibleByResidence = canViewReadStats
    ? await getEligibleResidentIdsByResidence(residenceKeys)
    : new Map<string, Set<string>>();
  const readCounts = canViewReadStats
    ? await getReadCountsByAnnouncement(announcements.map((item) => ({
        id: String(item._id),
        residenceId: relationId(item.residence),
      })), eligibleByResidence)
    : new Map<string, number>();

  return json({
    data: announcements.map((item) => ({
      ...item,
      category: item.category ?? "GENERAL",
      priority: item.priority ?? "NORMAL",
      audience: item.audience ?? "RESIDENTS",
      status: item.status ?? AnnouncementStatus.PUBLISHED,
      attachments: item.attachments ?? [],
      isRead: readIds.has(String(item._id)),
      readStats: canViewReadStats
        ? (() => {
            const audience = item.audience ?? "RESIDENTS";
            const eligible = audience === "TECHNICIANS"
              ? 0
              : eligibleByResidence.get(relationId(item.residence))?.size ?? 0;
            const reads = Math.min(readCounts.get(String(item._id)) ?? 0, eligible);
            return {
              totalEligibleResidents: eligible,
              readCount: reads,
              unreadCount: Math.max(0, eligible - reads),
              readPercentage: eligible ? Math.round((reads / eligible) * 100) : 0,
            };
          })()
        : undefined,
    })),
    meta: { page: query.page, limit: query.limit, total },
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (user.role !== Role.ADMIN && user.role !== Role.SYNDIC) {
    throw new HttpError(403, "Seuls ADMIN et SYNDIC peuvent créer une annonce");
  }
  const body = await parseBody(req, announcementCreateSchema);
  const residenceIds = await getAnnouncementResidenceIds(user);
  if (residenceIds && !residenceIds.includes(body.residence)) {
    throw new HttpError(403, "Vous ne gérez pas cette résidence");
  }
  const residence = await Residence.exists({ _id: body.residence });
  if (!residence) throw new HttpError(404, "Résidence introuvable");

  const scheduledAt = body.status === AnnouncementStatus.SCHEDULED ? body.scheduledAt : null;
  const publishedAt = body.status === AnnouncementStatus.PUBLISHED
    ? new Date()
    : scheduledAt ?? new Date();
  const announcement = await Announcement.create({
    ...body,
    author: user.id,
    publishedAt,
    scheduledAt,
  });
  if (announcement.status === AnnouncementStatus.PUBLISHED && announcement.publishedAt <= new Date()) {
    await notifyAnnouncementPublished(
      announcement,
      `announcement:${announcement._id}:published:${announcement.publishedAt.toISOString()}`,
      user.id
    );
  }
  return json(announcement, 201);
});
