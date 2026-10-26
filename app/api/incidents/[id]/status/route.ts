import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import { withAuth, getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { Incident } from "@/models/Incident";
import { incidentStatusSchema } from "@/lib/validations/incident";
import { Role, IncidentStatus } from "@/types/enums";
import { canTransition } from "@/lib/incidents/workflow";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * PATCH /api/incidents/[id]/status
 * Met à jour le statut d'un incident selon le workflow strict :
 * REPORTED -> ASSIGNED -> IN_PROGRESS -> RESOLVED.
 * Rôles autorisés : ADMIN, SYNDIC, TECHNICIAN
 * - TECHNICIAN : uniquement sur les incidents qui lui sont assignés.
 * - resolvedAt posé automatiquement au passage à RESOLVED.
 * - Transitions non conformes = HTTP 409.
 */
export const PATCH = withAuth(
  async (req: NextRequest, user: AuthUser, context?: unknown) => {
    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) {
      throw new HttpError(400, "Identifiant d'incident invalide");
    }

    const data = await parseBody(req, incidentStatusSchema);
    const targetStatus = data.status;

    const incident = await Incident.findById(id);
    if (!incident) {
      throw new HttpError(404, "Incident introuvable");
    }

    // Contrôles spécifiques au technicien
    if (user.role === Role.TECHNICIAN) {
      if (!incident.assignedTo || incident.assignedTo.toString() !== user.id) {
        throw new HttpError(403, "Cet incident ne vous est pas assigné");
      }
    }

    // Contrôles spécifiques au syndic
    if (user.role === Role.SYNDIC) {
      const syndicResidences = await getSyndicResidenceIds(user.id);
      if (!syndicResidences.includes(incident.residence.toString())) {
        throw new HttpError(403, "Vous n'administrez pas la résidence de cet incident");
      }
    }

    // Respect strict du workflow : REPORTED -> ASSIGNED -> IN_PROGRESS -> RESOLVED
    if (!canTransition(incident.status, targetStatus)) {
      throw new HttpError(
        409,
        `Transition invalide : passage impossible de "${incident.status}" vers "${targetStatus}". Le cycle strict est REPORTED -> ASSIGNED -> IN_PROGRESS -> RESOLVED.`
      );
    }

    incident.status = targetStatus;

    // Règle métier : resolvedAt posé à RESOLVED
    if (targetStatus === IncidentStatus.RESOLVED) {
      incident.resolvedAt = new Date();
    } else {
      incident.resolvedAt = undefined;
    }

    await incident.save();

    await incident.populate([
      { path: "residence", select: "name city" },
      { path: "apartment", select: "number floor" },
      { path: "reportedBy", select: "name email" },
      { path: "assignedTo", select: "name email phone" },
    ]);

    return json(incident.toObject ? incident.toObject() : incident, 200);
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.TECHNICIAN] }
);
