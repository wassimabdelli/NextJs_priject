import { IncidentCategory, Priority } from "@/types/enums";

export interface IncidentAnalysisInput {
  photo?: {
    base64Data: string;
    mimeType: string;
  };
  audio?: {
    base64Data: string;
    mimeType: string;
  };
  context?: string;
  residenceName?: string;
}

export interface IncidentAnalysisResult {
  title: string;
  category: IncidentCategory;
  priority: Priority;
  description: string;
  suggestedAction?: string;
  detectedDamage?: string;
  source: "gemini" | "fallback";
}

const SYSTEM_PROMPT = `Tu es l'expert technique et assistant IA de SyndicPro, une application de gestion de copropriété.
Ta mission est d'analyser les éléments fournis par un résident (photo du problème, note vocale audio, ou texte descriptif) afin de générer un signalement d'incident professionnel, clair et exploitable immédiatement par le syndic et les techniciens d'intervention.

Contraintes de catégorisation :
- category DOIT être l'une de ces valeurs exactes : "PLUMBING" (plomberie, fuite, canalisation), "ELECTRICITY" (électricité, disjoncteur, tableau, éclairage), "ELEVATOR" (ascenseur, blocage, bruit), "CLEANING" (nettoyage, détritus, propreté), "SECURITY" (incendie, alarme, accident, chute, blessé, serrure, porte d'entrée, badge, caméra, effraction), "OTHER" (autre problème de copropriété).
- priority DOIT être l'une de ces valeurs exactes : "LOW" (problème mineur sans urgence), "MEDIUM" (gênant mais n'impacte pas la sécurité), "HIGH" (impacte le confort ou risque d'aggravation rapide), "URGENT" (danger immédiat pour les personnes ou l'immeuble, incendie, blessure/chute, inondation active, personne coincée, coupure générale).

Structure de sortie JSON exigée :
{
  "title": "Titre clair et concis (ex: Fuite d'eau active sous collecteur au 2ème étage)",
  "category": "PLUMBING" | "ELECTRICITY" | "ELEVATOR" | "CLEANING" | "SECURITY" | "OTHER",
  "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  "description": "Description technique détaillée rédigée en français soigné, précisant la nature de l'anomalie, les risques observés et les détails visibles ou entendus.",
  "suggestedAction": "Consigne de sécurité ou action immédiate conseillée au résident (ex: Couper la vanne d'arrêt générale d'eau)",
  "detectedDamage": "Éléments matériels touchés ou constatés (ex: Infiltration sur plâtre, flaques au sol)"
}`;

function getGeminiApiKey(): string | null {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "") {
    return process.env.GEMINI_API_KEY.trim();
  }
  if (process.env.GOOGLE_AI_API_KEY && process.env.GOOGLE_AI_API_KEY.trim() !== "") {
    return process.env.GOOGLE_AI_API_KEY.trim();
  }
  // Lecture dynamique à chaud de .env.local pour prise en compte immédiate sans redémarrage
  try {
    const fs = require("fs");
    const path = require("path");
    const envLocalPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envLocalPath)) {
      const content = fs.readFileSync(envLocalPath, "utf8");
      const match = content.match(/GEMINI_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/);
      if (match && match[1] && match[1].trim() !== "") {
        return match[1].trim();
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Fonction maîtresse unique pour l'analyse d'incident par IA.
 * Utilise l'API Google Gemini multimodal (texte + vision + audio en un seul appel).
 * Si aucune clé API n'est configurée, active un fallback heuristique pour permettre le test de l'UI.
 */
export async function analyzeIncident(
  input: IncidentAnalysisInput
): Promise<IncidentAnalysisResult> {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    console.warn("[Gemini AI] Aucune clé GEMINI_API_KEY détectée dans .env.local. Activation du fallback.");
    return generateFallbackAnalysis(input);
  }

  try {
    const parts: any[] = [{ text: SYSTEM_PROMPT }];

    if (input.context) {
      parts.push({
        text: `Contexte complémentaire fourni par le résident : "${input.context}". Résidence : "${input.residenceName || "Copropriété"}"`,
      });
    }

    if (input.photo?.base64Data) {
      // Nettoie l'en-tête data URL si présent
      const cleanPhotoData = input.photo.base64Data.replace(/^data:[^;]+;base64,/, "");
      parts.push({
        inlineData: {
          mimeType: input.photo.mimeType || "image/jpeg",
          data: cleanPhotoData,
        },
      });
    }

    if (input.audio?.base64Data) {
      const cleanAudioData = input.audio.base64Data.replace(/^data:[^;]+;base64,/, "");
      parts.push({
        inlineData: {
          mimeType: input.audio.mimeType || "audio/webm",
          data: cleanAudioData,
        },
      });
    }

    // Appel direct à l'API Gemini 2.5 Flash (compatible multimodal texte, photo & audio)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("[Gemini API Error] Erreur API Gemini, utilisation du fallback :", errorText);
      return generateFallbackAnalysis(input);
    }

    const jsonRes = await response.json();
    const candidateText =
      jsonRes.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return generateFallbackAnalysis(input);
    }

    const parsed = JSON.parse(candidateText);

    // Normalisation des énumérations
    const validCategory = Object.values(IncidentCategory).includes(parsed.category)
      ? parsed.category
      : IncidentCategory.OTHER;

    const validPriority = Object.values(Priority).includes(parsed.priority)
      ? parsed.priority
      : Priority.MEDIUM;

    return {
      title: parsed.title || "Incident signalé",
      category: validCategory,
      priority: validPriority,
      description: parsed.description || "Description non disponible.",
      suggestedAction: parsed.suggestedAction || "Veuillez attendre l'intervention du syndic.",
      detectedDamage: parsed.detectedDamage,
      source: "gemini",
    };
  } catch (err) {
    console.warn("[Incident Assistant] Erreur d'analyse, bascule sur le fallback :", err);
    return generateFallbackAnalysis(input);
  }
}

