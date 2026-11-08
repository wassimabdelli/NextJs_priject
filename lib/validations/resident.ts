import { z } from "zod";
import { ResidentType } from "@/types/enums";
import { date, objectId } from "./common";

const residentFieldsSchema = z.object({
  apartment: objectId.optional(),
  residence: objectId.optional(),
  user: objectId.optional(),
  fullName: z.string().trim().min(2),
  phone: z.string().trim().optional(),
  email: z.email().optional(),
  type: z.enum(ResidentType),
  moveInDate: date,
  moveOutDate: date.optional(),
  isActive: z.boolean().default(true),
});

export const residentCreateSchema = residentFieldsSchema.refine(
  (resident) => resident.apartment || resident.residence,
  {
  path: ["residence"],
  message: "Sélectionnez une résidence",
  }
);

export const residentUpdateSchema = residentFieldsSchema.omit({ apartment: true }).partial();

export type ResidentCreateInput = z.infer<typeof residentCreateSchema>;
export type ResidentUpdateInput = z.infer<typeof residentUpdateSchema>;
