"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Role } from "@/types/enums";
import type { IncidentDashboardFilters } from "./types";

type Preset = "7days" | "30days" | "3months" | "6months" | "year" | "custom";

function localDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangeFor(preset: Exclude<Preset, "custom">) {
  const today = new Date();
  const to = localDateInput(today);
  const fromDate = new Date(today);
  if (preset === "7days") fromDate.setDate(fromDate.getDate() - 6);
  if (preset === "30days") fromDate.setDate(fromDate.getDate() - 29);
  if (preset === "3months") fromDate.setMonth(fromDate.getMonth() - 3);
  if (preset === "6months") fromDate.setMonth(fromDate.getMonth() - 6);
  if (preset === "year") fromDate.setMonth(0, 1);
  return { from: localDateInput(fromDate), to };
}

export function DashboardDateFilter({
  role,
  filters,
  residences,
  technicians,
  onChange,
}: {
  role: Role;
  filters: IncidentDashboardFilters;
  residences: Array<{ id: string; name: string }>;
  technicians: Array<{ id: string; name: string }>;
  onChange: (filters: IncidentDashboardFilters) => void;
}) {
  const [preset, setPreset] = useState<Preset>("6months");
  const canFilterScope = role === Role.ADMIN || role === Role.SYNDIC;
  const today = localDateInput(new Date());
  const applyPreset = (value: Preset) => {
    setPreset(value);
    if (value !== "custom") {
      onChange({ ...filters, ...rangeFor(value) });
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Période</span>
        <select value={preset} onChange={(event) => applyPreset(event.target.value as Preset)} className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <option value="7days">7 derniers jours</option>
          <option value="30days">30 derniers jours</option>
          <option value="3months">3 derniers mois</option>
          <option value="6months">6 derniers mois</option>
          <option value="year">Cette année</option>
          <option value="custom">Personnalisée</option>
        </select>
      </label>

      {preset === "custom" && (
        <>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Du
            <input type="date" value={filters.from || ""} max={filters.to || today} onChange={(event) => onChange({ ...filters, from: event.target.value })} className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Au
            <input type="date" value={filters.to || ""} min={filters.from || undefined} max={today} onChange={(event) => onChange({ ...filters, to: event.target.value })} className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </label>
        </>
      )}

      {canFilterScope && residences.length > 0 && (
        <label className="flex min-w-44 flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Résidence
          <select value={filters.residence || ""} onChange={(event) => onChange({ ...filters, residence: event.target.value || undefined })} className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option value="">Toutes les résidences autorisées</option>
            {residences.map((residence) => <option key={residence.id} value={residence.id}>{residence.name}</option>)}
          </select>
        </label>
      )}

      {canFilterScope && technicians.length > 0 && (
        <label className="flex min-w-44 flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Technicien
          <select value={filters.technician || ""} onChange={(event) => onChange({ ...filters, technician: event.target.value || undefined })} className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option value="">Tous les techniciens</option>
            {technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.name}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
