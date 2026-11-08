"use client";

import { useEffect, useState } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff, AlertCircle, LogIn } from "lucide-react";
import { onSessionExpired } from "@/lib/offline/sync";
import Link from "next/link";

export function OfflineBanner() {
  const [mounted, setMounted] = useState(false);
  const { isOnline, pendingCount } = useOnlineStatus();
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    const unsubscribe = onSessionExpired((msg) => {
      setSessionExpiredMsg(msg);
    });

    const handleCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.message) setSessionExpiredMsg(detail.message);
    };

    window.addEventListener("syndicpro:session-expired", handleCustom);
    return () => {
      unsubscribe();
      window.removeEventListener("syndicpro:session-expired", handleCustom);
    };
  }, []);

  if (!mounted) return null;

  // 1. Bandeau de session expirée (priorité haute pour réauthentifier et synchroniser l'outbox)
  if (sessionExpiredMsg) {
    return (
      <div
        role="alert"
        className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-rose-600 px-4 py-2.5 text-xs font-medium text-white shadow-md sm:text-sm"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 animate-bounce text-rose-200" />
          <span>{sessionExpiredMsg}</span>
        </div>
        <Link
          href="/login"
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-rose-700 shadow hover:bg-rose-50"
        >
          <LogIn className="h-3.5 w-3.5" />
          Se reconnecter
        </Link>
      </div>
    );
  }

  // 2. Bandeau hors-ligne standard
  if (!isOnline) {
    return (
      <div
        role="status"
        className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-amber-600 px-4 py-2.5 text-xs font-medium text-white shadow-md sm:text-sm"
      >
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 shrink-0 animate-pulse text-amber-200" />
          <span>
            <strong>Connexion perdue</strong> — Mode hors ligne activé automatiquement. Vos actions sont sauvegardées.
          </span>
        </div>

        {pendingCount > 0 && (
          <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
            {pendingCount} en attente
          </span>
        )}
      </div>
    );
  }

  return null;
}
