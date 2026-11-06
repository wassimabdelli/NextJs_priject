"use client";

import { Building2, ChevronDown } from "lucide-react";
import type { ResidenceOption } from "@/hooks/useResidence";

interface ResidencePickerProps {
  residences: ResidenceOption[];
  selectedId: string | null;
  onChange: (id: string) => void;
  /** Si false (défaut), masque le picker quand il n'y a qu'une seule résidence */
  alwaysShow?: boolean;
}

/**
 * Sélecteur de résidence affiché en haut des pages multi-résidences.
 * Se cache automatiquement si l'utilisateur n'appartient qu'à une résidence.
 */
export function ResidencePicker({
  residences,
  selectedId,
  onChange,
  alwaysShow = false,
}: ResidencePickerProps) {
  // Ne pas afficher si une seule résidence (sauf alwaysShow)
  if (!alwaysShow && residences.length <= 1) return null;
  if (residences.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 shrink-0 text-sky-500" />
      <div className="relative">
        <select
          value={selectedId ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="
            min-h-[44px] appearance-none cursor-pointer
            rounded-xl border border-slate-200 bg-white
            pl-3 pr-8 py-2 text-sm font-semibold text-slate-900
            shadow-sm transition
            hover:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30
            dark:border-slate-700 dark:bg-slate-900 dark:text-white
          "
        >
          {residences.map((r) => (
            <option key={r._id} value={r._id}>
              {r.name} — {r.city}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

