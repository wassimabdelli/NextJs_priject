import { json } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Notification } from "@/models/Notification";
import { Role } from "@/types/enums";

export const PATCH = withAuth(async (_req, user: AuthUser) => {
  const result = await Notification.updateMany(
    { recipient: user.id, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return json({ updatedCount: result.modifiedCount });
}, { roles: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT, Role.TECHNICIAN] });
