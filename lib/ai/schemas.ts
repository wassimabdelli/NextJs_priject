import { z } from "zod";
import { AnnouncementAudience, AnnouncementCategory, AnnouncementPriority, IncidentCategory, Priority, Role, values } from "@/types/enums";

export const incidentTextInput = z.object({
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(5).max(4000),
});

export const incidentClassificationSchema = z.object({
  category: z.enum(values(IncidentCategory)),
  priority: z.enum(values(Priority)),
  summary: z.string().trim().min(1).max(500),
  suggestedAction: z.string().trim().min(1).max(700),
  confidence: z.number().min(0).max(1),
});
export type IncidentClassification = z.infer<typeof incidentClassificationSchema>;

export const priorityInputSchema = z.object({ description: z.string().trim().min(5).max(4000) });
export const priorityResultSchema = z.object({
  suggestedPriority: z.enum(values(Priority)),
  explanation: z.string().trim().min(1).max(600),
  safetyWarning: z.string().trim().max(500).nullable(),
});

export const duplicatesInputSchema = incidentTextInput.extend({
  residenceId: z.string().regex(/^[a-f\d]{24}$/i),
  incidentId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});
export const duplicateExplanationSchema = z.object({
  matches: z.array(z.object({
    incidentId: z.string().regex(/^[a-f\d]{24}$/i),
    similar: z.boolean(),
    explanation: z.string().trim().max(300),
  })).max(8),
});

export const announcementGenerateInputSchema = z.object({
  topic: z.string().trim().min(5).max(2000),
  category: z.enum(values(AnnouncementCategory)),
  audience: z.enum(values(AnnouncementAudience)),
  tone: z.enum(["PROFESSIONAL", "FRIENDLY", "URGENT"]),
  language: z.enum(["FR", "AR", "EN"]),
  mode: z.enum(["GENERATE", "TITLE", "REWRITE", "SHORTER", "PROFESSIONAL", "FRIENDLY", "GRAMMAR"]).default("GENERATE"),
  existingTitle: z.string().trim().max(180).optional(),
  existingContent: z.string().trim().max(4000).optional(),
  facts: z.array(z.string().trim().max(240)).max(8).optional(),
});
export const announcementGenerateResultSchema = z.object({
  title: z.string().trim().min(1).max(180),
  content: z.string().trim().min(1).max(4000),
  suggestedCategory: z.enum(values(AnnouncementCategory)),
  suggestedPriority: z.enum(values(AnnouncementPriority)),
});

export const translationInputSchema = z.object({
  content: z.string().trim().min(1).max(20_000),
  sourceLanguage: z.enum(["FR", "AR", "EN"]).optional(),
  targetLanguage: z.enum(["FR", "AR", "EN"]),
});
const translationLanguageSchema = z.enum(["FR", "AR", "EN", "OTHER"]);
const translationResultObjectSchema = z.object({
  translatedContent: z.string().trim().min(1).max(20_000),
  detectedLanguage: translationLanguageSchema,
});
export const translationResultSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const result = value as Record<string, unknown>;
  const language = typeof result.detectedLanguage === "string"
    ? result.detectedLanguage.trim().toLowerCase()
    : "";
  const detectedLanguage = ["fr", "français", "francais", "french"].includes(language)
    ? "FR"
    : ["ar", "العربية", "arabic"].includes(language)
    ? "AR"
    : ["en", "english", "anglais"].includes(language)
    ? "EN"
    : "OTHER";
  return {
    ...result,
    translatedContent: result.translatedContent
      ?? result.translatedText
      ?? result.translation
      ?? result.text,
    detectedLanguage,
  };
}, translationResultObjectSchema);

export const chatInputSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  conversationId: z.string().uuid().optional(),
});
export const chatResultSchema = z.object({ answer: z.string().trim().min(1).max(3000) });

export const reportInputSchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export const reportResultSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  observations: z.array(z.string().trim().min(1).max(500)).max(8),
  recommendations: z.array(z.string().trim().min(1).max(500)).max(8),
});

export const incidentScopeRoles = [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT, Role.TECHNICIAN] as const;
