import { registry, ExpenseCreateSchema, ExpenseCategorySchema, ErrorResponseSchema } from "../registry";
import { z } from "zod";

export function registerExpensesPaths() {
  registry.registerPath({
    method: "get",
    path: "/api/expenses",
    tags: ["Dépenses"],
    summary: "Lister les dépenses de copropriété",
    description:
      "Renvoie les dépenses engagées pour les parties communes. Le SYNDIC est restreint à ses résidences assignées.\n\n**Rôles autorisés** : ADMIN, SYNDIC.",
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        residence: z.string().optional().openapi({ description: "Filtrer par résidence" }),
      }),
    },
    responses: {
      200: {
        description: "Liste des dépenses",
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                _id: z.string(),
                residence: z.string(),
                category: ExpenseCategorySchema,
                description: z.string(),
                amount: z.number(),
                expenseDate: z.string(),
                proofUrl: z.string().optional(),
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
    path: "/api/expenses",
    tags: ["Dépenses"],
    summary: "Créer une dépense commune",
    description: "Enregistre une facture ou dépense pour une résidence.\n\n**Rôles autorisés** : ADMIN, SYNDIC.",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        description: "Données de la dépense (résidence, catégorie, description, montant, date, justificatif)",
        content: {
          "application/json": {
            schema: ExpenseCreateSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        description: "Dépense enregistrée avec succès",
        content: {
          "application/json": {
            schema: z.object({
              _id: z.string(),
              residence: z.string(),
              category: ExpenseCategorySchema,
              description: z.string(),
              amount: z.number(),
              expenseDate: z.string(),
            }),
          },
        },
      },
      400: { description: "Données invalides", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Rôle insuffisant ou syndic non gestionnaire de cette résidence", content: { "application/json": { schema: ErrorResponseSchema } } },
      404: { description: "Résidence introuvable", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Erreur serveur", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });
}
