import { registry, ResidentCreateSchema, ResidentUpdateSchema, ErrorResponseSchema } from "../registry";
import { z } from "zod";

export function registerResidentsPaths() {
  registry.registerPath({
    method: "get",
    path: "/api/residents",
    tags: ["Résidents"],
    summary: "Lister les résidents",
    description: "Récupère les résidents selon le rôle de l'utilisateur.\n\n**Rôles autorisés** : ADMIN, SYNDIC.",
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        apartment: z.string().optional().openapi({ description: "Filtrer par appartement" }),
        user: z.string().optional().openapi({ description: "Filtrer par utilisateur" }),
      }),
    },
    responses: {
      200: {
        description: "Liste des résidents",
        content: {
          "application/json": {
            schema: z.object({
              data: z.array(z.any()),
              meta: z.object({ page: z.number(), limit: z.number(), total: z.number() }).optional(),
            }),
          },
        },
      },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Accès refusé", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/residents",
    tags: ["Résidents"],
    summary: "Enregistrer un résident",
    description: "Associe un utilisateur résident à un appartement.\n\n**Rôles autorisés** : ADMIN, SYNDIC.",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        description: "Données du résident",
        content: { "application/json": { schema: ResidentCreateSchema } },
      },
    },
    responses: {
      201: { description: "Résident créé", content: { "application/json": { schema: z.any() } } },
      400: { description: "Données invalides", content: { "application/json": { schema: ErrorResponseSchema } } },
      409: { description: "Conflit", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/residents/{id}",
    tags: ["Résidents"],
    summary: "Modifier un résident",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: "ID du résident" }) }),
      body: { content: { "application/json": { schema: ResidentUpdateSchema } } },
    },
    responses: {
      200: { description: "Résident mis à jour" },
      404: { description: "Résident introuvable" },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/residents/{id}",
    tags: ["Résidents"],
    summary: "Supprimer un résident",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: "ID du résident" }) }),
    },
    responses: {
      200: { description: "Résident supprimé" },
      404: { description: "Résident introuvable" },
    },
  });
}
