import type { NextRequest } from "next/server";
import { HttpError, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { translateAnnouncement } from "@/lib/ai/announcement-translator";
import { translationInputSchema } from "@/lib/ai/schemas";
import { Role } from "@/types/enums";

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (![Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT, Role.TECHNICIAN].includes(user.role)) throw new HttpError(403, "Rôle non autorisé");
  const input = await parseBody(req, translationInputSchema);
  return json(await translateAnnouncement(user.id, input));
});
