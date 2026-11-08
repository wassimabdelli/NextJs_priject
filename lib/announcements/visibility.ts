import {
  AnnouncementAudience,
  AnnouncementStatus,
  Role,
  type AnnouncementAudience as AnnouncementAudienceType,
  type Role as RoleType,
} from "@/types/enums";

export interface AnnouncementVisibilityFields {
  status?: string;
  audience?: string;
  publishedAt?: Date | string | null;
  scheduledAt?: Date | string | null;
  expiresAt?: Date | string | null;
}

function toDate(value?: Date | string | null) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isAnnouncementVisible(
  announcement: AnnouncementVisibilityFields,
  role: RoleType,
  now = new Date()
) {
  if (announcement.status && announcement.status !== AnnouncementStatus.PUBLISHED) return false;
  const audience = announcement.audience ?? AnnouncementAudience.RESIDENTS;
  const allowedAudience: AnnouncementAudienceType[] = (role === Role.OWNER || role === Role.TENANT)
    ? [AnnouncementAudience.RESIDENTS, AnnouncementAudience.ALL]
    : role === Role.TECHNICIAN
    ? [AnnouncementAudience.TECHNICIANS, AnnouncementAudience.ALL]
    : [AnnouncementAudience.RESIDENTS, AnnouncementAudience.TECHNICIANS, AnnouncementAudience.ALL];
  if (!allowedAudience.includes(audience as AnnouncementAudienceType)) return false;

  const publishDate = toDate(announcement.scheduledAt) ?? toDate(announcement.publishedAt);
  const expiresAt = toDate(announcement.expiresAt);
  return (!publishDate || publishDate <= now) && (!expiresAt || expiresAt > now);
}

export function publishedAnnouncementFilter(now = new Date()) {
  return {
    $and: [
      { $or: [{ status: AnnouncementStatus.PUBLISHED }, { status: { $exists: false } }] },
      {
        $or: [
          { scheduledAt: null },
          { scheduledAt: { $exists: false } },
          { scheduledAt: { $lte: now } },
        ],
      },
      {
        $or: [
          { expiresAt: null },
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: now } },
        ],
      },
    ],
  };
}
