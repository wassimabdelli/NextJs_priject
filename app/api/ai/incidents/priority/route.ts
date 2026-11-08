import type { NextRequest } from "next/server";
import { HttpError, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { recommendPriority } from "@/lib/ai/priority-recommender";
import { incidentScopeRoles, priorityInputSchema } from "@/lib/ai/schemas";

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!incidentScopeRoles.includes(user.role as (typeof incidentScopeRoles)[number])) throw new HttpError(403, "Rôle non autorisé");
  const input = await parseBody(req, priorityInputSchema);
  return json(await recommendPriority(user.id, input.description));
});
