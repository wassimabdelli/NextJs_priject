import { NextRequest, NextResponse } from "next/server";
import * as AuthGuard from "@/lib/auth-guard";
import { IncidentCategory, MaintenanceType, Priority } from "@/types/enums";

// Récupération compatible des utilitaires d'authentification et de réponse HTTP
const withAuth = (AuthGuard as any).withAuth;
const json =
  (AuthGuard as any).json ||
  ((data: unknown, status = 200) => NextResponse.json(data, { status }));
const HttpError =
  (AuthGuard as any).HttpError ||
  class extends Error {
    status: number;
    statusCode: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.statusCode = status;
    }
  };

export interface AiDiagnosticResult {
  title: string;
  description: string;
  category: IncidentCategory;
  priority: Priority;
  maintenanceType: MaintenanceType;
  technicalAdvice: string;
  checklist: string[];
  estimatedCost: number;
}

// Résultat de repli en cas d'indisponibilité ou d'erreur de l'API Gemini
const FALLBACK_RESULT: AiDiagnosticResult = {
  title: "Analyse non aboutie",
  description: "Le diagnostic visuel automatique n'a pas pu aboutir...",
  category: IncidentCategory.OTHER,
  priority: Priority.MEDIUM,
  maintenanceType: MaintenanceType.CORRECTIVE,
  technicalAdvice:
    "Vérifier l'état général de l'équipement et sécuriser le périmètre avant intervention.",
  checklist: ["Sécuriser la zone"],
  estimatedCost: 0,
};

// Endpoint POST hybride (Vision ou Texte) protégé par authentification
export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const mode: "incident" | "maintenance" =
    body?.mode === "maintenance" ? "maintenance" : "incident";
  const title: string = typeof body?.title === "string" ? body.title.trim() : "";
  const description: string =
    typeof body?.description === "string" ? body.description.trim() : "";
  const photos: string[] = Array.isArray(body?.photos)
    ? body.photos.filter(Boolean)
    : [];

  const hasPhotos = photos.length > 0;

  // Validation selon le mode (photo présente ou texte présent)
  if (!hasPhotos && !title && !description) {
    const errMsg =
      mode === "maintenance"
        ? "Veuillez renseigner un titre ou une description pour l'analyse IA."
        : "Veuillez joindre au moins une photo.";
    if ((AuthGuard as any).HttpError) {
      throw new HttpError(400, errMsg);
    }
    return json({ error: errMsg }, 400);
  }

  // Construction conditionnelle du payload contents pour Gemini
  const promptSysteme =
    'Tu es un expert en maintenance de copropriété. Analyse ce problème et renvoie UNIQUEMENT un objet JSON valide avec cette structure stricte : { "title": "string", "description": "string", "category": "PLUMBING"|"ELECTRICITY"|"ELEVATOR"|"CLEANING"|"SECURITY"|"OTHER", "priority": "LOW"|"MEDIUM"|"HIGH"|"URGENT", "maintenanceType": "PREVENTIVE"|"CORRECTIVE", "technicalAdvice": "string (2 phrases max)", "checklist": ["action 1", "action 2"], "estimatedCost": 0 }';

  let contents: unknown[];

  if (hasPhotos) {
    const photoStr = photos[0];
    const mimeType = photoStr.split(";")[0].split(":")[1] || "image/jpeg";
    const base64Data = photoStr.includes(",")
      ? photoStr.split(",")[1]
      : photoStr;

    contents = [
      {
        role: "user",
        parts: [
          { text: promptSysteme },
          { inlineData: { mimeType, data: base64Data } },
        ],
      },
    ];
  } else {
    contents = [
      {
        role: "user",
        parts: [
          {
            text: promptSysteme + `\n\nTitre: ${title}\nDescription: ${description}`,
          },
        ],
      },
    ];
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${(process.env.GEMINI_API_KEY || "").trim()}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    if (!response.ok) {
      console.error("[Gemini Error]", await response.text());
      return json(FALLBACK_RESULT, 200);
    }

    const data = await response.json();
    let textContent = data.candidates[0].content.parts[0].text;
    textContent = textContent.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(textContent);

    return json(result, 200);
  } catch (err) {
    console.error("[Gemini Error]", err);
    // Retour du JSON par défaut en cas d'erreur réseau ou de parsing
    return json(FALLBACK_RESULT, 200);
  }
});
