"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Megaphone,
  Plus,
  Search,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Role } from "@/types/enums";
import { getOfflineSession, getOfflineDB } from "@/lib/offline/db";
import { AnnouncementAttachmentList } from "./AnnouncementAttachmentList";
import { AnnouncementCard } from "./AnnouncementCard";
import { AnnouncementContent } from "./AnnouncementContent";
import { AnnouncementEditor } from "./AnnouncementEditor";
import { AnnouncementEmptyState } from "./AnnouncementEmptyState";
import { AnnouncementReadStats, type AnnouncementReadStatsData } from "./AnnouncementReadStats";
import { AnnouncementCategoryBadge, AnnouncementPriorityBadge, AnnouncementStatusBadge } from "./AnnouncementBadges";
import type { AnnouncementAttachment, AnnouncementItem, AnnouncementResidence } from "./types";
import type { AnnouncementAudience, AnnouncementCategory, AnnouncementPriority, AnnouncementStatus } from "@/types/enums";
import { AIReportPanel } from "@/components/ai/AIReportPanel";
import { AITranslationPanel } from "@/components/ai/AITranslationPanel";
import { useSearchParams } from "next/navigation";

interface ApiList {
  data: AnnouncementItem[];
  meta: { page: number; limit: number; total: number };
}

interface DashboardStats {
  total: number;
  published: number;
  scheduled: number;
  drafts: number;
  expired: number;
  averageReadPercentage: number;
  byResidence?: Array<{
    residenceId: string;
    residenceName: string;
    readCount: number;
    eligibleReadCount: number;
    readPercentage: number;
  }>;
}

const isManagerRole = (role?: Role) => role === Role.ADMIN || role === Role.SYNDIC;

function announcementStatus(item: AnnouncementItem): AnnouncementStatus | "EXPIRED" {
  if (item.status === "PUBLISHED" && item.expiresAt && new Date(item.expiresAt) <= new Date()) return "EXPIRED";
  return item.status;
}

function unwrapList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && "data" in value && Array.isArray(value.data)) return value.data as T[];
  return [];
}

