import { z } from "zod";
import { ResidentType } from "@/types/enums";
import { date, objectId } from "./common";

export const residentCreateSchema = z.object({
  apartment: objectId,
  user: objectId.optional(),
  fullName: z.string().trim().min(2),
  phone: z.string().trim().optional(),
  email: z.email().optional(),
  type: z.enum(ResidentType),
  moveInDate: date,
  moveOutDate: date.optional(),
  isActive: z.boolean().default(true),
});

export const residentUpdateSchema = residentCreateSchema.partial();

export type ResidentCreateInput = z.infer<typeof residentCreateSchema>;
export type ResidentUpdateInput = z.infer<typeof residentUpdateSchema>;
