"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  Vote,
  PlusCircle,
  Clock,
  Calendar,
  User as UserIcon,
  FileText,
  Users,
  Home,
  CheckSquare,
  Layers,
  CreditCard,
  Receipt,
  BookOpen,
  Wallet,
  Bell,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getOfflineDB, getOfflineSession, type OutboxItem } from "@/lib/offline/db";
import { Role } from "@/types/enums";

// Définition stricte et sans ambiguïté des modules accessibles par rôle
const MODULES_BY_ROLE: Record<
  Role,
  Array<{
    title: string;
    desc: string;
    href: string;
    icon: any;
    highlight?: boolean;
  }>
> = {
  // LOCATAIRE : UNIQUEMENT ses services autorisés (Strictement aucun module d'AG, vote ou admin)
  [Role.TENANT]: [
    {
      title: "Mon Profil",
      desc: "Coordonnées & mon logement",
      href: "/profile",
      icon: UserIcon,
      highlight: true,
    },
    {
      title: "Portefeuille",
      desc: "Solde & preuves Flip/D17",
      href: "/wallet",
      icon: Wallet,
      highlight: true,
    },
    {
      title: "Notifications",
      desc: "Rappels & WhatsApp",
      href: "/notifications",
      icon: Bell,
    },
    {
      title: "Documents",
      desc: "Règlements & attestations",
      href: "/documents",
      icon: FileText,
    },
    {
      title: "Mes Règlements",
      desc: "Historique de paiements",
      href: "/payments",
      icon: Receipt,
    },
    {
      title: "Rattachement",
      desc: "Demande de nouveau lot",
      href: "/join",
      icon: Home,
    },
  ],

  // PROPRIÉTAIRE : Vie de la copropriété, AG, résolutions et scrutins
  [Role.OWNER]: [
    {
      title: "Mon Profil",
      desc: "Mes lots & tantièmes",
      href: "/profile",
      icon: UserIcon,
      highlight: true,
    },
    {
      title: "Portefeuille",
      desc: "Solde & preuves Flip/D17",
      href: "/wallet",
      icon: Wallet,
      highlight: true,
    },
    {
      title: "Notifications",
      desc: "Rappels & WhatsApp",
      href: "/notifications",
      icon: Bell,
    },
    {
      title: "Élections Syndic",
      desc: "Candidatures & votes",
      href: "/elections",
      icon: Vote,
    },
    {
      title: "Assemblées (AG)",
      desc: "Séances & ordres du jour",
      href: "/meetings",
      icon: Users,
    },
    {
      title: "Résolutions",
      desc: "Dépouillement & votes",
      href: "/resolutions",
      icon: CheckSquare,
    },
    {
      title: "Bulletins de vote",
      desc: "Suffrages par tantièmes",
      href: "/votes",
      icon: Vote,
    },
    {
      title: "Documents",
      desc: "PV d'AG, règlements & contrats",
      href: "/documents",
      icon: FileText,
    },
    {
      title: "Mes Règlements",
      desc: "Paiements des charges",
      href: "/payments",
      icon: Receipt,
    },
    {
      title: "Rattachement",
      desc: "Demande de nouveau lot",
      href: "/join",
      icon: Home,
    },
  ],

  // TECHNICIEN : Fiche profil et documents techniques
  [Role.TECHNICIAN]: [
    {
      title: "Mon Profil",
      desc: "Coordonnées & spécialité",
      href: "/profile",
      icon: UserIcon,
      highlight: true,
    },
    {
      title: "Notifications",
      desc: "Assignations & rappels",
      href: "/notifications",
      icon: Bell,
    },
    {
      title: "Documents",
      desc: "Guides & notices techniques",
      href: "/documents",
      icon: FileText,
    },
  ],

  // SYNDIC : Gestion opérationnelle de ses copropriétés
  [Role.SYNDIC]: [
    {
      title: "Mon Profil",
      desc: "Mandats & coordonnées",
      href: "/profile",
      icon: UserIcon,
      highlight: true,
    },
    {
      title: "Portefeuille",
      desc: "Valider preuves Flip/D17",
      href: "/wallet",
      icon: Wallet,
      highlight: true,
    },
    {
      title: "Notifications",
      desc: "Rappels charges & AG",
      href: "/notifications",
      icon: Bell,
    },
    {
      title: "Élections Syndic",
      desc: "Gestion du scrutin",
      href: "/elections",
      icon: Vote,
    },
    {
      title: "Demandes d'adhésion",
      desc: "Valider les résidents",
      href: "/join-requests",
      icon: ShieldCheck,
    },
    {
      title: "Assemblées (AG)",
      desc: "Séances & ordres du jour",
      href: "/meetings",
      icon: Users,
    },
    {
      title: "Résolutions",
      desc: "Dépouillement & quorums",
      href: "/resolutions",
      icon: CheckSquare,
    },
    {
      title: "Bulletins de vote",
      desc: "Suffrages par tantièmes",
      href: "/votes",
      icon: Vote,
    },
    {
      title: "Documents",
      desc: "PV, contrats & attestations",
      href: "/documents",
      icon: FileText,
    },
    {
      title: "Paiements",
      desc: "Encaissements & reçus",
      href: "/payments",
      icon: Receipt,
    },
    {
      title: "Utilisateurs",
      desc: "Comptes & affectations",
      href: "/users",
      icon: Users,
    },
    {
      title: "Résidences",
      desc: "Immeubles sous gestion",
      href: "/residences",
      icon: Building,
    },
    {
      title: "Lots & Tantièmes",
      desc: "Appartements & clés",
      href: "/apartments",
      icon: Layers,
    },
    {
      title: "Fiches Résidents",
      desc: "Occupants & contacts",
      href: "/residents",
      icon: Users,
    },
    {
      title: "Dépenses",
      desc: "Factures & charges",
      href: "/expenses",
      icon: CreditCard,
    },
  ],

  // ADMINISTRATEUR : Accès complet à l'ensemble du système
  [Role.ADMIN]: [
    {
      title: "Mon Profil",
      desc: "Superviseur système",
      href: "/profile",
      icon: UserIcon,
      highlight: true,
    },
    {
      title: "Portefeuille",
      desc: "Valider preuves Flip/D17",
      href: "/wallet",
      icon: Wallet,
      highlight: true,
    },
    {
      title: "Notifications",
      desc: "Rappels & canaux",
      href: "/notifications",
      icon: Bell,
    },
    {
      title: "Élections Syndic",
      desc: "Gestion du scrutin",
      href: "/elections",
      icon: Vote,
    },
    {
      title: "Demandes d'adhésion",
      desc: "Valider les résidents",
      href: "/join-requests",
      icon: ShieldCheck,
    },
    {
      title: "Assemblées (AG)",
      desc: "Séances & ordres du jour",
      href: "/meetings",
      icon: Users,
    },
    {
      title: "Résolutions",
      desc: "Dépouillement & quorums",
      href: "/resolutions",
      icon: CheckSquare,
    },
    {
      title: "Bulletins de vote",
      desc: "Suffrages par tantièmes",
      href: "/votes",
      icon: Vote,
    },
    {
      title: "Documents",
      desc: "PV, contrats & attestations",
      href: "/documents",
      icon: FileText,
    },
    {
      title: "Paiements",
      desc: "Encaissements & reçus",
      href: "/payments",
      icon: Receipt,
    },
    {
      title: "Utilisateurs",
      desc: "Comptes & rôles globaux",
      href: "/users",
      icon: Users,
    },
    {
      title: "Résidences",
      desc: "Toutes les copropriétés",
      href: "/residences",
      icon: Building,
    },
    {
      title: "Lots & Tantièmes",
      desc: "Tous les appartements",
      href: "/apartments",
      icon: Layers,
    },
    {
      title: "Résidents",
      desc: "Tous les occupants",
      href: "/residents",
      icon: Users,
    },
    {
      title: "Dépenses",
      desc: "Dépenses & factures",
      href: "/expenses",
      icon: CreditCard,
    },
    {
      title: "Documentation API",
      desc: "Documentation OpenAPI",
      href: "/api-docs",
      icon: BookOpen,
    },
  ],
};

