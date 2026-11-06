"use client";

import { useEffect, useState } from "react";
import {
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  ArrowRight,
  Check,
  Copy,
  Sparkles,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { PaymentMethod, Role, chargeStatusLabel } from "@/types/enums";

/** RIB d'affichage (maquette redesign) — aligner sur les données syndic si exposées par l'API. */
const SYNDIC_RIB_DISPLAY = "TN59 1000 6035 1834 5678 9012";

type WalletCharge = {
  _id: string;
  period: string;
  amount: number;
  paidAmount: number;
  remaining: number;
  payableNow: number;
  pendingProof: number;
  status: string;
  dueDate: string;
  apartment?: { number?: string; residence?: { name?: string } };
};

export default function WalletPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [totalDue, setTotalDue] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [charges, setCharges] = useState<WalletCharge[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [syndicPending, setSyndicPending] = useState<any[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [sessionUser, setSessionUser] = useState<{ name?: string | null } | null>(null);
  const [ribCopied, setRibCopied] = useState(false);

  const [selectedCharge, setSelectedCharge] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>(PaymentMethod.FLIP);
  const [proofUrl, setProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await fetch("/api/auth/session").then((r) => r.json());
      if (session?.user) {
        setSessionUser(session.user);
      }
      const userRole = session?.user?.role as Role;
      setRole(userRole);

      if (userRole === Role.ADMIN || userRole === Role.SYNDIC) {
        const pending = await fetch("/api/payments/pending").then((r) => r.json());
        setSyndicPending(pending.data || []);
      }

      if (userRole === Role.OWNER || userRole === Role.TENANT || userRole === Role.ADMIN) {
        const res = await fetch("/api/wallet");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur portefeuille");
        setTotalDue(data.data.totalDue);
        setTotalPending(data.data.totalPendingProof);
        setCharges(data.data.charges || []);
        setPendingPayments(data.data.pendingPayments || []);
        if (data.data.charges?.[0]) {
          setSelectedCharge(data.data.charges[0]._id);
          setAmount(String(data.data.charges[0].payableNow || ""));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onChargeChange = (id: string) => {
    setSelectedCharge(id);
    const c = charges.find((x) => x._id === id);
    if (c) setAmount(String(c.payableNow));
  };

  const uploadProof = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec upload");
      setProofUrl(data.fileUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload échoué");
    } finally {
      setUploading(false);
    }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/wallet/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          charge: selectedCharge,
          amount: Number(amount),
          method,
          proofUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec");
      setSuccess("Preuve envoyée — en attente de validation du syndic.");
      setProofUrl("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const validatePayment = async (id: string, action: "approve" | "reject") => {
    const rejectionReason =
      action === "reject" ? prompt("Motif du rejet ?") || "" : undefined;
    if (action === "reject" && (!rejectionReason || rejectionReason.length < 3)) return;
    const res = await fetch(`/api/payments/${id}/validate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, rejectionReason }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Erreur validation");
      return;
    }
    setSuccess(action === "approve" ? "Paiement validé" : "Paiement rejeté");
    await load();
  };

  const copyRib = () => {
    void navigator.clipboard?.writeText(SYNDIC_RIB_DISPLAY.replace(/\s/g, ""));
    setRibCopied(true);
    setTimeout(() => setRibCopied(false), 2000);
  };

  const isResident = role === Role.OWNER || role === Role.TENANT;
  const isManagement = role === Role.ADMIN || role === Role.SYNDIC;

  const selectedChargeData = charges.find((c) => c._id === selectedCharge);
  const residenceLabel =
    selectedChargeData?.apartment?.residence?.name || charges[0]?.apartment?.residence?.name || "Copropriété";
  const lotLabel =
    selectedChargeData?.apartment?.number ?? charges[0]?.apartment?.number ?? "—";
  const displayName = sessionUser?.name?.trim() || "Copropriétaire";
  const balanceLine =
    totalDue <= 0
      ? `0,00 TND (En règle)`
      : `${totalDue.toFixed(2).replace(".", ",")} TND (À régler)`;

  return (
    <AppLayout>
      <div className="sp-page pb-12">
        {/* En-tête redesign */}
        <div className="border-b border-slate-200/80 pb-5 dark:border-white/[0.08]">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Finances & Règlements
          </span>
          <h1 className="sp-title mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Portefeuille Résident & Copropriété
          </h1>
          <p className="sp-body mt-1 max-w-2xl text-xs text-slate-500 dark:text-slate-400">
            Suivi des appels de charges, déclarations de paiement (Flip, D17, virement) et quittances
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
          >
            {error}
          </div>
        )}
        {success && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <CheckCircle2 className="size-4 shrink-0" aria-hidden /> {success}
          </div>
        )}

        {loading ? (
          <div className="h-40 animate-pulse rounded-3xl bg-slate-200/60 dark:bg-slate-800/60" />
        ) : (
          <>
            {isResident && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                  {/* Carte virtuelle + RIB */}
                  <div className="glass-card rounded-3xl p-6 lg:col-span-6">
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Moyen de paiement principal
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          Carte digitale copropriétaire
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={copyRib}
                        className="shrink-0 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {ribCopied ? (
                          <span className="inline-flex items-center gap-1">
                            <Check className="size-3.5 text-emerald-500" />
                            RIB copié
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Copy className="size-3.5" />
                            Copier RIB copro
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="relative pt-2 pb-2">
                      <div className="relative overflow-hidden rounded-2xl border border-white/50 bg-gradient-to-br from-[#fb7185] via-[#a855f7] to-[#3b82f6] p-6 text-white shadow-xl shadow-purple-500/20">
                        <div className="pointer-events-none absolute top-0 -left-12 h-full w-56 -skew-x-12 transform bg-white/20" />

                        <div className="relative z-10 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-white/80">
                              {residenceLabel}
                            </span>
                            <p className="text-xs font-bold text-white/90">
                              {displayName} · Lot {lotLabel}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-xl italic tracking-wider text-white">VISA</span>
                            <span className="block font-mono text-[9px] text-white/80">RÉSIDENT</span>
                          </div>
                        </div>

                        <div className="relative z-10 mt-8 flex items-baseline justify-between">
                          <div>
                            <span className="block text-[10px] font-semibold uppercase text-white/80">
                              Statut solde
                            </span>
                            <p className="sp-num text-2xl font-black tracking-tight text-white">{balanceLine}</p>
                          </div>
                          <div className="flex h-7 w-9 items-center justify-center rounded border border-amber-400 bg-amber-300/80 font-mono text-[8px] font-bold text-amber-900">
                            CHIP
                          </div>
                        </div>

                        <div className="relative z-10 mt-4 flex items-center justify-between border-t border-white/20 pt-3 font-mono text-xs">
                          <span className="font-bold tracking-widest">•••• •••• •••• 5688</span>
                          <span className="font-bold text-white/90">EXP 08/29</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-slate-200/60 bg-slate-50 p-3 text-xs dark:border-white/[0.04] dark:bg-white/[0.03]">
                      <div className="min-w-0">
                        <span className="block text-[10px] font-semibold text-slate-400">
                          RIB bancaire syndic (affichage)
                        </span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {SYNDIC_RIB_DISPLAY}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={copyRib}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        {ribCopied ? "Copié" : "Copier"}
                      </button>
                    </div>
                  </div>

                  {/* Soldes + notice Flip/D17 */}
                  <div className="space-y-4 lg:col-span-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="glass-card space-y-2 rounded-3xl p-5">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <div className="flex size-8 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                            <CheckCircle2 className="size-4" />
                          </div>
                          <span className="font-semibold text-slate-600 dark:text-slate-300">Solde exigible</span>
                        </div>
                        <div className="sp-num text-3xl font-black text-slate-900 dark:text-white">
                          {totalDue.toFixed(2)} TND
                        </div>
                        <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <Check className="size-3" />
                          {totalDue <= 0 ? "Vos cotisations sont à jour" : "Montant total restant à régler"}
                        </p>
                      </div>

                      <div className="glass-card space-y-2 rounded-3xl p-5">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <div className="flex size-8 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-500">
                            <Clock className="size-4" />
                          </div>
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            En cours de validation
                          </span>
                        </div>
                        <div className="sp-num text-3xl font-black text-amber-500">{totalPending.toFixed(2)} TND</div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {totalPending > 0
                            ? "Montant en vérification par le trésorier / syndic"
                            : "Aucun paiement en attente de validation"}
                        </p>
                      </div>
                    </div>

                    <div className="glass-card flex items-start gap-3.5 rounded-3xl p-5">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
                        <Sparkles className="size-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Règlements instantanés interbancaires (Flip & D17)
                        </h4>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                          Les paiements via applications mobiles bancaires peuvent être validés dès réception de la
                          preuve ; envoyez une capture ou un reçu PDF pour accélérer la validation.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Formulaire paiement */}
                <div className="glass-card space-y-4 rounded-3xl p-6">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Déclarer un nouveau paiement</h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Téléversez la capture de votre virement ou reçu (D17, Flip, virement bancaire).
                    </p>
                  </div>

                  <form onSubmit={submitPayment} className="max-w-xl space-y-4 text-xs">
                    <Select
                      label="Charge concernée *"
                      value={selectedCharge}
                      onChange={(e) => onChargeChange(e.target.value)}
                      options={charges.map((c) => ({
                        value: c._id,
                        label: `${c.period} · lot ${c.apartment?.number ?? "—"} · ${c.payableNow.toFixed(2)} TND`,
                      }))}
                      required
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Input
                        label="Montant (TND) *"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                      <Select
                        label="Mode de paiement *"
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        options={[
                          { value: PaymentMethod.FLIP, label: "Flip (paiement instantané interbancaire)" },
                          { value: PaymentMethod.D17, label: "D17 (Poste Tunisienne)" },
                          { value: PaymentMethod.BANK_TRANSFER, label: "Virement bancaire direct" },
                          { value: PaymentMethod.CHEQUE, label: "Chèque" },
                          { value: PaymentMethod.CARD, label: "Carte bancaire en ligne" },
                        ]}
                      />
                    </div>

                    <div className="space-y-2">
                      <span className="block font-semibold text-slate-600 dark:text-slate-300">
                        Preuve de paiement (capture / reçu PDF) *
                      </span>
                      <label className="block cursor-pointer">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadProof(f);
                          }}
                        />
                        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-5 text-center transition-colors hover:border-blue-500 dark:border-white/15 dark:bg-white/[0.02]">
                          <UploadCloud className="mx-auto mb-1.5 size-7 text-blue-500" aria-hidden />
                          <span className="block font-bold text-slate-700 dark:text-slate-200">
                            Glisser-déposer ou cliquer pour parcourir
                          </span>
                          <span className="mt-1 block text-[11px] text-slate-400">PNG, JPG ou PDF</span>
                          {uploading && <p className="mt-2 text-slate-500">Envoi en cours…</p>}
                          {proofUrl && (
                            <p className="mt-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              Fichier enregistré
                            </p>
                          )}
                        </div>
                      </label>
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      className="min-h-11 w-full gap-2"
                      disabled={!proofUrl || submitting || !selectedCharge}
                      isLoading={submitting}
                    >
                      <span>Envoyer pour validation par le syndic</span>
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Button>
                  </form>
                </div>

                {/* Charges ouvertes */}
                <div className="space-y-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Mes charges ouvertes</h2>
                  {charges.length === 0 ? (
                    <p className="text-pretty text-sm text-slate-500">Aucune charge due</p>
                  ) : (
                    <div className="space-y-2">
                      {charges.map((c) => (
                        <div key={c._id} className="glass-card rounded-3xl p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {c.period} · Lot {c.apartment?.number}
                              </p>
                              <p className="text-xs text-slate-500">
                                {c.apartment?.residence?.name} · reste {c.remaining.toFixed(2)} TND
                                {c.pendingProof > 0 ? ` (${c.pendingProof.toFixed(2)} en attente)` : ""}
                              </p>
                            </div>
                            <Badge>
                              {chargeStatusLabel[c.status as keyof typeof chargeStatusLabel] || c.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {pendingPayments.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Preuves en cours</h2>
                    {pendingPayments.map((p) => (
                      <div key={p._id} className="glass-card rounded-3xl p-4">
                        <div className="flex items-center justify-between text-sm">
                          <span>
                            {p.amount.toFixed(2)} TND · {p.method}
                          </span>
                          <Badge variant="warning">En attente</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isManagement && (
              <div className="space-y-6">
                <div className="glass-card rounded-3xl p-5 text-sm text-slate-600 dark:text-slate-300">
                  Vue <strong>syndic</strong> : validation des preuves uniquement. Pour le formulaire Flip/D17,
                  connectez-vous avec un compte résident.
                </div>

                <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                  <Receipt className="size-5 text-blue-500" />
                  Preuves à valider ({syndicPending.length})
                </h2>

                {syndicPending.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Aucune preuve en attente — un résident doit d&apos;abord en envoyer depuis son portefeuille.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {syndicPending.map((p) => (
                      <div key={p._id} className="glass-card space-y-3 rounded-3xl p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {p.amount.toFixed(2)} TND · {p.method}
                            </p>
                            <p className="text-xs text-slate-500">
                              {p.submittedBy?.name} · lot {p.charge?.apartment?.number} · {p.charge?.period}
                            </p>
                          </div>
                          <Badge variant="warning">À valider</Badge>
                        </div>
                        {p.proofUrl && (
                          <a
                            href={p.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-blue-600 underline dark:text-blue-400"
                          >
                            Voir la preuve
                          </a>
                        )}
                        <div className="flex gap-2">
                          <Button
                            className="min-h-11 flex-1"
                            variant="primary"
                            onClick={() => validatePayment(p._id, "approve")}
                          >
                            Valider
                          </Button>
                          <Button
                            className="min-h-11 flex-1"
                            variant="outline"
                            onClick={() => validatePayment(p._id, "reject")}
                          >
                            Rejeter
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isResident && !isManagement && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <AlertTriangle className="size-4" />
                Portefeuille réservé aux résidents et au syndic.
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