export function AnnouncementDashboard() {
  const searchParams = useSearchParams();
  const announcementFromUrl = searchParams.get("announcement");
  const autoOpenedAnnouncement = useRef<string | null>(null);
  const [role, setRole] = useState<Role>();
  const [userId, setUserId] = useState("");
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [residences, setResidences] = useState<AnnouncementResidence[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [audience, setAudience] = useState("");
  const [sort, setSort] = useState("newest");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [readFilter, setReadFilter] = useState("");
  const [residence, setResidence] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementItem | null>(null);
  const [selected, setSelected] = useState<AnnouncementItem | null>(null);
  const [selectedStats, setSelectedStats] = useState<AnnouncementReadStatsData | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then(async (response) => response.ok ? response.json() : null)
      .then(async (session) => {
        if (!active) return;
        if (session?.user?.id && session.user.role) {
          setUserId(session.user.id);
          setRole(session.user.role as Role);
          return;
        }
        const offlineSession = await getOfflineSession();
        if (active && offlineSession) {
          setUserId(offlineSession.id);
          setRole(offlineSession.role);
          setOffline(true);
        } else if (active) {
          setError("Authentification requise pour consulter les annonces.");
          setLoading(false);
        }
      })
      .catch(async () => {
        const offlineSession = await getOfflineSession();
        if (active && offlineSession) {
          setUserId(offlineSession.id);
          setRole(offlineSession.role);
          setOffline(true);
        } else if (active) {
          setError("Authentification requise pour consulter les annonces.");
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search.trim()) params.set("q", search.trim());
    if (category) params.set("category", category);
    if (priority) params.set("priority", priority);
    if (status && isManagerRole(role)) params.set("status", status);
    if (audience && isManagerRole(role)) params.set("audience", audience);
    if (readFilter && role === Role.RESIDENT) params.set("read", readFilter);
    if (residence && isManagerRole(role)) params.set("residence", residence);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    params.set("sort", sort);
    return params;
  }, [page, limit, search, category, priority, status, audience, readFilter, residence, dateFrom, dateTo, sort, role]);

  const load = useCallback(async (silent = false) => {
    if (!role) return;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    const cacheKey = `${userId}:${query.toString()}`;
    try {
      const response = await fetch(`/api/announcements?${query}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger les annonces.");
      const list = result as ApiList;
      setAnnouncements(list.data || []);
      setTotal(list.meta?.total || 0);
      setOffline(false);
      if (userId) {
        await getOfflineDB().announcementFeeds.put({
          key: cacheKey,
          data: list,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (fetchError) {
      if (!navigator.onLine && userId) {
        const cached = await getOfflineDB().announcementFeeds.get(cacheKey);
        const data = cached?.data as ApiList | undefined;
        if (data?.data) {
          setAnnouncements(data.data);
          setTotal(data.meta?.total || 0);
          setOffline(true);
        } else {
          setError("Hors ligne : aucune annonce déjà consultée ne correspond à ces filtres.");
        }
      } else {
        setError(fetchError instanceof Error ? fetchError.message : "Impossible de charger les annonces.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [role, userId, query]);

  useEffect(() => {
    if (!role) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, role, refreshKey]);

  useEffect(() => {
    if (!isManagerRole(role)) return;
    fetch("/api/residences")
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => setResidences(unwrapList<AnnouncementResidence>(result)))
      .catch(() => setResidences([]));
  }, [role]);

  const loadStats = useCallback(async () => {
    if (!isManagerRole(role)) return;
    try {
      const response = await fetch("/api/announcements/stats", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger les indicateurs.");
      setStats(result as DashboardStats);
    } catch (statsError) {
      setError(statsError instanceof Error ? statsError.message : "Erreur de statistiques.");
    }
  }, [role]);

  const selectedAnnouncementId = selected?._id;
  const refreshSelectedStats = useCallback(async () => {
    if (!selectedAnnouncementId || !isManagerRole(role)) return;
    try {
      const response = await fetch(`/api/announcements/${selectedAnnouncementId}/read-stats`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible d'actualiser les statistiques de lecture.");
      const readStats = result as AnnouncementReadStatsData;
      setSelectedStats(readStats);
      setSelected((current) => current?._id === selectedAnnouncementId ? { ...current, readStats } : current);
    } catch (statsError) {
      setError(statsError instanceof Error ? statsError.message : "Erreur de statistiques.");
    }
  }, [role, selectedAnnouncementId]);

  useEffect(() => {
    if (!isManagerRole(role)) return;
    const timer = window.setTimeout(() => void loadStats(), 0);
    return () => window.clearTimeout(timer);
  }, [loadStats, role, refreshKey]);

  useEffect(() => {
    if (!role || offline) return;
    const refreshVisibleData = () => {
      if (document.visibilityState !== "visible") return;
      void load(true);
      void loadStats();
      void refreshSelectedStats();
    };
    const interval = window.setInterval(refreshVisibleData, 15_000);
    document.addEventListener("visibilitychange", refreshVisibleData);
    window.addEventListener("focus", refreshVisibleData);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshVisibleData);
      window.removeEventListener("focus", refreshVisibleData);
    };
  }, [load, loadStats, offline, refreshSelectedStats, role]);

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 4000);
  };

  const openAnnouncement = useCallback(async (item: AnnouncementItem) => {
    setSelected(item);
    setSelectedStats(null);
    if (role !== Role.RESIDENT || item.isRead) return;
    try {
      const response = await fetch(`/api/announcements/${item._id}/read`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible d'enregistrer la lecture.");
      setAnnouncements((current) => current.map((announcement) =>
        announcement._id === item._id ? { ...announcement, isRead: true } : announcement
      ));
      setSelected((current) => current?._id === item._id ? { ...current, isRead: true } : current);
      const snapshotKey = `${userId}:${query.toString()}`;
      const cached = await getOfflineDB().announcementFeeds.get(snapshotKey);
      const data = cached?.data as ApiList | undefined;
      if (data?.data) {
        data.data = data.data.map((announcement) =>
          announcement._id === item._id ? { ...announcement, isRead: true } : announcement
        );
        await getOfflineDB().announcementFeeds.put({ ...cached!, data });
      }
    } catch (readError) {
      if (navigator.onLine) notify(readError instanceof Error ? readError.message : "Erreur lors de l'enregistrement de lecture.");
    }
  }, [role, userId, query]);

  useEffect(() => {
    if (!announcementFromUrl || !role || autoOpenedAnnouncement.current === announcementFromUrl) return;
    autoOpenedAnnouncement.current = announcementFromUrl;
    const timer = window.setTimeout(() => {
      fetch(`/api/announcements/${encodeURIComponent(announcementFromUrl)}`)
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Annonce inaccessible.");
          await openAnnouncement(result as AnnouncementItem);
        })
        .catch((openError) => setError(openError instanceof Error ? openError.message : "Annonce inaccessible."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [announcementFromUrl, openAnnouncement, role]);

  const openReadStats = async (item: AnnouncementItem) => {
    setSelected(item);
    setLoadingStats(true);
    setSelectedStats(null);
    try {
      const response = await fetch(`/api/announcements/${item._id}/read-stats`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger les statistiques de lecture.");
      setSelectedStats(result as AnnouncementReadStatsData);
    } catch (statsError) {
      notify(statsError instanceof Error ? statsError.message : "Erreur de lecture des statistiques.");
    } finally {
      setLoadingStats(false);
    }
  };

  const uploadFiles = async (files: File[], residenceId: string): Promise<AnnouncementAttachment[]> => {
    const uploaded: AnnouncementAttachment[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("residence", residenceId);
      const response = await fetch("/api/announcements/upload", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Échec du téléversement de ${file.name}`);
      uploaded.push(result.attachment as AnnouncementAttachment);
    }
    return uploaded;
  };

  const saveAnnouncement = async (data: {
    residence: string;
    title: string;
    content: string;
    category: AnnouncementCategory;
    priority: AnnouncementPriority;
    audience: AnnouncementAudience;
    status: AnnouncementStatus;
    scheduledAt: string | null;
    expiresAt: string | null;
    isPinned: boolean;
    attachments: AnnouncementAttachment[];
    files: File[];
  }) => {
    setSaving(true);
    setError("");
    try {
      const uploaded = await uploadFiles(data.files, data.residence);
      const body = {
        ...data,
        files: undefined,
        attachments: [...data.attachments, ...uploaded],
      };
      const response = await fetch(editing ? `/api/announcements/${editing._id}` : "/api/announcements", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible d'enregistrer l'annonce.");
      setEditorOpen(false);
      setEditing(null);
      setPage(1);
      setRefreshKey((value) => value + 1);
      notify(editing ? "Annonce mise à jour." : data.status === "DRAFT" ? "Brouillon enregistré." : data.status === "SCHEDULED" ? "Annonce programmée." : "Annonce publiée.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  };

  const publish = async (item: AnnouncementItem) => {
    const response = await fetch(`/api/announcements/${item._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PUBLISHED" }),
    });
    const result = await response.json();
    if (!response.ok) {
      notify(result.error || "Impossible de publier l'annonce.");
      return;
    }
    notify("Annonce publiée.");
    setRefreshKey((value) => value + 1);
  };

  const archive = async (item: AnnouncementItem) => {
    if (!window.confirm(`Archiver « ${item.title} » ?`)) return;
    const response = await fetch(`/api/announcements/${item._id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) {
      notify(result.error || "Impossible d'archiver l'annonce.");
      return;
    }
    notify("Annonce archivée.");
    setSelected(null);
    setRefreshKey((value) => value + 1);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pendingLoad = loading;
  const title = role === Role.ADMIN ? "Annonces — administration globale"
    : role === Role.SYNDIC ? "Annonces de mes résidences"
    : role === Role.TECHNICIAN ? "Informations pour les techniciens"
    : "Actualités de ma résidence";
  const activeFilters = [
    ...(search ? [{ key: "search", label: `Recherche : ${search}`, clear: () => setSearch("") }] : []),
    ...(category ? [{ key: "category", label: `Catégorie : ${category}`, clear: () => setCategory("") }] : []),
    ...(priority ? [{ key: "priority", label: `Priorité : ${priority}`, clear: () => setPriority("") }] : []),
    ...(status ? [{ key: "status", label: `Statut : ${status}`, clear: () => setStatus("") }] : []),
    ...(audience ? [{ key: "audience", label: `Destinataires : ${audience}`, clear: () => setAudience("") }] : []),
    ...(readFilter ? [{ key: "read", label: `Lecture : ${readFilter === "true" ? "Lues" : "Non lues"}`, clear: () => setReadFilter("") }] : []),
    ...(residence ? [{ key: "residence", label: `Résidence : ${residences.find((item) => item._id === residence)?.name ?? "Sélectionnée"}`, clear: () => setResidence("") }] : []),
    ...(dateFrom ? [{ key: "dateFrom", label: `Du ${dateFrom}`, clear: () => setDateFrom("") }] : []),
    ...(dateTo ? [{ key: "dateTo", label: `Au ${dateTo}`, clear: () => setDateTo("") }] : []),
    ...(sort !== "newest" ? [{ key: "sort", label: `Tri : ${sort === "oldest" ? "Plus anciennes" : "Priorité"}`, clear: () => setSort("newest") }] : []),
  ];

  return (
    <AppLayout>
      <main className="space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-500 p-5 text-white shadow-lg shadow-sky-900/10 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950 dark:ring-1 dark:ring-white/10 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-sky-100 dark:text-indigo-200">SyndicPro · Communication</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-sky-50 dark:text-slate-300">{isManagerRole(role) ? "Publiez, programmez et suivez les communications de vos résidences." : "Consultez les informations qui vous sont destinées."}</p>
          </div>
          {isManagerRole(role) && <Button onClick={() => { setEditing(null); setEditorOpen(true); }} disabled={!residences.length} className="min-h-[44px] bg-white text-sky-800 shadow-sm hover:bg-sky-50 dark:bg-white dark:text-sky-900 dark:hover:bg-sky-100"><Plus className="h-4 w-4" /> Nouvelle annonce</Button>}
        </header>

        {isManagerRole(role) && <AIReportPanel endpoint="/api/ai/reports/announcements" title="Générer le rapport IA des annonces" />}
        {offline && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Mode hors ligne : annonces précédemment consultées sur cet appareil.</div>}
        {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</div>}
        {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span className="flex-1">{error}</span><button type="button" aria-label="Fermer l'erreur" onClick={() => setError("")}><X className="h-4 w-4" /></button></div>}

        {isManagerRole(role) && (
          <section aria-label="Statistiques des annonces" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Total", stats?.total],
              ["Publiées", stats?.published],
              ["Programmées", stats?.scheduled],
              ["Brouillons", stats?.drafts],
              ["Expirées", stats?.expired],
            ].map(([label, value]) => <Card key={String(label)} className="p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value ?? "—"}</p></Card>)}
            <Card className="p-4 sm:col-span-2 lg:col-span-5">
              <div className="flex items-center justify-between text-sm"><span className="font-semibold text-slate-800 dark:text-slate-200">Taux de lecture des résidents</span><strong>{stats?.averageReadPercentage ?? "—"}{stats ? "%" : ""}</strong></div>
              <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded-full bg-sky-600" style={{ width: `${stats?.averageReadPercentage || 0}%` }} /></div>
            </Card>
          </section>
        )}
        {role === Role.ADMIN && (stats?.byResidence?.length || 0) > 0 && (
          <Card className="space-y-3">
            <div><h2 className="text-base font-bold text-slate-900 dark:text-white">Lecture par résidence</h2><p className="mt-1 text-xs text-slate-500">Agrégats uniquement, sans données personnelles.</p></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Résidence</th><th className="py-2">Lectures / éligibles</th><th className="py-2">Taux</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats?.byResidence?.map((row) => <tr key={row.residenceId}><td className="py-2 font-medium text-slate-800 dark:text-slate-200">{row.residenceName}</td><td className="py-2 text-slate-600 dark:text-slate-300">{row.readCount} / {row.eligibleReadCount}</td><td className="py-2 font-semibold">{row.readPercentage}%</td></tr>)}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <section className="sticky top-16 z-20 space-y-3 rounded-2xl border border-slate-200/90 bg-white/90 p-3 shadow-sm backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/90 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="relative min-w-48 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input aria-label="Rechercher une annonce" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Rechercher un titre ou un contenu..." className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
              <select aria-label="Filtrer par catégorie" value={category} onChange={(event) => { setPage(1); setCategory(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="">Toutes catégories</option><option value="GENERAL">Général</option><option value="MAINTENANCE">Maintenance</option><option value="SECURITY">Sécurité</option><option value="MEETING">Réunion</option><option value="PAYMENT">Paiement</option><option value="EMERGENCY">Urgence</option><option value="OTHER">Autre</option>
              </select>
              <select aria-label="Filtrer par priorité" value={priority} onChange={(event) => { setPage(1); setPriority(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="">Toutes priorités</option><option value="URGENT">Urgente</option><option value="HIGH">Haute</option><option value="NORMAL">Normale</option><option value="LOW">Basse</option>
              </select>
              {isManagerRole(role) && <>
                <select aria-label="Filtrer par statut" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  <option value="">Tous les statuts</option><option value="DRAFT">Brouillons</option><option value="SCHEDULED">Programmées</option><option value="PUBLISHED">Publiées</option><option value="EXPIRED">Expirées</option><option value="ARCHIVED">Archivées</option>
                </select>
                {residences.length > 0 && <select aria-label="Filtrer par résidence" value={residence} onChange={(event) => { setPage(1); setResidence(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="">{role === Role.ADMIN ? "Toutes résidences" : "Toutes mes résidences"}</option>{residences.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select>}
                  <select aria-label="Filtrer par destinataires" value={audience} onChange={(event) => { setPage(1); setAudience(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="">Tous les destinataires</option><option value="RESIDENTS">Résidents</option><option value="TECHNICIANS">Techniciens</option><option value="ALL">Tous</option></select>
                </>}
                <select aria-label="Trier les annonces" value={sort} onChange={(event) => { setPage(1); setSort(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="newest">Plus récentes</option><option value="oldest">Plus anciennes</option><option value="priority">Priorité</option></select>
                <label className="flex shrink-0 items-center gap-2 text-xs text-slate-500">Du<input type="date" aria-label="Date de début" max={dateTo || undefined} value={dateFrom} onChange={(event) => { setPage(1); setDateFrom(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
                <label className="flex shrink-0 items-center gap-2 text-xs text-slate-500">Au<input type="date" aria-label="Date de fin" min={dateFrom || undefined} value={dateTo} onChange={(event) => { setPage(1); setDateTo(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
              {role === Role.RESIDENT && <select aria-label="Filtrer par lecture" value={readFilter} onChange={(event) => { setPage(1); setReadFilter(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="">Toutes</option><option value="false">Non lues</option><option value="true">Lues</option></select>}
            </div>
          </div>
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-100 pt-3 dark:border-slate-800" aria-label="Filtres actifs">
              {activeFilters.map((filter) => (
                <button key={filter.key} type="button" onClick={filter.clear} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-sky-50 px-3 text-xs font-semibold text-sky-800 transition hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:bg-sky-950 dark:text-sky-200 dark:hover:bg-sky-900">
                  {filter.label}<X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              ))}
              <button type="button" onClick={() => { setPage(1); setSearch(""); setCategory(""); setPriority(""); setStatus(""); setAudience(""); setReadFilter(""); setResidence(""); setDateFrom(""); setDateTo(""); setSort("newest"); }} className="min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-300 dark:hover:text-white">Effacer les filtres</button>
            </div>
          )}
        </section>

        {pendingLoad ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />)}</div>
          : announcements.length === 0 ? <AnnouncementEmptyState message={error ? "Les annonces n'ont pas pu être chargées." : undefined} onCreate={isManagerRole(role) ? () => { setEditing(null); setEditorOpen(true); } : undefined} />
          : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{announcements.map((item) => <AnnouncementCard key={item._id} announcement={item} manager={isManagerRole(role)} onOpen={() => void openAnnouncement(item)} onEdit={() => { setEditing(item); setEditorOpen(true); }} onPublish={() => void publish(item)} onArchive={() => void archive(item)} onReadStats={() => void openReadStats(item)} />)}</div>}

        {!pendingLoad && total > 0 && <div className="flex items-center justify-between gap-3 text-sm text-slate-500"><span>Page {page} sur {totalPages} · {total} annonce(s)</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" /> Précédent</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Suivant <ChevronRight className="h-4 w-4" /></Button></div></div>}

        {editorOpen && <AnnouncementEditor initial={editing} residences={residences} saving={saving} onClose={() => { setEditorOpen(false); setEditing(null); }} onSubmit={saveAnnouncement} />}

        {selected && <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="announcement-detail-title" className="max-h-[92vh] w-full max-w-3xl space-y-5 overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl dark:bg-slate-900 sm:rounded-2xl sm:p-6">
            <header className="flex items-start justify-between gap-4">
              <div><div className="mb-2 flex flex-wrap gap-2"><AnnouncementCategoryBadge category={selected.category} /><AnnouncementPriorityBadge priority={selected.priority} /><AnnouncementStatusBadge status={announcementStatus(selected)} /></div><h2 id="announcement-detail-title" className="text-xl font-bold text-slate-900 dark:text-white">{selected.title}</h2><p className="mt-1 text-xs text-slate-500">{typeof selected.residence === "string" ? "" : selected.residence.name} · {new Date(selected.publishedAt).toLocaleString("fr-FR")}</p></div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Fermer le détail" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </header>
            {selected.isPinned && <p className="flex items-center gap-2 rounded-xl bg-sky-50 p-3 text-sm font-medium text-sky-800 dark:bg-sky-950/40 dark:text-sky-200"><Bell className="h-4 w-4" />Annonce importante épinglée</p>}
            <AnnouncementContent content={selected.content} />
            <AITranslationPanel content={selected.content} readonly />
            {selected.attachments?.some((attachment) => attachment.mimeType.startsWith("image/")) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {selected.attachments.filter((attachment) => attachment.mimeType.startsWith("image/")).map((attachment) => (
                  <a key={attachment.url} href={`${attachment.url}?inline=1`} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${attachment.url}?inline=1`} alt={attachment.name} loading="lazy" className="max-h-72 w-full object-contain" />
                    <span className="block truncate px-3 py-2 text-xs text-slate-500">{attachment.name}</span>
                  </a>
                ))}
              </div>
            )}
            <AnnouncementAttachmentList attachments={selected.attachments || []} />
            {role === Role.RESIDENT && selected.isRead && <p className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300"><Check className="h-4 w-4" />Lecture enregistrée</p>}
            {isManagerRole(role) && <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200"><Megaphone className="h-4 w-4" />Statistiques de lecture</div>
              {selected.readStats && <AnnouncementReadStats stats={selected.readStats} />}
              {selectedStats && <AnnouncementReadStats stats={selectedStats} />}
              {loadingStats && <div aria-label="Chargement des statistiques de lecture" aria-busy="true" className="space-y-2"><div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /><div className="h-2 w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" /></div>}
              {!selected.readStats && !selectedStats && !loadingStats && <Button variant="outline" size="sm" onClick={() => void openReadStats(selected)}><Archive className="h-4 w-4" />Actualiser les statistiques</Button>}
            </div>}
            <footer className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800"><Button variant="outline" onClick={() => setSelected(null)}>Fermer</Button></footer>
          </section>
        </div>}
      </main>
    </AppLayout>
  );
}
