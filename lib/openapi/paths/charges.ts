import { registry, ChargeCreateSchema, ChargeStatusSchema, ErrorResponseSchema } from "../registry";
import { z } from "zod";

export function registerChargesPaths() {
  registry.registerPath({
    method: "get",
    path: "/api/charges",
    tags: ["Charges"],
    summary: "Lister les appels de charges",
    description:
      "Récupère les appels de charges avec calcul dynamique du statut (OVERDUE si échéance dépassée) et reste à payer. Un RESIDENT ne voit que les charges de ses appartements.\n\n**Rôles autorisés** : ADMIN, SYNDIC, RESIDENT.",
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        residence: z.string().optional().openapi({ description: "Filtrer par résidence" }),
        apartment: z.string().optional().openapi({ description: "Filtrer par lot" }),
        period: z.string().optional().openapi({ description: "Période au format AAAA-MM" }),
        status: ChargeStatusSchema.optional().openapi({ description: "Statut de la charge (PENDING, PARTIAL, PAID, OVERDUE)" }),
      }),
    },
    responses: {
      200: {
        description: "Liste des charges",
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                _id: z.string(),
                apartment: z.union([
                  z.string(),
                  z.object({ _id: z.string(), number: z.string(), floor: z.number() }),
                ]),
                period: z.string(),
                amount: z.number(),
                paidAmount: z.number(),
                remaining: z.number(),
                dueDate: z.string(),
                status: ChargeStatusSchema,
              })
            ),
          },
        },
      },
      400: { description: "Paramètre de requête invalide", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Accès refusé pour ce lot", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Erreur serveur", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/charges",
    tags: ["Charges"],
    summary: "Créer un appel de charges",
    description: "Émet un nouvel appel de fonds pour un appartement donné.\n\n**Rôles autorisés** : ADMIN, SYNDIC.",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        description: "Détails de l'appel de charge (appartement, période AAAA-MM, montant, date d'échéance)",
        content: {
          "application/json": {
            schema: ChargeCreateSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        description: "Charge créée avec succès",
        content: {
          "application/json": {
            schema: z.object({
              _id: z.string(),
              apartment: z.string(),
              period: z.string(),
              amount: z.number(),
              paidAmount: z.number(),
              dueDate: z.string(),
            }),
          },
        },
      },
      400: { description: "Données invalides", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Rôle insuffisant", content: { "application/json": { schema: ErrorResponseSchema } } },
      404: { description: "Appartement introuvable", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Erreur serveur", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  // POST /api/charges/generate
  registry.registerPath({
    method: "post",
    path: "/api/charges/generate",
    tags: ["Charges"],
    summary: "Générer les charges du mois pour une copropriété",
    description: "Génère un appel de charge par appartement au prorata des tantièmes (montant = totalBudget * tantièmes / totalTantièmes) sans doublon.\n\n**Rôles autorisés** : ADMIN, SYNDIC.",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              residenceId: z.string(),
              period: z.string().regex(/^\d{4}-\d{2}$/),
              totalBudget: z.number().positive(),
              dueDate: z.string(),
            }),
          },
        },
      },
    },
    responses: {
      201: { description: "Charges générées", content: { "application/json": { schema: z.any() } } },
      400: { description: "Données invalides" },
      409: { description: "Charges déjà générées pour cette période" },
    },
  });
}

