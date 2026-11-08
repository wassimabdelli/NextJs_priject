import {
  areIncidentsTextSimilar,
  toIntelligenceIncident,
  type IntelligenceIncident,
  type PopulatedIntelligenceIncident,
} from "./analysis";

const COMPARISON_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function compareAnnouncementEffectiveness(input: {
  announcementId: string;
  title: string;
  publishedAt: Date;
  seeds: PopulatedIntelligenceIncident[];
  candidates: PopulatedIntelligenceIncident[];
  now?: Date;
}) {
  const publishedAt = new Date(input.publishedAt);
  const afterWindowEndsAt = new Date(publishedAt.getTime() + COMPARISON_WINDOW_MS);
  const now = input.now ?? new Date();
  const base = {
    announcementId: input.announcementId,
    title: input.title,
    publishedAt: publishedAt.toISOString(),
    comparisonWindowDays: 30,
    beforePeriod: {
      from: new Date(publishedAt.getTime() - COMPARISON_WINDOW_MS).toISOString(),
      to: publishedAt.toISOString(),
    },
    afterPeriod: {
      from: publishedAt.toISOString(),
      to: afterWindowEndsAt.toISOString(),
    },
    interpretation: "Comparaison descriptive uniquement; elle ne démontre pas que l'annonce a causé une évolution.",
  };
  if (now < afterWindowEndsAt) {
    return {
      ...base,
      status: "insufficient_data" as const,
      reason: "La période complète de 30 jours après publication n'est pas encore écoulée.",
    };
  }

  const seeds = input.seeds.map((item) => toIntelligenceIncident(item));
  if (!seeds.length) {
    return {
      ...base,
      status: "insufficient_data" as const,
      reason: "Les réclamations sources de cette suggestion ne sont plus disponibles.",
    };
  }
  const seedIds = new Set(seeds.map((item) => item.id));
  const matches: IntelligenceIncident[] = [];
  for (const rawCandidate of input.candidates) {
    const candidate = toIntelligenceIncident(rawCandidate);
    if (seedIds.has(candidate.id)) continue;
    if (seeds.some((seed) => areIncidentsTextSimilar(seed, candidate))) matches.push(candidate);
  }

  const publishedMs = publishedAt.getTime();
  const beforeCount = matches.filter((item) => item.reportedAt.getTime() < publishedMs).length;
  const afterCount = matches.filter((item) => item.reportedAt.getTime() >= publishedMs).length;
  if (beforeCount + afterCount < 2) {
    return {
      ...base,
      status: "insufficient_data" as const,
      reason: "Moins de deux réclamations textuellement similaires sont disponibles dans les deux périodes.",
      beforeCount,
      afterCount,
    };
  }
  return {
    ...base,
    status: "available" as const,
    beforeCount,
    afterCount,
    change: afterCount - beforeCount,
  };
}
