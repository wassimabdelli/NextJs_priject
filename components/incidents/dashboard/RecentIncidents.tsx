"use client";

import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { incidentCategoryLabel } from "@/types/enums";
import type { IncidentDashboardData } from "./types";
import { DashboardEmptyState } from "./DashboardEmptyState";

export function RecentIncidents({
  incidents,
  page,
  limit,
  total,
  onPageChange,
  onView,
}: {
  incidents: IncidentDashboardData["recentIncidents"]["data"];
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onView: (id: string) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Réclamations récentes</h2>
          <p className="mt-1 text-xs text-slate-500">{total} au total sur la période</p>
        </div>
      </div>
      {incidents.length === 0 ? <div className="px-4 pb-4 sm:px-5 sm:pb-5"><DashboardEmptyState /></div> : (
        <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr><th className="px-4 py-3">Réclamation</th><th className="px-4 py-3">Résidence</th><th className="px-4 py-3">Priorité</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Détails</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {incidents.map((incident) => (
                <tr key={incident._id} className="text-slate-700 dark:text-slate-300">
                  <td className="px-4 py-3"><p className="font-semibold text-slate-900 dark:text-white">{incident.title}</p><p className="mt-0.5 text-xs text-slate-500">{incidentCategoryLabel[incident.category]}</p></td>
                  <td className="px-4 py-3">{incident.residence?.name || "—"}</td>
                  <td className="px-4 py-3"><Badge priority={incident.priority} /></td>
                  <td className="px-4 py-3"><Badge incidentStatus={incident.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(incident.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => onView(incident._id)} aria-label={`Voir ${incident.title}`}><Eye className="h-4 w-4" /> Ouvrir</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs dark:border-slate-800">
            <span className="text-slate-500">Page {page} sur {pages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Précédent</Button>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Suivant</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
