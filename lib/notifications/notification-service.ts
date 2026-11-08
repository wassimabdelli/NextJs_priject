import mongoose from "mongoose";
import { User } from "@/models/User";
import { Notification, notificationTypes, type NotificationType, type NotificationResourceType } from "@/models/Notification";
import { Incident } from "@/models/Incident";
import { Announcement } from "@/models/Announcement";
import { Residence } from "@/models/Residence";
import { getEligibleResidentIdsByResidence } from "@/lib/announcements/readStats";
import { AnnouncementAudience, AnnouncementStatus, Role } from "@/types/enums";

export interface NotificationInput {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  resourceType: NotificationResourceType;
  resourceId?: string;
  residenceId?: string;
  eventKey: string;
  metadata?: Record<string, string | number | boolean>;
}

function isObjectId(value: string | null | undefined): value is string {
  return Boolean(value && mongoose.isValidObjectId(value));
}

async function activeRecipients(ids: string[]) {
  const validIds = [...new Set(ids.filter(isObjectId))];
  if (!validIds.length) return [];
  return User.find({
    _id: { $in: validIds },
    isActive: true,
    role: { $in: Object.values(Role) },
  }).select("_id role").lean();
}

async function authorizedRecipients(
  candidates: Awaited<ReturnType<typeof activeRecipients>>,
  notification: Omit<NotificationInput, "recipientId">
) {
  if (candidates.length === 0) return new Set<string>();
  const candidateIds = candidates.map((user) => String(user._id));
  if (notification.resourceType === "SYSTEM") {
    return new Set(candidates.filter((user) => user.role === Role.ADMIN).map((user) => String(user._id)));
  }
  if (!notification.resourceId || !notification.residenceId) return new Set<string>();

  if (notification.resourceType === "INCIDENT") {
    const incident = await Incident.findById(notification.resourceId)
      .select("residence reportedBy assignedTo")
      .lean();
    if (!incident || String(incident.residence) !== notification.residenceId) return new Set<string>();
    const managerIds = await Residence.distinct("syndic", {
      _id: notification.residenceId,
      syndic: { $in: candidateIds },
    });
    const managerSet = new Set(managerIds.map(String));
    const reporterId = incident.reportedBy ? String(incident.reportedBy) : null;
    const assignedTechnicianId = incident.assignedTo ? String(incident.assignedTo) : null;
    return new Set(candidates
      .filter((user) => {
        const id = String(user._id);
        return user.role === Role.ADMIN ||
          (user.role === Role.SYNDIC && managerSet.has(id)) ||
          (user.role === Role.RESIDENT && id === reporterId) ||
          (user.role === Role.TECHNICIAN && id === assignedTechnicianId);
      })
      .map((user) => String(user._id)));
  }

  const announcement = await Announcement.findById(notification.resourceId)
    .select("residence audience status scheduledAt expiresAt")
    .lean();
  const now = new Date();
  if (
    !announcement ||
    String(announcement.residence) !== notification.residenceId ||
    (announcement.status ?? AnnouncementStatus.PUBLISHED) !== AnnouncementStatus.PUBLISHED ||
    (announcement.scheduledAt && announcement.scheduledAt > now) ||
    (announcement.expiresAt && announcement.expiresAt <= now)
  ) return new Set<string>();

  const audience = announcement.audience ?? AnnouncementAudience.RESIDENTS;
  const allowed = new Set<string>();
  if (audience === AnnouncementAudience.RESIDENTS || audience === AnnouncementAudience.ALL) {
    const residentIds = (await getEligibleResidentIdsByResidence([notification.residenceId]))
      .get(notification.residenceId);
    for (const id of residentIds ?? []) allowed.add(id);
  }
  if (audience === AnnouncementAudience.TECHNICIANS || audience === AnnouncementAudience.ALL) {
    const assigned = await Incident.distinct("assignedTo", {
      residence: notification.residenceId,
      assignedTo: { $ne: null },
    });
    const technicians = await User.distinct("_id", {
      _id: { $in: assigned },
      role: Role.TECHNICIAN,
      isActive: true,
    });
    for (const id of technicians) allowed.add(String(id));
  }
  return new Set(candidates
    .filter((user) => user.role !== Role.ADMIN && user.role !== Role.SYNDIC && allowed.has(String(user._id)))
    .map((user) => String(user._id)));
}

export async function createNotification(input: NotificationInput): Promise<void> {
  const { recipientId, ...notification } = input;
  await notifyUsers([recipientId], notification);
}

export async function notifyUsers(
  recipientIds: string[],
  notification: Omit<NotificationInput, "recipientId">
): Promise<void> {
  if (
    !Array.isArray(recipientIds) ||
    recipientIds.some((id) => !isObjectId(id)) ||
    typeof notification.eventKey !== "string" ||
    !notification.eventKey ||
    notification.eventKey.length > 200 ||
    typeof notification.title !== "string" ||
    notification.title.trim().length === 0 ||
    notification.title.length > 160 ||
    typeof notification.message !== "string" ||
    notification.message.trim().length === 0 ||
    notification.message.length > 500 ||
    !notificationTypes.includes(notification.type) ||
    !["INCIDENT", "ANNOUNCEMENT", "SYSTEM"].includes(notification.resourceType) ||
    (notification.resourceType !== "SYSTEM" && (!notification.resourceId || !notification.residenceId)) ||
    (notification.resourceId !== undefined && !isObjectId(notification.resourceId)) ||
    (notification.residenceId !== undefined && !isObjectId(notification.residenceId)) ||
    (notification.actorId != null && !isObjectId(notification.actorId))
  ) {
    throw new Error("Invalid notification event");
  }

  const candidates = await activeRecipients(recipientIds);
  const recipients = await authorizedRecipients(candidates, notification);
  if (recipients.size === 0) return;
  const resourceId = notification.resourceId
    ? new mongoose.Types.ObjectId(notification.resourceId)
    : null;
  const residenceId = notification.residenceId
    ? new mongoose.Types.ObjectId(notification.residenceId)
    : null;
  const actorId = notification.actorId
    ? new mongoose.Types.ObjectId(notification.actorId)
    : null;

  const documents = [...recipients].map((recipient) => ({
    updateOne: {
      filter: { recipient: new mongoose.Types.ObjectId(recipient), eventKey: notification.eventKey },
      update: {
        $setOnInsert: {
          recipient: new mongoose.Types.ObjectId(recipient),
          actor: actorId,
          type: notification.type,
          title: notification.title.trim(),
          message: notification.message.trim(),
          relatedResource: { resourceType: notification.resourceType, resourceId },
          residence: residenceId,
          metadata: notification.metadata ?? {},
          eventKey: notification.eventKey,
          isRead: false,
          readAt: null,
        },
      },
      upsert: true,
    },
  }));

  try {
    for (let offset = 0; offset < documents.length; offset += 500) {
      await Notification.bulkWrite(documents.slice(offset, offset + 500), { ordered: false });
    }
  } catch (error) {
    console.error("[notifications] Failed to deliver notification batch", {
      eventKey: notification.eventKey,
      recipients: recipients.size,
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }
}

export async function deliverNotificationSafely(
  recipientIds: string[],
  notification: Omit<NotificationInput, "recipientId">
) {
  try {
    await notifyUsers(recipientIds, notification);
  } catch (error) {
    console.error("[notifications] Failed to prepare notification", {
      eventKey: notification.eventKey,
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }
}
