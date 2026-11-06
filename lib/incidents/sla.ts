import { Priority } from "@/types/enums";

/** Délais SLA en heures selon la priorité. */
export const SLA_HOURS: Record<Priority, number> = {
  [Priority.URGENT]: 4,
  [Priority.HIGH]: 24,
  [Priority.MEDIUM]: 72,
  [Priority.LOW]: 168,
};

export function computeSlaDueAt(
  priority: Priority,
  from: Date = new Date()
): Date {
  const hours = SLA_HOURS[priority] ?? SLA_HOURS[Priority.MEDIUM];
  return new Date(from.getTime() + hours * 3600 * 1000);
}

export function isSlaBreached(slaDueAt?: Date | null, now = new Date()): boolean {
  if (!slaDueAt) return false;
  return new Date(slaDueAt).getTime() < now.getTime();
}
