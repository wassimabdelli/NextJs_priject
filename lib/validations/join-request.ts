import { z } from "zod";
import { objectId } from "./common";
import { ResidentType, Role } from "@/types/enums";

export const joinRequestCreateSchema = z.object({
  residence: objectId,
  apartmentNumber: z.string().trim().min(1, "Le numéro d'appartement est requis"),
  residentType: z.enum([ResidentType.OWNER, ResidentType.TENANT]),
  message: z.string().trim().max(500).optional(),
});

export const joinRequestRejectSchema = z.object({
  rejectionReason: z.string().trim().max(300).optional(),
});

export type JoinRequestCreateInput = z.infer<typeof joinRequestCreateSchema>;
export type JoinRequestRejectInput = z.infer<typeof joinRequestRejectSchema>;

