import mongoose, { type PipelineStage } from "mongoose";
import type { NextRequest } from "next/server";
import { HttpError, json, parseBody } from "@/lib/api";
import { getAnnouncementResidenceIds } from "@/lib/announcements/access";
import { explainManagementReport } from "@/lib/ai/management-reports";
import { reportInputSchema } from "@/lib/ai/schemas";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Incident } from "@/models/Incident";
import { Residence } from "@/models/Residence";
import { IncidentStatus, Role } from "@/types/enums";

function rangeDate(value?: string, end = false) {
  if (!value) return undefined;
  const parsed = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, "Période de dates invalide");
  }
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
  const match: Record<string, unknown> = {};
  if (residenceIds) match.residence = { $in: residenceIds.map((id) => new mongoose.Types.ObjectId(id)) };
  if (from || to) match.reportedAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };

  const [totals, byCategory, byMonth, byTechnician, byResidence] = await Promise.all([
    Incident.aggregate([{
      $match: match as PipelineStage.Match["$match"],
    }, {
      $group: {
        _id: null,
        total: { $sum: 1 },
        open: { $sum: { $cond: [{ $ne: ["$status", IncidentStatus.RESOLVED] }, 1, 0] } },
        urgent: { $sum: { $cond: [{ $eq: ["$priority", "URGENT"] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ["$status", IncidentStatus.RESOLVED] }, 1, 0] } },
        averageResolutionMs: {
          $avg: {
            $cond: [
              { $and: [{ $eq: ["$status", IncidentStatus.RESOLVED] }, { $ne: ["$resolvedAt", null] }] },
              { $subtract: ["$resolvedAt", "$reportedAt"] },
              "$$REMOVE",
            ],
          },
        },
        pendingOverSevenDays: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ["$status", IncidentStatus.RESOLVED] }, { $lt: ["$reportedAt", new Date(Date.now() - 7 * 86400000)] }] },
              1,
              0,
            ],
          },
        },
      },
    }]),
    Incident.aggregate([{ $match: match as PipelineStage.Match["$match"] }, { $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Incident.aggregate([
      { $match: match as PipelineStage.Match["$match"] },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$reportedAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 24 },
    ]),
    Incident.aggregate([
      { $match: { ...match, assignedTo: { $exists: true, $ne: null } } as PipelineStage.Match["$match"] },
      { $group: { _id: "$assignedTo", count: { $sum: 1 }, open: { $sum: { $cond: [{ $ne: ["$status", IncidentStatus.RESOLVED] }, 1, 0] } } } },
      { $sort: { open: -1 } },
      { $limit: 20 },
      { $project: { _id: 0, assignedCount: "$count", openCount: "$open" } },
    ]),
    Incident.aggregate([
      { $match: match as PipelineStage.Match["$match"] },
      { $group: { _id: "$residence", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]),
  ]);
  const residenceNames = byResidence.length
    ? await Residence.find({ _id: { $in: byResidence.map((row) => row._id) } }).select("name").lean()
    : [];
  const residenceNameById = new Map(residenceNames.map((row) => [String(row._id), row.name]));
  const result = await explainManagementReport(user.id, "incidents", {
    scope: user.role === Role.ADMIN ? "global" : "managed residences",
    period: { from: input.from ?? null, to: input.to ?? null },
    metrics: totals[0] ?? { total: 0, open: 0, urgent: 0, resolved: 0, averageResolutionMs: null, pendingOverSevenDays: 0 },
    byCategory: byCategory.map((row) => ({ category: row._id, count: row.count })),
    byResidence: byResidence.map((row) => ({
      residence: residenceNameById.get(String(row._id)) ?? "Residence",
      incidentCount: row.count,
    })),
    monthlyTrend: byMonth.map((row) => ({ month: row._id, count: row.count })),
    technicianWorkload: byTechnician,
    note: "pendingOverSevenDays is an age indicator only; the database has no configured incident due-date/SLA field.",
  });
  return json(result);
});
