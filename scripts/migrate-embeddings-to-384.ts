import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_FLAG = "SYNDICPRO_EMBEDDING_MIGRATION_WORKER";
const BATCH_SIZE = 20;

async function migrate() {
  const [{ connectDB }, { Incident }, { embedTextLocal }, { incidentText }, mongoose] =
    await Promise.all([
      import("@/lib/db"),
      import("@/models/Incident"),
      import("@/lib/ai/local-embeddings"),
      import("@/lib/ai/similarity"),
      import("mongoose"),
    ]);

  await connectDB();
  let updated = 0;
  let failed = 0;
  let operations: Array<{
    updateOne: {
      filter: { _id: unknown };
      update: { $set: { embedding: number[] } };
    };
  }> = [];
  let operationIds: unknown[] = [];

  async function flushBatch() {
    if (operations.length === 0) return;
    const batch = operations;
    const ids = operationIds;
    operations = [];
    operationIds = [];

    try {
      const result = await Incident.bulkWrite(batch, { ordered: false });
      updated += result.modifiedCount;
      failed += batch.length - result.modifiedCount;
    } catch (error) {
      console.error("[ai] embedding migration batch write failed; retrying individually", error);
      for (let index = 0; index < batch.length; index += 1) {
        try {
          const result = await Incident.updateOne(
            { _id: ids[index] },
            batch[index].updateOne.update
          );
          if (result.matchedCount > 0) updated += 1;
          else failed += 1;
        } catch (individualError) {
          failed += 1;
          console.error(`[ai] embedding migration write failed for ${String(ids[index])}`, individualError);
        }
      }
    }
    console.info(`[ai] embedding migration progress: ${updated} updated, ${failed} failed`);
  }

  try {
    const cursor = Incident.find({ embedding: { $size: 768 } })
      .select("+embedding title description")
      .lean()
      .cursor();

    for await (const incident of cursor) {
      try {
        const embedding = await embedTextLocal(incidentText(incident));
        operations.push({
          updateOne: {
            filter: { _id: incident._id },
            update: { $set: { embedding } },
          },
        });
        operationIds.push(incident._id);
      } catch (error) {
        failed += 1;
        console.error(`[ai] embedding migration failed for ${String(incident._id)}`, error);
      }

      if (operations.length >= BATCH_SIZE) await flushBatch();
    }

    await flushBatch();
    console.info(`[ai] embedding migration complete: ${updated} updated, ${failed} failed`);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.env[WORKER_FLAG] !== "true") {
  const args = ["--conditions=react-server"];
  const envFile = resolve(".env.local");
  if (existsSync(envFile)) args.push(`--env-file=${envFile}`);
  args.push("--import", "tsx", fileURLToPath(import.meta.url));

  const child = spawnSync(process.execPath, args, {
    env: { ...process.env, [WORKER_FLAG]: "true" },
    stdio: "inherit",
  });
  if (child.error) throw child.error;
  if (child.status !== 0) process.exitCode = child.status ?? 1;
} else {
  void migrate().catch((error: unknown) => {
    console.error("[ai] embedding migration failed", error);
    process.exitCode = 1;
  });
}
