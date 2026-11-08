import mongoose from "mongoose";
import { HttpError } from "@/lib/api";
import { getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { Residence } from "@/models/Residence";
import { Role } from "@/types/enums";

export type IntelligenceResidenceScope = string[] | null;

export async function resolveIntelligenceResidenceScope(
  user: AuthUser,
  requestedResidenceId?: string
): Promise<IntelligenceResidenceScope> {
  if (user.role !== Role.ADMIN && user.role !== Role.SYNDIC) {
    throw new HttpError(403, "AI Intelligence est réservé à ADMIN et SYNDIC");
  }
  if (requestedResidenceId && !mongoose.isValidObjectId(requestedResidenceId)) {
    throw new HttpError(400, "Identifiant de résidence invalide");
  }

  if (user.role === Role.ADMIN) {
    if (requestedResidenceId && !(await Residence.exists({ _id: requestedResidenceId }))) {
      throw new HttpError(404, "Résidence introuvable");
    }
    return requestedResidenceId ? [requestedResidenceId] : null;
  }

  const managedResidenceIds = await getSyndicResidenceIds(user.id);
  if (requestedResidenceId && !managedResidenceIds.includes(requestedResidenceId)) {
    throw new HttpError(403, "Vous ne gérez pas cette résidence");
  }
  return requestedResidenceId ? [requestedResidenceId] : managedResidenceIds;
}

export function residenceScopeFilter(scope: IntelligenceResidenceScope) {
  return scope === null
    ? {}
    : { residence: { $in: scope.map((id) => new mongoose.Types.ObjectId(id)) } };
}
