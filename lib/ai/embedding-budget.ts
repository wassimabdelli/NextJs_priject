import { HttpError } from "@/lib/api";

const hits = new Map<string, number[]>();

export function assertEmbeddingBudget(
  userId: string,
  max = 40,
  windowMs = 60 * 60 * 1000
) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= max) {
    throw new HttpError(429, "Limite d'analyses atteinte. Réessayez plus tard.");
  }
  recent.push(now);
  hits.set(userId, recent);

  if (hits.size > 5000) {
    for (const [id, timestamps] of hits) {
      if (!timestamps.some((timestamp) => now - timestamp < windowMs)) hits.delete(id);
    }
  }
}
