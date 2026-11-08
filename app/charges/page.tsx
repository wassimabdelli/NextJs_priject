"use client";

import React, { useState, useEffect } from "react";
import { Calculator, CheckCircle2, AlertCircle } from "lucide-react";
import { ResourcePage } from "@/components/crud/ResourcePage";
import { chargeConfig } from "@/lib/resources/registry";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { Role } from "@/types/enums";
import { getOfflineSession } from "@/lib/offline/db";

export default function ChargesPage() {
  const [userRole, setUserRole] = useState<Role | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [residences, setResidences] = useState<Array<{ label: string; value: string }>>([]);
  const [selectedResidence, setSelectedResidence] = useState("");
  const [period, setPeriod] = useState("");
  const [totalBudget, setTotalBudget] = useState<number | "">("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    setPeriod(new Date().toISOString().slice(0, 7));
    setDueDate(new Date().toISOString().split("T")[0]);

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

    // Chargement des résidences
    fetchWithOffline<any>("/api/residences")
      .then((res) => {
        const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const opts = items.map((r: any) => ({
          label: r.name,
          value: r._id,
        }));
        setResidences(opts);
        if (opts.length > 0) setSelectedResidence(opts[0].value);
      })
      .catch(() => {});
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResidence || !totalBudget || Number(totalBudget) <= 0) {
      setErrorMessage("Veuillez sélectionner une copropriété et saisir un budget valide.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      const res = await fetchWithOffline<any>("/api/charges/generate", {
        method: "POST",
        body: JSON.stringify({
          residenceId: selectedResidence,
          period,
          totalBudget: Number(totalBudget),
          dueDate,
        }),
      });

      setSuccessMessage(
        res?.message || `Charges du mois ${period} générées avec succès au prorata des tantièmes !`
      );
      setIsModalOpen(false);
      setRefreshTrigger((prev) => prev + 1);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors de la génération des charges");
    } finally {
      setLoading(false);
    }
  };

  const isStaff = userRole === Role.ADMIN || userRole === Role.SYNDIC;

  return (
    <>
      <ResourcePage
        key={refreshTrigger}
        config={chargeConfig}
        headerExtra={() => (
          <div className="space-y-3">
            {/* Message de succès */}
            {successMessage && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-50/80 p-3.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Bouton d'action Générer réservé aux ADMIN / SYNDIC */}
            {isStaff && (
              <div className="flex flex-col gap-2 rounded-2xl border border-sky-500/20 bg-sky-50/50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-sky-500/20 dark:bg-sky-950/20">
                <div>
                  <h4 className="text-sm font-bold text-sky-950 dark:text-sky-200">
                    Appel de charges groupé
                  </h4>
                  <p className="text-xs text-sky-700/80 dark:text-sky-400">
                    Générez en un clic les charges pour tous les lots d&apos;une copropriété au
                    prorata des tantièmes.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setErrorMessage(null);
                    setIsModalOpen(true);
                  }}
                  className="min-h-[44px] gap-2 whitespace-nowrap text-xs sm:min-h-[36px]"
                >
                  <Calculator className="h-4 w-4" />
                  Générer les charges du mois
                </Button>
              </div>
            )}
          </div>
        )}
      />

      {/* Modal de génération des charges */}
      <BottomSheet
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Générer les charges du mois"
        description="Crée automatiquement une charge par lot au prorata de ses tantièmes, sans doublon."
      >
        <form onSubmit={handleGenerate} className="space-y-4 pt-2 pb-4">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Select
            label="Copropriété"
            required
            options={residences}
            value={selectedResidence}
            onChange={(e) => setSelectedResidence(e.target.value)}
            disabled={loading}
          />

          <Input
            label="Période (AAAA-MM)"
            type="text"
            required
            value={period}
            placeholder="Ex : 2026-10"
            onChange={(e) => setPeriod(e.target.value)}
            disabled={loading}
          />

          <Input
            label="Budget total à répartir (€)"
            type="number"
            required
            value={totalBudget}
            placeholder="Ex : 2500"
            onChange={(e) => setTotalBudget(parseFloat(e.target.value) || "")}
            disabled={loading}
            helperText="Le montant de chaque lot sera calculé : Budget × Tantièmes / Somme tantièmes"
          />

          <Input
            label="Date d'échéance"
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
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
              className="min-h-[44px]"
            >
              Lancer la génération
            </Button>
          </div>
        </form>
      </BottomSheet>
    </>
  );
}
