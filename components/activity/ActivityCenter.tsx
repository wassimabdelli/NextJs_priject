"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Megaphone, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ActivityItem {
  id: string;
  kind: "INCIDENT" | "ANNOUNCEMENT";
  title: string;
  message: string;
  createdAt: string;
  href: string;
}

export function ActivityCenter({ userId }: { userId?: string }) {
  const [rows, setRows] = useState<ActivityItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [kind, setKind] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setError("Authentification requise.");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (kind) params.set("kind", kind);
      const response = await fetch(`/api/activity?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Impossible de charger l'activité.");
      setRows(payload.data);
      setTotal(payload.meta.total);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }, [kind, page, userId]);

  useEffect(() => {
    if (!userId) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, userId]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">Historique partagé</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Centre d’activité</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Événements visibles selon votre rôle et vos accès.</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={kind} onChange={(event) => { setKind(event.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
              <option value="">Tous les événements</option><option value="INCIDENT">Réclamations</option><option value="ANNOUNCEMENT">Annonces</option>
            </select>
            <Button variant="secondary" onClick={() => void load()} disabled={loading} aria-label="Actualiser l’activité">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}

        <Card><CardContent className="p-4 sm:p-6">
          {rows.length === 0 && !loading ? (
            <div className="py-10 text-center text-sm text-slate-500">Aucune activité pour ces filtres.</div>
          ) : (
            <ol className="space-y-0">
              {rows.map((item, index) => {
                const Icon = item.kind === "INCIDENT" ? AlertTriangle : Megaphone;
                return (
                  <li key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {index < rows.length - 1 && <span className="absolute left-[17px] top-9 h-[calc(100%-1.25rem)] w-px bg-slate-200 dark:bg-slate-700" />}
                    <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.kind === "INCIDENT" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" : "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={item.href} className="font-semibold text-slate-900 hover:text-sky-700 dark:text-white dark:hover:text-sky-300">{item.title}</Link>
                      <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-300">{item.message}</p>
                      <time className="mt-1 block text-xs text-slate-400" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent></Card>
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
          <span>{total} événement(s)</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</Button>
            <Button variant="secondary" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)}>Suivant</Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
