"use client";

import React from "react";
import { Plus, PieChart, X, Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ApartmentLot, Residence } from "@/lib/redesign/condo";
import { fetchWithOffline } from "@/lib/offline/apiClient";

type AptApi = {
  _id: string;
  number: string;
  floor: number;
  surface: number;
  shares: number;
  isOccupied?: boolean;
  owner?: { name?: string };
  residence?: { _id?: string; name?: string; city?: string };
};

type ListRes = { data: AptApi[] };

export const ApartmentsView: React.FC = () => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [showModal, setShowModal] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [lots, setLots] = React.useState<ApartmentLot[]>([]);
  const [residence, setResidence] = React.useState<Residence | null>(null);
  const [targetResidenceId, setTargetResidenceId] = React.useState<string | null>(null);

  const [lotNumber, setLotNumber] = React.useState("A301");
  const [floor, setFloor] = React.useState(3);
  const [surface, setSurface] = React.useState(85);
  const [tantiemes, setTantiemes] = React.useState(100);
  const [owner, setOwner] = React.useState("");

  const mapRow = React.useCallback(
    (a: AptApi): ApartmentLot => ({
      id: a._id,
      lotNumber: a.number,
      residenceId: a.residence?._id ? String(a.residence._id) : "",
      floor: a.floor,
      surfaceM2: a.surface,
      tantiemes: a.shares,
      occupied: Boolean(a.isOccupied),
      ownerName: a.owner?.name || "—",
    }),
    []
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mineJson, aptJson] = await Promise.all([
        fetchWithOffline<{ data: Array<{ _id: string; name: string; address?: string; city?: string; totalApartments?: number }> }>(
          "/api/residences/mine"
        ),
        fetchWithOffline<ListRes>("/api/apartments?limit=500"),
      ]);
      const resList = mineJson.data || [];
      const first = resList[0];
      if (first) {
        setTargetResidenceId(first._id);
        setResidence({
          id: first._id,
          name: first.name,
          city: first.city ?? "",
          address: first.address ?? "",
          totalLots: first.totalApartments ?? 0,
          syndicName: "",
        });
      } else {
        setTargetResidenceId(null);
        setResidence(null);
      }
      setLots((aptJson.data || []).map(mapRow));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
      setLots([]);
    } finally {
      setLoading(false);
    }
  }, [mapRow]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const allocatedTantiemes = lots.reduce((sum, l) => sum + l.tantiemes, 0);
  const remainingTantiemes = Math.max(0, 1000 - allocatedTantiemes);

  const filteredLots = lots.filter(
    (l) =>
      l.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lotNumber.trim()) return;
    if (!targetResidenceId) {
      setError("Aucune résidence : création impossible.");
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await fetchWithOffline("/api/apartments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residence: targetResidenceId,
          number: lotNumber.trim(),
          floor,
          surface,
          shares: tantiemes,
          isOccupied: true,
        }),
      });
      setSuccess("Lot enregistré.");
      setShowModal(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec");
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Cadastre & Clés de Répartition
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
            Appartements & Lots Privatifs
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gestion des millièmes de copropriété, surfaces habitables et clés de charges
            {residence ? (
              <>
                {" "}
                · <span className="font-semibold text-slate-600 dark:text-slate-300">{residence.name}</span>
              </>
            ) : null}
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nouveau lot</span>
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

      <div className="p-5 rounded-3xl glass-card border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            <PieChart className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Répartition courante des tantièmes (Millièmes)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Total consolidé :{" "}
              <strong className="text-slate-900 dark:text-white font-mono">
                {allocatedTantiemes} / 1 000
              </strong>{" "}
              tantièmes ({remainingTantiemes} tantièmes restants).
            </p>
          </div>
        </div>

        <div className="w-48 bg-slate-100 dark:bg-white/[0.08] h-2.5 rounded-full overflow-hidden shrink-0">
          <div
            className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, (allocatedTantiemes / 1000) * 100)}%` }}
          />
        </div>
      </div>

      <div className="p-4 rounded-3xl glass-card flex items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par numéro de lot ou propriétaire..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {loading ? (
        <div className="glass-card rounded-3xl p-10 animate-pulse min-h-[200px]" />
      ) : (
        <div className="rounded-3xl glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/60 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.06] text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="py-3.5 px-5">Lot</th>
                  <th className="py-3.5 px-4">Étage</th>
                  <th className="py-3.5 px-4">Surface</th>
                  <th className="py-3.5 px-4 text-right">Tantièmes</th>
                  <th className="py-3.5 px-4">Propriétaire</th>
                  <th className="py-3.5 px-4 text-center">Occupation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {filteredLots.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-5 text-center text-slate-500">
                      Aucun lot à afficher.
                    </td>
                  </tr>
                ) : (
                  filteredLots.map((lot) => (
                    <tr key={lot.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors group">
                      <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white">Lot {lot.lotNumber}</td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">Étage {lot.floor}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">{lot.surfaceM2} m²</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                        {lot.tantiemes} / 1 000
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">{lot.ownerName}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            lot.occupied
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {lot.occupied ? "Occupé" : "Vacant"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowModal(false)}
        >
          <div className="w-full max-w-md glass-card rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/[0.08]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Ajouter un appartement</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreate(e)} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Numéro de Lot *</label>
                  <input
                    type="text"
                    required
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Étage</label>
                  <input
                    type="number"
                    value={floor}
                    onChange={(e) => setFloor(parseInt(e.target.value) || 0)}
                    className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Surface (m²)</label>
                  <input
                    type="number"
                    value={surface}
                    onChange={(e) => setSurface(parseFloat(e.target.value) || 0)}
                    className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Tantièmes (/1000) *</label>
                  <input
                    type="number"
                    required
                    value={tantiemes}
                    onChange={(e) => setTantiemes(parseInt(e.target.value) || 0)}
                    className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold text-blue-600 dark:text-blue-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Nom du Propriétaire</label>
                <input
                  type="text"
                  placeholder="ex: Mme Sonia Khemir"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Rattachement propriétaire : effectuez-le depuis la fiche résident ou l’API (non modifiable ici).
                </span>
              </div>

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
                  Ajouter le lot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
