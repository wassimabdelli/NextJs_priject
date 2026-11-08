import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json } from "@/lib/api";
import { redactPII } from "@/lib/ai/redact";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { getAnnouncementResidenceIds } from "@/lib/announcements/access";
import { getEligibleResidentIdsByResidence } from "@/lib/announcements/readStats";
import { Announcement } from "@/models/Announcement";
import { Incident } from "@/models/Incident";
import { AnnouncementCategory, AnnouncementStatus, IncidentStatus, incidentCategoryLabel, Role, values } from "@/types/enums";

type AnnouncementContextFact = { id: string; label: string };

const categorySchema = new Set<string>(values(AnnouncementCategory));
const incidentCategoryLabels: Record<string, string> = incidentCategoryLabel;

async function getContext(req: NextRequest, user: AuthUser) {
  const residenceId = req.nextUrl.searchParams.get("residenceId") ?? "";
  const requestedCategory = req.nextUrl.searchParams.get("category") ?? "";
  if (!isValidObjectId(residenceId)) {
    throw new HttpError(400, "Identifiant de résidence invalide");
  }
  if (requestedCategory && !categorySchema.has(requestedCategory)) {
    throw new HttpError(400, "Catégorie d'annonce invalide");
  }

  const residenceIds = await getAnnouncementResidenceIds(user);
  if (residenceIds && !residenceIds.includes(residenceId)) {
    throw new HttpError(403, "Résidence non autorisée");
  }

  const facts: AnnouncementContextFact[] = [];
  try {
    const residentIds = await getEligibleResidentIdsByResidence([residenceId]);
    const count = residentIds.get(residenceId)?.size ?? 0;
    facts.push({
      id: "resident-count",
      label: `${count} résident${count === 1 ? " actif sera concerné" : "s actifs seront concernés"}`,
    });
  } catch (error) {
    console.warn("[ai] announcement context resident count unavailable", error);
  }

  try {
    const groups = await Incident.aggregate<{ _id: string; count: number }>([
      { $match: { residence: new mongoose.Types.ObjectId(residenceId), status: { $ne: IncidentStatus.RESOLVED } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 4 },
    ]);
    for (const group of groups) {
      const label = incidentCategoryLabels[group._id];
      if (!label || group.count <= 0) continue;
      facts.push({
        id: `open-incidents-${group._id.toLowerCase()}`,
        label: `${group.count} réclamation${group.count > 1 ? "s ouvertes" : " ouverte"} en ${label.toLowerCase()} dans cette résidence`,
      });
    }
  } catch (error) {
    console.warn("[ai] announcement context incident counts unavailable", error);
  }

  if (requestedCategory) {
    try {
      const previous = await Announcement.findOne({
        residence: new mongoose.Types.ObjectId(residenceId),
        category: requestedCategory as AnnouncementCategory,
        status: AnnouncementStatus.PUBLISHED,
      })
        .sort({ publishedAt: -1 })
        .select("title publishedAt")
        .lean();
      if (previous?.publishedAt) {
        const date = new Date(previous.publishedAt).toLocaleDateString("fr-FR");
        facts.push({
          id: "last-published-announcement",
          label: `Dernière annonce de cette catégorie : « ${redactPII(previous.title).slice(0, 130)} » le ${date}`,
        });
      }
    } catch (error) {
      console.warn("[ai] announcement context previous announcement unavailable", error);
    }
  }

  return json({ facts: facts.slice(0, 8) });
}

export const GET = withAuth(getContext, {
  roles: [Role.ADMIN, Role.SYNDIC],
});
