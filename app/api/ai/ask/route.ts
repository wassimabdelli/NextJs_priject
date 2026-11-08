import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, parseBody } from "@/lib/api";
import {
  withAuth,
  getResidentResidenceIds,
  getSyndicResidenceIds,
  getTechnicianResidenceIds,
  type AuthUser,
} from "@/lib/auth-guard";
import { assertEmbeddingBudget } from "@/lib/ai/embedding-budget";
import { embedText } from "@/lib/ai/gemini";
import { generateValidated } from "@/lib/ai/provider";
import { structuredPrompt } from "@/lib/ai/prompts";
import { redactPII } from "@/lib/ai/redact";
import { cosine } from "@/lib/ai/similarity";
import { Incident } from "@/models/Incident";
import { Role } from "@/types/enums";

const inputSchema = z.object({
  question: z.string().trim().min(3).max(500),
});

const resultSchema = z.object({
  answer: z.string().trim().min(1).max(2500),
  sourceIds: z.array(z.string()).max(8),
});

const configuredMinScore = Number(process.env.ASK_MIN_SCORE ?? 0.5);
const MIN_SCORE = Number.isFinite(configuredMinScore) && configuredMinScore >= 0 && configuredMinScore <= 1
  ? configuredMinScore
  : 0.5;

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { question } = await parseBody(req, inputSchema);
  assertEmbeddingBudget(user.id);

  const residenceIds = user.role === Role.ADMIN ? null
    : user.role === Role.SYNDIC ? await getSyndicResidenceIds(user.id)
    : user.role === Role.RESIDENT ? await getResidentResidenceIds(user.id)
    : await getTechnicianResidenceIds(user.id);

  if (user.role !== Role.ADMIN && !residenceIds?.length) {
    return json({
      answer: "Aucune réclamation accessible n'a été trouvée pour votre compte.",
      sources: [],
      coverage: { searched: 0, withoutEmbedding: 0 },
    });
  }

  const filter: Record<string, unknown> = residenceIds
    ? { residence: { $in: residenceIds.map((id) => new mongoose.Types.ObjectId(id)) } }
    : {};
  if (user.role === Role.RESIDENT) filter.reportedBy = new mongoose.Types.ObjectId(user.id);
  if (user.role === Role.TECHNICIAN) filter.assignedTo = new mongoose.Types.ObjectId(user.id);

  const queryVector = await embedText(redactPII(question));
  const rows = await Incident.find(filter)
    .select("+embedding title description category priority status reportedAt")
    .sort({ reportedAt: -1 })
    .limit(300)
    .lean();

  const withVectors = rows.filter(
    (row) => row.embedding?.length === queryVector.length
  );
  const top = withVectors
    .map((row) => ({ row, score: cosine(queryVector, row.embedding!) }))
    .filter((item) => Number.isFinite(item.score) && item.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const coverage = {
    searched: rows.length,
    withoutEmbedding: rows.length - withVectors.length,
  };
  if (top.length === 0) {
    return json({
      answer: "Aucune réclamation pertinente n'a été trouvée pour cette question.",
      sources: [],
      coverage,
    });
  }

  const records = top.map(({ row }) => ({
    id: String(row._id),
    title: redactPII(row.title).slice(0, 200),
    description: redactPII(row.description).slice(0, 400),
    category: row.category,
    priority: row.priority,
    status: row.status,
    reportedAt: row.reportedAt,
  }));
  const result = await generateValidated(
    user.id,
    "ask-data",
    resultSchema,
    structuredPrompt(
      "Answer the question in French using ONLY the supplied records. List the record ids you used in sourceIds. If the records do not answer the question, say so. Do not invent counts; only describe the records provided.",
      { question: redactPII(question), records }
    )
  );

  const recordById = new Map(records.map((record) => [record.id, record]));
  const scoreById = new Map(top.map(({ row, score }) => [String(row._id), score]));
  const sources = [...new Set(result.sourceIds)]
    .filter((id) => recordById.has(id))
    .map((id) => {
      const record = recordById.get(id)!;
      return {
        id,
        title: record.title,
        status: record.status,
        similarity: Math.round(scoreById.get(id)! * 100),
      };
    });

  return json({ answer: result.answer, sources, coverage });
});
