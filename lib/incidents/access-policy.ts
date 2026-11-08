import { Role } from "@/types/enums";

export const INCIDENT_READ_ROLES = [
  Role.ADMIN,
  Role.SYNDIC,
  Role.RESIDENT,
  Role.TECHNICIAN,
] as const;

export const INCIDENT_CREATE_ROLES = [
  Role.ADMIN,
  Role.SYNDIC,
  Role.RESIDENT,
] as const;

export const INCIDENT_WORKFLOW_ROLES = [
  Role.ADMIN,
  Role.SYNDIC,
  Role.TECHNICIAN,
] as const;

export const INCIDENT_RESOLUTION_SUBMISSION_ROLES = [
  Role.ADMIN,
  Role.SYNDIC,
  Role.TECHNICIAN,
] as const;

export function technicianIncidentScope(userId: string) {
  return { assignedTo: userId };
}

export function isResidenceManagedBySyndic(
  residenceId: string,
  managedResidenceIds: string[]
) {
  return managedResidenceIds.includes(residenceId);
}
