"use client";

import { useEffect, useState, useCallback } from "react";
import { getOfflineDB } from "@/lib/offline/db";
import { syncOutbox, onSyncChange, initAutoSync } from "@/lib/offline/sync";

/**
 * Statut réseau / outbox.
 * `isOnline` démarre toujours à `true` (SSR = client) puis se synchronise au montage
 * pour éviter les erreurs d'hydratation (Wifi vs WifiOff).
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const db = getOfflineDB();
      const count = await db.outbox.where("status").anyOf(["pending", "failed"]).count();
      setPendingCount(count);
    } catch {
      // IndexedDB pas encore prêt
    }
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    setHydrated(true);
    refreshPendingCount();
    initAutoSync();

    const handleOnline = () => {
      setIsOnline(true);
      refreshPendingCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshPendingCount();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const unsubscribe = onSyncChange((syncing, count) => {
      setIsSyncing(syncing);
      setPendingCount(count);
    });

    const interval = setInterval(refreshPendingCount, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
      clearInterval(interval);
    };
  }, [refreshPendingCount]);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      await syncOutbox();
    } finally {
      await refreshPendingCount();
      setIsSyncing(false);
    }
  }, [refreshPendingCount]);

  return { isOnline, hydrated, pendingCount, isSyncing, syncNow, refreshPendingCount };
}
