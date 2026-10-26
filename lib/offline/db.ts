import Dexie, { type Table } from "dexie";
import type {
  ResidenceDTO,
  ApartmentDTO,
  ChargeDTO,
  AnnouncementDTO,
  IncidentDTO,
  DocumentDTO,
} from "@/types/api";
import { Role } from "@/types/enums";

export interface OfflineSessionProfile {
  id: string; // userId
  name: string;
  email: string;
  role: Role;
  expiresAt: number; // timestamp ms
}

export interface OutboxItem {
  id: string; // uuid = clientId
  userId?: string; // id de l'utilisateur ayant émis la requête
  entity: "incident" | "payment" | "charge" | "announcement" | "residence" | "apartment" | "document";
  method: "POST" | "PATCH" | "DELETE";
  url: string;
  payload: Record<string, unknown>;
  createdAt: string;
  status: "pending" | "syncing" | "failed";
  retries: number;
  error?: string;
}

export class SyndicProDatabase extends Dexie {
  residences!: Table<ResidenceDTO, string>;
  apartments!: Table<ApartmentDTO, string>;
  charges!: Table<ChargeDTO, string>;
  announcements!: Table<AnnouncementDTO, string>;
  incidents!: Table<IncidentDTO, string>;
  documents!: Table<DocumentDTO, string>;
  outbox!: Table<OutboxItem, string>;
  session!: Table<OfflineSessionProfile, string>;
  dashboard!: Table<{ id: string; data: any; updatedAt: string }, string>;

  constructor() {
    super("SyndicProDB");
    this.version(1).stores({
      residences: "_id",
      apartments: "_id, residence",
      charges: "_id, apartment, period, status",
      announcements: "_id, residence, isPinned, publishedAt",
      incidents: "_id, residence, status, clientId, reportedAt",
      documents: "_id, residence, type",
      outbox: "id, status, createdAt, entity",
    });
    this.version(2).stores({
      outbox: "id, status, createdAt, entity, userId",
      session: "id",
    });
    this.version(3).stores({
      dashboard: "id",
    });
  }
}


// Instance singleton utilisable côté client uniquement
let dbInstance: SyndicProDatabase | null = null;

export function getOfflineDB(): SyndicProDatabase {
  if (typeof window === "undefined") {
    // Si appelé côté serveur (SSR), on retourne un proxy vide sécurisé
    return new Proxy({} as SyndicProDatabase, {
      get() {
        return undefined;
      },
    });
  }
  if (!dbInstance) {
    dbInstance = new SyndicProDatabase();
  }
  return dbInstance;
}

/**
 * Enregistre le profil utilisateur dans Dexie à la connexion réussie.
 */
export async function saveOfflineSession(profile: OfflineSessionProfile): Promise<void> {
  const db = getOfflineDB();
  if (db.session) {
    await db.session.put(profile);
  }
}

/**
 * Récupère le profil utilisateur actif en cache Dexie (utile en mode hors-ligne).
 */
export async function getOfflineSession(): Promise<OfflineSessionProfile | undefined> {
  const db = getOfflineDB();
  if (!db.session) return undefined;
  const sessions = await db.session.toArray();
  const session = sessions[0];
  if (!session) return undefined;
  // Vérifie si la session offline a expiré
  if (session.expiresAt && session.expiresAt < Date.now()) {
    await db.session.clear();
    return undefined;
  }
  return session;
}

/**
 * Supprime la session offline lors de la déconnexion.
 */
export async function clearOfflineSession(): Promise<void> {
  const db = getOfflineDB();
  if (db.session) {
    await db.session.clear();
  }
}

/**
 * Vide TOUTES les tables Dexie (données, session, dashboard, et optionnellement outbox).
 */
export async function clearAllOfflineData(clearOutbox = true): Promise<void> {
  const db = getOfflineDB();
  const tasks: Promise<void>[] = [];
  if (db.residences) tasks.push(db.residences.clear());
  if (db.apartments) tasks.push(db.apartments.clear());
  if (db.charges) tasks.push(db.charges.clear());
  if (db.announcements) tasks.push(db.announcements.clear());
  if (db.incidents) tasks.push(db.incidents.clear());
  if (db.documents) tasks.push(db.documents.clear());
  if (db.session) tasks.push(db.session.clear());
  if (db.dashboard) tasks.push(db.dashboard.clear());
  if (clearOutbox && db.outbox) tasks.push(db.outbox.clear());
  await Promise.all(tasks);
}
