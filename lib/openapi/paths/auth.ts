import { registry, RegisterInputSchema, ErrorResponseSchema } from "../registry";
import { z } from "zod";

export function registerAuthPaths() {
  registry.registerPath({
    method: "post",
    path: "/api/auth/register",
    tags: ["Authentification"],
    summary: "Inscription publique d'un nouveau résident",
    description:
      "Permet à un nouvel occupant ou copropriétaire de créer son compte. Le rôle créé est STRICTEMENT et TOUJOURS forcé à 'RESIDENT' (protection anti-élévation de privilèges). Aucun cookie de session requis.\n\n**Rôles autorisés** : Public (aucun).",
    request: {
      body: {
        description: "Informations d'inscription (nom, email, mot de passe >= 8 caractères, confirmation)",
        content: {
          "application/json": {
            schema: RegisterInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        description: "Compte résident créé avec succès",
        content: {
          "application/json": {
            schema: z.object({
              id: z.string().openapi({ description: "Identifiant MongoDB unique de l'utilisateur" }),
              name: z.string(),
              email: z.string(),
              role: z.literal("RESIDENT"),
            }),
          },
        },
      },
      400: {
        description: "Données du formulaire invalides (mot de passe trop court, format email incorrect, etc.)",
        content: { "application/json": { schema: ErrorResponseSchema } },
      },
      409: {
        description: "Conflit : un compte avec cette adresse email existe déjà",
        content: { "application/json": { schema: ErrorResponseSchema } },
      },
      500: {
        description: "Erreur interne du serveur",
        content: { "application/json": { schema: ErrorResponseSchema } },
      },
    },
  });
}
