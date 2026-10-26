import { z } from "zod";
import { objectId } from "./common";

export const apartmentCreateSchema = z.object({
  residence: objectId,
  number: z.string().trim().min(1),
  floor: z.number().int().nonnegative(),
  surface: z.number().positive(),
  shares: z.number().positive(),
  isOccupied: z.boolean().default(false),
  owner: objectId.optional(),
});

export const apartmentUpdateSchema = apartmentCreateSchema.omit({ residence: true }).partial();

export type ApartmentCreateInput = z.infer<typeof apartmentCreateSchema>;
export type ApartmentUpdateInput = z.infer<typeof apartmentUpdateSchema>;
