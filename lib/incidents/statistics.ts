import { Incident } from "@/models/Incident";
import { IncidentHistory } from "@/models/IncidentHistory";
import type { PipelineStage } from "mongoose";
import { DEFAULT_INCIDENT_OVERDUE_HOURS } from "./constants";

type IncidentFilter = Record<string, unknown>;

export interface IncidentStatistics {
  total: number;
  reported: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  urgent: number;
  high: number;
  overdue: number;
  averageResolutionHours: number;
  resolutionRate: number;
}

function normalizedFilter(filter: IncidentFilter) {
  return filter as Record<string, never>;
}

export async function getIncidentStatistics(
  filter: IncidentFilter,
  overdueHours = DEFAULT_INCIDENT_OVERDUE_HOURS
): Promise<IncidentStatistics> {
  const cutoff = new Date(Date.now() - overdueHours * 60 * 60 * 1000);
  const [result] = await Incident.aggregate([
    { $match: normalizedFilter(filter) },
    {
      $addFields: {
        resolutionDuration: {
          $cond: [
            {
              $and: [
                { $eq: ["$status", "RESOLVED"] },
                { $ne: [{ $ifNull: ["$resolvedAt", null] }, null] },
              ],
            },
            {
              $divide: [
                {
                  $subtract: [
                    "$resolvedAt",
                    { $ifNull: ["$createdAt", "$reportedAt"] },
                  ],
                },
                3_600_000,
              ],
            },
            null,
          ],
        },
        incidentCreatedAt: { $ifNull: ["$createdAt", "$reportedAt"] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        reported: { $sum: { $cond: [{ $eq: ["$status", "REPORTED"] }, 1, 0] } },
        assigned: { $sum: { $cond: [{ $eq: ["$status", "ASSIGNED"] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ["$status", "IN_PROGRESS"] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ["$status", "RESOLVED"] }, 1, 0] } },
        urgent: { $sum: { $cond: [{ $eq: ["$priority", "URGENT"] }, 1, 0] } },
        high: { $sum: { $cond: [{ $eq: ["$priority", "HIGH"] }, 1, 0] } },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$status", "RESOLVED"] },
                  { $lt: ["$incidentCreatedAt", cutoff] },
                ],
              },
              1,
              0,
            ],
          },
        },
        averageResolutionHours: { $avg: "$resolutionDuration" },
      },
    },
  ]);
  const stats = result ?? {};
  const total = Number(stats.total) || 0;
  const resolved = Number(stats.resolved) || 0;

  return {
    total,
    reported: Number(stats.reported) || 0,
    assigned: Number(stats.assigned) || 0,
    inProgress: Number(stats.inProgress) || 0,
    resolved,
    urgent: Number(stats.urgent) || 0,
    high: Number(stats.high) || 0,
    overdue: Number(stats.overdue) || 0,
    averageResolutionHours: Math.round(Number(stats.averageResolutionHours) || 0),
    resolutionRate: total ? Math.round((resolved / total) * 100) : 0,
  };
}

export async function getIncidentsByStatus(filter: IncidentFilter) {
  return Incident.aggregate([
    { $match: normalizedFilter(filter) },
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, status: "$_id", count: 1 } },
  ]);
}

export async function getIncidentsByCategory(filter: IncidentFilter) {
  return Incident.aggregate([
    { $match: normalizedFilter(filter) },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, category: "$_id", count: 1 } },
  ]);
}

export interface MonthlyIncidentTrend {
  month: string;
  reported: number;
  resolved: number;
}

