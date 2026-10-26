"use client";

import { useEffect, useState, useCallback } from "react";
import { getOfflineDB } from "@/lib/offline/db";
import { syncOutbox, onSyncChange, initAutoSync } from "@/lib/offline/sync";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const db = getOfflineDB();
      const count = await db.outbox.where("status").anyOf(["pending", "failed"]).count();
      setPendingCount(count);
    } catch {
      // Ignorer si IndexedDB n'est pas encore initialisé
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);
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

    // Intervalle de vérification du compteur outbox
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

  return { isOnline, pendingCount, isSyncing, syncNow, refreshPendingCount };
}
