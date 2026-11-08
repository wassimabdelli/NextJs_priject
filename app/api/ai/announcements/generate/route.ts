import type { NextRequest } from "next/server";
import { HttpError, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { generateAnnouncement } from "@/lib/ai/announcement-generator";
import { announcementGenerateInputSchema } from "@/lib/ai/schemas";
import { Role } from "@/types/enums";

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (user.role !== Role.ADMIN && user.role !== Role.SYNDIC) throw new HttpError(403, "Génération réservée à ADMIN et SYNDIC");
  const input = await parseBody(req, announcementGenerateInputSchema);
  return json(await generateAnnouncement(user.id, input));
});
