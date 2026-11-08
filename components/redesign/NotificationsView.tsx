"use client";

import React from "react";
import {
  Bell,
  Send,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { reminderTitle, formatDateFrShort } from "@/components/redesign/apiMappers";
import { Role as ApiRole } from "@/types/enums";

type ReminderRow = {
  _id: string;
  title: string;
  body: string;
  type?: string;
  createdAt?: string;
  readAt?: string;
};

type NotifListRes = { data: ReminderRow[]; meta?: { unread?: number } };
type PrefsRes = {
  phone: string;
  notifyInApp: boolean;
  notifyWhatsApp: boolean;
  notifyPush: boolean;
};

/** Affiche une date fixe (pas Date.now — Cache Components / prerender). */
function relativeTime(iso: string | undefined): string {
  return formatDateFrShort(iso);
}

export const NotificationsView: React.FC = () => {
  const [whatsapp, setWhatsapp] = React.useState(true);
  const [inApp, setInApp] = React.useState(true);
  const [push, setPush] = React.useState(false);
  const [phone, setPhone] = React.useState("+216 20 000 001");
  const [remindersSent, setRemindersSent] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [prefsError, setPrefsError] = React.useState<string | null>(null);
  const [notifications, setNotifications] = React.useState<
    Array<{ id: string; title: string; desc: string; time: string; read: boolean }>
  >([]);
  const [sessionRole, setSessionRole] = React.useState<string | null>(null);

  const loadPrefs = React.useCallback(async () => {
    const data = await fetchWithOffline<PrefsRes>("/api/notifications/prefs");
    setInApp(data.notifyInApp !== false);
    setWhatsapp(!!data.notifyWhatsApp);
    setPush(!!data.notifyPush);
    if (data.phone) setPhone(data.phone);
  }, []);

  const loadInbox = React.useCallback(async () => {
    const json = await fetchWithOffline<NotifListRes>("/api/notifications?limit=50");
    setNotifications(
      (json.data || []).map((n) => ({
        id: n._id,
        title: reminderTitle(n.type, n.title),
        desc: n.body,
        time: relativeTime(n.createdAt),
        read: Boolean(n.readAt),
      }))
    );
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sess = (await fetch("/api/auth/session").then((r) => r.json())) as { user?: { role?: string } };
      setSessionRole(sess?.user?.role ?? null);
      await Promise.all([loadPrefs(), loadInbox()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [loadInbox, loadPrefs]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const savePrefs = React.useCallback(
    async (patch: Partial<PrefsRes>) => {
      setPrefsError(null);
      try {
        await fetchWithOffline("/api/notifications/prefs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
      } catch (e) {
        setPrefsError(e instanceof Error ? e.message : "Préférences non enregistrées");
      }
    },
    []
  );

  const handleSendReminders = async () => {
    setPrefsError(null);
    try {
      await fetchWithOffline("/api/reminders/run", { method: "POST" });
      setRemindersSent(true);
      setTimeout(() => setRemindersSent(false), 4000);
    } catch (e) {
      setPrefsError(e instanceof Error ? e.message : "Relances non autorisées");
    }
  };

  const handleMarkAllRead = async () => {
    setError(null);
    try {
      await fetchWithOffline("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec");
    }
  };

  const canRunReminders = sessionRole === ApiRole.ADMIN || sessionRole === ApiRole.SYNDIC;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Centre de Messages
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
            Notifications & Relances
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Canaux multicanaux (In-App, WhatsApp, Push) et gestion automatisée des relances d’impayés
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => void handleMarkAllRead()}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-white/[0.08] transition-colors"
          >
            Tout marquer comme lu
          </button>
          <button
            onClick={() => void handleSendReminders()}
            disabled={!canRunReminders}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Lancer rappels charges</span>
          </button>
        </div>
      </div>

      {prefsError && (
        <div
          role="alert"
          className="glass-card rounded-3xl p-4 border border-rose-500/25 bg-rose-500/10 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{prefsError}</span>
        </div>
      )}

      {remindersSent && (
        <div className="p-4 rounded-2xl glass-card border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Traitement des rappels planifiés lancé côté serveur.</span>
        </div>
      )}

      <div className="p-6 rounded-3xl glass-card space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Canaux de diffusion configurés</h3>

        <div className="space-y-3 text-xs max-w-xl">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={inApp}
              onChange={(e) => {
                const v = e.target.checked;
                setInApp(v);
                void savePrefs({ notifyInApp: v });
              }}
              className="rounded text-blue-600 cursor-pointer w-4 h-4"
            />
            <span className="text-slate-700 dark:text-slate-200 font-bold">Notifications in-app prioritaires</span>
          </label>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={whatsapp}
                onChange={(e) => {
                  const v = e.target.checked;
                  setWhatsapp(v);
                  void savePrefs({ notifyWhatsApp: v });
                }}
                className="rounded text-blue-600 cursor-pointer w-4 h-4"
              />
              <span className="text-slate-700 dark:text-slate-200 font-bold">WhatsApp direct certifié (API WaAPI)</span>
            </label>

            {whatsapp && (
              <div className="pl-7 space-y-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Numéro WhatsApp du syndic émetteur</span>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => void savePrefs({ phone })}
                  className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs font-semibold"
                />
              </div>
            )}
          </div>

          <label className="flex items-center gap-3 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={push}
              onChange={(e) => {
                const v = e.target.checked;
                setPush(v);
                void savePrefs({ notifyPush: v });
              }}
              className="rounded text-blue-600 cursor-pointer w-4 h-4"
            />
            <span className="text-slate-700 dark:text-slate-200 font-bold">Push navigateur (Web Push VAPID)</span>
          </label>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="glass-card rounded-3xl p-4 border border-rose-500/25 bg-rose-500/10 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="p-6 rounded-3xl glass-card space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Boîte de réception ({notifications.length})</h3>

        {loading ? (
          <div className="h-32 rounded-2xl bg-slate-100/50 dark:bg-white/[0.03] animate-pulse" />
        ) : notifications.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">Aucune notification.</p>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 rounded-2xl border transition-colors flex items-start justify-between gap-4 ${
                  n.read
                    ? "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200/60 dark:border-white/[0.04]"
                    : "bg-blue-50/70 dark:bg-blue-600/15 border-blue-500/25 shadow-xs"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      n.read ? "bg-slate-100 dark:bg-white/[0.05] text-slate-400" : "bg-blue-600 text-white"
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{n.title}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{n.desc}</p>
                  </div>
                </div>

                <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">{n.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
