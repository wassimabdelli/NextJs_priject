import { Badge } from "@/components/ui/Badge";
import type { AnnouncementAudience, AnnouncementPriority, AnnouncementCategory, AnnouncementStatus } from "@/types/enums";

const priorityClasses: Record<AnnouncementPriority, string> = {
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  NORMAL: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  HIGH: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  URGENT: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

const statusNames: Record<AnnouncementStatus | "EXPIRED", string> = {
  DRAFT: "Brouillon",
  SCHEDULED: "Programmée",
  PUBLISHED: "Publiée",
  ARCHIVED: "Archivée",
  EXPIRED: "Expirée",
};

const categoryNames: Record<AnnouncementCategory, string> = {
  GENERAL: "Général",
  MAINTENANCE: "Maintenance",
  SECURITY: "Sécurité",
  MEETING: "Réunion",
  PAYMENT: "Paiement",
  EMERGENCY: "Urgence",
  OTHER: "Autre",
};

export function AnnouncementPriorityBadge({ priority }: { priority: AnnouncementPriority }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClasses[priority]}`}>{priority}</span>;
}

export function AnnouncementStatusBadge({ status }: { status: AnnouncementStatus | "EXPIRED" }) {
  const variant = status === "PUBLISHED" ? "success" : status === "SCHEDULED" ? "info" : status === "EXPIRED" ? "warning" : "neutral";
  return <Badge variant={variant}>{statusNames[status]}</Badge>;
}

export function AnnouncementCategoryBadge({ category }: { category: AnnouncementCategory }) {
  return <Badge variant="neutral">{categoryNames[category]}</Badge>;
}

export function AnnouncementAudienceLabel({ audience }: { audience: AnnouncementAudience }) {
  return <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{audience === "ALL" ? "Tous" : audience === "RESIDENTS" ? "Résidents" : "Techniciens"}</span>;
}
