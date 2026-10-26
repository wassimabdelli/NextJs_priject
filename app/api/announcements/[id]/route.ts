import { announcementCrudRoutes } from "@/lib/crud/announcements";

/**
 * Routes d'élément pour les annonces :
 * - GET    /api/announcements/[id] : Détail d'une annonce
 * - PATCH  /api/announcements/[id] : Mise à jour partielle sécurisée
 * - DELETE /api/announcements/[id] : Suppression sécurisée
 */
export const {
  getOne: GET,
  update: PATCH,
  remove: DELETE,
} = announcementCrudRoutes;
