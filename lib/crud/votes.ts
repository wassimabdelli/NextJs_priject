import { createCrudRoutes } from "@/lib/crud/createCrudRoutes";
import { Vote } from "@/models/Vote";
import { Resolution } from "@/models/Resolution";
import { Meeting } from "@/models/Meeting";
import { Apartment } from "@/models/Apartment";
import {
  getResidentApartmentIds,
  getResidentResidenceIds,
  getSyndicResidenceIds,
} from "@/lib/auth-guard";
import { voteCreateSchema, voteUpdateSchema } from "@/lib/validations/governance";
import { MeetingStatus, Role } from "@/types/enums";
import { HttpError } from "@/lib/api";

export const voteCrudRoutes = createCrudRoutes({
  model: Vote,
  createSchema: voteCreateSchema,
  updateSchema: voteUpdateSchema,
  access: {
    read: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT],
    create: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT],
    update: [Role.ADMIN],
    delete: [Role.ADMIN],
  },
  searchFields: ["choice"],
  defaultSort: { votedAt: -1 },
  populate: [
    { path: "resolution", select: "title meeting requiredMajority" },
    { path: "apartment", select: "number shares floor" },
    { path: "voter", select: "name email" },
  ],
  filterFields: ["resolution", "apartment", "choice"],

  scope: async (user) => {
    if (user.role === Role.ADMIN) return {};
    if (user.role === Role.SYNDIC) {
      const resIds = await getSyndicResidenceIds(user.id);
      const meetingIds = await Meeting.find({ residence: { $in: resIds } }).distinct("_id");
      const resols = await Resolution.find({ meeting: { $in: meetingIds } }).distinct("_id");
      return { resolution: { $in: resols } };
    }
    if (user.role === Role.RESIDENT) {
      const myApts = await getResidentApartmentIds(user.id);
      return { apartment: { $in: myApts } };
    }
    return {};
  },

  beforeCreate: async (user, body) => {
    const resolution = await Resolution.findById(body.resolution);
    if (!resolution) {
      throw new HttpError(404, "Résolution introuvable");
    }

    const meeting = await Meeting.findById(resolution.meeting);
    if (!meeting) {
      throw new HttpError(404, "Assemblée générale introuvable");
    }

    // Règle métier : vote refusé si Meeting.status !== OPEN
    if (meeting.status !== MeetingStatus.OPEN) {
      throw new HttpError(
        400,
        `Le vote est refusé : l'assemblée générale n'est pas ouverte au vote (statut actuel : ${meeting.status}).`
      );
    }

    // Règle métier : appartement valide
    const apartment = await Apartment.findById(body.apartment);
    if (!apartment) {
      throw new HttpError(404, "Appartement introuvable");
    }

    // L'appartement doit appartenir à la même résidence que l'AG
    if (apartment.residence.toString() !== meeting.residence.toString()) {
      throw new HttpError(400, "Le lot n'appartient pas à la résidence de cette assemblée");
    }

    // Contrôle d'accès RESIDENT : ne peut voter qu'avec ses lots
    if (user.role === Role.RESIDENT) {
      const myApts = await getResidentApartmentIds(user.id);
      if (!myApts.includes(String(body.apartment))) {
        throw new HttpError(
          403,
          "Vous ne pouvez voter qu'au titre des lots dont vous êtes propriétaire ou résident"
        );
      }
    }

    // Règle métier : un seul vote par {resolution, apartment} (409 sinon)
    const existing = await Vote.findOne({
      resolution: body.resolution,
      apartment: body.apartment,
    });
    if (existing) {
      throw new HttpError(
        409,
        `Un vote a déjà été exprimé pour le lot ${apartment.number} sur cette résolution`
      );
    }
  },

  injectOnCreate: async (user, body) => {
    const apartment = await Apartment.findById(body.apartment);
    // Règle métier : weight = tantièmes du lot, voter = session.user.id
    return {
      voter: user.id,
      weight: apartment?.shares ?? 0,
      votedAt: new Date(),
    };
  },
});
