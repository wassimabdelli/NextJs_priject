"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  AlertTriangle,
  Receipt,
  RefreshCw,
  PlusCircle,
  Megaphone,
  Wrench,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  BarChart3,
  PieChart as PieIcon,
  Calendar,
  Building2,
  Users,
  Timer,
  ClipboardList,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { Role, type IncidentCategory as IncidentCategoryType, type IncidentStatus as IncidentStatusType, type Priority as PriorityType } from "@/types/enums";
import { DashboardStatCard } from "@/components/dashboard/DashboardStatCard";
import { RecentActivityWidget } from "@/components/dashboard/RecentActivityWidget";
import { NotificationPreview } from "@/components/dashboard/NotificationPreview";
import { AIReportPanel } from "@/components/ai/AIReportPanel";
import BriefingPanel from "@/components/ai-intelligence/BriefingPanel";

interface DashboardIncident {
  _id: string;
  title: string;
  category: IncidentCategoryType;
  priority: PriorityType;
  status: IncidentStatusType;
  reportedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  latestUpdate?: string;
  description?: string;
  resolutionDescription?: string;
  resolvedAt?: string;
  residence?: { name?: string; city?: string } | string | null;
  apartment?: { number?: string | number } | null;
}

interface DashboardAnnouncement {
  _id?: string;
  id?: string;
  title: string;
  content?: string;
  category?: string;
  priority?: string;
  isPinned?: boolean;
  isRead?: boolean;
  publishedAt?: string;
  residence?: string;
  readCount?: number;
  eligibleReadCount?: number;
  readPercentage?: number | null;
}

interface DashboardNotification {
  _id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedResource?: { resourceType: string; resourceId?: string | null };
}

interface DashboardData {
  role: Role;
  kpi?: {
    period: string;
    collectionRate: number;
    treasury: number;
    openIncidents: number;
    unpaidAmount: number;
    totalApartments: number;
  };
  charts?: {
    financialByMonth: Array<{ month: string; recettes: number; depenses: number }>;
    incidentsByStatus: Array<{ status: string; label: string; count: number; color: string }>;
    announcementByMonth: Array<{ month: string; period: string; count: number }>;
  };
  overview?: {
    residences?: number;
    users?: number;
    residents?: number;
    technicians?: number;
    incidents?: number;
    total?: number;
    reported?: number;
    assigned?: number;
    inProgress?: number;
    resolved?: number;
    urgent?: number;
    rejectedResolutions?: number;
    open?: number;
    publishedAnnouncements?: number;
    scheduledAnnouncements?: number;
    unreadAnnouncements?: number;
    unreadNotifications?: number;
    awaitingReview?: number;
    averageResolutionHours?: number;
    urgentIncidents?: Array<Pick<DashboardIncident, "title" | "category" | "priority" | "status" | "createdAt"> & { id: string; residence?: string }>;
    recentAnnouncements?: DashboardAnnouncement[];
    technicianWorkload?: Array<{ technicianId: string; name: string; assigned: number; inProgress: number; resolved: number; currentWorkload: number }>;
  };
  residences?: Array<{ id: string; name: string; city?: string }>;
  whatIOwe?: { totalDue: number; unpaidCharges: Array<{ _id: string; period: string; dueDate: string; amount: number; paidAmount?: number; remaining?: number }> };
  latestAnnouncements?: DashboardAnnouncement[];
  latestNotifications?: DashboardNotification[];
  myIncidents?: { items: DashboardIncident[]; total: number; open: number };
  myInterventions?: {
    pending: DashboardIncident[];
    recentResolved: DashboardIncident[];
    counts: { assigned: number; inProgress: number; resolved: number; urgent: number; total: number };
  };
}

const INCIDENT_STAGES = ["REPORTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"];
const TECHNICIAN_PRIORITY_GROUPS: Array<{ priority: PriorityType; label: string }> = [
  { priority: "URGENT", label: "Urgent" },
  { priority: "HIGH", label: "Élevée" },
  { priority: "MEDIUM", label: "Moyenne" },
  { priority: "LOW", label: "Faible" },
];

