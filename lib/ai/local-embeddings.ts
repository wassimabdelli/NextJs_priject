import "server-only";
import type { FeatureExtractionPipeline } from "@xenova/transformers";

const MODEL = "Xenova/all-MiniLM-L6-v2";
const DIMENSION = 384;
const CACHE_LIMIT = 2000;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;
const cache = new Map<string, number[]>();

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, env } = await import("@xenova/transformers");
      env.allowLocalModels = false;
      env.useBrowserCache = false;
      return pipeline("feature-extraction", MODEL);
    })().catch((error: unknown) => {
      pipelinePromise = null;
      throw error;
    });
  }
  return pipelinePromise;
}

export async function embedTextLocal(text: string): Promise<number[]> {
  const normalized = text.trim().slice(0, 4000);
  if (!normalized) throw new Error("Embedding text cannot be empty");

  const hit = cache.get(normalized);
  if (hit) return hit;

  const extractor = await getExtractor();
  const output = await extractor(normalized, { pooling: "mean", normalize: true });
  const values = Array.from(output.data);
  if (values.length !== DIMENSION) {
    throw new Error(`Expected ${DIMENSION}-dim, got ${values.length}`);
  }

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(normalized, values);
  return values;
}

export const LOCAL_EMBEDDING_DIM = DIMENSION;
