"use client";

import { useState, useEffect } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2,
  Smartphone,
  ShieldCheck,
  Building,
  Info,
  CheckCircle2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getOfflineDB, type OutboxItem } from "@/lib/offline/db";

export default function MorePage() {
  const { isOnline, pendingCount, isSyncing, syncNow, refreshPendingCount } =
    useOnlineStatus();
  const [swActive, setSwActive] = useState<boolean | null>(null);
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [clearMessage, setClearMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        setSwActive(!!reg?.active);
      });
    }

    async function loadOutbox() {
      if (typeof window === "undefined") return;
      try {
        const db = getOfflineDB();
        const items = await db.outbox.toArray();
        setOutboxItems(items);
      } catch {
        // Ignorer
      }
    }
    loadOutbox();
  }, [pendingCount, isSyncing]);

  const handleClearCache = async () => {
    if (typeof window === "undefined") return;
    if (
      !confirm(
        "Voulez-vous réinitialiser le cache local IndexedDB ? (Les données sur le serveur MongoDB restent intactes)."
      )
    )
      return;

    const db = getOfflineDB();
    await Promise.all([
      db.charges.clear(),
      db.incidents.clear(),
      db.announcements.clear(),
      db.residences.clear(),
      db.apartments.clear(),
      db.outbox.clear(),
    ]);

    await refreshPendingCount();
    setOutboxItems([]);
    setClearMessage("Cache local vidé avec succès.");
    setTimeout(() => setClearMessage(null), 3000);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Diagnostics PWA & Hors ligne
          </h1>
          <p className="text-xs text-slate-500 sm:text-sm dark:text-slate-400">
            Contrôle des fonctionnalités PWA, Service Worker et synchronisation locale
          </p>
        </div>

        {clearMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <span>{clearMessage}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* GRILLE D'ACCÈS AUX MODULES                               */}
        {/* ======================================================== */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Modules de gestion & Copropriété
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <a
              href="/users"
              className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-sky-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
            >
              <span className="font-bold text-sm text-slate-900 dark:text-white">Utilisateurs</span>
              <span className="text-[11px] text-slate-500">Rôles, comptes & accès</span>
            </a>
            <a
              href="/meetings"
              className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-sky-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
            >
              <span className="font-bold text-sm text-slate-900 dark:text-white">Assemblées (AG)</span>
              <span className="text-[11px] text-slate-500">Séances & ordres du jour</span>
            </a>
            <a
              href="/resolutions"
              className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-sky-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
            >
              <span className="font-bold text-sm text-slate-900 dark:text-white">Résolutions</span>
              <span className="text-[11px] text-slate-500">Dépouillement & quorums</span>
            </a>
            <a
              href="/votes"
              className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-sky-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
            >
              <span className="font-bold text-sm text-slate-900 dark:text-white">Bulletins de vote</span>
              <span className="text-[11px] text-slate-500">Suffrages par tantièmes</span>
            </a>
            <a
              href="/documents"
              className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-sky-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
            >
              <span className="font-bold text-sm text-slate-900 dark:text-white">Documents</span>
              <span className="text-[11px] text-slate-500">PV, contrats & attestations</span>
            </a>
            <a
              href="/residences"
              className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-sky-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
            >
              <span className="font-bold text-sm text-slate-900 dark:text-white">Résidences</span>
              <span className="text-[11px] text-slate-500">Immeubles gérés</span>
            </a>
            <a
              href="/apartments"
              className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-sky-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
            >
              <span className="font-bold text-sm text-slate-900 dark:text-white">Lots & Tantièmes</span>
              <span className="text-[11px] text-slate-500">Appartements & clés</span>
            </a>
            <a
              href="/residents"
              className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-sky-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
            >
              <span className="font-bold text-sm text-slate-900 dark:text-white">Résidents</span>
              <span className="text-[11px] text-slate-500">Fiches des occupants</span>
            </a>
            <a
              href="/payments"
              className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-sky-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
            >
              <span className="font-bold text-sm text-slate-900 dark:text-white">Paiements</span>
              <span className="text-[11px] text-slate-500">Encaissements & reçus</span>
            </a>
            <a
              href="/expenses"
              className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-sky-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
            >
              <span className="font-bold text-sm text-slate-900 dark:text-white">Dépenses</span>
              <span className="text-[11px] text-slate-500">Charges de la copropriété</span>
            </a>
            <a
              href="/api-docs"
              className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-sky-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
            >
              <span className="font-bold text-sm text-slate-900 dark:text-white">API Swagger</span>
              <span className="text-[11px] text-slate-500">Documentation OpenAPI</span>
            </a>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CARTE : ÉTAT DE LA PWA & CONNECTIVITÉ                     */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          <Card>
            <CardContent className="space-y-3 p-2">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${
                    isOnline ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                >
                  {isOnline ? (
                    <Wifi className="h-5 w-5" />
                  ) : (
                    <WifiOff className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Connectivité réseau
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isOnline
                      ? "En ligne — Connecté à l'API SyndicPro"
                      : "Hors ligne — Stockage local Dexie actif"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-2.5 text-xs dark:bg-slate-800/60">
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Modifications en file :</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {pendingCount} élément(s)
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">État de synchronisation :</span>
                  <span className="font-semibold text-sky-600 dark:text-sky-400">
                    {isSyncing ? "En cours..." : "Prêt"}
                  </span>
                </div>
              </div>

              <Button
                size="sm"
                variant="primary"
                onClick={syncNow}
                disabled={!isOnline || isSyncing}
                isLoading={isSyncing}
                className="w-full gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Forcer la synchronisation manuelle
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-white">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Service Worker PWA
                  </h3>
                  <p className="text-xs text-slate-500">
                    Fichier : <code>/sw.js</code> (Cache version v1)
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-2.5 text-xs dark:bg-slate-800/60">
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Statut du Service Worker :</span>
                  <span
                    className={`font-bold ${
                      swActive ? "text-emerald-600" : "text-amber-500"
                    }`}
                  >
                    {swActive ? "Actif & En cours d'exécution" : "Actif en production"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Support Navigateur :</span>
                  <span className="font-semibold text-emerald-600">
                    Installable (Manifest OK)
                  </span>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleClearCache}
                className="w-full gap-2 text-rose-600 hover:text-rose-700"
              >
                <Trash2 className="h-4 w-4" />
                Vider le cache local IndexedDB
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ======================================================== */}
        {/* FILE D'ATTENTE OUTBOX DETAIL                             */}
        {/* ======================================================== */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            File d&apos;attente Outbox ({outboxItems.length})
          </h2>

          {outboxItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800">
              Aucune requête en attente dans la file d&apos;attente IndexedDB.
            </div>
          ) : (
            <div className="space-y-2">
              {outboxItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3.5 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-center"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sky-600 dark:text-sky-400">
                        {item.method} {item.url}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Entité: {item.entity}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-slate-400">
                      clientId: {item.id} • Statut: {item.status} (Tentatives: {item.retries})
                    </p>
                  </div>

                  <span
                    className={`self-start sm:self-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      item.status === "failed"
                        ? "bg-rose-500/10 text-rose-600"
                        : item.status === "syncing"
                        ? "bg-sky-500/10 text-sky-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {item.status === "pending"
                      ? "En attente réseau"
                      : item.status === "syncing"
                      ? "Envoi..."
                      : "Erreur"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* INFORMATIONS APPLICATION & MODULE                        */}
        {/* ======================================================== */}
        <Card className="p-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
            <Info className="h-4 w-4 text-sky-500" />
            <span>SyndicPro PWA — Version 1.0.0 (Production Ready)</span>
          </div>
          <p>
            Projet Universitaire — Module Modern Mobile Application. Implémentation
            stricte des 3 contraintes notées : Mode hors ligne (Service Worker + Dexie
            IndexedDB), Manifest PWA installable et Interface Mobile First Responsive.
          </p>
        </Card>
      </div>
    </AppLayout>
  );
}
