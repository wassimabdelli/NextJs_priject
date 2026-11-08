"use client";

import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { AIResultCard } from "./AIResultCard";

export interface PossibleDuplicate {
  incidentId: string;
  title: string;
  summary: string;
  status: string;
  reportedAt: string;
  similarity: number;
  score?: number;
  method?: "embedding" | "lexical";
  explanation: string;
}

export function AIDuplicateWarning({
  matches,
  context = "Il ne s’agit pas d’un doublon confirmé. Vous pouvez continuer le signalement.",
  renderExtra,
}: {
  matches: PossibleDuplicate[];
  context?: string;
  renderExtra?: (item: PossibleDuplicate) => ReactNode;
}) {
  if (!matches.length) return null;
  return <AIResultCard title="Des réclamations similaires ont été trouvées — correspondances possibles">
    <ul className="space-y-3">
      {matches.map((item) => <li key={item.incidentId} className="rounded-lg border border-sky-200 p-3 dark:border-sky-900">
        <p className="font-semibold">{item.title}</p>
        <p className="mt-1 text-xs">{new Date(item.reportedAt).toLocaleDateString()} · {item.status} · similarité {item.method === "embedding" ? "sémantique" : "lexicale"} {item.similarity}%</p>
        <p className="mt-2">{item.explanation}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300"><AlertCircle className="h-3.5 w-3.5" />{context}</p>
        {renderExtra?.(item)}
      </li>)}
    </ul>
  </AIResultCard>;
}
