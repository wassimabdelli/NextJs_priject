"use client";

import React from "react";
import {
  Search,
  Plus,
  CreditCard,
  Printer,
  X,
  CheckCircle2,
  Download,
  AlertTriangle,
} from "lucide-react";
import type { PaymentReceipt } from "@/lib/redesign/condo";
import type { Residence } from "@/lib/redesign/condo";
import { formatCurrency } from "@/lib/redesign/condoLogic";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { PaymentMethod, values } from "@/types/enums";
import { paymentMethodToRedesignLabel, formatDateFrShort } from "@/components/redesign/apiMappers";

type PaymentRow = {
  _id: string;
  receiptNumber: string;
  amount: number;
  method: string;
  paymentDate?: string;
  receivedBy?: { name?: string };
  charge?: {
    period?: string;
    apartment?: { number?: string; residence?: { name?: string; address?: string } };
  };
};

type ChargeOpt = {
  _id: string;
  amount: number;
  paidAmount?: number;
  period: string;
  apartment?: { number?: string; residence?: { name?: string; address?: string } };
};

type ListRes = { data: PaymentRow[] };
type ChargeListRes = { data: ChargeOpt[] };

type UiPayment = PaymentReceipt & {
  /** Données résidence pour le modal d’impression (hors type mock redesign). */
  resDetail?: { name: string; address: string };
};

/** Libellé affiché (redesign) à partir du mode API. */
function methodToUi(method: string): PaymentReceipt["method"] {
  const m = method as PaymentMethod;
  const label = paymentMethodToRedesignLabel(method);
  const allowed: PaymentReceipt["method"][] = ["Virement", "Carte", "Espèces", "Flip", "D17"];
  if (allowed.includes(label as PaymentReceipt["method"])) return label as PaymentReceipt["method"];
  if (m === PaymentMethod.CHEQUE) return "Espèces";
  return "Virement";
}

