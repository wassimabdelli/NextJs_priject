import assert from "node:assert/strict";
import test from "node:test";
import { cosine } from "../lib/ai/similarity";
import { TriageResponseSchema, TriageSchema } from "../lib/ai/triage";
import { translationInputSchema, translationResultSchema } from "../lib/ai/schemas";

test("cosine similarity is one for identical vectors and zero for orthogonal vectors", () => {
  assert.equal(cosine([1, 2, 3], [1, 2, 3]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
});

test("TriageSchema accepts valid incident advice", () => {
  const result = TriageSchema.safeParse({
    category: "PLUMBING",
    priority: "HIGH",
    specialty: "plombier",
    probableCause: "Un joint semble usé.",
    safetyRisk: false,
    confidence: 0.84,
    reasoning: "Une fuite est décrite sous l'évier.",
  });

  assert.equal(result.success, true);
});

test("TriageSchema rejects unknown categories and out-of-range confidence", () => {
  const base = {
    category: "HEATING",
    priority: "HIGH",
    specialty: "plombier",
    probableCause: "Cause possible.",
    safetyRisk: false,
    confidence: 1.2,
    reasoning: "Justification courte.",
  };
  assert.equal(TriageSchema.safeParse(base).success, false);
  assert.equal(
    TriageSchema.safeParse({ ...base, category: "PLUMBING", confidence: 0.8 }).success,
    true
  );
});

test("photo triage response requires an editable title and description", () => {
  const result = TriageResponseSchema.safeParse({
    title: "Fuite sous l'évier",
    description: "Une fuite est visible sous l'évier.",
    category: "PLUMBING",
    priority: "HIGH",
    specialty: "plombier",
    probableCause: "Un raccord semble fuir.",
    safetyRisk: false,
    confidence: 0.84,
    reasoning: "De l'eau est visible sous l'évier.",
  });

  assert.equal(result.success, true);
});

test("announcement translation accepts the full announcement content limit", () => {
  const result = translationInputSchema.safeParse({
    content: "a".repeat(20_000),
    targetLanguage: "EN",
  });
  assert.equal(result.success, true);
});

test("announcement translation normalizes common Gemini response field and language variants", () => {
  const result = translationResultSchema.safeParse({
    translatedText: "We will paint the walls.",
    detectedLanguage: "French",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data, {
      translatedContent: "We will paint the walls.",
      detectedLanguage: "FR",
    });
  }
});
