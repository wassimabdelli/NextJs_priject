import { IncidentHistory } from "@/models/IncidentHistory";
import type { Types } from "mongoose";
import type { IncidentHistoryAction } from "@/models/IncidentHistory";

interface RecordHistoryInput {
  incidentId: string | Types.ObjectId;
  actorId: string | Types.ObjectId;
  action: IncidentHistoryAction;
  description: string;
  oldValue?: string;
  newValue?: string;
}

export async function recordIncidentHistory(input: RecordHistoryInput) {
  return IncidentHistory.create({
    incident: input.incidentId,
    actor: input.actorId,
    action: input.action,
    description: input.description,
    oldValue: input.oldValue,
    newValue: input.newValue,
  });
}
