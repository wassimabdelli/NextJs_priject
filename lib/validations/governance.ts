import { z } from "zod";
import { DocumentType, MeetingStatus, VoteChoice } from "@/types/enums";
import { date, objectId } from "./common";

/* ---------- Meeting ---------- */
export const meetingCreateSchema = z.object({
  residence: objectId,
  title: z.string().trim().min(3),
  date,
  location: z.string().trim().optional(),
  agenda: z.string().optional(),
  status: z.enum(MeetingStatus).default(MeetingStatus.PLANNED),
});
export const meetingUpdateSchema = meetingCreateSchema.omit({ residence: true }).partial();

/* ---------- Resolution ---------- */
export const resolutionCreateSchema = z.object({
  meeting: objectId,
  title: z.string().trim().min(3),
  description: z.string().optional(),
  requiredMajority: z.number().min(0).max(100).default(50),
});
export const resolutionUpdateSchema = resolutionCreateSchema.omit({ meeting: true }).partial();

/* ---------- Vote ---------- */
/** weight n'est pas saisi : le serveur le déduit des tantièmes du lot. */
export const voteCreateSchema = z.object({
  resolution: objectId,
  apartment: objectId,
  voter: objectId.optional(),
  choice: z.enum(VoteChoice),
});
export const voteUpdateSchema = voteCreateSchema.pick({ choice: true });

/* ---------- Document ---------- */
export const documentCreateSchema = z.object({
  residence: objectId,
  meeting: objectId.optional(),
  uploadedBy: objectId.optional(),
  title: z.string().trim().min(2),
  type: z.enum(DocumentType),
  fileUrl: z.string().min(1),
});
export const documentUpdateSchema = documentCreateSchema.omit({ residence: true }).partial();

export type MeetingCreateInput = z.infer<typeof meetingCreateSchema>;
export type ResolutionCreateInput = z.infer<typeof resolutionCreateSchema>;
export type VoteCreateInput = z.infer<typeof voteCreateSchema>;
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
