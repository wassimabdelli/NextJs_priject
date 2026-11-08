import { json } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Notification } from "@/models/Notification";
import { Role } from "@/types/enums";

export const GET = withAuth(async (_req, user: AuthUser) => {
  const unreadCount = await Notification.countDocuments({ recipient: user.id, isRead: false });
  return json({ unreadCount });
}, { roles: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT, Role.TECHNICIAN] });
