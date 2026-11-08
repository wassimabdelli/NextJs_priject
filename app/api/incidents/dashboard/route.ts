import type { NextRequest } from "next/server";
import mongoose, { type PipelineStage } from "mongoose";
import { HttpError, json } from "@/lib/api";
import { withAuth, getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { Incident } from "@/models/Incident";
import { Residence } from "@/models/Residence";
import { Role } from "@/types/enums";
import type { IncidentCategory, IncidentStatus, Priority } from "@/types/enums";
import { incidentDashboardQuerySchema } from "@/lib/validations/incidentDashboard";
import {
  getIncidentStatistics,
  getIncidentsByCategory,
  getIncidentsByStatus,
  getMonthlyIncidentTrends,
  getRecentIncidentActivity,
  getResidenceComparison,
  getTechnicianPerformance,
} from "@/lib/incidents/statistics";

interface DashboardIncidentRow {
  _id: mongoose.Types.ObjectId;
  title: string;
  category: IncidentCategory;
  priority: Priority;
  status: IncidentStatus;
  createdAt: Date;
  residence: { _id: mongoose.Types.ObjectId; name: string } | null;
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, "Période de dates invalide");
  }
  return date;
}

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const query = incidentDashboardQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!query.success) {
    throw new HttpError(400, "Filtres de tableau de bord invalides", query.error.flatten());
  }

  const now = new Date();
  const to = parseDate(query.data.to, true) ?? now;
  if ((query.data.to || now.toISOString().slice(0, 10)) > now.toISOString().slice(0, 10)) {
    throw new HttpError(400, "La date de fin ne peut pas être dans le futur");
  }
  const from = parseDate(query.data.from)
    ?? new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 5, 1));
  if (from > to) throw new HttpError(400, "La date de début doit précéder la date de fin");
  const maxRangeStart = new Date(Date.UTC(
    to.getUTCFullYear() - 5,
    to.getUTCMonth(),
    to.getUTCDate()
  ));
  if (from < maxRangeStart) throw new HttpError(400, "La période ne peut pas dépasser cinq ans");

  const filter: Record<string, unknown> = {
    createdAt: { $gte: from, $lte: to },
  };
  let allowedResidenceIds: string[] | null = null;
  if (user.role === Role.ADMIN) {
    if (query.data.residence) filter.residence = new mongoose.Types.ObjectId(query.data.residence);
  } else if (user.role === Role.SYNDIC) {
    allowedResidenceIds = await getSyndicResidenceIds(user.id);
    if (query.data.residence && !allowedResidenceIds.includes(query.data.residence)) {
      throw new HttpError(403, "Vous n'administrez pas cette résidence");
    }
    filter.residence = query.data.residence
      ? new mongoose.Types.ObjectId(query.data.residence)
      : { $in: allowedResidenceIds.map((id) => new mongoose.Types.ObjectId(id)) };
  } else if (user.role === Role.RESIDENT) {
    filter.reportedBy = new mongoose.Types.ObjectId(user.id);
    if (query.data.residence || query.data.technician) {
      throw new HttpError(403, "Filtres indisponibles pour ce rôle");
    }
  } else if (user.role === Role.TECHNICIAN) {
    filter.assignedTo = new mongoose.Types.ObjectId(user.id);
    if (query.data.residence || query.data.technician) {
      throw new HttpError(403, "Filtres indisponibles pour ce rôle");
    }
  } else {
    throw new HttpError(403, "Accès interdit");
  }

  if (query.data.technician && (user.role === Role.ADMIN || user.role === Role.SYNDIC)) {
    filter.assignedTo = new mongoose.Types.ObjectId(query.data.technician);
  }

  const recentFilter = { ...filter };
  const priorityFilter = {
    ...filter,
    status: { $ne: "RESOLVED" },
    priority: { $in: ["URGENT", "HIGH"] },
  };
  const [statistics, byStatus, byCategory, monthlyTrends, recentActivity, technicianPerformance, residenceComparison, recentIncidents, priorityIncidents, awaitingConfirmation, residences] =
    await Promise.all([
      getIncidentStatistics(filter),
      getIncidentsByStatus(filter),
      getIncidentsByCategory(filter),
      getMonthlyIncidentTrends(filter, from, to),
      getRecentIncidentActivity(recentFilter, 10),
      user.role === Role.ADMIN || user.role === Role.SYNDIC
        ? getTechnicianPerformance(filter)
        : Promise.resolve([]),
      user.role === Role.ADMIN || user.role === Role.SYNDIC
        ? getResidenceComparison(filter)
        : Promise.resolve([]),
      Incident.aggregate<DashboardIncidentRow>([
        { $match: filter as PipelineStage.Match["$match"] },
        { $sort: { createdAt: -1 } },
        { $skip: (query.data.page - 1) * query.data.limit },
        { $limit: query.data.limit },
        {
          $lookup: {
            from: "residences",
            localField: "residence",
            foreignField: "_id",
            pipeline: [{ $project: { name: 1 } }],
            as: "residence",
          },
        },
        {
          $project: {
            _id: 1,
            title: 1,
            category: 1,
            priority: 1,
            status: 1,
            createdAt: { $ifNull: ["$createdAt", "$reportedAt"] },
            residence: { $arrayElemAt: ["$residence", 0] },
          },
        },
      ]),
      Incident.aggregate<DashboardIncidentRow>([
        { $match: priorityFilter as PipelineStage.Match["$match"] },
        {
          $addFields: {
            priorityOrder: {
              $switch: {
                branches: [
                  { case: { $eq: ["$priority", "URGENT"] }, then: 4 },
                  { case: { $eq: ["$priority", "HIGH"] }, then: 3 },
                  { case: { $eq: ["$priority", "MEDIUM"] }, then: 2 },
                ],
                default: 1,
              },
            },
          },
        },
        { $sort: { priorityOrder: -1, createdAt: 1 } },
        { $limit: 8 },
        {
          $lookup: {
            from: "residences",
            localField: "residence",
            foreignField: "_id",
            pipeline: [{ $project: { name: 1 } }],
            as: "residence",
          },
        },
        {
          $project: {
            _id: 1,
            title: 1,
            category: 1,
            priority: 1,
            status: 1,
            createdAt: { $ifNull: ["$createdAt", "$reportedAt"] },
            residence: { $arrayElemAt: ["$residence", 0] },
          },
        },
      ]),
      user.role === Role.RESIDENT
        ? Incident.countDocuments({
            ...filter,
            status: "IN_PROGRESS",
            resolutionSubmittedAt: { $exists: true },
            resolutionConfirmedAt: { $exists: false },
          })
        : Promise.resolve(0),
      user.role === Role.ADMIN || user.role === Role.SYNDIC
        ? Residence.find(
            user.role === Role.SYNDIC ? { _id: { $in: allowedResidenceIds } } : {}
          ).select("_id name").sort({ name: 1 }).limit(100).lean()
        : Promise.resolve([]),
    ]);

  const [countResult] = await Incident.aggregate<{ total: number }>([
    { $match: filter as PipelineStage.Match["$match"] },
    { $count: "total" },
  ]);
  const incidentCount = countResult?.total ?? 0;

  return json({
    success: true,
    data: {
      role: user.role,
      dateRange: { from: from.toISOString(), to: to.toISOString() },
      statistics,
      awaitingConfirmation,
      byStatus,
      byCategory,
      monthlyTrends,
      recentActivity,
      technicianPerformance,
      residenceComparison,
      residences: residences.map((residence) => ({
        id: residence._id.toString(),
        name: residence.name,
      })),
      recentIncidents: {
        data: recentIncidents.map((incident) => ({
          _id: incident._id.toString(),
          title: incident.title,
          category: incident.category,
          priority: incident.priority,
          status: incident.status,
          createdAt: incident.createdAt.toISOString(),
          residence: incident.residence
            ? { id: incident.residence._id.toString(), name: incident.residence.name }
            : null,
        })),
        meta: {
          page: query.data.page,
          limit: query.data.limit,
          total: incidentCount,
        },
      },
      priorityIncidents: priorityIncidents.map((incident) => ({
        _id: incident._id.toString(),
        title: incident.title,
        category: incident.category,
        priority: incident.priority,
        status: incident.status,
        residence: incident.residence
          ? { id: incident.residence._id.toString(), name: incident.residence.name }
          : null,
      })),
      technicians: technicianPerformance.map((technician) => ({
        id: technician.technicianId,
        name: technician.name,
      })),
    },
  });
});
