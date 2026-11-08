"use client";

import { AlertTriangle, Clock3 } from "lucide-react";
import type { AttentionComplaint } from "@/types/ai-intelligence";
import { incidentCategoryLabel, incidentStatusLabel, priorityLabel } from "@/types/enums";

type Props = { complaints: AttentionComplaint[]; onOpen: (id: string) => void };

function label(value: string, labels: Record<string, string>) {
  return labels[value] ?? value.replaceAll("_", " ");
}

export default function NeedsAttention({ complaints, onOpen }: Props) {
  if (!complaints.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"><AlertTriangle aria-hidden="true" className="h-7 w-7" /></span>
        <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">Aucun suivi prioritaire</h3>
        <p className="mt-1 text-sm text-slate-500">Aucune réclamation ne correspond actuellement aux règles de suivi.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {complaints.map((item, index) => (
        <button key={item.id} type="button" onClick={() => onOpen(item.id)} className={`flex min-h-[72px] w-full flex-col gap-3 p-5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:hover:bg-slate-800/60 sm:flex-row sm:items-center sm:justify-between ${index ? "border-t border-slate-100 dark:border-slate-800" : ""}`}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.priority === "URGENT" ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : item.priority === "HIGH" ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>{label(item.priority, priorityLabel)}</span>
              <span className="text-xs text-slate-500">{label(item.status, incidentStatusLabel)}</span>
              <span className="text-xs text-slate-400">{label(item.category, incidentCategoryLabel)}</span>
            </div>
            <h3 className="mt-2 truncate font-semibold text-slate-900 dark:text-white">{item.title}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.reason}</p>
            <p className="mt-2 text-xs text-slate-400">{[item.residenceName, item.apartmentLabel].filter(Boolean).join(" · ")}</p>
          </div>
          <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500"><Clock3 aria-hidden="true" className="h-4 w-4" />{new Date(item.createdAt).toLocaleDateString("fr-FR")}</span>
        </button>
      ))}
    </div>
  );
}
