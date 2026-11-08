import { getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { HttpError } from "@/lib/api";
import { Incident } from "@/models/Incident";
import { Role } from "@/types/enums";

export async function requireIncidentAccess(user: AuthUser, incidentId: string) {
  const incident = await Incident.findById(incidentId);

  if (!incident) {
    throw new HttpError(404, "Incident introuvable");
  }

  if (user.role === Role.ADMIN) {
    return incident;
  }

  if (user.role === Role.SYNDIC) {
    const ids = await getSyndicResidenceIds(user.id);
    if (!ids.includes(incident.residence.toString())) {
      throw new HttpError(403, "Accès interdit");
    }
    return incident;
  }

  if (user.role === Role.RESIDENT) {
    if (incident.reportedBy?.toString() !== user.id) {
      throw new HttpError(403, "Accès interdit");
    }
    return incident;
  }

  if (user.role === Role.TECHNICIAN) {
    if (incident.assignedTo?.toString() !== user.id) {
      throw new HttpError(403, "Accès interdit");
    }
    return incident;
  }

  throw new HttpError(403, "Accès interdit");
}
