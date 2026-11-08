import { Role } from "@/types/enums";

/**
 * Page de destination par défaut selon le rôle après connexion.
 */
export const ROLE_HOME: Record<Role, string> = {
  [Role.ADMIN]: "/dashboard",
  [Role.SYNDIC]: "/dashboard",
  [Role.OWNER]: "/dashboard",
  [Role.TENANT]: "/dashboard",
  [Role.TECHNICIAN]: "/incidents",
};

/**
 * Définition des rôles autorisés par préfixe de route d'interface.
 */
export const ROUTE_ACCESS: Record<string, Role[]> = {
  "/dashboard": [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT, Role.TECHNICIAN],
  "/residences": [Role.ADMIN, Role.SYNDIC],
  "/apartments": [Role.ADMIN, Role.SYNDIC],
  "/residents": [Role.ADMIN, Role.SYNDIC],
  "/expenses": [Role.ADMIN, Role.SYNDIC],
  "/users": [Role.ADMIN, Role.SYNDIC],
  "/charges": [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT],
  "/payments": [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT],
  "/incidents": [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT, Role.TECHNICIAN],
  "/announcements": [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT, Role.TECHNICIAN],
  "/votes": [Role.ADMIN, Role.SYNDIC, Role.OWNER],
  "/meetings": [Role.ADMIN, Role.SYNDIC, Role.OWNER],
  "/resolutions": [Role.ADMIN, Role.SYNDIC, Role.OWNER],
  "/documents": [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT],
  "/elections": [Role.ADMIN, Role.SYNDIC, Role.OWNER],
  "/join": [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT],
  "/join-requests": [Role.ADMIN, Role.SYNDIC],
  "/wallet": [Role.OWNER, Role.TENANT, Role.ADMIN, Role.SYNDIC],
  "/notifications": [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT, Role.TECHNICIAN],
  "/profile": [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT, Role.TECHNICIAN],
  "/more": [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT, Role.TECHNICIAN],
  "/api-docs": [Role.ADMIN, Role.SYNDIC],
  "/api/openapi": [Role.ADMIN, Role.SYNDIC],
  "/equipment": [Role.ADMIN, Role.SYNDIC, Role.TECHNICIAN],
  "/maintenance": [Role.ADMIN, Role.SYNDIC, Role.TECHNICIAN],
  "/stock": [Role.ADMIN, Role.SYNDIC, Role.TECHNICIAN],
  "/employees": [Role.ADMIN, Role.SYNDIC],
  "/shifts": [Role.ADMIN, Role.SYNDIC],
  "/leaves": [Role.ADMIN, Role.SYNDIC],
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
  | "vote"
  | "equipment"
  | "maintenance"
  | "stock"
  | "employee"
  | "shift"
  | "leave";


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
      if (role === Role.OWNER || role === Role.TENANT) {
        // Le propriétaire ou locataire peut uniquement consulter ses charges et effectuer un paiement
        return action === "read" || action === "create";
      }
      return false;

    case "incident":
      if (role === Role.SYNDIC) return true;
      if (role === Role.OWNER || role === Role.TENANT) {
        // Le propriétaire ou locataire peut déclarer et lire ses incidents
        return action === "create" || action === "read";
      }
      if (role === Role.TECHNICIAN) {
        // Le technicien lit et met à jour le statut des incidents qui lui sont assignés
        return action === "read" || action === "update";
      }
      return false;

    case "announcement":
      if (role === Role.SYNDIC) return true;
      // Propriétaire, locataire et technicien sont en lecture seule pour les annonces
      return action === "read";

    case "meeting":
    case "resolution":
    case "vote":
      if (role === Role.SYNDIC) return true;
      if (role === Role.OWNER) {
        return action === "read" || (resource === "vote" && action === "create");
      }
      return false;

    case "document":
      if (role === Role.SYNDIC) return true;
      if (role === Role.OWNER || role === Role.TENANT) {
        return action === "read";
      }
      return false;

    case "equipment":
    case "stock":
    case "maintenance":
      if (role === Role.SYNDIC) return true;
      if (role === Role.TECHNICIAN) {
        return action === "read" || action === "update";
      }
      return false;

    case "employee":
    case "shift":
    case "leave":
      return role === Role.SYNDIC;

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

/** Onglets redesign → chemin (aligné sur lib/redesign/store TAB_PATHS). */
export const TAB_ROUTE: Record<string, string> = {
  dashboard: "/dashboard",
  charges: "/charges",
  expenses: "/expenses",
  incidents: "/incidents",
  meetings: "/meetings",
  resolutions: "/resolutions",
  elections: "/elections",
  payments: "/payments",
  apartments: "/apartments",
  residents: "/residents",
  documents: "/documents",
  announcements: "/announcements",
  wallet: "/wallet",
  notifications: "/notifications",
  profile: "/profile",
  more: "/more",
  join: "/join",
  "join-requests": "/join-requests",
  votes: "/votes",
  users: "/users",
  residences: "/residences",
  employees: "/employees",
  shifts: "/shifts",
  leaves: "/leaves",
  equipment: "/equipment",
  maintenance: "/maintenance",
  stock: "/stock",
  "api-docs": "/api-docs",
};

/** True si l'onglet/module doit apparaître dans la navigation pour ce rôle. */
export function canAccessTab(role: Role | null | undefined, tabId: string): boolean {
  if (!role) return false;
  const path = TAB_ROUTE[tabId];
  if (!path) return false;
  return isRouteAllowed(path, role);
}

/** True si le rôle peut exprimer un vote (AG / élections). */
export function canCastVote(role: Role | null | undefined): boolean {
  if (!role) return false;
  return can(role, "create", "vote");
}

/** True si le rôle peut signaler un nouvel incident. */
export function canReportIncident(role: Role | null | undefined): boolean {
  if (!role) return false;
  return can(role, "create", "incident");
}
