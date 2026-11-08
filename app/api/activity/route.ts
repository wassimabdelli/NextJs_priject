import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import { HttpError, json } from "@/lib/api";
import { withAuth, getResidentResidenceIds, getSyndicResidenceIds, getTechnicianResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { IncidentHistory } from "@/models/IncidentHistory";
import { Incident } from "@/models/Incident";
import { AnnouncementHistory } from "@/models/AnnouncementHistory";
import { Role } from "@/types/enums";
import { publishDueAnnouncements } from "@/lib/announcements/publication";

const activityLabels: Record<string, string> = {
  CREATED: "Réclamation créée",
  ASSIGNED: "Technicien assigné",
  STATUS_CHANGED: "Statut de la réclamation modifié",
  COMMENT_ADDED: "Commentaire ajouté",
  RESOLUTION_SUBMITTED: "Résolution proposée",
  RESOLUTION_CONFIRMED: "Résolution confirmée",
  RESOLUTION_REJECTED: "Résolution refusée",
  UPDATED: "Réclamation mise à jour",
};

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!Object.values(Role).includes(user.role)) throw new HttpError(403, "Rôle non autorisé");
  const page = Number(req.nextUrl.searchParams.get("page") ?? 1);
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);
  const kind = req.nextUrl.searchParams.get("kind");
  if (!Number.isInteger(page) || page < 1 || page > 10000 ||
      !Number.isInteger(limit) || limit < 1 || limit > 50 ||
      (kind !== null && kind !== "INCIDENT" && kind !== "ANNOUNCEMENT")) {
    throw new HttpError(400, "Filtres d'activité invalides");
  }
  const skip = (page - 1) * limit;
  const incidentScope: Record<string, unknown> = {};
  const residenceIds = user.role === Role.SYNDIC
    ? await getSyndicResidenceIds(user.id)
    : user.role === Role.RESIDENT
    ? await getResidentResidenceIds(user.id)
    : user.role === Role.TECHNICIAN
    ? await getTechnicianResidenceIds(user.id)
    : null;
  await publishDueAnnouncements(user.role === Role.ADMIN ? null : residenceIds);
  if (user.role === Role.RESIDENT) incidentScope.reportedBy = new mongoose.Types.ObjectId(user.id);
  else if (user.role === Role.TECHNICIAN) incidentScope.assignedTo = new mongoose.Types.ObjectId(user.id);
  else if (residenceIds) incidentScope.residence = { $in: residenceIds.map((id) => new mongoose.Types.ObjectId(id)) };

  const incidentPipeline: mongoose.PipelineStage[] = [
    { $lookup: { from: Incident.collection.name, localField: "incident", foreignField: "_id", as: "incidentDoc" } },
    { $unwind: "$incidentDoc" },
    { $match: Object.fromEntries(Object.entries(incidentScope).map(([key, value]) => [`incidentDoc.${key}`, value])) },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          { $project: { _id: 1, action: 1, createdAt: 1, incidentId: "$incidentDoc._id", incidentTitle: "$incidentDoc.title" } },
        ],
        total: [{ $count: "count" }],
      },
    },
  ];
  const incidentRows = kind === "ANNOUNCEMENT"
    ? [{ data: [], total: [] }]
    : await IncidentHistory.aggregate<{ data: Array<Record<string, unknown>>; total: Array<{ count: number }> }>(incidentPipeline);
  const incidentFacet = incidentRows[0] ?? { data: [], total: [] };

  const announcementFilter: Record<string, unknown> = {};
  if (residenceIds) announcementFilter.residence = { $in: residenceIds.map((id) => new mongoose.Types.ObjectId(id)) };
  if (user.role === Role.RESIDENT) {
    announcementFilter.audience = { $in: ["RESIDENTS", "ALL"] };
  } else if (user.role === Role.TECHNICIAN) {
    announcementFilter.audience = { $in: ["TECHNICIANS", "ALL"] };
  }
  const [announcements, announcementTotal] = kind === "INCIDENT"
    ? [[], 0] as const
    : await Promise.all([
        AnnouncementHistory.find(announcementFilter)
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .select("announcement action title priority createdAt")
          .lean(),
        AnnouncementHistory.countDocuments(announcementFilter),
      ]);

  const incidentItems = incidentFacet.data.map((row) => ({
    id: String(row._id),
    kind: "INCIDENT" as const,
    title: activityLabels[String(row.action)] ?? "Activité de réclamation",
    message: String(row.incidentTitle ?? "Réclamation"),
    createdAt: row.createdAt,
    href: `/incidents?incident=${String(row.incidentId)}`,
  }));
  const announcementItems = announcements.map((item) => {
    const archived = item.action === "ARCHIVED";
    return {
      id: `announcement-${String(item._id)}`,
      kind: "ANNOUNCEMENT" as const,
      title: archived ? "Annonce archivée" : item.priority === "URGENT" ? "Annonce urgente publiée" : "Annonce publiée",
      message: item.title,
      createdAt: item.createdAt,
      href: archived ? "/announcements" : `/announcements?announcement=${String(item.announcement)}`,
    };
  });
  const data = [...incidentItems, ...announcementItems]
    .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())
    .slice(0, limit);
  const total = (incidentFacet.total[0]?.count ?? 0) + announcementTotal;
  return json({ data, meta: { page, limit, total } });
});
