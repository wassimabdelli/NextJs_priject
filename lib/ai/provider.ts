import { createHash } from "crypto";
import type { ZodType } from "zod";
import { HttpError } from "@/lib/api";
import { GEMINI_MODEL, generateJsonWithFallback, geminiClient } from "./gemini";

type CacheEntry = { expiresAt: number; value: unknown };
const cache = new Map<string, CacheEntry>();
const usage = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 30;

function assertUsageAllowed(userId: string) {
  const now = Date.now();
  const recent = (usage.get(userId) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_HOUR) {
    throw new HttpError(429, "Limite d'utilisation IA atteinte. Réessayez plus tard.");
  }
  recent.push(now);
  if (usage.size > 5000) {
    for (const [id, timestamps] of usage) {
      if (!timestamps.some((timestamp) => now - timestamp < WINDOW_MS)) usage.delete(id);
    }
  }
  usage.set(userId, recent);
}

function friendlyProviderError(error: unknown): HttpError {
  const message = error instanceof Error ? error.message : "";
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : 0;
  if (status === 429 || /quota|rate.?limit|resource.?exhausted/i.test(message)) {
    return new HttpError(429, "Limite d'utilisation IA atteinte. Réessayez plus tard.");
  }
  if (message === "AI_UNAVAILABLE" || /not configured/i.test(message)) {
    return new HttpError(503, "Aucun fournisseur IA configuré ou disponible. Vérifiez les clés côté serveur.");
  }
  if (/timeout|timed out|abort/i.test(message)) return new HttpError(504, "Aucun fournisseur IA ne répond à temps. Réessayez.");
  if (status === 400 || status === 404 || /model.*not found|unsupported model/i.test(message)) {
    return new HttpError(503, "Le modèle IA configuré est indisponible. Vérifiez les modèles et clés côté serveur.");
  }
  return new HttpError(502, "Les fournisseurs IA sont temporairement indisponibles. Vos données n'ont pas été modifiées.");
}

export async function generateValidated<T>(
  userId: string,
  operation: string,
  schema: ZodType<T>,
  prompt: string,
  options: { maxOutputTokens?: number } = {}
): Promise<T> {
  const key = createHash("sha256").update(`${operation}:${prompt}`).digest("hex");
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return schema.parse(cached.value);
  assertUsageAllowed(userId);

  try {
    const value = await generateJsonWithFallback(prompt, [], {
      maxOutputTokens: options.maxOutputTokens ?? 1400,
    });
    const result = schema.parse(value);
    if (cache.size > 400) {
      for (const [cacheKey, entry] of cache) if (entry.expiresAt <= Date.now()) cache.delete(cacheKey);
      if (cache.size > 400) cache.delete(cache.keys().next().value as string);
    }
    cache.set(key, { value: result, expiresAt: Date.now() + 5 * 60 * 1000 });
    return result;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && (error.name === "ZodError" || error instanceof SyntaxError)) {
      throw new HttpError(502, "Réponse IA invalide. Réessayez sans appliquer de suggestion.");
    }
    throw friendlyProviderError(error);
  }
}

export async function generatePlainText(userId: string, operation: string, prompt: string) {
  const key = createHash("sha256").update(`${operation}:${prompt}`).digest("hex");
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now() && typeof cached.value === "string") return cached.value;
  assertUsageAllowed(userId);
  try {
    const response = await geminiClient().models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { temperature: 0.3, maxOutputTokens: 1000 },
    });
    const value = response.text?.trim();
    if (!value) throw new HttpError(502, "Gemini a renvoyé une réponse vide.");
    if (cache.size > 400) cache.delete(cache.keys().next().value as string);
    cache.set(key, { value, expiresAt: Date.now() + 5 * 60 * 1000 });
    return value.slice(0, 3000);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw friendlyProviderError(error);
  }
}
