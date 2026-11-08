import type { NextRequest } from "next/server";
import { json } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { equipmentScope } from "@/lib/maintenance/service";
import { Equipment } from "@/models/Equipment";
import { Role } from "@/types/enums";

/**
 * Vue simplifiée « état seulement » pour les résidents (et autres rôles).
 * N'expose aucun champ sensible (numéro de série, prestataire, notes, garantie).
 */
export const GET = withAuth(
  async (req: NextRequest, user: AuthUser) => {
    const { searchParams } = req.nextUrl;

    const rawPage = parseInt(searchParams.get("page") || "1", 10);
    const rawLimit = parseInt(searchParams.get("limit") || "50", 10);
    const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limit =
      Number.isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 50);
    const skip = (page - 1) * limit;

    const conditions: Record<string, unknown>[] = [];
    const scoped = await equipmentScope(user);
    if (scoped && Object.keys(scoped).length > 0) {
      conditions.push(scoped);
    }

    for (const key of ["residence", "status", "category"] as const) {
      const val = searchParams.get(key)?.trim();
      if (val) {
        conditions.push({ [key]: val });
      }
    }

    const filtre =
      conditions.length > 1 ? { $and: conditions } : conditions[0] || {};

    const [data, total] = await Promise.all([
      Equipment.find(filtre)
        .select("residence name category location status")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Equipment.countDocuments(filtre),
    ]);

    return json({ data, meta: { page, limit, total } });
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT, Role.TECHNICIAN] }
);
