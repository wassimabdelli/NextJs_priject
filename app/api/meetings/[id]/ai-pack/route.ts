import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json } from "@/lib/api";
import { withAuth, getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { Meeting } from "@/models/Meeting";
import { Residence } from "@/models/Residence";
import { generatePackFromTranscript } from "@/lib/ai/meeting-assistant";
import { Role } from "@/types/enums";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * POST /api/meetings/[id]/ai-pack
 * Lit le transcript sauvegardé → génère ODJ + brouillon PV via IA.
 */
export const POST = withAuth(
  async (_req: NextRequest, user: AuthUser, context?: unknown) => {
    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant invalide");

    const meeting = await Meeting.findById(id);
    if (!meeting) throw new HttpError(404, "Assemblée introuvable");

    if (user.role === Role.SYNDIC) {
      const ids = await getSyndicResidenceIds(user.id);
      if (!ids.includes(String(meeting.residence))) throw new HttpError(403, "Accès refusé");
    }

    if (!meeting.transcript || meeting.transcript.trim().length < 20) {
      throw new HttpError(
        400,
        "Enregistre d'abord une transcription (compte-rendu oral) avant de lancer l'IA"
      );
    }

    const residence = await Residence.findById(meeting.residence).select("name").lean();
    const result = await generatePackFromTranscript({
      transcript: meeting.transcript,
      meetingTitle: meeting.title,
      residenceName: residence?.name,
      existingAgenda: meeting.agendaItems,
    });

    meeting.agendaItems = result.agendaItems;
    meeting.agenda = result.agendaItems.join("\n");
    meeting.aiMinutesDraft = [
      result.minutesDraft,
      result.decisions.length
        ? `\n\nDécisions retenues :\n${result.decisions.map((d) => `- ${d}`).join("\n")}`
        : "",
    ]
      .join("")
      .trim();
    meeting.aiGeneratedAt = new Date();
    await meeting.save();

    return json({
      agendaItems: meeting.agendaItems,
      aiMinutesDraft: meeting.aiMinutesDraft,
      aiGeneratedAt: meeting.aiGeneratedAt,
      source: result.source,
      decisions: result.decisions,
    });
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
