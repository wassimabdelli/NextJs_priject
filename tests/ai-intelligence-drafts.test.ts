import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import type { IntelligenceIncident, RecurringProblem } from "../lib/ai-intelligence/analysis";
import {
  isIntelligenceAnnouncementPublishable,
  canTransitionIntelligenceReview,
} from "../lib/ai-intelligence/review";
import { AnnouncementStatus, IntelligenceReviewStatus } from "../types/enums";

const residenceId = "650000000000000000000001";
const incidentIds = ["650000000000000000000011", "650000000000000000000012"];
let existingAnnouncement: unknown = null;
let createCalls = 0;
let generationCalls = 0;
let providerError: Error | null = null;
let createdDocument: Record<string, unknown> | null = null;

mock.module(pathToFileURL(resolve("lib/api.ts")).href, {
  namedExports: {
    isDuplicateKeyError: (error: unknown) =>
      Boolean(error && typeof error === "object" && "code" in error && error.code === 11000),
  },
});

mock.module(pathToFileURL(resolve("lib/ai/announcement-generator.ts")).href, {
  namedExports: {
    generateAnnouncement: async () => {
      generationCalls += 1;
      if (providerError) throw providerError;
      return {
        title: "Information sur les problèmes de plomberie",
        content: "Nous suivons les signalements de plomberie reçus.",
        suggestedCategory: "MAINTENANCE",
        suggestedPriority: "NORMAL",
      };
    },
  },
});

mock.module(pathToFileURL(resolve("models/Announcement.ts")).href, {
  namedExports: {
    Announcement: {
      findOne: () => ({ lean: async () => existingAnnouncement }),
      create: async (document: Record<string, unknown>) => {
        createCalls += 1;
        createdDocument = document;
        return { toObject: () => document };
      },
    },
  },
});

const draftService = import("../lib/ai-intelligence/drafts");

const incidents: IntelligenceIncident[] = incidentIds.map((id, index) => ({
  id,
  title: "Fuite eau plafond cuisine",
  description: "Une fuite eau est visible au plafond de la cuisine.",
  category: "PLUMBING",
  priority: "MEDIUM",
  status: "REPORTED",
  reportedAt: new Date(`2026-10-${20 + index}T10:00:00.000Z`),
  residenceId,
}));

const pattern: RecurringProblem = {
  id: "similarity-0123456789abcdef",
  residenceId,
  patternKey: "pattern-0123456789abcdef",
  category: "PLUMBING",
  count: 2,
  incidentIds,
  location: null,
  firstReportedAt: "2026-10-20T10:00:00.000Z",
  latestReportedAt: "2026-10-21T10:00:00.000Z",
  detectionMethod: "meaningful_text_overlap",
  evidenceLevel: "moderate",
  sharedTerms: ["cuisine", "fuite", "plafond"],
  statuses: { REPORTED: 2 },
  priorities: { MEDIUM: 2 },
};

function reset() {
  existingAnnouncement = null;
  createCalls = 0;
  generationCalls = 0;
  providerError = null;
  createdDocument = null;
}

test("announcement draft creation persists source complaint references without publishing", async () => {
  reset();
  const { createIntelligenceAnnouncementDraft } = await draftService;
  const result = await createIntelligenceAnnouncementDraft({
    userId: "650000000000000000000099",
    residenceId,
    incidents,
    pattern,
    audience: "RESIDENTS",
    language: "FR",
  });
  assert.equal(result.created, true);
  assert.equal(generationCalls, 1);
  assert.equal(createCalls, 1);
  assert.equal(createdDocument?.status, AnnouncementStatus.DRAFT);
  assert.equal(
    (createdDocument?.intelligenceSource as { reviewStatus: string }).reviewStatus,
    IntelligenceReviewStatus.DRAFT
  );
  assert.deepEqual(
    (createdDocument?.intelligenceSource as { incidentIds: string[] }).incidentIds,
    incidentIds
  );
  assert.equal(
    (createdDocument?.intelligenceSource as { language: string }).language,
    "FR"
  );
});

test("an existing pattern suggestion is returned without another AI request or duplicate draft", async () => {
  reset();
  existingAnnouncement = { _id: "existing-draft", status: AnnouncementStatus.DRAFT };
  const { createIntelligenceAnnouncementDraft } = await draftService;
  const result = await createIntelligenceAnnouncementDraft({
    userId: "650000000000000000000099",
    residenceId,
    incidents,
    pattern,
    audience: "RESIDENTS",
    language: "FR",
  });
  assert.equal(result.created, false);
  assert.equal(result.announcement, existingAnnouncement);
  assert.equal(generationCalls, 0);
  assert.equal(createCalls, 0);
});

test("AI provider failures propagate and do not create an announcement", async () => {
  reset();
  providerError = new Error("Gemini quota exhausted");
  const { createIntelligenceAnnouncementDraft } = await draftService;
  await assert.rejects(
    createIntelligenceAnnouncementDraft({
      userId: "650000000000000000000099",
      residenceId,
      incidents,
      pattern,
      audience: "RESIDENTS",
      language: "FR",
    }),
    /Gemini quota exhausted/
  );
  assert.equal(createCalls, 0);
});

test("suggestions require the under-review step before approval or rejection", () => {
  assert.equal(
    canTransitionIntelligenceReview(IntelligenceReviewStatus.DRAFT, IntelligenceReviewStatus.UNDER_REVIEW),
    true
  );
  assert.equal(
    canTransitionIntelligenceReview(IntelligenceReviewStatus.DRAFT, IntelligenceReviewStatus.APPROVED),
    false
  );
  assert.equal(
    canTransitionIntelligenceReview(IntelligenceReviewStatus.UNDER_REVIEW, IntelligenceReviewStatus.APPROVED),
    true
  );
  assert.equal(
    canTransitionIntelligenceReview(IntelligenceReviewStatus.UNDER_REVIEW, IntelligenceReviewStatus.REJECTED),
    true
  );
  assert.equal(
    canTransitionIntelligenceReview(IntelligenceReviewStatus.REJECTED, IntelligenceReviewStatus.APPROVED),
    false
  );
});

test("AI suggestions cannot be published or scheduled before explicit approval", () => {
  const draftSource = { reviewStatus: IntelligenceReviewStatus.DRAFT };
  assert.equal(isIntelligenceAnnouncementPublishable(draftSource, AnnouncementStatus.PUBLISHED), false);
  assert.equal(isIntelligenceAnnouncementPublishable(draftSource, AnnouncementStatus.SCHEDULED), false);
  assert.equal(
    isIntelligenceAnnouncementPublishable(
      { reviewStatus: IntelligenceReviewStatus.APPROVED },
      AnnouncementStatus.PUBLISHED
    ),
    true
  );
});
