import { z } from "zod";
import { Role, values } from "@/types/enums";

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit comporter au moins 2 caractères"),
  email: z.string().trim().toLowerCase().email("Adresse email invalide"),
  /** Mot de passe en clair : il est hashé côté serveur, jamais stocké tel quel. */
  password: z.string().min(8, "Le mot de passe doit comporter au moins 8 caractères"),
  phone: z.string().trim().optional(),
  role: z.enum(values(Role)).default(Role.RESIDENT),
  isActive: z.boolean().optional().default(true),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().optional(),
  role: z.enum(values(Role)).optional(),
  isActive: z.boolean().optional(),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
