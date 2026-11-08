"use client";

import { useEffect, useState } from "react";
import { Download, Share2, PlusSquare, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Détection si l'application s'exécute déjà en mode PWA installée
    const standaloneMedia = window.matchMedia("(display-mode: standalone)");
    const isStandaloneMode =
      standaloneMedia.matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsStandalone(isStandaloneMode);

    // Détection iOS (Safari)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    // Écoute de l'événement standard beforeinstallprompt (Chromium / Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  // Ne pas afficher si déjà installé ou si l'utilisateur l'a fermé
  if (isStandalone || dismissed) {
    return null;
  }

  // Si on a le prompt Chromium
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-sky-500/30 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-md sm:bottom-6 sm:left-6 sm:right-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Installer SyndicPro</p>
              <p className="text-xs text-slate-300">
                Accès rapide hors ligne et expérience plein écran.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={handleInstallClick}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-sky-400 active:scale-95"
          >
            <Download className="h-3.5 w-3.5" />
            Installer l&apos;application
          </button>
        </div>
      </div>
    );
  }

  // Si sur iOS Safari
  if (isIOS) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-sky-500/30 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-md sm:bottom-6 sm:left-6 sm:right-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-sky-400">
            <Download className="h-5 w-5" />
            <p className="text-sm font-semibold text-white">Installer sur iPhone/iPad</p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-300">
          Pour installer SyndicPro : touchez le bouton Partager{" "}
          <Share2 className="inline h-3.5 w-3.5 text-sky-400" /> dans Safari, puis
          choisissez{" "}
          <span className="font-semibold text-white">
            « Sur l&apos;écran d&apos;accueil »{" "}
            <PlusSquare className="inline h-3.5 w-3.5 text-sky-400" />
          </span>
          .
        </p>
      </div>
    );
  }

  return null;
}
