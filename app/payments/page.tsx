"use client";

import React, { useState, useEffect } from "react";
import { HandCoins, CheckCircle2, AlertCircle } from "lucide-react";
import { ResourcePage } from "@/components/crud/ResourcePage";
import { paymentConfig } from "@/lib/resources/registry";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { Role, PaymentMethod } from "@/types/enums";
import { getOfflineSession } from "@/lib/offline/db";

export default function PaymentsPage() {
  const [userRole, setUserRole] = useState<Role | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [charges, setCharges] = useState<any[]>([]);
  const [selectedChargeId, setSelectedChargeId] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.BANK_TRANSFER);
  const [paymentDate, setPaymentDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    setPaymentDate(new Date().toISOString().split("T")[0]);

    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role as Role);
      })
      .catch(() => {
        getOfflineSession().then((offline) => {
          if (offline) setUserRole(offline.role);
        });
      });

    // Chargement des charges ouvertes pour sélection dans l'encaissement
    fetchWithOffline<any>("/api/charges")
      .then((res) => {
        const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setCharges(items);
        if (items.length > 0) {
          const first = items[0];
          setSelectedChargeId(first._id);
          const rem = Math.max(0, (first.amount || 0) - (first.paidAmount || 0));
          setAmount(rem > 0 ? rem : first.amount);
        }
      })
      .catch(() => {});
  }, []);

  const selectedCharge = charges.find((c) => c._id === selectedChargeId);
  const remaining = selectedCharge
    ? Math.max(0, (selectedCharge.amount || 0) - (selectedCharge.paidAmount || 0))
    : 0;

  const handleChargeChange = (id: string) => {
    setSelectedChargeId(id);
    const c = charges.find((item) => item._id === id);
    if (c) {
      const rem = Math.max(0, (c.amount || 0) - (c.paidAmount || 0));
      setAmount(rem > 0 ? rem : c.amount);
    }
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChargeId || !amount || Number(amount) <= 0) {
      setErrorMessage("Veuillez sélectionner une charge et saisir un montant valide.");
      return;
    }

    if (Number(amount) > remaining + 0.001) {
      setErrorMessage(
        `Le montant saisi (${Number(amount).toFixed(2)} €) dépasse le reste dû (${remaining.toFixed(2)} €).`
      );
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      const clientId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      await fetchWithOffline("/api/payments", {
        method: "POST",
        entity: "payment",
        body: JSON.stringify({
          charge: selectedChargeId,
          amount: Number(amount),
          method,
          paymentDate,
          clientId,
        }),
      });

      setSuccessMessage(
        "Règlement enregistré avec succès ! Reçu généré et charge mise à jour (fonctionne hors ligne)."
      );
      setIsModalOpen(false);
      setRefreshTrigger((prev) => prev + 1);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors de l'enregistrement du règlement");
    } finally {
      setLoading(false);
    }
  };

  const isStaff = userRole === Role.ADMIN || userRole === Role.SYNDIC;

  return (
    <>
      <ResourcePage
        key={refreshTrigger}
        config={paymentConfig}
        headerExtra={() => (
          <div className="space-y-3">
            {/* Message de succès */}
            {successMessage && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-50/80 p-3.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Écran d'action Encaisser utilisable hors ligne */}
            {isStaff && (
              <div className="flex flex-col gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-50/40 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-500/20 dark:bg-emerald-950/20">
                <div>
                  <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                    Encaissement de règlement (Hors ligne garanti)
                  </h4>
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                    Enregistrez un paiement par chèque, virement ou espèces avec reçu automatique et
                    contrôle du reste à payer.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setErrorMessage(null);
                    setIsModalOpen(true);
                  }}
                  className="min-h-[44px] gap-2 whitespace-nowrap bg-emerald-600 text-xs hover:bg-emerald-500 active:bg-emerald-700 sm:min-h-[36px]"
                >
                  <HandCoins className="h-4 w-4" />
                  Encaisser un règlement
                </Button>
              </div>
            )}
          </div>
        )}
      />

      {/* Modal / BottomSheet d'encaissement */}
      <BottomSheet
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Encaisser un règlement"
        description="Enregistre la transaction avec identifiant idempotent, date et calcul automatique du solde."
      >
        <form onSubmit={handleCollectPayment} className="space-y-4 pt-2 pb-4">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Sélection de la charge */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Charge à régler <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedChargeId}
              onChange={(e) => handleChargeChange(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              disabled={loading}
            >
              {charges.map((c) => {
                const aptNum =
                  typeof c.apartment === "object" ? c.apartment?.number : "N/A";
                const rem = Math.max(0, (c.amount || 0) - (c.paidAmount || 0));
                return (
                  <option key={c._id} value={c._id}>
                    Lot {aptNum} • {c.period} (Appelé : {c.amount} € - Reste : {rem.toFixed(2)} €)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Détails de la charge sélectionnée */}
          {selectedCharge && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex justify-between py-0.5 text-slate-500">
                <span>Montant total :</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {(selectedCharge.amount || 0).toFixed(2)} €
                </span>
              </div>
              <div className="flex justify-between py-0.5 text-slate-500">
                <span>Déjà réglé :</span>
                <span className="font-semibold text-emerald-600">
                  {(selectedCharge.paidAmount || 0).toFixed(2)} €
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900 dark:border-slate-700 dark:text-white">
                <span>Reste à payer :</span>
                <span className="text-rose-600">{remaining.toFixed(2)} €</span>
              </div>
            </div>
          )}

          <Input
            label="Montant du versement (€)"
            type="number"
            required
            value={amount}
            step="0.01"
            min="0.01"
            max={remaining}
            onChange={(e) => setAmount(parseFloat(e.target.value) || "")}
            disabled={loading}
            helperText={`Maximum autorisé : ${remaining.toFixed(2)} €`}
          />

          <Select
            label="Mode de règlement"
            required
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            disabled={loading}
            options={[
              { label: "Virement bancaire", value: "BANK_TRANSFER" },
              { label: "Chèque", value: "CHEQUE" },
              { label: "Espèces (Cash)", value: "CASH" },
              { label: "Carte bancaire", value: "CARD" },
            ]}
          />

          <Input
            label="Date d'encaissement"
            type="date"
            required
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            disabled={loading}
          />

          <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={loading}
              className="min-h-[44px]"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={loading}
              className="min-h-[44px] bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700"
            >
              Confirmer l&apos;encaissement
            </Button>
          </div>
        </form>
      </BottomSheet>
    </>
  );
}
