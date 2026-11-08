"use client";

import React from 'react';
import {
  Search,
  Plus,
  Download,
  Calendar,
  Layers,
  CheckCircle,
  X,
} from 'lucide-react';
import type { Charge, ApartmentLot } from '@/lib/redesign/condo';
import { formatCurrency } from '@/lib/redesign/condoLogic';
import { fetchWithOffline } from '@/lib/offline/apiClient';
import type { ChargeDTO, ApartmentDTO } from '@/types/api';
import { ChargeStatus, PaymentMethod, Role } from '@/types/enums';
import { useResidence } from '@/hooks/useResidence';

type ListResponse<T> = { data: T[]; meta: { page: number; limit: number; total: number } };

/** Libellé d'affichage redesign : PENDING affiché comme « En retard » (spécification écran). */
function mapChargeStatusForDisplay(s: ChargeStatus): Charge['status'] {
  switch (s) {
    case ChargeStatus.PAID:
      return 'Payé';
    case ChargeStatus.PARTIAL:
      return 'Partiel';
    case ChargeStatus.OVERDUE:
    case ChargeStatus.PENDING:
    default:
      return 'En retard';
  }
}

function lotLabelFromDto(c: ChargeDTO): string {
  if (c.apartment && typeof c.apartment === 'object') {
    return `Lot ${c.apartment.number}`;
  }
  return 'Lot —';
}

function chargeDtoToCharge(c: ChargeDTO, residenceId: string): Charge {
  const apt = c.apartment;
  const lotNum =
    apt && typeof apt === 'object' ? `Lot ${apt.number}` : lotLabelFromDto(c);
  return {
    id: c._id,
    lotNumber: lotNum,
    period: c.period,
    calledAmount: c.amount,
    paidAmount: c.paidAmount,
    status: mapChargeStatusForDisplay(c.status),
    dueDate: new Date(c.dueDate).toLocaleDateString('fr-FR'),
    residenceId,
  };
}

function apartmentToLot(a: ApartmentDTO, residenceId: string): ApartmentLot {
  return {
    id: a._id,
    lotNumber: a.number,
    residenceId,
    floor: a.floor,
    surfaceM2: a.surface,
    tantiemes: a.shares,
    occupied: a.isOccupied,
    ownerName: '',
  };
}

/** Parse JJ/MM/AAAA → Date ISO minuit local */
function parseFrenchDateToIso(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const y = parseInt(m[3], 10);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt.toISOString();
}

/**
 * Cotisations redesign : charges et lots depuis l’API (fetchWithOffline).
 */
