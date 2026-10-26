/**
 * Énumérations métier de SyndicPro.
 * Pattern "as const" : un seul objet sert de source de vérité pour
 * Mongoose (enum: Object.values(X)), Zod (z.enum(values(X))) et l'UI (libellés).
 */

/** Renvoie les valeurs d'un enum sous forme de tuple non vide (requis par z.enum). */
export function values<T extends Record<string, string>>(e: T) {
  return Object.values(e) as [T[keyof T], ...T[keyof T][]];
}

export const Role = {
  ADMIN: "ADMIN",
  SYNDIC: "SYNDIC",
  RESIDENT: "RESIDENT",
  TECHNICIAN: "TECHNICIAN",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ResidentType = {
  OWNER: "OWNER",
  TENANT: "TENANT",
} as const;
export type ResidentType = (typeof ResidentType)[keyof typeof ResidentType];

export const ChargeStatus = {
  PENDING: "PENDING",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
} as const;
export type ChargeStatus = (typeof ChargeStatus)[keyof typeof ChargeStatus];

export const PaymentMethod = {
  CASH: "CASH",
  BANK_TRANSFER: "BANK_TRANSFER",
  CHEQUE: "CHEQUE",
  CARD: "CARD",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const ExpenseCategory = {
  WATER: "WATER",
  ELECTRICITY: "ELECTRICITY",
  ELEVATOR: "ELEVATOR",
  CLEANING: "CLEANING",
  SECURITY: "SECURITY",
  MAINTENANCE: "MAINTENANCE",
  OTHER: "OTHER",
} as const;
export type ExpenseCategory = (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

export const IncidentCategory = {
  PLUMBING: "PLUMBING",
  ELECTRICITY: "ELECTRICITY",
  ELEVATOR: "ELEVATOR",
  CLEANING: "CLEANING",
  SECURITY: "SECURITY",
  OTHER: "OTHER",
} as const;
export type IncidentCategory = (typeof IncidentCategory)[keyof typeof IncidentCategory];

export const Priority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const IncidentStatus = {
  REPORTED: "REPORTED",
  ASSIGNED: "ASSIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
} as const;
export type IncidentStatus = (typeof IncidentStatus)[keyof typeof IncidentStatus];

export const MeetingStatus = {
  PLANNED: "PLANNED",
  OPEN: "OPEN",
  CLOSED: "CLOSED",
} as const;
export type MeetingStatus = (typeof MeetingStatus)[keyof typeof MeetingStatus];

export const VoteChoice = {
  FOR: "FOR",
  AGAINST: "AGAINST",
  ABSTAIN: "ABSTAIN",
} as const;
export type VoteChoice = (typeof VoteChoice)[keyof typeof VoteChoice];

export const DocumentType = {
  MINUTES: "MINUTES",
  RULES: "RULES",
  CONTRACT: "CONTRACT",
  INVOICE: "INVOICE",
  OTHER: "OTHER",
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

/* ---------- Libellés français pour l'UI ---------- */

export const chargeStatusLabel: Record<ChargeStatus, string> = {
  PENDING: "En attente",
  PARTIAL: "Partiel",
  PAID: "Payé",
  OVERDUE: "En retard",
};

export const incidentStatusLabel: Record<IncidentStatus, string> = {
  REPORTED: "Signalé",
  ASSIGNED: "Assigné",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolu",
};

export const incidentCategoryLabel: Record<IncidentCategory, string> = {
  PLUMBING: "Plomberie",
  ELECTRICITY: "Électricité",
  ELEVATOR: "Ascenseur",
  CLEANING: "Nettoyage",
  SECURITY: "Sécurité",
  OTHER: "Autre",
};

export const priorityLabel: Record<Priority, string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  URGENT: "Urgente",
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  CASH: "Espèces",
  BANK_TRANSFER: "Virement",
  CHEQUE: "Chèque",
  CARD: "Carte",
};
