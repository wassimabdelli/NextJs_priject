import { registry, AnnouncementCreateSchema, AnnouncementUpdateSchema, ErrorResponseSchema } from "../registry";
import { z } from "zod";

const announcementIdParams = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i).openapi({ description: "Identifiant MongoDB de l'annonce" }),
});
const securedResponses = {
  400: { description: "Données ou filtres invalides", content: { "application/json": { schema: ErrorResponseSchema } } },
  401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
  403: { description: "Accès interdit", content: { "application/json": { schema: ErrorResponseSchema } } },
};

export function registerAnnouncementsPaths() {
  registry.registerPath({
    method: "get",
    path: "/api/announcements",
    tags: ["Annonces"],
    summary: "Lister et filtrer les annonces autorisées",
    description: "Scope par résidence et audience appliqué côté serveur. Les résidents et techniciens ne reçoivent que les annonces publiées, non futures et non expirées. ADMIN/SYNDIC peuvent filtrer les états de gestion.",
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        q: z.string().optional(),
        category: z.string().optional(),
        priority: z.string().optional(),
        audience: z.string().optional(),
        status: z.string().optional(),
        residence: z.string().optional(),
        read: z.enum(["true", "false"]).optional(),
        from: z.string().date().optional(),
        to: z.string().date().optional(),
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(50).optional(),
      }),
    },
    responses: {
      200: { description: "Page d'annonces avec métadonnées de pagination" },
      ...securedResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/announcements",
    tags: ["Annonces"],
    summary: "Créer une annonce",
    description: "Réservé à ADMIN et SYNDIC. L'auteur provient de la session et la résidence est vérifiée côté serveur.",
    security: [{ cookieAuth: [] }],
    request: { body: { content: { "application/json": { schema: AnnouncementCreateSchema } }, required: true } },
    responses: {
      201: { description: "Annonce créée en brouillon, programmée ou publiée" },
      ...securedResponses,
      404: { description: "Résidence introuvable" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/announcements/{id}",
    tags: ["Annonces"],
    summary: "Consulter une annonce autorisée",
    security: [{ cookieAuth: [] }],
    request: { params: announcementIdParams },
    responses: { 200: { description: "Détail avec pièces jointes" }, ...securedResponses, 404: { description: "Annonce introuvable" } },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/announcements/{id}",
    tags: ["Annonces"],
    summary: "Modifier, publier ou programmer une annonce",
    description: "Réservé à ADMIN et au SYNDIC responsable de la résidence.",
    security: [{ cookieAuth: [] }],
    request: {
      params: announcementIdParams,
      body: { content: { "application/json": { schema: AnnouncementUpdateSchema } }, required: true },
    },
    responses: { 200: { description: "Annonce mise à jour" }, ...securedResponses, 404: { description: "Annonce introuvable" } },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/announcements/{id}",
    tags: ["Annonces"],
    summary: "Archiver une annonce",
    description: "Archivage logique, réservé à ADMIN et au SYNDIC responsable. Les lectures et pièces jointes restent associées.",
    security: [{ cookieAuth: [] }],
    request: { params: announcementIdParams },
    responses: { 200: { description: "Annonce archivée" }, ...securedResponses, 404: { description: "Annonce introuvable" } },
  });

  registry.registerPath({
    method: "post",
    path: "/api/announcements/{id}/read",
    tags: ["Annonces"],
    summary: "Enregistrer la lecture d'une annonce",
    description: "Réservé au résident autorisé; l'opération est idempotente.",
    security: [{ cookieAuth: [] }],
    request: { params: announcementIdParams },
    responses: { 200: { description: "Lecture enregistrée" }, ...securedResponses, 404: { description: "Annonce introuvable" } },
  });

  registry.registerPath({
    method: "get",
    path: "/api/announcements/{id}/read-stats",
    tags: ["Annonces"],
    summary: "Obtenir des statistiques agrégées de lecture",
    description: "ADMIN ou SYNDIC de la résidence. Aucune information personnelle n'est incluse.",
    security: [{ cookieAuth: [] }],
    request: { params: announcementIdParams },
    responses: { 200: { description: "Résidents éligibles, lectures et taux de lecture" }, ...securedResponses, 404: { description: "Annonce introuvable" } },
  });

  registry.registerPath({
    method: "get",
    path: "/api/announcements/stats",
    tags: ["Annonces"],
    summary: "Statistiques globales des annonces",
    description: "Réservé à ADMIN/SYNDIC; les résultats du syndic sont limités à ses résidences.",
    security: [{ cookieAuth: [] }],
    responses: { 200: { description: "Comptages par statut et statistiques agrégées de lecture" }, ...securedResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/api/announcements/upload",
    tags: ["Annonces"],
    summary: "Téléverser une pièce jointe privée",
    description: "ADMIN/SYNDIC seulement. PDF/JPG/PNG jusqu'à 5 Mo; la résidence est validée côté serveur.",
    security: [{ cookieAuth: [] }],
    responses: { 201: { description: "Référence de pièce jointe privée créée" }, ...securedResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/api/announcements/attachments/{fileId}",
    tags: ["Annonces"],
    summary: "Télécharger une pièce jointe autorisée",
    description: "Le fichier est servi après contrôle de la résidence, de l'audience et de la publication.",
    security: [{ cookieAuth: [] }],
    request: { params: z.object({ fileId: z.string() }) },
    responses: { 200: { description: "Fichier privé" }, ...securedResponses, 404: { description: "Fichier introuvable" } },
  });
}
