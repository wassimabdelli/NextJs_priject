import type { NextRequest } from "next/server";
import { HttpError, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { classifyIncident } from "@/lib/ai/incident-classifier";
import { incidentTextInput, incidentScopeRoles } from "@/lib/ai/schemas";

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!incidentScopeRoles.includes(user.role as (typeof incidentScopeRoles)[number])) {
    throw new HttpError(403, "Rôle non autorisé");
  }
  const input = await parseBody(req, incidentTextInput);
  return json(await classifyIncident(user.id, input.title, input.description));
});
