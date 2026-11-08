"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Clock3, MessageCircle, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface HistoryEntry {
  _id: string;
  action: string;
  description: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
  actor?: { name?: string; role?: string } | null;
}

const actionIcons: Record<string, typeof Activity> = {
  CREATED: Activity,
  ASSIGNED: UserCheck,
  COMMENT_ADDED: MessageCircle,
  RESOLUTION_CONFIRMED: CheckCircle2,
  RESOLUTION_SUBMITTED: CheckCircle2,
  RESOLUTION_REJECTED: AlertCircle,
};

export function IncidentHistory({ incidentId }: { incidentId: string }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/history?limit=50`, { signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger l'historique.");
      setEntries(Array.isArray(result.data) ? result.data : []);
      setTotal(Number(result.meta?.total) || 0);
      setPage(Number(result.meta?.page) || 1);
    } catch (err) {
      if (!signal.aborted) {
        setError(err instanceof Error ? err.message : "Impossible de charger l'historique.");
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, reload]);

  const loadMore = async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/history?page=${page + 1}&limit=50`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger la suite de l'historique.");
      setEntries((current) => [...current, ...(Array.isArray(result.data) ? result.data : [])]);
      setPage(Number(result.meta?.page) || page + 1);
      setTotal(Number(result.meta?.total) || total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger la suite de l'historique.");
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-3" aria-label="Chargement de l'historique">
      {[1, 2, 3].map((item) => <div key={item} className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800" />)}
    </div>;
  }

  if (error) {
    return <div role="alert" className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
      <p>{error}</p>
      <Button variant="outline" size="sm" onClick={() => setReload((value) => value + 1)}>Réessayer</Button>
    </div>;
  }

  if (entries.length === 0) {
    return <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">Aucun historique pour le moment.</p>;
  }

  return (
    <div className="space-y-3">
    <ol className="space-y-0">
      {[...entries].reverse().map((entry, index) => {
        const Icon = actionIcons[entry.action] || Clock3;
        return (
          <li key={entry._id} className="relative flex gap-3 pb-5 last:pb-0">
            {index < entries.length - 1 && <span aria-hidden="true" className="absolute left-4 top-9 h-full w-px bg-slate-200 dark:bg-slate-700" />}
            <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{entry.description}</p>
              {entry.oldValue && entry.newValue && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {entry.oldValue} <span aria-hidden="true">→</span> {entry.newValue}
                </p>
              )}
              {entry.newValue && entry.action === "RESOLUTION_REJECTED" && (
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400">{entry.newValue}</p>
              )}
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {entry.actor?.name || "Utilisateur"}{entry.actor?.role ? ` · ${entry.actor.role}` : ""}
                {" · "}
                <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString("fr-FR")}>
                  {new Date(entry.createdAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                </time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
    {entries.length < total && (
      <Button variant="outline" size="sm" isLoading={loadingMore} onClick={() => void loadMore()}>
        Afficher l&apos;historique précédent
      </Button>
    )}
    {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
