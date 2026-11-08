import { createCrudRoutes } from "@/lib/crud/createCrudRoutes";
import { Charge } from "@/models/Charge";
import { Apartment } from "@/models/Apartment";
import { Payment } from "@/models/Payment";
import { getResidentApartmentIds, getSyndicResidenceIds } from "@/lib/auth-guard";
import { chargeCreateSchema, chargeUpdateSchema } from "@/lib/validations/charge";
import { Role } from "@/types/enums";
import { HttpError } from "@/lib/api";

export const chargeCrudRoutes = createCrudRoutes({
  model: Charge,
  createSchema: chargeCreateSchema,
  updateSchema: chargeUpdateSchema,
  access: {
    read: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT],
    create: [Role.ADMIN, Role.SYNDIC],
    update: [Role.ADMIN, Role.SYNDIC],
    delete: [Role.ADMIN, Role.SYNDIC],
  },
  searchFields: ["period"],
  defaultSort: { dueDate: -1, period: -1 },
  populate: [
    {
      path: "apartment",
      select: "number floor shares residence",
      populate: { path: "residence", select: "name" },
    },
  ],
  filterFields: ["apartment", "period", "status"],
  dateField: "dueDate",
  exportPopulate: [{ path: "apartment", select: "number" }],
  exportColumns: [
    { key: "period", label: "Période" },
    { key: "apartment.number", label: "Appartement" },
    { key: "amount", label: "Montant" },
    { key: "paidAmount", label: "Payé" },
    { key: "dueDate", label: "Échéance" },
    { key: "status", label: "Statut" },
  ],

  scope: async (user) => {
    // 1. ADMIN : accès global
    if (user.role === Role.ADMIN) {
      return {};
    }
    // 2. SYNDIC : charges des appartements de ses résidences
    if (user.role === Role.SYNDIC) {
      const residenceIds = await getSyndicResidenceIds(user.id);
      const aptIds = await Apartment.find({ residence: { $in: residenceIds } }).distinct("_id");
      return { apartment: { $in: aptIds } };
    }
    // 3. RESIDENT : lecture de ses propres charges uniquement
    if (user.role === Role.RESIDENT) {
      const allowedAptIds = await getResidentApartmentIds(user.id);
      return { apartment: { $in: allowedAptIds } };
    }
    return {};
  },

  beforeCreate: async (user, body) => {
    const apt = await Apartment.findById(body.apartment).lean();
    if (!apt) throw new HttpError(404, "Appartement introuvable");

    if (user.role === Role.SYNDIC) {
      const residenceIds = await getSyndicResidenceIds(user.id);
      if (!residenceIds.includes(String(apt.residence))) {
        throw new HttpError(403, "Vous n'administrez pas la résidence de cet appartement");
      }
    }

    // Unicité { apartment, period }
    const existing = await Charge.findOne({
      apartment: body.apartment,
      period: body.period,
    }).lean();

    if (existing) {
      throw new HttpError(
        409,
        `Une charge pour la période "${body.period}" existe déjà pour cet appartement`
      );
    }
  },

  beforeDelete: async (id) => {
    const hasPayments = await Payment.exists({ charge: id });
    if (hasPayments) {
      throw new HttpError(
        409,
        "Impossible de supprimer une charge pour laquelle des paiements ont déjà été enregistrés"
      );
    }
  },
});
