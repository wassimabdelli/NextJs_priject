import mongoose from "mongoose";
import { createCrudRoutes } from "@/lib/crud/createCrudRoutes";
import { Payment } from "@/models/Payment";
import { Charge } from "@/models/Charge";
import { Apartment } from "@/models/Apartment";
import { getResidentApartmentIds, getSyndicResidenceIds } from "@/lib/auth-guard";
import { paymentCreateSchema, paymentUpdateSchema } from "@/lib/validations/payment";
import { PaymentValidationStatus, Role } from "@/types/enums";
import { HttpError } from "@/lib/api";

/**
 * Helper qui recalcule et persiste le montant payé et le statut d'une charge
 * à partir de la somme des paiements VALIDÉS uniquement.
 */
export async function recalculateCharge(chargeId: string | mongoose.Types.ObjectId): Promise<void> {
  const cId = new mongoose.Types.ObjectId(String(chargeId));
  const [agg] = await Payment.aggregate<{ total: number }>([
    {
      $match: {
        charge: cId,
        validationStatus: {
          $nin: [
            PaymentValidationStatus.PENDING_VALIDATION,
            PaymentValidationStatus.REJECTED,
          ],
        },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const charge = await Charge.findById(cId);
  if (!charge) return;
  charge.paidAmount = Math.round((agg?.total ?? 0) * 100) / 100;
  charge.updateStatus();
  await charge.save();
}

export const paymentCrudRoutes = createCrudRoutes({
  model: Payment,
  createSchema: paymentCreateSchema,
  updateSchema: paymentUpdateSchema,
  access: {
    read: [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT],
    create: [Role.ADMIN, Role.SYNDIC],
    update: [Role.ADMIN, Role.SYNDIC],
    delete: [Role.ADMIN, Role.SYNDIC],
  },
  searchFields: ["receiptNumber"],
  defaultSort: { paymentDate: -1, createdAt: -1 },
  populate: [
    {
      path: "charge",
      select: "period amount paidAmount status apartment",
      populate: { path: "apartment", select: "number floor residence", populate: { path: "residence", select: "name" } },
    },
    { path: "receivedBy", select: "name email" },
  ],
  filterFields: ["charge", "method"],
  dateField: "paymentDate",
  exportPopulate: [
    {
      path: "charge",
      select: "period apartment",
      populate: {
        path: "apartment",
        select: "number residence",
        populate: { path: "residence", select: "name" },
      },
    },
    { path: "receivedBy", select: "name" },
  ],
  exportColumns: [
    { key: "receiptNumber", label: "N° reçu" },
    { key: "paymentDate", label: "Date" },
    { key: "amount", label: "Montant" },
    { key: "method", label: "Mode" },
    { key: "charge.period", label: "Période" },
    { key: "charge.apartment.number", label: "Appartement" },
    { key: "charge.apartment.residence.name", label: "Résidence" },
    { key: "receivedBy.name", label: "Encaissé par" },
  ],

  scope: async (user) => {
    // 1. ADMIN : accès global
    if (user.role === Role.ADMIN) {
      return {};
    }
    // 2. SYNDIC : paiements des résidences administrées
    if (user.role === Role.SYNDIC) {
      const residenceIds = await getSyndicResidenceIds(user.id);
      const aptIds = await Apartment.find({ residence: { $in: residenceIds } }).distinct("_id");
      const chargeIds = await Charge.find({ apartment: { $in: aptIds } }).distinct("_id");
      return { charge: { $in: chargeIds } };
    }
    // 3. OWNER ou TENANT : paiements rattachés à ses propres charges uniquement
    if (user.role === Role.OWNER || user.role === Role.TENANT) {
      const allowedAptIds = await getResidentApartmentIds(user.id);
      const chargeIds = await Charge.find({ apartment: { $in: allowedAptIds } }).distinct("_id");
      return { charge: { $in: chargeIds } };
    }
    return {};
  },

  injectOnCreate: async (user, body) => {
    // Règle de sécurité stricte : receivedBy est TOUJOURS session.user.id
    // Génère receiptNumber de façon unique (REC-AAAAMMJJ-xxxxxx aléatoire)
    const d = new Date();
    const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    const receiptNumber =
      body.receiptNumber && body.receiptNumber.trim().length > 0
        ? body.receiptNumber
        : `REC-${ymd}-${rand}`;

    return {
      receivedBy: user.id,
      receiptNumber,
      validationStatus: PaymentValidationStatus.VALIDATED,
      validatedBy: user.id,
      validatedAt: new Date(),
      syncedAt: new Date(),
    };
  },

  beforeCreate: async (user, body) => {
    const charge = await Charge.findById(body.charge);
    if (!charge) {
      throw new HttpError(404, "Charge introuvable");
    }

    if (user.role === Role.SYNDIC) {
      const apt = await Apartment.findById(charge.apartment).lean();
      if (apt) {
        const residenceIds = await getSyndicResidenceIds(user.id);
        if (!residenceIds.includes(String(apt.residence))) {
          throw new HttpError(403, "Vous n'administrez pas la résidence de cette charge");
        }
      }
    }

    // Règle métier : refuse un montant supérieur au reste à payer
    // (les preuves en attente ne réduisent pas encore paidAmount)
    const pending = await Payment.aggregate<{ total: number }>([
      {
        $match: {
          charge: charge._id,
          validationStatus: PaymentValidationStatus.PENDING_VALIDATION,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const pendingTotal = pending[0]?.total ?? 0;
    const remaining =
      Math.round((charge.amount - (charge.paidAmount || 0) - pendingTotal) * 100) / 100;
    if (body.amount > remaining + 0.001) {
      throw new HttpError(
        400,
        `Le montant saisi (${body.amount.toFixed(2)} TND) dépasse le reste à payer de cette charge (${remaining.toFixed(2)} TND)`
      );
    }
  },

  afterUpdate: async (payment) => {
    if (payment?.charge) {
      await recalculateCharge(payment.charge);
    }
  },

  afterDelete: async (payment) => {
    if (payment?.charge) {
      await recalculateCharge(payment.charge);
    }
  },
});
