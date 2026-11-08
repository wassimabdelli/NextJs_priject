import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Notification } from "@/models/Notification";
import { Role } from "@/types/enums";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export const DELETE = withAuth(async (_req: NextRequest, user: AuthUser, context?: RouteContext) => {
  const params = context?.params;
  const { id } = params ? await Promise.resolve(params) : { id: "" };
  if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant de notification invalide");
  const result = await Notification.deleteOne({ _id: id, recipient: user.id });
  if (!result.deletedCount) throw new HttpError(404, "Notification introuvable");
  return json({ success: true });
}, { roles: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT, Role.TECHNICIAN] });
