import { createCrudRoutes } from "@/lib/crud/createCrudRoutes";
import { Apartment } from "@/models/Apartment";
import { Residence } from "@/models/Residence";
import { Charge } from "@/models/Charge";
import { getResidentApartmentIds, getSyndicResidenceIds } from "@/lib/auth-guard";
import { apartmentCreateSchema, apartmentUpdateSchema } from "@/lib/validations/apartment";
import { Role } from "@/types/enums";
import { HttpError } from "@/lib/api";

export const apartmentCrudRoutes = createCrudRoutes({
  model: Apartment,
  createSchema: apartmentCreateSchema,
  updateSchema: apartmentUpdateSchema,
  access: {
    read: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT],
    create: [Role.ADMIN, Role.SYNDIC],
    update: [Role.ADMIN, Role.SYNDIC],
    delete: [Role.ADMIN, Role.SYNDIC],
  },
  searchFields: ["number"],
  defaultSort: { floor: 1, number: 1 },
  populate: [
    { path: "residence", select: "name city" },
    { path: "owner", select: "name email phone" },
  ],
  filterFields: ["residence", "isOccupied", "floor"],

  scope: async (user) => {
    // 1. ADMIN : accès global
    if (user.role === Role.ADMIN) {
      return {};
    }
    // 2. SYNDIC : appartements des résidences administrées
    if (user.role === Role.SYNDIC) {
      const syndicResidences = await getSyndicResidenceIds(user.id);
      return { residence: { $in: syndicResidences } };
    }
    // 3. RESIDENT : lecture de son propre appartement uniquement
    if (user.role === Role.RESIDENT) {
      const allowedAptIds = await getResidentApartmentIds(user.id);
      return { _id: { $in: allowedAptIds } };
    }
    return {};
  },

  beforeCreate: async (user, body) => {
    // Vérification des droits du syndic sur la résidence
    if (user.role === Role.SYNDIC) {
      const syndicResidences = await getSyndicResidenceIds(user.id);
      if (!syndicResidences.includes(String(body.residence))) {
        throw new HttpError(403, "Vous n'administrez pas cette résidence");
      }
    }

    // Vérification existence résidence
    if (!(await Residence.exists({ _id: body.residence }))) {
      throw new HttpError(404, "Résidence introuvable");
    }

    // Règle métier : Apartment unique sur {residence, number} avec erreur 409 lisible
    const existing = await Apartment.findOne({
      residence: body.residence,
      number: body.number,
    }).lean();

    if (existing) {
      throw new HttpError(
        409,
        `Un appartement portant le numéro "${body.number}" existe déjà dans cette résidence`
      );
    }
  },

  beforeDelete: async (id) => {
    // Règle métier : interdire la suppression d'un appartement qui a des charges
    const hasCharges = await Charge.exists({ apartment: id });
    if (hasCharges) {
      throw new HttpError(
        409,
        "Impossible de supprimer cet appartement car des charges y sont associées"
      );
    }
  },
});
