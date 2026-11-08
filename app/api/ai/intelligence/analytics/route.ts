import mongoose, { type PipelineStage } from "mongoose";
import type { NextRequest } from "next/server";
import { HttpError, json } from "@/lib/api";
import { resolveIntelligenceResidenceScope, residenceScopeFilter } from "@/lib/ai-intelligence/access";
import {
  buildAttentionRecommendations,
  detectRecurringProblems,
  type IntelligenceIncident,
} from "@/lib/ai-intelligence/analysis";
import { compareAnnouncementEffectiveness } from "@/lib/ai-intelligence/effectiveness";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Incident } from "@/models/Incident";
import { Announcement } from "@/models/Announcement";
import { Residence } from "@/models/Residence";
import { IntelligencePatternReview } from "@/models/IntelligencePatternReview";
import { AnnouncementStatus, IncidentStatus, Role } from "@/types/enums";
import { incidentDashboardQuerySchema } from "@/lib/validations/incidentDashboard";

const PATTERN_SAMPLE_LIMIT = 1000;
const ATTENTION_SAMPLE_LIMIT = 500;
const SUPPORTING_ID_LIMIT = 100;
const EFFECTIVENESS_QUERY_LIMIT = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;

type PopulatedIncident = {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: IntelligenceIncident["category"];
  priority: IntelligenceIncident["priority"];
  status: IntelligenceIncident["status"];
  embedding?: number[];
  reportedAt: Date;
  residence: { _id: mongoose.Types.ObjectId; name: string } | mongoose.Types.ObjectId;
  apartment?: { _id: mongoose.Types.ObjectId; number?: string | number; floor?: string | number } | mongoose.Types.ObjectId;
  relatedIncidents?: mongoose.Types.ObjectId[];
};

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, "Période de dates invalide");
  }
  return date;
}

function mapIncident(incident: PopulatedIncident): IntelligenceIncident {
  const residence = incident.residence && typeof incident.residence === "object" && "name" in incident.residence
    ? incident.residence
    : undefined;
  const apartment = incident.apartment && typeof incident.apartment === "object" && "number" in incident.apartment
    ? incident.apartment
    : undefined;
  return {
    id: String(incident._id),
    title: incident.title,
    description: incident.description,
    category: incident.category,
    priority: incident.priority,
    status: incident.status,
    embedding: incident.embedding,
    reportedAt: new Date(incident.reportedAt),
    residenceId: String(residence?._id ?? incident.residence),
    residenceName: residence?.name,
    apartmentId: apartment ? String(apartment._id) : undefined,
    apartmentNumber: apartment?.number,
    apartmentFloor: apartment?.floor,
    relatedIncidentIds: incident.relatedIncidents?.map(String),
  };
}

function buildCategorySummary(rows: Array<{
  _id: string;
  count: number;
  ids: mongoose.Types.ObjectId[];
  statuses: Array<{ status: string; count: number }>;
  priorities: Array<{ priority: string; count: number }>;
  firstReportedAt: Date;
  latestReportedAt: Date;
}>) {
  return rows
    .filter((row) => row.count >= 2)
    .map((row) => ({
      category: row._id,
      count: row.count,
      supportingIncidentIds: row.ids.slice(0, SUPPORTING_ID_LIMIT).map(String),
      supportingIncidentIdsTruncated: row.count > SUPPORTING_ID_LIMIT,
      statuses: Object.fromEntries(row.statuses.map(({ status, count }) => [status, count])),
      priorities: Object.fromEntries(row.priorities.map(({ priority, count }) => [priority, count])),
      firstReportedAt: new Date(row.firstReportedAt).toISOString(),
      latestReportedAt: new Date(row.latestReportedAt).toISOString(),
      detectionMethod: "category_count",
      evidenceLevel: "category_only",
      note: "Même catégorie uniquement; ceci ne démontre pas une cause commune.",
    }));
}

async function categoryAggregation(match: Record<string, unknown>) {
  return Incident.aggregate([
    { $match: match as PipelineStage.Match["$match"] },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
        ids: { $push: "$_id" },
        firstReportedAt: { $min: "$reportedAt" },
        latestReportedAt: { $max: "$reportedAt" },
        statusRows: { $push: "$status" },
        priorityRows: { $push: "$priority" },
      },
    },
    {
      $project: {
        _id: 1,
        count: 1,
        ids: { $slice: ["$ids", SUPPORTING_ID_LIMIT + 1] },
        firstReportedAt: 1,
        latestReportedAt: 1,
        statuses: {
          $map: {
            input: { $setUnion: ["$statusRows", []] },
            as: "status",
            in: {
              status: "$$status",
              count: { $size: { $filter: { input: "$statusRows", as: "item", cond: { $eq: ["$$item", "$$status"] } } } },
            },
          },
        },
        priorities: {
          $map: {
            input: { $setUnion: ["$priorityRows", []] },
            as: "priority",
            in: {
              priority: "$$priority",
              count: { $size: { $filter: { input: "$priorityRows", as: "item", cond: { $eq: ["$$item", "$$priority"] } } } },
            },
          },
        },
      },
    },
    { $sort: { count: -1, _id: 1 } },
  ]);
}

