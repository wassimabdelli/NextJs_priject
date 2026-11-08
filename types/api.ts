/**
 * Types des réponses JSON de l'API (côté client).
 * Les ObjectId et les dates arrivent sérialisés en string.
 */
import type {
  ChargeStatus,
  AnnouncementAudience,
  AnnouncementCategory,
  AnnouncementPriority,
  AnnouncementStatus,
  IncidentCategory,
  IncidentStatus,
  PaymentMethod,
  Priority,
} from "./enums";

export interface ResidenceStats {
  period: string;
  collectionRate: number;
  payments: number;
  expenses: number;
  balance: number;
  openIncidents: number;
}

export interface ResidenceDTO {
  _id: string;
  name: string;
  address: string;
  city: string;
  floors: number;
  totalApartments: number;
  syndic?: string;
  stats?: ResidenceStats;
}

export interface ApartmentDTO {
  _id: string;
  residence: string;
  number: string;
  floor: number;
  surface: number;
  shares: number;
  isOccupied: boolean;
  owner?: string;
  resident?: string | { _id: string; fullName: string };
  residentUser?: string | { _id: string; name: string } | null;
}

export interface ChargeDTO {
  _id: string;
  apartment: { _id: string; number: string; floor: number } | string;
  period: string;
  amount: number;
  paidAmount: number;
  remaining: number;
  dueDate: string;
  status: ChargeStatus;
}

export interface PaymentDTO {
  _id: string;
  charge: string;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  receiptNumber: string;
  clientId?: string;
  syncedAt?: string;
  /** true pour une réponse optimiste générée hors ligne */
  createdOffline?: boolean;
}

export interface IncidentDTO {
  _id: string;
  residence: string;
  apartment?: { _id: string; number: string; floor?: number } | string;
  reportedBy?: { _id: string; name: string; email?: string } | string;
  assignedTo?: { _id: string; name: string; email?: string; phone?: string } | string;
  title: string;
  description: string;
  category: IncidentCategory;
  photos: string[];
  priority: Priority;
  status: IncidentStatus;
  reportedAt: string;
  resolvedAt?: string;
  resolutionDescription?: string;
  resolutionPhotos: string[];
  resolutionSubmittedAt?: string;
  resolutionConfirmedAt?: string;
  resolutionRejectedAt?: string;
  resolutionFeedback?: string;
  aiTriage?: {
    category?: string;
    priority?: string;
    specialty?: string;
    probableCause?: string;
    safetyRisk?: boolean;
    confidence?: number;
    model?: string;
  };
  aiResolutionCheck?: {
    verdict?: string;
    explanation?: string;
    confidence?: number;
    checkedAt?: string;
  };
  createdOffline: boolean;
  clientId?: string;
  /** Côté client uniquement : incident encore dans la file d'attente */
  pending?: boolean;
}

export interface AnnouncementDTO {
  _id: string;
  residence: string | { _id: string; name: string; city?: string };
  author?: { _id: string; name: string } | string;
  title: string;
  content: string;
  publishedAt: string;
  isPinned: boolean;
  category?: AnnouncementCategory;
  priority?: AnnouncementPriority;
  audience?: AnnouncementAudience;
  status?: AnnouncementStatus;
  scheduledAt?: string | null;
  expiresAt?: string | null;
  attachments?: Array<{ name: string; url: string; mimeType: string; size: number }>;
  isRead?: boolean;
  readStats?: {
    totalEligibleResidents: number;
    readCount: number;
    unreadCount: number;
    readPercentage: number;
  };
}

export interface DocumentDTO {
  _id: string;
  residence: string;
  title: string;
  type: string;
  fileUrl: string;
  uploadedAt: string;
}

export interface ExpenseDTO {
  _id: string;
  residence: { _id: string; name: string } | string;
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  proofUrl?: string;
}

export interface MeetingDTO {
  _id: string;
  residence: { _id: string; name: string; city?: string } | string;
  title: string;
  date: string;
  location?: string;
  agenda?: string;
  status: string;
  createdAt?: string;
}

export interface ResolutionDTO {
  _id: string;
  meeting: { _id: string; title: string; date?: string; status?: string } | string;
  title: string;
  description?: string;
  requiredMajority: number;
  createdAt?: string;
}

export interface VoteDTO {
  _id: string;
  resolution: { _id: string; title: string } | string;
  apartment: { _id: string; number: string; shares?: number } | string;
  voter?: { _id: string; name: string; email: string } | string;
  choice: "FOR" | "AGAINST" | "ABSTAIN";
  weight: number;
  votedAt: string;
}

export interface UserDTO {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  residence?: string | { _id: string; name: string };
  role: "ADMIN" | "SYNDIC" | "RESIDENT" | "TECHNICIAN";
  isActive: boolean;
  createdAt?: string;
}
