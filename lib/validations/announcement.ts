import { z } from "zod";
import {
  AnnouncementAudience,
  AnnouncementCategory,
  AnnouncementPriority,
  AnnouncementStatus,
  values,
} from "@/types/enums";
import { date, objectId } from "./common";

/** Tuple non vide pour z.enum (Zod 4). */
function enumTuple<T extends string>(vals: readonly T[]) {
  return vals as [T, ...T[]];
}

const announcementCategories = enumTuple(values(AnnouncementCategory));
const announcementPriorities = enumTuple(values(AnnouncementPriority));
const announcementAudiences = enumTuple(values(AnnouncementAudience));
const announcementStatuses = enumTuple(values(AnnouncementStatus));
const announcementStatusFilter = enumTuple([
  ...values(AnnouncementStatus),
  "EXPIRED",
] as const);

export const announcementAttachmentSchema = z.object({
  name: z.string().trim().min(1).max(180),
  url: z
    .string()
    .regex(/^\/api\/announcements\/attachments\/[a-f\d-]{36}\.(pdf|jpg|png)$/i),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  size: z.number().int().positive().max(5 * 1024 * 1024),
});

const announcementFields = {
  residence: objectId,
  author: objectId.optional(),
  title: z.string().trim().min(3).max(180),
  content: z.string().trim().min(3).max(20_000),
  publishedAt: date.optional(),
  category: z
    .enum(announcementCategories)
    .default(AnnouncementCategory.GENERAL),
  priority: z
    .enum(announcementPriorities)
    .default(AnnouncementPriority.NORMAL),
  audience: z
    .enum(announcementAudiences)
    .default(AnnouncementAudience.RESIDENTS),
  status: z
    .enum([
      AnnouncementStatus.DRAFT,
      AnnouncementStatus.SCHEDULED,
      AnnouncementStatus.PUBLISHED,
    ])
    .default(AnnouncementStatus.PUBLISHED),
  scheduledAt: date.nullable().optional(),
  expiresAt: date.nullable().optional(),
  isPinned: z.boolean().default(false),
  attachments: z.array(announcementAttachmentSchema).max(5).default([]),
};

function validateSchedule(
  value: {
    status?: string;
    scheduledAt?: Date | null;
    publishedAt?: Date;
    expiresAt?: Date | null;
  },
  ctx: z.RefinementCtx
) {
  const publicationTime =
    value.status === AnnouncementStatus.SCHEDULED
      ? value.scheduledAt
      : (value.publishedAt ?? new Date());
  if (
    value.status === AnnouncementStatus.SCHEDULED &&
    (!value.scheduledAt || value.scheduledAt <= new Date())
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["scheduledAt"],
      message: "La date planifiée doit être dans le futur.",
    });
  }
  if (value.expiresAt && publicationTime && value.expiresAt <= publicationTime) {
    ctx.addIssue({
      code: "custom",
      path: ["expiresAt"],
      message: "L'expiration doit suivre la publication.",
    });
  }
}

export const announcementCreateSchema = z
  .object(announcementFields)
  .superRefine(validateSchedule);

export const announcementUpdateSchema = z
  .object({
    residence: objectId.optional(),
    title: announcementFields.title.optional(),
    content: announcementFields.content.optional(),
    category: announcementFields.category.optional(),
    priority: announcementFields.priority.optional(),
    audience: announcementFields.audience.optional(),
    status: z.enum(announcementStatuses).optional(),
    scheduledAt: date.nullable().optional(),
    expiresAt: date.nullable().optional(),
    isPinned: z.boolean().optional(),
    attachments: z.array(announcementAttachmentSchema).max(5).optional(),
  })
  .superRefine(validateSchedule);

export const announcementListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.enum(announcementCategories).optional(),
  priority: z.enum(announcementPriorities).optional(),
  status: z.enum(announcementStatusFilter).optional(),
  audience: z.enum(announcementAudiences).optional(),
  residence: objectId.optional(),
  read: z.enum(["true", "false"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sort: z.enum(["newest", "oldest", "priority"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const announcementReadStatsQuerySchema = z.object({
  residence: objectId.optional(),
});

export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;
export type AnnouncementUpdateInput = z.infer<typeof announcementUpdateSchema>;
export type AnnouncementListQueryInput = z.infer<
  typeof announcementListQuerySchema
>;
