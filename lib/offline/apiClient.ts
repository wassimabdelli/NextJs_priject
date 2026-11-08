import { getOfflineDB } from "./db";
import type {
  ResidenceDTO,
  ApartmentDTO,
  ChargeDTO,
  IncidentDTO,
  AnnouncementDTO,
  DocumentDTO,
  PaymentDTO,
} from "@/types/api";

interface FetchOptions extends RequestInit {
  entity?: "residence" | "apartment" | "charge" | "incident" | "announcement" | "payment" | "document";
  offlineFallbackData?: unknown;
}

/**
 * Client HTTP : Fonctionnement 100% standard en ligne, avec repli automatique
 * uniquement si la connexion internet est coupée.
 */
export async function fetchWithOffline<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const db = getOfflineDB();

  const isActuallyOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  // -------------------------------------------------------------
  // 1. REQUÊTES EN LECTURE (GET)
  // -------------------------------------------------------------
  if (method === "GET") {
    // Si on a du réseau : appel direct au serveur comme un site normal
    if (isActuallyOnline) {
      try {
        const res = await fetch(url, options);
        if (res.ok) {
          const data = (await res.json()) as T;
          // Mise en cache asynchrone en arrière-plan sans bloquer
          cacheGetResult(url, data).catch(() => {});
          return data;
        }
        // Si le serveur a répondu (ex: 400 ou 500), on remonte l'erreur sans basculer sur le offline
        const errorText = await res.text();
        throw new Error(`Erreur serveur (${res.status}): ${errorText}`);
      } catch (networkError: unknown) {
        // Seulement si c'est une VRAIE erreur de coupure réseau (ex: Failed to fetch)
        if (
          !navigator.onLine ||
          (networkError instanceof TypeError && networkError.message.includes("fetch"))
        ) {
          console.warn("[ApiClient] Connexion réseau perdue, passage automatique au cache local.");
        } else {
          throw networkError;
        }
      }
    }

    // Réseau coupé : repli transparent sur le cache local Dexie
    const cached = await readFromLocalCache<T>(url);
    if (cached !== null) {
      return cached;
    }

    if (options.offlineFallbackData !== undefined) {
      return options.offlineFallbackData as T;
    }

    throw new Error("Vous êtes hors ligne et cette ressource n'a pas encore été consultée.");
  }

  // -------------------------------------------------------------
  // 2. REQUÊTES EN SUPPRESSION (DELETE)
  // -------------------------------------------------------------
  const entityType = options.entity || inferEntityFromUrl(url);
  const targetId = url.split("?")[0].split("/").filter(Boolean).pop();

  if (method === "DELETE") {
    if (isActuallyOnline) {
      try {
        const res = await fetch(url, options);
        if (res.ok) {
          const responseData = (await res.json().catch(() => ({ success: true }))) as T;
          if (targetId) {
            removeLocalCacheItem(entityType, targetId).catch(() => {});
          }
          return responseData;
        }
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `Erreur serveur (${res.status})`);
      } catch (networkError: unknown) {
        if (!navigator.onLine || (networkError instanceof TypeError && networkError.message.includes("fetch"))) {
          console.warn("[ApiClient] Coupure réseau pendant le DELETE, bascule automatique sur l'Outbox.");
        } else {
          throw networkError;
        }
      }
    }

    // Réseau coupé pour DELETE : enregistrement outbox et retrait du cache local
    const clientId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const { getOfflineSession } = await import("./db");
    const offlineUser = await getOfflineSession();

    await db.outbox.put({
      id: clientId,
      userId: offlineUser?.id,
      entity: (entityType as any) || "incident",
      method: "DELETE",
      url,
      payload: {},
      createdAt: new Date().toISOString(),
      status: "pending",
      retries: 0,
    });

    if (targetId) {
      await removeLocalCacheItem(entityType, targetId);
    }

    return { success: true } as unknown as T;
  }

  // -------------------------------------------------------------
  // 3. REQUÊTES EN ÉCRITURE (POST / PATCH / PUT)
  // -------------------------------------------------------------
  const rawBody = options.body ? JSON.parse(options.body as string) : {};

  // Si on est en ligne : envoi direct normal au serveur
  if (isActuallyOnline) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        body: JSON.stringify(rawBody),
      });

      if (res.ok) {
        const responseData = (await res.json()) as T;
        updateLocalCacheAfterMutation(entityType, responseData, false, method).catch(() => {});
        return responseData;
      }

      // Si le serveur a rejeté la requête métier (ex: validation 400), on retourne l'erreur
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.error || `Erreur serveur (${res.status})`);
    } catch (networkError: unknown) {
      if (
        !navigator.onLine ||
        (networkError instanceof TypeError && networkError.message.includes("fetch"))
      ) {
        console.warn("[ApiClient] Coupure réseau pendant la mutation, bascule automatique sur l'Outbox.");
      } else {
        throw networkError;
      }
    }
  }

  // Réseau coupé : enregistrement automatique dans la file Outbox et réponse optimiste
  const { getOfflineSession } = await import("./db");
  const offlineUser = await getOfflineSession();

  // PATCH hors ligne : met à jour l'élément existant dans Dexie sans créer de faux élément
  if (method === "PATCH") {
    const clientId =
      rawBody.clientId ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

    await db.outbox.put({
      id: clientId,
      userId: offlineUser?.id,
      entity: (entityType as any) || "incident",
      method: "PATCH",
      url,
      payload: rawBody,
      createdAt: new Date().toISOString(),
      status: "pending",
      retries: 0,
    });

    const updated = await patchLocalCacheItem(entityType, targetId || "", rawBody);
    return updated as unknown as T;
  }

  // POST hors ligne : création optimiste
  const clientId =
    rawBody.clientId ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

  const payload = {
    ...rawBody,
    clientId,
  };

  await db.outbox.put({
    id: clientId,
    userId: offlineUser?.id,
    entity: (entityType as any) || "incident",
    method: "POST",
    url,
    payload,
    createdAt: new Date().toISOString(),
    status: "pending",
    retries: 0,
  });

  const optimisticResult = createOptimisticResponse(entityType, payload, clientId);
  await updateLocalCacheAfterMutation(entityType, optimisticResult, true, "POST");

  return optimisticResult as unknown as T;
}

