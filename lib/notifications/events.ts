import mongoose from "mongoose";
import { Incident } from "@/models/Incident";
import { IncidentHistory, type IncidentHistoryAction } from "@/models/IncidentHistory";
import { AnnouncementHistory, type AnnouncementHistoryAction } from "@/models/AnnouncementHistory";
import { Residence } from "@/models/Residence";
import { User } from "@/models/User";
import { getEligibleResidentIdsByResidence } from "@/lib/announcements/readStats";
import { deliverNotificationSafely } from "./notification-service";
import { AnnouncementAudience, AnnouncementPriority, Role } from "@/types/enums";
import type { NotificationType } from "@/models/Notification";
import type { IAnnouncement } from "@/models/Announcement";

type IncidentNotificationAction = Extract<
  IncidentHistoryAction,
  | "CREATED"
  | "ASSIGNED"
  | "STATUS_CHANGED"
  | "COMMENT_ADDED"
  | "RESOLUTION_SUBMITTED"
  | "RESOLUTION_CONFIRMED"
  | "RESOLUTION_REJECTED"
>;

const incidentMessages: Record<IncidentNotificationAction, { type: NotificationType; title: string; message: string }> = {
  CREATED: {
    type: "INCIDENT_CREATED",
    title: "Nouvelle réclamation",
    message: "Une nouvelle réclamation a été signalée dans une résidence que vous gérez.",
  },
  ASSIGNED: {
    type: "INCIDENT_ASSIGNED",
    title: "Nouvelle réclamation assignée",
    message: "Une réclamation vous a été assignée.",
  },
  STATUS_CHANGED: {
    type: "INCIDENT_STATUS_CHANGED",
    title: "Mise à jour de réclamation",
    message: "Le statut de votre réclamation a été mis à jour.",
  },
  COMMENT_ADDED: {
    type: "INCIDENT_COMMENTED",
    title: "Nouveau commentaire",
    message: "Un nouveau commentaire a été ajouté à une réclamation à laquelle vous participez.",
  },
  RESOLUTION_SUBMITTED: {
    type: "INCIDENT_RESOLUTION_SUBMITTED",
    title: "Résolution proposée",
    message: "Une proposition de résolution attend votre vérification.",
  },
  RESOLUTION_CONFIRMED: {
    type: "INCIDENT_RESOLUTION_CONFIRMED",
    title: "Résolution confirmée",
    message: "La résolution de la réclamation a été confirmée.",
  },
  RESOLUTION_REJECTED: {
    type: "INCIDENT_RESOLUTION_REJECTED",
    title: "Résolution à revoir",
    message: "La proposition de résolution a été refusée et nécessite un suivi.",
  },
};

async function syndicId(residenceId: string) {
  const residence = await Residence.findById(residenceId).select("syndic").lean();
  return residence?.syndic ? String(residence.syndic) : null;
}

