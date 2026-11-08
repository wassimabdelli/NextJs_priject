import { AnnouncementStatus, IntelligenceReviewStatus } from "@/types/enums";

export function canTransitionIntelligenceReview(
  current: IntelligenceReviewStatus,
  next: IntelligenceReviewStatus
) {
  return (current === IntelligenceReviewStatus.DRAFT
    && next === IntelligenceReviewStatus.UNDER_REVIEW)
    || (current === IntelligenceReviewStatus.UNDER_REVIEW
      && (next === IntelligenceReviewStatus.APPROVED || next === IntelligenceReviewStatus.REJECTED));
}

export function isIntelligenceAnnouncementPublishable(
  source: { reviewStatus: IntelligenceReviewStatus } | undefined,
  targetStatus: string
) {
  return !source
    || (targetStatus !== AnnouncementStatus.PUBLISHED && targetStatus !== AnnouncementStatus.SCHEDULED)
    || source.reviewStatus === IntelligenceReviewStatus.APPROVED;
}
