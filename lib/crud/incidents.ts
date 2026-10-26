import { createCrudRoutes } from "@/lib/crud/createCrudRoutes";
import { Incident } from "@/models/Incident";
import { Residence } from "@/models/Residence";
import { Apartment } from "@/models/Apartment";
import {
  getResidentApartmentIds,
  getResidentResidenceIds,
  getSyndicResidenceIds,
  getTechnicianResidenceIds,
} from "@/lib/auth-guard";
import { incidentCreateSchema, incidentEditSchema } from "@/lib/validations/incident";
import { Role } from "@/types/enums";
import { HttpError } from "@/lib/api";

export const incidentCrudRoutes = createCrudRoutes({
  model: Incident,
  createSchema: incidentCreateSchema,
  updateSchema: incidentEditSchema,
  access: {
    // Tous les rôles peuvent lire (scopé) et créer
    read: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT, Role.TECHNICIAN],
    create: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT, Role.TECHNICIAN],
    update: [Role.ADMIN, Role.SYNDIC],
    delete: [Role.ADMIN, Role.SYNDIC],
  },
  searchFields: ["title", "description"],
  defaultSort: { reportedAt: -1 },
  populate: [
    { path: "residence", select: "name city" },
    { path: "apartment", select: "number floor" },
    { path: "reportedBy", select: "name email" },
    { path: "assignedTo", select: "name email phone" },
  ],
  filterFields: ["residence", "category", "priority", "status"],

  scope: async (user) => {
    // 1. ADMIN : accès global
    if (user.role === Role.ADMIN) {
      return {};
    }
    // 2. SYNDIC : incidents de ses résidences
    if (user.role === Role.SYNDIC) {
      const residenceIds = await getSyndicResidenceIds(user.id);
      return { residence: { $in: residenceIds } };
    }
    // 3. TECHNICIAN : uniquement les incidents qui lui sont assignés
    if (user.role === Role.TECHNICIAN) {
      return { assignedTo: user.id };
    }
    // 4. RESIDENT : uniquement ses incidents signalés
    if (user.role === Role.RESIDENT) {
      return { reportedBy: user.id };
    }
    return {};
  },

  injectOnCreate: async (user) => {
    // Règle de sécurité stricte : reportedBy est TOUJOURS session.user.id
    return {
      reportedBy: user.id,
      syncedAt: new Date(),
    };
  },

  beforeCreate: async (user, body) => {
    const residenceExists = await Residence.exists({ _id: body.residence });
    if (!residenceExists) {
      throw new HttpError(404, "Résidence introuvable");
    }

    if (user.role === Role.SYNDIC) {
      const syndicResidences = await getSyndicResidenceIds(user.id);
      if (!syndicResidences.includes(String(body.residence))) {
        throw new HttpError(403, "Vous n'administrez pas cette résidence");
      }
    }

    if (user.role === Role.RESIDENT) {
      const residentResidences = await getResidentResidenceIds(user.id);
      if (!residentResidences.includes(String(body.residence))) {
        throw new HttpError(
          403,
          "Vous ne pouvez pas signaler un incident pour une résidence qui n'est pas la vôtre"
        );
      }
      if (body.apartment) {
        const allowedAptIds = await getResidentApartmentIds(user.id);
        if (!allowedAptIds.includes(String(body.apartment))) {
          throw new HttpError(
            403,
            "Vous ne pouvez pas signaler un incident pour un appartement qui n'est pas le vôtre"
          );
        }
      }
    }

    if (user.role === Role.TECHNICIAN) {
      const technicianResidences = await getTechnicianResidenceIds(user.id);
      if (!technicianResidences.includes(String(body.residence))) {
        throw new HttpError(
          403,
          "Vous ne pouvez pas signaler un incident pour une résidence qui ne vous est pas assignée"
        );
      }
    }
  },
});
