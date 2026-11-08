import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, json } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Notification, notificationTypes } from "@/models/Notification";
import { Role } from "@/types/enums";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  read: z.enum(["true", "false"]).optional(),
  type: z.enum(notificationTypes).optional(),
  q: z.string().trim().max(100).optional(),
});

function safeSearch(value: string) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!Object.values(Role).includes(user.role)) throw new HttpError(403, "Rôle non autorisé");
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!parsed.success) throw new HttpError(400, "Filtres de notification invalides");
  const { page, limit, read, type, q } = parsed.data;
  const filter: Record<string, unknown> = { recipient: user.id };
  if (read !== undefined) filter.isRead = read === "true";
  if (type) filter.type = type;
  if (q) filter.$or = [{ title: safeSearch(q) }, { message: safeSearch(q) }];
  const [rows, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("type title message relatedResource residence isRead readAt createdAt")
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: user.id, isRead: false }),
  ]);
  return json({ data: rows, meta: { page, limit, total }, unreadCount });
}, { roles: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT, Role.TECHNICIAN] });
