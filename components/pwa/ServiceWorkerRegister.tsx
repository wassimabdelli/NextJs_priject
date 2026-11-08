"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Enregistrement du Service Worker PWA.
 * - En développement (npm run dev) : Désenregistre tout Service Worker pour garantir
 *   que le site fonctionne normalement sans interférence de cache.
 * - En production (npm start) : Active le Service Worker pour le pré-cache et le mode hors ligne.
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

    // En DEV : on s'assure qu'aucun ancien service worker ne tourne pour naviguer normalement
    if (!isProd && !forceEnable) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
          console.log("[SW] Service Worker désenregistré en mode dev pour fonctionnement normal");
        }
      });
      return;
    }

    // En PRODUCTION : enregistrement standard
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
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-sky-500/20 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-md sm:bottom-6 sm:right-6 sm:left-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-semibold text-sky-400">Mise à jour prête</p>
          <p className="text-xs text-slate-300">
            Une nouvelle version de l&apos;application est disponible.
          </p>
        </div>
        <button
          onClick={handleUpdate}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-sky-500 px-3.5 py-2 text-xs font-semibold text-white shadow hover:bg-sky-400 active:scale-95"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Recharger
        </button>
      </div>
    </div>
  );
}
