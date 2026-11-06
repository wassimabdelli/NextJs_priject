"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, MessageCircle, Smartphone } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { reminderTypeLabel, type ReminderType } from "@/types/enums";

export default function NotificationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [n, p] = await Promise.all([
      fetch("/api/notifications").then((r) => r.json()),
      fetch("/api/notifications/prefs").then((r) => r.json()),
    ]);
    setItems(n.data || []);
    setUnread(n.meta?.unread || 0);
    setPrefs(p);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await load();
  };

  const savePrefs = async (patch: Record<string, unknown>) => {
    const res = await fetch("/api/notifications/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Erreur");
      return;
    }
    setPrefs((prev: any) => ({ ...prev, ...data }));
    setMessage("Préférences enregistrées");
  };

  const runReminders = async () => {
    const res = await fetch("/api/reminders/run", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Accès refusé (syndic/admin)");
      return;
    }
    setMessage(`Rappels : ${data.unpaid} charges, ${data.meetings} AG`);
    await load();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-balance text-2xl font-bold text-slate-900 dark:text-white">
              Notifications
            </h1>
            <p className="text-pretty text-sm text-slate-500 dark:text-slate-400">
              In-app, WhatsApp et rappels charges / AG / incidents
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="min-h-[44px] gap-2"
              onClick={markAllRead}
              disabled={unread === 0}
            >
              <CheckCheck className="h-4 w-4" /> Tout lire ({unread})
            </Button>
            <Button variant="primary" className="min-h-[44px]" onClick={runReminders}>
              Lancer rappels
            </Button>
          </div>
        </div>

        {message && (
          <div className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
            {message}
          </div>
        )}

        {prefs && (
          <Card>
            <CardContent className="space-y-4 p-4">
              <h2 className="font-bold text-slate-900 dark:text-white">Canaux</h2>
              <label className="flex min-h-[44px] items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.notifyInApp !== false}
                  onChange={(e) => savePrefs({ notifyInApp: e.target.checked })}
                />
                <Bell className="h-4 w-4" /> Notifications in-app
              </label>
              <label className="flex min-h-[44px] items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={!!prefs.notifyWhatsApp}
                  onChange={(e) => savePrefs({ notifyWhatsApp: e.target.checked })}
                />
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </label>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Téléphone WhatsApp</label>
                <input
                  className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-900"
                  defaultValue={prefs.phone || ""}
                  placeholder="+216…"
                  onBlur={(e) => {
                    if (e.target.value !== (prefs.phone || "")) {
                      savePrefs({ phone: e.target.value });
                    }
                  }}
                />
              </div>
              <label className="flex min-h-[44px] items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={!!prefs.notifyPush}
                  onChange={(e) => savePrefs({ notifyPush: e.target.checked })}
                />
                <Smartphone className="h-4 w-4" /> Push navigateur (VAPID)
              </label>
              <p className="text-[11px] text-slate-500">
                WaAPI : WHATSAPP_TOKEN + WAAPI_INSTANCE_ID dans .env.local.
                Crée une instance sur waapi.app, scanne le QR, puis redémarre npm run
                dev. Téléphone au format international (ex. 216XXXXXXXX).
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <h2 className="text-sm font-bold uppercase text-slate-500">
            Boîte de réception
          </h2>
          {loading ? (
            <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune notification.</p>
          ) : (
            items.map((n) => (
              <Card key={n._id} className={!n.readAt ? "border-sky-300" : undefined}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{n.title}</p>
                      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{n.body}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {reminderTypeLabel[n.type as ReminderType] || n.type} ·{" "}
                        {new Date(n.createdAt).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    {!n.readAt && (
                      <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-bold text-white">
                        Nouveau
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
