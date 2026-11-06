import type { Types } from "mongoose";
import { Incident } from "@/models/Incident";
import { IncidentTimelineType } from "@/types/enums";

export async function appendIncidentTimeline(
  incidentId: string | Types.ObjectId,
  entry: {
    type: IncidentTimelineType;
    message: string;
    by?: string | Types.ObjectId | null;
    meta?: Record<string, unknown>;
  }
) {
  await Incident.findByIdAndUpdate(incidentId, {
    $push: {
      timeline: {
        at: new Date(),
        type: entry.type,
        message: entry.message,
        by: entry.by || undefined,
        meta: entry.meta,
      },
    },
  });
}
