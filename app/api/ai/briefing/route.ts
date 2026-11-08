import type { NextRequest } from "next/server";
import { json } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { resolveIntelligenceResidenceScope } from "@/lib/ai-intelligence/access";
import { computeBriefing } from "@/lib/ai-intelligence/briefing";
import { explainManagementReport } from "@/lib/ai/management-reports";
import { redactPII } from "@/lib/ai/redact";
import { Role } from "@/types/enums";

const cache = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 60 * 60 * 1000;

export const GET = withAuth(
  async (req: NextRequest, user: AuthUser) => {
    const scope = await resolveIntelligenceResidenceScope(user);
    const scopeKey = scope === null ? "all" : [...scope].sort().join(",");
    const cacheKey = `${user.id}:${scopeKey}`;
    const refresh = req.nextUrl.searchParams.get("refresh") === "1";
    const hit = cache.get(cacheKey);
    if (!refresh && hit && Date.now() - hit.at < TTL_MS) return json(hit.value);

    const facts = await computeBriefing(scope);
    let narrative: Awaited<ReturnType<typeof explainManagementReport>> | null = null;
    let narrativeUnavailable = false;
    try {
      narrative = await explainManagementReport(user.id, "incidents", {
        kind: "daily_briefing",
        criticalUnassigned: facts.criticalUnassigned.map(({ title, residence, hoursOpen }) => ({
          title: redactPII(title),
          residence: redactPII(residence),
          hoursOpen,
        })),
        staleOverSevenDays: facts.staleOverSevenDays,
        resolvedLast24h: facts.resolvedLast24h,
        recurring: facts.recurring.map(({ category, count, sharedTerms }) => ({
          category,
          count,
          sharedTerms: sharedTerms.map(redactPII),
        })),
        instruction: "Write a short morning briefing in French for a property manager. Suggest what to review first. Do not claim a common cause. Use only these verified facts.",
      });
    } catch (error) {
      narrativeUnavailable = true;
      console.warn(
        "[AI briefing] Narrative unavailable; computed facts remain available.",
        error instanceof Error ? error.message : "Unknown AI provider error"
      );
    }

    const value = { facts, narrative, narrativeUnavailable };
    cache.set(cacheKey, { at: Date.now(), value });
    return json(value);
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
