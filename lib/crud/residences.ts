import { createCrudRoutes } from "@/lib/crud/createCrudRoutes";
import { Residence } from "@/models/Residence";
import { Apartment } from "@/models/Apartment";
import { Charge } from "@/models/Charge";
import { Incident } from "@/models/Incident";
import { getResidentApartmentIds, getSyndicResidenceIds } from "@/lib/auth-guard";
import { residenceCreateSchema, residenceUpdateSchema } from "@/lib/validations/residence";
import { Role, IncidentStatus } from "@/types/enums";
import { HttpError, json } from "@/lib/api";

const currentPeriod = () => new Date().toISOString().slice(0, 7);

export const residenceCrudRoutes = createCrudRoutes({
  model: Residence,
  createSchema: residenceCreateSchema,
  updateSchema: residenceUpdateSchema,
  access: {
    read: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT],
    create: [Role.ADMIN, Role.SYNDIC],
    update: [Role.ADMIN, Role.SYNDIC],
    delete: [Role.ADMIN, Role.SYNDIC],
  },
  searchFields: ["name", "city", "address"],
  defaultSort: { name: 1 },
  populate: [{ path: "syndic", select: "name email phone" }],
  filterFields: ["city", "syndic"],

  scope: async (user) => {
    if (user.role === Role.ADMIN) {
      return {};
    }
    if (user.role === Role.SYNDIC) {
      const syndicResidences = await getSyndicResidenceIds(user.id);
      return { _id: { $in: syndicResidences } };
    }
    if (user.role === Role.RESIDENT) {
      const residentAptIds = await getResidentApartmentIds(user.id);
      const residentResidenceIds = await Apartment.find({
        _id: { $in: residentAptIds },
      }).distinct("residence");
      return { _id: { $in: residentResidenceIds } };
    }
    return {};
  },

  injectOnCreate: async (user, body) => {
    // Si un SYNDIC crée la résidence et ne précise pas d'autre syndic, il s'assigne automatiquement
    return {
      syndic: body.syndic || (user.role === Role.SYNDIC ? user.id : undefined),
    };
  },

  beforeDelete: async (id) => {
    // Règle métier : interdire la suppression d'une résidence qui a des charges
    const aptIds = await Apartment.find({ residence: id }).distinct("_id");
    const hasCharges = await Charge.exists({ apartment: { $in: aptIds } });
    if (hasCharges) {
      throw new HttpError(
        409,
        "Impossible de supprimer cette résidence car des charges y sont rattachées"
      );
    }
    const hasApartments = await Apartment.exists({ residence: id });
    if (hasApartments) {
      throw new HttpError(
        409,
        "Impossible de supprimer cette résidence car des appartements y sont rattachés"
      );
    }
  },

  afterList: async (data, req) => {
    // Compatibilité descendante pour le tableau de bord avec ?withStats=1
    if (req.nextUrl.searchParams.get("withStats") === "1") {
      const period = req.nextUrl.searchParams.get("period") ?? currentPeriod();
      const withStats = await Promise.all(
        data.map(async (r: any) => {
          const [collectionRate, balance, openIncidents] = await Promise.all([
            Residence.getCollectionRate(r._id, period),
            Residence.getBalance(r._id),
            Incident.countDocuments({
              residence: r._id,
              status: { $ne: IncidentStatus.RESOLVED },
            }),
          ]);
          return {
            ...r,
            stats: { period, collectionRate, ...balance, openIncidents },
          };
        })
      );
      return json(withStats);
    }
    return undefined;
  },
});
