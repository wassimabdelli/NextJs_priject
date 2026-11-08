export type IntelligenceMetric = {
  label: string;
  value: number;
  description?: string;
  trend?: {
    value: number;
    direction: "up" | "down" | "stable";
  };
};

export type RecurringPattern = {
  id: string;
  residenceId: string;
  patternKey: string;
  title: string;
  patternType: "category" | "location" | "description";
  complaintCount: number;
  category?: string;
  location?: string;
  periodLabel: string;
  evidence: string;
  complaintIds: string[];
  evidenceLevel?: "low" | "moderate" | "strong" | "category_only";
  detectionMethod?: "meaningful_text_overlap" | "semantic_embedding" | "category_count";
  reviewStatus?: "CONFIRMED" | "DISMISSED";
  sharedTerms: string[];
  statuses: Record<string, number>;
  priorities: Record<string, number>;
};

export type AttentionComplaint = {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  residenceName?: string;
  apartmentLabel?: string;
  reason: string;
};

export type CommunicationOpportunity = {
  id: string;
  title: string;
  description: string;
  complaintCount: number;
  residenceName?: string;
  suggestedAction: string;
  category?: string;
  patternId: string;
  residenceId: string;
  incidentIds: string[];
};

export type TrendPoint = {
  period: string;
  count: number;
  unresolvedCount?: number;
};

export type CategoryPoint = {
  category: string;
  count: number;
};

export type StatusPoint = {
  status: string;
  count: number;
};

export type AnnouncementImpactItem = {
  id: string;
  title: string;
  publishedAt: string;
  category?: string;
  beforeCount?: number;
  afterCount?: number;
  beforePeriod?: {
    start: string;
    end: string;
  };
  afterPeriod?: {
    start: string;
    end: string;
  };
  percentageChange?: number;
  sufficientData: boolean;
  limitation?: string;
};

export type AnnouncementSuggestion = {
  id: string;
  residenceId: string;
  residenceName?: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  audience: string;
  status: string;
  publishedAt: string;
  source: {
    patternKey: string;
    category: string;
    incidentIds: string[];
    generatedAt: string;
    language?: "FR" | "AR" | "EN";
    reviewStatus: "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  };
};

export type IntelligenceResidence = { id: string; name: string };

export type AIIntelligenceResponse = {
  metrics: {
    openComplaints: number;
    attentionCount: number;
    recurringPatternsCount: number;
    recentComplaintCount: number;
    publishedAnnouncementsCount: number;
  };
  recurringPatterns: RecurringPattern[];
  attentionComplaints: AttentionComplaint[];
  trends: TrendPoint[];
  categories: CategoryPoint[];
  statuses: StatusPoint[];
  communicationOpportunities: CommunicationOpportunity[];
  announcementImpact: AnnouncementImpactItem[];
  announcementSuggestions: AnnouncementSuggestion[];
  residences: IntelligenceResidence[];
  lastUpdated: string;
  complaintComparison?: {
    current: number;
    previous: number;
    change: number;
    changePercent: number | null;
  };
  analysisCoverage?: {
    patternAnalysisTruncated: boolean;
    attentionAnalysisTruncated: boolean;
    patternAnalysisLimit?: number;
    patternSampleSize?: number;
    attentionRecommendationLimit?: number;
    attentionSampleSize?: number;
  };
};

export type IntelligenceAnalyticsApiData = {
  metrics: AIIntelligenceResponse["metrics"];
  recurringProblems: Array<{
    id: string;
    residenceId: string;
    patternKey: string;
    category: string;
    count: number;
    incidentIds: string[];
    location: string | null;
    firstReportedAt: string;
    latestReportedAt: string;
    detectionMethod: "meaningful_text_overlap" | "semantic_embedding" | "category_count";
    evidenceLevel: "low" | "moderate" | "category_only";
    sharedTerms: string[];
    statuses: Record<string, number>;
    priorities: Record<string, number>;
    reviewStatus?: "CONFIRMED" | "DISMISSED";
  }>;
  attentionComplaints: AttentionComplaint[];
  trendSeries: Array<{ date: string; complaints: number; unresolved: number }>;
  categories: CategoryPoint[];
  statuses: StatusPoint[];
  communicationOpportunities: CommunicationOpportunity[];
  announcementEffectiveness: {
    status: string;
    reason?: string;
    comparisons: Array<{
      status: "available" | "insufficient_data";
      announcementId: string;
      title: string;
      publishedAt?: string;
      category?: string;
      beforeCount?: number;
      afterCount?: number;
      beforePeriod?: { from: string; to: string };
      afterPeriod?: { from: string; to: string };
      comparisonWindowDays?: number;
      reason?: string;
      interpretation?: string;
    }>;
  };
  announcementSuggestions: AnnouncementSuggestion[];
  residences: IntelligenceResidence[];
  lastUpdated: string;
  comparison: {
    currentComplaintCount: number;
    previousComplaintCount: number;
    change: number;
    changePercent: number | null;
  };
  analysisCoverage?: AIIntelligenceResponse["analysisCoverage"];
};
