"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, ExternalLink, LoaderCircle } from "lucide-react";
import Link from "next/link";

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedResource: { resourceType: string; resourceId?: string | null };
}

interface NotificationResponse {
  data: NotificationItem[];
  unreadCount: number;
}

const channelName = "syndicpro-notifications";

function resourceHref(item: NotificationItem) {
  if (item.relatedResource.resourceType === "INCIDENT" && item.relatedResource.resourceId) {
    return `/incidents?incident=${encodeURIComponent(item.relatedResource.resourceId)}`;
  }
  if (item.relatedResource.resourceType === "ANNOUNCEMENT" && item.relatedResource.resourceId) {
    return `/announcements?announcement=${encodeURIComponent(item.relatedResource.resourceId)}`;
  }
  if (item.relatedResource.resourceType === "ANNOUNCEMENT") return "/announcements";
  return "/notifications";
}

function broadcastRefresh() {
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(channelName);
    channel.postMessage("refresh");
    channel.close();
  }
}

export function NotificationBell({ userId }: { userId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!userId || document.visibilityState === "hidden") return;
    try {
      const response = await fetch("/api/notifications?limit=5", { cache: "no-store" });
      if (!response.ok) throw new Error("Les notifications ne sont pas disponibles.");
      const result = (await response.json()) as NotificationResponse;
      setNotifications(result.data);
      setUnreadCount(result.unreadCount);
      setError("");
    } catch {
      setError("Notifications non actualisées. Vérifiez votre connexion.");
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 15_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let channel: BroadcastChannel | undefined;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(channelName);
      channel.onmessage = () => void refresh();
    }
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(initialTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      channel?.close();
    };
  }, [refresh, userId]);

  const markAllRead = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications/read-all", { method: "PATCH" });
      if (!response.ok) throw new Error("Impossible de marquer les notifications comme lues.");
      broadcastRefresh();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const openNotification = async (item: NotificationItem) => {
    if (!item.isRead) {
      const response = await fetch(`/api/notifications/${item._id}/read`, { method: "PATCH" });
      if (!response.ok) {
        setError("Impossible de marquer cette notification comme lue.");
        return;
      }
      broadcastRefresh();
    }
    setOpen(false);
    router.push(resourceHref(item));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void refresh();
        }}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} non lues` : ""}`}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="font-semibold text-slate-900 dark:text-white">Notifications</h2>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={loading || unreadCount === 0}
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 disabled:opacity-40 dark:text-sky-300"
            >
              {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Tout lire
            </button>
          </div>
          {error && <p role="status" className="px-4 py-2 text-xs text-amber-700 dark:text-amber-300">{error}</p>}
          <div className="max-h-[min(60vh,26rem)] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Aucune notification.</p>
            ) : notifications.map((item) => (
              <button
                type="button"
                key={item._id}
                onClick={() => void openNotification(item)}
                className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 ${item.title === "Annonce urgente" ? "bg-rose-50/70 dark:bg-rose-950/20" : item.title === "Annonce importante" ? "bg-amber-50/70 dark:bg-amber-950/20" : ""}`}
              >
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.isRead ? "bg-slate-300 dark:bg-slate-600" : "bg-sky-500"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{item.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-slate-600 dark:text-slate-300">{item.message}</span>
                  <time className="mt-1 block text-[11px] text-slate-400" dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </span>
              </button>
            ))}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/30"
          >
            Toutes les notifications <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
