import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { analyzeIncident } from "@/lib/ai/incident-assistant";
import { Role } from "@/types/enums";

const analyzeSchema = z.object({
  photoBase64: z.string().optional(),
  photoMimeType: z.string().optional(),
  audioBase64: z.string().optional(),
  audioMimeType: z.string().optional(),
  context: z.string().max(1000).optional(),
  residenceName: z.string().optional(),
});

/**
 * POST /api/ai/analyze-incident
 * Point d'entrée unique pour la déclaration assistée d'incident par IA (Gemini multimodal).
 */
export const POST = withAuth(
  async (req: NextRequest, _user: AuthUser) => {
    const body = await parseBody(req, analyzeSchema);

    if (!body.photoBase64 && !body.audioBase64 && !body.context) {
      throw new HttpError(
        400,
        "Veuillez fournir au moins une photo, une note vocale ou un court texte descriptif."
      );
    }

    const result = await analyzeIncident({
      photo: body.photoBase64
        ? {
            base64Data: body.photoBase64,
            mimeType: body.photoMimeType || "image/jpeg",
          }
        : undefined,
      audio: body.audioBase64
        ? {
            base64Data: body.audioBase64,
            mimeType: body.audioMimeType || "audio/webm",
          }
        : undefined,
      context: body.context,
      residenceName: body.residenceName,
    });

    return json({ data: result });
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT] }
);

