import "server-only";
import { z } from "zod";
import { generateJson, type ImagePart } from "./gemini";
import { redactPII } from "./redact";

export const VerifySchema = z.object({
  verdict: z.enum(["FIXED", "PARTIALLY_FIXED", "NOT_FIXED", "UNCLEAR"]),
  explanation: z.string().max(500),
  confidence: z.number().min(0).max(1),
});
export type VerifyResult = z.infer<typeof VerifySchema>;

export async function verifyResolution(input: {
  problemDescription: string;
  technicianNote?: string;
  before: ImagePart[];
  after: ImagePart[];
}): Promise<VerifyResult> {
  const prompt = `Tu aides un syndic de copropriété à vérifier une intervention.
Problème signalé: ${redactPII(input.problemDescription).slice(0, 1500)}
Note du technicien: ${redactPII(input.technicianNote ?? "aucune").slice(0, 800)}

Les ${input.before.length} premières images montrent le problème AVANT intervention.
Les ${input.after.length} images suivantes montrent la situation APRÈS intervention.

Réponds UNIQUEMENT en JSON:
{
  "verdict": "FIXED" | "PARTIALLY_FIXED" | "NOT_FIXED" | "UNCLEAR",
  "explanation": "ce que tu observes de différent entre avant et après, en français, 2 phrases maximum",
  "confidence": nombre entre 0 et 1
}
Si les photos ne montrent pas le même endroit ou sont trop floues, réponds "UNCLEAR". Ne conclus pas au-delà de ce qui est visible.`;

  const raw = await generateJson(prompt, [...input.before, ...input.after], {
    allowTextFallback: false,
  });
  const parsed = VerifySchema.safeParse(raw);
  if (!parsed.success) throw new Error("AI_INVALID_RESPONSE");
  return parsed.data;
}
