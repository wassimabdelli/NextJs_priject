import { json } from "@/lib/api";
import { withAuth } from "@/lib/auth-guard";
import { Residence } from "@/models/Residence";

/**
 * GET /api/residences/available
 * Renvoie la liste simplifiée des résidences (pour sélection lors d'une demande de rattachement).
 * Accessible à tout utilisateur connecté.
 */
export const GET = withAuth(async () => {
  const residences = await Residence.find({}, "_id name city address totalApartments")
    .sort({ name: 1 })
    .lean();
  return json({ data: residences });
});

