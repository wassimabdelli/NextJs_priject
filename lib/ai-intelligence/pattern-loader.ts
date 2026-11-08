import mongoose from "mongoose";
import { HttpError } from "@/lib/api";
import type { IntelligenceResidenceScope } from "./access";
import { residenceScopeFilter } from "./access";
import {
  detectRecurringProblems,
  toIntelligenceIncident,
  type PopulatedIntelligenceIncident,
} from "./analysis";
import { Incident } from "@/models/Incident";

export async function loadVerifiedRecurringPattern(
  input: { residenceId: string; patternId: string; incidentIds: string[] },
  scope: IntelligenceResidenceScope
) {
  if (scope && !scope.includes(input.residenceId)) {
    throw new HttpError(403, "Vous ne gérez pas cette résidence");
  }
  const uniqueIds = [...new Set(input.incidentIds)];
  if (uniqueIds.length !== input.incidentIds.length) {
    throw new HttpError(400, "La liste contient des réclamations en double");
  }
  const residenceId = new mongoose.Types.ObjectId(input.residenceId);
  const rows = await Incident.find({
    _id: { $in: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)) },
    residence: residenceId,
    ...residenceScopeFilter(scope),
  })
    .select("+embedding title description category priority status reportedAt residence apartment relatedIncidents")
    .populate({ path: "residence", select: "name" })
    .populate({ path: "apartment", select: "number floor" })
    .lean();
  if (rows.length !== uniqueIds.length) {
    throw new HttpError(404, "Réclamations introuvables dans votre périmètre");
  }
  const incidents = rows.map((row) => toIntelligenceIncident(row as unknown as PopulatedIntelligenceIncident));
  const pattern = detectRecurringProblems(incidents).find((candidate) =>
    candidate.id === input.patternId
    && candidate.incidentIds.length === uniqueIds.length
    && candidate.incidentIds.every((id) => uniqueIds.includes(id))
  );
  if (!pattern) {
    throw new HttpError(409, "Le groupe n'est plus reconnu comme un rapprochement textuel suffisant.");
  }
  return { incidents, pattern, residenceId };
}
