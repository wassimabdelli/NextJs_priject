"use client";

import React from "react";
import {
  Megaphone,
  Plus,
  Pin,
  X,
  Search,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import type { Announcement } from "@/lib/redesign/condo";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { formatDateFrShort } from "@/components/redesign/apiMappers";

type AnnouncementApi = {
  _id: string;
  title: string;
  content: string;
  isPinned?: boolean;
  publishedAt?: string;
  residence?: { name?: string };
  author?: { name?: string };
};

type ListRes = { data: AnnouncementApi[]; meta?: { total?: number } };

export const AnnouncementsView: React.FC = () => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [showModal, setShowModal] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
  const [defaultResidenceId, setDefaultResidenceId] = React.useState<string | null>(null);
  const [defaultResidenceName, setDefaultResidenceName] = React.useState("");

  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [pinned, setPinned] = React.useState(false);

  const mapRow = React.useCallback((a: AnnouncementApi): Announcement => {
    return {
      id: a._id,
      title: a.title,
      content: a.content,
      pinned: Boolean(a.isPinned),
      author: typeof a.author === "object" && a.author?.name ? a.author.name : "—",
      date: formatDateFrShort(a.publishedAt),
      residenceName: a.residence?.name ?? "—",
    };
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listJson, mineJson] = await Promise.all([
        fetchWithOffline<ListRes>("/api/announcements?limit=100"),
        fetchWithOffline<{ data: Array<{ _id: string; name: string }> }>("/api/residences/mine"),
      ]);
      setAnnouncements((listJson.data || []).map(mapRow));
      const first = mineJson.data?.[0];
      if (first) {
        setDefaultResidenceId(first._id);
        setDefaultResidenceName(first.name);
      } else {
        setDefaultResidenceId(null);
        setDefaultResidenceName("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, [mapRow]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = announcements.filter(
    (a) =>
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    if (!defaultResidenceId) {
      setError("Aucune résidence rattachée : impossible de publier.");
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await fetchWithOffline("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residence: defaultResidenceId,
          title: title.trim(),
          content: content.trim(),
          isPinned: pinned,
        }),
        entity: "announcement",
      });
      setSuccess("Annonce publiée.");
      setShowModal(false);
      setTitle("");
      setContent("");
      setPinned(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la publication");
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Communication Résidents
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
            Annonces & Panneau d’Affichage
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Informations officielles, coupures planifiées et communications du syndic
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nouvelle annonce</span>
        </button>
      </div>

      {(error || success) && (
        <div className="space-y-2">
          {error && (
            <div
              role="alert"
              className="glass-card rounded-3xl p-4 border border-rose-500/25 bg-rose-500/10 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div
              role="status"
              className="glass-card rounded-3xl p-4 border border-emerald-500/25 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}
        </div>
      )}

      <div className="p-4 rounded-3xl glass-card flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par titre ou contenu d'annonce..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {loading ? (
        <div className="glass-card rounded-3xl p-10 animate-pulse min-h-[200px]" />
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-3xl p-8 text-center text-xs text-slate-500 dark:text-slate-400">
          Aucune annonce pour le moment.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`p-6 rounded-3xl glass-card transition-all ${
                item.pinned ? "border-blue-500/35 shadow-md shadow-blue-500/5" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      item.pinned
                        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                        : "bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {item.pinned ? <Pin className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{item.title}</h3>
                      {item.pinned && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                          Épinglée
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{item.residenceName}</span>
                      <span>·</span>
                      <span className="font-mono">{item.date}</span>
                      <span>·</span>
                      <span>Publié par {item.author}</span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-700 dark:text-slate-300 mt-4 leading-relaxed pl-13">{item.content}</p>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowModal(false)}
        >
          <div className="w-full max-w-md glass-card rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/[0.08]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Publier une annonce</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreate(e)} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Titre de l’annonce *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Coupure d’eau planifiée pour réfection"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Contenu détaillé *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Détaillez les dates, horaires et consignes aux résidents..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white resize-none font-medium"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pinnedCheck"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                />
                <label htmlFor="pinnedCheck" className="text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                  Épingler cette annonce en haut du tableau d’affichage
                </label>
              </div>

              {defaultResidenceName && (
                <p className="text-[10px] text-slate-500">
                  Résidence cible : <strong>{defaultResidenceName}</strong> (première résidence de votre périmètre).
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-md shadow-blue-500/20"
                >
                  Diffuser l'annonce
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
