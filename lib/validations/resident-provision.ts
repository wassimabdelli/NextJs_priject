import { z } from "zod";
import { ResidentType } from "@/types/enums";
import { objectId } from "./common";

/**
 * Création directe d'un résident par ADMIN/SYNDIC :
 * compte utilisateur (nouveau ou existant) + fiche Resident + rattachement au lot.
 */
export const residentProvisionSchema = z.object({
  apartment: objectId,
  fullName: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().optional(),
  type: z.enum([ResidentType.OWNER, ResidentType.TENANT]),
  /** Mot de passe initial si le compte n'existe pas encore. */
  password: z.string().min(8).optional(),
  moveInDate: z.coerce.date().optional(),
});

export type ResidentProvisionInput = z.infer<typeof residentProvisionSchema>;
