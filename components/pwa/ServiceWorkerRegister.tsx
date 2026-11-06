"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const DEV_SW_CLEANUP_KEY = "syndicpro-sw-dev-cleaned";

/** Désenregistre tous les SW et vide Cache Storage (évite HTML neuf + JS stale). */
async function purgeServiceWorkersAndCaches() {
  if (!("serviceWorker" in navigator)) return false;

  const regs = await navigator.serviceWorker.getRegistrations();
  const hadController = !!navigator.serviceWorker.controller;
  await Promise.all(regs.map((reg) => reg.unregister()));

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  return hadController || regs.length > 0;
}

/**
 * Enregistrement du Service Worker PWA.
 * - En développement : purge SW + caches, puis reload unique si un SW contrôlait la page.
 * - En production : enregistre /sw.js et propose la mise à jour.
 */
export function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const isProd = process.env.NODE_ENV === "production";
    const forceEnable = process.env.NEXT_PUBLIC_ENABLE_SW === "true";

    if (!isProd && !forceEnable) {
      let cancelled = false;
      purgeServiceWorkersAndCaches()
        .then((hadStale) => {
          if (cancelled || !hadStale) return;
          // Un seul reload pour resynchroniser le bundle client avec le HTML SSR
          if (sessionStorage.getItem(DEV_SW_CLEANUP_KEY) === "1") return;
          sessionStorage.setItem(DEV_SW_CLEANUP_KEY, "1");
          window.location.reload();
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }

    if (isProd) {
      sessionStorage.removeItem(DEV_SW_CLEANUP_KEY);
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdate(true);
        }

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (
              installingWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setWaitingWorker(installingWorker);
              setShowUpdate(true);
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[SW] Enregistrement ignoré :", err);
      });

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_OUTBOX_TRIGGER") {
        import("@/lib/offline/sync").then(({ syncOutbox }) => {
          syncOutbox().catch(console.error);
        });
      }
    };
    navigator.serviceWorker.addEventListener("message", handleSwMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      navigator.serviceWorker.removeEventListener("message", handleSwMessage);
    };
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[var(--z-overlay)] mx-auto max-w-md rounded-2xl border border-sky-500/20 bg-slate-900 p-4 text-white shadow-sm sm:bottom-6 sm:right-6 sm:left-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-semibold text-sky-400">Mise à jour prête</p>
          <p className="text-pretty text-xs text-slate-300">
            Une nouvelle version de l&apos;application est disponible.
          </p>
        </div>
        <button
          type="button"
          onClick={handleUpdate}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-500"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Recharger
        </button>
      </div>
    </div>
  );
}
