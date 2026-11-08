import { createHash } from "node:crypto";
import type { IncidentCategory, IncidentStatus, Priority } from "@/types/enums";
import { DEFAULT_INCIDENT_OVERDUE_HOURS } from "@/lib/incidents/constants";

export interface IntelligenceIncident {
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  priority: Priority;
  status: IncidentStatus;
  reportedAt: Date;
  residenceId: string;
  residenceName?: string;
  apartmentId?: string;
  apartmentNumber?: string | number;
  apartmentFloor?: string | number;
  embedding?: number[];
  relatedIncidentIds?: string[];
}

export interface PopulatedIntelligenceIncident {
  _id: string | { toString(): string };
  title: string;
  description: string;
  category: IncidentCategory;
  priority: Priority;
  status: IncidentStatus;
  reportedAt: Date;
  residence: string | {
    toString(): string;
    _id?: string | { toString(): string };
    name?: string;
  };
  apartment?: string | {
    _id: string | { toString(): string };
    number?: string | number;
    floor?: string | number;
  };
  embedding?: number[];
  relatedIncidents?: Array<string | { toString(): string }>;
}

export function toIntelligenceIncident(incident: PopulatedIntelligenceIncident): IntelligenceIncident {
  const residence = typeof incident.residence === "object" ? incident.residence : undefined;
  const apartment = incident.apartment && typeof incident.apartment === "object"
    ? incident.apartment
    : undefined;
  return {
    id: String(incident._id),
    title: incident.title,
    description: incident.description,
    category: incident.category,
    priority: incident.priority,
    status: incident.status,
    reportedAt: new Date(incident.reportedAt),
    residenceId: String(residence?._id ?? incident.residence),
    residenceName: residence?.name,
    apartmentId: apartment ? String(apartment._id) : undefined,
    apartmentNumber: apartment?.number,
    apartmentFloor: apartment?.floor,
    embedding: incident.embedding,
    relatedIncidentIds: incident.relatedIncidents?.map(String),
  };
}

export interface CategoryTrend {
  id: string;
  category: IncidentCategory;
  detectionMethod: "category_count";
  evidenceLevel: "category_only";
  count: number;
  incidentIds: string[];
  statuses: Partial<Record<IncidentStatus, number>>;
  priorities: Partial<Record<Priority, number>>;
  firstReportedAt: string;
  latestReportedAt: string;
}

export interface RecurringProblem {
  id: string;
  residenceId: string;
  patternKey: string;
  category: IncidentCategory;
  count: number;
  incidentIds: string[];
  location: string | null;
  firstReportedAt: string;
  latestReportedAt: string;
  detectionMethod: "meaningful_text_overlap" | "semantic_embedding" | "category_count";
  evidenceLevel: "low" | "moderate" | "category_only";
  sharedTerms: string[];
  statuses: Partial<Record<IncidentStatus, number>>;
  priorities: Partial<Record<Priority, number>>;
}

export interface AttentionRecommendation {
  id: string;
  type: "urgent_unresolved" | "high_unresolved" | "aged_unresolved" | "recurring_unresolved" | "linked_unresolved";
  title: string;
  explanation: string;
  suggestedAction: string;
  priority: Priority;
  incidentIds: string[];
  createdAt: string;
  reviewStatus: "NEEDS_REVIEW";
}

const STOP_WORDS = new Set([
  "avec", "dans", "depuis", "elle", "elles", "est", "etre", "faire", "fait",
  "il", "ils", "mais", "mon", "notre", "nous", "par", "pas", "pour", "que",
  "qui", "son", "sont", "sur", "une", "des", "les", "aux", "est", "avoir",
  "probleme", "incident", "reclamation", "signale", "besoin", "merci",
  "please", "kindly", "help", "need", "the", "and", "for", "with", "from", "this", "that", "there", "have",
  "issue", "problem", "reported", "near", "very", "just",
]);

