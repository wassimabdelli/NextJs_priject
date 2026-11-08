import { z } from "zod";
import { AnnouncementAudience, IntelligenceReviewStatus, values } from "@/types/enums";
import { objectId } from "@/lib/validations/common";

export const intelligencePatternInputSchema = z.object({
  residenceId: objectId,
  patternId: z.string().regex(/^(similarity|category)-[a-f\d]{16}$/),
  incidentIds: z.array(objectId).min(2).max(1000),
});

export const intelligenceAnnouncementDraftSchema = intelligencePatternInputSchema.extend({
  audience: z.enum(values(AnnouncementAudience)).default(AnnouncementAudience.RESIDENTS),
  language: z.enum(["FR", "AR", "EN"]).default("FR"),
});

export const intelligencePatternFeedbackSchema = intelligencePatternInputSchema.extend({
  status: z.enum(["CONFIRMED", "DISMISSED", "CLEAR"]),
});

export const intelligenceReviewSchema = z.object({
  status: z.enum([
    IntelligenceReviewStatus.UNDER_REVIEW,
    IntelligenceReviewStatus.APPROVED,
    IntelligenceReviewStatus.REJECTED,
  ]),
});
