import { registry, ApartmentCreateSchema, ErrorResponseSchema } from "../registry";
import { z } from "zod";

export function registerApartmentsPaths() {
  registry.registerPath({
    method: "get",
    path: "/api/apartments",
    tags: ["Appartements"],
    summary: "Lister les appartements / lots",
    description:
      "Renvoie la liste des lots d'une résidence. Pour un RESIDENT, renvoie uniquement son ou ses appartements.\n\n**Rôles autorisés** : ADMIN, SYNDIC, RESIDENT.",
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        residence: z.string().optional().openapi({ description: "Identifiant de la résidence pour filtrer les lots" }),
      }),
    },
    responses: {
      200: {
        description: "Liste des appartements",
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                _id: z.string(),
                residence: z.string(),
                number: z.string(),
                floor: z.number(),
                surface: z.number(),
                shares: z.number().openapi({ description: "Tantièmes de copropriété" }),
                isOccupied: z.boolean(),
                owner: z.string().optional(),
              })
            ),
          },
        },
      },
      400: { description: "Paramètre résidence invalide", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Rôle insuffisant", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Erreur serveur", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/apartments",
    tags: ["Appartements"],
    summary: "Créer un appartement / lot",
    description: "Ajoute un lot à une copropriété.\n\n**Rôles autorisés** : ADMIN, SYNDIC.",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        description: "Données du lot (résidence, numéro, étage, surface, tantièmes, propriétaire)",
        content: {
          "application/json": {
            schema: ApartmentCreateSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        description: "Appartement créé avec succès",
        content: {
          "application/json": {
            schema: z.object({
              _id: z.string(),
              residence: z.string(),
              number: z.string(),
              floor: z.number(),
              surface: z.number(),
              shares: z.number(),
              isOccupied: z.boolean(),
              owner: z.string().optional(),
            }),
          },
        },
      },
      400: { description: "Données invalides", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Rôle insuffisant", content: { "application/json": { schema: ErrorResponseSchema } } },
      404: { description: "Résidence introuvable", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Erreur serveur", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });
}
