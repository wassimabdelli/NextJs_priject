import { Incident } from "@/models/Incident";
import { IncidentStatus, Priority } from "@/types/enums";
import { residenceScopeFilter, type IntelligenceResidenceScope } from "./access";
import {
  detectRecurringProblems,
  toIntelligenceIncident,
  type PopulatedIntelligenceIncident,
} from "./analysis";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function computeBriefing(scope: IntelligenceResidenceScope, now = new Date()) {
  const base = residenceScopeFilter(scope);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const dayAgo = new Date(now.getTime() - DAY_MS);

  const [critical, staleOverSevenDays, resolvedLast24h, recentRows] = await Promise.all([
    Incident.find({
      ...base,
      status: IncidentStatus.REPORTED,
      priority: Priority.URGENT,
      $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }],
    })
      .sort({ reportedAt: 1 })
      .limit(5)
      .select("title reportedAt residence")
      .populate({ path: "residence", select: "name" })
      .lean(),
    Incident.countDocuments({
      ...base,
      status: { $ne: IncidentStatus.RESOLVED },
      reportedAt: { $lt: weekAgo },
    }),
    Incident.countDocuments({
      ...base,
      status: IncidentStatus.RESOLVED,
      resolvedAt: { $gte: dayAgo },
    }),
    Incident.find({ ...base, reportedAt: { $gte: weekAgo } })
      .sort({ reportedAt: -1 })
      .limit(500)
      .select("+embedding title description category priority status reportedAt residence apartment relatedIncidents")
      .populate({ path: "residence", select: "name" })
      .populate({ path: "apartment", select: "number floor" })
      .lean(),
  ]);

  const recurring = detectRecurringProblems(
    recentRows.map((row) =>
      toIntelligenceIncident(row as unknown as PopulatedIntelligenceIncident)
    )
  )
    .filter((pattern) => pattern.detectionMethod !== "category_count")
    .slice(0, 3);

  return {
    generatedAt: now.toISOString(),
    criticalUnassigned: critical.map((item) => ({
      id: String(item._id),
      title: item.title,
      residence: typeof item.residence === "object" && item.residence !== null && "name" in item.residence
        ? String(item.residence.name ?? "")
        : "",
      hoursOpen: Math.max(0, Math.floor((now.getTime() - new Date(item.reportedAt).getTime()) / 3_600_000)),
    })),
    staleOverSevenDays,
    resolvedLast24h,
    recurring: recurring.map((pattern) => ({
      patternId: pattern.id,
      residenceId: pattern.residenceId,
      category: pattern.category,
      count: pattern.count,
      sharedTerms: pattern.sharedTerms.slice(0, 4),
    })),
  };
}
