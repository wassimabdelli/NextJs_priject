import { z } from "zod";
import { IncidentCategory, IncidentStatus, Priority } from "@/types/enums";
import { clientId, date, objectId } from "./common";

/** Taille max d'une photo encodée (data URL) : ~1,5 Mo, les photos sont compressées côté client. */
const photo = z.string().max(2_000_000, "Photo trop volumineuse");

export const incidentCreateSchema = z.object({
  residence: objectId,
  apartment: objectId.optional(),
  reportedBy: objectId.optional(),
  title: z.string().trim().min(3, "Titre trop court"),
  description: z.string().trim().min(5, "Description trop courte"),
  category: z.enum(IncidentCategory),
  photos: z.array(photo).max(3).default([]),
  priority: z.enum(Priority).default(Priority.MEDIUM),
  reportedAt: date.optional(),
  /** Champs propres à la synchro offline */
  createdOffline: z.boolean().default(false),
  clientId: clientId.optional(),
});

/** PATCH : assignation et/ou changement de statut (au moins un champ). */
export const incidentUpdateSchema = z
  .object({
    assignedTo: objectId.optional(),
    status: z.enum(IncidentStatus).optional(),
    priority: z.enum(Priority).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Aucun champ à modifier",
  });

/** PATCH /api/incidents/[id] : édition des champs descriptifs (ADMIN/SYNDIC), hors workflow. */
export const incidentEditSchema = incidentCreateSchema
  .pick({ title: true, description: true, category: true, priority: true })
  .partial();

/** PATCH /api/incidents/[id]/assign */
export const incidentAssignSchema = z.object({ assignedTo: objectId });

/** PATCH /api/incidents/[id]/status */
export const incidentStatusSchema = z.object({ status: z.enum(IncidentStatus) });

/** POST /api/incidents/[id]/comments */
export const incidentCommentSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

/** POST /api/incidents/[id]/resolution */
export const incidentResolutionSchema = z.object({
  resolutionNote: z.string().trim().min(3).max(5000),
  photos: z.array(photo).max(5).default([]),
});

/** POST /api/incidents/[id]/resolution/reject */
export const incidentResolutionRejectSchema = z.object({
  reason: z.string().trim().min(3).max(2000),
});

export type IncidentCreateInput = z.infer<typeof incidentCreateSchema>;
export type IncidentUpdateInput = z.infer<typeof incidentUpdateSchema>;
export type IncidentCommentInput = z.infer<typeof incidentCommentSchema>;
export type IncidentResolutionInput = z.infer<typeof incidentResolutionSchema>;
export type IncidentResolutionRejectInput = z.infer<typeof incidentResolutionRejectSchema>;
