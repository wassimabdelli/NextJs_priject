import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { requireIncidentAccess } from "@/lib/incidents/access";
import { recordIncidentHistory } from "@/lib/incidents/recordHistory";
import { IncidentComment } from "@/models/IncidentComment";
import { incidentCommentSchema } from "@/lib/validations/incident";
import { notifyIncidentHistory } from "@/lib/notifications/events";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

async function getIncidentId(context?: unknown) {
  const params = await Promise.resolve((context as RouteParams | undefined)?.params);
  if (!isValidObjectId(params?.id)) {
    throw new HttpError(400, "Identifiant d'incident invalide");
  }
  return params.id;
}

export const GET = withAuth(async (req: NextRequest, user: AuthUser, context?: unknown) => {
  const id = await getIncidentId(context);
  await requireIncidentAccess(user, id);

  const page = Math.max(1, Number.parseInt(req.nextUrl.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.nextUrl.searchParams.get("limit") || "25", 10) || 25));
  const filter = { incident: id };
  const [data, total] = await Promise.all([
    IncidentComment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: "author", select: "name role" })
      .lean(),
    IncidentComment.countDocuments(filter),
  ]);

  return json({ data, meta: { page, limit, total } });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser, context?: unknown) => {
  const id = await getIncidentId(context);
  await requireIncidentAccess(user, id);
  const data = await parseBody(req, incidentCommentSchema);

  const comment = await IncidentComment.create({
    incident: id,
    author: user.id,
    content: data.content,
    attachments: data.attachments,
  });
  const history = await recordIncidentHistory({
    incidentId: id,
    actorId: user.id,
    action: "COMMENT_ADDED",
    description: "Commentaire ajouté",
  });
  await notifyIncidentHistory(String(history._id), id, "COMMENT_ADDED", user.id);
  await comment.populate({ path: "author", select: "name role" });

  return json(comment.toObject(), 201);
});
