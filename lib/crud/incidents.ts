import { createCrudRoutes } from "@/lib/crud/createCrudRoutes";
import { Incident } from "@/models/Incident";
import { Residence } from "@/models/Residence";
import { Apartment } from "@/models/Apartment";
import { User } from "@/models/User";
import {
  getResidentApartmentIds,
  getResidentResidenceIds,
  getSyndicResidenceIds,
  getTechnicianResidenceIds,
} from "@/lib/auth-guard";
import { incidentCreateSchema, incidentEditSchema } from "@/lib/validations/incident";
import {
  incidentCategoryLabel,
  IncidentStatus,
  IncidentTimelineType,
  Priority,
  priorityLabel,
  ReminderType,
  Role,
  type IncidentCategory,
} from "@/types/enums";
import { HttpError } from "@/lib/api";
import { computeSlaDueAt } from "@/lib/incidents/sla";
import { findTechnicianForCategory } from "@/lib/incidents/autoAssign";
import { notifyUser } from "@/lib/notifications/notify";

/**
 * Notifie le syndic de la résidence (In-App + WhatsApp/Push selon ses préférences)
 * dès qu'un nouvel incident est créé.
 */
async function notifySyndicOnIncidentCreated(doc: {
  _id: unknown;
  residence: unknown;
  title?: string;
  category?: IncidentCategory;
  priority?: Priority;
  apartment?: unknown;
}): Promise<void> {
  try {
    const residence = await Residence.findById(doc.residence)
      .select("name syndic")
      .lean();

    const recipientIds = new Set<string>();
    if (residence?.syndic) {
      recipientIds.add(String(residence.syndic));
    } else {
      // Repli si aucun syndic n'est encore affecté à la résidence
      const syndics = await User.find({ role: Role.SYNDIC, isActive: true })
        .select("_id")
        .lean();
      for (const s of syndics) recipientIds.add(String(s._id));
    }

    if (recipientIds.size === 0) return;

    const catLabel = doc.category ? incidentCategoryLabel[doc.category] : "Incident";
    const prioLabel = doc.priority ? priorityLabel[doc.priority] : "Moyenne";
    const apt = doc.apartment
      ? await Apartment.findById(doc.apartment).select("number").lean()
      : null;
    const lotText = apt?.number ? ` · Lot ${apt.number}` : "";
    const residenceName = residence?.name || "Résidence";

    const title = "Nouvel incident signalé";
    const body = `${residenceName}${lotText} · ${catLabel} (priorité ${prioLabel}) : ${doc.title || "Sans titre"}`;

    for (const userId of recipientIds) {
      await notifyUser({
        userId,
        type: ReminderType.INCIDENT_CREATED,
        title,
        body,
        dedupeKey: `incident-created:${String(doc._id)}:${userId}`,
        meta: {
          incidentId: String(doc._id),
          residenceId: String(doc.residence),
        },
      });
    }
  } catch (err) {
    console.error("[incidents] Échec notification syndic à la création:", err);
  }
}

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
    await notifySyndicOnIncidentCreated(doc);

    // Auto-assignation par catégorie si aucun technicien n'est déjà posé
    if (doc.assignedTo) return;
    const techId = await findTechnicianForCategory(
      String(doc.residence),
      doc.category
    );
    if (!techId) return;

    const nextStatus =
      doc.status === IncidentStatus.REPORTED
        ? IncidentStatus.ASSIGNED
        : doc.status;
    const assignedEntry = {
      at: new Date(),
      by: user.id,
      type: IncidentTimelineType.ASSIGNED,
      message: "Technicien assigné automatiquement selon la catégorie",
      meta: { assignedTo: techId, auto: true },
    };

    doc.assignedTo = techId;
    doc.status = nextStatus;
    doc.timeline = [...(doc.timeline || []), assignedEntry];

    // createCrudRoutes passe un objet simple (.toObject()) à afterCreate
    if (typeof doc.save === "function") {
      await doc.save();
    } else {
      await Incident.findByIdAndUpdate(doc._id, {
        $set: { assignedTo: techId, status: nextStatus },
        $push: { timeline: assignedEntry },
      });
    }
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
