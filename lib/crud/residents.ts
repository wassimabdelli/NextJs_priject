import { createCrudRoutes } from "@/lib/crud/createCrudRoutes";
import { Resident } from "@/models/Resident";
import { Apartment } from "@/models/Apartment";
import { getResidentApartmentIds, getSyndicResidenceIds } from "@/lib/auth-guard";
import { residentCreateSchema, residentUpdateSchema } from "@/lib/validations/resident";
import { Role } from "@/types/enums";
import { HttpError } from "@/lib/api";

export const residentCrudRoutes = createCrudRoutes({
  model: Resident,
  createSchema: residentCreateSchema,
  updateSchema: residentUpdateSchema,
  access: {
    read: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT],
    create: [Role.ADMIN, Role.SYNDIC],
    update: [Role.ADMIN, Role.SYNDIC],
    delete: [Role.ADMIN, Role.SYNDIC],
  },
  searchFields: ["fullName", "email", "phone"],
  defaultSort: { fullName: 1 },
  populate: [
    {
      path: "apartment",
      select: "number floor residence",
      populate: { path: "residence", select: "name" },
    },
    { path: "user", select: "name email" },
  ],
  filterFields: ["apartment", "type", "isActive"],
  dateField: "moveInDate",
  exportPopulate: [{ path: "apartment", select: "number" }],
  exportColumns: [
    { key: "fullName", label: "Nom" },
    { key: "phone", label: "Téléphone" },
    { key: "email", label: "Email" },
    { key: "type", label: "Type" },
    { key: "apartment.number", label: "Appartement" },
    { key: "moveInDate", label: "Emménagement" },
    { key: "isActive", label: "Actif" },
  ],

  scope: async (user) => {
    // 1. ADMIN : accès global
    if (user.role === Role.ADMIN) {
      return {};
    }
    // 2. SYNDIC : résidents des appartements gérés
    if (user.role === Role.SYNDIC) {
      const residenceIds = await getSyndicResidenceIds(user.id);
      const aptIds = await Apartment.find({ residence: { $in: residenceIds } }).distinct("_id");
      return { apartment: { $in: aptIds } };
    }
    // 3. RESIDENT : résidents de son propre appartement
    if (user.role === Role.RESIDENT) {
      const allowedAptIds = await getResidentApartmentIds(user.id);
      return { apartment: { $in: allowedAptIds } };
    }
    return {};
  },

  beforeCreate: async (user, body) => {
    const apt = await Apartment.findById(body.apartment).lean();
    if (!apt) {
      throw new HttpError(404, "Appartement introuvable");
    }

    if (user.role === Role.SYNDIC) {
      const syndicResidences = await getSyndicResidenceIds(user.id);
      if (!syndicResidences.includes(String(apt.residence))) {
        throw new HttpError(403, "Vous n'administrez pas la résidence de cet appartement");
      }
    }
  },
});
