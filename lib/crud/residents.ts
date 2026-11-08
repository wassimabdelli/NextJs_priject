import { createCrudRoutes } from "@/lib/crud/createCrudRoutes";
import { Resident } from "@/models/Resident";
import { Apartment } from "@/models/Apartment";
import { User } from "@/models/User";
import { Residence } from "@/models/Residence";
import { getResidentApartmentIds, getSyndicResidenceIds } from "@/lib/auth-guard";
import { residentCreateSchema, residentUpdateSchema } from "@/lib/validations/resident";
import { Role } from "@/types/enums";
import { HttpError } from "@/lib/api";

async function getSyndicApartmentIds(userId: string): Promise<string[]> {
  const residenceIds = await getSyndicResidenceIds(userId);
  const apartmentIds = await Apartment.find({ residence: { $in: residenceIds } }).distinct("_id");
  return apartmentIds.map(String);
}

async function validateResidentAccount(userId?: string): Promise<void> {
  if (!userId) return;

  const account = await User.findOne({
    _id: userId,
    role: Role.RESIDENT,
    isActive: { $ne: false },
  })
    .select("_id")
    .lean();

  if (!account) {
    throw new HttpError(400, "Le compte associé doit être un compte résident actif");
  }
}

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
    { path: "residence", select: "name" },
    { path: "user", select: "name email" },
  ],
  filterFields: ["apartment", "residence", "type", "isActive"],
  dateField: "moveInDate",
  exportPopulate: [{ path: "apartment", select: "number" }],
  exportColumns: [
    { key: "fullName", label: "Nom" },
    { key: "phone", label: "Téléphone" },
    { key: "email", label: "Email" },
    { key: "type", label: "Type" },
    { key: "apartment.number", label: "Appartement" },
    { key: "residence.name", label: "Résidence" },
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
      const aptIds = await getSyndicApartmentIds(user.id);
      const residenceIds = await getSyndicResidenceIds(user.id);
      return {
        $or: [
          { apartment: { $in: aptIds } },
          { residence: { $in: residenceIds } },
        ],
      };
    }
    // 3. RESIDENT : résidents de son propre appartement
    if (user.role === Role.RESIDENT) {
      const allowedAptIds = await getResidentApartmentIds(user.id);
      return { apartment: { $in: allowedAptIds } };
    }
    return {};
  },

  beforeCreate: async (user, body) => {
    let residenceId = body.residence;
    if (body.apartment) {
      const apartment = await Apartment.findById(body.apartment).select("residence").lean();
      if (!apartment) throw new HttpError(404, "Appartement introuvable");
      residenceId = String(apartment.residence);
      body.residence = residenceId;
    }

    if (!residenceId || !(await Residence.exists({ _id: residenceId }))) {
      throw new HttpError(404, "Résidence introuvable");
    }
    if (user.role === Role.SYNDIC) {
      const syndicResidences = await getSyndicResidenceIds(user.id);
      if (!syndicResidences.includes(String(residenceId))) {
        throw new HttpError(403, "Vous n'administrez pas cette résidence");
      }
    }
    await validateResidentAccount(body.user);
  },

  beforeUpdate: async (id, user, body) => {
    const managedApartmentIds =
      user.role === Role.SYNDIC ? await getSyndicApartmentIds(user.id) : null;
    const managedResidenceIds =
      user.role === Role.SYNDIC ? await getSyndicResidenceIds(user.id) : null;
    const currentResident = await Resident.findById(id)
      .select("apartment residence")
      .lean();

    if (!currentResident) {
      throw new HttpError(404, "Ressource introuvable ou modification non autorisée");
    }
    if (
      managedApartmentIds &&
      managedResidenceIds &&
      !(
        (currentResident.apartment &&
          managedApartmentIds.includes(String(currentResident.apartment))) ||
        (currentResident.residence &&
          managedResidenceIds.includes(String(currentResident.residence)))
      )
    ) {
      throw new HttpError(404, "Ressource introuvable ou modification non autorisée");
    }

    if (body.residence !== undefined) {
      const residence = await Residence.findById(body.residence).select("_id").lean();
      if (!residence) throw new HttpError(404, "Résidence introuvable");
      if (currentResident.apartment) {
        const apartment = await Apartment.findById(currentResident.apartment)
          .select("residence")
          .lean();
        if (!apartment || String(apartment.residence) !== String(body.residence)) {
          throw new HttpError(400, "La résidence d'un résident déjà associé à un lot ne peut pas être modifiée");
        }
      }
      if (managedResidenceIds && !managedResidenceIds.includes(String(body.residence))) {
        throw new HttpError(403, "Vous n'administrez pas cette résidence");
      }
    }

    const requestedUserId = body.user;
    if (requestedUserId !== undefined && typeof requestedUserId !== "string") {
      throw new HttpError(400, "Identifiant de compte invalide");
    }
    await validateResidentAccount(requestedUserId);
  },

  afterDelete: async (deletedResident) => {
    await Apartment.updateOne(
      { resident: deletedResident._id },
      { $unset: { resident: 1 } }
    );
  },
});
