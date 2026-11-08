import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Notification } from "@/models/Notification";
import { Role } from "@/types/enums";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export const PATCH = withAuth(async (_req: NextRequest, user: AuthUser, context?: RouteContext) => {
  const params = context?.params;
  const { id } = params ? await Promise.resolve(params) : { id: "" };
  if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant de notification invalide");
  const notification = await Notification.findOneAndUpdate(
    { _id: id, recipient: user.id, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  )
    .select("type title message relatedResource residence isRead readAt createdAt")
    .lean();
  if (notification) return json(notification);
  const existing = await Notification.findOne({ _id: id, recipient: user.id })
    .select("type title message relatedResource residence isRead readAt createdAt")
    .lean();
  if (!existing) throw new HttpError(404, "Notification introuvable");
  return json(existing);
}, { roles: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT, Role.TECHNICIAN] });