export const GET = withAuth(
  async (req: NextRequest, user: AuthUser) => {
    const parsed = incidentDashboardQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams.entries())
    );
    if (!parsed.success) throw new HttpError(400, "Filtres AI Intelligence invalides", parsed.error.flatten());
    const scope = await resolveIntelligenceResidenceScope(user, parsed.data.residence);
    const now = new Date();
    const requestedTo = parseDate(parsed.data.to, true);
    if (requestedTo && requestedTo.toISOString().slice(0, 10) > now.toISOString().slice(0, 10)) {
      throw new HttpError(400, "La date de fin ne peut pas être dans le futur");
    }
    const to = requestedTo && requestedTo > now ? now : requestedTo ?? now;
    const from = parseDate(parsed.data.from) ?? new Date(to.getTime() - 29 * DAY_MS);
    if (from > to) throw new HttpError(400, "La date de début doit précéder la date de fin");
    if (to.getTime() - from.getTime() > 366 * DAY_MS) {
      throw new HttpError(400, "La période ne peut pas dépasser 366 jours");
    }
    const periodLength = to.getTime() - from.getTime() + 1;
    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - periodLength + 1);
    const scopeFilter = residenceScopeFilter(scope);
    const currentFilter = { ...scopeFilter, reportedAt: { $gte: from, $lte: to } };
    const previousFilter = { ...scopeFilter, reportedAt: { $gte: previousFrom, $lte: previousTo } };
    const unresolvedFilter = { ...scopeFilter, status: { $ne: IncidentStatus.RESOLVED } };

    const [
      currentTotal,
      previousTotal,
      currentCategoryRows,
      previousCategoryRows,
      currentRows,
      unresolvedTotal,
      unresolvedRows,
      trendRows,
      availableResidences,
      suggestionRows,
      publishedAnnouncementsCount,
      statusRows,
    ] = await Promise.all([
      Incident.countDocuments(currentFilter),
      Incident.countDocuments(previousFilter),
      categoryAggregation(currentFilter),
      categoryAggregation(previousFilter),
      Incident.find(currentFilter)
        .sort({ reportedAt: 1, _id: 1 })
        .limit(PATTERN_SAMPLE_LIMIT)
        .select("+embedding title description category priority status reportedAt residence apartment relatedIncidents")
        .populate({ path: "residence", select: "name" })
        .populate({ path: "apartment", select: "number floor" })
        .lean(),
      Incident.countDocuments(unresolvedFilter),
      Incident.find(unresolvedFilter)
        .sort({ priority: -1, reportedAt: 1, _id: 1 })
        .limit(ATTENTION_SAMPLE_LIMIT)
        .select("+embedding title description category priority status reportedAt residence apartment relatedIncidents")
        .populate({ path: "residence", select: "name" })
        .populate({ path: "apartment", select: "number floor" })
        .lean(),
      Incident.aggregate([
        { $match: currentFilter as PipelineStage.Match["$match"] },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$reportedAt" } },
            count: { $sum: 1 },
            unresolved: { $sum: { $cond: [{ $eq: ["$status", "RESOLVED"] }, 0, 1] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      scope
        ? Residence.find({ _id: { $in: scope.map((id) => new mongoose.Types.ObjectId(id)) } })
            .select("_id name")
            .sort({ name: 1 })
            .lean()
        : Residence.find({}).select("_id name").sort({ name: 1 }).limit(200).lean(),
      Announcement.find({
        ...scopeFilter,
        "intelligenceSource.patternKey": { $exists: true },
      })
        .sort({ updatedAt: -1 })
        .limit(100)
        .select("_id residence title content category priority audience status publishedAt intelligenceSource")
        .lean(),
      Announcement.countDocuments({
        $and: [
          scopeFilter,
          { $or: [{ status: AnnouncementStatus.PUBLISHED }, { status: { $exists: false } }] },
          { publishedAt: { $gte: from, $lte: to } },
        ],
      }),
      Incident.aggregate([
        { $match: currentFilter as PipelineStage.Match["$match"] },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const currentIncidents = currentRows.map((row) => mapIncident(row as unknown as PopulatedIncident));
    const unresolvedIncidents = unresolvedRows.map((row) => mapIncident(row as unknown as PopulatedIncident));
    const recurringProblems = detectRecurringProblems(currentIncidents);
    const patternReviews = recurringProblems.length
      ? await IntelligencePatternReview.find({
          residence: { $in: [...new Set(recurringProblems.map((pattern) => pattern.residenceId))] },
          patternKey: { $in: [...new Set(recurringProblems.map((pattern) => pattern.patternKey))] },
        }).select("residence patternKey status").lean()
      : [];
    const reviewByPattern = new Map(patternReviews.map((review) => [
      `${String(review.residence)}:${review.patternKey}`,
      review.status,
    ]));
    const reviewedPatterns = recurringProblems.map((pattern) => ({
      ...pattern,
      reviewStatus: reviewByPattern.get(`${pattern.residenceId}:${pattern.patternKey}`),
    }));
    const recommendations = buildAttentionRecommendations(
      [...new Map([...currentIncidents, ...unresolvedIncidents].map((item) => [item.id, item])).values()],
      recurringProblems.filter((pattern) => pattern.detectionMethod !== "category_count"),
      now
    );
    const unresolvedById = new Map(unresolvedIncidents.map((incident) => [incident.id, incident]));
    const attentionReasons = new Map<string, Set<string>>();
    for (const recommendation of recommendations) {
      for (const incidentId of recommendation.incidentIds) {
        const reasons = attentionReasons.get(incidentId) ?? new Set<string>();
        reasons.add(recommendation.explanation);
        attentionReasons.set(incidentId, reasons);
      }
    }
    const attentionComplaints = [...attentionReasons.entries()]
      .map(([incidentId, reasons]) => {
        const incident = unresolvedById.get(incidentId);
        if (!incident) return null;
        return {
          id: incident.id,
          title: incident.title,
          category: incident.category,
          priority: incident.priority,
          status: incident.status,
          createdAt: incident.reportedAt.toISOString(),
          residenceId: incident.residenceId,
          residenceName: incident.residenceName,
          apartmentLabel: incident.apartmentNumber === undefined
            ? undefined
            : `Lot ${incident.apartmentNumber}${incident.apartmentFloor === undefined ? "" : ` · étage ${incident.apartmentFloor}`}`,
          reason: [...reasons].join(" "),
        };
      })
      .filter((incident) => incident !== null);
    const intelligenceSuggestions = suggestionRows.filter(
      (announcement): announcement is typeof announcement & { intelligenceSource: NonNullable<typeof announcement.intelligenceSource> } =>
        Boolean(announcement.intelligenceSource)
    );
    const announcementSuggestions = intelligenceSuggestions.map((announcement) => ({
      id: String(announcement._id),
      residenceId: String(announcement.residence),
      title: announcement.title,
      content: announcement.content,
      category: announcement.category,
      priority: announcement.priority,
      audience: announcement.audience,
      status: announcement.status,
      publishedAt: announcement.publishedAt,
      source: {
        patternKey: announcement.intelligenceSource.patternKey,
        category: announcement.intelligenceSource.category,
        incidentIds: announcement.intelligenceSource.incidentIds.map(String),
        generatedAt: announcement.intelligenceSource.generatedAt,
        language: announcement.intelligenceSource.language,
        reviewStatus: announcement.intelligenceSource.reviewStatus,
      },
    }));
    const residenceNames = new Map(availableResidences.map((residence) => [String(residence._id), residence.name]));
    const communicationOpportunities = recommendations
      .filter((recommendation) => recommendation.type === "recurring_unresolved")
      .map((recommendation) => {
        const pattern = recurringProblems.find((candidate) =>
          candidate.incidentIds.some((id) => recommendation.incidentIds.includes(id))
        );
        if (!pattern) return null;
        return {
          id: pattern.id,
          residenceId: pattern.residenceId,
          title: "Examiner une communication aux résidents",
          description: recommendation.explanation,
          complaintCount: recommendation.incidentIds.length,
          residenceName: residenceNames.get(pattern.residenceId),
          suggestedAction: "Évaluer si une information factuelle aux résidents serait utile.",
          category: pattern.category,
          patternId: pattern.id,
          incidentIds: pattern.incidentIds,
        };
      })
      .filter((opportunity) => opportunity !== null);

    const publishedSuggestions = intelligenceSuggestions.filter((announcement) =>
      announcement.status === AnnouncementStatus.PUBLISHED
      && announcement.intelligenceSource?.reviewStatus === "APPROVED"
      && new Date(announcement.publishedAt) >= from
      && new Date(announcement.publishedAt) <= to);
    const announcementEffectiveness = await Promise.all(publishedSuggestions.map(async (announcement) => {
      const residenceId = String(announcement.residence);
      if (scope && !scope.includes(residenceId)) return null;
      const publishedAt = new Date(announcement.publishedAt);
      const beforeFrom = new Date(publishedAt.getTime() - 30 * DAY_MS);
      const afterTo = new Date(publishedAt.getTime() + 30 * DAY_MS);
      const sharedFilter = {
        residence: announcement.residence,
        category: announcement.intelligenceSource.category,
        reportedAt: { $gte: beforeFrom, $lt: afterTo },
      };
      const matchingCandidates = await Incident.find(sharedFilter)
        .limit(EFFECTIVENESS_QUERY_LIMIT + 1)
        .select("title description category priority status reportedAt residence apartment relatedIncidents")
        .populate({ path: "residence", select: "name" })
        .populate({ path: "apartment", select: "number floor" })
        .lean();
      const seeds = await Incident.find({
        _id: { $in: announcement.intelligenceSource.incidentIds },
        residence: announcement.residence,
      })
        .select("title description category priority status reportedAt residence apartment relatedIncidents")
        .populate({ path: "residence", select: "name" })
        .populate({ path: "apartment", select: "number floor" })
        .lean();
      if (matchingCandidates.length > EFFECTIVENESS_QUERY_LIMIT) {
        return {
          announcementId: String(announcement._id),
          title: announcement.title,
          publishedAt: new Date(announcement.publishedAt).toISOString(),
          category: announcement.intelligenceSource.category,
          status: "insufficient_data",
          reason: "Le nombre de réclamations candidates dépasse la limite d'analyse; aucun total partiel n'est présenté.",
          comparisonWindowDays: 30,
          beforePeriod: { from: beforeFrom.toISOString(), to: publishedAt.toISOString() },
          afterPeriod: { from: publishedAt.toISOString(), to: afterTo.toISOString() },
        };
      }
      return compareAnnouncementEffectiveness({
        announcementId: String(announcement._id),
        title: announcement.title,
        publishedAt,
        seeds: seeds as unknown as PopulatedIncident[],
        candidates: matchingCandidates as unknown as PopulatedIncident[],
        now,
      });
    }));

    return json({
      success: true,
      data: {
        metrics: {
          openComplaints: unresolvedTotal,
          attentionCount: attentionComplaints.length,
          recurringPatternsCount: recurringProblems.length,
          recentComplaintCount: currentTotal,
          publishedAnnouncementsCount,
        },
        role: user.role,
        residenceScope: scope ?? "all-managed",
        period: { from: from.toISOString(), to: to.toISOString() },
        previousPeriod: { from: previousFrom.toISOString(), to: previousTo.toISOString() },
        comparison: {
          currentComplaintCount: currentTotal,
          previousComplaintCount: previousTotal,
          change: currentTotal - previousTotal,
          changePercent: previousTotal === 0 ? null : Math.round(((currentTotal - previousTotal) / previousTotal) * 100),
        },
        categoryTrends: buildCategorySummary(currentCategoryRows as Parameters<typeof buildCategorySummary>[0]),
        previousCategoryTrends: buildCategorySummary(previousCategoryRows as Parameters<typeof buildCategorySummary>[0]),
        categories: (currentCategoryRows as Array<{ _id: string; count: number }>).map((row) => ({
          category: row._id,
          count: row.count,
        })),
        statuses: (statusRows as Array<{ _id: string; count: number }>).map((row) => ({
          status: row._id,
          count: row.count,
        })),
        recurringProblems: reviewedPatterns,
        recommendations,
        attentionComplaints,
        communicationOpportunities,
        announcementSuggestions,
        trendSeries: trendRows.map((row: { _id: string; count: number; unresolved: number }) => ({
          date: row._id,
          complaints: row.count,
          unresolved: row.unresolved,
        })),
        unresolvedComplaintCount: unresolvedTotal,
        analysisCoverage: {
          patternAnalysisLimit: PATTERN_SAMPLE_LIMIT,
          patternSampleSize: currentIncidents.length,
          patternAnalysisTruncated: currentTotal > currentIncidents.length,
          attentionRecommendationLimit: ATTENTION_SAMPLE_LIMIT,
          attentionSampleSize: unresolvedIncidents.length,
          attentionAnalysisTruncated: unresolvedTotal > unresolvedIncidents.length,
        },
        announcementEffectiveness: announcementEffectiveness.length > 0
          ? {
            status: "available",
            comparisons: announcementEffectiveness.filter((item) => item !== null),
          }
          : {
          status: "insufficient_data",
          reason: "Aucune annonce IA approuvée et publiée ne dispose encore d'une période de comparaison.",
          comparisons: [],
        },
        lastUpdated: now.toISOString(),
        residences: availableResidences.map((residence) => ({
          id: String(residence._id),
          name: residence.name,
        })),
      },
    }, 200);
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
