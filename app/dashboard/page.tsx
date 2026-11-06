"use client";

import React, { useEffect, useState } from "react";
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
  Building2,
  UserCheck,
  UserX,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { Role } from "@/types/enums";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleApproveJoin = async (id: string) => {
    try {
      setActionLoadingId(id);
      const res = await fetch(`/api/join-requests/${id}/approve`, { method: "PATCH" });
      if (!res.ok) {
        const j = await res.json();
        alert(j.error || "Erreur lors de l'approbation");
        return;
      }
      await loadDashboard();
    } catch {
      alert("Erreur de connexion");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectJoin = async (id: string) => {
    const reason = prompt("Motif du refus (facultatif) :");
    if (reason === null) return;
    try {
      setActionLoadingId(id);
      const res = await fetch(`/api/join-requests/${id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: reason }),
      });
      if (!res.ok) {
        const j = await res.json();
        alert(j.error || "Erreur lors du refus");
        return;
      }
      await loadDashboard();
    } catch {
      alert("Erreur de connexion");
    } finally {
      setActionLoadingId(null);
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchWithOffline<any>("/api/dashboard");
      setData(res);
    } catch (err: unknown) {
      console.error("[Dashboard] Erreur chargement :", err);
      setError(err instanceof Error ? err.message : "Erreur de chargement du tableau de bord");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const role = data?.role;
  const collectionRate = Number(data?.kpi?.collectionRate ?? 0);

  const roleBlurb =
    role === Role.ADMIN
      ? "Vue consolidée de toutes les résidences"
      : role === Role.SYNDIC
        ? "Pilotage financier et opérationnel"
        : role === Role.OWNER
          ? "Charges, annonces et demandes"
          : role === Role.TENANT
            ? "Charges, annonces et demandes"
            : role === Role.TECHNICIAN
              ? "Interventions assignées"
              : "Espace SyndicPro";

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-5">
        {/* En-tête bento */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="sp-page-header min-w-0">
            <p className="text-xs font-semibold text-sky-500">Overview</p>
            <h1 className="sp-title text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
              Tableau de bord
            </h1>
            <p className="sp-body text-sm text-slate-500">{roleBlurb}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={loadDashboard} className="gap-1.5">
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Actualiser
            </Button>
            <Link href="/incidents?action=new">
              <Button size="sm" className="gap-1.5">
                <PlusCircle className="size-4" aria-hidden />
                Signaler
              </Button>
            </Link>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-medium text-rose-700"
          >
            <ShieldAlert className="size-4 shrink-0" aria-hidden />
            <span className="text-pretty">{error}</span>
          </div>
        )}

        {/* ADMIN / SYNDIC */}
        {(role === Role.ADMIN || role === Role.SYNDIC || (!role && !loading)) && (
          <div className="space-y-4">
            {data?.pendingJoinRequests && data.pendingJoinRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="size-4 text-sky-500" aria-hidden />
                    Demandes de rattachement
                  </CardTitle>
                  <CardDescription>
                    {data.pendingJoinRequests.length} demande(s) en attente
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 px-5 pb-5 sm:px-6">
                  {data.pendingJoinRequests.map((req: any) => (
                    <div
                      key={req._id}
                      className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-800/50"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {req.user?.name}
                          </span>
                          <Badge variant={req.residentType === "OWNER" ? "success" : "neutral"}>
                            {req.residentType === "OWNER" ? "Propriétaire" : "Locataire"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {req.residence?.name} — Lot {req.apartmentNumber}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={actionLoadingId === req._id}
                          onClick={() => handleApproveJoin(req._id)}
                          className="gap-1 bg-emerald-500 hover:bg-emerald-600"
                        >
                          <UserCheck className="size-3.5" aria-hidden />
                          Approuver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoadingId === req._id}
                          onClick={() => handleRejectJoin(req._id)}
                          className="gap-1 text-rose-600"
                        >
                          <UserX className="size-3.5" aria-hidden />
                          Refuser
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Bento KPI */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                className="md:col-span-2"
                size="lg"
                label="Recouvrement du mois"
                loading={loading}
                icon={<TrendingUp className="size-5" aria-hidden />}
                value={`${collectionRate} %`}
                trend={{
                  value: data?.kpi?.period || "Période en cours",
                  direction: collectionRate >= 70 ? "up" : collectionRate >= 40 ? "neutral" : "down",
                }}
                footer={
                  <div className="sp-meter">
                    <span style={{ width: `${Math.min(100, collectionRate)}%` }} />
                  </div>
                }
              />
              <StatCard
                label="Trésorerie nette"
                loading={loading}
                icon={<Wallet className="size-5" aria-hidden />}
                value={`${(data?.kpi?.treasury ?? 0).toLocaleString("fr-FR", {
                  maximumFractionDigits: 0,
                })} €`}
                hint="Recettes − dépenses"
                trend={{ value: "Solde consolidé", direction: "neutral" }}
              />
              <StatCard
                label="Incidents ouverts"
                loading={loading}
                icon={<AlertTriangle className="size-5" aria-hidden />}
                value={data?.kpi?.openIncidents ?? 0}
                hint="À traiter"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="size-4 text-sky-500" aria-hidden />
                    Recettes vs dépenses
                  </CardTitle>
                  <CardDescription>6 derniers mois</CardDescription>
                </CardHeader>
                <CardContent className="px-3 pb-5 sm:px-4">
                  {loading ? (
                    <Skeleton className="mx-2 h-72 rounded-2xl" />
                  ) : (
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data?.charts?.financialByMonth || []} barGap={8}>
                          <CartesianGrid strokeDasharray="3 6" stroke="#eef0f3" vertical={false} />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11, fill: "#94a3b8" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#94a3b8" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: 16,
                              border: "1px solid #e8eaed",
                              boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
                              fontSize: 12,
                            }}
                            formatter={(value: any) => [`${value} €`, ""]}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="recettes" name="Recettes" fill="#10b981" radius={[10, 10, 0, 0]} />
                          <Bar dataKey="depenses" name="Dépenses" fill="#fb7185" radius={[10, 10, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieIcon className="size-4 text-sky-500" aria-hidden />
                    Incidents
                  </CardTitle>
                  <CardDescription>Répartition par statut</CardDescription>
                </CardHeader>
                <CardContent className="px-3 pb-5">
                  {loading ? (
                    <Skeleton className="mx-2 h-72 rounded-2xl" />
                  ) : (
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data?.charts?.incidentsByStatus || []}
                            cx="50%"
                            cy="48%"
                            innerRadius={62}
                            outerRadius={90}
                            paddingAngle={4}
                            dataKey="count"
                            nameKey="label"
                            strokeWidth={0}
                          >
                            {(data?.charts?.incidentsByStatus || []).map(
                              (entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              )
                            )}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: 16,
                              border: "1px solid #e8eaed",
                              fontSize: 12,
                            }}
                            formatter={(val: any) => [`${val}`, "Incidents"]}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <StatCard
              label="Total impayés"
              loading={loading}
              icon={<Receipt className="size-5" aria-hidden />}
              value={`${(data?.kpi?.unpaidAmount ?? 0).toLocaleString("fr-FR", {
                maximumFractionDigits: 0,
              })} €`}
              hint="Reste dû par les lots"
              trend={{ value: "À relancer", direction: "down" }}
            />
          </div>
        )}

        {/* OWNER / TENANT */}
        {(role === Role.OWNER || role === Role.TENANT) && (
          <div className="space-y-4">
            {!data?.hasResidence && (
              <Card>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                      <Building2 className="size-5" aria-hidden />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                        {data?.latestJoinRequest?.status === "PENDING"
                          ? "Demande en cours d'examen"
                          : "Rattachement requis"}
                      </h2>
                      <p className="mt-1 text-pretty text-xs text-slate-500">
                        {data?.latestJoinRequest?.status === "PENDING"
                          ? `Résidence ${data.latestJoinRequest.residence?.name} — Lot ${data.latestJoinRequest.apartmentNumber}`
                          : "Soumettez une demande pour accéder aux services de votre immeuble."}
                      </p>
                    </div>
                  </div>
                  <Link href="/join">
                    <Button className="gap-2">
                      <PlusCircle className="size-4" aria-hidden />
                      {data?.latestJoinRequest?.status === "PENDING" ? "Voir ma demande" : "Rattacher"}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <StatCard
                className="lg:col-span-3"
                size="lg"
                label="Solde restant dû"
                icon={<Wallet className="size-5" aria-hidden />}
                value={`${(data?.whatIOwe?.totalDue ?? 0).toFixed(2)} €`}
                hint="Situation de votre compte"
                footer={
                  <Link href="/charges">
                    <Button size="sm" className="gap-1.5">
                      <Receipt className="size-3.5" aria-hidden />
                      Voir mes charges
                    </Button>
                  </Link>
                }
              />
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Appels ouverts</CardTitle>
                  <CardDescription>Dernières échéances</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 px-5 pb-5 sm:px-6">
                  {!data?.whatIOwe?.unpaidCharges?.length ? (
                    <p className="py-6 text-center text-xs text-slate-400">Aucune charge ouverte</p>
                  ) : (
                    data.whatIOwe.unpaidCharges.slice(0, 4).map((ch: any) => (
                      <div
                        key={ch._id}
                        className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2.5 text-xs dark:bg-slate-800/50"
                      >
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{ch.period}</p>
                          <p className="text-slate-400">
                            {new Date(ch.dueDate).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                        <span className="sp-num font-bold text-rose-500">
                          {(ch.remaining ?? ch.amount).toFixed(2)} €
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex-row items-center justify-between sm:flex-row">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Megaphone className="size-4 text-sky-500" aria-hidden />
                      Annonces
                    </CardTitle>
                    <CardDescription>Dernières publications</CardDescription>
                  </div>
                  <Link href="/announcements" className="text-xs font-semibold text-sky-500">
                    Tout voir
                  </Link>
                </CardHeader>
                <CardContent className="space-y-2 px-5 pb-5 sm:px-6">
                  {!data?.latestAnnouncements?.length ? (
                    <p className="py-8 text-center text-xs text-slate-400">Aucune annonce récente</p>
                  ) : (
                    data.latestAnnouncements.map((a: any) => (
                      <div
                        key={a._id}
                        className="rounded-2xl border border-slate-100 px-3.5 py-3 dark:border-slate-800"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {a.title}
                          </p>
                          {a.isPinned && <Badge variant="info">Épinglé</Badge>}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {new Date(a.publishedAt).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="size-4 text-amber-500" aria-hidden />
                        Mes incidents
                      </CardTitle>
                      <CardDescription>
                        {data?.myIncidents?.total ?? 0} signalement(s)
                      </CardDescription>
                    </div>
                    <Link href="/incidents" className="text-xs font-semibold text-sky-500">
                      Gérer
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 px-5 pb-5 sm:px-6">
                  {!data?.myIncidents?.items?.length ? (
                    <p className="py-8 text-center text-xs text-slate-400">Aucun incident signalé</p>
                  ) : (
                    data.myIncidents.items.map((inc: any) => (
                      <div
                        key={inc._id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-3.5 py-3 dark:border-slate-800"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {inc.title}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {new Date(inc.reportedAt).toLocaleDateString("fr-FR")} · {inc.category}
                          </p>
                        </div>
                        <Badge incidentStatus={inc.status} />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* TECHNICIAN */}
        {role === Role.TECHNICIAN && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label="Assignées"
                icon={<Clock className="size-5" aria-hidden />}
                value={data?.myInterventions?.counts?.assigned ?? 0}
                hint="À traiter"
              />
              <StatCard
                label="En cours"
                icon={<Wrench className="size-5" aria-hidden />}
                value={data?.myInterventions?.counts?.inProgress ?? 0}
                hint="Sur le terrain"
              />
              <StatCard
                label="Résolues"
                icon={<CheckCircle2 className="size-5" aria-hidden />}
                value={data?.myInterventions?.counts?.resolved ?? 0}
                hint="Clôturées"
                trend={{ value: "Bon rythme", direction: "up" }}
              />
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="size-4 text-sky-500" aria-hidden />
                      Interventions actives
                    </CardTitle>
                    <CardDescription>Priorisez vos interventions du jour</CardDescription>
                  </div>
                  <Link href="/incidents" className="text-xs font-semibold text-sky-500">
                    Module incidents
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 px-5 pb-5 sm:px-6">
                {!data?.myInterventions?.pending?.length ? (
                  <p className="py-10 text-center text-sm text-slate-400">
                    Aucune intervention en attente
                  </p>
                ) : (
                  data.myInterventions.pending.map((it: any) => (
                    <div
                      key={it._id}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900 dark:text-white">{it.title}</p>
                          <Badge priority={it.priority} />
                        </div>
                        <p className="text-xs text-slate-500">
                          {it.residence?.name}
                          {it.apartment ? ` — Lot ${it.apartment.number}` : " — Parties communes"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge incidentStatus={it.status} />
                        <Link href="/incidents">
                          <Button size="sm" variant="secondary" className="gap-1">
                            Traiter
                            <ArrowRight className="size-3.5" aria-hidden />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
