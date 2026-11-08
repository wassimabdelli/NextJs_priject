import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

type EvalItem = {
  title: string;
  description: string;
  category: string;
  priority: string;
};

type EvalPair = {
  a: { title: string; description: string };
  b: { title: string; description: string };
  duplicate: boolean;
};

type EvalDataset = { items: EvalItem[]; pairs: EvalPair[] };

const WORKER_FLAG = "SYNDICPRO_EVAL_AI_WORKER";
const dataset = JSON.parse(
  fs.readFileSync(new URL("./eval-dataset.json", import.meta.url), "utf8")
) as EvalDataset;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function runWorker() {
  const child = spawnSync(
    process.execPath,
    ["--conditions=react-server", "--import", "tsx", fileURLToPath(import.meta.url)],
    {
      env: { ...process.env, [WORKER_FLAG]: "true" },
      stdio: "inherit",
    }
  );
  if (child.error) throw child.error;
  if (child.status !== 0) process.exitCode = child.status ?? 1;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for triage and embedding evaluation");
  }

  const [{ triageIncident }, { embedText }, { cosine }, { similarityScore }] =
    await Promise.all([
      import("../lib/ai/triage"),
      import("../lib/ai/gemini"),
      import("../lib/ai/similarity"),
      import("../lib/ai/duplicate-detector"),
    ]);

  let okCat = 0;
  let okPrio = 0;
  let n = 0;
  const confusion: Record<string, Record<string, number>> = {};

  for (const item of dataset.items) {
    const result = await triageIncident({
      title: item.title,
      description: item.description,
    });
    n++;
    if (result.category === item.category) okCat++;
    if (result.priority === item.priority) okPrio++;
    confusion[item.category] ??= {};
    confusion[item.category][result.category] =
      (confusion[item.category][result.category] ?? 0) + 1;
    await sleep(4500);
  }

  console.log(
    `Category accuracy: ${okCat}/${n} (${((okCat / n) * 100).toFixed(1)}%)`
  );
  console.log(
    `Priority accuracy: ${okPrio}/${n} (${((okPrio / n) * 100).toFixed(1)}%)`
  );
  console.table(confusion);

  const rows: { dup: boolean; lex: number; emb: number }[] = [];
  for (const pair of dataset.pairs) {
    const textA = `${pair.a.title}. ${pair.a.description}`;
    const textB = `${pair.b.title}. ${pair.b.description}`;
    const embeddingA = await embedText(textA);
    const embeddingB = await embedText(textB);
    rows.push({
      dup: pair.duplicate,
      lex: similarityScore(textA, textB),
      emb: cosine(embeddingA, embeddingB),
    });
    await sleep(4500);
  }

  for (const [name, key, thresholds] of [
    ["Lexical (Jaccard)", "lex", [0.2, 0.3, 0.4, 0.5]],
    ["Embeddings (cosine)", "emb", [0.7, 0.75, 0.8, 0.85]],
  ] as const) {
    for (const threshold of thresholds) {
      const correct = rows.filter(
        (row) => (row[key] >= threshold) === row.dup
      ).length;
      console.log(`${name} threshold ${threshold}: ${correct}/${rows.length} correct`);
    }
  }

  fs.writeFileSync(
    new URL("./eval-results.json", import.meta.url),
    JSON.stringify(rows, null, 2)
  );
}

if (process.env[WORKER_FLAG] !== "true") {
  runWorker();
} else {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
