import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import { withAuth, getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { Incident } from "@/models/Incident";
import { User } from "@/models/User";
import { incidentAssignSchema } from "@/lib/validations/incident";
import { Role, IncidentStatus } from "@/types/enums";
import { canTransition } from "@/lib/incidents/workflow";
import { recordIncidentHistory } from "@/lib/incidents/recordHistory";
import { notifyIncidentHistory } from "@/lib/notifications/events";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * PATCH /api/incidents/[id]/assign
 * Assigne un incident à un technicien.
 * Rôles autorisés : ADMIN, SYNDIC
 * Règle de transition : si l'incident est en REPORTED, passage automatique à ASSIGNED.
 */
export const PATCH = withAuth(
  async (req: NextRequest, user: AuthUser, context?: unknown) => {
    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) {
      throw new HttpError(400, "Identifiant d'incident invalide");
    }

    const data = await parseBody(req, incidentAssignSchema);
    if (!isValidObjectId(data.assignedTo)) {
      throw new HttpError(400, "Identifiant de technicien invalide");
    }

    const incident = await Incident.findById(id);
    if (!incident) {
      throw new HttpError(404, "Incident introuvable");
    }

    if (user.role === Role.SYNDIC) {
      const syndicResidences = await getSyndicResidenceIds(user.id);
      if (!syndicResidences.includes(incident.residence.toString())) {
        throw new HttpError(403, "Vous n'administrez pas la résidence de cet incident");
      }
    }

    const technician = await User.findById(data.assignedTo).lean();
    if (!technician) {
      throw new HttpError(404, "Technicien introuvable");
    }
    if (technician.role !== Role.TECHNICIAN) {
      throw new HttpError(400, "L'utilisateur assigné doit posséder le rôle TECHNICIAN");
    }

    const previousAssignedTo = incident.assignedTo?.toString();
    const previousStatus = incident.status;

    // Si statut REPORTED -> transition automatique vers ASSIGNED
    if (incident.status === IncidentStatus.REPORTED) {
      if (!canTransition(IncidentStatus.REPORTED, IncidentStatus.ASSIGNED)) {
        throw new HttpError(409, `Transition invalide depuis ${incident.status} vers ASSIGNED`);
      }
      incident.status = IncidentStatus.ASSIGNED;
    }

    incident.assignedTo = technician._id;
    await incident.save();

    if (previousAssignedTo !== technician._id.toString()) {
      const previousTechnician = previousAssignedTo
        ? await User.findById(previousAssignedTo).select("name").lean()
        : null;
      const history = await recordIncidentHistory({
        incidentId: incident._id,
        actorId: user.id,
        action: "ASSIGNED",
        description: `Technicien assigné : ${technician.name}`,
        oldValue: previousTechnician?.name,
        newValue: technician.name,
      });
      await notifyIncidentHistory(String(history._id), String(incident._id), "ASSIGNED", user.id);
    }
    if (previousStatus !== incident.status) {
      const history = await recordIncidentHistory({
        incidentId: incident._id,
        actorId: user.id,
        action: "STATUS_CHANGED",
        description: `Statut modifié : ${previousStatus} → ${incident.status}`,
        oldValue: previousStatus,
        newValue: incident.status,
      });
      await notifyIncidentHistory(String(history._id), String(incident._id), "STATUS_CHANGED", user.id);
    }

    await incident.populate([
      { path: "residence", select: "name city" },
      { path: "apartment", select: "number floor" },
      { path: "reportedBy", select: "name" },
      { path: "assignedTo", select: "name" },
    ]);

    return json(incident.toObject ? incident.toObject() : incident, 200);
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
