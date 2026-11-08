import mongoose from "mongoose";
import { Incident } from "../../models/Incident";
import { IncidentStatus } from "../../types/enums";
import { similarityScore } from "./duplicate-detector";
import { embedText } from "./gemini";
import { redactPII } from "./redact";

const LEXICAL_THRESHOLD = 0.25;

type SimilarityIncident = {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  status: IncidentStatus;
  reportedAt: Date;
  embedding?: number[];
};

export function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

export function incidentText(i: { title: string; description: string }) {
  return redactPII(`${i.title}. ${i.description}`).slice(0, 2000);
}

export async function computeAndStoreEmbedding(
  incidentId: string,
  i: { title: string; description: string }
) {
  try {
    const vector = await embedText(incidentText(i));
    await Incident.updateOne({ _id: incidentId }, { $set: { embedding: vector } });
  } catch (error) {
    console.warn("[ai] embedding failed for", incidentId, error);
  }
}

export async function findSimilarIncidents(args: {
  residenceId: string;
  title: string;
  description: string;
  excludeId?: string;
  excludeIds?: string[];
  scopeFilter?: Record<string, unknown>;
  threshold?: number;
  limit?: number;
}) {
  const {
    residenceId,
    title,
    description,
    excludeId,
    excludeIds = [],
    scopeFilter = {},
    threshold = 0.78,
    limit = 8,
  } = args;
  const queryVector = await embedText(incidentText({ title, description }));
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const excludedObjectIds = excludeIds.map((id) => new mongoose.Types.ObjectId(id));
  const sourceId = excludeId ? new mongoose.Types.ObjectId(excludeId) : undefined;
  const excluded = [...excludedObjectIds, ...(sourceId ? [sourceId] : [])];
  const match: Record<string, unknown> = {
    residence: new mongoose.Types.ObjectId(residenceId),
    status: { $ne: IncidentStatus.RESOLVED },
    reportedAt: { $gte: since },
    ...scopeFilter,
    ...(excluded.length ? { _id: { $nin: excluded } } : {}),
  };
  const candidates = await Incident.find(match)
    .select("+embedding title description status reportedAt")
    .sort({ reportedAt: -1 })
    .limit(200)
    .lean<SimilarityIncident[]>();

  if (!candidates.length) return [];
  const queryText = `${title} ${description}`;
  const scored = candidates.map((candidate) => {
    const hasVector = candidate.embedding?.length === queryVector.length;
    const base = {
      id: String(candidate._id),
      title: candidate.title,
      description: candidate.description,
      status: candidate.status,
      createdAt: candidate.reportedAt,
    };
    return hasVector
      ? { ...base, score: cosine(queryVector, candidate.embedding!), method: "embedding" as const }
      : {
          ...base,
          score: similarityScore(queryText, `${candidate.title} ${candidate.description}`),
          method: "lexical" as const,
        };
  });

  return scored
    .filter((item) => (item.method === "embedding" ? item.score >= threshold : item.score >= LEXICAL_THRESHOLD))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
