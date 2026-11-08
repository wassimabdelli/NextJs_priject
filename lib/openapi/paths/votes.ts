import { registry, VoteCreateSchema, ErrorResponseSchema } from "../registry";
import { z } from "zod";

export function registerVotesPaths() {
  registry.registerPath({
    method: "get",
    path: "/api/votes",
    tags: ["Votes"],
    summary: "Lister les votes exprimés",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Liste des votes avec poids en tantièmes",
        content: {
          "application/json": {
            schema: z.object({
              data: z.array(z.any()),
              meta: z.object({ page: z.number(), limit: z.number(), total: z.number() }).optional(),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/votes",
    tags: ["Votes"],
    summary: "Exprimer un vote pour un lot",
    description: "Enregistre un vote pondéré par les tantièmes du lot. Le vote est rejeté si l'AG n'est pas ouverte (OPEN) ou si le lot a déjà voté (409).\n\n**Rôles autorisés** : ADMIN, SYNDIC, RESIDENT.",
    security: [{ cookieAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: VoteCreateSchema } } },
    },
    responses: {
      201: { description: "Vote enregistré" },
      400: { description: "AG non ouverte ou lot invalide" },
      409: { description: "Vote déjà exprimé pour ce lot sur cette résolution" },
    },
  });
}
