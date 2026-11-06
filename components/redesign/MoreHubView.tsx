"use client";

import React from "react";
import {
  Building2,
  Receipt,
  FileText,
  AlertTriangle,
  Users,
  Vote,
  Calendar,
  Sparkles,
  Wifi,
  WifiOff,
  Smartphone,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getOfflineDB, clearAllOfflineData, type OutboxItem } from "@/lib/offline/db";

interface MoreHubViewProps {
  onNavigate: (tab: string) => void;
}

/** Libellé court pour une entrée outbox (Dexie). */
function formatOutboxPreview(item: OutboxItem): string {
  const ent = item.entity || "requête";
  return `${item.method} · ${ent}`;
}

export const MoreHubView: React.FC<MoreHubViewProps> = ({ onNavigate }) => {
  const { isOnline, hydrated, pendingCount, isSyncing, syncNow, refreshPendingCount } =
    useOnlineStatus();
  const [syncMessage, setSyncMessage] = React.useState<string | null>(null);
  const [clearingCache, setClearingCache] = React.useState(false);
  const [swSummary, setSwSummary] = React.useState<string>("—");
  const [outboxItems, setOutboxItems] = React.useState<OutboxItem[]>([]);

  const modules = [
    {
      id: "charges",
      title: "Charges & Cotisations",
      desc: "Appels de fonds et états financiers",
      icon: Receipt,
      color: "text-blue-500",
    },
    {
      id: "expenses",
      title: "Dépenses & Factures",
      desc: "Fournisseurs et contrats STEG / Ascenseur",
      icon: FileText,
      color: "text-rose-500",
    },
    {
      id: "incidents",
      title: "Incidents & Pannes",
      desc: "Signalements et fiches d’intervention",
      icon: AlertTriangle,
      color: "text-amber-500",
    },
    {
      id: "meetings",
      title: "Assemblées Générales",
      desc: "Séances AG, quorum légal et procès-verbaux",
      icon: Calendar,
      color: "text-purple-500",
    },
    {
      id: "resolutions",
      title: "Résolutions & Votes",
      desc: "Dépouillement et majorités en ligne",
      icon: Vote,
      color: "text-indigo-500",
    },
    {
      id: "elections",
      title: "Élections du Syndic",
      desc: "Candidatures et scrutin démocratique",
      icon: Users,
      color: "text-emerald-500",
    },
    {
      id: "payments",
      title: "Paiements & Reçus",
      desc: "Encaissements certifiés et grand livre",
      icon: Receipt,
      color: "text-teal-500",
    },
    {
      id: "apartments",
      title: "Appartements & Lots",
      desc: "Cadastre, millièmes et clés de charges",
      icon: Building2,
      color: "text-sky-500",
    },
    {
      id: "residents",
      title: "Fiches Copropriétaires",
      desc: "Annuaire certifié des résidents et rôles",
      icon: Users,
      color: "text-cyan-500",
    },
    {
      id: "documents",
      title: "Documents & Contrats",
      desc: "Coffre-fort d’archivage réglementaire",
      icon: FileText,
      color: "text-violet-500",
    },
    {
      id: "announcements",
      title: "Panneau d’Affichage",
      desc: "Annonces officielles de la résidence",
      icon: Sparkles,
      color: "text-amber-500",
    },
    {
      id: "wallet",
      title: "Portefeuille Résident",
      desc: "Règlements D17, Flip et cartes virtuelles",
      icon: Receipt,
      color: "text-pink-500",
    },
  ];

  const refreshOutboxList = React.useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const db = getOfflineDB();
      if (!db.outbox) return;
      const rows = await db.outbox.orderBy("createdAt").reverse().limit(30).toArray();
      setOutboxItems(rows);
    } catch {
      setOutboxItems([]);
    }
  }, []);

  React.useEffect(() => {
    refreshOutboxList();
  }, [refreshOutboxList, pendingCount]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setSwSummary("Non supporté");
      return;
    }
    let cancelled = false;
    navigator.serviceWorker.getRegistrations().then((regs) => {
      if (cancelled) return;
      const reg = regs[0];
      const state = reg?.active?.state || reg?.installing?.state || "inconnu";
      const scope = reg?.scope || "/";
      const ctrl = navigator.serviceWorker.controller ? "contrôleur actif" : "sans contrôleur";
      setSwSummary(`/sw.js · état ${state} · ${ctrl} · scope ${scope}`);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleManualSync = async () => {
    setSyncMessage(null);
    await syncNow();
    await refreshOutboxList();
    setSyncMessage("Synchronisation terminée.");
    setTimeout(() => setSyncMessage(null), 4000);
  };

  const handleClearIndexedDb = async () => {
    setClearingCache(true);
    setSyncMessage(null);
    try {
      await clearAllOfflineData(true);
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      await refreshPendingCount();
      await refreshOutboxList();
      setSyncMessage("Cache local IndexedDB et Cache Storage vidés.");
    } catch {
      setSyncMessage("Impossible de vider complètement le stockage local.");
    } finally {
      setClearingCache(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  const networkOk = hydrated ? isOnline : true;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          Supervision & Centre Opérationnel
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
          Gestion & Modules de Copropriété
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Supervision des résidences, synchronisation hors ligne et administration globale
        </p>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Tous les modules disponibles
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {modules.map((m, idx) => {
            const Icon = m.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onNavigate(m.id)}
                className="p-4 rounded-3xl glass-card hover:scale-[1.02] transition-all text-left flex items-start gap-3.5 group shadow-xs min-h-[44px]"
              >
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.06] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Icon className={`w-5 h-5 ${m.color}`} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                    {m.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {m.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
        <div className="p-6 rounded-3xl glass-card space-y-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${
                networkOk
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25"
              }`}
            >
              {networkOk ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                Connectivité réseau
              </h3>
              <p
                className={`text-[11px] font-semibold ${
                  networkOk
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {networkOk
                  ? "En ligne — prêt pour la synchronisation SyndicPro"
                  : "Hors ligne — les mutations sont mises en file d’attente"}
              </p>
            </div>
          </div>

          <div className="bg-slate-50/80 dark:bg-white/[0.02] p-3 rounded-2xl border border-slate-200/60 dark:border-white/[0.04] flex items-center justify-between text-xs font-mono">
            <span className="text-slate-500 dark:text-slate-400">Modifications en file :</span>
            <span className="text-slate-900 dark:text-white font-bold">
              {pendingCount} élément(s)
            </span>
          </div>

          <button
            type="button"
            onClick={() => void handleManualSync()}
            disabled={isSyncing || !networkOk}
            className="w-full min-h-[44px] py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
          >
            {isSyncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>{isSyncing ? "Synchronisation…" : "Forcer la synchronisation manuelle"}</span>
          </button>

          {syncMessage && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              {syncMessage}
            </p>
          )}
        </div>

        <div className="p-6 rounded-3xl glass-card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                Service Worker & PWA
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono break-all">
                {swSummary}
              </p>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-[11px] gap-2">
              <span className="text-slate-500 dark:text-slate-400">Enregistrement :</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold text-right">
                /sw.js (production)
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">Navigateur :</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {"serviceWorker" in navigator ? "API disponible" : "Non disponible"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleClearIndexedDb()}
            disabled={clearingCache}
            className="w-full min-h-[44px] py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {clearingCache ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
            ) : (
              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>Vider le cache local IndexedDB</span>
          </button>
        </div>
      </div>

      <div className="p-5 rounded-3xl glass-card space-y-3">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
          File d’attente Outbox ({outboxItems.length})
        </h3>
        {outboxItems.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-white/[0.02] p-4 rounded-2xl border border-slate-200/60 dark:border-white/[0.04] text-center font-medium">
            Aucune mutation locale en attente — ou Dexie non initialisé sur cet appareil.
          </p>
        ) : (
          <ul className="max-h-48 overflow-y-auto space-y-2 text-[11px]">
            {outboxItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 p-3 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]"
              >
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {formatOutboxPreview(item)}
                </span>
                <span className="text-slate-500 shrink-0">{item.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