function tokens(incident: Pick<IntelligenceIncident, "title" | "description">) {
  const text = `${incident.title} ${incident.description}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return new Set(
    text.match(/[a-z0-9]{3,}/g)?.filter((token) => !STOP_WORDS.has(token)) ?? []
  );
}

function getLocation(incidents: IntelligenceIncident[]) {
  const apartmentIds = new Set(incidents.map((incident) => incident.apartmentId).filter(Boolean));
  if (apartmentIds.size !== 1 || !incidents[0].apartmentId) return null;
  const first = incidents.find((incident) => incident.apartmentId);
  if (!first) return null;
  const apartment = first.apartmentNumber ? `Lot ${first.apartmentNumber}` : "Même lot";
  const floor = first.apartmentFloor !== undefined ? `, étage ${first.apartmentFloor}` : "";
  return `${first.residenceName ? `${first.residenceName}, ` : ""}${apartment}${floor}`;
}

function compareDates(a: IntelligenceIncident, b: IntelligenceIncident) {
  return a.reportedAt.getTime() - b.reportedAt.getTime() || a.id.localeCompare(b.id);
}

function summarize<T extends IntelligenceIncident>(incidents: T[]) {
  const ordered = [...incidents].sort(compareDates);
  const statuses: Partial<Record<IncidentStatus, number>> = {};
  const priorities: Partial<Record<Priority, number>> = {};
  for (const incident of ordered) {
    statuses[incident.status] = (statuses[incident.status] ?? 0) + 1;
    priorities[incident.priority] = (priorities[incident.priority] ?? 0) + 1;
  }
  return {
    count: ordered.length,
    incidentIds: ordered.map((incident) => incident.id),
    statuses,
    priorities,
    firstReportedAt: ordered[0].reportedAt.toISOString(),
    latestReportedAt: ordered[ordered.length - 1].reportedAt.toISOString(),
  };
}

function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

function similarity(a: IntelligenceIncident, b: IntelligenceIncident) {
  const aTokens = tokens(a);
  const bTokens = tokens(b);
  const sharedTerms = [...aTokens].filter((term) => bTokens.has(term)).sort();
  const unionSize = new Set([...aTokens, ...bTokens]).size;
  const jaccard = unionSize ? sharedTerms.length / unionSize : 0;
  const textSimilar = sharedTerms.length >= 2 && jaccard >= 0.3;
  const embeddingA = a.embedding;
  const embeddingB = b.embedding;
  const semanticSimilar = !textSimilar
    && Boolean(embeddingA?.length && embeddingB?.length)
    && cosineSimilarity(embeddingA ?? [], embeddingB ?? []) >= 0.78;
  return { sharedTerms, jaccard, similar: textSimilar || semanticSimilar, method: semanticSimilar ? "semantic_embedding" as const : "meaningful_text_overlap" as const };
}

export function areIncidentsTextSimilar(a: IntelligenceIncident, b: IntelligenceIncident) {
  if (a.category !== b.category || a.residenceId !== b.residenceId) return false;
  return similarity(a, b).similar;
}

function stableId(prefix: string, value: string) {
  return `${prefix}-${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

export function detectCategoryTrends(incidents: IntelligenceIncident[]): CategoryTrend[] {
  const groups = new Map<IncidentCategory, IntelligenceIncident[]>();
  for (const incident of incidents) {
    const group = groups.get(incident.category) ?? [];
    group.push(incident);
    groups.set(incident.category, group);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.length >= 2)
    .map(([category, group]) => ({
      id: stableId("category", category),
      category,
      detectionMethod: "category_count" as const,
      evidenceLevel: "category_only" as const,
      ...summarize(group),
    }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

export function detectRecurringProblems(incidents: IntelligenceIncident[]): RecurringProblem[] {
  const byCategory = new Map<string, IntelligenceIncident[]>();
  for (const incident of incidents) {
    const key = `${incident.residenceId}:${incident.category}`;
    const group = byCategory.get(key) ?? [];
    group.push(incident);
    byCategory.set(key, group);
  }

  const patterns: RecurringProblem[] = [];
  for (const categoryIncidents of byCategory.values()) {
    const category = categoryIncidents[0].category;
    const ordered = [...categoryIncidents].sort(compareDates);
    const assigned = new Set<string>();

    for (const seed of ordered) {
      if (assigned.has(seed.id) || (!tokens(seed).size && !seed.embedding?.length)) continue;
      const cluster = [seed];
      const sharedAcrossCluster = new Set(tokens(seed));
      let semanticMatch = false;

      for (const candidate of ordered) {
        if (candidate.id === seed.id || assigned.has(candidate.id)) continue;
        const comparisons = cluster.map((member) => similarity(member, candidate));
        if (comparisons.every((comparison) => comparison.similar)) {
          cluster.push(candidate);
          if (comparisons.some((comparison) => comparison.method === "semantic_embedding")) semanticMatch = true;
          for (const term of [...sharedAcrossCluster]) {
            if (!tokens(candidate).has(term)) sharedAcrossCluster.delete(term);
          }
        }
      }

      if (cluster.length < 2) continue;
      for (const member of cluster) assigned.add(member.id);
      const summary = summarize(cluster);
      const sameApartment = new Set(cluster.map((incident) => incident.apartmentId).filter(Boolean)).size === 1
        && Boolean(cluster[0].apartmentId);
      const strongTextEvidence = sharedAcrossCluster.size >= 3;
      const evidenceLevel = strongTextEvidence || sameApartment ? "moderate" : "low";
      const canonicalTerms = [...sharedAcrossCluster].sort();
      patterns.push({
        id: stableId("similarity", `${category}:${summary.incidentIds.join(",")}`),
        residenceId: cluster[0].residenceId,
        patternKey: stableId("pattern", semanticMatch && canonicalTerms.length === 0
          ? `${category}:${cluster[0].apartmentId ?? "residence"}:semantic:${cluster[0].id}`
          : `${category}:${cluster[0].apartmentId ?? "residence"}:${canonicalTerms.slice(0, 3).join(",")}`),
        category,
        ...summary,
        location: getLocation(cluster),
        detectionMethod: semanticMatch ? "semantic_embedding" : "meaningful_text_overlap",
        evidenceLevel,
        sharedTerms: canonicalTerms,
      });
    }

    const hasFullGroupPattern = patterns.some(
      (pattern) => pattern.residenceId === categoryIncidents[0].residenceId
        && pattern.category === category
        && pattern.incidentIds.length === categoryIncidents.length
    );
    if (categoryIncidents.length >= 3 && !hasFullGroupPattern) {
      const summary = summarize(categoryIncidents);
      patterns.push({
        id: stableId("category", `${categoryIncidents[0].residenceId}:${category}:${summary.incidentIds.join(",")}`),
        residenceId: categoryIncidents[0].residenceId,
        patternKey: stableId("category-pattern", `${categoryIncidents[0].residenceId}:${category}`),
        category,
        ...summary,
        location: getLocation(categoryIncidents),
        detectionMethod: "category_count",
        evidenceLevel: "category_only",
        sharedTerms: [],
      });
    }
  }
  return patterns.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

export function buildAttentionRecommendations(
  incidents: IntelligenceIncident[],
  recurringProblems: RecurringProblem[],
  now = new Date()
): AttentionRecommendation[] {
  const recommendations: AttentionRecommendation[] = [];
  const overdueBefore = now.getTime() - DEFAULT_INCIDENT_OVERDUE_HOURS * 60 * 60 * 1000;

  for (const incident of incidents) {
    if (incident.status === "RESOLVED") continue;
    const ageHours = (now.getTime() - incident.reportedAt.getTime()) / 3_600_000;
    const base = {
      incidentIds: [incident.id],
      createdAt: now.toISOString(),
      reviewStatus: "NEEDS_REVIEW" as const,
    };
    if (incident.priority === "URGENT") {
      recommendations.push({
        ...base,
        id: stableId("urgent", incident.id),
        type: "urgent_unresolved",
        title: "Réclamation urgente non résolue",
        explanation: `La réclamation est toujours au statut ${incident.status} et sa priorité existante est URGENT.`,
        suggestedAction: "Examiner la situation et décider si une intervention ou une communication est nécessaire.",
        priority: "URGENT",
      });
    } else if (incident.priority === "HIGH") {
      recommendations.push({
        ...base,
        id: stableId("high", incident.id),
        type: "high_unresolved",
        title: "Réclamation de priorité élevée non résolue",
        explanation: `La réclamation est toujours au statut ${incident.status} et sa priorité existante est HIGH.`,
        suggestedAction: "Vérifier l'avancement et décider de la suite à donner.",
        priority: "HIGH",
      });
    }
    if (incident.reportedAt.getTime() < overdueBefore) {
      recommendations.push({
        ...base,
        id: stableId("aged", incident.id),
        type: "aged_unresolved",
        title: "Réclamation ancienne encore ouverte",
        explanation: `La réclamation est non résolue depuis ${Math.floor(ageHours)} heures, au-delà de l'indicateur d'ancienneté existant de ${DEFAULT_INCIDENT_OVERDUE_HOURS} heures. Ce seuil est un indicateur, pas un SLA.`,
        suggestedAction: "Vérifier son statut et déterminer si un suivi est nécessaire.",
        priority: incident.priority,
      });
    }
  }

  for (const pattern of recurringProblems) {
    const unresolvedIds = pattern.incidentIds.filter((id) => {
      const incident = incidents.find((item) => item.id === id);
      return incident && incident.status !== "RESOLVED";
    });
    if (unresolvedIds.length < 2) continue;
    recommendations.push({
      id: stableId("recurring", pattern.id),
      type: "recurring_unresolved",
      title: "Plusieurs réclamations similaires restent ouvertes",
      explanation: `${unresolvedIds.length} réclamations du groupe de similarité sont non résolues. Le rapprochement repose sur un chevauchement textuel et ne confirme pas une cause commune.`,
      suggestedAction: "Examiner les dossiers et vérifier s'ils nécessitent une investigation coordonnée.",
      priority: pattern.priorities.URGENT ? "URGENT" : pattern.priorities.HIGH ? "HIGH" : "MEDIUM",
      incidentIds: unresolvedIds,
      createdAt: now.toISOString(),
      reviewStatus: "NEEDS_REVIEW",
    });
  }

  const incidentsById = new Map(incidents.map((incident) => [incident.id, incident]));
  const linkedGroups = new Map<string, IntelligenceIncident[]>();
  for (const incident of incidents) {
    if (incident.status === "RESOLVED") continue;
    const linkedIds = (incident.relatedIncidentIds ?? [])
      .filter((id) => incidentsById.has(id))
      .sort();
    if (!linkedIds.length) continue;
    const groupIds = [...new Set([incident.id, ...linkedIds])].sort();
    const group = groupIds.map((id) => incidentsById.get(id)!).filter((item) => item.status !== "RESOLVED");
    if (group.length < 2) continue;
    linkedGroups.set(groupIds.join(","), group);
  }
  for (const [groupKey, group] of linkedGroups) {
    recommendations.push({
      id: stableId("linked", groupKey),
      type: "linked_unresolved",
      title: "Dossiers associés non résolus",
      explanation: `${group.length} réclamations non résolues sont explicitement liées dans les dossiers par un gestionnaire.`,
      suggestedAction: "Examiner les dossiers associés et décider du suivi adapté.",
      priority: group.some((incident) => incident.priority === "URGENT")
        ? "URGENT"
        : group.some((incident) => incident.priority === "HIGH") ? "HIGH" : "MEDIUM",
      incidentIds: group.map((incident) => incident.id),
      createdAt: now.toISOString(),
      reviewStatus: "NEEDS_REVIEW",
    });
  }

  const priorityRank: Record<Priority, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  return recommendations.sort(
    (a, b) => priorityRank[b.priority] - priorityRank[a.priority]
      || b.createdAt.localeCompare(a.createdAt)
      || a.id.localeCompare(b.id)
  );
}
