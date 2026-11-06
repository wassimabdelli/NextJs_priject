import type { NextRequest } from "next/server";
import { json } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Reminder } from "@/models/Reminder";
import { ReminderChannel, Role } from "@/types/enums";

/**
 * GET /api/notifications — boîte de réception in-app de l'utilisateur.
 */
export const GET = withAuth(
  async (req: NextRequest, user: AuthUser) => {
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    const skip = (page - 1) * limit;

    const filter = {
      user: user.id,
      channel: ReminderChannel.IN_APP,
    };

    const [data, total, unread] = await Promise.all([
      Reminder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Reminder.countDocuments(filter),
      Reminder.countDocuments({ ...filter, readAt: { $exists: false } }),
    ]);

    return json({
      data,
      meta: { page, limit, total, unread },
    });
  },
  {
    roles: [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT, Role.TECHNICIAN],
  }
);

/**
 * PATCH /api/notifications — marque tout comme lu (ou ids fournis).
 */
export const PATCH = withAuth(
  async (req: NextRequest, user: AuthUser) => {
    const body = await req.json().catch(() => ({}));
    const ids: string[] | undefined = Array.isArray(body.ids) ? body.ids : undefined;
    const filter: Record<string, unknown> = {
      user: user.id,
      channel: ReminderChannel.IN_APP,
      readAt: { $exists: false },
    };
    if (ids?.length) filter._id = { $in: ids };

    const result = await Reminder.updateMany(filter, { $set: { readAt: new Date() } });
    return json({ updated: result.modifiedCount }, 200);
  },
  {
    roles: [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT, Role.TECHNICIAN],
  }
);
