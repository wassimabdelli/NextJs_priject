import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import { withAuth, getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { Incident } from "@/models/Incident";
import { appendIncidentTimeline } from "@/lib/incidents/timeline";
import { IncidentTimelineType, Role } from "@/types/enums";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

const commentSchema = z.object({
  message: z.string().trim().min(2).max(1000),
});

/** GET /api/incidents/[id]/timeline */
export const GET = withAuth(
  async (_req: NextRequest, user: AuthUser, context?: unknown) => {
    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant invalide");

    const incident = await Incident.findById(id)
      .select("timeline residence reportedBy assignedTo")
      .populate({ path: "timeline.by", select: "name role" })
      .lean();
    if (!incident) throw new HttpError(404, "Incident introuvable");

    if (user.role === Role.SYNDIC) {
      const ids = await getSyndicResidenceIds(user.id);
      if (!ids.includes(String(incident.residence))) throw new HttpError(403, "Accès refusé");
    } else if (user.role === Role.TECHNICIAN) {
      if (String(incident.assignedTo) !== user.id) throw new HttpError(403, "Accès refusé");
    } else if (user.role === Role.OWNER || user.role === Role.TENANT) {
      if (String(incident.reportedBy) !== user.id) throw new HttpError(403, "Accès refusé");
    }

    return json({ data: incident.timeline || [] });
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.TECHNICIAN, Role.OWNER, Role.TENANT] }
);

/** POST /api/incidents/[id]/timeline — commentaire */
export const POST = withAuth(
  async (req: NextRequest, user: AuthUser, context?: unknown) => {
    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant invalide");

    const data = await parseBody(req, commentSchema);
    const incident = await Incident.findById(id);
    if (!incident) throw new HttpError(404, "Incident introuvable");

    await appendIncidentTimeline(incident._id, {
      type: IncidentTimelineType.COMMENT,
      message: data.message,
      by: user.id,
    });

    const updated = await Incident.findById(id)
      .select("timeline")
      .populate({ path: "timeline.by", select: "name role" })
      .lean();

    return json({ data: updated?.timeline || [] }, 201);
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.TECHNICIAN] }
);
