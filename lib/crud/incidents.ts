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
import { IncidentStatus, IncidentTimelineType, Role } from "@/types/enums";
import { HttpError } from "@/lib/api";
import { computeSlaDueAt } from "@/lib/incidents/sla";
import { findTechnicianForCategory } from "@/lib/incidents/autoAssign";
import { Priority } from "@/types/enums";

export const incidentCrudRoutes = createCrudRoutes({
  model: Incident,
  createSchema: incidentCreateSchema,
  updateSchema: incidentEditSchema,
  access: {
    // Tous les rôles peuvent lire (scopé) et créer
    read: [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT, Role.TECHNICIAN],
    create: [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT, Role.TECHNICIAN],
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
    { path: "timeline.by", select: "name role" },
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
    // 4. OWNER ou TENANT : uniquement ses incidents signalés
    if (user.role === Role.OWNER || user.role === Role.TENANT) {
      return { reportedBy: user.id };
    }
    return {};
  },

  injectOnCreate: async (user, body) => {
    // Règle de sécurité stricte : reportedBy est TOUJOURS session.user.id
    const priority = (body.priority as Priority) || Priority.MEDIUM;
    const now = new Date();
    return {
      reportedBy: user.id,
      syncedAt: now,
      slaDueAt: computeSlaDueAt(priority, now),
      slaBreached: false,
      beforePhotos: Array.isArray(body.photos) ? body.photos.slice(0, 3) : [],
      timeline: [
        {
          at: now,
          by: user.id,
          type: IncidentTimelineType.CREATED,
          message: "Incident signalé",
        },
      ],
    };
  },

  afterCreate: async (doc, user) => {
    // Auto-assignation par catégorie si aucun technicien n'est déjà posé
    if (doc.assignedTo) return;
    const techId = await findTechnicianForCategory(
      String(doc.residence),
      doc.category
    );
    if (!techId) return;

    doc.assignedTo = techId;
    if (doc.status === IncidentStatus.REPORTED) {
      doc.status = IncidentStatus.ASSIGNED;
    }
    doc.timeline = [
      ...(doc.timeline || []),
      {
        at: new Date(),
        by: user.id,
        type: IncidentTimelineType.ASSIGNED,
        message: "Technicien assigné automatiquement selon la catégorie",
        meta: { assignedTo: techId, auto: true },
      },
    ];
    await doc.save();
    if (typeof doc.populate === "function") {
      await doc.populate([
        { path: "assignedTo", select: "name email phone" },
      ]);
    }
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

    if (user.role === Role.OWNER || user.role === Role.TENANT) {
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
