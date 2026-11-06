import type { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { HttpError, isValidObjectId, json } from "@/lib/api";
import {
  withAuth,
  getSyndicResidenceIds,
  getResidentResidenceIds,
  type AuthUser,
} from "@/lib/auth-guard";
import { Meeting } from "@/models/Meeting";
import { buildMinutesPdf } from "@/lib/meetings/minutesPdf";
import { Role } from "@/types/enums";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/** GET /api/meetings/[id]/minutes — PDF du PV */
export const GET = withAuth(
  async (_req: NextRequest, user: AuthUser, context?: unknown) => {
    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant invalide");

    const meeting = await Meeting.findById(id);
    if (!meeting) throw new HttpError(404, "Assemblée introuvable");

    if (user.role === Role.SYNDIC) {
      const ids = await getSyndicResidenceIds(user.id);
      if (!ids.includes(String(meeting.residence))) throw new HttpError(403, "Accès refusé");
    } else if (user.role === Role.OWNER) {
      const ids = await getResidentResidenceIds(user.id);
      if (!ids.includes(String(meeting.residence))) throw new HttpError(403, "Accès refusé");
    }

    try {
      const bytes = await buildMinutesPdf(id);
      return new Response(Buffer.from(bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="pv-ag-${id}.pdf"`,
        },
      });
    } catch (err) {
      console.error("[minutes PDF]", err);
      throw new HttpError(
        500,
        err instanceof Error ? `PV PDF : ${err.message}` : "Erreur génération PV"
      );
    }
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.OWNER] }
);

/** POST /api/meetings/[id]/minutes — signe le PV et archive le PDF */
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

    meeting.minutesSignedAt = new Date();
    meeting.minutesSignedBy = user.id as never;

    const bytes = await buildMinutesPdf(id);
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const filename = `pv-ag-${id}-${Date.now()}.pdf`;
    await writeFile(path.join(uploadsDir, filename), Buffer.from(bytes));
    meeting.minutesDocumentUrl = `/uploads/${filename}`;
    await meeting.save();

    return json({
      minutesSignedAt: meeting.minutesSignedAt,
      minutesDocumentUrl: meeting.minutesDocumentUrl,
    });
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
