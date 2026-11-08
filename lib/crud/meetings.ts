import { createCrudRoutes } from "@/lib/crud/createCrudRoutes";
import { Meeting } from "@/models/Meeting";
import { Residence } from "@/models/Residence";
import { Resolution } from "@/models/Resolution";
import { getResidentResidenceIds, getSyndicResidenceIds } from "@/lib/auth-guard";
import { meetingCreateSchema, meetingUpdateSchema } from "@/lib/validations/governance";
import { Role } from "@/types/enums";
import { HttpError } from "@/lib/api";

export const meetingCrudRoutes = createCrudRoutes({
  model: Meeting,
  createSchema: meetingCreateSchema,
  updateSchema: meetingUpdateSchema,
  access: {
    read: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT],
    create: [Role.ADMIN, Role.SYNDIC],
    update: [Role.ADMIN, Role.SYNDIC],
    delete: [Role.ADMIN, Role.SYNDIC],
  },
  searchFields: ["title", "location", "agenda"],
  defaultSort: { date: -1 },
  populate: [{ path: "residence", select: "name city address" }],
  filterFields: ["residence", "status"],

  scope: async (user) => {
    if (user.role === Role.ADMIN) return {};
    if (user.role === Role.SYNDIC) {
      const resIds = await getSyndicResidenceIds(user.id);
      return { residence: { $in: resIds } };
    }
    if (user.role === Role.RESIDENT) {
      const resIds = await getResidentResidenceIds(user.id);
      return { residence: { $in: resIds } };
    }
    return {};
  },

  beforeCreate: async (user, body) => {
    const residenceExists = await Residence.exists({ _id: body.residence });
    if (!residenceExists) {
      throw new HttpError(404, "Résidence introuvable");
    }
    if (user.role === Role.SYNDIC) {
      const syndicRes = await getSyndicResidenceIds(user.id);
      if (!syndicRes.includes(String(body.residence))) {
        throw new HttpError(403, "Vous n'administrez pas cette résidence");
      }
    }
  },

  beforeDelete: async (id) => {
    const resolutionCount = await Resolution.countDocuments({ meeting: id });
    if (resolutionCount > 0) {
      throw new HttpError(
        409,
        `Impossible de supprimer une assemblée qui contient ${resolutionCount} résolution(s). Supprimez d'abord les résolutions.`
      );
    }
  },
});
