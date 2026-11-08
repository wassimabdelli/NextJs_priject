export type Role = 'Syndic' | 'Copropriétaire' | 'Locataire' | 'Technicien';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  lotId?: string;
  residenceId: string;
  active: boolean;
  registeredDate: string;
}

export interface Residence {
  id: string;
  name: string;
  city: string;
  address: string;
  totalLots: number;
  syndicName: string;
}

export interface ApartmentLot {
  id: string;
  lotNumber: string; // e.g. "A101"
  residenceId: string;
  floor: number;
  surfaceM2: number;
  tantiemes: number; // out of 1000
  occupied: boolean;
  ownerName: string;
  tenantName?: string;
}

export type ChargeStatus = 'Payé' | 'En retard' | 'Partiel';

export interface Charge {
  id: string;
  lotNumber: string;
  period: string; // e.g. "2026-01"
  calledAmount: number;
  paidAmount: number;
  status: ChargeStatus;
  dueDate: string;
  residenceId: string;
}

export type ExpenseCategory =
  | 'WATER'
  | 'ELECTRICITY'
  | 'ELEVATOR'
  | 'CLEANING'
  | 'SECURITY'
  | 'MAINTENANCE'
  | 'OTHER';

export interface Expense {
  id: string;
  description: string;
  residenceName: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  receiptUrl?: string;
}

export type IncidentStatus = 'Signalé' | 'Assigné' | 'En cours' | 'Résolu';
export type IncidentPriority = 'Basse' | 'Moyenne' | 'Haute';

export interface Incident {
  id: string;
  code: string; // e.g. "#277C5A"
  title: string;
  description: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  residenceName: string;
  lotNumber?: string;
  reportedBy: string;
  category: string;
  createdAt: string;
  technician?: {
    name: string;
    phone: string;
  };
}

export type MeetingStatus = 'Planifiée' | 'Ouverte aux votes' | 'Clôturée';

export interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  residenceName: string;
  status: MeetingStatus;
  meetLink?: string;
  agenda: string[];
  attendeeLotIds: string[]; // lots marked present
  transcript?: string;
}

export interface Resolution {
  id: string;
  meetingId: string;
  title: string;
  meetingName: string;
  requiredMajority: number; // e.g. 50% or 66%
  status: 'En attente' | 'Approuvée' | 'Rejetée';
  votesPour: number; // tantièmes
  votesContre: number;
  votesAbstention: number;
}

export interface Ballot {
  id: string;
  resolutionId: string;
  resolutionTitle: string;
  lotNumber: string;
  vote: 'POUR' | 'CONTRE' | 'ABSTENTION';
  tantiemes: number;
  date: string;
}

export interface PaymentReceipt {
  id: string;
  receiptNumber: string; // e.g. "REC-20260114-001"
  lotNumber: string;
  residentName: string;
  amount: number;
  method: 'Virement' | 'Carte' | 'Espèces' | 'Flip' | 'D17';
  date: string;
  referenceNotes?: string;
}

export type DocumentCategory = 'CONTRACT' | 'INVOICE' | 'MINUTES' | 'RULES' | 'OTHER';

export interface DocumentContract {
  id: string;
  title: string;
  residenceName: string;
  category: DocumentCategory;
  date: string;
  fileSize: string;
  downloadUrl?: string;
}


export interface Announcement {
  id: string;
  title: string;
  content: string;
  residenceName: string;
  date: string;
  pinned: boolean;
  author: string;
}

export interface AttachmentRequest {
  id: string;
  residentName: string;
  role: 'Propriétaire' | 'Locataire';
  residenceName: string;
  lotNumber: string;
  email: string;
  status: 'En attente' | 'Approuvée' | 'Refusée';
  requestDate: string;
}

export interface ElectionCandidate {
  id: string;
  name: string;
  lotNumber: string;
  registeredDate: string;
  statement: string;
  votesCount: number;
}
