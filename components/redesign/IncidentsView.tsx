"use client";

import React from 'react';
import {
  Search,
  Plus,
  Phone,
  User,
  CheckCircle2,
  ArrowRight,
  X,
  Sparkles,
} from 'lucide-react';
import type { Incident, IncidentPriority, IncidentStatus } from '@/lib/redesign/condo';
import { getNextIncidentStatus } from '@/lib/redesign/condoLogic';
import { fetchWithOffline } from '@/lib/offline/apiClient';
import type { IncidentDTO } from '@/types/api';
import {
  IncidentCategory,
  IncidentStatus as ApiIncidentStatus,
  Priority,
  Role,
  incidentCategoryLabel,
  incidentStatusLabel,
  priorityLabel,
} from '@/types/enums';
import { useResidence } from '@/hooks/useResidence';

type ListResponse<T> = { data: T[]; meta: { page: number; limit: number; total: number } };

const categoryUiToApi: Record<string, IncidentCategory> = {
  Plomberie: IncidentCategory.PLUMBING,
  Électricité: IncidentCategory.ELECTRICITY,
  Ascenseur: IncidentCategory.ELEVATOR,
  Nettoyage: IncidentCategory.CLEANING,
  Sécurité: IncidentCategory.SECURITY,
  Autre: IncidentCategory.OTHER,
};

const priorityUiToApi: Record<IncidentPriority, Priority> = {
  Basse: Priority.LOW,
  Moyenne: Priority.MEDIUM,
  Haute: Priority.HIGH,
};

const apiStatusToUi = (s: ApiIncidentStatus): IncidentStatus => incidentStatusLabel[s] as IncidentStatus;

const uiToApiStatus: Record<IncidentStatus, ApiIncidentStatus> = {
  Signalé: ApiIncidentStatus.ASSIGNED,
  Assigné: ApiIncidentStatus.IN_PROGRESS,
  'En cours': ApiIncidentStatus.RESOLVED,
  Résolu: ApiIncidentStatus.RESOLVED,
};

const priorityApiToUi = (p: Priority): IncidentPriority => {
  if (p === Priority.URGENT) return 'Haute';
  return priorityLabel[p] as IncidentPriority;
};

function incidentDtoToUi(d: IncidentDTO, residenceName: string): Incident {
  const code = `#${d._id.slice(-6).toUpperCase()}`;
  const created = new Date(d.reportedAt).toLocaleString('fr-FR');
  const lot =
    d.apartment && typeof d.apartment === 'object'
      ? `Lot ${d.apartment.number}`
      : undefined;
  const reporter =
    d.reportedBy && typeof d.reportedBy === 'object'
      ? d.reportedBy.name
      : '—';
  const tech =
    d.assignedTo && typeof d.assignedTo === 'object'
      ? { name: d.assignedTo.name, phone: d.assignedTo.phone || '' }
      : undefined;

  return {
    id: d._id,
    code,
    title: d.title,
    description: d.description,
    priority: priorityApiToUi(d.priority),
    status: apiStatusToUi(d.status),
    residenceName,
    lotNumber: lot,
    reportedBy: reporter,
    category: incidentCategoryLabel[d.category],
    createdAt: created,
    technician: tech?.name ? tech : undefined,
  };
}

/**
 * Incidents redesign : lecture/création/API + avancement de statut (PATCH) selon les rôles.
 */
