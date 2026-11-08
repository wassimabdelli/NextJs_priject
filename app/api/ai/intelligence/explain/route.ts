import type { NextRequest } from "next/server";
import { HttpError, json, parseBody } from "@/lib/api";
import { resolveIntelligenceResidenceScope } from "@/lib/ai-intelligence/access";
import { loadVerifiedRecurringPattern } from "@/lib/ai-intelligence/pattern-loader";
import { intelligencePatternInputSchema } from "@/lib/ai-intelligence/schemas";
import { explainManagementReport } from "@/lib/ai/management-reports";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Role } from "@/types/enums";

export const POST = withAuth(
  async (req: NextRequest, user: AuthUser) => {
    const input = await parseBody(req, intelligencePatternInputSchema);
    const scope = await resolveIntelligenceResidenceScope(user, input.residenceId);
    const { pattern, incidents } = await loadVerifiedRecurringPattern(input, scope);
    const result = await explainManagementReport(user.id, "incidents", {
      residenceId: input.residenceId,
      pattern: {
        category: pattern.category,
        complaintCount: pattern.count,
        location: pattern.location,
        firstReportedAt: pattern.firstReportedAt,
        latestReportedAt: pattern.latestReportedAt,
        detectionMethod: pattern.detectionMethod,
        evidenceLevel: pattern.evidenceLevel,
        sharedTerms: pattern.sharedTerms,
        incidentIds: pattern.incidentIds,
      },
      complaints: incidents.slice(0, 8).map((incident) => ({
        title: incident.title,
        description: incident.description.slice(0, 500),
        status: incident.status,
        priority: incident.priority,
      })),
      instruction: `Explain this as a possible similarity only. Detection method: ${pattern.detectionMethod}. Do not infer a shared cause or invent figures.`,
    });
    if (!result) throw new HttpError(502, "L'explication IA n'a pas pu être produite.");
    return json({ data: result });
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
