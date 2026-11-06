"use client";

import React from "react";
import {
  Clock,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  Sparkles,
  Receipt,
  AlertTriangle,
} from "lucide-react";
import { UserProfile, Residence } from "@/lib/redesign/condo";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import {
  PaymentMethod,
  Role,
  paymentMethodLabel,
  type PaymentMethod as PaymentMethodType,
} from "@/types/enums";

/** Props : noms d’affichage redesign ; données chargées côté client. */
interface WalletViewProps {
  currentUser: UserProfile;
  residence: Residence;
}

type WalletCharge = {
  _id: string;
  period: string;
  amount: number;
  paidAmount?: number;
  remaining: number;
  payableNow: number;
  pendingProof: number;
  status: string;
  dueDate?: string;
  apartment?: { number?: string; residence?: { name?: string } };
};

type WalletSession = {
  user?: { id?: string; name?: string | null; role?: string };
};

type WalletApiPayload = {
  totalDue: number;
  totalPendingProof: number;
  charges: WalletCharge[];
  pendingPayments: Array<{
    _id: string;
    amount: number;
    method: string;
    validationStatus?: string;
  }>;
};

type PendingPaymentFull = {
  _id: string;
  amount: number;
  method: string;
  proofUrl?: string;
  submittedBy?: { name?: string; email?: string };
  charge?: {
    period?: string;
    apartment?: { number?: string; residence?: { name?: string } };
  };
};

const RIB_DISPLAY = "TN59 1000 6035 1834 5678 9012";

const METHOD_OPTIONS: { value: PaymentMethodType; label: string }[] = [
  { value: PaymentMethod.FLIP, label: "Flip (paiement instantané interbancaire)" },
  { value: PaymentMethod.D17, label: "D17 (Poste tunisienne)" },
  { value: PaymentMethod.BANK_TRANSFER, label: "Virement bancaire direct" },
  { value: PaymentMethod.CARD, label: "Carte bancaire en ligne" },
  { value: PaymentMethod.CASH, label: "Espèces (avec reçu)" },
  { value: PaymentMethod.CHEQUE, label: "Chèque" },
];

function formatAmountTnd(n: number): string {
  return `${n.toFixed(2)} DT`;
}

