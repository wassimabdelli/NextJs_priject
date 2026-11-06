import { json } from "@/lib/api";
import {
  withAuth,
  getResidentResidenceIds,
  getSyndicResidenceIds,
  getTechnicianResidenceIds,
  type AuthUser,
} from "@/lib/auth-guard";
import { Residence } from "@/models/Residence";
import { Role } from "@/types/enums";
import type { NextRequest } from "next/server";

/**
 * GET /api/residences/mine
 * Renvoie uniquement les résidences auxquelles l'utilisateur connecté est rattaché.
 * - ADMIN : toutes les résidences
 * - SYNDIC : résidences qu'il gère
 * - OWNER/TENANT : résidences où il a un appartement
 * - TECHNICIAN : résidences de ses incidents assignés
 */
export const GET = withAuth(async (_req: NextRequest, user: AuthUser) => {
  let residenceIds: string[] | null = null;

  if (user.role === Role.ADMIN) {
    // L'admin voit toutes les résidences
    const all = await Residence.find({}, "_id name city address totalApartments")
      .sort({ name: 1 })
      .lean();
    return json({ data: all });
  }

  if (user.role === Role.SYNDIC) {
    residenceIds = await getSyndicResidenceIds(user.id);
  } else if (user.role === Role.OWNER || user.role === Role.TENANT) {
    residenceIds = await getResidentResidenceIds(user.id);
  } else if (user.role === Role.TECHNICIAN) {
    residenceIds = await getTechnicianResidenceIds(user.id);
  }

  if (!residenceIds || residenceIds.length === 0) {
    return json({ data: [] });
  }

  const residences = await Residence.find(
    { _id: { $in: residenceIds } },
    "_id name city address totalApartments"
  )
    .sort({ name: 1 })
    .lean();

  return json({ data: residences });
});

