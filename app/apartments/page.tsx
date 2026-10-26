"use client";

import { AlertTriangle, CheckCircle2, PieChart } from "lucide-react";
import { ResourcePage } from "@/components/crud/ResourcePage";
import { apartmentConfig } from "@/lib/resources/registry";
import type { ApartmentDTO } from "@/types/api";

export default function ApartmentsPage() {
  return (
    <ResourcePage
      config={apartmentConfig}
      headerExtra={(items: ApartmentDTO[]) => {
        const totalShares = items.reduce((acc, curr) => acc + (Number(curr.shares) || 0), 0);
        const isOver = totalShares > 1000;
        const isExact = totalShares === 1000;

        return (
          <div
            className={`rounded-2xl border p-4 transition-all ${
              isOver
                ? "border-rose-500/30 bg-rose-50/80 text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200"
                : isExact
                ? "border-emerald-500/30 bg-emerald-50/80 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border-sky-500/20 bg-sky-50/60 text-sky-900 dark:border-sky-500/30 dark:bg-sky-950/30 dark:text-sky-200"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {isOver ? (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white shadow-sm">
                    <AlertTriangle className="h-5 w-5 stroke-[2.25]" />
                  </div>
                ) : isExact ? (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
                    <CheckCircle2 className="h-5 w-5 stroke-[2.25]" />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm">
                    <PieChart className="h-5 w-5 stroke-[2]" />
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-bold">
                    {isOver
                      ? "Attention : Dépassement de la base des tantièmes !"
                      : isExact
                      ? "Répartition complète et conforme (1 000 / 1 000)"
                      : "Répartition courante des tantièmes"}
                  </h4>
                  <p className="text-xs opacity-85">
                    {isOver
                      ? `Le total des tantièmes est de ${totalShares.toLocaleString("fr-FR")} / 1 000. Il excède la quote-part maximale légale de ${totalShares - 1000} tantièmes.`
                      : isExact
                      ? "La somme de l'ensemble des quotes-parts atteint exactement la base légale de 1 000 tantièmes."
                      : `Total actuel : ${totalShares.toLocaleString("fr-FR")} / 1 000 tantièmes (${1000 - totalShares} tantièmes restants à allouer).`}
                  </p>
                </div>
              </div>

              <div className="hidden shrink-0 text-right sm:block">
                <span className="text-lg font-extrabold">{totalShares}</span>
                <span className="text-xs opacity-75"> / 1000</span>
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