export const WalletView: React.FC<WalletViewProps> = ({ currentUser, residence }) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [role, setRole] = React.useState<Role | null>(null);

  const [totalDue, setTotalDue] = React.useState(0);
  const [totalPendingProof, setTotalPendingProof] = React.useState(0);
  const [charges, setCharges] = React.useState<WalletCharge[]>([]);
  const [syndicPending, setSyndicPending] = React.useState<PendingPaymentFull[]>([]);

  const [selectedCharge, setSelectedCharge] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethodType>(PaymentMethod.FLIP);
  const [proofUrl, setProofUrl] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [copied, setCopied] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isResident = role === Role.OWNER || role === Role.TENANT;
  const isManagement = role === Role.ADMIN || role === Role.SYNDIC;

  const loadWalletForRoles = (r: Role | null) =>
    r === Role.OWNER || r === Role.TENANT || r === Role.ADMIN;

  const fetchSession = async (): Promise<WalletSession> => {
    const res = await fetch("/api/auth/session");
    return res.json() as Promise<WalletSession>;
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await fetchSession();
      const userRole = session?.user?.role as Role | undefined;
      setRole(userRole ?? null);

      if (userRole === Role.ADMIN || userRole === Role.SYNDIC) {
        const pendingRes = await fetchWithOffline<{ data: PendingPaymentFull[]; meta?: unknown }>(
          "/api/payments/pending"
        );
        setSyndicPending(pendingRes.data || []);
      } else {
        setSyndicPending([]);
      }

      if (userRole && loadWalletForRoles(userRole)) {
        const walletJson = await fetchWithOffline<{ data: WalletApiPayload }>("/api/wallet");
        const data = walletJson.data;
        if (!data) throw new Error("Réponse portefeuille invalide");
        setTotalDue(data.totalDue);
        setTotalPendingProof(data.totalPendingProof);
        setCharges(data.charges || []);
        if (data.charges?.[0]) {
          setSelectedCharge(data.charges[0]._id);
          setAmount(String(data.charges[0].payableNow ?? ""));
        } else {
          setSelectedCharge("");
          setAmount("");
        }
      } else {
        setTotalDue(0);
        setTotalPendingProof(0);
        setCharges([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const onChargeChange = (id: string) => {
    setSelectedCharge(id);
    const c = charges.find((x) => x._id === id);
    if (c) setAmount(String(c.payableNow ?? ""));
  };

  const handleCopyRib = () => {
    navigator.clipboard?.writeText(RIB_DISPLAY);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /** Upload multipart : hors fetchWithOffline JSON. */
  const uploadProof = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec du téléversement");
      setProofUrl(data.fileUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload échoué");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isResident) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchWithOffline("/api/wallet/payments", {
        method: "POST",
        body: JSON.stringify({
          charge: selectedCharge,
          amount: Number(amount),
          method,
          proofUrl,
        }),
        entity: "payment",
      });
      setSuccess("Preuve enregistrée — en attente de validation par le syndic.");
      setProofUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d’envoi");
    } finally {
      setSubmitting(false);
    }
  };

  const validatePayment = async (id: string, action: "approve" | "reject") => {
    const rejectionReason =
      action === "reject" ? window.prompt("Motif du rejet ?") || "" : undefined;
    if (action === "reject" && (!rejectionReason || rejectionReason.length < 3)) {
      setError("Motif de rejet obligatoire (min. 3 caractères)");
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await fetchWithOffline(`/api/payments/${id}/validate`, {
        method: "PATCH",
        body: JSON.stringify(
          action === "reject" ? { action, rejectionReason } : { action }
        ),
        entity: "payment",
      });
      setSuccess(action === "approve" ? "Paiement validé." : "Paiement rejeté.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de validation");
    }
  };

  const displayName = currentUser.name;
  const lotLabel = charges[0]?.apartment?.number
    ? `Lot ${charges[0].apartment.number}`
    : currentUser.lotId
      ? `Lot ${currentUser.lotId}`
      : "Lot —";

  const balanceMain = totalDue <= 0.001 ? "En règle" : "À régulariser";
  const syndicNotice =
    isManagement && !isResident ? (
      <div className="glass-card rounded-3xl p-5 flex items-start gap-3 border border-sky-500/20 bg-sky-500/5">
        <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Vue <strong>syndic / admin</strong> : validation des preuves. Pour déclarer un paiement
          (Flip / D17), connectez-vous avec un compte copropriétaire ou locataire.
        </p>
      </div>
    ) : null;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          Finances & Règlements
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
          Portefeuille Résident & Copropriété
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Suivi des appels de charges, déclarations de paiement (Flip, D17, Virement) et quittances
        </p>
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

      {loading ? (
        <div className="glass-card rounded-3xl p-10 animate-pulse min-h-[200px]" />
      ) : (
        <>
          {syndicNotice}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-6 glass-card rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Moyen de Paiement Principal
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Carte Digitale Copropriétaire
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCopyRib}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 hover:underline min-h-[44px] px-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>RIB Copié</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copier RIB Copro</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative pt-2 pb-2">
                <div className="rounded-2xl p-6 text-white bg-gradient-to-br from-[#fb7185] via-[#a855f7] to-[#3b82f6] shadow-xl shadow-purple-500/20 overflow-hidden border border-white/50 relative">
                  <div className="absolute top-0 -left-12 w-56 h-full bg-white/20 transform skew-x-12 pointer-events-none" />

                  <div className="flex items-start justify-between relative z-10">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-white/80">
                        {residence.name}
                      </span>
                      <p className="text-xs font-bold text-white/90">
                        {displayName} · {lotLabel}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-xl italic tracking-wider text-white">VISA</span>
                      <span className="text-[9px] block text-white/80 font-mono">RESIDENT</span>
                    </div>
                  </div>

                  <div className="mt-8 flex items-baseline justify-between relative z-10">
                    <div>
                      <span className="text-[10px] uppercase text-white/80 font-semibold block">
                        Statut Solde
                      </span>
                      <p className="text-2xl font-black font-mono tracking-tight text-white">
                        {formatAmountTnd(totalDue)} ({balanceMain})
                      </p>
                    </div>
                    <div className="w-9 h-7 rounded bg-amber-300/80 border border-amber-400 flex items-center justify-center text-[8px] font-bold text-amber-900 font-mono">
                      CHIP
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between relative z-10 text-xs font-mono">
                    <span className="tracking-widest font-bold">•••• •••• •••• 5688</span>
                    <span className="text-white/90 font-bold">EXP 08/29</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.04] flex items-center justify-between text-xs gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 block font-semibold">
                    RIB Bancaire Syndic (BIAT)
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 break-all">
                    {RIB_DISPLAY}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyRib}
                  className="shrink-0 px-2.5 py-1.5 min-h-[44px] rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 font-bold text-[11px] hover:bg-slate-100 transition-colors shadow-xs"
                >
                  Copier
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="glass-card rounded-3xl p-5 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      Solde exigible
                    </span>
                  </div>
                  <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                    {totalDue.toFixed(2)} DT
                  </div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {totalDue <= 0.001 ? "Vos cotisations sont à jour" : "Montant total restant dû"}
                  </p>
                </div>

                <div className="glass-card rounded-3xl p-5 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      En cours de validation
                    </span>
                  </div>
                  <div className="text-3xl font-black text-amber-500 font-mono">
                    {totalPendingProof.toFixed(2)} DT
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Preuves soumises, vérification par le trésorier / syndic
                  </p>
                </div>
              </div>

              <div className="glass-card rounded-3xl p-5 flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Règlements instantanés interbancaires (Flip & D17)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Les paiements effectués via les applications mobiles bancaires sont automatiquement
                    validés dès réception de la notification et délivrent instantanément un reçu officiel
                    certifié.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {isResident && (
            <div className="glass-card rounded-3xl p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Déclarer un nouveau paiement
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Téléversez la capture d’écran de votre virement ou reçu de paiement mobile (D17,
                  Flip, virement bancaire).
                </p>
              </div>

              <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs max-w-xl">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">
                    Charge concernée *
                  </label>
                  <select
                    className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                    value={selectedCharge}
                    onChange={(e) => onChargeChange(e.target.value)}
                    required
                  >
                    {charges.length === 0 ? (
                      <option value="">Aucune charge ouverte</option>
                    ) : (
                      charges.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.period} · Lot {c.apartment?.number ?? "—"} ·{" "}
                          {c.payableNow.toFixed(2)} DT
                          {c.payableNow <= 0 ? " (solde couvert ou en attente)" : ""}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">
                      Montant (DT) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">
                      Mode de paiement *
                    </label>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value as PaymentMethodType)}
                      className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                    >
                      {METHOD_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">
                    Preuve de paiement (capture / reçu PDF) *
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadProof(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-300 dark:border-white/15 rounded-2xl p-5 text-center cursor-pointer hover:border-blue-500 transition-colors bg-slate-50/50 dark:bg-white/[0.02] min-h-[44px]"
                  >
                    <UploadCloud className="w-7 h-7 text-blue-500 mx-auto mb-1.5" />
                    <span className="text-slate-700 dark:text-slate-200 font-bold block">
                      Glisser-déposer votre justificatif ou cliquer pour parcourir
                    </span>
                    <span className="block text-[11px] text-slate-400 mt-1">
                      PNG, JPG, WEBP ou PDF jusqu’à 5 Mo
                    </span>
                    {uploading && (
                      <span className="block text-[11px] text-amber-600 mt-2">Téléversement…</span>
                    )}
                    {proofUrl && (
                      <span className="block text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 font-semibold truncate">
                        Fichier : {proofUrl}
                      </span>
                    )}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!proofUrl || submitting || !selectedCharge || charges.length === 0}
                  className="w-full min-h-[44px] py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                >
                  <span>{submitting ? "Envoi…" : "Envoyer pour validation par le Syndic"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}

          {isManagement && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-sky-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Preuves à valider ({syndicPending.length})
                </h2>
              </div>
              {syndicPending.length === 0 ? (
                <div className="glass-card rounded-3xl p-6 text-xs text-slate-500 text-center">
                  Aucune preuve en attente.
                </div>
              ) : (
                <div className="space-y-3">
                  {syndicPending.map((p) => (
                    <div key={p._id} className="glass-card rounded-3xl p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">
                            {p.amount.toFixed(2)} DT ·{" "}
                            {paymentMethodLabel[p.method as PaymentMethod] || p.method}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {p.submittedBy?.name ?? "—"} · Lot {p.charge?.apartment?.number ?? "—"} ·{" "}
                            {p.charge?.period ?? ""}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-lg px-2 py-1">
                          À valider
                        </span>
                      </div>
                      {p.proofUrl && (
                        <a
                          href={p.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 underline min-h-[44px] inline-flex items-center"
                        >
                          Voir la preuve
                        </a>
                      )}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => void validatePayment(p._id, "approve")}
                          className="flex-1 min-h-[44px] rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold py-2.5"
                        >
                          Valider
                        </button>
                        <button
                          type="button"
                          onClick={() => void validatePayment(p._id, "reject")}
                          className="flex-1 min-h-[44px] rounded-xl border border-slate-300 dark:border-white/15 text-slate-800 dark:text-slate-200 text-xs font-bold py-2.5"
                        >
                          Rejeter
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isResident && !isManagement && role && (
            <div className="glass-card rounded-3xl p-5 flex items-center gap-2 text-xs text-slate-500">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Portefeuille réservé aux résidents et au syndic.
            </div>
          )}
        </>
      )}
    </div>
  );
};
