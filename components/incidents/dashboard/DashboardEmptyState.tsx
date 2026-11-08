import { ClipboardList } from "lucide-react";

export function DashboardEmptyState({ message = "Aucune réclamation pour cette période." }: { message?: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-8 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <ClipboardList className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">{message}</p>
    </div>
  );
}
