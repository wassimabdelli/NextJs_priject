"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { incidentCategoryLabel } from "@/types/enums";
import type { IncidentDashboardData } from "./types";
import { DashboardEmptyState } from "./DashboardEmptyState";

export function IncidentPriorityList({
  incidents,
  onView,
}: {
  incidents: IncidentDashboardData["priorityIncidents"];
  onView: (id: string) => void;
}) {
  return (
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <div className="flex items-center gap-2 p-4 sm:p-5">
        <AlertTriangle className="h-5 w-5 text-rose-600" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Priorité haute / urgente</h2>
      </div>
      {incidents.length === 0 ? <div className="px-4 pb-4 sm:px-5 sm:pb-5"><DashboardEmptyState message="Aucune réclamation urgente ou haute en cours." /></div> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {incidents.map((incident) => (
            <li key={incident._id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <button type="button" onClick={() => onView(incident._id)} className="block max-w-full truncate text-left text-sm font-semibold text-slate-900 hover:text-sky-700 dark:text-white dark:hover:text-sky-300">{incident.title}</button>
                <p className="mt-1 truncate text-xs text-slate-500">{incident.residence?.name ? `${incident.residence.name} · ` : ""}{incidentCategoryLabel[incident.category]}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge priority={incident.priority} />
                <Button variant="ghost" size="sm" onClick={() => onView(incident._id)} aria-label="Ouvrir la réclamation"><ArrowUpRight className="h-4 w-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
