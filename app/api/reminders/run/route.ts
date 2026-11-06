import type { NextRequest } from "next/server";
import { json, handle } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { runAllScheduledReminders } from "@/lib/notifications/reminders";
import { Role } from "@/types/enums";

/**
 * POST /api/reminders/run
 * Déclenche les rappels planifiés (charges + AG).
 * ADMIN/SYNDIC, ou secret CRON_SECRET en header x-cron-secret.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const cronSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers.get("x-cron-secret");

    if (!(cronSecret && headerSecret === cronSecret)) {
      const user = await requireAuth();
      requireRole(user, Role.ADMIN, Role.SYNDIC);
    }

    const result = await runAllScheduledReminders();
    return json({ ok: true, ...result }, 200);
  });
}
