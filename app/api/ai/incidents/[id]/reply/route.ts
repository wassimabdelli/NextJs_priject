import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, isValidObjectId, json } from "@/lib/api";
import { generateValidated } from "@/lib/ai/provider";
import { structuredPrompt } from "@/lib/ai/prompts";
import { redactPII } from "@/lib/ai/redact";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { requireIncidentAccess } from "@/lib/incidents/access";
import { IncidentComment } from "@/models/IncidentComment";
import { Role } from "@/types/enums";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

const replySchema = z.object({
  reply: z.string().trim().min(1).max(1500),
});

async function draftReply(
  _req: NextRequest,
  user: AuthUser,
  context?: unknown
) {
  const params = await Promise.resolve((context as RouteContext | undefined)?.params);
  const id = params?.id;
  if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant d'incident invalide");

  const incident = await requireIncidentAccess(user, id);
  const comments = await IncidentComment.find({ incident: id })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate<{ author: { role: Role } | null }>({ path: "author", select: "role" })
    .lean();

  const now = Date.now();
  const ageDays = Math.max(0, Math.floor((now - new Date(incident.reportedAt).getTime()) / 86_400_000));
  const mostRecentComment = comments[0];
  const waitingDays =
    mostRecentComment?.author?.(role === Role.OWNER || role === Role.TENANT)
      ? Math.max(0, Math.floor((now - new Date(mostRecentComment.createdAt).getTime()) / 86_400_000))
      : null;
  const facts = {
    ageDays,
    assigned: Boolean(incident.assignedTo),
    waitingDays,
  };

  let result: z.infer<typeof replySchema>;
  try {
    result = await generateValidated(
      user.id,
      "incident-reply",
      replySchema,
      structuredPrompt(
        "Draft a courteous reply in French from the property manager to the resident. Use only the supplied facts. Do not promise dates, prices or interventions that are not in the facts. Do not mention personal data.",
        {
          title: redactPII(incident.title),
          description: redactPII(incident.description).slice(0, 800),
          status: incident.status,
          category: incident.category,
          ageDays: facts.ageDays,
          assigned: facts.assigned,
          recentMessages: comments.map((comment) => ({
            from: comment.author?.role ?? "UNKNOWN",
            text: redactPII(comment.content).slice(0, 300),
          })),
        }
      )
    );
  } catch {
    throw new HttpError(502, "La rédaction de la réponse IA est indisponible pour le moment.");
  }

  return json({ reply: result.reply, facts });
}

export const POST = withAuth(draftReply, {
  roles: [Role.ADMIN, Role.SYNDIC],
});
