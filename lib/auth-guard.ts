import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { HttpError, handle } from "@/lib/api";
import { Role } from "@/types/enums";
import { Apartment } from "@/models/Apartment";
import { Resident } from "@/models/Resident";
import { Residence } from "@/models/Residence";
import { Incident } from "@/models/Incident";

export interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role;
}

/**
 * Récupère l'utilisateur connecté via la session JWT Auth.js.
 * Lève une exception HttpError(401) si l'utilisateur n'est pas authentifié.
 */
export async function requireAuth(): Promise<AuthUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new HttpError(401, "Authentification requise");
  }
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role as Role,
  };
}

/**
 * Vérifie que le rôle de l'utilisateur fait partie des rôles autorisés.
 * Lève une exception HttpError(403) si le rôle est insuffisant.
 */
export function requireRole(user: AuthUser, ...roles: Role[]): void {
  if (!roles.includes(user.role)) {
    throw new HttpError(403, "Accès interdit : rôle insuffisant");
  }
}

/**
 * Wrapper de route API avec authentification et contrôle de rôle automatique.
 */
export function withAuth(
  handler: (req: NextRequest, user: AuthUser, context?: any) => Promise<Response>,
  options?: { roles?: Role[] }
) {
  return async (req: NextRequest, context?: any): Promise<Response> => {
    return handle(async () => {
      const user = await requireAuth();
      if (options?.roles && options.roles.length > 0) {
        requireRole(user, ...options.roles);
      }
      return handler(req, user, context);
    });
  };
}

/**
 * Récupère les identifiants d'appartements associés à un résident
 * (soit en tant que propriétaire, soit en tant que résident enregistré).
 */
export async function getResidentApartmentIds(userId: string): Promise<string[]> {
  const [owned, residentIn] = await Promise.all([
    Apartment.find({ owner: userId }).distinct("_id"),
    Resident.find({ user: userId, isActive: true }).distinct("apartment"),
  ]);
  const allIds = new Set<string>([
    ...owned.map((id) => id.toString()),
    ...residentIn.map((id) => id.toString()),
  ]);
  return Array.from(allIds);
}

/**
 * Récupère les résidences gérées par un syndic.
 */
export async function getSyndicResidenceIds(userId: string): Promise<string[]> {
  const residences = await Residence.find({ syndic: userId }).distinct("_id");
  return residences.map((id) => id.toString());
}

/**
 * Récupère les résidences auxquelles un résident est rattaché (via ses appartements).
 */
export async function getResidentResidenceIds(userId: string): Promise<string[]> {
  const aptIds = await getResidentApartmentIds(userId);
  const residences = await Apartment.find({ _id: { $in: aptIds } }).distinct("residence");
  return residences.map((id) => id.toString());
}

/**
 * Récupère les résidences associées à un technicien (via les incidents assignés).
 */
export async function getTechnicianResidenceIds(userId: string): Promise<string[]> {
  const residences = await Incident.find({ assignedTo: userId }).distinct("residence");
  return residences.map((id) => id.toString());
}

