import mongoose from "mongoose";
import { HttpError } from "@/lib/api";
import {
  getResidentResidenceIds,
  getSyndicResidenceIds,
  getTechnicianResidenceIds,
  type AuthUser,
} from "@/lib/auth-guard";
import { AnnouncementAudience, Role } from "@/types/enums";
import type { IAnnouncement } from "@/models/Announcement";
import { isAnnouncementVisible } from "./visibility";

export async function getAnnouncementResidenceIds(user: AuthUser): Promise<string[] | null> {
  switch (user.role) {
    case Role.ADMIN:
      return null;
    case Role.SYNDIC:
      return getSyndicResidenceIds(user.id);
    case Role.OWNER:
    case Role.TENANT:
      return getResidentResidenceIds(user.id);
    case Role.TECHNICIAN:
      return getTechnicianResidenceIds(user.id);
    default:
      throw new HttpError(403, "Rôle non autorisé");
  }
}

export function announcementAudienceForRole(role: AuthUser["role"]) {
  switch (role) {
    case Role.OWNER:
    case Role.TENANT:
      return {
        $in: [AnnouncementAudience.RESIDENTS, AnnouncementAudience.ALL],
      };
    case Role.TECHNICIAN:
      return { $in: [AnnouncementAudience.TECHNICIANS, AnnouncementAudience.ALL] };
    case Role.ADMIN:
    case Role.SYNDIC:
      return { $in: [AnnouncementAudience.RESIDENTS, AnnouncementAudience.TECHNICIANS, AnnouncementAudience.ALL] };
    default:
      throw new HttpError(403, "Rôle non autorisé");
  }
}

export function announcementAudienceFilter(role: AuthUser["role"]) {
  const audience = announcementAudienceForRole(role);
  return (role === Role.OWNER || role === Role.TENANT)
    ? { $or: [{ audience }, { audience: { $exists: false } }] }
    : { audience };
}

export function canManageAnnouncement(user: AuthUser, announcement: Pick<IAnnouncement, "residence">, residenceIds: string[] | null) {
  if (user.role === Role.ADMIN) return true;
  if (user.role !== Role.SYNDIC || !residenceIds) return false;
  return residenceIds.includes(String(announcement.residence));
}

export function canReadAnnouncement(
  user: AuthUser,
  announcement: Pick<IAnnouncement, "residence" | "audience" | "status" | "scheduledAt" | "publishedAt" | "expiresAt">,
  residenceIds: string[] | null,
  now = new Date()
) {
  if (!residenceIds && user.role !== Role.ADMIN) return false;
  if (residenceIds && !residenceIds.includes(String(announcement.residence))) return false;
  if (user.role === Role.ADMIN || user.role === Role.SYNDIC) return true;
  if (!isAnnouncementVisible(announcement, user.role, now)) return false;
  return mongoose.isValidObjectId(user.id);
}
