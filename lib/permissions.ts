import { Role } from "@/types/enums";

/**
 * Page de destination par défaut selon le rôle après connexion.
 */
export const ROLE_HOME: Record<Role, string> = {
  [Role.ADMIN]: "/dashboard",
  [Role.SYNDIC]: "/dashboard",
  [Role.RESIDENT]: "/dashboard",
  [Role.TECHNICIAN]: "/incidents",
};

/**
 * Définition des rôles autorisés par préfixe de route d'interface.
 */
export const ROUTE_ACCESS: Record<string, Role[]> = {
  "/dashboard": [Role.ADMIN, Role.SYNDIC, Role.RESIDENT, Role.TECHNICIAN],
  "/residences": [Role.ADMIN, Role.SYNDIC],
  "/apartments": [Role.ADMIN, Role.SYNDIC, Role.RESIDENT],
  "/residents": [Role.ADMIN, Role.SYNDIC],
  "/expenses": [Role.ADMIN, Role.SYNDIC],
  "/users": [Role.ADMIN, Role.SYNDIC],
  "/charges": [Role.ADMIN, Role.SYNDIC, Role.RESIDENT],
  "/payments": [Role.ADMIN, Role.SYNDIC, Role.RESIDENT],
  "/incidents": [Role.ADMIN, Role.SYNDIC, Role.RESIDENT, Role.TECHNICIAN],
  "/announcements": [Role.ADMIN, Role.SYNDIC, Role.RESIDENT, Role.TECHNICIAN],
  "/votes": [Role.ADMIN, Role.SYNDIC, Role.RESIDENT],
  "/meetings": [Role.ADMIN, Role.SYNDIC, Role.RESIDENT],
  "/resolutions": [Role.ADMIN, Role.SYNDIC, Role.RESIDENT],
  "/documents": [Role.ADMIN, Role.SYNDIC, Role.RESIDENT],
  "/api-docs": [Role.ADMIN, Role.SYNDIC],
  "/api/openapi": [Role.ADMIN, Role.SYNDIC],
};

/**
 * Types d'actions et ressources pour la matrice de contrôle d'accès.
 */
export type Action = "create" | "read" | "update" | "delete";
export type Resource =
  | "residence"
  | "apartment"
  | "resident"
  | "expense"
  | "user"
  | "charge"
  | "payment"
  | "incident"
  | "announcement"
  | "meeting"
  | "resolution"
  | "document"
  | "vote";


/**
 * Vérifie si un rôle donné a la permission d'effectuer une action sur une ressource.
 */
export function can(role: Role, action: Action, resource: Resource): boolean {
  // L'ADMIN a un accès complet sans restriction
  if (role === Role.ADMIN) return true;

  switch (resource) {
    case "residence":
    case "apartment":
    case "resident":
    case "expense":
      // Le SYNDIC a tous les droits sur les résidences qu'il gère
      return role === Role.SYNDIC;

    case "user":
      // ADMIN gère tous les utilisateurs, SYNDIC peut voir et créer des techniciens ou résidents
      if (role === Role.SYNDIC) {
        return action === "read" || action === "create" || action === "update";
      }
      return false;

    case "charge":
    case "payment":
      if (role === Role.SYNDIC) return true;
      if (role === Role.RESIDENT) {
        // Le résident peut uniquement consulter ses charges et effectuer un paiement
        return action === "read" || action === "create";
      }
      return false;

    case "incident":
      if (role === Role.SYNDIC) return true;
      if (role === Role.RESIDENT) {
        // Le résident peut déclarer et lire ses incidents
        return action === "create" || action === "read";
      }
      if (role === Role.TECHNICIAN) {
        // Le technicien lit et met à jour le statut des incidents qui lui sont assignés
        return action === "read" || action === "update";
      }
      return false;

    case "announcement":
      if (role === Role.SYNDIC) return true;
      // Résident et technicien sont en lecture seule pour les annonces
      return action === "read";

    case "meeting":
    case "resolution":
    case "vote":
      if (role === Role.SYNDIC) return true;
      if (role === Role.RESIDENT) {
        return action === "read" || (resource === "vote" && action === "create");
      }
      return false;

    case "document":
      if (role === Role.SYNDIC) return true;
      if (role === Role.RESIDENT) {
        return action === "read";
      }
      return false;


    default:
      return false;
  }
}

/**
 * Vérifie si un chemin d'URL est autorisé pour un rôle donné.
 */
export function isRouteAllowed(pathname: string, role: Role): boolean {
  // Recherche de la correspondance du préfixe le plus précis
  const matchingPrefix = Object.keys(ROUTE_ACCESS)
    .filter((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    .sort((a, b) => b.length - a.length)[0];

  if (!matchingPrefix) {
    // Si la route n'est pas restreinte dans la table, accès accordé par défaut
    return true;
  }

  return ROUTE_ACCESS[matchingPrefix].includes(role);
}
