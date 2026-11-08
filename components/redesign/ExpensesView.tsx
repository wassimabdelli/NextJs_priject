"use client";

import React from "react";
import {
  Search,
  Plus,
  Download,
  X,
  Droplet,
  Zap,
  Building,
  Sparkles,
  Shield,
  Wrench,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import type { Expense, ExpenseCategory } from "@/lib/redesign/condo";
import { formatCurrency } from "@/lib/redesign/condoLogic";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import {
  ExpenseCategory as ExpCat,
  values,
} from "@/types/enums";
import {
  apiExpenseCategoryToRedesign,
  expenseCategoryFr,
  formatDateFrShort,
} from "@/components/redesign/apiMappers";

type ExpenseRow = {
  _id: string;
  description: string;
  amount: number;
  category: string;
  expenseDate?: string;
  residence?: { name?: string };
  proofUrl?: string;
};

type ListRes = { data: ExpenseRow[] };

export const ExpensesView: React.FC = () => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("Tous");
  const [showModal, setShowModal] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [residenceId, setResidenceId] = React.useState<string | null>(null);

  const [desc, setDesc] = React.useState("");
  const [amount, setAmount] = React.useState("250.00");
  const [cat, setCat] = React.useState<ExpenseCategory>("MAINTENANCE");
  const [date, setDate] = React.useState("");

  React.useEffect(() => {
    setDate(new Date().toISOString().slice(0, 10));
  }, []);

  const mapRow = React.useCallback((e: ExpenseRow): Expense => {
    const redesignCat = apiExpenseCategoryToRedesign(e.category);
    return {
      id: e._id,
      description: e.description,
      amount: e.amount,
      category: redesignCat,
      date: formatDateFrShort(e.expenseDate),
      residenceName: e.residence?.name ?? "—",
      receiptUrl: e.proofUrl,
    };
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [expJson, mineJson] = await Promise.all([
        fetchWithOffline<ListRes>("/api/expenses?limit=200"),
        fetchWithOffline<{ data: Array<{ _id: string }> }>("/api/residences/mine"),
      ]);
      setExpenses((expJson.data || []).map(mapRow));
      setResidenceId(mineJson.data?.[0]?._id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [mapRow]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === "Tous" || e.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim()) return;
    if (!residenceId) {
      setError("Aucune résidence : enregistrement impossible.");
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await fetchWithOffline("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residence: residenceId,
          description: desc.trim(),
          amount: parseFloat(amount) || 0,
          category: cat,
          expenseDate: new Date(date + "T12:00:00").toISOString(),
        }),
      });
      setSuccess("Dépense enregistrée.");
      setShowModal(false);
      setDesc("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec");
    }
  };

  const exportHref = React.useMemo(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("q", searchTerm);
    return `/api/expenses/export?${params.toString()}`;
  }, [searchTerm]);

  const getCategoryIcon = (c: ExpenseCategory) => {
    switch (c) {
      case "WATER":
        return <Droplet className="w-3.5 h-3.5 text-blue-500" />;
      case "ELECTRICITY":
        return <Zap className="w-3.5 h-3.5 text-amber-500" />;
      case "ELEVATOR":
        return <Building className="w-3.5 h-3.5 text-indigo-500" />;
      case "CLEANING":
        return <Sparkles className="w-3.5 h-3.5 text-teal-500" />;
      case "SECURITY":
        return <Shield className="w-3.5 h-3.5 text-pink-500" />;
      case "MAINTENANCE":
        return <Wrench className="w-3.5 h-3.5 text-orange-500" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Trésorerie & Factures Prestataires
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
            Dépenses & Factures Copropriété
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Enregistrement des factures fournisseurs, contrats d'entretien et justificatifs
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href={exportHref}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/80 dark:bg-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-xs min-h-[44px]"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Exporter CSV</span>
          </a>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle dépense</span>
          </button>
        </div>
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

      <div className="p-4 rounded-3xl glass-card flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par description ou libellé de prestataire..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Catégorie:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px]"
            >
              <option value="Tous">Toutes</option>
              {(values(ExpCat) as ExpenseCategory[]).map((k) => (
                <option key={k} value={k}>
                  {expenseCategoryFr(k)}
                </option>
              ))}
            </select>
          </div>
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
                  <th className="py-3.5 px-5">Description</th>
                  <th className="py-3.5 px-4">Résidence</th>
                  <th className="py-3.5 px-4">Catégorie</th>
                  <th className="py-3.5 px-4 text-right">Montant</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-5 text-center text-slate-500">
                      Aucune dépense à afficher.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white">{item.description}</td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{item.residenceName}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                          {getCategoryIcon(item.category)}
                          {expenseCategoryFr(item.category)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">{item.date}</td>
                      <td className="py-3.5 px-5 text-right">
                        {item.receiptUrl ? (
                          <a
                            href={item.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline min-h-[44px] inline-flex items-center"
                          >
                            Justificatif
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Total : {filteredExpenses.length} dépense(s) · Somme :{" "}
              <strong className="text-slate-900 dark:text-white font-mono">{formatCurrency(totalFiltered)}</strong>
            </span>
            <span className="font-mono text-[11px]">1 / 1</span>
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
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Enregistrer une dépense</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreate(e)} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Description / Prestataire *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Facture Entretien Ascenseur Mai 2026"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Montant (TND / €) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Catégorie</label>
                  <select
                    value={cat}
                    onChange={(e) => setCat(e.target.value as ExpenseCategory)}
                    className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="ELEVATOR">Ascenseur</option>
                    <option value="ELECTRICITY">Électricité (STEG)</option>
                    <option value="WATER">Eau (SONEDE)</option>
                    <option value="CLEANING">Nettoyage</option>
                    <option value="SECURITY">Sécurité</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Date de règlement</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                />
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
                  Enregistrer la dépense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
