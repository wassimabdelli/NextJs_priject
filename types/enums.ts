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
  OWNER: "OWNER",
  TENANT: "TENANT",
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
  FLIP: "FLIP",
  D17: "D17",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentValidationStatus = {
  PENDING_VALIDATION: "PENDING_VALIDATION",
  VALIDATED: "VALIDATED",
  REJECTED: "REJECTED",
} as const;
export type PaymentValidationStatus =
  (typeof PaymentValidationStatus)[keyof typeof PaymentValidationStatus];

export const ReminderType = {
  UNPAID_CHARGE: "UNPAID_CHARGE",
  MEETING_TOMORROW: "MEETING_TOMORROW",
  INCIDENT_STATUS: "INCIDENT_STATUS",
  PAYMENT_VALIDATION: "PAYMENT_VALIDATION",
} as const;
export type ReminderType = (typeof ReminderType)[keyof typeof ReminderType];

export const ReminderChannel = {
  IN_APP: "IN_APP",
  WHATSAPP: "WHATSAPP",
  PUSH: "PUSH",
} as const;
export type ReminderChannel = (typeof ReminderChannel)[keyof typeof ReminderChannel];

export const ReminderStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
} as const;
export type ReminderStatus = (typeof ReminderStatus)[keyof typeof ReminderStatus];

export const IncidentTimelineType = {
  CREATED: "CREATED",
  ASSIGNED: "ASSIGNED",
  STATUS: "STATUS",
  PHOTO_BEFORE: "PHOTO_BEFORE",
  PHOTO_AFTER: "PHOTO_AFTER",
  COMMENT: "COMMENT",
  SLA_BREACH: "SLA_BREACH",
} as const;
export type IncidentTimelineType =
  (typeof IncidentTimelineType)[keyof typeof IncidentTimelineType];

export const ExpenseCategory = {
  WATER: "WATER",
  ELECTRICITY: "ELECTRICITY",
  ELEVATOR: "ELEVATOR",
  CLEANING: "CLEANING",
  SECURITY: "SECURITY",
  MAINTENANCE: "MAINTENANCE",
  SUPPLIES: "SUPPLIES",
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

export const ElectionPhase = {
  CANDIDACY: "CANDIDACY",
  VOTING: "VOTING",
  COMPLETED: "COMPLETED",
} as const;
export type ElectionPhase = (typeof ElectionPhase)[keyof typeof ElectionPhase];

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
  FLIP: "Flip",
  D17: "D17",
};

/** Libellés catégories de dépense (alignés UI redesign). */
export const expenseCategoryLabel: Record<ExpenseCategory, string> = {
  WATER: "Eau (SONEDE)",
  ELECTRICITY: "Électricité (STEG)",
  ELEVATOR: "Ascenseur",
  CLEANING: "Nettoyage",
  SECURITY: "Sécurité",
  MAINTENANCE: "Maintenance",
  SUPPLIES: "Fournitures",
  OTHER: "Autres",
};

export const paymentValidationLabel: Record<PaymentValidationStatus, string> = {
  PENDING_VALIDATION: "En attente de validation",
  VALIDATED: "Validé",
  REJECTED: "Rejeté",
};


/* ---------- Annonces avancées (Ikbel) ---------- */

export const AnnouncementCategory = {
  GENERAL: "GENERAL",
  MAINTENANCE: "MAINTENANCE",
  SECURITY: "SECURITY",
  MEETING: "MEETING",
  PAYMENT: "PAYMENT",
  EMERGENCY: "EMERGENCY",
  OTHER: "OTHER",
} as const;
export type AnnouncementCategory =
  (typeof AnnouncementCategory)[keyof typeof AnnouncementCategory];

export const AnnouncementPriority = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;
export type AnnouncementPriority =
  (typeof AnnouncementPriority)[keyof typeof AnnouncementPriority];

export const AnnouncementAudience = {
  RESIDENTS: "RESIDENTS",
  TECHNICIANS: "TECHNICIANS",
  ALL: "ALL",
} as const;
export type AnnouncementAudience =
  (typeof AnnouncementAudience)[keyof typeof AnnouncementAudience];

