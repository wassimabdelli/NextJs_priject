"use client";

import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AIResultCard } from "./AIResultCard";

export interface PrioritySuggestion {
  suggestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  explanation: string;
  safetyWarning: string | null;
}

export function AIRecommendation({ result, onAccept }: { result: PrioritySuggestion; onAccept?: () => void }) {
  return <AIResultCard title="Recommandation de priorité — avis non définitif">
    <div className="space-y-2">
      <p><strong>Priorité suggérée :</strong> {result.suggestedPriority}</p>
      <p>{result.explanation}</p>
      {result.safetyWarning && <p className="flex gap-2 rounded-lg bg-amber-100 p-3 font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"><AlertTriangle className="h-4 w-4 shrink-0" />{result.safetyWarning}</p>}
      {onAccept && <Button type="button" size="sm" onClick={onAccept}><Check className="h-4 w-4" />Appliquer cette suggestion</Button>}
    </div>
  </AIResultCard>;
}
