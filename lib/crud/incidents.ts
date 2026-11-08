import { createCrudRoutes } from "@/lib/crud/createCrudRoutes";
import { Incident } from "@/models/Incident";
import { Residence } from "@/models/Residence";
import {
  getResidentApartmentIds,
  getResidentResidenceIds,
  getSyndicResidenceIds,
  getTechnicianResidenceIds,
} from "@/lib/auth-guard";
import { incidentCreateSchema, incidentEditSchema } from "@/lib/validations/incident";
import { Role } from "@/types/enums";
import { HttpError } from "@/lib/api";
import { recordIncidentHistory } from "@/lib/incidents/recordHistory";
import { notifyIncidentHistory } from "@/lib/notifications/events";
import { computeAndStoreEmbedding } from "@/lib/ai/similarity";
import { GEMINI_MODEL } from "@/lib/ai/gemini";
import { TriageSchema } from "@/lib/ai/triage";
import {
  INCIDENT_READ_ROLES,
  isResidenceManagedBySyndic,
  technicianIncidentScope,
} from "@/lib/incidents/access-policy";

export const incidentCrudRoutes = createCrudRoutes({
  model: Incident,
  createSchema: incidentCreateSchema,
  updateSchema: incidentEditSchema,
  access: {
    read: [...INCIDENT_READ_ROLES],
    create: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT, Role.TECHNICIAN],
    update: [Role.ADMIN, Role.SYNDIC],
    delete: [Role.ADMIN, Role.SYNDIC],
  },
  searchFields: ["title", "description"],
  defaultSort: { reportedAt: -1 },
  allowedSortFields: ["reportedAt", "createdAt", "priority", "status"],
  populate: [
    { path: "residence", select: "name city" },
    { path: "apartment", select: "number floor" },
    { path: "reportedBy", select: "name email" },
    { path: "assignedTo", select: "name email phone" },
  ],
  filterFields: ["residence", "category", "priority", "status", "assignedTo"],
  dateField: "createdAt",
  exportColumns: [
    { key: "title", label: "Réclamation" },
    { key: "category", label: "Catégorie" },
    { key: "priority", label: "Priorité" },
    { key: "status", label: "Statut" },
    { key: "residence.name", label: "Résidence" },
    { key: "assignedTo.name", label: "Technicien" },
    { key: "createdAt", label: "Date de création" },
  ],
  exportPopulate: [
    { path: "residence", select: "name" },
    { path: "assignedTo", select: "name" },
  ],

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
      return technicianIncidentScope(user.id);
    }
    // 4. RESIDENT : uniquement ses incidents signalés
    if (user.role === Role.RESIDENT) {
      return { reportedBy: user.id };
    }
    return {};
  },

  injectOnCreate: async (user, body) => {
    // Règle de sécurité stricte : reportedBy est TOUJOURS session.user.id
    const parsedTriage = TriageSchema.safeParse(body?.aiTriage);
    const aiTriage = parsedTriage.success
      ? {
          category: parsedTriage.data.category,
          priority: parsedTriage.data.priority,
          specialty: parsedTriage.data.specialty,
          probableCause: parsedTriage.data.probableCause,
          safetyRisk: parsedTriage.data.safetyRisk,
          confidence: parsedTriage.data.confidence,
          model: process.env.GEMINI_API_KEY
            ? GEMINI_MODEL
            : process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
        }
      : undefined;
    return {
      reportedBy: user.id,
      syncedAt: new Date(),
      ...(aiTriage ? { aiTriage } : {}),
    };
  },

  beforeCreate: async (user, body) => {
    const residenceExists = await Residence.exists({ _id: body.residence });
    if (!residenceExists) {
      throw new HttpError(404, "Résidence introuvable");
    }

    if (user.role === Role.SYNDIC) {
      const syndicResidences = await getSyndicResidenceIds(user.id);
      if (!isResidenceManagedBySyndic(String(body.residence), syndicResidences)) {
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
  afterCreate: async (doc, user) => {
    void computeAndStoreEmbedding(String(doc._id), {
      title: doc.title,
      description: doc.description,
    }).catch((error: unknown) => {
      console.warn("[ai] failed to schedule incident embedding", error);
    });
    const history = await recordIncidentHistory({
      incidentId: doc._id,
      actorId: user.id,
      action: "CREATED",
      description: "Incident signalé",
    });
    await notifyIncidentHistory(String(history._id), String(doc._id), "CREATED", user.id);
  },
});
