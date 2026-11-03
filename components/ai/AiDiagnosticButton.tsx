"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

export interface AiDiagnosticButtonProps {
  photos?: string[];
  title?: string;
  description?: string;
  mode?: "incident" | "maintenance";
  onResult: (data: any) => void;
  [key: string]: any;
}

// Bouton d'analyse IA hybride (Vision via photos ou Texte via titre/description)
export function AiDiagnosticButton({
  photos = [],
  title = "",
  description = "",
  mode = "incident",
  onResult,
}: AiDiagnosticButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async () => {
    if (mode === "maintenance") {
      if (!title.trim() && !description.trim()) {
        alert(
          "Veuillez renseigner un titre ou une description avant de lancer le diagnostic IA !"
        );
        return;
      }
    } else {
      if (!photos || photos.length === 0) {
        alert("Prenez d'abord une photo du problème !");
        return;
      }
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/ai/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, title, description, photos }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Erreur lors de l'analyse IA.");
        return;
      }

      const payload =
        data?.title || data?.maintenanceType || data?.technicalAdvice
          ? data
          : data?.data ?? data;
      onResult(payload);
    } catch {
      alert("Impossible de contacter le service d'analyse IA.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleAnalyze}
      disabled={isLoading}
      className="bg-gradient-to-r from-violet-600 to-sky-500 text-white w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-md transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Analyse IA en cours...</span>
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          <span>
            {mode === "maintenance"
              ? "✨ Générer Diagnostic & Checklist (IA)"
              : "✨ Auto-remplissage via Photo (IA)"}
          </span>
        </>
      )}
    </button>
  );
}
