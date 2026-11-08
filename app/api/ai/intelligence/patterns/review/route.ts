import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { HttpError, json, parseBody } from "@/lib/api";
import { resolveIntelligenceResidenceScope } from "@/lib/ai-intelligence/access";
import { loadVerifiedRecurringPattern } from "@/lib/ai-intelligence/pattern-loader";
import { intelligencePatternFeedbackSchema } from "@/lib/ai-intelligence/schemas";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { IntelligencePatternReview } from "@/models/IntelligencePatternReview";
import { Role } from "@/types/enums";

export const POST = withAuth(
  async (req: NextRequest, user: AuthUser) => {
    const input = await parseBody(req, intelligencePatternFeedbackSchema);
    const scope = await resolveIntelligenceResidenceScope(user, input.residenceId);
    const { pattern } = await loadVerifiedRecurringPattern(input, scope);

    if (input.status === "CLEAR") {
      await IntelligencePatternReview.deleteOne({
        residence: new mongoose.Types.ObjectId(input.residenceId),
        patternKey: pattern.patternKey,
      });
      return json({ success: true, status: null });
    }

    const review = await IntelligencePatternReview.findOneAndUpdate(
      { residence: new mongoose.Types.ObjectId(input.residenceId), patternKey: pattern.patternKey },
      {
        $set: {
          status: input.status,
          reviewer: new mongoose.Types.ObjectId(user.id),
          reviewedAt: new Date(),
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    if (!review) throw new HttpError(500, "Le retour sur ce rapprochement n'a pas été enregistré.");
    return json({ success: true, status: review.status, reviewedAt: review.reviewedAt });
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
