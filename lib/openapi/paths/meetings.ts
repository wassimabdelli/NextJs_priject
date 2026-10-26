import { registry, MeetingCreateSchema, MeetingUpdateSchema, ErrorResponseSchema } from "../registry";
import { z } from "zod";

export function registerMeetingsPaths() {
  registry.registerPath({
    method: "get",
    path: "/api/meetings",
    tags: ["Assemblées Générales"],
    summary: "Lister les assemblées générales",
    description: "Récupère les assemblées générales selon le rôle et les résidences autorisées.\n\n**Rôles autorisés** : ADMIN, SYNDIC, RESIDENT.",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Liste des assemblées générales",
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
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/meetings",
    tags: ["Assemblées Générales"],
    summary: "Planifier une assemblée générale",
    description: "Planifie une nouvelle séance d'AG pour une résidence.\n\n**Rôles autorisés** : ADMIN, SYNDIC.",
    security: [{ cookieAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: MeetingCreateSchema } } },
    },
    responses: {
      201: { description: "Assemblée créée", content: { "application/json": { schema: z.any() } } },
      400: { description: "Données invalides", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/meetings/{id}",
    tags: ["Assemblées Générales"],
    summary: "Modifier le statut ou l'ordre du jour d'une AG",
    description: "Permet notamment de passer le statut à OPEN pour ouvrir les votes ou CLOSED pour clore la séance.\n\n**Rôles autorisés** : ADMIN, SYNDIC.",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string() }),
      body: { content: { "application/json": { schema: MeetingUpdateSchema } } },
    },
    responses: {
      200: { description: "Assemblée mise à jour" },
      404: { description: "Assemblée introuvable" },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/meetings/{id}",
    tags: ["Assemblées Générales"],
    summary: "Supprimer une AG",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: { description: "Assemblée supprimée" },
      409: { description: "Impossible de supprimer si des résolutions sont rattachées" },
    },
  });
}
