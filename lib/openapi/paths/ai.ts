import { z } from "zod";
import { registry } from "../registry";

const error = z.object({ error: z.string() });
const success = (schema: z.ZodType) => ({
  200: { description: "Suggestion IA validée côté serveur", content: { "application/json": { schema } } },
  400: { description: "Entrée invalide", content: { "application/json": { schema: error } } },
  401: { description: "Authentification requise", content: { "application/json": { schema: error } } },
  403: { description: "Rôle ou périmètre non autorisé", content: { "application/json": { schema: error } } },
  429: { description: "Quota ou limite d'utilisation atteinte", content: { "application/json": { schema: error } } },
  503: { description: "Gemini non configuré ou modèle indisponible", content: { "application/json": { schema: error } } },
});

export function registerAiPaths() {
  const routes = [
    {
      path: "/api/ai/ask",
      summary: "Interroger les réclamations accessibles avec des sources similaires",
      request: z.object({ question: z.string().min(3).max(500) }),
      response: z.object({
        answer: z.string(),
        sources: z.array(z.object({
          id: z.string(),
          title: z.string(),
          status: z.string(),
          similarity: z.number().min(0).max(100),
        })),
        coverage: z.object({
          searched: z.number(),
          withoutEmbedding: z.number(),
        }),
      }),
    },
    {
      path: "/api/ai/incidents/classify",
      summary: "Suggérer la catégorie et la priorité d'un incident",
      request: z.object({ title: z.string().min(3).max(180), description: z.string().min(5).max(4000) }),
      response: z.object({ category: z.string(), priority: z.string(), summary: z.string(), suggestedAction: z.string(), confidence: z.number() }),
    },
    {
      path: "/api/ai/incidents/priority",
      summary: "Recommander une priorité d'incident",
      request: z.object({ description: z.string().min(5).max(4000) }),
      response: z.object({ suggestedPriority: z.string(), explanation: z.string(), safetyWarning: z.string().nullable() }),
    },
    {
      path: "/api/ai/incidents/duplicates",
      summary: "Rechercher des incidents similaires dans une résidence autorisée",
      request: z.object({ title: z.string(), description: z.string(), residenceId: z.string(), incidentId: z.string().optional() }),
      response: z.object({ possibleDuplicates: z.array(z.object({ incidentId: z.string(), title: z.string(), summary: z.string(), status: z.string(), similarity: z.number(), score: z.number().optional(), method: z.enum(["embedding", "lexical"]).optional(), explanation: z.string() })) }),
    },
    {
      path: "/api/ai/announcements/generate",
      summary: "Générer un brouillon d'annonce à relire",
      request: z.object({ topic: z.string(), category: z.string(), audience: z.string(), tone: z.string(), language: z.string(), facts: z.array(z.string().max(240)).max(8).optional() }),
      response: z.object({ title: z.string(), content: z.string(), suggestedCategory: z.string(), suggestedPriority: z.string() }),
    },
    {
      path: "/api/ai/announcements/translate",
      summary: "Traduire un contenu d'annonce",
      request: z.object({ content: z.string(), targetLanguage: z.enum(["FR", "AR", "EN"]), sourceLanguage: z.enum(["FR", "AR", "EN"]).optional() }),
      response: z.object({ translatedContent: z.string(), detectedLanguage: z.string() }),
    },
    {
      path: "/api/ai/chat",
      summary: "Assistant IA avec contexte de données autorisé au rôle connecté",
      request: z.object({ message: z.string().max(1200), conversationId: z.string().uuid().optional() }),
      response: z.object({ answer: z.string(), conversationId: z.string().uuid() }),
    },
    {
      path: "/api/ai/reports/incidents",
      summary: "Expliquer les statistiques MongoDB des incidents",
      request: z.object({ from: z.string().date().optional(), to: z.string().date().optional() }),
      response: z.object({ summary: z.string(), observations: z.array(z.string()), recommendations: z.array(z.string()) }),
    },
    {
      path: "/api/ai/reports/announcements",
      summary: "Expliquer les statistiques MongoDB des annonces",
      request: z.object({ from: z.string().date().optional(), to: z.string().date().optional() }),
      response: z.object({ summary: z.string(), observations: z.array(z.string()), recommendations: z.array(z.string()) }),
    },
    {
      path: "/api/ai/intelligence/patterns/review",
      summary: "Confirmer ou écarter un rapprochement de réclamations",
      request: z.object({
        residenceId: z.string(),
        patternId: z.string(),
        incidentIds: z.array(z.string()).min(2).max(1000),
        status: z.enum(["CONFIRMED", "DISMISSED", "CLEAR"]),
      }),
      response: z.object({ success: z.boolean(), status: z.enum(["CONFIRMED", "DISMISSED"]).nullable() }),
    },
  ];
  for (const route of routes) {
    registry.registerPath({
      method: "post",
      path: route.path,
      tags: ["AI"],
      summary: route.summary,
      security: [{ cookieAuth: [] }],
      request: { body: { required: true, content: { "application/json": { schema: route.request } } } },
      responses: success(route.response),
    });
  }
  registry.registerPath({
    method: "get",
    path: "/api/ai/announcements/context",
    tags: ["AI"],
    summary: "Charger les faits vérifiés pour une annonce",
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        residenceId: z.string().regex(/^[a-f\d]{24}$/i),
        category: z.enum(["GENERAL", "MAINTENANCE", "SECURITY", "MEETING", "PAYMENT", "EMERGENCY", "OTHER"]).optional(),
      }),
    },
    responses: {
      200: {
        description: "Liste de faits calculés pour une résidence autorisée",
        content: {
          "application/json": {
            schema: z.object({ facts: z.array(z.object({ id: z.string(), label: z.string() })).max(8) }),
          },
        },
      },
      400: { description: "Paramètres invalides", content: { "application/json": { schema: error } } },
      401: { description: "Authentification requise", content: { "application/json": { schema: error } } },
      403: { description: "Résidence non autorisée ou rôle insuffisant", content: { "application/json": { schema: error } } },
    },
  });
  registry.registerPath({
    method: "post",
    path: "/api/ai/incidents/{id}/reply",
    tags: ["AI"],
    summary: "Proposer un brouillon de réponse au résident",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }),
    },
    responses: {
      200: {
        description: "Brouillon IA et faits calculés sans modification de l'incident",
        content: {
          "application/json": {
            schema: z.object({
              reply: z.string().min(1).max(1500),
              facts: z.object({
                ageDays: z.number(),
                assigned: z.boolean(),
                waitingDays: z.number().nullable(),
              }),
            }),
          },
        },
      },
      400: { description: "Identifiant invalide", content: { "application/json": { schema: error } } },
      401: { description: "Authentification requise", content: { "application/json": { schema: error } } },
      403: { description: "Fonction réservée à ADMIN et SYNDIC ou résidence non autorisée", content: { "application/json": { schema: error } } },
      404: { description: "Incident introuvable", content: { "application/json": { schema: error } } },
      502: { description: "Rédaction IA indisponible", content: { "application/json": { schema: error } } },
    },
  });
  registry.registerPath({
    method: "get",
    path: "/api/ai/briefing",
    tags: ["AI"],
    summary: "Charger le briefing quotidien du gestionnaire",
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({ refresh: z.enum(["1"]).optional() }),
    },
    responses: {
      200: {
        description: "Faits calculés et synthèse IA facultative pour le périmètre autorisé",
        content: {
          "application/json": {
            schema: z.object({
              facts: z.object({
                generatedAt: z.string().datetime(),
                criticalUnassigned: z.array(z.object({
                  id: z.string(),
                  title: z.string(),
                  residence: z.string(),
                  hoursOpen: z.number(),
                })),
                staleOverSevenDays: z.number(),
                resolvedLast24h: z.number(),
                recurring: z.array(z.object({
                  patternId: z.string(),
                  residenceId: z.string(),
                  category: z.string(),
                  count: z.number(),
                  sharedTerms: z.array(z.string()),
                })),
              }),
              narrative: z.object({
                summary: z.string(),
                observations: z.array(z.string()),
                recommendations: z.array(z.string()),
              }).nullable(),
              narrativeUnavailable: z.boolean(),
            }),
          },
        },
      },
      401: { description: "Authentification requise", content: { "application/json": { schema: error } } },
      403: { description: "Fonction réservée à ADMIN et SYNDIC", content: { "application/json": { schema: error } } },
    },
  });
  registry.registerPath({
    method: "post",
    path: "/api/ai/triage",
    tags: ["AI"],
    summary: "Suggérer la qualification d'une réclamation à partir du texte et de photos",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: z.object({
              title: z.string().max(200).optional(),
              description: z.string().max(2000).optional(),
              images: z.array(z.string().openapi({ type: "string", format: "binary" })).max(3).optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Suggestion IA. Elle ne modifie pas la réclamation.",
        content: {
          "application/json": {
            schema: z.object({
              data: z.object({
                title: z.string().min(3).max(200),
                description: z.string().min(5).max(2000),
                category: z.enum(["PLUMBING", "ELECTRICITY", "ELEVATOR", "CLEANING", "SECURITY", "OTHER"]),
                priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
                specialty: z.string(),
                probableCause: z.string().max(400),
                safetyRisk: z.boolean(),
                confidence: z.number().min(0).max(1),
                reasoning: z.string().max(400),
              }),
            }),
          },
        },
      },
      400: { description: "Données invalides", content: { "application/json": { schema: error } } },
      401: { description: "Authentification requise", content: { "application/json": { schema: error } } },
      403: { description: "Rôle non autorisé", content: { "application/json": { schema: error } } },
      429: { description: "Limite d'utilisation atteinte", content: { "application/json": { schema: error } } },
      502: { description: "Le fournisseur IA est indisponible", content: { "application/json": { schema: error } } },
      503: { description: "Assistance IA non configurée", content: { "application/json": { schema: error } } },
    },
  });
  registry.registerPath({
    method: "post",
    path: "/api/incidents/{id}/duplicates",
    tags: ["Incidents"],
    summary: "Lier ou écarter manuellement un doublon potentiel",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }),
      body: { required: true, content: { "application/json": { schema: z.object({
        targetIncidentId: z.string().regex(/^[a-f\d]{24}$/i),
        action: z.enum(["LINK", "DISMISS"]),
      }) } } },
    },
    responses: {
      200: { description: "Décision humaine enregistrée" },
      400: { description: "Données invalides", content: { "application/json": { schema: error } } },
      401: { description: "Authentification requise", content: { "application/json": { schema: error } } },
      403: { description: "Action réservée à ADMIN et SYNDIC", content: { "application/json": { schema: error } } },
      404: { description: "Incident introuvable ou non autorisé", content: { "application/json": { schema: error } } },
    },
  });
}
