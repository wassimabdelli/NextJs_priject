import type { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { HttpError, isValidObjectId, json } from "@/lib/api";
import { withAuth, getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { Meeting } from "@/models/Meeting";
import { Residence } from "@/models/Residence";
import { generatePackFromRecording } from "@/lib/ai/meeting-assistant";
import { Role } from "@/types/enums";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

const MAX_BYTES = 100 * 1024 * 1024; // 100 Mo (aligné proxyClientMaxBodySize)
const ALLOWED = new Set([
  "audio/webm",
  "video/webm",
  "audio/mp4",
  "video/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/x-m4a",
  "audio/m4a",
]);

/**
 * POST /api/meetings/[id]/recording
 * Upload enregistrement Jitsi (.webm…) → transcription Gemini → Pack AG.
 * multipart field "file" ou JSON { base64, mimeType }.
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthUser, context?: unknown) => {
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

    const contentType = req.headers.get("content-type") || "";
    let buffer: Buffer;
    let mimeType = "audio/webm";
    let originalName = "recording.webm";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!file || typeof file === "string") {
        throw new HttpError(400, "Fichier manquant (champ file)");
      }
      const blob = file as File;
      mimeType = blob.type || "audio/webm";
      originalName = blob.name || originalName;
      if (blob.size === 0) {
        throw new HttpError(400, "Fichier vide (0 octet) — utilise l'autre enregistrement");
      }
      if (blob.size > MAX_BYTES) {
        throw new HttpError(400, "Fichier trop volumineux (max 100 Mo)");
      }
      buffer = Buffer.from(await blob.arrayBuffer());
    } else {
      const body = await req.json().catch(() => ({}));
      const raw = body.base64 || body.file;
      mimeType = body.mimeType || "audio/webm";
      if (!raw || typeof raw !== "string") {
        throw new HttpError(400, "base64 manquant");
      }
      const match = raw.match(/^data:([^;]+);base64,(.+)$/);
      const b64 = match ? match[2] : raw;
      if (match?.[1]) mimeType = match[1];
      buffer = Buffer.from(b64, "base64");
      if (buffer.length === 0) throw new HttpError(400, "Fichier vide");
      if (buffer.length > MAX_BYTES) {
        throw new HttpError(400, "Fichier trop volumineux (max 100 Mo)");
      }
    }

    const normalizedMime = mimeType.split(";")[0].trim().toLowerCase();
    if (
      !ALLOWED.has(normalizedMime) &&
      !normalizedMime.startsWith("audio/") &&
      !normalizedMime.startsWith("video/")
    ) {
      throw new HttpError(400, `Type non supporté (${mimeType}). Utilise .webm / audio.`);
    }

    // Archive locale
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "ag-recordings");
    await mkdir(uploadsDir, { recursive: true });
    const ext = path.extname(originalName) || ".webm";
    const filename = `ag-${id}-${Date.now()}${ext}`;
    await writeFile(path.join(uploadsDir, filename), buffer);
    const recordingUrl = `/uploads/ag-recordings/${filename}`;

    const residence = await Residence.findById(meeting.residence).select("name").lean();

    let result;
    try {
      result = await generatePackFromRecording({
        base64Data: buffer.toString("base64"),
        mimeType: normalizedMime || "audio/webm",
        meetingTitle: meeting.title,
        residenceName: residence?.name,
        existingAgenda: meeting.agendaItems,
      });
    } catch (err) {
      throw new HttpError(
        502,
        err instanceof Error ? err.message : "Échec transcription IA"
      );
    }

    meeting.transcript = result.transcript || meeting.transcript;
    meeting.transcriptSavedAt = new Date();
    meeting.agendaItems = result.agendaItems;
    meeting.agenda = result.agendaItems.join("\n");
    meeting.aiMinutesDraft = [
      result.minutesDraft,
      result.decisions.length
        ? `\n\nDécisions retenues :\n${result.decisions.map((d) => `- ${d}`).join("\n")}`
        : "",
      `\n\n[Enregistrement source : ${recordingUrl}]`,
    ]
      .join("")
      .trim();
    meeting.aiGeneratedAt = new Date();
    await meeting.save();

    return json({
      recordingUrl,
      transcript: meeting.transcript,
      agendaItems: meeting.agendaItems,
      aiMinutesDraft: meeting.aiMinutesDraft,
      source: result.source,
      decisions: result.decisions,
    });
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
