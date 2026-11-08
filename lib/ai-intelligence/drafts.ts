import { isDuplicateKeyError } from "@/lib/api";
import { generateAnnouncement } from "@/lib/ai/announcement-generator";
import { announcementGenerateInputSchema } from "@/lib/ai/schemas";
import { Announcement } from "@/models/Announcement";
import {
  AnnouncementCategory,
  AnnouncementStatus,
  IntelligenceReviewStatus,
  type AnnouncementAudience,
} from "@/types/enums";
import type { IntelligenceIncident, RecurringProblem } from "./analysis";

function announcementCategory(category: IntelligenceIncident["category"]) {
  if (category === "SECURITY") return AnnouncementCategory.SECURITY;
  if (category === "OTHER") return AnnouncementCategory.GENERAL;
  return AnnouncementCategory.MAINTENANCE;
}

export async function createIntelligenceAnnouncementDraft(input: {
  userId: string;
  residenceId: string;
  incidents: IntelligenceIncident[];
  pattern: RecurringProblem;
  audience: AnnouncementAudience;
  language: "FR" | "AR" | "EN";
}) {
  const existingFilter = {
    residence: input.residenceId,
    "intelligenceSource.patternKey": input.pattern.patternKey,
  };
  const existing = await Announcement.findOne(existingFilter).lean();
  if (existing) return { created: false, announcement: existing };

  const representativeIncidents = input.incidents.slice(0, 8);
  const topic = [
    `Proposer un avis informatif au sujet d'un groupe de ${input.pattern.count} réclamations potentiellement similaires.`,
    `Catégorie: ${input.pattern.category}. Lieu commun identifié: ${input.pattern.location ?? "non déterminé"}.`,
    `Période observée: ${input.pattern.firstReportedAt} à ${input.pattern.latestReportedAt}.`,
    `Les éléments indiquent une similarité de description (${input.pattern.sharedTerms.join(", ")}), pas une cause commune confirmée.`,
    "Ne pas affirmer qu'une cause est établie, qu'une intervention a eu lieu, ni annoncer de date ou d'engagement non fourni.",
    "Descriptions représentatives: ",
    ...representativeIncidents.map((incident) => `- ${incident.title}: ${incident.description.slice(0, 350)}`),
  ].join("\n");
  const generated = await generateAnnouncement(input.userId, announcementGenerateInputSchema.parse({
    topic: topic.slice(0, 2000),
    category: announcementCategory(input.pattern.category),
    audience: input.audience,
    tone: "PROFESSIONAL",
    language: input.language,
    mode: "GENERATE",
  }));
  const generatedAt = new Date();
  const document = {
    residence: input.residenceId,
    author: input.userId,
    title: generated.title,
    content: generated.content,
    category: generated.suggestedCategory,
    priority: generated.suggestedPriority,
    audience: input.audience,
    status: AnnouncementStatus.DRAFT,
    publishedAt: generatedAt,
    scheduledAt: null,
    expiresAt: null,
    isPinned: false,
    attachments: [],
    intelligenceSource: {
      patternKey: input.pattern.patternKey,
      category: input.pattern.category,
      incidentIds: input.pattern.incidentIds,
      generatedAt,
      language: input.language,
      reviewStatus: IntelligenceReviewStatus.DRAFT,
    },
  };

  try {
    const announcement = await Announcement.create(document);
    return { created: true, announcement: announcement.toObject() };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const duplicate = await Announcement.findOne(existingFilter).lean();
    if (!duplicate) throw error;
    return { created: false, announcement: duplicate };
  }
}
