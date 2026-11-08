import { generateValidated } from "./provider";
import { translationResultSchema, type translationInputSchema } from "./schemas";
import { structuredPrompt } from "./prompts";
import type { z } from "zod";

type Input = z.infer<typeof translationInputSchema>;

export async function translateAnnouncement(userId: string, input: Input) {
  return generateValidated(
    userId,
    "announcement-translation",
    translationResultSchema,
    structuredPrompt(`Translate the supplied announcement into ${input.targetLanguage}. Preserve meaning, dates, times, numbers, addresses, formatting, and instructions exactly; do not add information. If source language is provided, it is ${input.sourceLanguage}. Detect the source language. Return exactly one JSON object with these exact keys: "translatedContent" (the complete translation as a string) and "detectedLanguage" (exactly one of "FR", "AR", "EN", or "OTHER"). Do not add Markdown or other fields.`, input),
    { maxOutputTokens: 8192 }
  );
}