export const PaymentsView: React.FC = () => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [modeFilter, setModeFilter] = React.useState<string>("Tous");
  const [showModal, setShowModal] = React.useState(false);
  const [activeReceipt, setActiveReceipt] = React.useState<UiPayment | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [payments, setPayments] = React.useState<UiPayment[]>([]);
  const [charges, setCharges] = React.useState<ChargeOpt[]>([]);

  const [selectedCharge, setSelectedCharge] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethod>(PaymentMethod.BANK_TRANSFER);
  const [paymentDate, setPaymentDate] = React.useState("");

  React.useEffect(() => {
    setPaymentDate(new Date().toISOString().slice(0, 10));
  }, []);
  const [notes, setNotes] = React.useState("");

  const mapPayment = React.useCallback((p: PaymentRow): UiPayment => {
    const apt = p.charge?.apartment;
    const res = apt?.residence as { name?: string; address?: string } | undefined;
    return {
      id: p._id,
      receiptNumber: p.receiptNumber,
      lotNumber: apt?.number ? `Lot ${apt.number}` : "—",
      residentName: p.receivedBy?.name ?? "—",
      amount: p.amount,
      method: methodToUi(p.method),
      date: formatDateFrShort(p.paymentDate),
      referenceNotes: p.charge?.period,
      resDetail:
        res?.name != null
          ? { name: String(res.name), address: String(res.address ?? "") }
          : undefined,
    };
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [payJson, chJson] = await Promise.all([
        fetchWithOffline<ListRes>("/api/payments?limit=200"),
        fetchWithOffline<ChargeListRes>("/api/charges?limit=500"),
      ]);
      const rows = (payJson.data || []).map(mapPayment);
      setPayments(rows);
      setCharges(chJson.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [mapPayment]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = payments.filter((p) => {
    const matchesSearch =
      p.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.residentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMode = modeFilter === "Tous" || p.method === modeFilter;
    return matchesSearch && matchesMode;
  });

  const selectedChargeDoc = charges.find((c) => c._id === selectedCharge);
  React.useEffect(() => {
    if (selectedChargeDoc) {
      const rem =
        Math.round(
          (selectedChargeDoc.amount - (selectedChargeDoc.paidAmount || 0)) * 100
        ) / 100;
      setAmount(rem > 0 ? String(rem) : "");
    }
  }, [selectedCharge, selectedChargeDoc]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCharge) return;
    setError(null);
    setSuccess(null);
    try {
      await fetchWithOffline("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          charge: selectedCharge,
          amount: Number(amount),
          method,
          paymentDate: new Date(paymentDate + "T12:00:00").toISOString(),
        }),
        entity: "payment",
      });
      setSuccess("Paiement enregistré.");
      setShowModal(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec");
    }
  };

  const exportHref = React.useMemo(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("q", searchTerm);
    return `/api/payments/export?${params.toString()}`;
  }, [searchTerm]);

  const receiptResidence: Residence = activeReceipt?.resDetail
    ? {
        id: "",
        name: activeReceipt.resDetail.name,
        city: "",
        address: activeReceipt.resDetail.address,
        totalLots: 0,
        syndicName: "",
      }
    : {
        id: "",
        name: "Copropriété",
        city: "",
        address: "",
        totalLots: 0,
        syndicName: "",
      };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Encaissements & Trésorerie
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
            Paiements Reçus & Quittances
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Reçus de paiement certifiés, grand livre des encaissements et quittances dématérialisées
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
            <span>Nouveau paiement</span>
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

      <div className="p-5 rounded-3xl glass-card border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Encaissement de règlement (Hors ligne garanti)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Enregistrez un paiement par chèque, virement ou espèces avec reçu automatique et contrôle du reste à payer.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all shrink-0"
        >
          <span>Encaisser un règlement</span>
        </button>
      </div>

      <div className="p-4 rounded-3xl glass-card flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par n° de reçu (REC-...), lot ou payeur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mode:</span>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px]"
            >
              <option value="Tous">Tous</option>
              <option value="Virement">Virement</option>
              <option value="Carte">Carte</option>
              <option value="Espèces">Espèces</option>
              <option value="Flip">Flip</option>
              <option value="D17">D17</option>
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
                  <th className="py-3.5 px-5">N° Reçu</th>
                  <th className="py-3.5 px-4">Lot / Résident</th>
                  <th className="py-3.5 px-4 text-right">Montant</th>
                  <th className="py-3.5 px-4">Mode</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-5 text-center text-slate-500">
                      Aucun paiement.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-900 dark:text-white">{item.receiptNumber}</td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-200">
                        <span className="font-bold">{item.lotNumber}</span>
                        <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">{item.residentName}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{item.method}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">{item.date}</td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => setActiveReceipt(item)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white dark:text-blue-400 border border-blue-500/25 text-xs font-bold transition-all shadow-xs"
                        >
                          Imprimer Reçu
                        </button>
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
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Enregistrer un encaissement</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreate(e)} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Charge concernée *</label>
                <select
                  required
                  value={selectedCharge}
                  onChange={(e) => setSelectedCharge(e.target.value)}
                  className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                >
                  <option value="">Sélectionner une charge</option>
                  {charges.map((c) => {
                    const rem = Math.round((c.amount - (c.paidAmount || 0)) * 100) / 100;
                    return (
                      <option key={c._id} value={c._id}>
                        {c.period} · Lot {c.apartment?.number ?? "—"} · reste {rem.toFixed(2)} TND
                      </option>
                    );
                  })}
                </select>
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
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Mode de paiement *</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                  >
                    {values(PaymentMethod).map((pm) => (
                      <option key={pm} value={pm}>
                        {paymentMethodToRedesignLabel(pm)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Date d'encaissement</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Référence / Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
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
                  Émettre la quittance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md animate-fadeIn"
          onClick={() => setActiveReceipt(null)}
        >
          <div className="w-full max-w-lg bg-white text-slate-900 rounded-3xl p-8 shadow-2xl space-y-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">SyndicPro · Quittance Officielle Certifiée</span>
                <h3 className="text-xl font-black mt-0.5 text-slate-900">Reçu de Cotisation Copropriété</h3>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  N° {activeReceipt.receiptNumber} · Émis le {activeReceipt.date}
                </p>
              </div>
              <button onClick={() => setActiveReceipt(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Copropriété</span>
                <strong className="block text-slate-900 mt-0.5 text-sm">{receiptResidence.name}</strong>
                <span className="text-slate-600">{receiptResidence.address}</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Copropriétaire / Débiteur</span>
                <strong className="block text-slate-900 mt-0.5 text-sm">{activeReceipt.residentName}</strong>
                <span className="text-slate-600">{activeReceipt.lotNumber}</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 border-b font-bold text-slate-700">
                  <tr>
                    <th className="p-3.5">Désignation</th>
                    <th className="p-3.5">Mode</th>
                    <th className="p-3.5 text-right">Montant Réglé</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3.5 font-semibold text-slate-800">
                      Appel de charges courantes ({activeReceipt.referenceNotes || "Cotisation"})
                    </td>
                    <td className="p-3.5 font-mono font-medium text-slate-700">{activeReceipt.method}</td>
                    <td className="p-3.5 text-right font-mono font-black text-emerald-600 text-sm">{formatCurrency(activeReceipt.amount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-xs pt-4 border-t border-slate-100">
              <div className="text-slate-500 font-medium">Cachet du Syndic gestionnaire · Document certifié conforme</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer</span>
                </button>
                <button onClick={() => setActiveReceipt(null)} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
