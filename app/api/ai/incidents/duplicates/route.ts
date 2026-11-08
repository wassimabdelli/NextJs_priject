import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import { HttpError, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser, getResidentResidenceIds, getSyndicResidenceIds, getTechnicianResidenceIds } from "@/lib/auth-guard";
import { explainDuplicates, similarityScore } from "@/lib/ai/duplicate-detector";
import { findSimilarIncidents } from "@/lib/ai/similarity";
import { assertEmbeddingBudget } from "@/lib/ai/embedding-budget";
import { duplicatesInputSchema } from "@/lib/ai/schemas";
import { Incident } from "@/models/Incident";
import { Role } from "@/types/enums";
import {
  buildDuplicateCandidateFilter,
  canSearchDuplicateResidence,
} from "@/lib/ai/duplicate-candidate-policy";

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const input = await parseBody(req, duplicatesInputSchema);
  assertEmbeddingBudget(user.id);
  const residenceIds = user.role === Role.ADMIN ? null
    : user.role === Role.SYNDIC ? await getSyndicResidenceIds(user.id)
    : user.role === Role.RESIDENT ? await getResidentResidenceIds(user.id)
    : user.role === Role.TECHNICIAN ? await getTechnicianResidenceIds(user.id)
    : null;
  if (!canSearchDuplicateResidence(user.role, input.residenceId, residenceIds)) {
    throw new HttpError(403, "Résidence non autorisée");
  }

  let title = input.title;
  let description = input.description;
  let excludeIds: mongoose.Types.ObjectId[] = [];
  if (input.incidentId) {
    const source = await Incident.findById(input.incidentId)
      .select("title description residence reportedBy assignedTo relatedIncidents dismissedDuplicates")
      .lean();
    if (!source || String(source.residence) !== input.residenceId) throw new HttpError(404, "Incident introuvable");
    const canAccessSource = user.role === Role.ADMIN
      || (user.role === Role.SYNDIC && Boolean(residenceIds?.includes(input.residenceId)))
      || (user.role === Role.RESIDENT && String(source.reportedBy) === user.id)
      || (user.role === Role.TECHNICIAN && String(source.assignedTo) === user.id);
    if (!canAccessSource) throw new HttpError(404, "Incident introuvable");
    title = source.title;
    description = source.description;
    excludeIds = [...(source.relatedIncidents ?? []), ...(source.dismissedDuplicates ?? [])];
  }
  const filter = buildDuplicateCandidateFilter({
    residenceId: input.residenceId,
    ...(input.incidentId ? { incidentId: input.incidentId } : {}),
    excludeIds,
  });
  // Candidates are residence-wide; access to the requested residence is checked above.
  const scopeFilter: Record<string, unknown> = {};

  let shortlisted: Array<{
    incident: {
      _id: mongoose.Types.ObjectId;
      title: string;
      description: string;
      status: string;
      reportedAt: Date;
    };
    similarity: number;
    score: number;
    method: "embedding" | "lexical";
  }>;
  try {
    const matches = await findSimilarIncidents({
      residenceId: input.residenceId,
      title,
      description,
      ...(input.incidentId ? { excludeId: input.incidentId } : {}),
      excludeIds: excludeIds.map(String),
      scopeFilter,
      limit: 8,
    });
    shortlisted = matches.map((match) => ({
      incident: {
        _id: new mongoose.Types.ObjectId(match.id),
        title: match.title,
        description: match.description,
        status: match.status,
        reportedAt: match.createdAt,
      },
      similarity: match.score,
      score: match.score,
      method: match.method,
    }));
  } catch {
    console.warn("[ai] embedding duplicate search failed; using lexical fallback");
    const recent = await Incident.find(filter)
      .sort({ reportedAt: -1 })
      .limit(80)
      .select("title description status reportedAt")
      .lean();
    shortlisted = recent
      .map((incident) => {
        const score = similarityScore(`${title} ${description}`, `${incident.title} ${incident.description}`);
        return { incident, similarity: score, score, method: "lexical" as const };
      })
      .filter(({ score }) => score >= 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }
  if (!shortlisted.length) return json({ possibleDuplicates: [] });

  let results = new Map<string, { similar: boolean; explanation: string }>();
  try {
    const explanations = await explainDuplicates(user.id, { title, description }, shortlisted.map(({ incident }) => ({
      incidentId: String(incident._id),
      title: incident.title,
      description: incident.description.slice(0, 900),
      status: incident.status,
    })));
    results = new Map(explanations.matches.map((match) => [match.incidentId, match]));
  } catch {
    console.warn("[ai] duplicate explanations unavailable");
  }
  return json({
    possibleDuplicates: shortlisted.flatMap(({ incident, similarity, score, method }) => {
      const match = results.get(String(incident._id));
      if (match && !match.similar) return [];
      return [{
        incidentId: String(incident._id),
        title: incident.title,
        summary: incident.description.slice(0, 180),
        status: incident.status,
        reportedAt: incident.reportedAt,
        similarity: Math.round(similarity * 100),
        score,
        method,
        explanation: match?.explanation || "Les descriptions présentent des éléments similaires.",
      }];
    }),
  });
});
