import { generateValidated } from "./provider";
import { announcementGenerateResultSchema, type announcementGenerateInputSchema } from "./schemas";
import { structuredPrompt } from "./prompts";
import type { z } from "zod";
import { redactPII } from "./redact";

type Input = z.infer<typeof announcementGenerateInputSchema>;

export async function generateAnnouncement(userId: string, input: Input) {
  const safeInput = {
    ...input,
    topic: redactPII(input.topic),
    existingTitle: input.existingTitle ? redactPII(input.existingTitle) : undefined,
    existingContent: input.existingContent ? redactPII(input.existingContent) : undefined,
    facts: input.facts?.map(redactPII),
  };
  const verifiedFacts = safeInput.facts?.length
    ? ` Verified facts you may use if relevant (use none that are not listed, do not add other facts): ${safeInput.facts.join(" | ")}`
    : "";
  return generateValidated(
    userId,
    "announcement-generator",
    announcementGenerateResultSchema,
    structuredPrompt(`Create or improve an announcement in ${input.language}. Tone: ${input.tone}. Audience: ${input.audience}. Requested operation: ${input.mode}. For TITLE, revise only the title and copy existingContent verbatim into content. For SHORTER, reduce length while retaining every important instruction. Preserve factual details and do not invent dates, times, locations, or commitments. Suggest category and priority. This is a draft suggestion and must not be published.${verifiedFacts}`, safeInput)
  );
}
