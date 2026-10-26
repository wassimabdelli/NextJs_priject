import { registry, IncidentCreateSchema, IncidentUpdateSchema, IncidentStatusSchema, IncidentCategorySchema, PrioritySchema, ErrorResponseSchema } from "../registry";
import { z } from "zod";

export function registerIncidentsPaths() {
  // GET /api/incidents
  registry.registerPath({
    method: "get",
    path: "/api/incidents",
    tags: ["Incidents"],
    summary: "Lister les signalements d'incidents",
    description:
      "Renvoie les incidents de copropriété. Filtrage strict par propriétaire : un TECHNICIAN ne voit que les incidents qui lui sont assignés, un RESIDENT ne voit que ses propres signalements.\n\n**Rôles autorisés** : ADMIN, SYNDIC, RESIDENT, TECHNICIAN.",
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        residence: z.string().optional().openapi({ description: "Filtrer par résidence" }),
        status: IncidentStatusSchema.optional().openapi({ description: "Filtrer par statut" }),
      }),
    },
    responses: {
      200: {
        description: "Liste des incidents",
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                _id: z.string(),
                residence: z.string(),
                apartment: z.union([z.string(), z.object({ _id: z.string(), number: z.string() })]).optional(),
                reportedBy: z.string().optional(),
                assignedTo: z.union([z.string(), z.object({ _id: z.string(), name: z.string() })]).optional(),
                title: z.string(),
                description: z.string(),
                category: IncidentCategorySchema,
                priority: PrioritySchema,
                status: IncidentStatusSchema,
                reportedAt: z.string(),
                createdOffline: z.boolean(),
                clientId: z.string().optional(),
              })
            ),
          },
        },
      },
      400: { description: "Paramètres invalides", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Accès refusé", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Erreur serveur", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  // POST /api/incidents
  registry.registerPath({
    method: "post",
    path: "/api/incidents",
    tags: ["Incidents"],
    summary: "Signaler un nouvel incident (Idempotent)",
    description:
      "Crée un ticket d'incident. IDEMPOTENT via le paramètre 'clientId' pour la synchronisation hors-ligne. Le champ 'reportedBy' est automatiquement assigné côté serveur depuis la session.\n\n**Rôles autorisés** : ADMIN, SYNDIC, RESIDENT.",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        description: "Données de l'incident (résidence, appartement, titre, description, catégorie, priorité, clientId)",
        content: {
          "application/json": {
            schema: IncidentCreateSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: { description: "Incident déjà enregistré retourné sans doublon (Idempotence)" },
      201: {
        description: "Incident créé avec succès",
        content: {
          "application/json": {
            schema: z.object({
              _id: z.string(),
              title: z.string(),
              status: IncidentStatusSchema,
              reportedAt: z.string(),
              clientId: z.string().optional(),
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

  // GET /api/incidents/{id}
  registry.registerPath({
    method: "get",
    path: "/api/incidents/{id}",
    tags: ["Incidents"],
    summary: "Consulter les détails d'un incident",
    description:
      "Détails d'un incident spécifique avec techniciens et déclarants peuplés.\n\n**Rôles autorisés** : ADMIN, SYNDIC, RESIDENT (auteur), TECHNICIAN (assigné).",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ description: "Identifiant MongoDB de l'incident" }),
      }),
    },
    responses: {
      200: { description: "Détails de l'incident" },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Accès refusé pour cet incident", content: { "application/json": { schema: ErrorResponseSchema } } },
      404: { description: "Incident introuvable", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Erreur serveur", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  // PATCH /api/incidents/{id}
  registry.registerPath({
    method: "patch",
    path: "/api/incidents/{id}",
    tags: ["Incidents"],
    summary: "Modifier le statut ou l'assignation d'un incident",
    description:
      "Met à jour l'incident. Un TECHNICIAN ne peut que faire progresser le statut (ASSIGNED -> IN_PROGRESS -> RESOLVED). Un SYNDIC/ADMIN peut assigner un technicien et changer la priorité.\n\n**Rôles autorisés** : ADMIN, SYNDIC, TECHNICIAN.",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ description: "Identifiant MongoDB de l'incident" }),
      }),
      body: {
        description: "Champs modifiables (statut, assignation technicien, priorité)",
        content: {
          "application/json": {
            schema: IncidentUpdateSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: { description: "Incident mis à jour" },
      400: { description: "Transition de statut non autorisée ou technicien invalide", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Permissions insuffisantes", content: { "application/json": { schema: ErrorResponseSchema } } },
      404: { description: "Incident introuvable", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Erreur serveur", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  // PATCH /api/incidents/{id}/assign
  registry.registerPath({
    method: "patch",
    path: "/api/incidents/{id}/assign",
    tags: ["Incidents"],
    summary: "Assigner un technicien à un incident",
    description: "Assigne un technicien qualifié (Role.TECHNICIAN). Si l'incident est en REPORTED, passage automatique à ASSIGNED.\n\n**Rôles autorisés** : ADMIN, SYNDIC.",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: "ID de l'incident" }) }),
      body: {
        content: {
          "application/json": {
            schema: z.object({ assignedTo: z.string().openapi({ description: "ID de l'utilisateur TECHNICIAN" }) }),
          },
        },
      },
    },
    responses: {
      200: { description: "Incident assigné et passé à ASSIGNED" },
      400: { description: "Utilisateur non technicien ou ID invalide" },
      404: { description: "Incident ou technicien introuvable" },
      409: { description: "Transition invalide" },
    },
  });

  // PATCH /api/incidents/{id}/status
  registry.registerPath({
    method: "patch",
    path: "/api/incidents/{id}/status",
    tags: ["Incidents"],
    summary: "Faire progresser le statut selon le cycle strict",
    description: "Respect strict du workflow : REPORTED -> ASSIGNED -> IN_PROGRESS -> RESOLVED. Transition invalide = 409. resolvedAt posé à RESOLVED.\n\n**Rôles autorisés** : ADMIN, SYNDIC, TECHNICIAN.",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: "ID de l'incident" }) }),
      body: {
        content: {
          "application/json": {
            schema: z.object({ status: IncidentStatusSchema }),
          },
        },
      },
    },
    responses: {
      200: { description: "Statut mis à jour" },
      409: { description: "Transition non autorisée selon le workflow strict" },
    },
  });
}

