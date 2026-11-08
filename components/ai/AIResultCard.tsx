"use client";

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { AIBadge } from "./AIBadge";

interface AIResultCardProps {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  showHumanControlNote?: boolean;
}

export function AIResultCard({
  title = "Suggestion IA — à vérifier",
  children,
  footer,
  showHumanControlNote = true,
}: AIResultCardProps) {
  return <section className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/20">
    <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-sky-900 dark:text-sky-200"><Sparkles aria-hidden="true" className="h-4 w-4" />{title}<AIBadge /></h3>
    <div className="text-sm text-slate-700 dark:text-slate-300">{children}</div>
    {footer !== undefined ? footer : showHumanControlNote ? (
      <p className="mt-3 flex items-start gap-2 rounded-lg bg-white/60 p-2 text-[11px] leading-5 text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
        <span aria-hidden="true">ℹ️</span>
        <span>
          Suggestion IA — aucune décision, publication ou modification n&apos;est
          appliquée automatiquement. Toute action reste soumise à validation humaine.
        </span>
      </p>
    ) : null}
  </section>;
}
