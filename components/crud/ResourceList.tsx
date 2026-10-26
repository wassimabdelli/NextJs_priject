"use client";

import React from "react";
import { Edit2, Trash2, ChevronLeft, ChevronRight, FileText, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ResourceConfig, ListColumn } from "@/lib/resources/types";
import type { PaginationMeta } from "@/hooks/useResource";

type RowLinkItem = {
  label: string;
  href: (item: any) => string;
};

export interface ResourceListProps<T = any> {
  config: ResourceConfig<T>;
  items: T[];
  loading: boolean;
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onCreateClick?: () => void;
  userRole?: string;
  rowLinks?: RowLinkItem[];
}

export function ResourceList<T extends { _id?: string; id?: string }>({
  config,
  items,
  loading,
  meta,
  onPageChange,
  onEdit,
  onDelete,
  onCreateClick,
  userRole,
  rowLinks,
}: ResourceListProps<T>) {
  // Rendu de la valeur d'une cellule pour la vue tableau
  const renderCellValue = (column: ListColumn<T>, item: T) => {
    const rawVal = item[column.key as keyof T];

    if (column.render) {
      return column.render(rawVal, item);
    }

    if (rawVal === undefined || rawVal === null) {
      return <span className="text-slate-400">—</span>;
    }

    if (column.type === "date") {
      try {
        return new Date(rawVal as string).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      } catch {
        return String(rawVal);
      }
    }

    if (column.type === "boolean") {
      return rawVal ? (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
          Oui
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          Non
        </span>
      );
    }

    if (column.type === "relation" && typeof rawVal === "object") {
      return (rawVal as any).name || (rawVal as any).title || String((rawVal as any)._id || "");
    }

    return String(rawVal);
  };

  // 1. ÉTAT DE CHARGEMENT (SKELETONS)
  if (loading) {
    return (
      <div className="space-y-3">
        {/* Mobile skeleton */}
        <div className="space-y-3 md:hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex justify-between pt-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Desktop skeleton */}
        <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-900/60">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 2. ÉTAT VIDE
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900/40">
        <EmptyState
          icon={<FileText className="h-6 w-6 stroke-[1.75]" />}
          title={`Aucun(e) ${config.label.toLowerCase()}`}
          description={`Aucun élément trouvé dans cette vue. Vous pouvez créer votre premier(e) ${config.label.toLowerCase()}.`}
          action={
            onCreateClick && (!config.canCreate || config.canCreate(userRole)) ? (
              <Button type="button" onClick={onCreateClick} variant="primary" size="md">
                Créer un(e) {config.label.toLowerCase()}
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  const totalPages = Math.ceil(meta.total / (meta.limit || 20)) || 1;
  const hasRowLinks = Array.isArray(rowLinks) && rowLinks.length > 0;

  return (
    <div className="space-y-4">
      {/* ======================================================== */}
      {/* 3. VUE MOBILE : CARTES TACTILES (md:hidden)              */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {items.map((item) => {
          const id = item._id || item.id || "";
          const allowEdit = onEdit && (!config.canEdit || config.canEdit(item, userRole));
          const allowDelete = onDelete && (!config.canDelete || config.canDelete(item, userRole));
          const isUnsynced = Boolean((item as any).createdOffline || (item as any).pending);
          const showItemLinks = hasRowLinks && !isUnsynced;

          return (
            <Card
              key={id}
              className="relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700"
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900 line-clamp-1 dark:text-white">
                      {config.cardTitle(item)}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-2 dark:text-slate-400">
                      {config.cardSubtitle(item)}
                    </p>
                  </div>

                  {config.badgeField && item[config.badgeField.name as keyof T] !== undefined && (
                    <span className="shrink-0 inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-400">
                      {String(item[config.badgeField.name as keyof T])}
                    </span>
                  )}
                </div>

                {/* Actions tactiles mobile >= 44px */}
                {(allowEdit || allowDelete || showItemLinks) && (
                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    {showItemLinks &&
                      rowLinks!.map((link) => (
                        <a
                          key={link.label}
                          href={link.href(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>{link.label}</span>
                        </a>
                      ))}
                    {allowEdit && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(item)}
                        className="min-h-[44px] gap-1.5 px-3 text-xs"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Modifier
                      </Button>
                    )}
                    {allowDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(item)}
                        className="min-h-[44px] gap-1.5 px-3 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Supprimer
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* 4. VUE DESKTOP : TABLEAU STRUCTURE (hidden md:block)     */}
      {/* ======================================================== */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block dark:border-slate-800 dark:bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                {config.listColumns.map((col) => (
                  <th key={col.key} className="px-5 py-3.5">
                    {col.label}
                  </th>
                ))}
                {(onEdit || onDelete || hasRowLinks) && (
                  <th className="px-5 py-3.5 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {items.map((item) => {
                const id = item._id || item.id || "";
                const allowEdit = onEdit && (!config.canEdit || config.canEdit(item, userRole));
                const allowDelete =
                  onDelete && (!config.canDelete || config.canDelete(item, userRole));
                const isUnsynced = Boolean((item as any).createdOffline || (item as any).pending);
                const showItemLinks = hasRowLinks && !isUnsynced;

                return (
                  <tr
                    key={id}
                    className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                  >
                    {config.listColumns.map((col) => (
                      <td key={col.key} className="px-5 py-4 text-slate-700 dark:text-slate-300">
                        {renderCellValue(col, item)}
                      </td>
                    ))}

                    {(onEdit || onDelete || hasRowLinks) && (
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {showItemLinks &&
                            rowLinks!.map((link) => (
                              <a
                                key={link.label}
                                href={link.href(item)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                              >
                                <Download className="h-3.5 w-3.5" />
                                <span>{link.label}</span>
                              </a>
                            ))}
                          {allowEdit && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(item)}
                              className="h-8 w-8 p-0 text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400"
                              title="Modifier"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          {allowDelete && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onDelete(item)}
                              className="h-8 w-8 p-0 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. BARRE DE PAGINATION MOBILE & DESKTOP                  */}
      {/* ======================================================== */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/60">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Affichage de{" "}
          <span className="font-semibold text-slate-900 dark:text-white">
            {meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1}
          </span>{" "}
          à{" "}
          <span className="font-semibold text-slate-900 dark:text-white">
            {Math.min(meta.page * meta.limit, meta.total)}
          </span>{" "}
          sur <span className="font-semibold text-slate-900 dark:text-white">{meta.total}</span>{" "}
          {config.plural.toLowerCase()}
        </p>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(meta.page - 1)}
            disabled={meta.page <= 1}
            className="min-h-[44px] gap-1 px-3 text-xs sm:min-h-[36px]"
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </Button>

          <span className="px-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            {meta.page} / {totalPages}
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(meta.page + 1)}
            disabled={meta.page >= totalPages}
            className="min-h-[44px] gap-1 px-3 text-xs sm:min-h-[36px]"
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
