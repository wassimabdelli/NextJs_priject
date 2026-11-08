import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import { withAuth, getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { Apartment } from "@/models/Apartment";
import { Charge } from "@/models/Charge";
import { Residence } from "@/models/Residence";
import { Role, ChargeStatus } from "@/types/enums";
import { z } from "zod";
import { objectId, period } from "@/lib/validations/common";

const generateChargesSchema = z.object({
  residenceId: objectId,
  period,
  totalBudget: z.number().positive("Le budget total doit être strictement positif"),
  dueDate: z.string().optional(),
});

/**
 * POST /api/charges/generate
 * Génère automatiquement les charges d'une résidence pour un mois donné,
 * au prorata des tantièmes de chaque lot, sans doublon sur {apartment, period}.
 * Rôles : ADMIN, SYNDIC
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthUser) => {
    const data = await parseBody(req, generateChargesSchema);

    if (!isValidObjectId(data.residenceId)) {
      throw new HttpError(400, "Identifiant de résidence invalide");
    }

    // Vérification des droits du syndic
    if (user.role === Role.SYNDIC) {
      const syndicResidences = await getSyndicResidenceIds(user.id);
      if (!syndicResidences.includes(data.residenceId)) {
        throw new HttpError(403, "Vous n'administrez pas cette copropriété");
      }
    }

    const residence = await Residence.findById(data.residenceId).lean();
    if (!residence) {
      throw new HttpError(404, "Résidence introuvable");
    }

    const apartments = await Apartment.find({ residence: data.residenceId }).lean();
    if (apartments.length === 0) {
      throw new HttpError(400, "Aucun lot enregistré dans cette résidence");
    }

    const totalShares = apartments.reduce((sum, apt) => sum + (Number(apt.shares) || 0), 0);
    if (totalShares <= 0) {
      throw new HttpError(
        400,
        "La somme des tantièmes de la résidence est nulle. Veuillez renseigner les tantièmes des lots."
      );
    }

    // Date d'échéance par défaut : le 15 du mois de la période
    const [yearStr, monthStr] = data.period.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const defaultDueDate = new Date(year, month - 1, 15);
    const dueDate = data.dueDate ? new Date(data.dueDate) : defaultDueDate;

    let createdCount = 0;
    let skippedCount = 0;

    for (const apt of apartments) {
      // Détection de doublon sur { apartment, period }
      const exists = await Charge.findOne({
        apartment: apt._id,
        period: data.period,
      }).lean();

      if (exists) {
        skippedCount++;
        continue;
      }

      // Calcul au prorata strict des tantièmes
      const amount = Math.round(((data.totalBudget * (apt.shares || 0)) / totalShares) * 100) / 100;

      await Charge.create({
        apartment: apt._id,
        period: data.period,
        amount,
        paidAmount: 0,
        dueDate,
        status: ChargeStatus.PENDING,
      });

      createdCount++;
    }

    return json(
      {
        message: `${createdCount} charge(s) générée(s) pour la période ${data.period}`,
        createdCount,
        skippedCount,
        totalApartments: apartments.length,
        totalBudget: data.totalBudget,
        period: data.period,
      },
      201
    );
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