/**
 * Fallback de secours intelligent pour les démos sans clé API ou pannes réseau.
 */
function generateFallbackAnalysis(input: IncidentAnalysisInput): IncidentAnalysisResult {
  const text = (input.context || "").toLowerCase();

  let category: IncidentCategory = IncidentCategory.OTHER;
  let priority: Priority = Priority.MEDIUM;
  let title = "Anomalie signalée dans la copropriété";
  let suggestedAction = "Sécuriser le périmètre et attendre le technicien.";

  // Incendie / Feu / Fumée / Brûlé
  if (
    text.includes("feu") ||
    text.includes("fire") ||
    text.includes("incendie") ||
    text.includes("brul") ||
    text.includes("fume") ||
    text.includes("cendre")
  ) {
    category = IncidentCategory.SECURITY;
    priority = Priority.URGENT;
    title = "Départ de feu ou dégâts d'incendie constatés";
    suggestedAction = "Évacuer la zone, déclencher l'alarme incendie et appeler immédiatement les sapeurs-pompiers (18/112).";
  }
  // Chute / Blessé / Urgence corporelle / Personne âgée / Escalier
  else if (
    text.includes("chut") ||
    text.includes("tomb") ||
    text.includes("fell") ||
    text.includes("blesse") ||
    text.includes("escalier") ||
    text.includes("stair") ||
    text.includes("malaise") ||
    text.includes("secours") ||
    text.includes("homme") ||
    text.includes("personne")
  ) {
    category = IncidentCategory.SECURITY;
    priority = Priority.URGENT;
    title = "Accident corporel ou chute d'une personne dans les escaliers";
    suggestedAction = "Contacter immédiatement les secours d'urgence (SAMU 15 / Protection civile 198) et ne pas déplacer la victime.";
  }
  // Plomberie / Inondation / Fuite
  else if (text.includes("eau") || text.includes("fuite") || text.includes("inondation") || text.includes("robinet") || text.includes("water") || text.includes("leak")) {
    category = IncidentCategory.PLUMBING;
    priority = text.includes("inondation") || text.includes("urgent") ? Priority.URGENT : Priority.HIGH;
    title = "Fuite d'eau constatée avec risque d'infiltration";
    suggestedAction = "Couper immédiatement la vanne d'arrivée d'eau la plus proche.";
  }
  // Ascenseur
  else if (text.includes("ascenseur") || text.includes("bloqu") || text.includes("etage") || text.includes("elevator")) {
    category = IncidentCategory.ELEVATOR;
    priority = text.includes("bloqu") ? Priority.URGENT : Priority.HIGH;
    title = "Panne ou anomalie critique sur l'ascenseur";
    suggestedAction = "Ne pas forcer les portes, vérifier si des personnes sont bloquées et appeler le technicien ascensoriste.";
  }
  // Électricité
  else if (text.includes("electr") || text.includes("courant") || text.includes("lumiere") || text.includes("disjoncteur")) {
    category = IncidentCategory.ELECTRICITY;
    priority = Priority.HIGH;
    title = "Dysfonctionnement électrique dans les parties communes";
    suggestedAction = "Ne pas manipuler les câbles dénudés ni les disjoncteurs humides.";
  }
  // Sécurité / Accès
  else if (text.includes("porte") || text.includes("serrure") || text.includes("badge") || text.includes("vol") || text.includes("effraction")) {
    category = IncidentCategory.SECURITY;
    priority = Priority.HIGH;
    title = "Défaut de sécurisation sur les accès de l'immeuble";
    suggestedAction = "Vérifier la fermeture manuelle des issues et sécuriser l'accès.";
  }
  else if (input.photo) {
    title = "Incident matériel constaté sur place";
    category = IncidentCategory.OTHER;
    priority = Priority.MEDIUM;
    suggestedAction = "Conserver la zone dégagée pour l'inspection du technicien.";
  }

  return {
    title,
    category,
    priority,
    description: input.context
      ? `Signalement analysé (mode simulation) : "${input.context}". Nécessite une intervention d'urgence pour diagnostic sur site.`
      : "Constat transmis par le résident (mode simulation local sans clé API Gemini).",
    suggestedAction,
    detectedDamage: "Anomalie identifiée sur place.",
    source: "fallback",
  };
}

