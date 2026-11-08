import { z } from "zod";

/**
 * Schéma de validation pour la connexion.
 * L'email est automatiquement normalisé en minuscules et nettoyé.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Adresse email invalide"),
  password: z
    .string()
    .min(8, "Le mot de passe doit comporter au moins 8 caractères"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Schéma de validation pour l'inscription publique d'un résident.
 * Exige au moins 8 caractères, 1 lettre et 1 chiffre.
 */
export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Le nom doit comporter au moins 2 caractères"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Adresse email invalide"),
    password: z
      .string()
      .min(8, "Le mot de passe doit comporter au moins 8 caractères")
      .regex(/[a-zA-Z]/, "Le mot de passe doit contenir au moins une lettre")
      .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre"),
    confirmPassword: z.string(),
    phone: z.string().trim().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
