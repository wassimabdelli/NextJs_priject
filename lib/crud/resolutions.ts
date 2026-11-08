import { createCrudRoutes } from "@/lib/crud/createCrudRoutes";
import { Resolution } from "@/models/Resolution";
import { Meeting } from "@/models/Meeting";
import { Vote } from "@/models/Vote";
import { getResidentResidenceIds, getSyndicResidenceIds } from "@/lib/auth-guard";
import { resolutionCreateSchema, resolutionUpdateSchema } from "@/lib/validations/governance";
import { Role } from "@/types/enums";
import { HttpError } from "@/lib/api";

export const resolutionCrudRoutes = createCrudRoutes({
  model: Resolution,
  createSchema: resolutionCreateSchema,
  updateSchema: resolutionUpdateSchema,
  access: {
    read: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT],
    create: [Role.ADMIN, Role.SYNDIC],
    update: [Role.ADMIN, Role.SYNDIC],
    delete: [Role.ADMIN, Role.SYNDIC],
  },
  searchFields: ["title", "description"],
  defaultSort: { createdAt: -1 },
  populate: [{ path: "meeting", select: "title date status residence" }],
  filterFields: ["meeting"],

  scope: async (user) => {
    if (user.role === Role.ADMIN) return {};
    if (user.role === Role.SYNDIC) {
      const resIds = await getSyndicResidenceIds(user.id);
      const meetingIds = await Meeting.find({ residence: { $in: resIds } }).distinct("_id");
      return { meeting: { $in: meetingIds } };
    }
    if (user.role === Role.RESIDENT) {
      const resIds = await getResidentResidenceIds(user.id);
      const meetingIds = await Meeting.find({ residence: { $in: resIds } }).distinct("_id");
      return { meeting: { $in: meetingIds } };
    }
    return {};
  },

  beforeCreate: async (user, body) => {
    const meeting = await Meeting.findById(body.meeting);
    if (!meeting) {
      throw new HttpError(404, "Assemblée générale introuvable");
    }
    if (user.role === Role.SYNDIC) {
      const syndicRes = await getSyndicResidenceIds(user.id);
      if (!syndicRes.includes(meeting.residence.toString())) {
        throw new HttpError(403, "Vous n'administrez pas la résidence de cette assemblée");
      }
    }
  },

  beforeDelete: async (id) => {
    const voteCount = await Vote.countDocuments({ resolution: id });
    if (voteCount > 0) {
      throw new HttpError(
        409,
        `Impossible de supprimer une résolution qui a déjà fait l'objet de ${voteCount} vote(s).`
      );
    }
  },
});