export const AnnouncementStatus = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;
export type AnnouncementStatus =
  (typeof AnnouncementStatus)[keyof typeof AnnouncementStatus];

export const IntelligenceReviewStatus = {
  DRAFT: "DRAFT",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type IntelligenceReviewStatus =
  (typeof IntelligenceReviewStatus)[keyof typeof IntelligenceReviewStatus];

/* ---------- Ops résidence (Wassim) ---------- */

export const EmployeePosition = {
  GUARD: "GUARD",
  CONCIERGE: "CONCIERGE",
  CLEANER: "CLEANER",
  GARDENER: "GARDENER",
  SECURITY_AGENT: "SECURITY_AGENT",
  TECHNICIAN: "TECHNICIAN",
  OTHER: "OTHER",
} as const;
export type EmployeePosition = (typeof EmployeePosition)[keyof typeof EmployeePosition];

export const ContractType = {
  PERMANENT: "PERMANENT",
  FIXED_TERM: "FIXED_TERM",
  CONTRACTOR: "CONTRACTOR",
  INTERN: "INTERN",
} as const;
export type ContractType = (typeof ContractType)[keyof typeof ContractType];

export const ShiftStatus = {
  PLANNED: "PLANNED",
  DONE: "DONE",
  MISSED: "MISSED",
  CANCELLED: "CANCELLED",
} as const;
export type ShiftStatus = (typeof ShiftStatus)[keyof typeof ShiftStatus];

export const LeaveType = {
  ANNUAL: "ANNUAL",
  SICK: "SICK",
  UNPAID: "UNPAID",
  OTHER: "OTHER",
} as const;
export type LeaveType = (typeof LeaveType)[keyof typeof LeaveType];

export const LeaveStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type LeaveStatus = (typeof LeaveStatus)[keyof typeof LeaveStatus];

export const EquipmentCategory = {
  ELEVATOR: "ELEVATOR",
  PUMP: "PUMP",
  GENERATOR: "GENERATOR",
  ELECTRICAL: "ELECTRICAL",
  PLUMBING: "PLUMBING",
  FIRE_SAFETY: "FIRE_SAFETY",
  ACCESS_CONTROL: "ACCESS_CONTROL",
  CAMERA: "CAMERA",
  GARDEN: "GARDEN",
  OTHER: "OTHER",
} as const;
export type EquipmentCategory = (typeof EquipmentCategory)[keyof typeof EquipmentCategory];

export const EquipmentStatus = {
  OPERATIONAL: "OPERATIONAL",
  BROKEN: "BROKEN",
  UNDER_MAINTENANCE: "UNDER_MAINTENANCE",
  OUT_OF_SERVICE: "OUT_OF_SERVICE",
} as const;
export type EquipmentStatus = (typeof EquipmentStatus)[keyof typeof EquipmentStatus];

export const MaintenanceType = {
  PREVENTIVE: "PREVENTIVE",
  CORRECTIVE: "CORRECTIVE",
} as const;
export type MaintenanceType = (typeof MaintenanceType)[keyof typeof MaintenanceType];

export const MaintenanceStatus = {
  PLANNED: "PLANNED",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type MaintenanceStatus = (typeof MaintenanceStatus)[keyof typeof MaintenanceStatus];

export const StockUnit = {
  PIECE: "PIECE",
  LITER: "LITER",
  KG: "KG",
  BOX: "BOX",
  PACK: "PACK",
} as const;
export type StockUnit = (typeof StockUnit)[keyof typeof StockUnit];

export const StockMovementType = {
  IN: "IN",
  OUT: "OUT",
} as const;
export type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType];

export const reminderTypeLabel: Record<ReminderType, string> = {
  UNPAID_CHARGE: "Charge impayée",
  MEETING_TOMORROW: "Réunion demain",
  INCIDENT_STATUS: "Statut incident",
  PAYMENT_VALIDATION: "Validation paiement",
};