export default function MorePage() {
  const router = useRouter();
  const { isOnline, pendingCount, isSyncing, syncNow, refreshPendingCount } =
    useOnlineStatus();
  const [swActive, setSwActive] = useState<boolean | null>(null);
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [clearMessage, setClearMessage] = useState<string | null>(null);

  // Session utilisateur
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Élections du syndic (Modal Admin/Syndic)
  const [showElectionModal, setShowElectionModal] = useState(false);
  const [residences, setResidences] = useState<any[]>([]);
  const [residenceId, setResidenceId] = useState("");
  const [electionTitle, setElectionTitle] = useState("Élection du nouveau syndic");
  const [candidacyEndDate, setCandidacyEndDate] = useState("");
  const [votingEndDate, setVotingEndDate] = useState("");
  const [electionSubmitting, setElectionSubmitting] = useState(false);
  const [electionError, setElectionError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Chargement instantané depuis le cache Dexie pour éviter tout clignotement
    getOfflineSession().then((cached) => {
      if (cached) {
        setCurrentUser(cached);
        setLoadingUser(false);
      }
    });

    // 2. Synchronisation de la session auprès d'Auth.js
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.id) {
          setCurrentUser(data.user);
          if (data.user.role === Role.ADMIN || data.user.role === Role.SYNDIC) {
            fetch("/api/residences/available")
              .then((r) => r.json())
              .then((resData) => {
                if (resData?.data && resData.data.length > 0) {
                  setResidences(resData.data);
                  setResidenceId(resData.data[0]._id);
                }
              });
          }
        }
      })
      .finally(() => setLoadingUser(false));

    // Dates par défaut (+7 jours candidatures, +14 jours votes)
    const now = new Date();
    const d1 = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const d2 = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
    setCandidacyEndDate(d1.toISOString().slice(0, 16));
    setVotingEndDate(d2.toISOString().slice(0, 16));
  }, []);

  const handleLaunchElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId) {
      setElectionError("Veuillez sélectionner une résidence");
      return;
    }
    try {
      setElectionSubmitting(true);
      setElectionError(null);

      const res = await fetch("/api/elections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residence: residenceId,
          title: electionTitle.trim(),
          candidacyEndDate: new Date(candidacyEndDate).toISOString(),
          votingEndDate: new Date(votingEndDate).toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de création de l'élection");

      setShowElectionModal(false);
      router.push("/elections");
    } catch (err: unknown) {
      setElectionError(err instanceof Error ? err.message : "Erreur lors du lancement");
    } finally {
      setElectionSubmitting(false);
    }
  };

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

  const userRole = (currentUser?.role as Role) || null;
  const isManagement = userRole === Role.ADMIN || userRole === Role.SYNDIC;
  const modules = userRole ? MODULES_BY_ROLE[userRole] || [] : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* En-tête adapté au profil */}
        <div className="sp-page-header">
          <h1 className="sp-title text-balance text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            {isManagement ? "Gestion & Modules Copropriété" : "Services & Copropriété"}
          </h1>
          <p className="sp-body text-pretty text-sm text-slate-500 dark:text-slate-400">
            {isManagement
              ? "Supervision des résidences, synchronisation hors ligne et administration"
              : "Accédez à vos documents, démarches de copropriété et informations personnelles"}
          </p>
        </div>

        {clearMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <span>{clearMessage}</span>
          </div>
        )}

        {/* Bannière Élections (ADMIN uniquement) */}
        {currentUser?.role === Role.ADMIN && (
          <Card className="border-sky-200 dark:border-sky-900">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3.5">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white">
                    <Vote className="size-5" aria-hidden />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Élections du Syndic de Copropriété
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Configurez et initiez les phases de candidatures (Phase 1) et de scrutin (Phase 2) avec publication automatique des annonces.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    onClick={() => setShowElectionModal(true)}
                    className="gap-2 min-h-[44px] text-xs font-semibold"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Lancer les élections
                  </Button>
                  <Link href="/elections">
                    <Button variant="outline" className="min-h-[44px] text-xs">
                      Voir le scrutin
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modal de lancement d'élection (Admin) */}
        {showElectionModal && (
          <div className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-lg shadow-sm">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Vote className="h-5 w-5 text-sky-500" />
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Lancer les élections de syndic (Phase 0)
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowElectionModal(false)}
                    aria-label="Fermer"
                    className="flex size-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <X className="size-5 shrink-0" aria-hidden />
                  </button>
                </div>

                {electionError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40">
                    {electionError}
                  </div>
                )}

                <form onSubmit={handleLaunchElection} className="space-y-4">
                  <Select
                    label="Résidence concernée *"
                    value={residenceId}
                    onChange={(e) => setResidenceId(e.target.value)}
                    options={residences.map((r) => ({
                      value: r._id,
                      label: `${r.name} (${r.city})`,
                    }))}
                    required
                  />

                  <Input
                    label="Intitulé du scrutin *"
                    value={electionTitle}
                    onChange={(e) => setElectionTitle(e.target.value)}
                    placeholder="Ex : Élection du syndic 2026-2027"
                    required
                  />

                  <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3.5 space-y-3 dark:border-sky-900/40 dark:bg-sky-950/20">
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-900 dark:text-sky-300">
                      <Clock className="h-4 w-4 text-sky-500" />
                      <span>Calendrier officiel des phases</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Fin Phase 1 (Candidatures) & Lancement Phase 2 (Scrutin) *
                      </label>
                      <input
                        type="datetime-local"
                        value={candidacyEndDate}
                        onChange={(e) => setCandidacyEndDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        required
                      />
                      <p className="text-[10px] text-slate-500">
                        À cette date, les candidatures se clôturent et le scrutin débute avec publication automatique.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Fin de la Phase 2 (Clôture des votes & Proclamation) *
                      </label>
                      <input
                        type="datetime-local"
                        value={votingEndDate}
                        onChange={(e) => setVotingEndDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        required
                      />
                      <p className="text-[10px] text-slate-500">
                        À cette date, le scrutin est clos, le gagnant est désigné nouveau syndic et une annonce est publiée.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowElectionModal(false)}
                    >
                      Annuler
                    </Button>
                    <Button type="submit" variant="primary" disabled={electionSubmitting}>
                      {electionSubmitting ? "Lancement en cours..." : "Lancer l'élection"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ======================================================== */}
        {/* GRILLE STRICTEMENT FILTRÉE SELON LE RÔLE                 */}
        {/* ======================================================== */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {isManagement ? "Modules de gestion & Copropriété" : "Vos Services & Espaces"}
          </h2>

          {loadingUser && modules.length === 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {modules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <Link
                    key={mod.href}
                    href={mod.href}
                    className={`flex min-h-24 flex-col gap-1 rounded-2xl border p-3.5 shadow-sm transition-colors duration-150 hover:border-sky-500 ${
                      mod.highlight
                        ? "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30"
                        : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-sm font-semibold ${
                          mod.highlight
                            ? "text-sky-900 dark:text-sky-300"
                            : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {mod.title}
                      </span>
                      <Icon
                        className={`size-4 shrink-0 ${
                          mod.highlight ? "text-sky-600" : "text-slate-400"
                        }`}
                        aria-hidden
                      />
                    </div>
                    <span className="line-clamp-2 text-pretty text-xs text-slate-500">
                      {mod.desc}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* CARTE : ÉTAT DE LA PWA & CONNECTIVITÉ                     */}
        {/* ======================================================== */}
        {isManagement ? (
          // Vue ADMIN / SYNDIC : Diagnostics techniques complets
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
                  className="w-full gap-2 min-h-[44px]"
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
                      Fichier : <code>/sw.js</code> (Cache version v2)
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
                  className="w-full gap-2 min-h-[44px] text-rose-600 hover:text-rose-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Vider le cache local IndexedDB
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          // Vue RÉSIDENT (Propriétaire / Locataire / Technicien) : Statut épuré et rassurant
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ${
                    isOnline ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                >
                  {isOnline ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isOnline ? "Connecté au serveur SyndicPro" : "Mode hors-ligne actif"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isOnline
                      ? "Vos charges, annonces et documents sont synchronisés."
                      : "Vos données restent consultables sans connexion Internet."}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={syncNow}
                disabled={!isOnline || isSyncing}
                isLoading={isSyncing}
                className="gap-2 min-h-[44px] text-xs self-start sm:self-center"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Actualiser mes données
              </Button>
            </CardContent>
          </Card>
        )}

        {/* FILE D'ATTENTE OUTBOX : ADMIN / SYNDIC UNIQUEMENT */}
        {isManagement && (
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
        )}

        {/* Informations de version */}
        <Card className="p-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
            <Info className="h-4 w-4 text-sky-500" />
            <span>SyndicPro PWA — Version 1.0.0</span>
          </div>
          <p>
            Application PWA de gestion de copropriété avec synchronisation hors-ligne et contrôle d&apos;accès strict par rôle.
          </p>
        </Card>
      </div>
    </AppLayout>
  );
}
