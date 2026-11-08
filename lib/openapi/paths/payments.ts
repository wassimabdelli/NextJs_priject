import { registry, PaymentCreateSchema, PaymentMethodSchema, ErrorResponseSchema } from "../registry";
import { z } from "zod";

export function registerPaymentsPaths() {
  registry.registerPath({
    method: "get",
    path: "/api/payments",
    tags: ["Paiements"],
    summary: "Lister les règlements enregistrés",
    description:
      "Renvoie l'historique des paiements reçus. Un RESIDENT ne voit que les règlements associés à ses propres charges.\n\n**Rôles autorisés** : ADMIN, SYNDIC, RESIDENT.",
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        charge: z.string().optional().openapi({ description: "Filtrer les paiements pour un identifiant de charge spécifique" }),
      }),
    },
    responses: {
      200: {
        description: "Liste des paiements",
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                _id: z.string(),
                charge: z.string(),
                amount: z.number(),
                paymentDate: z.string(),
                method: PaymentMethodSchema,
                receiptNumber: z.string(),
                receivedBy: z.string().optional(),
                clientId: z.string().optional(),
              })
            ),
          },
        },
      },
      400: { description: "Paramètre charge invalide", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Accès refusé", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Erreur serveur", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/payments",
    tags: ["Paiements"],
    summary: "Enregistrer un paiement (Idempotent)",
    description:
      "Enregistre un nouveau règlement pour une charge. IDEMPOTENT via le paramètre 'clientId' pour garantir l'absence de double débit en mode hors-ligne. Le champ 'receivedBy' est toujours renseigné côté serveur via la session active.\n\n**Rôles autorisés** : ADMIN, SYNDIC, RESIDENT.",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        description: "Détails du paiement (charge, montant, méthode, clientId hors-ligne)",
        content: {
          "application/json": {
            schema: PaymentCreateSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: { description: "Paiement déjà existant renvoyé sans duplication (Idempotence clientId)" },
      201: {
        description: "Paiement créé et charge mise à jour",
        content: {
          "application/json": {
            schema: z.object({
              _id: z.string(),
              charge: z.string(),
              amount: z.number(),
              paymentDate: z.string(),
              method: PaymentMethodSchema,
              receiptNumber: z.string(),
              clientId: z.string().optional(),
            }),
          },
        },
      },
      400: { description: "Données invalides ou montant supérieur au reste à payer", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Le résident ne peut payer que les charges de son appartement", content: { "application/json": { schema: ErrorResponseSchema } } },
      404: { description: "Charge introuvable", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Erreur serveur", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });
}
