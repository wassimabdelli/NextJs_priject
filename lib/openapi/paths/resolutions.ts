import { registry, ResolutionCreateSchema, ResolutionUpdateSchema, ErrorResponseSchema } from "../registry";
import { z } from "zod";

export function registerResolutionsPaths() {
  registry.registerPath({
    method: "get",
    path: "/api/resolutions",
    tags: ["Résolutions"],
    summary: "Lister les résolutions d'AG",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Liste des résolutions",
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
    path: "/api/resolutions",
    tags: ["Résolutions"],
    summary: "Créer une résolution à voter",
    security: [{ cookieAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: ResolutionCreateSchema } } },
    },
    responses: {
      201: { description: "Résolution enregistrée" },
      400: { description: "Données invalides" },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/resolutions/{id}",
    tags: ["Résolutions"],
    summary: "Modifier une résolution",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string() }),
      body: { content: { "application/json": { schema: ResolutionUpdateSchema } } },
    },
    responses: {
      200: { description: "Résolution mise à jour" },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/resolutions/{id}",
    tags: ["Résolutions"],
    summary: "Supprimer une résolution",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: { description: "Résolution supprimée" },
      409: { description: "Suppression interdite si des votes ont été émis" },
    },
  });

  // GET /api/resolutions/[id]/results
  registry.registerPath({
    method: "get",
    path: "/api/resolutions/{id}/results",
    tags: ["Résolutions"],
    summary: "Dépouillement des votes et calcul du quorum",
    description: "Renvoie les totaux pondérés (POUR, CONTRE, ABSTENTION) selon les tantièmes, l'adoption selon la majorité requise et l'atteinte du quorum de l'AG.\n\n**Rôles autorisés** : ADMIN, SYNDIC, RESIDENT.",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: "ID de la résolution" }) }),
    },
    responses: {
      200: {
        description: "Dépouillement détaillé et résultat",
        content: {
          "application/json": {
            schema: z.object({
              resolution: z.any(),
              tally: z.object({ FOR: z.number(), AGAINST: z.number(), ABSTAIN: z.number() }),
              expressedVotes: z.number(),
              totalVotedWeight: z.number(),
              approvalRate: z.number(),
              isAdopted: z.boolean(),
              isQuorumReached: z.boolean(),
              quorum: z.object({
                totalShares: z.number(),
                presentShares: z.number(),
                percentage: z.number(),
                requiredPercentage: z.number(),
              }),
              voteCount: z.number(),
            }),
          },
        },
      },
      404: { description: "Résolution introuvable" },
    },
  });
}
