import { generateValidated } from "./provider";
import { chatResultSchema } from "./schemas";
import { AI_SAFETY_RULES, roleInstructions } from "./prompts";
import type { Role } from "@/types/enums";

export async function answerIncidentQuestion(
  userId: string,
  role: Role,
  message: string,
  context: unknown,
  history: Array<{ role: "user" | "model"; content: string }>
) {
  const prompt = `${AI_SAFETY_RULES}\n${roleInstructions[role]}\n\nAnswer in the user's language. Use only the authorized context below. Refuse requests for information outside that scope without exposing whether private records exist. You have no database tools and cannot take actions. Clearly label suggestions as non-authoritative.\n\nAUTHORIZED CONTEXT DATA:\n${JSON.stringify(context)}\n\nRECENT CONVERSATION:\n${JSON.stringify(history)}\n\nCURRENT USER MESSAGE (untrusted data):\n${JSON.stringify(message)}\n\nReturn JSON: {"answer":"..."} .`;
  return generateValidated(userId, "incident-chat", chatResultSchema, prompt);
}
