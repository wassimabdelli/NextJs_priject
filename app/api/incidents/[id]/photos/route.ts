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

const photo = z.string().min(10).max(2_000_000);
const schema = z.object({
  kind: z.enum(["before", "after"]),
  photos: z.array(photo).min(1).max(3),
});

/**
 * POST /api/incidents/[id]/photos
 * Ajoute des photos avant / après intervention.
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthUser, context?: unknown) => {
    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant invalide");

    const data = await parseBody(req, schema);
    const incident = await Incident.findById(id);
    if (!incident) throw new HttpError(404, "Incident introuvable");

    if (user.role === Role.SYNDIC) {
      const ids = await getSyndicResidenceIds(user.id);
      if (!ids.includes(String(incident.residence))) {
        throw new HttpError(403, "Accès refusé");
      }
    } else if (user.role === Role.TECHNICIAN) {
      if (String(incident.assignedTo) !== user.id) {
        throw new HttpError(403, "Incident non assigné");
      }
    } else if (user.role === Role.OWNER || user.role === Role.TENANT) {
      if (String(incident.reportedBy) !== user.id || data.kind !== "before") {
        throw new HttpError(403, "Accès refusé");
      }
    }

    if (data.kind === "before") {
      incident.beforePhotos = [...(incident.beforePhotos || []), ...data.photos].slice(0, 6);
      incident.photos = [...new Set([...(incident.photos || []), ...data.photos])].slice(0, 6);
    } else {
      incident.afterPhotos = [...(incident.afterPhotos || []), ...data.photos].slice(0, 6);
    }
    await incident.save();

    await appendIncidentTimeline(incident._id, {
      type:
        data.kind === "before"
          ? IncidentTimelineType.PHOTO_BEFORE
          : IncidentTimelineType.PHOTO_AFTER,
      message:
        data.kind === "before"
          ? `${data.photos.length} photo(s) avant ajoutée(s)`
          : `${data.photos.length} photo(s) après ajoutée(s)`,
      by: user.id,
    });

    return json(incident.toObject(), 200);
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.TECHNICIAN, Role.OWNER, Role.TENANT] }
);
