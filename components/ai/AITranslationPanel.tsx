"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AIButton } from "./AIButton";
import { AIError } from "./AIError";
import { AILoading } from "./AILoading";
import { AIResultCard } from "./AIResultCard";

interface Translation {
  translatedContent: string;
  detectedLanguage: string;
}

export function AITranslationPanel({ content, onApply, readonly = false }: { content: string; onApply?: (translation: string) => void; readonly?: boolean }) {
  const [targetLanguage, setTargetLanguage] = useState("EN");
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const translate = async () => {
    setLoading(true); setError(""); setTranslation(null);
    try {
      const response = await fetch("/api/ai/announcements/translate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, targetLanguage }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Traduction indisponible.");
      setTranslation(data as Translation);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Traduction impossible."); }
    finally { setLoading(false); }
  };
  return <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs font-medium">Traduire vers<select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} className="mt-1 min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="FR">Français</option><option value="AR">العربية</option><option value="EN">English</option></select></label>
      <AIButton disabled={loading || content.trim().length === 0} onClick={() => void translate()}>Traduire</AIButton>
    </div>
    {loading && <AILoading label="Traduction en cours…" />}
    {error && <AIError message={error} />}
    {translation && <AIResultCard title={`Traduction ${translation.detectedLanguage} → ${targetLanguage} — à vérifier`}>
      <div className={targetLanguage === "AR" ? "space-y-3 text-right" : "space-y-3"} dir={targetLanguage === "AR" ? "rtl" : "auto"}>
        {readonly
          ? <p className="whitespace-pre-wrap">{translation.translatedContent}</p>
          : <textarea aria-label="Modifier la traduction avant utilisation" rows={6} maxLength={20000} value={translation.translatedContent} onChange={(event) => setTranslation({ ...translation, translatedContent: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-800" />}
        {!readonly && onApply && <Button type="button" size="sm" onClick={() => onApply(translation.translatedContent)}>Remplacer le contenu après confirmation</Button>}
      </div>
    </AIResultCard>}
  </div>;
}
