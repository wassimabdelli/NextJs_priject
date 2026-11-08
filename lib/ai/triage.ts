import { z } from "zod";
import { generateJson, type ImagePart } from "./gemini";
import { redactPII } from "./redact";

export const CATEGORIES = ["PLUMBING", "ELECTRICITY", "ELEVATOR", "CLEANING", "SECURITY", "OTHER"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const SPECIALTIES = ["plombier", "electricien", "ascensoriste", "peintre", "serrurier", "nettoyage", "jardinier", "autre"] as const;

export const TriageSchema = z.object({
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  specialty: z.enum(SPECIALTIES),
  probableCause: z.string().max(400),
  safetyRisk: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(400),
});
export const TriageResponseSchema = TriageSchema.extend({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(5).max(2000),
});
export type TriageResult = z.infer<typeof TriageResponseSchema>;

export async function triageIncident(input: {
  title?: string;
  description?: string;
  images?: ImagePart[];
}): Promise<TriageResult> {
  const title = redactPII(input.title ?? "").slice(0, 200);
  const description = redactPII(input.description ?? "").slice(0, 2000);
  const images = input.images ?? [];

  const prompt = `Tu es un assistant de syndic de copropriété. Analyse cette réclamation d'un résident${
    images.length ? ` et les ${images.length} photo(s) jointes` : ""
  }.

Titre fourni: ${title || "(aucun)"}
Description fournie: ${description || "(aucune)"}

Réponds UNIQUEMENT avec un objet JSON de cette forme:
{
  "title": "titre bref et factuel de la réclamation, en français",
  "description": "description factuelle de ce qui est visible et des informations fournies, en français",
  "category": une valeur parmi ${JSON.stringify(CATEGORIES)},
  "priority": une valeur parmi ${JSON.stringify(PRIORITIES)},
  "specialty": une valeur parmi ${JSON.stringify(SPECIALTIES)},
  "probableCause": "cause probable en français, 1 à 2 phrases",
  "safetyRisk": true si danger pour les personnes (fuite de gaz, court-circuit, fuite d'eau près de l'électricité, ascenseur bloqué avec personne, risque d'effondrement), sinon false,
  "confidence": nombre entre 0 et 1,
  "reasoning": "justification courte en français"
}
Règles:
- Remplis TOUJOURS title, description, category, priority, specialty, probableCause, safetyRisk, confidence et reasoning, même si category vaut OTHER.
- OTHER signifie seulement que le problème ne correspond pas à PLUMBING, ELECTRICITY, ELEVATOR, CLEANING ou SECURITY. Ce n'est jamais une raison de laisser le titre, la description ou la priorité vides.
- Pour des exemples comme une peinture écaillée ou une poignée cassée, choisis OTHER si nécessaire, décris précisément le défaut visible dans le titre et la description, et propose une priorité proportionnée aux faits visibles.
- Si une photo contredit le texte fourni, fais confiance à la photo. Si aucune photo n'est jointe, base le résultat uniquement sur le texte.
- Ne devine jamais l'emplacement, la cause ou des détails invisibles; indique l'incertitude dans la description et le raisonnement.
- Ne choisis URGENT que si les éléments montrent un danger immédiat sérieux. Si safetyRisk est true, la priorité doit être la plus haute.`;

  const raw = await generateJson(prompt, images, {
    allowTextFallback: images.length === 0,
  });
  const parsed = TriageResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error("AI_INVALID_RESPONSE");
  return parsed.data;
}
