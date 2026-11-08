"use client";

import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import type { AnnouncementImpactItem } from "@/types/ai-intelligence";

type Props = { items: AnnouncementImpactItem[]; emptyReason?: string };
const disclaimer = "Les variations d’activité autour d’une annonce ne prouvent pas que l’annonce les a causées.";

function periodLabel(period?: { start: string; end: string }) {
  if (!period) return "Période non disponible";
  return `${new Date(period.start).toLocaleDateString("fr-FR")} – ${new Date(period.end).toLocaleDateString("fr-FR")}`;
}

export default function AnnouncementImpact({ items, emptyReason }: Props) {
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Activité autour des annonces</h2>
        <p className="mt-1 text-sm text-slate-500">Comparaisons descriptives avant et après publication, lorsque les données sont suffisantes.</p>
      </header>
      {!items.length ?       <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300"><Info aria-hidden="true" className="h-7 w-7" /></span><p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">Aucune comparaison disponible</p><p className="mt-1 text-sm text-slate-500">{emptyReason ?? "Une comparaison apparaîtra après publication et lorsque les périodes d’observation seront complètes."}</p></div> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => {
            const change = item.beforeCount && item.afterCount !== undefined
              ? item.afterCount - item.beforeCount
              : undefined;
            return <article key={item.id} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Publiée le {new Date(item.publishedAt).toLocaleDateString("fr-FR")}</p><h3 className="mt-2 font-semibold text-slate-900 dark:text-white">{item.title}</h3></div>
                {item.sufficientData && change !== undefined && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${change < 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : change > 0 ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{change < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : change > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : null}{change > 0 ? "+" : ""}{change}{item.percentageChange === undefined ? "" : ` (${item.percentageChange > 0 ? "+" : ""}${item.percentageChange} %)`}</span>}
              </div>
              {!item.sufficientData ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">{item.limitation ?? "Données insuffisantes pour comparer les périodes."}</p> : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><p className="text-xs text-slate-500">Avant · {periodLabel(item.beforePeriod)}</p><p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{item.beforeCount ?? "—"}</p><p className="text-xs text-slate-500">réclamations similaires</p></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><p className="text-xs text-slate-500">Après · {periodLabel(item.afterPeriod)}</p><p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{item.afterCount ?? "—"}</p><p className="text-xs text-slate-500">réclamations similaires</p></div></div>
              )}
              <p className="mt-4 flex gap-2 text-xs leading-5 text-slate-500"><Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{disclaimer}</p>
            </article>;
          })}
        </div>
      )}
    </section>
  );
}
