"use client";

import { Card } from "@/components/ui/Card";
import type { IncidentDashboardData } from "./types";
import { DashboardEmptyState } from "./DashboardEmptyState";

export function TechnicianPerformanceTable({ data }: { data: IncidentDashboardData["technicianPerformance"] }) {
  return (
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <div className="p-4 sm:p-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Charge et résolution par technicien</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Temps moyen calculé sur les incidents résolus de la période.</p>
      </div>
      {data.length === 0 ? <div className="px-4 pb-4 sm:px-5 sm:pb-5"><DashboardEmptyState message="Aucune intervention assignée sur cette période." /></div> : (
        <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr><th className="px-4 py-3">Technicien</th><th className="px-4 py-3">Assignées</th><th className="px-4 py-3">Terminées</th><th className="px-4 py-3">En cours</th><th className="px-4 py-3">Temps moyen</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.map((item) => <tr key={item.technicianId} className="text-slate-700 dark:text-slate-300"><td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{item.name}</td><td className="px-4 py-3 tabular-nums">{item.assigned}</td><td className="px-4 py-3 tabular-nums">{item.completed}</td><td className="px-4 py-3 tabular-nums">{item.inProgress}</td><td className="px-4 py-3 tabular-nums">{item.completed ? `${item.averageResolutionHours} h` : "—"}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
