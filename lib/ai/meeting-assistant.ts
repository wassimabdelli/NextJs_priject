/**
 * À partir de la transcription d'une AG, génère ODJ + brouillon de PV.
 * Gemini si clé dispo, sinon fallback heuristique.
 */

export interface MeetingAiInput {
  transcript: string;
  meetingTitle: string;
  residenceName?: string;
  existingAgenda?: string[];
}

export interface MeetingAiResult {
  agendaItems: string[];
  minutesDraft: string;
  decisions: string[];
  source: "gemini" | "fallback";
  /** Transcription brute (utile après upload audio/vidéo) */
  transcript?: string;
}

export interface RecordingInput {
  base64Data: string;
  mimeType: string;
  meetingTitle: string;
  residenceName?: string;
  existingAgenda?: string[];
}

function getGeminiApiKey(): string | null {
  if (process.env.GEMINI_API_KEY?.trim()) return process.env.GEMINI_API_KEY.trim();
  if (process.env.GOOGLE_AI_API_KEY?.trim()) return process.env.GOOGLE_AI_API_KEY.trim();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path");
    const envLocalPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envLocalPath)) {
      const content = fs.readFileSync(envLocalPath, "utf8");
      const match = content.match(/GEMINI_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/);
      if (match?.[1]?.trim()) return match[1].trim();
    }
  } catch {
    // ignore
  }
  return null;
}

const SYSTEM_PROMPT = `Tu es le secrétaire de séance IA de SyndicPro (gestion de copropriété en Tunisie / francophone).
À partir de la transcription d'une assemblée générale, tu produis un JSON strict :

{
  "agendaItems": ["1. ...", "2. ..."],  // ordre du jour clair, numéroté, 5 à 12 points
  "decisions": ["Décision 1...", "Décision 2..."],  // décisions / votes mentionnés
  "minutesDraft": "Texte de procès-verbal en français soigné, paragraphes, sans markdown."
}

Règles :
- Français uniquement.
- Ne invente pas de votes chiffrés absents de la transcription.
- Structure le PV : ouverture, points discutés, décisions, clôture.
- Si la transcription est courte, reste prudent et factuel.`;

/**
 * Transcrit un enregistrement Jitsi (.webm / audio / vidéo) puis produit le Pack AG.
 */
export async function generatePackFromRecording(
  input: RecordingInput
): Promise<MeetingAiResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY manquante : impossible de transcrire l'enregistrement automatiquement"
    );
  }

  const clean = input.base64Data.replace(/^data:[^;]+;base64,/, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `${SYSTEM_PROMPT}

Tu reçois l'enregistrement audio/vidéo d'une assemblée générale.
1) Transcris fidèlement en français (champ "transcript").
2) Puis produis agendaItems, decisions, minutesDraft comme demandé.

JSON strict :
{
  "transcript": "texte intégral de ce qui a été dit",
  "agendaItems": ["1. ..."],
  "decisions": ["..."],
  "minutesDraft": "..."
}

Titre AG : ${input.meetingTitle}
Résidence : ${input.residenceName || "Copropriété"}
ODJ existant : ${(input.existingAgenda || []).join(" | ") || "aucun"}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: input.mimeType || "audio/webm",
                data: clean,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini transcription échouée : ${errText.slice(0, 300)}`);
  }

  const jsonRes = await response.json();
  const text = jsonRes.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Réponse Gemini vide");

  const parsed = JSON.parse(text);
  const transcript =
    typeof parsed.transcript === "string" ? parsed.transcript.trim() : "";
  if (transcript.length < 20) {
    throw new Error(
      "Transcription trop courte — vérifie que le fichier .webm contient bien de l'audio"
    );
  }

  const pack = await generatePackFromTranscript({
    transcript,
    meetingTitle: input.meetingTitle,
    residenceName: input.residenceName,
    existingAgenda: input.existingAgenda,
  });

  // Préfère le pack déjà produit dans le même appel si présent
  const agendaItems = Array.isArray(parsed.agendaItems)
    ? parsed.agendaItems.map(String).filter(Boolean)
    : pack.agendaItems;
  const decisions = Array.isArray(parsed.decisions)
    ? parsed.decisions.map(String).filter(Boolean)
    : pack.decisions;
  const minutesDraft =
    typeof parsed.minutesDraft === "string" && parsed.minutesDraft.trim()
      ? parsed.minutesDraft.trim()
      : pack.minutesDraft;

  return {
    transcript,
    agendaItems: agendaItems.length ? agendaItems : pack.agendaItems,
    decisions,
    minutesDraft,
    source: "gemini",
  };
}

export async function generatePackFromTranscript(
  input: MeetingAiInput
): Promise<MeetingAiResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return fallbackFromTranscript(input);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const prompt = `${SYSTEM_PROMPT}

Titre AG : ${input.meetingTitle}
Résidence : ${input.residenceName || "Copropriété"}
ODJ existant (indicatif) : ${(input.existingAgenda || []).join(" | ") || "aucun"}

TRANSCRIPTION :
"""
${input.transcript.slice(0, 24000)}
"""`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      console.warn("[meeting-ai] Gemini error", await response.text());
      return fallbackFromTranscript(input);
    }

    const jsonRes = await response.json();
    const text = jsonRes.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return fallbackFromTranscript(input);

    const parsed = JSON.parse(text);
    const agendaItems = Array.isArray(parsed.agendaItems)
      ? parsed.agendaItems.map(String).filter(Boolean)
      : [];
    const decisions = Array.isArray(parsed.decisions)
      ? parsed.decisions.map(String).filter(Boolean)
      : [];
    const minutesDraft =
      typeof parsed.minutesDraft === "string" && parsed.minutesDraft.trim()
        ? parsed.minutesDraft.trim()
        : fallbackFromTranscript(input).minutesDraft;

    return {
      agendaItems:
        agendaItems.length > 0 ? agendaItems : fallbackFromTranscript(input).agendaItems,
      decisions,
      minutesDraft,
      source: "gemini",
    };
  } catch (err) {
    console.warn("[meeting-ai] fallback", err);
    return fallbackFromTranscript(input);
  }
}

function fallbackFromTranscript(input: MeetingAiInput): MeetingAiResult {
  const lines = input.transcript
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 12)
    .slice(0, 8);

  const agendaItems =
    input.existingAgenda && input.existingAgenda.length > 0
      ? input.existingAgenda
      : [
          "1. Ouverture de séance et vérification du quorum",
          ...lines.slice(0, 4).map((l, i) => `${i + 2}. ${l.slice(0, 80)}`),
          `${Math.min(lines.length, 4) + 2}. Questions diverses`,
          `${Math.min(lines.length, 4) + 3}. Clôture de séance`,
        ];

  const minutesDraft = [
    `Procès-verbal — ${input.meetingTitle}`,
    `Résidence : ${input.residenceName || "Copropriété"}`,
    "",
    "Compte rendu établi à partir de la transcription sauvegardée :",
    "",
    input.transcript.slice(0, 3500),
    "",
    "(Brouillon automatique — à relire avant signature.)",
  ].join("\n");

  return {
    agendaItems,
    decisions: [],
    minutesDraft,
    source: "fallback",
  };
}
