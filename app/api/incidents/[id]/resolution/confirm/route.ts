import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { requireIncidentAccess } from "@/lib/incidents/access";
import { recordIncidentHistory } from "@/lib/incidents/recordHistory";
import { canTransition } from "@/lib/incidents/workflow";
import { IncidentStatus, Role } from "@/types/enums";
import { notifyIncidentHistory } from "@/lib/notifications/events";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

export const PATCH = withAuth(async (_req: NextRequest, user: AuthUser, context?: unknown) => {
  const params = await Promise.resolve((context as RouteParams | undefined)?.params);
  const id = params?.id;
  if (!isValidObjectId(id)) {
    throw new HttpError(400, "Identifiant d'incident invalide");
  }

  const incident = await requireIncidentAccess(user, id);
  if (user.role !== Role.RESIDENT || incident.reportedBy?.toString() !== user.id) {
    throw new HttpError(403, "Seul le résident à l'origine du signalement peut confirmer la résolution");
  }
  if (!incident.resolutionSubmittedAt || incident.status !== IncidentStatus.IN_PROGRESS) {
    throw new HttpError(409, "Aucune preuve de résolution en attente de confirmation");
  }
  if (!canTransition(incident.status, IncidentStatus.RESOLVED)) {
    throw new HttpError(409, "Transition de statut invalide");
  }

  const previousStatus = incident.status;
  const now = new Date();
  incident.status = IncidentStatus.RESOLVED;
  incident.resolvedAt = now;
  incident.resolutionConfirmedAt = now;
  incident.resolutionRejectedAt = undefined;
  incident.resolutionFeedback = undefined;
  await incident.save();

  const history = await recordIncidentHistory({
    incidentId: incident._id,
    actorId: user.id,
    action: "RESOLUTION_CONFIRMED",
    description: "Résolution confirmée par le résident",
  });
  await notifyIncidentHistory(String(history._id), String(incident._id), "RESOLUTION_CONFIRMED", user.id);
  await recordIncidentHistory({
    incidentId: incident._id,
    actorId: user.id,
    action: "STATUS_CHANGED",
    description: `Statut modifié : ${previousStatus} → ${IncidentStatus.RESOLVED}`,
    oldValue: previousStatus,
    newValue: IncidentStatus.RESOLVED,
  });

  return json(incident.toObject(), 200);
});
