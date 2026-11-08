import mongoose from "mongoose";
import { IncidentStatus, Role } from "@/types/enums";

export function canSearchDuplicateResidence(
  role: Role,
  residenceId: string,
  authorizedResidenceIds: string[] | null
) {
  if (role === Role.ADMIN) return true;
  return authorizedResidenceIds?.includes(residenceId) ?? false;
}

export function buildDuplicateCandidateFilter(input: {
  residenceId: string;
  incidentId?: string;
  excludeIds: mongoose.Types.ObjectId[];
}) {
  return {
    residence: new mongoose.Types.ObjectId(input.residenceId),
    reportedAt: {
      $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    },
    status: {
      $ne: IncidentStatus.RESOLVED,
    },
    ...(input.incidentId
      ? {
          _id: {
            $ne: new mongoose.Types.ObjectId(input.incidentId),
            $nin: input.excludeIds,
          },
        }
      : {}),
  };
}
