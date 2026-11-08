import { generateValidated } from "./provider";
import { incidentClassificationSchema, type IncidentClassification } from "./schemas";
import { structuredPrompt } from "./prompts";
import type { IncidentCategory, Priority } from "@/types/enums";

const dangerPattern = /\b(smoke|fire|flame|burning|gas leak|explosion|sparks|exposed wire|electric shock|flooding|collapse|trapped|danger|fumée|incendie|feu|gaz|explosion|étincelle|fil électrique nu|électrocut|inondation|effondrement|coincé|danger|حريق|دخان|غاز|انفجار|أسلاك مكشوفة|خطر)\b/i;

export async function classifyIncident(userId: string, title: string, description: string): Promise<IncidentClassification> {
  const result = await generateValidated(
    userId,
    "incident-classify",
    incidentClassificationSchema,
    structuredPrompt("Classify the reported maintenance incident. Use the existing categories PLUMBING, ELECTRICITY, ELEVATOR, CLEANING, SECURITY, OTHER and priorities LOW, MEDIUM, HIGH, URGENT. Provide concise summary and safe suggested action. Confidence is an estimate, not certainty.", { title, description })
  );
  if (dangerPattern.test(`${title}\n${description}`) && result.priority !== "URGENT") {
    return { ...result, priority: "URGENT" as Priority, confidence: Math.min(result.confidence, 0.7) };
  }
  return { ...result, category: result.category as IncidentCategory };
}
