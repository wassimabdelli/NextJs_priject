import { createHash } from "crypto";

const DIMENSION = 384;
const CACHE_LIMIT = 2000;
const cache = new Map<string, number[]>();

function computeHashEmbedding(text: string): number[] {
  const vector = new Float64Array(DIMENSION);
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9\u0600-\u06ff]+/)
    .filter(Boolean);

  const tokens: string[] = [...words];
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(`${words[i]}_${words[i + 1]}`);
  }
  for (const w of words) {
    for (let i = 0; i + 3 <= w.length; i++) {
      tokens.push(w.slice(i, i + 3));
    }
  }

  if (tokens.length === 0) tokens.push(text.slice(0, 32));

  for (const token of tokens) {
    const digest = createHash("sha256").update(token).digest();
    for (let j = 0; j < 4; j++) {
      const idx = digest.readUInt16BE(j * 2) % DIMENSION;
      const sign = (digest[8 + j] & 1) === 0 ? 1 : -1;
      vector[idx] += sign;
    }
  }

  let norm = 0;
  for (let i = 0; i < DIMENSION; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm) || 1;
  return Array.from(vector, (v) => v / norm);
}

export async function embedTextLocal(text: string): Promise<number[]> {
  const normalized = text.trim().slice(0, 4000);
  if (!normalized) throw new Error("Embedding text cannot be empty");

  const hit = cache.get(normalized);
  if (hit) return hit;

  const values = computeHashEmbedding(normalized);
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(normalized, values);
  return values;
}

export const LOCAL_EMBEDDING_DIM = DIMENSION;
