import { IncidentStatus } from "@/types/enums";

/**
 * Workflow strict des incidents (partagé client / serveur, sans dépendance serveur) :
 * REPORTED -> ASSIGNED -> IN_PROGRESS -> RESOLVED
 */
export const INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  [IncidentStatus.REPORTED]: [IncidentStatus.ASSIGNED],
  [IncidentStatus.ASSIGNED]: [IncidentStatus.IN_PROGRESS],
  [IncidentStatus.IN_PROGRESS]: [IncidentStatus.RESOLVED],
  [IncidentStatus.RESOLVED]: [],
};

/** Vrai si la transition from -> to est autorisée par le workflow. */
export function canTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  return INCIDENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statut suivant dans le workflow (null si terminal). */
export function nextIncidentStatus(from: IncidentStatus): IncidentStatus | null {
  return INCIDENT_TRANSITIONS[from]?.[0] ?? null;
}
