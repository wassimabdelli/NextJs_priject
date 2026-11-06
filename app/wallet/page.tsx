"use client";

import { useEffect, useState } from "react";
import {
  Wallet,
  Upload,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { PaymentMethod, Role, chargeStatusLabel } from "@/types/enums";

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

  const isResident = role === Role.OWNER || role === Role.TENANT;
  const isManagement = role === Role.ADMIN || role === Role.SYNDIC;

  return (
    <AppLayout>
      <div className="sp-page">
        <div className="sp-page-header">
          <h1 className="sp-title text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Portefeuille
          </h1>
          <p className="sp-body text-sm text-slate-500">
            Charges dues, paiements partiels et preuves Flip / D17 / virement
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden /> {success}
          </div>
        )}

        {loading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
        ) : (
          <>
            {isResident && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Wallet className="h-4 w-4" /> Total dû
                      </div>
                      <p className="sp-num mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                        {totalDue.toFixed(2)} TND
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="h-4 w-4" /> En validation
                      </div>
                      <p className="sp-num mt-1 text-2xl font-bold text-amber-600">
                        {totalPending.toFixed(2)} TND
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="space-y-4 p-4">
                    <h2 className="font-bold text-slate-900 dark:text-white">
                      Déclarer un paiement
                    </h2>
                    <form onSubmit={submitPayment} className="space-y-3">
                      <Select
                        label="Charge *"
                        value={selectedCharge}
                        onChange={(e) => onChargeChange(e.target.value)}
                        options={charges.map((c) => ({
                          value: c._id,
                          label: `${c.period} · lot ${c.apartment?.number ?? "—"} · ${c.payableNow.toFixed(2)} TND`,
                        }))}
                        required
                      />
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
                        label="Mode *"
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        options={[
                          { value: PaymentMethod.FLIP, label: "Flip" },
                          { value: PaymentMethod.D17, label: "D17" },
                          { value: PaymentMethod.BANK_TRANSFER, label: "Virement" },
                          { value: PaymentMethod.CHEQUE, label: "Chèque" },
                          { value: PaymentMethod.CARD, label: "Carte" },
                        ]}
                      />
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Preuve (capture / PDF) *
                        </label>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="block w-full text-sm"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadProof(f);
                          }}
                        />
                        {uploading && <p className="text-xs text-slate-500">Upload…</p>}
                        {proofUrl && (
                          <p className="text-xs text-emerald-600">Fichier : {proofUrl}</p>
                        )}
                      </div>
                      <Button
                        type="submit"
                        variant="primary"
                        className="min-h-[44px] w-full gap-2"
                        disabled={!proofUrl || submitting || !selectedCharge}
                        isLoading={submitting}
                      >
                        <Upload className="h-4 w-4" />
                        Envoyer pour validation
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Mes charges ouvertes
                  </h2>
                  {charges.length === 0 ? (
                    <p className="text-pretty text-sm text-slate-500">Aucune charge due</p>
                  ) : (
                    charges.map((c) => (
                      <Card key={c._id}>
                        <CardContent className="flex items-center justify-between gap-3 p-4">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {c.period} · Lot {c.apartment?.number}
                            </p>
                            <p className="text-xs text-slate-500">
                              {c.apartment?.residence?.name} · reste {c.remaining.toFixed(2)} TND
                              {c.pendingProof > 0
                                ? ` (${c.pendingProof.toFixed(2)} en attente)`
                                : ""}
                            </p>
                          </div>
                          <Badge>
                            {chargeStatusLabel[c.status as keyof typeof chargeStatusLabel] ||
                              c.status}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                {pendingPayments.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Preuves en cours
                    </h2>
                    {pendingPayments.map((p) => (
                      <Card key={p._id}>
                        <CardContent className="flex items-center justify-between p-4 text-sm">
                          <span>
                            {p.amount.toFixed(2)} TND · {p.method}
                          </span>
                          <Badge variant="warning">En attente</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {isManagement && (
              <div className="space-y-3">
                <Card className="border-sky-200 dark:border-sky-900">
                  <CardContent className="p-4 text-sm text-slate-600 dark:text-slate-300">
                    Vue <strong>syndic</strong> : validation des preuves uniquement.
                    Pour voir le formulaire Flip/D17, déconnecte-toi et connecte-toi en
                    propriétaire (<code className="text-xs">resident@syndicpro.tn</code> /
                    <code className="text-xs"> Resident123!</code>).
                  </CardContent>
                </Card>
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                  <Receipt className="h-5 w-5 text-sky-500" />
                  Preuves à valider ({syndicPending.length})
                </h2>
                {syndicPending.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Aucune preuve en attente — un résident doit d&apos;abord en envoyer
                    depuis son portefeuille.
                  </p>
                ) : (
                  syndicPending.map((p) => (
                    <Card key={p._id}>
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">
                              {p.amount.toFixed(2)} TND · {p.method}
                            </p>
                            <p className="text-xs text-slate-500">
                              {p.submittedBy?.name} · lot{" "}
                              {p.charge?.apartment?.number} · {p.charge?.period}
                            </p>
                          </div>
                          <Badge variant="warning">À valider</Badge>
                        </div>
                        {p.proofUrl && (
                          <a
                            href={p.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-sky-600 underline"
                          >
                            Voir la preuve
                          </a>
                        )}
                        <div className="flex gap-2">
                          <Button
                            className="min-h-[44px] flex-1"
                            variant="primary"
                            onClick={() => validatePayment(p._id, "approve")}
                          >
                            Valider
                          </Button>
                          <Button
                            className="min-h-[44px] flex-1"
                            variant="outline"
                            onClick={() => validatePayment(p._id, "reject")}
                          >
                            Rejeter
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {!isResident && !isManagement && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <AlertTriangle className="h-4 w-4" />
                Portefeuille réservé aux résidents et au syndic.
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
