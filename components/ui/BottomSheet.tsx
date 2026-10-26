"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}: BottomSheetProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    // Bloque le défilement arrière-plan
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      {/* Backdrop sombre avec flou */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Conteneur : Bottom Sheet sur mobile (< sm/md), Modal centré sur desktop */}
      <div
        className={clsx(
          "relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl transition-all dark:bg-slate-900 sm:max-w-lg sm:rounded-3xl sm:border sm:border-slate-800",
          className
        )}
        style={{
          paddingBottom: "max(1rem, env(safe-area-inset-bottom, 1rem))",
        }}
      >
        {/* Poignée de glissement sur mobile */}
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />

        {/* En-tête */}
        <div className="flex items-start justify-between px-6 pt-4 pb-3">
          <div>
            {title && (
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenu avec défilement interne fluide */}
        <div className="flex-1 overflow-y-auto px-6 py-2">{children}</div>
      </div>
    </div>
  );
}
