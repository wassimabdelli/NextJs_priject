import { registry, AnnouncementCreateSchema, ErrorResponseSchema } from "../registry";
import { z } from "zod";

export function registerAnnouncementsPaths() {
  registry.registerPath({
    method: "get",
    path: "/api/announcements",
    tags: ["Annonces"],
    summary: "Lister les annonces de copropriété",
    description:
      "Renvoie le flux des annonces de la résidence, ordonnées par priorité (épinglées d'abord) puis chronologiquement. Un RESIDENT ne voit que les annonces de son immeuble.\n\n**Rôles autorisés** : ADMIN, SYNDIC, RESIDENT, TECHNICIAN.",
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        residence: z.string().optional().openapi({ description: "Filtrer par résidence" }),
      }),
    },
    responses: {
      200: {
        description: "Liste des annonces",
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                _id: z.string(),
                residence: z.string(),
                author: z.union([z.string(), z.object({ _id: z.string(), name: z.string() })]).optional(),
                title: z.string(),
                content: z.string(),
                publishedAt: z.string(),
                isPinned: z.boolean(),
              })
            ),
          },
        },
      },
      400: { description: "Paramètre résidence invalide", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Accès refusé pour cette résidence", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Erreur serveur", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/announcements",
    tags: ["Annonces"],
    summary: "Publier une annonce",
    description:
      "Diffuse un communiqué aux résidents d'une copropriété. Le champ 'author' est automatiquement déduit de la session.\n\n**Rôles autorisés** : ADMIN, SYNDIC.",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        description: "Contenu de l'annonce (résidence, titre, texte, épinglage)",
        content: {
          "application/json": {
            schema: AnnouncementCreateSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        description: "Annonce publiée avec succès",
        content: {
          "application/json": {
            schema: z.object({
              _id: z.string(),
              residence: z.string(),
              title: z.string(),
              content: z.string(),
              isPinned: z.boolean(),
              publishedAt: z.string(),
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
