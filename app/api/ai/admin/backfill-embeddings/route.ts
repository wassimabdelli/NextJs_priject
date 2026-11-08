import { json } from "@/lib/api";
import { withAuth } from "@/lib/auth-guard";
import { embedText } from "@/lib/ai/gemini";
import { incidentText } from "@/lib/ai/similarity";
import { Incident } from "@/models/Incident";
import { Role } from "@/types/enums";

const BATCH = 20;
const missing = { $or: [{ embedding: { $exists: false } }, { embedding: { $size: 0 } }] };

export const POST = withAuth(
  async () => {
    const rows = await Incident.find(missing).select("title description").limit(BATCH).lean();
    let done = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const vector = await embedText(incidentText(row));
        await Incident.updateOne({ _id: row._id }, { $set: { embedding: vector } });
        done += 1;
      } catch {
        failed += 1;
      }
    }
    const remaining = await Incident.countDocuments(missing);
    return json({ processed: done, failed, remaining });
  },
  { roles: [Role.ADMIN] }
);
