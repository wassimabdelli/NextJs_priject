import { registry, IncidentCreateSchema, IncidentUpdateSchema, IncidentStatusSchema, IncidentCategorySchema, PrioritySchema, ErrorResponseSchema } from "../registry";
import { z } from "zod";
import {
  incidentCommentSchema,
  incidentResolutionRejectSchema,
  incidentResolutionSchema,
} from "@/lib/validations/incident";

export function registerIncidentsPaths() {
  registry.registerPath({
    method: "get",
    path: "/api/incidents/export",
    tags: ["Incidents"],
    summary: "Exporter les réclamations en CSV",
    description:
      "Télécharge les incidents autorisés avec les filtres usuels. Les syndics sont limités à leurs résidences et seuls ADMIN/SYNDIC peuvent exporter.",
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        residence: z.string().optional(),
        assignedTo: z.string().optional(),
        status: IncidentStatusSchema.optional(),
        category: IncidentCategorySchema.optional(),
        priority: PrioritySchema.optional(),
        from: z.string().date().optional(),
        to: z.string().date().optional(),
      }),
    },
    responses: {
      200: { description: "Fichier CSV UTF-8" },
      400: { description: "Filtres invalides", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Accès refusé", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/incidents/dashboard",
    tags: ["Incidents"],
    summary: "Obtenir les indicateurs du tableau de bord des réclamations",
    description:
      "Calcule les indicateurs par agrégation MongoDB et limite les données au rôle connecté : global pour ADMIN, résidences gérées pour SYNDIC, signalements propres pour RESIDENT, interventions assignées pour TECHNICIAN.",
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        from: z.string().date().optional(),
        to: z.string().date().optional(),
        residence: z.string().optional(),
        technician: z.string().optional(),
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(50).optional(),
      }),
    },
    responses: {
      200: {
        description: "Statistiques et données de tableau de bord autorisées",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal(true),
              data: z.object({
                role: z.string(),
                statistics: z.object({
                  total: z.number(),
                  reported: z.number(),
                  assigned: z.number(),
                  inProgress: z.number(),
                  resolved: z.number(),
                  urgent: z.number(),
                  high: z.number(),
                  overdue: z.number(),
                  averageResolutionHours: z.number(),
                  resolutionRate: z.number(),
                }),
                byStatus: z.array(z.object({ status: z.string(), count: z.number() })),
                byCategory: z.array(z.object({ category: z.string(), count: z.number() })),
                monthlyTrends: z.array(z.object({ month: z.string(), reported: z.number(), resolved: z.number() })),
              }),
            }),
          },
        },
      },
      400: { description: "Filtres invalides", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Accès refusé", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

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

  const incidentIdParams = z.object({
    id: z.string().openapi({ description: "Identifiant MongoDB de l'incident" }),
  });
  const historyEntry = z.object({
    _id: z.string(),
    action: z.string(),
    description: z.string(),
    oldValue: z.string().optional(),
    newValue: z.string().optional(),
    createdAt: z.string(),
    actor: z.object({ name: z.string().optional(), role: z.string().optional() }).nullable(),
  });
  const commentEntry = z.object({
    _id: z.string(),
    content: z.string(),
    attachments: z.array(z.string()),
    createdAt: z.string(),
    author: z.object({ name: z.string().optional(), role: z.string().optional() }).nullable(),
  });

  registry.registerPath({
    method: "get",
    path: "/api/incidents/{id}/history",
    tags: ["Incidents"],
    summary: "Consulter l'historique d'un incident",
    description: "Retourne l'historique paginé après contrôle d'accès à l'incident.",
    security: [{ cookieAuth: [] }],
    request: {
      params: incidentIdParams,
      query: z.object({ page: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().positive().max(50).optional() }),
    },
    responses: {
      200: { description: "Historique paginé", content: { "application/json": { schema: z.object({ data: z.array(historyEntry), meta: z.object({ page: z.number(), limit: z.number(), total: z.number() }) }) } } },
      403: { description: "Accès interdit", content: { "application/json": { schema: ErrorResponseSchema } } },
      404: { description: "Incident introuvable", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/incidents/{id}/comments",
    tags: ["Incidents"],
    summary: "Lister les commentaires d'un incident",
    security: [{ cookieAuth: [] }],
    request: {
      params: incidentIdParams,
      query: z.object({ page: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().positive().max(50).optional() }),
    },
    responses: {
      200: { description: "Commentaires paginés avec auteur sécurisé", content: { "application/json": { schema: z.object({ data: z.array(commentEntry), meta: z.object({ page: z.number(), limit: z.number(), total: z.number() }) }) } } },
      403: { description: "Accès interdit", content: { "application/json": { schema: ErrorResponseSchema } } },
      404: { description: "Incident introuvable", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/incidents/{id}/comments",
    tags: ["Incidents"],
    summary: "Ajouter un commentaire",
    description: "L'auteur est déduit de la session authentifiée; l'historique est enregistré côté serveur.",
    security: [{ cookieAuth: [] }],
    request: {
      params: incidentIdParams,
      body: { required: true, content: { "application/json": { schema: incidentCommentSchema } } },
    },
    responses: {
      201: { description: "Commentaire créé", content: { "application/json": { schema: commentEntry } } },
      400: { description: "Données invalides", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Accès interdit", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/incidents/{id}/resolution",
    tags: ["Incidents"],
    summary: "Soumettre une preuve de résolution",
    description: "Réservé au technicien assigné, au syndic responsable ou à l'administrateur. N'entraîne pas automatiquement le statut RESOLVED.",
    security: [{ cookieAuth: [] }],
    request: {
      params: incidentIdParams,
      body: { required: true, content: { "application/json": { schema: incidentResolutionSchema } } },
    },
    responses: {
      200: { description: "Preuve enregistrée" },
      400: { description: "Données invalides", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Accès interdit", content: { "application/json": { schema: ErrorResponseSchema } } },
      409: { description: "L'incident n'est pas en cours de traitement", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/incidents/{id}/ai-verify",
    tags: ["Incidents"],
    summary: "Demander un avis IA sur les photos avant et après intervention",
    description: "Réservé au résident déclarant, au syndic responsable ou à ADMIN. Aucun corps de requête n'est requis. L'avis est informatif et ne modifie jamais le statut de l'incident.",
    security: [{ cookieAuth: [] }],
    request: { params: incidentIdParams },
    responses: {
      200: {
        description: "Avis IA enregistré sans modifier le statut",
        content: {
          "application/json": {
            schema: z.object({
              data: z.object({
                verdict: z.enum(["FIXED", "PARTIALLY_FIXED", "NOT_FIXED", "UNCLEAR"]),
                explanation: z.string(),
                confidence: z.number(),
                checkedAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
      400: { description: "Identifiant invalide, photos absentes ou format non pris en charge", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Accès interdit", content: { "application/json": { schema: ErrorResponseSchema } } },
      404: { description: "Incident introuvable", content: { "application/json": { schema: ErrorResponseSchema } } },
      502: { description: "Le fournisseur IA est indisponible", content: { "application/json": { schema: ErrorResponseSchema } } },
      503: { description: "Assistance IA non configurée ou Gemini vision indisponible", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Erreur interne", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/incidents/{id}/resolution/confirm",
    tags: ["Incidents"],
    summary: "Confirmer la résolution",
    description: "Réservé au résident à l'origine du signalement. Fait progresser IN_PROGRESS vers RESOLVED.",
    security: [{ cookieAuth: [] }],
    request: { params: incidentIdParams },
    responses: {
      200: { description: "Résolution confirmée" },
      403: { description: "Accès interdit", content: { "application/json": { schema: ErrorResponseSchema } } },
      409: { description: "Aucune preuve en attente ou transition invalide", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/incidents/{id}/resolution/reject",
    tags: ["Incidents"],
    summary: "Rejeter une résolution",
    description: "Réservé au résident à l'origine du signalement. L'explication est obligatoire; le statut reste IN_PROGRESS.",
    security: [{ cookieAuth: [] }],
    request: {
      params: incidentIdParams,
      body: { required: true, content: { "application/json": { schema: incidentResolutionRejectSchema } } },
    },
    responses: {
      200: { description: "Retour de résolution enregistré" },
      400: { description: "Explication invalide", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Accès interdit", content: { "application/json": { schema: ErrorResponseSchema } } },
      409: { description: "Aucune preuve en attente de réponse", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });
}