export const IncidentsView: React.FC = () => {
  const { selectedId: residenceId, selected, loading: residenceLoading } = useResidence();

  const [incidents, setIncidents] = React.useState<Incident[]>([]);
  const [sessionRole, setSessionRole] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [aiLoading, setAiLoading] = React.useState(false);

  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('Tous');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('Toutes');
  const [showModal, setShowModal] = React.useState(false);

  const [title, setTitle] = React.useState('');
  const [category, setCategory] = React.useState('Plomberie');
  const [priority, setPriority] = React.useState<IncidentPriority>('Moyenne');
  const [description, setDescription] = React.useState('');
  const [lot, setLot] = React.useState('Parties communes');

  const residenceName = selected?.name ?? 'Résidence';
  const canAdvanceStatus =
    sessionRole === Role.ADMIN || sessionRole === Role.SYNDIC || sessionRole === Role.TECHNICIAN;

  const loadIncidents = React.useCallback(async () => {
    if (!residenceId) {
      setIncidents([]);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setLoading(true);
      const sess = await fetch('/api/auth/session').then((r) => r.json());
      setSessionRole(sess?.user?.role ?? null);

      let all: IncidentDTO[] = [];
      let page = 1;
      let total = 0;
      const maxPage = 5;
      do {
        const q = new URLSearchParams({
          limit: '50',
          page: String(page),
          residence: residenceId,
        });
        const res = await fetchWithOffline<ListResponse<IncidentDTO>>(`/api/incidents?${q.toString()}`, {
          entity: 'incident',
        });
        all = all.concat(res.data || []);
        total = res.meta?.total ?? all.length;
        if (all.length >= total || (res.data?.length ?? 0) < 50) break;
        page += 1;
      } while (page <= maxPage);

      setIncidents(all.map((d) => incidentDtoToUi(d, residenceName)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [residenceId, residenceName]);

  React.useEffect(() => {
    if (residenceLoading) return;
    loadIncidents();
  }, [residenceLoading, loadIncidents]);

  const filtered = incidents.filter((i) => {
    const matchesSearch =
      i.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'Tous' || i.status === statusFilter;
    const matchesCat = categoryFilter === 'Toutes' || i.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCat;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !residenceId) return;
    try {
      setError(null);
      const catApi = categoryUiToApi[category] ?? IncidentCategory.OTHER;
      const priApi = priorityUiToApi[priority] ?? Priority.MEDIUM;
      await fetchWithOffline('/api/incidents', {
        method: 'POST',
        body: JSON.stringify({
          residence: residenceId,
          title: title.trim(),
          description: description.trim(),
          category: catApi,
          priority: priApi,
          photos: [],
        }),
        entity: 'incident',
      });
      setShowModal(false);
      setTitle('');
      setDescription('');
      await loadIncidents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur création');
    }
  };

  const handleAiSuggest = async () => {
    const ctx = [title.trim(), description.trim()].filter(Boolean).join('\n');
    if (!ctx) {
      setError('Saisissez un titre ou une description pour l’analyse.');
      return;
    }
    try {
      setAiLoading(true);
      setError(null);
      type AnalyzeRes = { data: { title: string; category: IncidentCategory; priority: Priority; description: string } };
      const res = await fetchWithOffline<AnalyzeRes>('/api/ai/analyze-incident', {
        method: 'POST',
        body: JSON.stringify({ context: ctx, residenceName }),
      });
      const d = res?.data;
      if (!d) return;
      setTitle(d.title);
      setDescription(d.description);
      const frCat = incidentCategoryLabel[d.category];
      if (['Plomberie', 'Électricité', 'Ascenseur', 'Nettoyage', 'Sécurité', 'Autre'].includes(frCat)) {
        setCategory(frCat);
      }
      setPriority(priorityApiToUi(d.priority));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur IA');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAdvance = async (id: string, currentUi: IncidentStatus) => {
    if (!canAdvanceStatus) return;
    const nextUi = getNextIncidentStatus(currentUi);
    if (nextUi === currentUi) return;
    const nextApi = uiToApiStatus[currentUi];
    try {
      setError(null);
      await fetchWithOffline(`/api/incidents/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextApi }),
        entity: 'incident',
      });
      await loadIncidents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur statut');
    }
  };

  const getPriorityStyle = (p: IncidentPriority) => {
    switch (p) {
      case 'Haute':
        return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30';
      case 'Moyenne':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30';
      case 'Basse':
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30';
    }
  };

  const stages: IncidentStatus[] = ['Signalé', 'Assigné', 'En cours', 'Résolu'];

  if (!residenceId && !residenceLoading) {
    return (
      <div className="space-y-6 animate-fadeIn pb-12 p-4">
        <p className="text-xs text-slate-500">Aucune résidence sélectionnée.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-800 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Maintenance & Sécurité Technique
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
            Incidents & Pannes Signalées
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Déclarez et suivez la résolution des pannes avec traçabilité complète des interventions
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex min-h-[44px] items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nouveau signalement</span>
        </button>
      </div>

      {loading && <p className="text-xs text-slate-500">Chargement…</p>}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-3xl glass-card flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher un incident (ex: fuite, ascenseur, code)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-[44px] bg-slate-50/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl pl-10 pr-4 py-2 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Statut:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="Tous">Tous</option>
              <option value="Signalé">Signalé</option>
              <option value="Assigné">Assigné</option>
              <option value="En cours">En cours</option>
              <option value="Résolu">Résolu</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Catégorie:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="Toutes">Toutes</option>
              <option value="Plomberie">Plomberie</option>
              <option value="Électricité">Électricité</option>
              <option value="Ascenseur">Ascenseur</option>
              <option value="Nettoyage">Nettoyage</option>
              <option value="Sécurité">Sécurité</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incidents Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.map((item) => {
          const currentStageIdx = stages.indexOf(item.status);

          return (
            <div
              key={item.id}
              className="p-5 rounded-3xl glass-card transition-all flex flex-col justify-between group shadow-sm hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.code} · {item.createdAt}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${getPriorityStyle(item.priority)}`}
                  >
                    {item.priority}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-[11px] bg-slate-50/80 dark:bg-white/[0.02] p-3 rounded-2xl border border-slate-200/60 dark:border-white/[0.04]">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Résidence</span>
                    <span className="text-slate-700 dark:text-slate-200 truncate block font-medium">{item.residenceName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Localisation</span>
                    <span className="text-slate-700 dark:text-slate-200 truncate block font-medium">
                      {item.lotNumber || 'Parties communes'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Déclaré par</span>
                    <span className="text-slate-700 dark:text-slate-200 truncate block font-medium">{item.reportedBy}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Catégorie</span>
                    <span className="text-blue-600 dark:text-blue-400 truncate block font-bold">{item.category}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">{item.description}</p>

                {item.technician && (
                  <div className="mt-3.5 flex items-center justify-between text-xs pt-3 border-t border-slate-200/80 dark:border-white/[0.05]">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <User className="w-3.5 h-3.5 text-blue-500" />
                      <span className="font-medium">{item.technician.name}</span>
                    </div>
                    {item.technician.phone && (
                      <a
                        href={`tel:${item.technician.phone}`}
                        className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline font-mono text-[11px] font-semibold"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{item.technician.phone}</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                  {stages.map((stg, idx) => (
                    <span
                      key={stg}
                      className={
                        idx <= currentStageIdx
                          ? 'text-blue-600 dark:text-blue-400 font-bold'
                          : 'text-slate-300 dark:text-slate-600'
                      }
                    >
                      {stg}
                    </span>
                  ))}
                </div>

                <div className="w-full bg-slate-100 dark:bg-white/[0.06] h-2 rounded-full overflow-hidden p-0.5 flex gap-1">
                  {stages.map((stg, idx) => (
                    <div
                      key={stg}
                      className={`h-full flex-1 rounded-full transition-all duration-300 ${
                        idx <= currentStageIdx
                          ? item.status === 'Résolu'
                            ? 'bg-emerald-500'
                            : 'bg-blue-600 dark:bg-blue-500'
                          : 'bg-transparent'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    Statut actuel: <strong className="text-slate-900 dark:text-white">{item.status}</strong>
                  </span>
                  {item.status !== 'Résolu' && canAdvanceStatus ? (
                    <button
                      onClick={() => handleAdvance(item.id, item.status)}
                      className="flex min-h-[44px] items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white dark:text-blue-400 border border-blue-500/25 text-xs font-bold transition-all shadow-xs"
                    >
                      <span>Passer à « {getNextIncidentStatus(item.status)} »</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  ) : item.status === 'Résolu' ? (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Clôturé</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Mise à jour par le syndic</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowModal(false)}
        >
          <div className="w-full max-w-lg glass-card rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/[0.08]">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Signaler une panne ou un incident</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{residenceName}</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Titre de la panne *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Fuite d’eau sous l'évier parties communes"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-base text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Catégorie</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium text-base"
                  >
                    <option value="Plomberie">Plomberie</option>
                    <option value="Électricité">Électricité</option>
                    <option value="Ascenseur">Ascenseur</option>
                    <option value="Nettoyage">Nettoyage</option>
                    <option value="Sécurité">Sécurité</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Priorité</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as IncidentPriority)}
                    className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium text-base"
                  >
                    <option value="Basse">Basse</option>
                    <option value="Moyenne">Moyenne</option>
                    <option value="Haute">Haute (Urgent)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Localisation / Lot</label>
                <input
                  type="text"
                  placeholder="ex: Sous-sol, ou Lot 04"
                  value={lot}
                  onChange={(e) => setLot(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium text-base"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Description détaillée *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Expliquez la situation et l'impact..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white resize-none font-medium text-base"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleAiSuggest}
                  disabled={aiLoading}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-[11px] font-bold text-violet-800 dark:text-violet-200"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {aiLoading ? 'Analyse…' : 'Suggestion IA'}
                </button>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-md shadow-blue-500/20"
                  >
                    Publier le signalement
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
