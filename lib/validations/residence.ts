import { z } from "zod";
import { objectId } from "./common";

export const residenceCreateSchema = z.object({
  name: z.string().trim().min(2),
  address: z.string().trim().min(3),
  city: z.string().trim().min(2),
  floors: z.number().int().nonnegative(),
  totalApartments: z.number().int().nonnegative(),
  syndic: objectId.optional(),
});

export const residenceUpdateSchema = residenceCreateSchema.partial();

export type ResidenceCreateInput = z.infer<typeof residenceCreateSchema>;
export type ResidenceUpdateInput = z.infer<typeof residenceUpdateSchema>;
