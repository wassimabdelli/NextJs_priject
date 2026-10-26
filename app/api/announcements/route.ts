import { announcementCrudRoutes } from "@/lib/crud/announcements";

/**
 * Routes de collection pour les annonces :
 * - GET  /api/announcements : Liste paginée avec recherche, filtres et scope
 * - POST /api/announcements : Création avec validation Zod et forçage de l'auteur
 */
export const { list: GET, create: POST } = announcementCrudRoutes;
