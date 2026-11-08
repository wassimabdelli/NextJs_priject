import type {
  AnnouncementAudience,
  AnnouncementCategory,
  AnnouncementPriority,
  AnnouncementStatus,
} from "@/types/enums";

export interface AnnouncementAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface AnnouncementItem {
  _id: string;
  residence: string | { _id: string; name: string; city?: string };
  author?: string | { _id: string; name: string };
  title: string;
  content: string;
  publishedAt: string;
  scheduledAt?: string | null;
  expiresAt?: string | null;
  isPinned: boolean;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  attachments: AnnouncementAttachment[];
  isRead?: boolean;
  readStats?: {
    totalEligibleResidents: number;
    readCount: number;
    unreadCount: number;
    readPercentage: number;
  };
}

export interface AnnouncementResidence {
  _id: string;
  name: string;
  city?: string;
}
