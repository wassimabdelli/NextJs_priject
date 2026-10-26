import { z } from "zod";
import { date, objectId } from "./common";

export const announcementCreateSchema = z.object({
  residence: objectId,
  author: objectId.optional(),
  title: z.string().trim().min(3),
  content: z.string().trim().min(3),
  publishedAt: date.optional(),
  isPinned: z.boolean().default(false),
});

export const announcementUpdateSchema = announcementCreateSchema.omit({ residence: true }).partial();

export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;
export type AnnouncementUpdateInput = z.infer<typeof announcementUpdateSchema>;
