import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import { withAuth, getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { Meeting } from "@/models/Meeting";
import { buildJitsiMeetUrl } from "@/lib/meetings/meetLink";
import { Role } from "@/types/enums";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

const bodySchema = z.object({
  /** Si fourni, enregistre un lien custom (Zoom/Meet Google déjà créé) */
  customUrl: z.string().url().optional(),
});

async function loadMeetingForSyndic(id: string, user: AuthUser) {
  if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant invalide");
  const meeting = await Meeting.findById(id);
  if (!meeting) throw new HttpError(404, "Assemblée introuvable");
  if (user.role === Role.SYNDIC) {
    const ids = await getSyndicResidenceIds(user.id);
    if (!ids.includes(String(meeting.residence))) {
      throw new HttpError(403, "Accès refusé");
    }
  }
  return meeting;
}

/** POST /api/meetings/[id]/meet — génère ou enregistre un lien visio */
export const POST = withAuth(
  async (req: NextRequest, user: AuthUser, context?: unknown) => {
    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const meeting = await loadMeetingForSyndic(rawParams?.id || "", user);
    const data = await parseBody(req, bodySchema).catch(() => ({ customUrl: undefined }));

    if (data.customUrl) {
      meeting.meetUrl = data.customUrl;
      meeting.meetProvider = "custom";
    } else {
      meeting.meetUrl = buildJitsiMeetUrl(String(meeting._id), meeting.title);
      meeting.meetProvider = "jitsi";
    }
    meeting.meetCreatedAt = new Date();

    // Enrichit le lieu si vide
    if (!meeting.location) {
      meeting.location = "Visioconférence";
    }

    await meeting.save();
    return json({
      meetUrl: meeting.meetUrl,
      meetProvider: meeting.meetProvider,
      meetCreatedAt: meeting.meetCreatedAt,
    });
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);

/** GET — renvoie le lien actuel (tous rôles AG) */
export const GET = withAuth(
  async (_req: NextRequest, user: AuthUser, context?: unknown) => {
    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant invalide");
    const meeting = await Meeting.findById(id).select(
      "meetUrl meetProvider meetCreatedAt residence title"
    );
    if (!meeting) throw new HttpError(404, "Assemblée introuvable");

    if (user.role === Role.SYNDIC) {
      const ids = await getSyndicResidenceIds(user.id);
      if (!ids.includes(String(meeting.residence))) throw new HttpError(403, "Accès refusé");
    }

    return json({
      meetUrl: meeting.meetUrl || null,
      meetProvider: meeting.meetProvider || null,
      meetCreatedAt: meeting.meetCreatedAt || null,
    });
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.OWNER] }
);
