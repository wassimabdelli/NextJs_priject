import { NextResponse, type NextRequest } from "next/server";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import { withAuth, getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { Incident } from "@/models/Incident";
import { Employee } from "@/models/Employee";
import { Leave } from "@/models/Leave";
import { Shift } from "@/models/Shift";
import { User } from "@/models/User";
import { incidentAssignSchema } from "@/lib/validations/incident";
import {
  Role,
  IncidentStatus,
  IncidentTimelineType,
  LeaveStatus,
  Priority,
  ShiftStatus,
  ReminderType,
} from "@/types/enums";
import { canTransition } from "@/lib/incidents/workflow";
import { appendIncidentTimeline } from "@/lib/incidents/timeline";
import { notifyUser } from "@/lib/notifications/notify";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * PATCH /api/incidents/[id]/assign
 * Assigne un incident à un technicien/employé après vérification des congés (Leave)
 * et des plannings de garde (Shift) en cas d'urgence.
 * Rôles autorisés : ADMIN, SYNDIC
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

    // Résolution croisée User <-> Employee
    let technician = await User.findById(data.assignedTo).lean();
    const directEmployee = await Employee.findById(data.assignedTo).lean();

    if (!technician && directEmployee?.user) {
      technician = await User.findById(directEmployee.user).lean();
    }

    if (!technician && !directEmployee) {
      throw new HttpError(404, "Technicien introuvable");
    }

    if (technician && technician.role !== Role.TECHNICIAN) {
      throw new HttpError(400, "L'utilisateur assigné doit posséder le rôle TECHNICIAN");
    }

    // Recherche de toutes les fiches Employee rattachées à ce technicien
    const employeeOrFilters: Record<string, unknown>[] = [
      { _id: data.assignedTo },
      { user: data.assignedTo },
    ];
    if (technician) {
      employeeOrFilters.push({ user: technician._id });
      if (technician.email) {
        employeeOrFilters.push({ email: technician.email.toLowerCase().trim() });
      }
      if (technician.name) {
        const escapedName = technician.name
          .trim()
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        employeeOrFilters.push({
          fullName: { $regex: `^${escapedName}$`, $options: "i" },
        });
      }
    }

    const matchedEmployees = await Employee.find({ $or: employeeOrFilters })
      .select("_id user fullName")
      .lean();

    const candidateEmployeeIds = Array.from(
      new Set([
        String(data.assignedTo),
        ...(technician ? [String(technician._id)] : []),
        ...(directEmployee ? [String(directEmployee._id)] : []),
        ...matchedEmployees.map((emp) => String(emp._id)),
      ])
    );

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setUTCHours(23, 59, 59, 999);

    // a. Vérifie s'il existe un congé (Leave) approuvé couvrant la date actuelle (new Date())
    const activeLeave = await Leave.findOne({
      employee: { $in: candidateEmployeeIds },
      status: LeaveStatus.APPROVED,
      startDate: { $lte: endOfToday },
      endDate: { $gte: startOfToday },
    }).lean();

    if (activeLeave) {
      return NextResponse.json(
        { error: "Impossible d'assigner : l'employé est actuellement en congé." },
        { status: 400 }
      );
    }

    // b. Si le ticket est de priorité 'URGENT', vérifie que l'employé possède un Shift couvrant l'heure actuelle
    if (incident.priority === Priority.URGENT) {
      const activeShift = await Shift.findOne({
        employee: { $in: candidateEmployeeIds },
        status: { $nin: [ShiftStatus.CANCELLED, ShiftStatus.MISSED] },
        startAt: { $lte: now },
        endAt: { $gte: now },
      }).lean();

      if (!activeShift) {
        return NextResponse.json(
          {
            error:
              "Impossible d'assigner : l'employé est hors de ses heures de garde (shift) pour cet incident urgent.",
          },
          { status: 400 }
        );
      }
    }

    // Si statut REPORTED -> transition automatique vers ASSIGNED
    if (incident.status === IncidentStatus.REPORTED) {
      if (!canTransition(IncidentStatus.REPORTED, IncidentStatus.ASSIGNED)) {
        throw new HttpError(409, `Transition invalide depuis ${incident.status} vers ASSIGNED`);
      }
      incident.status = IncidentStatus.ASSIGNED;
    }

    const assignedTargetId = technician?._id ?? directEmployee!._id;
    const assignedDisplayName =
      technician?.name || directEmployee?.fullName || "Technicien";

    incident.assignedTo = assignedTargetId;
    await incident.save();

    await appendIncidentTimeline(incident._id, {
      type: IncidentTimelineType.ASSIGNED,
      message: `Assigné à ${assignedDisplayName}`,
      by: user.id,
      meta: { assignedTo: String(assignedTargetId) },
    });

    if (technician?._id) {
      await notifyUser({
        userId: String(technician._id),
        type: ReminderType.INCIDENT_STATUS,
        title: "Nouvel incident assigné",
        body: incident.title,
        dedupeKey: `incident-assign:${incident._id}:${technician._id}`,
        meta: { incidentId: String(incident._id) },
      });
    }

    await incident.populate([
      { path: "residence", select: "name city" },
      { path: "apartment", select: "number floor" },
      { path: "reportedBy", select: "name email" },
      { path: "assignedTo", select: "name email phone" },
    ]);

    return json(incident.toObject ? incident.toObject() : incident, 200);
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
