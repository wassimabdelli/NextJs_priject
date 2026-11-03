import type { NextRequest } from "next/server";
import { json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import {
  completeTask,
  loadTaskForActor,
  MAINTENANCE_POPULATE,
} from "@/lib/maintenance/service";
import { maintenanceCompleteSchema } from "@/lib/validations/maintenance";
import { MaintenanceTask } from "@/models/MaintenanceTask";
import { Role } from "@/types/enums";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

/**
 * POST /api/maintenance/[id]/complete : clôture idempotente d'une intervention.
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthUser, context: RouteContext) => {
    const { id } = await Promise.resolve(context.params);
    const body = await parseBody(req, maintenanceCompleteSchema);
    const task = await loadTaskForActor(id, user);

    await completeTask(task, body);

    const updated = await MaintenanceTask.findById(task._id)
      .populate(MAINTENANCE_POPULATE)
      .lean();

    return json(updated, 200);
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.TECHNICIAN] }
);
