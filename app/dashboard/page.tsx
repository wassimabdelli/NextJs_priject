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
  Calendar,
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
import { Role } from "@/types/enums";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              Tableau de bord
            </h1>
            <p className="text-xs text-slate-500 sm:text-sm dark:text-slate-400">
              {role === Role.ADMIN
                ? "Vue d'ensemble administrateur — Consolidation globale"
                : role === Role.SYNDIC
                ? "Gestion de copropriété — Indicateurs financiers et opérationnels"
                : role === Role.RESIDENT
                ? "Espace copropriétaire — Mes charges, annonces et demandes"
                : role === Role.TECHNICIAN
                ? "Espace technique — Mes interventions et pannes assignées"
                : "Pilotage SyndicPro"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboard}
              className="gap-1.5 min-h-[44px] text-xs sm:min-h-[36px]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <Link href="/incidents?action=new">
              <Button size="sm" className="gap-1.5 min-h-[44px] text-xs sm:min-h-[36px]">
                <PlusCircle className="h-4 w-4" />
                Signaler un incident
              </Button>
            </Link>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* 1. VUE ADMIN / SYNDIC : KPI + 2 GRAPHIQUES RECHARTS      */}
        {/* ======================================================== */}
        {(role === Role.ADMIN || role === Role.SYNDIC || (!role && !loading)) && (
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
                        <Tooltip formatter={(value: any) => [`${value} €`, ""]} />
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
                          {(data?.charts?.incidentsByStatus || []).map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val: any) => [`${val} incident(s)`, "Volume"]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>
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
                  {data.whatIOwe.unpaidCharges.map((ch: any) => (
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
                    {data.latestAnnouncements.map((a: any) => (
                      <div
                        key={a._id}
                        className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                      >
                        <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white">
                          <span>{a.title}</span>
                          {a.isPinned && (
                            <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-600 font-bold">
                              Épinglé
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-slate-600 dark:text-slate-300">
                          {a.content}
                        </p>
                        <p className="mt-1.5 text-[10px] text-slate-400">
                          {new Date(a.publishedAt).toLocaleDateString("fr-FR")}
                        </p>
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
                    {data.myIncidents.items.map((inc: any) => (
                      <div
                        key={inc._id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-xs dark:border-slate-800"
                      >
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{inc.title}</p>
                          <p className="text-[11px] text-slate-400">
                            {new Date(inc.reportedAt).toLocaleDateString("fr-FR")} • {inc.category}
                          </p>
                        </div>
                        <Badge incidentStatus={inc.status} />
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

              {!data?.myInterventions?.pending || data.myInterventions.pending.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Bravo ! Vous n&apos;avez aucune intervention en attente.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.myInterventions.pending.map((it: any) => (
                    <div
                      key={it._id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-center"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {it.title}
                          </span>
                          <Badge priority={it.priority} />
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {it.residence?.name} ({it.residence?.city}) —{" "}
                          {it.apartment ? `Lot ${it.apartment.number}` : "Parties communes"}
                        </p>
                        <p className="text-[11px] text-slate-400">{it.description}</p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <Badge incidentStatus={it.status} />
                        <Link href="/incidents">
                          <Button size="sm" variant="secondary" className="min-h-[44px] text-xs gap-1">
                            Traiter
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
