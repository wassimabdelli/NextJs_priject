import { HttpError } from "@/lib/api";
import { generateValidated } from "./provider";
import { reportResultSchema } from "./schemas";
import { structuredPrompt } from "./prompts";

export async function explainManagementReport(userId: string, kind: "incidents" | "announcements", statistics: unknown) {
  const result = await generateValidated(
    userId,
    `management-report-${kind}`,
    reportResultSchema,
    structuredPrompt(`Explain these already-calculated ${kind} statistics in plain language. Do not recalculate, add, infer, or invent numeric values. Avoid numeric figures in your prose; the verified figures are shown separately in the dashboard. Do not assert increases, decreases, causes, or comparisons unless directly supported by the supplied values. Recommendations must be practical and clearly phrased as suggestions. If data is empty, state that.`, statistics)
  );
  const suppliedNumbers = new Set(JSON.stringify(statistics).match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? []);
  const generatedText = [result.summary, ...result.observations, ...result.recommendations].join(" ");
  const unverifiedNumber = (generatedText.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? [])
    .find((number) => !suppliedNumbers.has(number));
  if (unverifiedNumber) {
    throw new HttpError(502, "La réponse IA contenait un chiffre non vérifié; le rapport n'a pas été affiché.");
  }
  return result;
}
