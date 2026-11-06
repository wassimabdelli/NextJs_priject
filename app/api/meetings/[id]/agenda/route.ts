import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json } from "@/lib/api";
import { withAuth, getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { Meeting } from "@/models/Meeting";
import { generateMeetingAgenda } from "@/lib/meetings/agenda";
import { Role } from "@/types/enums";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/** POST /api/meetings/[id]/agenda — génère l'ordre du jour */
export const POST = withAuth(
  async (_req: NextRequest, user: AuthUser, context?: unknown) => {
    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant invalide");

    const meeting = await Meeting.findById(id);
    if (!meeting) throw new HttpError(404, "Assemblée introuvable");

    if (user.role === Role.SYNDIC) {
      const ids = await getSyndicResidenceIds(user.id);
      if (!ids.includes(String(meeting.residence))) {
        throw new HttpError(403, "Accès refusé");
      }
    }

    const result = await generateMeetingAgenda(id);
    return json(result, 200);
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
