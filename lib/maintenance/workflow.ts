import { MaintenanceStatus } from "@/types/enums";

/**
 * Transitions autorisées pour le statut d'une intervention de maintenance.
 * Le passage direct de PLANNED à DONE est autorisé pour la clôture hors ligne.
 */
export const MAINTENANCE_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  [MaintenanceStatus.PLANNED]: [
    MaintenanceStatus.IN_PROGRESS,
    MaintenanceStatus.DONE,
    MaintenanceStatus.CANCELLED,
  ],
  [MaintenanceStatus.IN_PROGRESS]: [
    MaintenanceStatus.DONE,
    MaintenanceStatus.CANCELLED,
  ],
  [MaintenanceStatus.DONE]: [],
  [MaintenanceStatus.CANCELLED]: [],
};

export function canTransitionMaintenance(
  from: MaintenanceStatus,
  to: MaintenanceStatus
): boolean {
  return MAINTENANCE_TRANSITIONS[from]?.includes(to) ?? false;
}

export const OPEN_MAINTENANCE_STATUSES: MaintenanceStatus[] = [
  MaintenanceStatus.PLANNED,
  MaintenanceStatus.IN_PROGRESS,
];

/**
 * Calcule la prochaine date d'entretien périodique.
 * Renvoie null si la date de base est absente/invalide ou si l'intervalle est absent ou <= 0.
 */
export function computeNextMaintenanceDate(
  base: Date | string | null | undefined,
  intervalDays: number | null | undefined
): Date | null {
  if (!base || !intervalDays || intervalDays <= 0) return null;
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + intervalDays);
  return d;
}
