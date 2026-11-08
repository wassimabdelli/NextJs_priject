import type { NextRequest } from "next/server";
import { HttpError, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import {
  changeTaskStatus,
  loadTaskForActor,
  MAINTENANCE_POPULATE,
} from "@/lib/maintenance/service";
import { maintenanceStatusSchema } from "@/lib/validations/maintenance";
import { MaintenanceTask } from "@/models/MaintenanceTask";
import { MaintenanceStatus, Role } from "@/types/enums";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

/**
 * PATCH /api/maintenance/[id]/status : démarrage ou annulation d'une intervention.
 */
export const PATCH = withAuth(
  async (req: NextRequest, user: AuthUser, context: RouteContext) => {
    const { id } = await Promise.resolve(context.params);
    const body = await parseBody(req, maintenanceStatusSchema);
    const task = await loadTaskForActor(id, user);

    if (
      user.role === Role.TECHNICIAN &&
      body.status === MaintenanceStatus.CANCELLED
    ) {
      throw new HttpError(403, "Seul le syndic peut annuler une intervention");
    }

    await changeTaskStatus(task, body.status);

    const updated = await MaintenanceTask.findById(task._id)
      .populate(MAINTENANCE_POPULATE)
      .lean();

    return json(updated, 200);
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.TECHNICIAN] }
);