function inferEntityFromUrl(url: string): string {
  if (url.includes("/api/incidents")) return "incident";
  if (url.includes("/api/payments")) return "payment";
  if (url.includes("/api/charges")) return "charge";
  if (url.includes("/api/announcements")) return "announcement";
  if (url.includes("/api/residences")) return "residence";
  if (url.includes("/api/apartments")) return "apartment";
  if (url.includes("/api/documents")) return "document";
  return "unknown";
}

async function cacheGetResult(url: string, rawData: unknown) {
  if (typeof window === "undefined" || !rawData) return;
  const db = getOfflineDB();

  // Les réponses API sont { data: [...], meta } ou tableau
  const data =
    typeof rawData === "object" && rawData !== null && "data" in rawData
      ? (rawData as any).data
      : rawData;

  try {
    if (url.includes("/api/residences")) {
      const list = Array.isArray(data) ? (data as ResidenceDTO[]) : [data as ResidenceDTO];
      await db.residences.bulkPut(list);
    } else if (url.includes("/api/apartments")) {
      const list = Array.isArray(data) ? (data as ApartmentDTO[]) : [data as ApartmentDTO];
      await db.apartments.bulkPut(list);
    } else if (url.includes("/api/charges")) {
      const list = Array.isArray(data) ? (data as ChargeDTO[]) : [data as ChargeDTO];
      await db.charges.bulkPut(list);
    } else if (url.includes("/api/incidents")) {
      const list = Array.isArray(data) ? (data as IncidentDTO[]) : [data as IncidentDTO];
      await db.incidents.bulkPut(list);
    } else if (url.includes("/api/announcements")) {
      const list = Array.isArray(data) ? (data as AnnouncementDTO[]) : [data as AnnouncementDTO];
      await db.announcements.bulkPut(list);
    } else if (url.includes("/api/documents")) {
      const list = Array.isArray(data) ? (data as DocumentDTO[]) : [data as DocumentDTO];
      await db.documents.bulkPut(list);
    } else if (url.includes("/api/dashboard")) {
      await db.dashboard.put({
        id: "current",
        data: rawData,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch {
    // Ignorer silencieusement
  }
}

async function readFromLocalCache<T>(url: string): Promise<T | null> {
  if (typeof window === "undefined") return null;
  const db = getOfflineDB();

  try {
    if (url.includes("/api/dashboard")) {
      const cached = await db.dashboard.get("current");
      return (cached?.data || null) as unknown as T;
    }

    // Gestion ressource unique /api/<entity>/[id]
    const pathNoQuery = url.split("?")[0];
    const matchId = pathNoQuery.match(/\/api\/([a-z]+)\/([a-f0-9]{24}|[a-zA-Z0-9_-]{10,})$/i);
    if (matchId) {
      const entity = matchId[1];
      const id = matchId[2];
      let item = null;
      if (entity === "residences") item = await db.residences.get(id);
      else if (entity === "apartments") item = await db.apartments.get(id);
      else if (entity === "charges") item = await db.charges.get(id);
      else if (entity === "incidents") item = await db.incidents.get(id);
      else if (entity === "announcements") item = await db.announcements.get(id);
      else if (entity === "documents") item = await db.documents.get(id);
      if (item) return item as unknown as T;
    }

    let items: any[] = [];
    if (url.includes("/api/residences")) {
      items = await db.residences.toArray();
    } else if (url.includes("/api/apartments")) {
      items = await db.apartments.toArray();
    } else if (url.includes("/api/charges")) {
      items = await db.charges.toArray();
    } else if (url.includes("/api/incidents")) {
      items = await db.incidents.reverse().sortBy("reportedAt");
    } else if (url.includes("/api/announcements")) {
      items = await db.announcements.reverse().sortBy("publishedAt");
    } else if (url.includes("/api/documents")) {
      items = await db.documents.reverse().sortBy("uploadedAt");
    }

    if (items.length > 0) {
      return {
        data: items,
        meta: {
          page: 1,
          limit: items.length,
          total: items.length,
        },
      } as unknown as T;
    }
  } catch {
    // Ignorer silencieusement
  }
  return null;
}

function createOptimisticResponse(entity: string, payload: Record<string, unknown>, clientId: string) {
  const now = new Date().toISOString();

  if (entity === "incident") {
    return {
      _id: clientId,
      clientId,
      residence: payload.residence,
      apartment: payload.apartment,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      photos: payload.photos || [],
      priority: payload.priority || "MEDIUM",
      status: "REPORTED",
      reportedAt: now,
      createdOffline: true,
      pending: true,
    } as IncidentDTO;
  }

  if (entity === "payment") {
    return {
      _id: clientId,
      clientId,
      charge: payload.charge,
      amount: payload.amount,
      paymentDate: now,
      method: payload.method,
      receiptNumber: `OFFLINE-${Date.now().toString().slice(-6)}`,
      createdOffline: true,
    } as PaymentDTO;
  }

  return {
    _id: clientId,
    ...payload,
    createdOffline: true,
  };
}

async function removeLocalCacheItem(entity: string, id: string) {
  if (typeof window === "undefined" || !id) return;
  const db = getOfflineDB();
  try {
    if (entity === "incident") await db.incidents.delete(id);
    else if (entity === "charge") await db.charges.delete(id);
    else if (entity === "residence") await db.residences.delete(id);
    else if (entity === "apartment") await db.apartments.delete(id);
    else if (entity === "announcement") await db.announcements.delete(id);
    else if (entity === "document") await db.documents.delete(id);
  } catch {
    // Ignorer
  }
}

async function patchLocalCacheItem(entity: string, id: string, patch: Record<string, unknown>) {
  if (typeof window === "undefined" || !id) return { _id: id, ...patch };
  const db = getOfflineDB();
  try {
    if (entity === "incident") {
      const existing = await db.incidents.get(id);
      if (existing) {
        const merged = { ...existing, ...patch, pending: true };
        await db.incidents.put(merged);
        return merged;
      }
    } else if (entity === "charge") {
      const existing = await db.charges.get(id);
      if (existing) {
        const merged = { ...existing, ...patch };
        await db.charges.put(merged);
        return merged;
      }
    } else if (entity === "residence") {
      const existing = await db.residences.get(id);
      if (existing) {
        const merged = { ...existing, ...patch };
        await db.residences.put(merged);
        return merged;
      }
    } else if (entity === "apartment") {
      const existing = await db.apartments.get(id);
      if (existing) {
        const merged = { ...existing, ...patch };
        await db.apartments.put(merged);
        return merged;
      }
    } else if (entity === "announcement") {
      const existing = await db.announcements.get(id);
      if (existing) {
        const merged = { ...existing, ...patch };
        await db.announcements.put(merged);
        return merged;
      }
    } else if (entity === "document") {
      const existing = await db.documents.get(id);
      if (existing) {
        const merged = { ...existing, ...patch };
        await db.documents.put(merged);
        return merged;
      }
    }
  } catch {
    // Ignorer
  }
  return { _id: id, ...patch };
}

async function updateLocalCacheAfterMutation(
  entity: string,
  data: unknown,
  isOptimistic = false,
  _method = "POST"
) {
  if (typeof window === "undefined" || !data) return;
  const db = getOfflineDB();

  try {
    if (entity === "incident") {
      const incident = data as IncidentDTO;
      await db.incidents.put({
        ...incident,
        pending: isOptimistic,
      });
    } else if (entity === "payment") {
      const payment = data as PaymentDTO;
      if (isOptimistic) {
        // En mode optimiste hors ligne : mise à jour temporaire
        const charge = await db.charges.get(payment.charge);
        if (charge) {
          const updatedPaid = (charge.paidAmount || 0) + payment.amount;
          await db.charges.update(charge._id, {
            paidAmount: updatedPaid,
            remaining: Math.max(0, charge.amount - updatedPaid),
            status: updatedPaid >= charge.amount ? "PAID" : "PARTIAL",
          });
        }
      } else {
        // En ligne / synchro : recalcule à partir des données serveur au lieu d'ajouter le montant
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
          // Si échec réseau, on ne sur-ajoute pas
        }
      }
    }
  } catch {
    // Ignorer
  }
}
