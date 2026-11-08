import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { HttpError, handle, isValidObjectId } from "@/lib/api";
import { Role } from "@/types/enums";
import { Apartment } from "@/models/Apartment";
import { Resident } from "@/models/Resident";
import { Residence } from "@/models/Residence";
import { Incident } from "@/models/Incident";
import { User } from "@/models/User";
import { roleAccessStatus } from "@/lib/role-access";

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
  if (!session?.user?.id || !isValidObjectId(session.user.id)) {
    throw new HttpError(401, "Authentification requise");
  }
  const account = await User.findById(session.user.id)
    .select("name email role isActive")
    .lean();
  if (!account || account.isActive === false) {
    throw new HttpError(401, "Session expirée ou compte désactivé");
  }
  if (!Object.values(Role).includes(account.role)) {
    throw new HttpError(403, "Rôle non autorisé");
  }
  return {
    id: String(account._id),
    name: account.name,
    email: account.email,
    role: account.role,
  };
}

/**
 * Vérifie que le rôle de l'utilisateur fait partie des rôles autorisés.
 * Lève une exception HttpError(403) si le rôle est insuffisant.
 */
export function requireRole(user: AuthUser, ...roles: Role[]): void {
  const status = roleAccessStatus(user.role, roles);
  if (status) {
    throw new HttpError(status, "Accès interdit : rôle insuffisant");
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
 * Récupère les lots associés directement ou via un ancien profil résident.
 */
export async function getResidentApartmentIds(userId: string): Promise<string[]> {
  const [owned, directlyAssigned, residentIn] = await Promise.all([
    Apartment.find({ owner: userId }).distinct("_id"),
    Apartment.find({ residentUser: userId }).distinct("_id"),
    Resident.find({
      user: userId,
      isActive: true,
      apartment: { $exists: true, $ne: null },
    }).distinct("apartment"),
  ]);
  const allIds = new Set<string>([
    ...owned.map((id) => id.toString()),
    ...directlyAssigned.map((id) => id.toString()),
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
 * Récupère les résidences auxquelles un compte résident est rattaché directement ou via un lot.
 */
export async function getResidentResidenceIds(userId: string): Promise<string[]> {
  const [account, aptIds] = await Promise.all([
    User.findOne({ _id: userId, role: Role.RESIDENT }).select("residence").lean(),
    getResidentApartmentIds(userId),
  ]);
  const residences = await Apartment.find({ _id: { $in: aptIds } }).distinct("residence");
  return [...new Set([
    ...(account?.residence ? [String(account.residence)] : []),
    ...residences.map((id) => id.toString()),
  ])];
}

/**
 * Récupère les résidences associées à un technicien (via les incidents assignés).
 */
export async function getTechnicianResidenceIds(userId: string): Promise<string[]> {
  const residences = await Incident.find({ assignedTo: userId }).distinct("residence");
  return residences.map((id) => id.toString());
}
