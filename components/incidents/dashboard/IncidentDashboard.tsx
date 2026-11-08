"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardDateFilter } from "./DashboardDateFilter";
import { DashboardEmptyState } from "./DashboardEmptyState";
import { IncidentCategoryChart } from "./IncidentCategoryChart";
import { IncidentPriorityList } from "./IncidentPriorityList";
import { IncidentStatCard } from "./IncidentStatCard";
import { IncidentStatusChart } from "./IncidentStatusChart";
import { IncidentTrendChart } from "./IncidentTrendChart";
import { RecentIncidents } from "./RecentIncidents";
import { ResidenceComparisonChart } from "./ResidenceComparisonChart";
import { TechnicianPerformanceTable } from "./TechnicianPerformanceTable";
import type { IncidentDashboardData, IncidentDashboardFilters } from "./types";

export function IncidentDashboard() {
  const router = useRouter();
  const [data, setData] = useState<IncidentDashboardData | null>(null);
  const [filters, setFilters] = useState<IncidentDashboardFilters>({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestNumber, setRequestNumber] = useState(0);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    for (const key of ["from", "to", "residence", "technician"] as const) {
      const value = filters[key];
      if (value) params.set(key, value);
    }

    try {
      const response = await fetch(`/api/incidents/dashboard?${params}`, {
        signal,
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger le tableau des réclamations.");
      const dashboardData = result.data as IncidentDashboardData;
      setData(dashboardData);
      if (!filters.from && !filters.to) {
        setFilters((current) => current.from || current.to ? current : {
          ...current,
          from: dashboardData.dateRange.from.slice(0, 10),
          to: dashboardData.dateRange.to.slice(0, 10),
        });
      }
    } catch (err) {
      if (!signal.aborted) {
        setError(err instanceof Error ? err.message : "Impossible de charger le tableau des réclamations.");
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, requestNumber]);

  useEffect(() => {
    const refresh = () => setRequestNumber((value) => value + 1);
    const refreshWhenVisible = () => {
      if (!document.hidden) refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, 15_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("syndicpro:dashboard-refresh", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("syndicpro:dashboard-refresh", refresh);
    };
  }, []);

  const role = data?.role;
  const isManager = role === "ADMIN" || role === "SYNDIC";
  const isResident = role === "RESIDENT";
  const isTechnician = role === "TECHNICIAN";
  const stats = data?.statistics;

  const updateFilters = (next: IncidentDashboardFilters) => {
    setPage(1);
    setFilters(next);
  };
  const openIncident = (id: string) => router.push(`/incidents?incident=${encodeURIComponent(id)}`);
  const exportReport = () => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.residence) params.set("residence", filters.residence);
    if (filters.technician) params.set("assignedTo", filters.technician);
    window.location.assign(`/api/incidents/export?${params.toString()}`);
  };

  const title = role === "ADMIN"
    ? "Pilotage global des réclamations"
    : role === "SYNDIC"
    ? "Réclamations de mes résidences"
    : role === "RESIDENT"
    ? "Mes réclamations"
    : role === "TECHNICIAN"
    ? "Mon espace d'intervention"
    : "Gestion des réclamations";

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">Suivi opérationnel</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isResident ? "Suivez vos demandes et répondez aux preuves de résolution." : isTechnician ? "Suivez uniquement les interventions qui vous sont assignées." : "Indicateurs agrégés calculés sur vos incidents autorisés."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {role === "ADMIN" && (
            <Button type="button" variant="outline" size="sm" onClick={exportReport}>
              <Download className="h-4 w-4" /> Exporter CSV
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setRequestNumber((value) => value + 1)} isLoading={loading}>
            <RefreshCw className="h-4 w-4" /> Actualiser
          </Button>
        </div>
      </header>

      {data && (
        <DashboardDateFilter
          role={data.role}
          filters={filters}
          residences={data.residences}
          technicians={data.technicians}
          onChange={updateFilters}
        />
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">{error}</div>
          <Button type="button" variant="outline" size="sm" onClick={() => setRequestNumber((value) => value + 1)}>Réessayer</Button>
        </div>
      )}

      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-28 rounded-2xl" />)}
        </div>
      ) : data && stats ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <IncidentStatCard title={isTechnician ? "Interventions assignées" : "Total réclamations"} value={stats.total} icon={<ClipboardList className="h-5 w-5" />} color="blue" />
            <IncidentStatCard title={isTechnician ? "Nouvelles assignations" : isResident ? "En attente" : "Ouvertes"} value={stats.reported + stats.assigned + stats.inProgress} description={isResident ? `${stats.reported + stats.assigned} en attente de prise en charge` : "Non résolues"} icon={<Clock3 className="h-5 w-5" />} color="orange" />
            <IncidentStatCard title="Résolues" value={stats.resolved} description={`Taux : ${stats.resolutionRate}%`} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
            <IncidentStatCard title="Urgentes" value={stats.urgent} description={`${stats.high} priorité haute`} icon={<AlertTriangle className="h-5 w-5" />} color="red" />
            <IncidentStatCard title="À surveiller" value={stats.overdue} description="Ouvertes depuis plus de 72 h" icon={<Wrench className="h-5 w-5" />} color="purple" />
          </div>

          {isResident && data.awaitingConfirmation > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-sky-900 dark:bg-sky-950/30">
              <div>
                <p className="font-semibold text-sky-900 dark:text-sky-200">Une résolution attend votre confirmation</p>
                <p className="mt-1 text-sm text-sky-800 dark:text-sky-300">{data.awaitingConfirmation} réclamation(s) avec une preuve envoyée.</p>
              </div>
              <Button type="button" onClick={() => router.push("/incidents")}>Examiner mes réclamations</Button>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <IncidentTrendChart data={data.monthlyTrends} />
            <IncidentStatusChart data={data.byStatus} total={stats.total} />
          </div>
          <div className={`grid gap-4 ${isManager ? "xl:grid-cols-2" : "xl:grid-cols-[1.1fr_0.9fr]"}`}>
            <IncidentCategoryChart data={data.byCategory} />
            <IncidentPriorityList incidents={data.priorityIncidents} onView={openIncident} />
          </div>

          {isManager && (
            <>
              <TechnicianPerformanceTable data={data.technicianPerformance} />
              <ResidenceComparisonChart data={data.residenceComparison} />
            </>
          )}

          {isTechnician && (
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Assignées", stats.assigned],
                ["En cours", stats.inProgress],
                ["Terminées", stats.resolved],
              ].map(([label, value]) => (
                <IncidentStatCard key={label} title={`Mes tâches ${String(label).toLowerCase()}`} value={value} icon={<UserCheck className="h-5 w-5" />} />
              ))}
              <p className="text-xs text-slate-500 sm:col-span-3">Temps moyen de résolution : {stats.resolved ? `${stats.averageResolutionHours} h` : "—"}</p>
            </div>
          )}

          <RecentIncidents
            incidents={data.recentIncidents.data}
            page={data.recentIncidents.meta.page}
            limit={data.recentIncidents.meta.limit}
            total={data.recentIncidents.meta.total}
            onPageChange={setPage}
            onView={openIncident}
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Activité récente</h2>
            {data.recentActivity.length === 0 ? <div className="mt-3"><DashboardEmptyState message="Aucune activité pour cette période." /></div> : (
              <ol className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {data.recentActivity.map((activity) => (
                  <li key={activity._id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <button type="button" onClick={() => openIncident(activity.incidentId)} className="truncate text-left text-sm font-semibold text-slate-900 hover:text-sky-700 dark:text-white dark:hover:text-sky-300">{activity.title}</button>
                      <p className="text-xs text-slate-500">{activity.description}</p>
                    </div>
                    <time className="shrink-0 text-xs text-slate-500" dateTime={activity.createdAt}>{new Date(activity.createdAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</time>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
