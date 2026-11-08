"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { RefreshCw, AlertCircle, Download } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { FilterBar } from "@/components/crud/FilterBar";
import { ResourceList } from "@/components/crud/ResourceList";
import { ResourceForm } from "@/components/crud/ResourceForm";
import { ConfirmDialog } from "@/components/crud/ConfirmDialog";
import { useResource } from "@/hooks/useResource";
import type { ResourceConfig } from "@/lib/resources/types";
import { Role } from "@/types/enums";
import { getOfflineSession } from "@/lib/offline/db";

export interface ResourcePageProps<T = any> {
  config: ResourceConfig<T>;
  title?: string;
  description?: string;
  headerExtra?: (items: T[]) => React.ReactNode;
}

function ResourcePageInner<T extends { _id?: string; id?: string }>({
  config,
  title,
  description,
  headerExtra,
}: ResourcePageProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const {
    items,
    meta,
    loading,
    error,
    search,
    filters,
    setPage,
    setSearch,
    setFilters,
    refresh,
    create,
    update,
    remove,
  } = useResource(config);

  const [userRole, setUserRole] = useState<Role | undefined>(undefined);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<T | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isUrlInitializedRef = useRef(false);

  // Suivi de l'état de connexion pour le bouton d'export CSV
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Lecture initiale unique de la query string au montage
  useEffect(() => {
    if (isUrlInitializedRef.current) return;
    isUrlInitializedRef.current = true;

    const initialQ = searchParams.get("q");
    if (initialQ) {
      setSearch(initialQ);
    }

    const initialFilters: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (["q", "page", "limit"].includes(key)) return;
      if (value !== "") {
        initialFilters[key] = value;
      }
    });

    if (Object.keys(initialFilters).length > 0) {
      setFilters(initialFilters);
    }
  }, [searchParams, setSearch, setFilters]);

  // Synchronisation de l'URL à chaque changement de recherche ou de filtres (sans page ni limit)
  useEffect(() => {
    if (!isUrlInitializedRef.current) return;

    const params = new URLSearchParams();
    if (search && search.trim() !== "") {
      params.set("q", search.trim());
    }
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (["page", "limit"].includes(key)) return;
        if (val !== undefined && val !== null && String(val) !== "") {
          params.set(key, String(val));
        }
      });
    }

    const queryString = params.toString();
    const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(targetUrl, { scroll: false });
  }, [search, filters, pathname, router]);

  // Récupération de la session utilisateur pour évaluer les permissions UI
  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role) {
          setUserRole(data.user.role as Role);
        } else {
          getOfflineSession().then((offline) => {
            if (offline) setUserRole(offline.role);
          });
        }
      })
      .catch(() => {
        getOfflineSession().then((offline) => {
          if (offline) setUserRole(offline.role);
        });
      });
  }, []);

  const pageTitle = title || config.plural;
  const pageDescription =
    description || `Gestion et consultation des ${config.plural.toLowerCase()}`;

  const allowCreate = !config.canCreate || config.canCreate(userRole);

  // Extraction des filtres sans la clé "sort" pour FilterBar
  const filterValuesWithoutSort: Record<string, string> = {};
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (k !== "sort" && v !== undefined && v !== null && String(v) !== "") {
        filterValuesWithoutSort[k] = String(v);
      }
    });
  }

  // Construction de la query string courante pour l'export CSV
  const exportQueryParams = new URLSearchParams();
  if (search && search.trim() !== "") {
    exportQueryParams.set("q", search.trim());
  }
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (["page", "limit"].includes(k)) return;
      if (v !== undefined && v !== null && String(v) !== "") {
        exportQueryParams.set(k, String(v));
      }
    });
  }
  const exportQuery = exportQueryParams.toString();

  const canExportCsv =
    Boolean(config.exportPath) &&
    (userRole === Role.ADMIN || userRole === Role.SYNDIC) &&
    isOnline;

  const filteredRowLinks = config.rowLinks?.filter(
    (l) => !l.roles || (userRole ? l.roles.includes(userRole) : false)
  );

  const handleOpenCreate = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: T) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleOpenDelete = (item: T) => {
    setDeletingItem(item);
    setIsConfirmOpen(true);
  };

  const handleSubmitForm = async (values: Record<string, any>) => {
    try {
      setIsSubmitting(true);
      if (editingItem) {
        const id = editingItem._id || editingItem.id || "";
        await update(id, values as Partial<T>);
      } else {
        await create(values as Partial<T>);
      }
      setIsFormOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      if (err?.details?.fieldErrors && typeof err.details.fieldErrors === "object") {
        const fieldErrors = err.details.fieldErrors as Record<string, string[]>;
        const fieldMap = new Map((config.fields || []).map((f) => [f.name, f.label]));
        const lines = Object.entries(fieldErrors).map(([name, messages]) => {
          const label = fieldMap.get(name) || name;
          const msg = Array.isArray(messages) && messages.length > 0 ? messages[0] : "";
          return `- ${label} : ${msg}`;
        });
        alert(`Données invalides :\n${lines.join("\n")}`);
      } else {
        alert(err.message || "Une erreur est survenue lors de l'enregistrement");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    try {
      setIsDeleting(true);
      const id = deletingItem._id || deletingItem.id || "";
      await remove(id);
      setIsConfirmOpen(false);
      setDeletingItem(null);
    } catch (err: any) {
      alert(err.message || "Erreur lors de la suppression");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* En-tête mobile-first */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              {pageTitle}
            </h1>
            <p className="text-xs text-slate-500 sm:text-sm dark:text-slate-400">
              {pageDescription}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {canExportCsv && (
              <a
                href={`${config.exportPath}?${exportQuery}`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:min-h-[36px] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                <span>Exporter CSV</span>
              </a>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="min-h-[44px] gap-1.5 sm:min-h-[36px]"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
          </div>
        </div>

        {/* Message d'erreur éventuel */}
        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-50/50 p-4 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/20 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Indicateurs ou bandeaux personnalisés */}
        {headerExtra && headerExtra(items)}

        {/* Barre de filtrage et d'action */}
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={
            config.searchPlaceholder || `Rechercher ${config.plural.toLowerCase()}...`
          }
          canCreate={allowCreate}
          createLabel={`Nouveau ${config.label.toLowerCase()}`}
          onCreateClick={handleOpenCreate}
          defs={config.filterDefs}
          values={filterValuesWithoutSort}
          onValuesChange={(v) =>
            setFilters({ ...v, ...(filters.sort ? { sort: filters.sort } : {}) })
          }
          sortOptions={config.sortOptions}
          sort={filters.sort}
          onSortChange={(s) => setFilters({ ...filters, sort: s })}
        />

        {/* Liste des éléments (Cartes sur mobile, Tableau sur desktop) */}
        <ResourceList
          config={config}
          items={items}
          loading={loading}
          meta={meta}
          onPageChange={setPage}
          onEdit={handleOpenEdit}
          onDelete={handleOpenDelete}
          onCreateClick={handleOpenCreate}
          userRole={userRole}
          rowLinks={filteredRowLinks}
        />

        {/* Formulaire Bottom Sheet / Modal */}
        <ResourceForm
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingItem(null);
          }}
          fields={config.fields}
          title={
            editingItem
              ? `Modifier ${config.label.toLowerCase()}`
              : `Nouveau ${config.label.toLowerCase()}`
          }
          description={`Remplissez les informations ci-dessous pour ${
            editingItem ? "mettre à jour" : "créer"
          } ${config.label.toLowerCase()}.`}
          initialData={editingItem}
          loading={isSubmitting}
          onSubmit={handleSubmitForm}
        />

        {/* Boîte de dialogue de confirmation de suppression */}
        <ConfirmDialog
          isOpen={isConfirmOpen}
          title={`Supprimer ${config.label.toLowerCase()}`}
          message={`Êtes-vous sûr de vouloir supprimer cet élément ? Cette action est irréversible.`}
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
          isDestructive={true}
          loading={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setIsConfirmOpen(false);
            setDeletingItem(null);
          }}
        />
      </div>
    </AppLayout>
  );
}

export function ResourcePage<T extends { _id?: string; id?: string }>(
  props: ResourcePageProps<T>
) {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="space-y-4 py-4">
            <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-11 w-full animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-64 w-full animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          </div>
        </AppLayout>
      }
    >
      <ResourcePageInner {...props} />
    </Suspense>
  );
}

export default ResourcePage;
