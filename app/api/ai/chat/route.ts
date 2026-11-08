import { randomUUID } from "crypto";
import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import { HttpError, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser, getResidentResidenceIds, getSyndicResidenceIds, getTechnicianResidenceIds } from "@/lib/auth-guard";
import { answerIncidentQuestion } from "@/lib/ai/incident-assistant";
import { chatInputSchema } from "@/lib/ai/schemas";
import { AIConversation } from "@/models/AIConversation";
import { Announcement } from "@/models/Announcement";
import { Incident } from "@/models/Incident";
import { Residence } from "@/models/Residence";
import { Role } from "@/types/enums";
import { publishedAnnouncementFilter } from "@/lib/announcements/visibility";

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { message, conversationId: requestedId } = await parseBody(req, chatInputSchema);
  const conversationId = requestedId || randomUUID();
  const residenceIds = user.role === Role.ADMIN ? null
    : user.role === Role.SYNDIC ? await getSyndicResidenceIds(user.id)
    : user.role === Role.RESIDENT ? await getResidentResidenceIds(user.id)
    : user.role === Role.TECHNICIAN ? await getTechnicianResidenceIds(user.id)
    : null;
  if (user.role !== Role.ADMIN && !residenceIds) throw new HttpError(403, "Rôle non autorisé");
  await AIConversation.deleteOne({
    user: new mongoose.Types.ObjectId(user.id),
    conversationId,
    expiresAt: { $lte: new Date() },
  });
  await AIConversation.deleteOne({
    user: new mongoose.Types.ObjectId(user.id),
    conversationId,
    role: { $ne: user.role },
  });

  const residenceFilter = residenceIds
    ? { residence: { $in: residenceIds.map((id) => new mongoose.Types.ObjectId(id)) } }
    : {};
  const incidentFilter: Record<string, unknown> = { ...residenceFilter };
  if (user.role === Role.RESIDENT) incidentFilter.reportedBy = new mongoose.Types.ObjectId(user.id);
  if (user.role === Role.TECHNICIAN) incidentFilter.assignedTo = new mongoose.Types.ObjectId(user.id);

  const [incidents, announcements, previous, incidentRollup] = await Promise.all([
    Incident.find(incidentFilter).sort({ reportedAt: -1 }).limit(10)
      .select("title description category priority status reportedAt").lean(),
    Announcement.find({
      ...residenceFilter,
      ...publishedAnnouncementFilter(),
      ...(user.role === Role.RESIDENT
        ? { $or: [{ audience: { $in: ["RESIDENTS", "ALL"] } }, { audience: { $exists: false } }] }
        : user.role === Role.TECHNICIAN
        ? { audience: { $in: ["TECHNICIANS", "ALL"] } }
        : {}),
    }).sort({ publishedAt: -1 }).limit(8).select("title content category priority publishedAt").lean(),
    AIConversation.findOne({
      user: new mongoose.Types.ObjectId(user.id),
      conversationId,
      role: user.role,
      expiresAt: { $gt: new Date() },
    }).lean(),
    user.role === Role.ADMIN || user.role === Role.SYNDIC
      ? Incident.aggregate([
          { $match: residenceIds ? { residence: { $in: residenceIds.map((id) => new mongoose.Types.ObjectId(id)) } } : {} },
          { $facet: {
            overview: [{ $group: {
              _id: null,
              total: { $sum: 1 },
              open: { $sum: { $cond: [{ $ne: ["$status", "RESOLVED"] }, 1, 0] } },
              urgent: { $sum: { $cond: [{ $eq: ["$priority", "URGENT"] }, 1, 0] } },
            } }],
            byCategory: [{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }],
            byResidence: [{ $group: { _id: "$residence", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 50 }],
            technicianWorkload: [
              { $match: { assignedTo: { $exists: true, $ne: null } } },
              { $group: {
                _id: "$assignedTo",
                assignedCount: { $sum: 1 },
                openCount: { $sum: { $cond: [{ $ne: ["$status", "RESOLVED"] }, 1, 0] } },
              } },
              { $sort: { openCount: -1 } },
              { $limit: 20 },
              { $project: { _id: 0, assignedCount: 1, openCount: 1 } },
            ],
            monthlyTrend: [
              { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$reportedAt" } }, count: { $sum: 1 } } },
              { $sort: { _id: 1 } },
              { $limit: 12 },
            ],
          } },
        ])
      : Promise.resolve([]),
  ]);
  const history = (previous?.messages ?? []).slice(-8).map((item) => ({
    role: item.role,
    content: item.content.slice(0, 1200),
  }));
  const rollup = incidentRollup[0];
  const residenceRows = rollup?.byResidence ?? [];
  const rollupResidenceNames = residenceRows.length
    ? await Residence.find({
        _id: { $in: residenceRows.map((item: { _id: mongoose.Types.ObjectId }) => item._id) },
      }).select("name").lean()
    : [];
  const residenceNameById = new Map(rollupResidenceNames.map((item) => [String(item._id), item.name]));
  const incidentSummary = rollup ? {
    overview: rollup.overview[0] ?? { total: 0, open: 0, urgent: 0 },
    byCategory: rollup.byCategory,
    byResidence: residenceRows.map((item: { _id: mongoose.Types.ObjectId; count: number }) => ({
      residence: residenceNameById.get(String(item._id)) ?? "Residence",
      incidentCount: item.count,
    })),
    technicianWorkload: rollup.technicianWorkload,
    monthlyTrend: rollup.monthlyTrend,
  } : undefined;
  const context = {
    role: user.role,
    incidentSummary,
    incidents: incidents.map((item) => ({
      title: item.title,
      description: item.description.slice(0, 500),
      category: item.category,
      priority: item.priority,
      status: item.status,
      reportedAt: item.reportedAt,
    })),
    announcements: announcements.map((item) => ({
      title: item.title,
      content: item.content.slice(0, 500),
      category: item.category,
      priority: item.priority,
      publishedAt: item.publishedAt,
    })),
  };
  const result = await answerIncidentQuestion(user.id, user.role, message, context, history);
  const newMessages = [
    { role: "user" as const, content: message.slice(0, 1200), createdAt: new Date() },
    { role: "model" as const, content: result.answer, createdAt: new Date() },
  ];
  await AIConversation.findOneAndUpdate(
    { user: new mongoose.Types.ObjectId(user.id), conversationId, role: user.role },
    {
      $setOnInsert: { user: new mongoose.Types.ObjectId(user.id), conversationId, role: user.role },
      $set: { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      $push: { messages: { $each: newMessages, $slice: -8 } },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return json({ answer: result.answer, conversationId });
});
