import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { requireIncidentAccess } from "@/lib/incidents/access";
import { recordIncidentHistory } from "@/lib/incidents/recordHistory";
import { incidentResolutionSchema } from "@/lib/validations/incident";
import { IncidentStatus, Role } from "@/types/enums";
import { notifyIncidentHistory } from "@/lib/notifications/events";
import { INCIDENT_RESOLUTION_SUBMISSION_ROLES } from "@/lib/incidents/access-policy";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

export const POST = withAuth(async (req: NextRequest, user: AuthUser, context?: unknown) => {
  const params = await Promise.resolve((context as RouteParams | undefined)?.params);
  const id = params?.id;
  if (!isValidObjectId(id)) {
    throw new HttpError(400, "Identifiant d'incident invalide");
  }

  const incident = await requireIncidentAccess(user, id);
  if (user.role === Role.TECHNICIAN && incident.assignedTo?.toString() !== user.id) {
    throw new HttpError(403, "Cet incident ne vous est pas assigné");
  }
  if (incident.status !== IncidentStatus.IN_PROGRESS) {
    throw new HttpError(409, "La preuve de résolution peut être soumise uniquement pendant le traitement");
  }

  const data = await parseBody(req, incidentResolutionSchema);
  incident.resolutionDescription = data.description;
  incident.resolutionPhotos = data.photos;
  incident.resolutionSubmittedAt = new Date();
  incident.resolutionConfirmedAt = undefined;
  incident.resolutionRejectedAt = undefined;
  incident.resolutionFeedback = undefined;
  await incident.save();

  const history = await recordIncidentHistory({
    incidentId: incident._id,
    actorId: user.id,
    action: "RESOLUTION_SUBMITTED",
    description: "Preuve de résolution soumise",
  });
  await notifyIncidentHistory(String(history._id), String(incident._id), "RESOLUTION_SUBMITTED", user.id);

  return json(incident.toObject(), 200);
}, { roles: [...INCIDENT_RESOLUTION_SUBMISSION_ROLES] });
