import { createCrudRoutes } from "@/lib/crud/createCrudRoutes";
import { ResidenceDocument } from "@/models/Document";
import { Residence } from "@/models/Residence";
import { getResidentResidenceIds, getSyndicResidenceIds } from "@/lib/auth-guard";
import { documentCreateSchema, documentUpdateSchema } from "@/lib/validations/governance";
import { Role } from "@/types/enums";
import { HttpError } from "@/lib/api";

export const documentCrudRoutes = createCrudRoutes({
  model: ResidenceDocument,
  createSchema: documentCreateSchema,
  updateSchema: documentUpdateSchema,
  access: {
    read: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT],
    create: [Role.ADMIN, Role.SYNDIC],
    update: [Role.ADMIN, Role.SYNDIC],
    delete: [Role.ADMIN, Role.SYNDIC],
  },
  searchFields: ["title"],
  defaultSort: { uploadedAt: -1 },
  populate: [
    { path: "residence", select: "name city" },
    { path: "meeting", select: "title date" },
    { path: "uploadedBy", select: "name email" },
  ],
  filterFields: ["residence", "meeting", "type"],

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

  injectOnCreate: async (user) => {
    return {
      uploadedBy: user.id,
      uploadedAt: new Date(),
    };
  },
});
