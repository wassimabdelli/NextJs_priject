import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import {
  withAuth,
  getSyndicResidenceIds,
  getResidentResidenceIds,
  type AuthUser,
} from "@/lib/auth-guard";
import { Meeting } from "@/models/Meeting";
import { Apartment } from "@/models/Apartment";
import { Role } from "@/types/enums";
import { objectId } from "@/lib/validations/common";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

const attendanceSchema = z.object({
  attendees: z
    .array(
      z.object({
        apartment: objectId,
        present: z.boolean(),
      })
    )
    .min(1),
});

/** GET /api/meetings/[id]/quorum */
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

    const apartments = await Apartment.find({ residence: meeting.residence })
      .select("number floor shares owner")
      .populate({ path: "owner", select: "name" })
      .lean();

    const stats = await meeting.getQuorumStats();
    return json({
      quorum: stats,
      attendees: meeting.attendees,
      apartments,
      minutesSignedAt: meeting.minutesSignedAt,
    });
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.OWNER] }
);

/** PUT /api/meetings/[id]/quorum — feuille de présence */
export const PUT = withAuth(
  async (req: NextRequest, user: AuthUser, context?: unknown) => {
    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant invalide");

    const data = await parseBody(req, attendanceSchema);
    const meeting = await Meeting.findById(id);
    if (!meeting) throw new HttpError(404, "Assemblée introuvable");

    if (user.role === Role.SYNDIC) {
      const ids = await getSyndicResidenceIds(user.id);
      if (!ids.includes(String(meeting.residence))) throw new HttpError(403, "Accès refusé");
    }

    const aptMap = new Map(
      (
        await Apartment.find({
          _id: { $in: data.attendees.map((a) => a.apartment) },
          residence: meeting.residence,
        })
          .select("_id shares")
          .lean()
      ).map((a) => [String(a._id), a.shares || 0])
    );

    meeting.attendees = data.attendees
      .filter((a) => aptMap.has(a.apartment))
      .map((a) => ({
        apartment: a.apartment as never,
        present: a.present,
        shares: aptMap.get(a.apartment) || 0,
        markedAt: new Date(),
      }));

    await meeting.save();
    const stats = await meeting.getQuorumStats();
    return json({ quorum: stats, attendees: meeting.attendees });
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
