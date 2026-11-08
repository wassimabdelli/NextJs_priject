import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const WORKER_FLAG = "SYNDICPRO_EMBEDDING_BACKFILL_WORKER";

async function backfill() {
  const [{ connectDB }, { Incident }, { computeAndStoreEmbedding }, mongoose] =
    await Promise.all([
      import("@/lib/db"),
      import("@/models/Incident"),
      import("@/lib/ai/similarity"),
      import("mongoose"),
    ]);

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required to generate incident embeddings");
  }

  await connectDB();
  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const cursor = Incident.find({
      reportedAt: { $gte: since },
      $or: [
        { embedding: { $exists: false } },
        { embedding: null },
        { embedding: { $size: 0 } },
      ],
    })
      .select("title description")
      .sort({ reportedAt: 1 })
      .lean()
      .cursor();

    let processed = 0;
    for await (const incident of cursor) {
      if (processed > 0) await new Promise((resolve) => setTimeout(resolve, 4500));
      await computeAndStoreEmbedding(String(incident._id), {
        title: incident.title,
        description: incident.description,
      });
      processed += 1;
      console.info(`[ai] embedding backfill ${processed}: ${String(incident._id)}`);
    }

    console.info(`[ai] embedding backfill complete: ${processed} incident(s) processed`);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.env[WORKER_FLAG] !== "true") {
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
} else {
  void backfill().catch((error: unknown) => {
    console.error("[ai] embedding backfill failed", error);
    process.exitCode = 1;
  });
}
