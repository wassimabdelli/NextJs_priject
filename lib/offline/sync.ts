import { getOfflineDB } from "./db";
import type { IncidentDTO, PaymentDTO } from "@/types/api";

type SyncListener = (syncing: boolean, pendingCount: number) => void;
const listeners: Set<SyncListener> = new Set();

export function onSyncChange(listener: SyncListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifySync(syncing: boolean, count: number) {
  listeners.forEach((l) => l(syncing, count));
}

type SessionExpiredListener = (message: string) => void;
const sessionExpiredListeners: Set<SessionExpiredListener> = new Set();

export function onSessionExpired(listener: SessionExpiredListener) {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

export function notifySessionExpired(message = "Session expirée, reconnectez-vous pour synchroniser") {
  sessionExpiredListeners.forEach((l) => l(message));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("syndicpro:session-expired", { detail: { message } }));
  }
}

let isSyncInProgress = false;

/**
 * Rejoue toutes les requêtes en attente dans la file Outbox Dexie.
 * Déclenché lors du retour de connexion, au chargement de l'app ou manuellement.
 */
export async function syncOutbox(): Promise<{ processed: number; errors: number }> {
  if (typeof window === "undefined") return { processed: 0, errors: 0 };
  if (!navigator.onLine) return { processed: 0, errors: 0 };
  if (isSyncInProgress) return { processed: 0, errors: 0 };

  const db = getOfflineDB();
  const { getOfflineSession } = await import("./db");
  const currentSession = await getOfflineSession();

  const pendingItems = await db.outbox
    .where("status")
    .anyOf(["pending", "failed"])
    .sortBy("createdAt");

  if (pendingItems.length === 0) {
    notifySync(false, 0);
    return { processed: 0, errors: 0 };
  }

  isSyncInProgress = true;
  notifySync(true, pendingItems.length);

  let processed = 0;
  let errors = 0;

  for (const item of pendingItems) {
    // Ignore et ne rejoue jamais les éléments dont userId diffère de la session courante
    if (item.userId && (!currentSession?.id || item.userId !== currentSession.id)) {
      continue;
    }

    try {
      await db.outbox.update(item.id, { status: "syncing" });

      const isDelete = item.method === "DELETE";
      const response = await fetch(item.url, {
        method: item.method,
        headers: isDelete ? undefined : { "Content-Type": "application/json" },
        body: isDelete ? undefined : JSON.stringify(item.payload),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));

        // Mise à jour du cache local suite au succès serveur
        if (item.entity === "incident") {
          const serverIncident = data as IncidentDTO;
          await db.incidents.put({
            ...serverIncident,
            pending: false,
          });
        } else if (item.entity === "payment") {
          const payment = data as PaymentDTO;
          // Évite le double comptage : recalcule à partir des données serveur au lieu d'ajouter le montant
          try {
            const chargeRes = await fetch(`/api/charges/${payment.charge}`);
            if (chargeRes.ok) {
              const chargeData = await chargeRes.json();
              const chargeToStore =
                chargeData && typeof chargeData === "object" && "data" in chargeData
                  ? chargeData.data
                  : chargeData;
              if (chargeToStore && chargeToStore._id) {
                await db.charges.put(chargeToStore);
              }
            }
          } catch {
            // Ignorer si échec réseau temporaire
          }
        }

        // Supprime l'élément de la file d'attente
        await db.outbox.delete(item.id);
        processed++;
      } else if (response.status === 401) {
        // Point critique H4 : JWT expiré lors de la synchro
        // On remet l'élément en 'pending' (PAS 'failed') pour qu'aucune donnée ne soit perdue
        await db.outbox.update(item.id, { status: "pending" });
        notifySessionExpired("Session expirée, reconnectez-vous pour synchroniser");
        
        // Redirection vers login avec conservation de la page courante
        const currentPath = window.location.pathname + window.location.search;
        window.location.href = `/login?callbackUrl=${encodeURIComponent(currentPath)}`;
        break; // Arrête la boucle de synchro
      } else {
        const errText = await response.text();
        await db.outbox.update(item.id, {
          status: "failed",
          retries: item.retries + 1,
          error: `Erreur serveur (${response.status}): ${errText.slice(0, 100)}`,
        });
        errors++;
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Erreur réseau";
      await db.outbox.update(item.id, {
        status: "failed",
        retries: item.retries + 1,
        error: errorMsg,
      });
      errors++;
      if (!navigator.onLine) break;
    }
  }

  isSyncInProgress = false;
  const remaining = await db.outbox.where("status").anyOf(["pending", "failed"]).count();
  notifySync(false, remaining);

  return { processed, errors };
}

/**
 * Initialise les écouteurs de reprise de connectivité pour déclencher
 * automatiquement la synchronisation.
 */
export function initAutoSync() {
  if (typeof window === "undefined") return;

  window.addEventListener("online", () => {
    console.log("[Sync] Réseau rétabli, lancement de syncOutbox()...");
    syncOutbox();
  });

  if (navigator.onLine) {
    syncOutbox();
  }
}
