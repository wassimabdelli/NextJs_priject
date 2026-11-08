import { generateValidated } from "./provider";
import { priorityResultSchema } from "./schemas";
import { structuredPrompt } from "./prompts";
import type { Priority } from "@/types/enums";

const dangerPattern = /\b(smoke|fire|flame|burning|gas leak|explosion|sparks|exposed wire|electric shock|collapse|trapped|fumée|incendie|feu|gaz|explosion|étincelle|fil électrique nu|électrocut|effondrement|coincé|حريق|دخان|غاز|انفجار|أسلاك مكشوفة|خطر)\b/i;

export async function recommendPriority(userId: string, description: string) {
  const result = await generateValidated(
    userId,
    "incident-priority",
    priorityResultSchema,
    structuredPrompt("Recommend LOW, MEDIUM, HIGH or URGENT incident priority. Never downgrade a decision already made by a human. Explain uncertainty. If immediate danger is described, warn to contact local emergency services; do not claim certainty.", { description })
  );
  if (!dangerPattern.test(description)) return result;
  return {
    ...result,
    suggestedPriority: "URGENT" as Priority,
    safetyWarning: "Possible immediate danger described. This suggestion is not an emergency assessment; contact local emergency services if anyone may be at risk.",
  };
}
