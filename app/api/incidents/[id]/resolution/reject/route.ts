import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { requireIncidentAccess } from "@/lib/incidents/access";
import { recordIncidentHistory } from "@/lib/incidents/recordHistory";
import { incidentResolutionRejectSchema } from "@/lib/validations/incident";
import { IncidentStatus, Role } from "@/types/enums";
import { notifyIncidentHistory } from "@/lib/notifications/events";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

export const PATCH = withAuth(async (req: NextRequest, user: AuthUser, context?: unknown) => {
  const params = await Promise.resolve((context as RouteParams | undefined)?.params);
  const id = params?.id;
  if (!isValidObjectId(id)) {
    throw new HttpError(400, "Identifiant d'incident invalide");
  }

  const incident = await requireIncidentAccess(user, id);
  if (user.role !== Role.RESIDENT || incident.reportedBy?.toString() !== user.id) {
    throw new HttpError(403, "Seul le résident à l'origine du signalement peut rejeter la résolution");
  }
  if (!incident.resolutionSubmittedAt || incident.status !== IncidentStatus.IN_PROGRESS) {
    throw new HttpError(409, "Aucune preuve de résolution en attente de réponse");
  }

  const data = await parseBody(req, incidentResolutionRejectSchema);
  incident.resolutionFeedback = data.feedback;
  incident.resolutionRejectedAt = new Date();
  incident.resolutionConfirmedAt = undefined;
  await incident.save();

  const history = await recordIncidentHistory({
    incidentId: incident._id,
    actorId: user.id,
    action: "RESOLUTION_REJECTED",
    description: "Résolution rejetée par le résident",
    newValue: data.feedback,
  });
  await notifyIncidentHistory(String(history._id), String(incident._id), "RESOLUTION_REJECTED", user.id);

  return json(incident.toObject(), 200);
});
