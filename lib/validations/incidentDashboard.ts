import { z } from "zod";
import { IncidentCategory, IncidentStatus, Priority, Role } from "@/types/enums";
import { objectId } from "./common";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  (value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)),
  "Date invalide"
);

export const incidentDashboardQuerySchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  residence: objectId.optional(),
  technician: objectId.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const incidentListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(IncidentStatus).optional(),
  category: z.enum(IncidentCategory).optional(),
  priority: z.enum(Priority).optional(),
  residence: objectId.optional(),
  assignedTo: objectId.optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  sort: z.enum(["newest", "oldest", "priority", "status"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type IncidentDashboardRole = typeof Role[keyof typeof Role];
