import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json } from "@/lib/api";
import { requireIncidentAccess } from "@/lib/incidents/access";
import { IncidentHistory } from "@/models/IncidentHistory";
import { withAuth, type AuthUser } from "@/lib/auth-guard";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

export const GET = withAuth(async (_req: NextRequest, user: AuthUser, context?: unknown) => {
  const params = await Promise.resolve((context as RouteParams | undefined)?.params);
  const id = params?.id;
  if (!isValidObjectId(id)) {
    throw new HttpError(400, "Identifiant d'incident invalide");
  }

  await requireIncidentAccess(user, id);

  const page = Math.max(1, Number.parseInt(_req.nextUrl.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(_req.nextUrl.searchParams.get("limit") || "25", 10) || 25));
  const filter = { incident: id };
  const [data, total] = await Promise.all([
    IncidentHistory.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: "actor", select: "name role" })
      .lean(),
    IncidentHistory.countDocuments(filter),
  ]);

  return json({ data, meta: { page, limit, total } });
});