function formatDashboardDate(value?: string) {
  return value ? new Date(value).toLocaleDateString("fr-FR") : "Date indisponible";
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (background = false) => {
    try {
      if (!background) setLoading(true);
      setError(null);
      const res = await fetchWithOffline<DashboardData>("/api/dashboard", {
        cache: "no-store",
      });
      setData(res);
    } catch (err: unknown) {
      console.error("[Dashboard] Erreur chargement :", err);
      setError(err instanceof Error ? err.message : "Erreur de chargement du tableau de bord");
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    const refresh = () => void loadDashboard(true);
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
  }, [loadDashboard]);

  const role = data?.role;
  const pendingInterventions = data?.myInterventions?.pending ?? [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              {role === Role.ADMIN
                ? "Platform Overview"
                : role === Role.SYNDIC
                ? "My Management Dashboard"
                : role === Role.RESIDENT
                ? "My Residence"
                : role === Role.TECHNICIAN
                ? "My Work Dashboard"
                : "Tableau de bord"}
            </h1>
            <p className="text-xs text-slate-500 sm:text-sm dark:text-slate-400">
              {role === Role.ADMIN
                ? "Monitor residences, reclamations, announcements, and maintenance activity across the platform."
                : role === Role.SYNDIC
                ? "Monitor your residences, follow reclamations, and communicate with residents."
                : role === Role.RESIDENT
                ? "Follow your reclamations and stay informed about your residence."
                : role === Role.TECHNICIAN
                ? "Manage your assigned reclamations and track your maintenance activity."
                : "Pilotage SyndicPro"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadDashboard()}
              className="gap-1.5 min-h-[44px] text-xs sm:min-h-[36px]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            {role === Role.RESIDENT && (
              <Link href="/incidents?action=new">
                <Button size="sm" className="gap-1.5 min-h-[44px] text-xs sm:min-h-[36px]">
                  <PlusCircle className="h-4 w-4" />
                  Signaler un incident
                </Button>
              </Link>
            )}
            {(role === Role.ADMIN || role === Role.SYNDIC) && (
              <Link href="/announcements">
                <Button size="sm" className="gap-1.5 min-h-[44px] text-xs sm:min-h-[36px]">
                  <Megaphone className="h-4 w-4" />
                  Gérer les annonces
                </Button>
              </Link>
            )}
            {role === Role.TECHNICIAN && (
              <Link href="/incidents">
                <Button size="sm" className="gap-1.5 min-h-[44px] text-xs sm:min-h-[36px]">
                  <Wrench className="h-4 w-4" />
                  Voir mon travail
                </Button>
              </Link>
            )}
          </div>
        </div>

        {(role === Role.ADMIN || role === Role.SYNDIC) && (
          <BriefingPanel recurringHref="/ai-intelligence#recurring" />
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {(role === Role.ADMIN || role === Role.SYNDIC) && data?.overview && (
          <section aria-label="Vue d'ensemble" className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <DashboardStatCard label="Résidences" value={data.overview.residences ?? 0} icon={Building2} tone="info" />
              <DashboardStatCard label="Utilisateurs actifs" value={data.overview.users ?? 0} icon={Users} />
              <DashboardStatCard label="Résidents" value={data.overview.residents ?? 0} icon={Users} />
              <DashboardStatCard label="Techniciens" value={data.overview.technicians ?? 0} icon={Wrench} />
              <DashboardStatCard label="Réclamations" value={data.overview.incidents ?? 0} icon={AlertTriangle} />
              <DashboardStatCard label="Urgentes" value={data.overview.urgent ?? 0} icon={ShieldAlert} tone="danger" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
              <DashboardStatCard label="Signalées" value={data.overview.reported ?? 0} icon={Clock} tone="warning" />
              <DashboardStatCard label="Assignées" value={data.overview.assigned ?? 0} icon={ClipboardList} />
              <DashboardStatCard label="En cours" value={data.overview.inProgress ?? 0} icon={Wrench} tone="info" />
              <DashboardStatCard label="Résolues" value={data.overview.resolved ?? 0} icon={CheckCircle2} tone="success" />
              <DashboardStatCard label="Résolutions refusées" value={data.overview.rejectedResolutions ?? 0} icon={ShieldAlert} tone="danger" />
              <DashboardStatCard label="Annonces publiées" value={data.overview.publishedAnnouncements ?? 0} icon={Megaphone} />
              <DashboardStatCard label="Annonces programmées" value={data.overview.scheduledAnnouncements ?? 0} icon={Calendar} />
            </div>
          </section>
        )}

        {role === Role.RESIDENT && data?.overview && (
          <section className="space-y-4">
            <Card className="border-sky-200 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/20">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Bienvenue dans votre espace résidence</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {data.residences?.length
                      ? data.residences.map((residence) => [residence.name, residence.city].filter(Boolean).join(" · ")).join(" / ")
                      : "Aucune résidence associée n'est disponible."}
                  </p>
                </div>
                <Link href="/announcements" className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300">Voir les annonces</Link>
              </div>
            </Card>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <DashboardStatCard label="Mes réclamations" value={data.overview.total ?? 0} icon={AlertTriangle} />
              <DashboardStatCard label="À assigner" value={data.overview.reported ?? 0} icon={Clock} tone="warning" />
              <DashboardStatCard label="En cours" value={data.overview.inProgress ?? 0} icon={Wrench} tone="info" />
              <DashboardStatCard label="Résolues" value={data.overview.resolved ?? 0} icon={CheckCircle2} tone="success" />
              <DashboardStatCard label="Annonces non lues" value={data.overview.unreadAnnouncements ?? 0} icon={Megaphone} tone="warning" />
            </div>
          </section>
        )}

        {role === Role.TECHNICIAN && data?.overview && (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Résumé de mon activité">
            <DashboardStatCard label="Affectées" value={data.overview.assigned ?? 0} icon={ClipboardList} tone="warning" />
            <DashboardStatCard label="En cours" value={data.overview.inProgress ?? 0} icon={Wrench} tone="info" />
            <DashboardStatCard label="Urgentes" value={data.overview.urgent ?? 0} icon={ShieldAlert} tone="danger" />
            <DashboardStatCard label="Résolues" value={data.overview.resolved ?? 0} icon={CheckCircle2} tone="success" />
            <DashboardStatCard label="En revue" value={data.overview.awaitingReview ?? 0} icon={Clock} />
            <DashboardStatCard label="Temps moyen" value={data.overview.averageResolutionHours !== undefined ? `${data.overview.averageResolutionHours} h` : "—"} icon={Timer} detail="Sur les dossiers résolus" />
          </section>
        )}

        {/* ======================================================== */}
        {/* 1. VUE ADMIN / SYNDIC : KPI + 2 GRAPHIQUES RECHARTS      */}
        {/* ======================================================== */}
        {(role === Role.ADMIN || role === Role.SYNDIC) && (
          <div className="space-y-6">
            {/* Grille des 4 KPI */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* KPI 1 : Taux de recouvrement du mois */}
              <Card className="border-sky-500/20 bg-gradient-to-br from-white to-sky-50/50 dark:from-slate-900 dark:to-slate-900/60">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Recouvrement mois
                    </span>
                    <TrendingUp className="h-5 w-5 text-sky-500" />
                  </div>
                  {loading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div>
                      <div className="text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">
                        {data?.kpi?.collectionRate ?? 0} %
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Période : {data?.kpi?.period || "En cours"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* KPI 2 : Trésorerie disponible */}
              <Card className="border-emerald-500/20 bg-gradient-to-br from-white to-emerald-50/50 dark:from-slate-900 dark:to-slate-900/60">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Trésorerie nette
                    </span>
                    <Wallet className="h-5 w-5 text-emerald-500" />
                  </div>
                  {loading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div>
                      <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 sm:text-3xl">
                        {(data?.kpi?.treasury ?? 0).toLocaleString("fr-FR", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        €
                      </div>
                      <p className="text-[11px] text-slate-500">Recettes - Dépenses totales</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* KPI 3 : Incidents ouverts */}
              <Card className="border-amber-500/20 bg-gradient-to-br from-white to-amber-50/50 dark:from-slate-900 dark:to-slate-900/60">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Incidents ouverts
                    </span>
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  </div>
                  {loading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div>
                      <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 sm:text-3xl">
                        {data?.kpi?.openIncidents ?? 0}
                      </div>
                      <p className="text-[11px] text-slate-500">En attente ou en cours</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* KPI 4 : Impayés */}
              <Card className="border-rose-500/20 bg-gradient-to-br from-white to-rose-50/50 dark:from-slate-900 dark:to-slate-900/60">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Total impayés
                    </span>
                    <Receipt className="h-5 w-5 text-rose-500" />
                  </div>
                  {loading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div>
                      <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 sm:text-3xl">
                        {(data?.kpi?.unpaidAmount ?? 0).toLocaleString("fr-FR", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        €
                      </div>
                      <p className="text-[11px] text-slate-500">Reste dû par les lots</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 2 Graphiques Recharts */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Graphique 1 : Recettes vs Dépenses par mois */}
              <Card className="p-4">
                <div className="flex items-center justify-between pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <BarChart3 className="h-4 w-4 text-sky-500" />
                      Recettes vs Dépenses (6 derniers mois)
                    </h3>
                    <p className="text-xs text-slate-500">Comparatif des flux de trésorerie en €</p>
                  </div>
                </div>

                {loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <div className="h-64 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.charts?.financialByMonth || []}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => [`${value} €`, ""]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="recettes" name="Recettes (€)" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="depenses" name="Dépenses (€)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>

              {/* Graphique 2 : Incidents par statut */}
              <Card className="p-4">
                <div className="flex items-center justify-between pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <PieIcon className="h-4 w-4 text-sky-500" />
                      Répartition des Incidents par Statut
                    </h3>
                    <p className="text-xs text-slate-500">Nombre d&apos;incidents selon leur étape</p>
                  </div>
                </div>

                {loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <div className="h-64 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data?.charts?.incidentsByStatus || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="count"
                          nameKey="label"
                        >
                          {(data?.charts?.incidentsByStatus || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val) => [`${val} incident(s)`, "Volume"]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>

            <Card>
              <div className="pb-3">
                <h2 className="font-semibold text-slate-900 dark:text-white">Tendance des annonces publiées</h2>
                <p className="text-xs text-slate-500">Publications des six derniers mois dans le périmètre autorisé.</p>
              </div>
              {loading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.charts?.announcementByMonth ?? []}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Annonces publiées" fill="#0284c7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Réclamations à traiter en priorité</h2>
                  <Link href="/incidents" className="text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300">Tout voir</Link>
                </div>
                {!data?.overview?.urgentIncidents?.length ? (
                  <p className="py-4 text-sm text-slate-500">Aucune réclamation urgente ou prioritaire ouverte.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.overview.urgentIncidents.map((incident) => (
                      <li key={incident.id} className="py-3 first:pt-0 last:pb-0">
                        <Link href={`/incidents?incident=${encodeURIComponent(incident.id)}`} className="flex flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{incident.title}</span>
                            <span className="text-xs text-slate-500">{incident.residence} · {incident.category}</span>
                          </span>
                          <Badge priority={incident.priority} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Charge des techniciens</h2>
                  <span className="text-xs text-slate-500">Dossiers affectés ou en cours</span>
                </div>
                {!data?.overview?.technicianWorkload?.length ? (
                  <p className="py-4 text-sm text-slate-500">Aucune charge technicienne à afficher.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.overview.technicianWorkload.map((technician) => (
                      <li key={technician.technicianId} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-200">{technician.name}</span>
                        <span className="shrink-0 text-xs text-slate-500">{technician.assigned} affectée(s) · {technician.inProgress} en cours · {technician.resolved} résolue(s)</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Annonces récentes</h2>
                  <Link href="/announcements" className="text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300">Gérer</Link>
                </div>
                {!data?.overview?.recentAnnouncements?.length ? (
                  <p className="py-4 text-sm text-slate-500">Aucune annonce publiée récemment.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.overview.recentAnnouncements.map((announcement) => (
                      <li key={announcement.id ?? announcement._id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{announcement.title}</span>
                          <span className="text-xs text-slate-500">
                            {announcement.residence || "Résidence"} · {announcement.readPercentage === null
                              ? "Lectures non calculables pour cette audience"
                              : `${announcement.readCount ?? 0}/${announcement.eligibleReadCount ?? 0} lectures (${announcement.readPercentage ?? 0} %)`}
                          </span>
                        </span>
                        {announcement.priority === "URGENT" && <Badge priority={announcement.priority} />}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Actions de gestion</h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Link href="/residences" className="rounded-lg border border-slate-200 p-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">Résidences</Link>
                  <Link href="/users" className="rounded-lg border border-slate-200 p-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">Utilisateurs</Link>
                  <Link href="/incidents" className="rounded-lg border border-slate-200 p-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">Toutes les réclamations</Link>
                  <Link href="/incidents" className="rounded-lg border border-slate-200 p-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">Analyses et filtres de dates</Link>
                  <Link href="/announcements" className="rounded-lg border border-slate-200 p-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">Annonces</Link>
                </div>
              </Card>
            </div>
            <Card>
              <div className="mb-3">
                <h2 className="font-semibold text-slate-900 dark:text-white">Management insights</h2>
                <p className="mt-1 text-xs text-slate-500">Observations générées par l&apos;IA à partir des données autorisées de vos résidences.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <AIReportPanel endpoint="/api/ai/reports/incidents" title="Générer un rapport IA sur les réclamations" />
                <AIReportPanel endpoint="/api/ai/reports/announcements" title="Analyser les annonces" />
              </div>
            </Card>
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. VUE RESIDENT : Ce que je dois, Annonces, Mes incidents*/}
        {/* ======================================================== */}
        {role === Role.RESIDENT && (
          <div className="space-y-6">
            {/* Ce que je dois */}
            <Card className="border-sky-500/20 bg-gradient-to-br from-white to-sky-50/40 p-4 dark:from-slate-900 dark:to-slate-900/60">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Situation de mon compte copropriétaire
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                      {(data?.whatIOwe?.totalDue ?? 0).toFixed(2)} €
                    </span>
                    <span className="text-xs text-slate-500">solde total restant dû</span>
                  </div>
                </div>
                <Link href="/charges">
                  <Button variant="primary" className="min-h-[44px] gap-2 text-xs">
                    <Receipt className="h-4 w-4" />
                    Consulter mes appels de charges
                  </Button>
                </Link>
              </div>

              {data?.whatIOwe?.unpaidCharges && data.whatIOwe.unpaidCharges.length > 0 && (
                <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100 text-xs dark:divide-slate-800 dark:border-slate-800">
                  {data.whatIOwe.unpaidCharges.map((ch) => (
                    <div key={ch._id} className="flex items-center justify-between py-2.5">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Appel de charges — {ch.period}
                        </span>
                        <p className="text-[11px] text-slate-400">
                          Échéance : {new Date(ch.dueDate).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {(ch.remaining ?? ch.amount).toFixed(2)} €
                        </span>
                        <p className="text-[10px] text-slate-400">sur {ch.amount} €</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Dernières annonces */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-sky-500" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Dernières annonces de l&apos;immeuble
                    </h3>
                  </div>
                  <Link href="/announcements" className="text-xs text-sky-600 hover:underline">
                    Tout voir
                  </Link>
                </div>

                {!data?.latestAnnouncements || data.latestAnnouncements.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    Aucune annonce récente publiée.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {data.latestAnnouncements.map((a) => (
                      <div
                        key={a._id}
                        className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                      >
                        <Link href={`/announcements?announcement=${encodeURIComponent(String(a._id))}`} className="block">
                          <div className="flex items-center justify-between gap-2 font-semibold text-slate-900 dark:text-white">
                            <span>{a.title}</span>
                            <span className="flex shrink-0 items-center gap-1">
                              {a.priority === "URGENT" && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">Urgente</span>}
                              {!a.isRead && <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">Non lue</span>}
                              {a.isPinned && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">Épinglée</span>}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-slate-600 dark:text-slate-300">{a.content}</p>
                          <p className="mt-1.5 text-[10px] text-slate-400">{a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("fr-FR") : ""}</p>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Mes incidents */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Mes signalements d&apos;incidents
                    </h3>
                  </div>
                  <Link href="/incidents" className="text-xs text-sky-600 hover:underline">
                    Gérer ({data?.myIncidents?.total ?? 0})
                  </Link>
                </div>

                {!data?.myIncidents?.items || data.myIncidents.items.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Vous n&apos;avez signalé aucun incident pour le moment.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {data.myIncidents.items.map((inc) => (
                      <div
                        key={inc._id}
                        className="rounded-xl border border-slate-100 p-3 text-xs dark:border-slate-800"
                      >
                        <Link href={`/incidents?incident=${encodeURIComponent(inc._id)}`} className="flex items-center justify-between gap-3">
                          <div>
                          <p className="font-bold text-slate-900 dark:text-white">{inc.title}</p>
                          <p className="text-[11px] text-slate-400">
                            {formatDashboardDate(inc.latestUpdate ?? inc.reportedAt)} • {inc.category} • Dernière mise à jour
                          </p>
                          </div>
                          <Badge incidentStatus={inc.status} />
                        </Link>
                        <div className="mt-3">
                          <div className="flex items-center gap-1" aria-label={`Étape actuelle : ${inc.status}`}>
                            {INCIDENT_STAGES.map((stage, index) => {
                              const currentIndex = INCIDENT_STAGES.indexOf(inc.status);
                              const complete = index <= currentIndex;
                              return <span key={stage} className={`h-1.5 flex-1 rounded-full ${complete ? "bg-sky-500" : "bg-slate-200 dark:bg-slate-700"}`} title={stage} />;
                            })}
                          </div>
                          <p className="mt-1 text-[10px] text-slate-400">Signalé → Assigné → En cours → Résolu</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. VUE TECHNICIAN : Mes interventions                      */}
        {/* ======================================================== */}
        {role === Role.TECHNICIAN && (
          <div className="space-y-6">
            {/* KPI Interventions */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card className="border-amber-500/20 bg-amber-50/40 p-4 dark:bg-amber-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-amber-800 dark:text-amber-300">
                    Assignées (À traiter)
                  </span>
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <p className="mt-2 text-3xl font-extrabold text-amber-900 dark:text-amber-200">
                  {data?.myInterventions?.counts?.assigned ?? 0}
                </p>
              </Card>

              <Card className="border-indigo-500/20 bg-indigo-50/40 p-4 dark:bg-indigo-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-indigo-800 dark:text-indigo-300">
                    En cours de réparation
                  </span>
                  <Wrench className="h-5 w-5 text-indigo-500" />
                </div>
                <p className="mt-2 text-3xl font-extrabold text-indigo-900 dark:text-indigo-200">
                  {data?.myInterventions?.counts?.inProgress ?? 0}
                </p>
              </Card>

              <Card className="border-emerald-500/20 bg-emerald-50/40 p-4 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-emerald-800 dark:text-emerald-300">
                    Interventions résolues
                  </span>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="mt-2 text-3xl font-extrabold text-emerald-900 dark:text-emerald-200">
                  {data?.myInterventions?.counts?.resolved ?? 0}
                </p>
              </Card>
            </div>

            {/* Liste des interventions en attente */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-sky-500" />
                  Interventions actives sur le terrain
                </h3>
                <Link href="/incidents" className="text-xs text-sky-600 hover:underline">
                  Ouvrir le module Incidents
                </Link>
              </div>

              {pendingInterventions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Bravo ! Vous n&apos;avez aucune intervention en attente.
                </div>
              ) : (
                <div className="space-y-5">
                  {TECHNICIAN_PRIORITY_GROUPS.map((group) => {
                    const incidents = pendingInterventions.filter((incident) => incident.priority === group.priority);
                    if (incidents.length === 0) return null;
                    return (
                      <section key={group.priority} className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {group.label} <span className="font-medium">({incidents.length})</span>
                        </h4>
                        {incidents.map((it) => (
                          <div
                            key={it._id}
                            className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-center"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white">{it.title}</span>
                                <Badge priority={it.priority} />
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-300">
                                {typeof it.residence === "string"
                                  ? it.residence
                                  : it.residence
                                  ? [it.residence.name, it.residence.city].filter(Boolean).join(" · ")
                                  : "Résidence indisponible"} —{" "}
                                {it.apartment ? `Lot ${it.apartment.number}` : "Parties communes"}
                              </p>
                              <p className="text-[11px] text-slate-400">{it.description}</p>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-center">
                              <Badge incidentStatus={it.status} />
                              <Link href={`/incidents?incident=${encodeURIComponent(it._id)}`}>
                                <Button size="sm" variant="secondary" className="min-h-[44px] gap-1 text-xs">
                                  Traiter
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        ))}
                      </section>
                    );
                  })}
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Historique récent</h2>
                  <Link href="/incidents" className="text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300">Tout l&apos;historique</Link>
                </div>
                {!data?.myInterventions?.recentResolved?.length ? (
                  <p className="py-4 text-sm text-slate-500">Aucune réclamation résolue récemment.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.myInterventions.recentResolved.map((incident) => (
                      <li key={incident._id} className="py-3 first:pt-0 last:pb-0">
                        <Link href={`/incidents?incident=${encodeURIComponent(incident._id)}`} className="flex items-center justify-between gap-3">
                          <span>
                            <span className="block text-sm font-semibold text-slate-900 dark:text-white">{incident.title}</span>
                            <span className="text-xs text-slate-500">{incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleDateString("fr-FR") : "Résolue"} · {incident.resolutionDescription || "Aucun compte rendu disponible"}</span>
                          </span>
                          <Badge incidentStatus={incident.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Annonces de maintenance et sécurité</h2>
                  <Link href="/announcements" className="text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300">Tout voir</Link>
                </div>
                {!data?.latestAnnouncements?.length ? (
                  <p className="py-4 text-sm text-slate-500">Aucune annonce pertinente récente.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.latestAnnouncements.map((announcement) => (
                      <li key={announcement._id ?? announcement.id ?? announcement.title} className="py-3 first:pt-0 last:pb-0">
                        <Link href={`/announcements?announcement=${encodeURIComponent(String(announcement._id ?? announcement.id))}`} className="block">
                          <span className="block text-sm font-semibold text-slate-900 dark:text-white">{announcement.title}</span>
                          <span className="text-xs text-slate-500">{announcement.category} · {announcement.publishedAt ? new Date(announcement.publishedAt).toLocaleDateString("fr-FR") : ""}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        )}
        {data && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <NotificationPreview items={data.latestNotifications} unreadCount={data.overview?.unreadNotifications} />
            <RecentActivityWidget />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
