import "server-only";
import { GoogleGenAI, type Part } from "@google/genai";
import { embedTextLocal } from "./local-embeddings";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
const ZHIPU_MODEL = process.env.ZHIPU_MODEL ?? "glm-4-flash";

export type ImagePart = { mimeType: string; data: string };

let client: GoogleGenAI | null = null;

export function isAiEnabled() {
  return Boolean(
    process.env.GEMINI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.ZHIPU_API_KEY
  );
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  client ??= new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 25_000,
      retryOptions: { attempts: 1 },
    },
  });
  return client;
}

export function geminiClient() {
  return getClient();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("AI_TIMEOUT")), ms)
    ),
  ]);
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in AI response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function geminiJson(prompt: string, images: ImagePart[], maxOutputTokens?: number) {
  const parts: Part[] = [{ text: prompt }];
  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }
  const res = await withTimeout(
    getClient().models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
        ...(maxOutputTokens ? { maxOutputTokens } : {}),
      },
    }),
    25_000
  );
  return extractJson(res.text ?? "");
}

async function groqJson(prompt: string) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY missing");
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
      temperature: 0.2,
      messages: [
        { role: "system", content: "Reply with a single valid JSON object only." },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!r.ok) throw new Error(`Groq error ${r.status}`);
  const data = await r.json();
  return extractJson(data.choices?.[0]?.message?.content ?? "");
}

async function zhipuJson(prompt: string): Promise<unknown> {
  const key = process.env.ZHIPU_API_KEY;
  if (!key) throw new Error("ZHIPU_API_KEY missing");
  const response = await fetch(`${ZHIPU_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: ZHIPU_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: "Reply with a single valid JSON object only." },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Zhipu error ${response.status}`);
  const data = await response.json();
  return extractJson(data.choices?.[0]?.message?.content ?? "");
}

export async function generateJsonWithFallback(
  prompt: string,
  images: ImagePart[] = [],
  options: { allowTextFallback?: boolean; maxOutputTokens?: number } = {}
) {
  const allowTextFallback = options.allowTextFallback ?? true;
  if (process.env.GEMINI_API_KEY) {
    try {
      return await geminiJson(prompt, images, options.maxOutputTokens);
    } catch (e) {
      const canFallback = images.length === 0 || allowTextFallback;
      console.warn(canFallback ? "[ai] Gemini failed; trying fallback" : "[ai] Gemini photo analysis failed", e);
      if (!canFallback) {
        const status = typeof e === "object" && e !== null && "status" in e
          ? Number((e as { status?: unknown }).status)
          : 0;
        const message = e instanceof Error ? e.message : "";
        if (status === 429 || /quota|resource.?exhausted|rate.?limit/i.test(message)) throw e;
        throw new Error("AI_UNAVAILABLE");
      }
    }
  }
  if (process.env.GROQ_API_KEY && (images.length === 0 || allowTextFallback)) {
    try {
      return await groqJson(prompt);
    } catch (error) {
      console.warn("[ai] Groq failed; trying Zhipu fallback", error);
    }
  }
  if (process.env.ZHIPU_API_KEY && (images.length === 0 || allowTextFallback)) {
    try {
      return await zhipuJson(prompt);
    } catch (error) {
      console.warn("[ai] Zhipu fallback failed", error);
    }
  }
  throw new Error("AI_UNAVAILABLE");
}

export async function generateJson(
  prompt: string,
  images: ImagePart[] = [],
  options: { allowTextFallback?: boolean } = {}
) {
  return generateJsonWithFallback(prompt, images, options);
}

export async function embedText(text: string): Promise<number[]> {
  // Local embeddings via Transformers.js keep PII off Google's free tier.
  // Model: Xenova/all-MiniLM-L6-v2 (384-dim). First call downloads ~25 MB.
  return embedTextLocal(text);
}