export async function getMonthlyIncidentTrends(
  filter: IncidentFilter,
  from: Date,
  to: Date
): Promise<MonthlyIncidentTrend[]> {
  const scopeFilter = { ...filter };
  delete scopeFilter.createdAt;
  const grouped = await Incident.aggregate([
    { $match: normalizedFilter(scopeFilter) },
    {
      $facet: {
        reported: [
          {
            $match: {
              $or: [
                { createdAt: { $gte: from, $lte: to } },
                {
                  createdAt: { $exists: false },
                  reportedAt: { $gte: from, $lte: to },
                },
              ],
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m",
                  date: { $ifNull: ["$createdAt", "$reportedAt"] },
                },
              },
              count: { $sum: 1 },
            },
          },
          { $project: { _id: 0, month: "$_id", count: 1 } },
        ],
        resolved: [
          { $match: { status: "RESOLVED", resolvedAt: { $gte: from, $lte: to } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$resolvedAt" } },
              count: { $sum: 1 },
            },
          },
          { $project: { _id: 0, month: "$_id", count: 1 } },
        ],
      },
    },
  ]);
  const monthly = grouped[0] ?? { reported: [], resolved: [] };

  const months: MonthlyIncidentTrend[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const last = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor <= last) {
    const month = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    const reported = monthly.reported.find((item: { month: string }) => item.month === month);
    const resolved = monthly.resolved.find((item: { month: string }) => item.month === month);
    months.push({
      month,
      reported: Number(reported?.count) || 0,
      resolved: Number(resolved?.count) || 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

export async function getTechnicianPerformance(filter: IncidentFilter) {
  return Incident.aggregate([
    { $match: normalizedFilter(filter) },
    { $match: { assignedTo: { $ne: null } } },
    {
      $group: {
        _id: "$assignedTo",
        assigned: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ["$status", "RESOLVED"] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ["$status", "IN_PROGRESS"] }, 1, 0] } },
        averageResolutionHours: {
          $avg: {
            $cond: [
              { $and: [{ $eq: ["$status", "RESOLVED"] }, { $ne: ["$resolvedAt", null] }] },
              {
                $divide: [
                  { $subtract: ["$resolvedAt", { $ifNull: ["$createdAt", "$reportedAt"] }] },
                  3_600_000,
                ],
              },
              null,
            ],
          },
        },
      },
    },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", pipeline: [{ $project: { name: 1, _id: 0 } }], as: "technician" } },
    { $unwind: { path: "$technician", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        technicianId: { $toString: "$_id" },
        name: { $ifNull: ["$technician.name", "Technicien"] },
        assigned: 1,
        completed: 1,
        inProgress: 1,
        averageResolutionHours: { $round: [{ $ifNull: ["$averageResolutionHours", 0] }, 0] },
      },
    },
    { $sort: { assigned: -1, name: 1 } },
    { $limit: 50 },
  ]);
}

export async function getResidenceComparison(filter: IncidentFilter) {
  return Incident.aggregate([
    { $match: normalizedFilter(filter) },
    { $group: { _id: "$residence", incidents: { $sum: 1 } } },
    { $lookup: { from: "residences", localField: "_id", foreignField: "_id", pipeline: [{ $project: { name: 1, _id: 0 } }], as: "residence" } },
    { $unwind: { path: "$residence", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        residenceId: { $toString: "$_id" },
        name: { $ifNull: ["$residence.name", "Résidence"] },
        incidents: 1,
      },
    },
    { $sort: { incidents: -1, name: 1 } },
    { $limit: 50 },
  ]);
}

export async function getRecentIncidentActivity(filter: IncidentFilter, limit = 10) {
  const pipeline: PipelineStage[] = [
    { $match: normalizedFilter(filter) },
    { $project: { _id: 1, title: 1, category: 1, priority: 1, status: 1, residence: 1 } },
    {
      $lookup: {
        from: IncidentHistory.collection.name,
        localField: "_id",
        foreignField: "incident",
        as: "history",
      },
    },
    { $unwind: "$history" },
    { $sort: { "history.createdAt": -1 } },
    {
      $project: {
        _id: { $toString: "$history._id" },
        incidentId: { $toString: "$_id" },
        title: 1,
        category: 1,
        priority: 1,
        status: 1,
        residenceId: { $toString: "$residence" },
        action: "$history.action",
        description: "$history.description",
        createdAt: "$history.createdAt",
      },
    },
    { $limit: Math.min(50, Math.max(1, limit)) },
  ];
  return Incident.aggregate(pipeline);
}