export const ChargesView: React.FC = () => {
  const { selectedId: residenceId, selected, loading: residenceLoading } = useResidence();

  const [sessionRole, setSessionRole] = React.useState<string | null>(null);
  const [charges, setCharges] = React.useState<Charge[]>([]);
  const [lots, setLots] = React.useState<ApartmentLot[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('Tous');
  const [showNewModal, setShowNewModal] = React.useState(false);
  const [showBatchModal, setShowBatchModal] = React.useState(false);

  const [newApartmentId, setNewApartmentId] = React.useState('');
  const [newPeriod, setNewPeriod] = React.useState('2026-06');
  const [newAmount, setNewAmount] = React.useState('180.00');
  const [newDueDate, setNewDueDate] = React.useState('25/06/2026');

  const [batchPeriod, setBatchPeriod] = React.useState('2026-06');
  const [batchBudget, setBatchBudget] = React.useState('1500');
  const [batchDueDate, setBatchDueDate] = React.useState(''); // optionnel ISO ou vide

  const canSyndicActions = sessionRole === Role.ADMIN || sessionRole === Role.SYNDIC;

  const loadChargesAndApartments = React.useCallback(async () => {
    if (!residenceId) {
      setCharges([]);
      setLots([]);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setLoading(true);
      const sess = await fetch('/api/auth/session').then((r) => r.json());
      setSessionRole(sess?.user?.role ?? null);

      // L’API plafonne limit à 50 : enchaîne les pages si besoin
      let all: ChargeDTO[] = [];
      let page = 1;
      let total = 0;
      const maxPage = 5;
      do {
        const q = new URLSearchParams({
          limit: '50',
          page: String(page),
          residence: residenceId,
        });
        const res = await fetchWithOffline<ListResponse<ChargeDTO>>(`/api/charges?${q.toString()}`, {
          entity: 'charge',
        });
        all = all.concat(res.data || []);
        total = res.meta?.total ?? all.length;
        if (all.length >= total || (res.data?.length ?? 0) < 50) break;
        page += 1;
      } while (page <= maxPage);

      const rid = residenceId;
      setCharges(all.map((c) => chargeDtoToCharge(c, rid)));

      const aptRes = await fetchWithOffline<ListResponse<ApartmentDTO>>(
        `/api/apartments?residence=${encodeURIComponent(residenceId)}&limit=50`,
        { entity: 'apartment' }
      );
      const aptList = aptRes.data || [];
      setLots(aptList.map((a) => apartmentToLot(a, rid)));
      setNewApartmentId((prev) => {
        if (prev && aptList.some((a) => a._id === prev)) return prev;
        return aptList[0]?._id ?? '';
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [residenceId]);

  React.useEffect(() => {
    if (residenceLoading) return;
    loadChargesAndApartments();
  }, [residenceLoading, loadChargesAndApartments]);

  const filteredCharges = charges.filter((c) => {
    const matchesSearch =
      c.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.period.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'Tous' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSyndicActions || !newApartmentId) return;
    const dueIso = parseFrenchDateToIso(newDueDate);
    if (!dueIso) {
      setError("Date d'échéance invalide (JJ/MM/AAAA)");
      return;
    }
    const amountNum = parseFloat(newAmount);
    if (Number.isNaN(amountNum) || amountNum < 0) {
      setError('Montant invalide');
      return;
    }
    try {
      setError(null);
      await fetchWithOffline('/api/charges', {
        method: 'POST',
        body: JSON.stringify({
          apartment: newApartmentId,
          period: newPeriod,
          amount: amountNum,
          dueDate: dueIso,
        }),
        entity: 'charge',
      });
      setShowNewModal(false);
      await loadChargesAndApartments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleRunBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId || !canSyndicActions) return;
    const totalB = parseFloat(batchBudget);
    if (Number.isNaN(totalB) || totalB <= 0) {
      setError('Budget invalide');
      return;
    }
    try {
      setError(null);
      const body: Record<string, unknown> = {
        residenceId,
        period: batchPeriod,
        totalBudget: totalB,
      };
      if (batchDueDate.trim()) {
        body.dueDate = batchDueDate.trim();
      }
      await fetchWithOffline('/api/charges/generate', {
        method: 'POST',
        body: JSON.stringify(body),
        entity: 'charge',
      });
      setShowBatchModal(false);
      await loadChargesAndApartments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur génération');
    }
  };

  const handleMarkPaid = async (chargeId: string) => {
    if (!canSyndicActions) return;
    const ch = charges.find((c) => c.id === chargeId);
    if (!ch) return;
    const remaining = Math.round((ch.calledAmount - ch.paidAmount) * 100) / 100;
    if (remaining <= 0) return;
    try {
      setError(null);
      await fetchWithOffline('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          charge: chargeId,
          amount: remaining,
          method: PaymentMethod.CASH,
        }),
        entity: 'payment',
      });
      await loadChargesAndApartments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur encaissement');
    }
  };

  const exportCSV = () => {
    const header = 'Lot,Periode,Appele,Regle,Statut,Echeance\n';
    const rows = filteredCharges
      .map(
        (c) =>
          `"${c.lotNumber}","${c.period}",${c.calledAmount},${c.paidAmount},"${c.status}","${c.dueDate}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `charges_syndic_${batchPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!residenceId && !residenceLoading) {
    return (
      <div className="space-y-6 animate-fadeIn pb-12 p-4">
        <p className="text-xs text-slate-500">Aucune résidence sélectionnée. Vérifiez votre profil.</p>
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
            Comptabilité des Copropriétaires
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
            Appels de Fonds & Cotisations
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Génération mensuelle, état des règlements par lot et exportations comptables
            {selected ? ` — ${selected.name}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportCSV}
            className="flex min-h-[44px] items-center gap-2 px-3.5 py-2 rounded-xl bg-white/80 dark:bg-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Exporter CSV</span>
          </button>
          {canSyndicActions && (
            <button
              onClick={() => setShowNewModal(true)}
              className="flex min-h-[44px] items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouvelle charge</span>
            </button>
          )}
        </div>
      </div>

      {loading && <p className="text-xs text-slate-500">Chargement…</p>}

      {/* Group Call Banner */}
      <div className="p-5 rounded-3xl glass-card border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Appel de charges groupé mensuel</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Générez en un clic les charges pour tous les lots d’une copropriété au prorata exact des millièmes (tantièmes).
            </p>
          </div>
        </div>

        {canSyndicActions && (
          <button
            onClick={() => setShowBatchModal(true)}
            className="flex min-h-[44px] items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition-all shrink-0"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Générer les charges du mois</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-3xl glass-card flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par période (ex: 2026-05) ou lot..."
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
              <option value="Payé">Payé</option>
              <option value="En retard">En retard</option>
              <option value="Partiel">Partiel</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-3xl glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/60 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.06] text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold">
              <tr>
                <th className="py-3.5 px-5">Lot</th>
                <th className="py-3.5 px-4">Période</th>
                <th className="py-3.5 px-4 text-right">Appelé</th>
                <th className="py-3.5 px-4 text-right">Réglé</th>
                <th className="py-3.5 px-4 text-center">Statut</th>
                <th className="py-3.5 px-4">Échéance</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {filteredCharges.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors group">
                  <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white">{item.lotNumber}</td>
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-600 dark:text-slate-300">{item.period}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(item.calledAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatCurrency(item.paidAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        item.status === 'Payé'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                          : item.status === 'Partiel'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">{item.dueDate}</td>
                  <td className="py-3.5 px-5 text-right">
                    {item.status !== 'Payé' && canSyndicActions ? (
                      <button
                        onClick={() => handleMarkPaid(item.id)}
                        className="min-h-[44px] px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white dark:text-blue-400 border border-blue-500/25 text-xs font-bold transition-all shadow-xs"
                      >
                        Encaisser
                      </button>
                    ) : item.status === 'Payé' ? (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Réglé</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Charge Modal */}
      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowNewModal(false)}
        >
          <div className="w-full max-w-md glass-card rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/[0.08]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Créer un appel de charge individuel</h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCharge} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Lot concerné</label>
                <select
                  value={newApartmentId}
                  onChange={(e) => setNewApartmentId(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-base text-slate-900 dark:text-white font-medium"
                >
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      Lot {l.lotNumber} (Étage {l.floor}) · {l.tantiemes}/1000 tantièmes
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Période (YYYY-MM)</label>
                <input
                  type="text"
                  required
                  value={newPeriod}
                  onChange={(e) => setNewPeriod(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-base"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Montant appelé (TND / €)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold text-base"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Date d’échéance (JJ/MM/AAAA)</label>
                <input
                  type="text"
                  required
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-base"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-md shadow-blue-500/20"
                >
                  Créer l’appel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Generation Modal */}
      {showBatchModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowBatchModal(false)}
        >
          <div className="w-full max-w-md glass-card rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/[0.08]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Appel groupé de charges</h3>
              <button
                onClick={() => setShowBatchModal(false)}
                className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRunBatch} className="mt-4 space-y-4 text-xs">
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                Chaque lot sera facturé automatiquement et proportionnellement à ses tantièmes déclarés dans le règlement de copropriété.
              </p>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Période d’appel</label>
                <input
                  type="text"
                  required
                  value={batchPeriod}
                  onChange={(e) => setBatchPeriod(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-base"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Budget global à répartir (€ / DT)</label>
                <input
                  type="number"
                  required
                  value={batchBudget}
                  onChange={(e) => setBatchBudget(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold text-base"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">
                  Date d’échéance (ISO, optionnel — défaut : 15 du mois)
                </label>
                <input
                  type="text"
                  value={batchDueDate}
                  onChange={(e) => setBatchDueDate(e.target.value)}
                  placeholder="ex: 2026-06-15"
                  className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-base"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-md shadow-blue-500/20"
                >
                  Générer pour les {lots.length} lots
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
