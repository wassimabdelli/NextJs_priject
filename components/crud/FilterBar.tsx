"use client";

import React, { useState } from "react";
import { Search, Plus, X, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/Button";

type FilterDef = {
  key: string;
  label: string;
  type: "select" | "boolean" | "month" | "dateRange";
  options?: { value: string; label: string }[];
};

type SortOption = {
  value: string;
  label: string;
};

export interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  canCreate?: boolean;
  createLabel?: string;
  onCreateClick?: () => void;
  children?: React.ReactNode;
  defs?: FilterDef[];
  values?: Record<string, string>;
  onValuesChange?: (v: Record<string, string>) => void;
  sortOptions?: SortOption[];
  sort?: string;
  onSortChange?: (s: string) => void;
}

// Met à jour une clé dans un objet de valeurs en supprimant les clés vides
function updateValueMap(
  current: Record<string, string>,
  key: string,
  val: string
): Record<string, string> {
  const next = { ...current };
  if (!val || val.trim() === "") {
    delete next[key];
  } else {
    next[key] = val;
  }
  return next;
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Rechercher...",
  canCreate = false,
  createLabel = "Nouveau",
  onCreateClick,
  children,
  defs,
  values = {},
  onValuesChange,
  sortOptions,
  sort = "",
  onSortChange,
}: FilterBarProps) {
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [draftSort, setDraftSort] = useState<string>("");

  const hasDefs = Array.isArray(defs) && defs.length > 0;
  const hasSortOptions = Array.isArray(sortOptions) && sortOptions.length > 0;

  // Construction des puces (chips) de filtres actifs
  const activeChips: { key: string; label: string; displayValue: string }[] = [];
  if (hasDefs && defs) {
    for (const def of defs) {
      if (def.type === "dateRange") {
        if (values.from) {
          activeChips.push({
            key: "from",
            label: `${def.label} (du)`,
            displayValue: values.from,
          });
        }
        if (values.to) {
          activeChips.push({
            key: "to",
            label: `${def.label} (au)`,
            displayValue: values.to,
          });
        }
      } else {
        const rawVal = values[def.key];
        if (rawVal !== undefined && rawVal !== "") {
          let displayValue = rawVal;
          if (def.type === "boolean") {
            displayValue = rawVal === "true" ? "Oui" : "Non";
          } else if (def.type === "select" && def.options) {
            const found = def.options.find((o) => o.value === rawVal);
            if (found) displayValue = found.label;
          }
          activeChips.push({
            key: def.key,
            label: def.label,
            displayValue,
          });
        }
      }
    }
  }

  const activeCount = activeChips.length;

  // Ouverture du panneau mobile avec copie de l'état courant
  const openMobileSheet = () => {
    setDraftValues({ ...values });
    setDraftSort(sort || "");
    setIsMobileSheetOpen(true);
  };

  // Application des filtres du panneau mobile
  const applyMobileSheet = () => {
    onValuesChange?.(draftValues);
    if (hasSortOptions && onSortChange) {
      onSortChange(draftSort);
    }
    setIsMobileSheetOpen(false);
  };

  // Réinitialisation dans le panneau mobile
  const resetMobileSheet = () => {
    setDraftValues({});
    if (hasSortOptions && sortOptions?.[0]) {
      setDraftSort(sortOptions[0].value);
    } else {
      setDraftSort("");
    }
  };

  // Suppression d'un filtre actif via sa puce
  const handleRemoveChip = (chipKey: string) => {
    if (!onValuesChange) return;
    onValuesChange(updateValueMap(values, chipKey, ""));
  };

  // Effacement de tous les filtres actifs
  const handleClearAll = () => {
    onValuesChange?.({});
  };

  const controlClassName =
    "min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-800 dark:bg-slate-900/60 dark:text-white";

  // Rendu d'un contrôle de filtre unitaire (utilisé en desktop et en mobile)
  const renderFilterControl = (
    def: FilterDef,
    currentValues: Record<string, string>,
    onChangeMap: (next: Record<string, string>) => void,
    fullWidth = false
  ) => {
    const widthClass = fullWidth ? "w-full" : "w-auto";

    if (def.type === "select") {
      return (
        <div key={def.key} className={`flex flex-col gap-1 ${widthClass}`}>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {def.label}
          </label>
          <select
            aria-label={def.label}
            value={currentValues[def.key] || ""}
            onChange={(e) =>
              onChangeMap(updateValueMap(currentValues, def.key, e.target.value))
            }
            className={`${controlClassName} ${widthClass}`}
          >
            <option value="">Tous</option>
            {def.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (def.type === "boolean") {
      return (
        <div key={def.key} className={`flex flex-col gap-1 ${widthClass}`}>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {def.label}
          </label>
          <select
            aria-label={def.label}
            value={currentValues[def.key] || ""}
            onChange={(e) =>
              onChangeMap(updateValueMap(currentValues, def.key, e.target.value))
            }
            className={`${controlClassName} ${widthClass}`}
          >
            <option value="">Tous</option>
            <option value="true">Oui</option>
            <option value="false">Non</option>
          </select>
        </div>
      );
    }

    if (def.type === "month") {
      return (
        <div key={def.key} className={`flex flex-col gap-1 ${widthClass}`}>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {def.label}
          </label>
          <input
            type="month"
            aria-label={def.label}
            value={currentValues[def.key] || ""}
            onChange={(e) =>
              onChangeMap(updateValueMap(currentValues, def.key, e.target.value))
            }
            className={`${controlClassName} ${widthClass}`}
          />
        </div>
      );
    }

    if (def.type === "dateRange") {
      return (
        <div
          key={def.key}
          className={`flex flex-col gap-1 ${fullWidth ? "w-full" : "sm:flex-row sm:items-end sm:gap-2"}`}
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {def.label} (du)
            </label>
            <input
              type="date"
              aria-label={`${def.label} du`}
              value={currentValues.from || ""}
              onChange={(e) =>
                onChangeMap(updateValueMap(currentValues, "from", e.target.value))
              }
              className={`${controlClassName} ${widthClass}`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {def.label} (au)
            </label>
            <input
              type="date"
              aria-label={`${def.label} au`}
              value={currentValues.to || ""}
              onChange={(e) =>
                onChangeMap(updateValueMap(currentValues, "to", e.target.value))
              }
              className={`${controlClassName} ${widthClass}`}
            />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Zone de recherche tactile */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white py-2.5 pr-10 pl-10 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-800 dark:bg-slate-900/60 dark:text-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute inset-y-0 right-0 flex min-w-[44px] items-center justify-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Effacer la recherche"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filtres additionnels éventuels, bouton Filtres mobile & Bouton Créer */}
        <div className="flex flex-wrap items-center gap-2">
          {(hasDefs || hasSortOptions) && (
            <button
              type="button"
              onClick={openMobileSheet}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-50 md:hidden dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filtres</span>
              {activeCount > 0 && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-600 px-1.5 text-xs font-semibold text-white">
                  {activeCount}
                </span>
              )}
            </button>
          )}

          {children}

          {canCreate && onCreateClick && (
            <Button
              type="button"
              onClick={onCreateClick}
              size="md"
              className="min-h-[44px] flex-1 gap-2 whitespace-nowrap sm:flex-initial"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>{createLabel}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Barre de filtres et de tri en ligne sur Desktop (md+) */}
      {(hasDefs || hasSortOptions) && (
        <div className="hidden flex-wrap items-end gap-3 md:flex">
          {hasDefs &&
            defs?.map((def) =>
              renderFilterControl(def, values, (next) => onValuesChange?.(next), false)
            )}

          {hasSortOptions && (
            <div className="ml-auto flex flex-col gap-1">
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span>Trier par</span>
              </label>
              <select
                aria-label="Trier par"
                value={sort}
                onChange={(e) => onSortChange?.(e.target.value)}
                className={controlClassName}
              >
                {sortOptions?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Puces (chips) des filtres actifs */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 py-1 pr-1.5 pl-3 text-xs font-medium text-sky-900 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-200"
            >
              <span>
                {chip.label} : <strong>{chip.displayValue}</strong>
              </span>
              <button
                type="button"
                onClick={() => handleRemoveChip(chip.key)}
                aria-label={`Retirer le filtre ${chip.label}`}
                className="inline-flex min-h-[28px] min-w-[28px] items-center justify-center rounded-full text-sky-700 hover:bg-sky-200/60 dark:text-sky-300 dark:hover:bg-sky-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex min-h-[36px] items-center rounded-lg px-2.5 text-xs font-medium text-slate-600 underline-offset-2 hover:underline dark:text-slate-400"
          >
            Tout effacer
          </button>
        </div>
      )}

      {/* Panneau inférieur mobile local (sous md) */}
      {isMobileSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/50 backdrop-blur-xs md:hidden dark:bg-slate-950/70"
          onClick={() => setIsMobileSheetOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Filtres et tri
              </h3>
              <button
                type="button"
                onClick={() => setIsMobileSheetOpen(false)}
                aria-label="Fermer les filtres"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {hasDefs &&
                defs?.map((def) =>
                  renderFilterControl(def, draftValues, setDraftValues, true)
                )}

              {hasSortOptions && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Trier par
                  </label>
                  <select
                    aria-label="Trier par"
                    value={draftSort}
                    onChange={(e) => setDraftSort(e.target.value)}
                    className={`${controlClassName} w-full`}
                  >
                    {sortOptions?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={resetMobileSheet}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Réinitialiser
              </button>
              <button
                type="button"
                onClick={applyMobileSheet}
                className="min-h-[44px] flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-base font-medium text-white hover:bg-sky-700"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
