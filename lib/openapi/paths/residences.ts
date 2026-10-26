import { registry, ResidenceCreateSchema, ErrorResponseSchema } from "../registry";
import { z } from "zod";

export function registerResidencesPaths() {
  registry.registerPath({
    method: "get",
    path: "/api/residences",
    tags: ["Résidences"],
    summary: "Lister les résidences",
    description:
      "Renvoie la liste des résidences. Pour un SYNDIC, retourne les résidences sous sa gestion. Pour un RESIDENT, renvoie sa résidence de rattachement. L'option withStats=1 calcule le taux de recouvrement, le solde financier et le nombre d'incidents ouverts.\n\n**Rôles autorisés** : ADMIN, SYNDIC, RESIDENT.",
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        withStats: z.string().optional().openapi({ description: "Passer '1' pour calculer les statistiques financières et techniques" }),
        period: z.string().optional().openapi({ description: "Période au format AAAA-MM pour le calcul du taux d'encaissement" }),
      }),
    },
    responses: {
      200: {
        description: "Liste des résidences",
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                _id: z.string(),
                name: z.string(),
                address: z.string(),
                city: z.string(),
                floors: z.number(),
                totalApartments: z.number(),
                syndic: z.string().optional(),
                stats: z
                  .object({
                    period: z.string(),
                    collectionRate: z.number(),
                    payments: z.number(),
                    expenses: z.number(),
                    balance: z.number(),
                    openIncidents: z.number(),
                  })
                  .optional(),
              })
            ),
          },
        },
      },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Rôle insuffisant", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Erreur serveur", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/residences",
    tags: ["Résidences"],
    summary: "Créer une nouvelle résidence",
    description: "Ajoute un nouvel immeuble dans le système.\n\n**Rôles autorisés** : ADMIN, SYNDIC.",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        description: "Caractéristiques de la résidence (nom, adresse, ville, étages, nombre de lots)",
        content: {
          "application/json": {
            schema: ResidenceCreateSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        description: "Résidence créée avec succès",
        content: {
          "application/json": {
            schema: z.object({
              _id: z.string(),
              name: z.string(),
              address: z.string(),
              city: z.string(),
              floors: z.number(),
              totalApartments: z.number(),
              syndic: z.string().optional(),
            }),
          },
        },
      },
      400: { description: "Données invalides", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Rôle insuffisant", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Erreur serveur", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });
}
