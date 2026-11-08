"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, LoaderCircle, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedResource: { resourceType: string; resourceId?: string | null };
}

const labels: Record<string, string> = {
  INCIDENT_CREATED: "Nouvelle réclamation",
  INCIDENT_ASSIGNED: "Attribution",
  INCIDENT_STATUS_CHANGED: "Statut",
  INCIDENT_COMMENTED: "Commentaire",
  INCIDENT_RESOLUTION_SUBMITTED: "Résolution proposée",
  INCIDENT_RESOLUTION_CONFIRMED: "Résolution confirmée",
  INCIDENT_RESOLUTION_REJECTED: "Résolution refusée",
  ANNOUNCEMENT_PUBLISHED: "Annonce",
  ANNOUNCEMENT_EXPIRING: "Annonce à échéance",
  SYSTEM: "Système",
};

function notifyOtherTabs() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel("syndicpro-notifications");
  channel.postMessage("refresh");
  channel.close();
}

function notificationHref(item: NotificationItem) {
  return item.relatedResource.resourceType === "INCIDENT" && item.relatedResource.resourceId
    ? `/incidents?incident=${encodeURIComponent(item.relatedResource.resourceId)}`
    : item.relatedResource.resourceType === "INCIDENT" ? "/incidents"
    : item.relatedResource.resourceType === "ANNOUNCEMENT" && item.relatedResource.resourceId
    ? `/announcements?announcement=${encodeURIComponent(item.relatedResource.resourceId)}`
    : item.relatedResource.resourceType === "ANNOUNCEMENT" ? "/announcements"
    : "/notifications";
}

export function NotificationCenter({ userId }: { userId?: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [read, setRead] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
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
      if (read) params.set("read", read);
      if (type) params.set("type", type);
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`/api/notifications?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Impossible de charger les notifications.");
      setRows(payload.data);
      setTotal(payload.meta.total);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }, [page, read, search, type, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!userId) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [load, userId]);

  const markRead = async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      if (!response.ok) {
        setError("Impossible de mettre à jour cette notification.");
        return false;
      }
      notifyOtherTabs();
      await load();
      return true;
    } catch {
      setError("Connexion indisponible : la notification n'a pas été mise à jour.");
      return false;
    }
  };

  const dismiss = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      if (!response.ok) {
        setError("Impossible de supprimer cette notification.");
        return;
      }
      notifyOtherTabs();
      await load();
    } catch {
      setError("Connexion indisponible : la notification n'a pas été supprimée.");
    }
  };

  const markAll = async () => {
    try {
      const response = await fetch("/api/notifications/read-all", { method: "PATCH" });
      if (!response.ok) {
        setError("Impossible de mettre à jour les notifications.");
        return;
      }
      notifyOtherTabs();
      await load();
    } catch {
      setError("Connexion indisponible : les notifications n'ont pas été mises à jour.");
    }
  };

  const openItem = async (item: NotificationItem) => {
    if (!item.isRead && !(await markRead(item._id))) return;
    router.push(notificationHref(item));
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">Centre de notifications</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Vos notifications</h1>
          </div>
          <Button variant="secondary" onClick={() => void markAll()}>
            <Check className="mr-2 h-4 w-4" /> Tout marquer comme lu
          </Button>
        </div>

        <Card><CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Rechercher..."
            aria-label="Rechercher dans les notifications"
            className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <select value={read} onChange={(event) => { setRead(event.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">Toutes</option><option value="false">Non lues</option><option value="true">Lues</option>
          </select>
          <select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">Tous les types</option>
            {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </CardContent></Card>

        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
        <div className="space-y-3">
          {loading && rows.length === 0 ? (
            <Card><CardContent className="flex items-center justify-center gap-2 p-10 text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin" />Chargement…</CardContent></Card>
          ) : rows.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center p-10 text-center">
              <Bell className="h-8 w-8 text-slate-400" /><p className="mt-3 font-semibold text-slate-800 dark:text-white">Aucune notification</p>
              <p className="mt-1 text-sm text-slate-500">Les mises à jour pertinentes apparaîtront ici.</p>
            </CardContent></Card>
          ) : rows.map((item) => (
            <Card key={item._id} className={item.isRead ? "" : "border-sky-200 dark:border-sky-900"}>
              <CardContent className={`flex items-start gap-3 p-4 ${item.title === "Annonce urgente" ? "bg-rose-50/60 dark:bg-rose-950/20" : item.title === "Annonce importante" ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}`}>
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.isRead ? "bg-slate-300" : "bg-sky-500"}`} />
                <button type="button" onClick={() => void openItem(item)} className="min-w-0 flex-1 text-left">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{item.title}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{labels[item.type] ?? "Notification"}</span>
                  </span>
                  <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{item.message}</span>
                  <time className="mt-2 block text-xs text-slate-400" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
                </button>
                {!item.isRead && <button aria-label="Marquer comme lu" onClick={() => void markRead(item._id)} className="rounded-lg p-2 text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/30"><Check className="h-4 w-4" /></button>}
                <button aria-label="Supprimer la notification" onClick={() => void dismiss(item._id)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"><Trash2 className="h-4 w-4" /></button>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
          <span>{total} notification(s)</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</Button>
            <Button variant="secondary" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)}>Suivant</Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
