import type { NextRequest } from "next/server";
import { json, parseBody } from "@/lib/api";
import { resolveIntelligenceResidenceScope } from "@/lib/ai-intelligence/access";
import { createIntelligenceAnnouncementDraft } from "@/lib/ai-intelligence/drafts";
import { loadVerifiedRecurringPattern } from "@/lib/ai-intelligence/pattern-loader";
import { intelligenceAnnouncementDraftSchema } from "@/lib/ai-intelligence/schemas";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Role } from "@/types/enums";

export const POST = withAuth(
  async (req: NextRequest, user: AuthUser) => {
    const input = await parseBody(req, intelligenceAnnouncementDraftSchema);
    const scope = await resolveIntelligenceResidenceScope(user, input.residenceId);
    const { incidents, pattern, residenceId } = await loadVerifiedRecurringPattern(input, scope);
    const result = await createIntelligenceAnnouncementDraft({
      userId: user.id,
      residenceId: residenceId.toString(),
      incidents,
      pattern,
      audience: input.audience,
      language: input.language,
    });
    return json({ success: true, created: result.created, announcement: result.announcement }, result.created ? 201 : 200);
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