export async function notifyIncidentHistory(
  historyId: string,
  incidentId: string,
  action: IncidentNotificationAction,
  actorId: string
) {
  try {
    const [incident, history] = await Promise.all([
      Incident.findById(incidentId).select("residence reportedBy assignedTo category").lean(),
      IncidentHistory.findById(historyId).select("_id").lean(),
    ]);
    if (!incident || !history) return;

    const residenceId = String(incident.residence);
    const managerId = await syndicId(residenceId);
    const targets = new Set<string>();
    switch (action) {
      case "CREATED":
        if (managerId) targets.add(managerId);
        break;
      case "ASSIGNED":
        if (incident.assignedTo) targets.add(String(incident.assignedTo));
        break;
      case "STATUS_CHANGED":
      case "RESOLUTION_SUBMITTED":
        if (incident.reportedBy) targets.add(String(incident.reportedBy));
        if (action === "RESOLUTION_SUBMITTED" && managerId) targets.add(managerId);
        break;
      case "COMMENT_ADDED":
        if (incident.reportedBy) targets.add(String(incident.reportedBy));
        if (incident.assignedTo) targets.add(String(incident.assignedTo));
        if (managerId) targets.add(managerId);
        break;
      case "RESOLUTION_CONFIRMED":
      case "RESOLUTION_REJECTED":
        if (incident.assignedTo) targets.add(String(incident.assignedTo));
        if (managerId) targets.add(managerId);
        break;
    }
    targets.delete(actorId);
    if (targets.size === 0) return;

    const copy = incidentMessages[action];
    await deliverNotificationSafely([...targets], {
      actorId,
      type: copy.type,
      title: copy.title,
      message: action === "CREATED"
        ? `Une nouvelle réclamation ${incident.category.toLowerCase()} a été signalée dans une résidence que vous gérez.`
        : copy.message,
      resourceType: "INCIDENT",
      resourceId: incidentId,
      residenceId,
      eventKey: `incident-history:${historyId}`,
    });
  } catch (error) {
    console.error("[notifications] Incident event could not be prepared", {
      historyId,
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }
}

export async function notifyAnnouncementPublished(
  announcement: Pick<IAnnouncement, "residence" | "audience" | "title" | "priority"> & { _id: mongoose.Types.ObjectId | string },
  eventKey: string,
  actorId?: string
) {
  try {
    const residenceId = String(announcement.residence);
    const audience = announcement.audience ?? AnnouncementAudience.RESIDENTS;
    const priority = announcement.priority ?? AnnouncementPriority.NORMAL;
    const normalizedAnnouncement = { ...announcement, audience, priority };
    await recordAnnouncementActivity(normalizedAnnouncement, "PUBLISHED", eventKey, actorId);
    const recipients = new Set<string>();
    if (
      audience === AnnouncementAudience.RESIDENTS ||
      audience === AnnouncementAudience.ALL
    ) {
      const residentIds = (await getEligibleResidentIdsByResidence([residenceId])).get(residenceId);
      for (const id of residentIds ?? []) recipients.add(id);
    }
    if (
      audience === AnnouncementAudience.TECHNICIANS ||
      audience === AnnouncementAudience.ALL
    ) {
      const assignedTechnicians = await Incident.distinct("assignedTo", {
        residence: new mongoose.Types.ObjectId(residenceId),
        assignedTo: { $ne: null },
      });
      const activeTechnicians = await User.distinct("_id", {
        _id: { $in: assignedTechnicians },
        role: Role.TECHNICIAN,
        isActive: true,
      });
      for (const id of activeTechnicians) recipients.add(String(id));
    }
    if (recipients.size === 0) return;
    await deliverNotificationSafely([...recipients], {
      type: "ANNOUNCEMENT_PUBLISHED",
      title: priority === "URGENT" ? "Annonce urgente" : priority === "HIGH" ? "Annonce importante" : "Nouvelle annonce",
      message: announcement.title,
      resourceType: "ANNOUNCEMENT",
      resourceId: String(announcement._id),
      residenceId,
      eventKey,
      metadata: { priority },
    });
  } catch (error) {
    console.error("[notifications] Announcement event could not be prepared", {
      eventKey,
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }
}

export async function recordAnnouncementActivity(
  announcement: Pick<IAnnouncement, "residence" | "audience" | "title" | "priority"> & { _id: mongoose.Types.ObjectId | string },
  action: AnnouncementHistoryAction,
  eventKey: string,
  actorId?: string
) {
  try {
    const audience = announcement.audience ?? AnnouncementAudience.RESIDENTS;
    const priority = announcement.priority ?? AnnouncementPriority.NORMAL;
    await AnnouncementHistory.updateOne(
      { eventKey },
      {
        $setOnInsert: {
          announcement: announcement._id,
          residence: announcement.residence,
          actor: actorId ?? null,
          action,
          title: announcement.title,
          audience,
          priority,
          eventKey,
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error("[activity] Announcement event could not be recorded", {
      eventKey,
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }
}
