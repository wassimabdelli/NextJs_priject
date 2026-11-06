import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import { withAuth, getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { Meeting } from "@/models/Meeting";
import { Role } from "@/types/enums";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

const schema = z.object({
  transcript: z.string().trim().min(20, "Transcription trop courte").max(100_000),
});

/** PUT /api/meetings/[id]/transcript — sauvegarde la prise de parole / transcript */
export const PUT = withAuth(
  async (req: NextRequest, user: AuthUser, context?: unknown) => {
    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant invalide");

    const data = await parseBody(req, schema);
    const meeting = await Meeting.findById(id);
    if (!meeting) throw new HttpError(404, "Assemblée introuvable");

    if (user.role === Role.SYNDIC) {
      const ids = await getSyndicResidenceIds(user.id);
      if (!ids.includes(String(meeting.residence))) throw new HttpError(403, "Accès refusé");
    }

    meeting.transcript = data.transcript;
    meeting.transcriptSavedAt = new Date();
    await meeting.save();

    return json({
      transcriptSavedAt: meeting.transcriptSavedAt,
      length: data.transcript.length,
    });
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
