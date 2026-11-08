"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  ArrowDownCircle,
  ArrowUpCircle,
  SlidersHorizontal,
  MapPin,
  Building2,
  Layers,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { Role } from "@/types/enums";

/* ============================================================ */
/* TYPES LOCAUX                                                 */
/* ============================================================ */
interface ResidenceItem {
  _id: string;
  name: string;
  city?: string;
}

interface StockItemView {
  _id: string;
  residence?: ResidenceItem | string;
  name: string;
  category?: string;
  quantity: number;
  minThreshold?: number;
  minQuantity?: number;
  unit?: string;
  location?: string;
  notes?: string;
}

interface SessionUser {
  id: string;
  role: Role;
  name?: string;
}

type MovementType = "IN" | "OUT" | "ADJUST";

/* ============================================================ */
/* CONSTANTES D'AFFICHAGE                                       */
/* ============================================================ */
const STOCK_CATEGORIES = [
  { value: "ELECTRICAL", label: "Électricité & Éclairage" },
  { value: "PLUMBING", label: "Plomberie & Sanitaire" },
  { value: "CLEANING", label: "Entretien & Nettoyage" },
  { value: "HARDWARE", label: "Quincaillerie & Outillage" },
  { value: "SECURITY", label: "Sécurité & Accès" },
  { value: "GARDEN", label: "Espaces verts" },
  { value: "OTHER", label: "Autre" },
];

const STOCK_UNITS = [
  { value: "PIECE", label: "Pièce / Unité (PIECE)" },
  { value: "LITER", label: "Litre (LITER)" },
  { value: "KG", label: "Kilogramme (KG)" },
  { value: "BOX", label: "Boîte / Carton (BOX)" },
  { value: "METER", label: "Mètre (METER)" },
  { value: "ROLL", label: "Rouleau (ROLL)" },
];

const categoryLabel = (val?: string) =>
  STOCK_CATEGORIES.find((c) => c.value === val)?.label || val || "Général";

const unitLabel = (val?: string) => {
  const map: Record<string, string> = {
    PIECE: "pièce(s)",
    LITER: "L",
    KG: "kg",
    BOX: "boîte(s)",
    METER: "m",
    ROLL: "rouleau(x)",
  };
  return (val && map[val]) || val || "unité(s)";
};

/* ============================================================ */
/* CONTENU PRINCIPAL DE LA PAGE STOCK                           */
/* ============================================================ */
function StockInner() {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [items, setItems] = useState<StockItemView[]>([]);
  const [residences, setResidences] = useState<ResidenceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtres et recherche
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // BottomSheet 1 : Nouvel article en stock
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createResidence, setCreateResidence] = useState("");
  const [createName, setCreateName] = useState("");
  const [createCategory, setCreateCategory] = useState("ELECTRICAL");
  const [createUnit, setCreateUnit] = useState("PIECE");
  const [createQuantity, setCreateQuantity] = useState("0");
  const [createMinThreshold, setCreateMinThreshold] = useState("5");
  const [createLocation, setCreateLocation] = useState("");

  // BottomSheet 2 : Mouvement de stock (Entrée / Sortie / Ajustement)
  const [selectedItem, setSelectedItem] = useState<StockItemView | null>(null);
  const [movementType, setMovementType] = useState<MovementType>("IN");
  const [movementQuantity, setMovementQuantity] = useState("1");
  const [movementReference, setMovementReference] = useState("");
  const [movementNotes, setMovementNotes] = useState("");
  const [isSubmittingMovement, setIsSubmittingMovement] = useState(false);

  const isManager =
    !currentUser ||
    currentUser.role === Role.ADMIN ||
    currentUser.role === Role.SYNDIC;

  const showSuccess = (msg: string) => {
    setFeedbackMsg(msg);
    setErrorMsg(null);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  // Helpers d'extraction sécurisée des réponses API
  const extractList = <T,>(res: unknown): T[] => {
    const r = res as { data?: T[] | { data?: T[] } } | null | undefined;
    if (!r || !r.data) return [];
    if (Array.isArray(r.data)) return r.data;
    if (Array.isArray(r.data.data)) return r.data.data;
    return [];
  };

  const isResSuccess = (res: unknown): boolean => {
    const r = res as { ok?: boolean; queued?: boolean; error?: string } | null | undefined;
    return Boolean(r && (r.ok || r.queued || !r.error));
  };

  const getResError = (res: unknown, fallback: string): string => {
    const r = res as { error?: string } | null | undefined;
    return r?.error || fallback;
  };

  // Chargement initial des articles et résidences
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [itemsRes, resRes] = await Promise.all([
        fetchWithOffline("/api/stock/items?limit=100"),
        fetchWithOffline("/api/residences"),
      ]);

      const loadedItems = extractList<StockItemView>(itemsRes);
      const loadedResidences = extractList<ResidenceItem>(resRes);

      setItems(loadedItems);
      setResidences(loadedResidences);

      if (!createResidence && loadedResidences.length > 0) {
        setCreateResidence(loadedResidences[0]._id);
      }
    } catch (err: unknown) {
      showError(
        err instanceof Error
          ? err.message
          : "Impossible de charger l'inventaire de stock."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/auth/session");
        const session = await res.json();
        if (session?.user) {
          setCurrentUser(session.user as SessionUser);
        }
      } catch {
        // Session hors ligne
      }
      await loadData();
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getThreshold = (item: StockItemView): number =>
    item.minThreshold ?? item.minQuantity ?? 0;

  // Indicateurs de synthèse en haut de page
  const stats = useMemo(() => {
    const total = items.length;
    const lowStockCount = items.filter(
      (item) => item.quantity <= getThreshold(item)
    ).length;
    return { total, lowStockCount };
  }, [items]);

  // Liste filtrée des articles
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) {
        return false;
      }
      if (onlyLowStock && item.quantity > getThreshold(item)) {
        return false;
      }
      if (q) {
        const inName = item.name?.toLowerCase().includes(q);
        const inLoc = item.location?.toLowerCase().includes(q);
        const resName =
          typeof item.residence === "object" && item.residence !== null
            ? item.residence.name.toLowerCase()
            : "";
        if (!inName && !inLoc && !resName.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, categoryFilter, onlyLowStock]);

  // Création d'un nouvel article en stock
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createResidence || !createName.trim()) {
      showError("Veuillez renseigner la résidence et le nom de l'article.");
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const qty = Math.max(0, Number(createQuantity) || 0);
      const minThresh = Math.max(0, Number(createMinThreshold) || 0);

      const payload = {
        residence: createResidence,
        name: createName.trim(),
        category: createCategory,
        unit: createUnit,
        quantity: qty,
        minThreshold: minThresh,
        location: createLocation.trim() || undefined,
      };

      const res = await fetchWithOffline("/api/stock/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (isResSuccess(res)) {
        setIsCreateOpen(false);
        setCreateName("");
        setCreateQuantity("0");
        setCreateMinThreshold("5");
        setCreateLocation("");
        showSuccess("Nouvel article ajouté au stock.");
        await loadData();
      } else {
        showError(getResError(res, "Erreur lors de la création de l'article."));
      }
    } catch (err: unknown) {
      showError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la création de l'article."
      );
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Ouverture du BottomSheet de mouvement de stock
  const openMovementSheet = (item: StockItemView, type: MovementType) => {
    setSelectedItem(item);
    setMovementType(type);
    setMovementQuantity(type === "ADJUST" ? String(item.quantity) : "1");
    setMovementReference("");
    setMovementNotes("");
  };

  // Enregistrement d'un mouvement de stock
  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const qty = Number(movementQuantity);
    if (Number.isNaN(qty) || (movementType !== "ADJUST" && qty <= 0) || qty < 0) {
      showError("Veuillez saisir une quantité valide.");
      return;
    }

    if (movementType === "OUT" && qty > selectedItem.quantity) {
      showError(
        `Stock insuffisant : quantité demandée (${qty}) supérieure au disponible (${selectedItem.quantity}).`
      );
      return;
    }

    setIsSubmittingMovement(true);
    try {
      const payload = {
        item: selectedItem._id,
        type: movementType,
        quantity: qty,
        reference: movementReference.trim() || undefined,
        notes: movementNotes.trim() || undefined,
      };

      const res = await fetchWithOffline("/api/stock/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (isResSuccess(res)) {
        setSelectedItem(null);
        showSuccess(
          movementType === "IN"
            ? "Entrée en stock enregistrée."
            : movementType === "OUT"
            ? "Sortie de stock enregistrée."
            : "Ajustement d'inventaire enregistré."
        );
        await loadData();
      } else {
        showError(
          getResError(res, "Erreur lors de l'enregistrement du mouvement.")
        );
      }
    } catch (err: unknown) {
      showError(
        err instanceof Error
          ? err.message
          : "Erreur lors de l'enregistrement du mouvement."
      );
    } finally {
      setIsSubmittingMovement(false);
    }
  };

  return (
    <>
      <div className="space-y-5">
        {/* En-tête */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              Stock & Consommables
            </h1>
            <p className="text-xs text-slate-500 sm:text-sm dark:text-slate-400">
              Inventaire des fournitures de copropriété, mouvements et alertes de réapprovisionnement
            </p>
          </div>
          {isManager && (
            <Button
              variant="primary"
              onClick={() => setIsCreateOpen(true)}
              className="min-h-[44px] gap-2 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              Nouvel article en stock
            </Button>
          )}
        </div>

        {/* Notifications */}
        {feedbackMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* A) Indicateurs de synthèse en haut */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total articles référencés
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {stats.total}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Package className="h-6 w-6" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOnlyLowStock((prev) => !prev)}
            className={`flex min-h-[44px] items-center justify-between rounded-2xl border p-4 text-left shadow-sm transition-all ${
              stats.lowStockCount > 0
                ? "border-rose-300 bg-rose-50/70 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30"
                : "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20"
            }`}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                Articles en stock bas {onlyLowStock ? "(Filtre actif)" : ""}
              </p>
              <p className="mt-1 text-2xl font-bold text-rose-800 dark:text-rose-200">
                {stats.lowStockCount}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </button>
        </div>

        {/* Barre de recherche et filtres */}
        <Card className="p-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un article, un emplacement ou une résidence..."
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[
                { value: "ALL", label: "Toutes les catégories" },
                ...STOCK_CATEGORIES,
              ]}
            />
          </div>
        </Card>

        {/* B) Grille des articles en stock */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Skeleton key={n} className="h-52 w-full rounded-2xl" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            title="Aucun article en stock"
            description="Aucun consommable ou équipement de réserve ne correspond à votre recherche."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => {
              const threshold = getThreshold(item);
              const isLow = item.quantity <= threshold;
              const resObj =
                typeof item.residence === "object" && item.residence !== null
                  ? item.residence
                  : null;

              return (
                <Card
                  key={item._id}
                  className={`flex flex-col justify-between p-4 ${
                    isLow
                      ? "border-l-4 border-l-rose-500"
                      : "border-l-4 border-l-emerald-500"
                  }`}
                >
                  <div className="space-y-3">
                    {/* En-tête de l'article */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {item.name}
                        </h3>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <Layers className="h-3.5 w-3.5 text-sky-500" />
                          <span>{categoryLabel(item.category)}</span>
                        </p>
                      </div>

                      {isLow ? (
                        <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                          <AlertTriangle className="h-3 w-3" />
                          Stock bas
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          En stock
                        </span>
                      )}
                    </div>

                    {/* Quantité et seuil */}
                    <div className="flex items-baseline justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <div>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Quantité disponible
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          <span
                            className={`text-2xl font-extrabold ${
                              isLow
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-slate-900 dark:text-white"
                            }`}
                          >
                            {item.quantity}
                          </span>
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {unitLabel(item.unit)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Seuil minimal
                        </span>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          {threshold} {unitLabel(item.unit)}
                        </p>
                      </div>
                    </div>

                    {/* Infos emplacement et résidence */}
                    <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      {item.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span>Emplacement : {item.location}</span>
                        </div>
                      )}
                      {resObj && (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <span>{resObj.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Boutons d'action rapide : Entrée (+) et Sortie (-) */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openMovementSheet(item, "IN")}
                      className="min-h-[44px] flex-1 gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                    >
                      <ArrowUpCircle className="h-4 w-4" />
                      Entrée (+)
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={item.quantity <= 0}
                      onClick={() => openMovementSheet(item, "OUT")}
                      className="min-h-[44px] flex-1 gap-1.5 text-xs text-rose-600 hover:text-rose-700 disabled:opacity-40 dark:text-rose-400"
                    >
                      <ArrowDownCircle className="h-4 w-4" />
                      Sortie (-)
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openMovementSheet(item, "ADJUST")}
                      className="min-h-[44px] px-2.5 text-xs"
                      title="Ajuster l'inventaire"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* C) BottomSheet 1 — Nouvel article en stock */}
        <BottomSheet
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Nouvel article en stock"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <Select
              label="Résidence *"
              required
              value={createResidence}
              onChange={(e) => setCreateResidence(e.target.value)}
              options={[
                { value: "", label: "Sélectionner une résidence..." },
                ...residences.map((r) => ({ value: r._id, label: r.name })),
              ]}
            />

            <Input
              label="Nom de l'article *"
              required
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Ex : Ampoule LED E27 12W, Fusible 16A..."
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Catégorie *"
                required
                value={createCategory}
                onChange={(e) => setCreateCategory(e.target.value)}
                options={STOCK_CATEGORIES}
              />

              <Select
                label="Unité *"
                required
                value={createUnit}
                onChange={(e) => setCreateUnit(e.target.value)}
                options={STOCK_UNITS}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Quantité initiale *"
                type="number"
                min="0"
                required
                value={createQuantity}
                onChange={(e) => setCreateQuantity(e.target.value)}
              />

              <Input
                label="Seuil minimal d'alerte *"
                type="number"
                min="0"
                required
                value={createMinThreshold}
                onChange={(e) => setCreateMinThreshold(e.target.value)}
              />
            </div>

            <Input
              label="Emplacement dans la résidence"
              value={createLocation}
              onChange={(e) => setCreateLocation(e.target.value)}
              placeholder="Ex : Local technique sous-sol, Armoire B"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="min-h-[44px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmittingCreate}
                className="min-h-[44px]"
              >
                Ajouter l&apos;article
              </Button>
            </div>
          </form>
        </BottomSheet>

        {/* D) BottomSheet 2 — Mouvement de stock (Entrée / Sortie) */}
        <BottomSheet
          isOpen={Boolean(selectedItem)}
          onClose={() => setSelectedItem(null)}
          title="Mouvement de stock (Entrée / Sortie)"
        >
          {selectedItem && (
            <form onSubmit={handleMovementSubmit} className="space-y-4">
              {/* Rappel de l'article sélectionné */}
              <div className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
                <p className="font-bold text-slate-900 dark:text-white">
                  {selectedItem.name}
                </p>
                <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                  Stock actuel :{" "}
                  <strong>
                    {selectedItem.quantity} {unitLabel(selectedItem.unit)}
                  </strong>{" "}
                  (seuil d&apos;alerte : {getThreshold(selectedItem)})
                </p>
              </div>

              <Select
                label="Type de mouvement *"
                required
                value={movementType}
                onChange={(e) => setMovementType(e.target.value as MovementType)}
                options={[
                  { value: "IN", label: "Entrée en stock (+)" },
                  { value: "OUT", label: "Sortie / Consommation (-)" },
                  { value: "ADJUST", label: "Ajustement d'inventaire (=)" },
                ]}
              />

              <Input
                label={
                  movementType === "ADJUST"
                    ? "Nouvelle quantité réelle *"
                    : "Quantité du mouvement *"
                }
                type="number"
                min={movementType === "ADJUST" ? "0" : "1"}
                max={
                  movementType === "OUT"
                    ? String(selectedItem.quantity)
                    : undefined
                }
                required
                value={movementQuantity}
                onChange={(e) => setMovementQuantity(e.target.value)}
              />

              <Input
                label="Référence / Motif"
                value={movementReference}
                onChange={(e) => setMovementReference(e.target.value)}
                placeholder="Ex : Remplacement hall A, Facture fournisseur n°104..."
              />

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Notes complémentaires
                </label>
                <textarea
                  rows={2}
                  value={movementNotes}
                  onChange={(e) => setMovementNotes(e.target.value)}
                  placeholder="Observations éventuelles..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-base text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedItem(null)}
                  className="min-h-[44px]"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmittingMovement}
                  className="min-h-[44px]"
                >
                  Enregistrer le mouvement
                </Button>
              </div>
            </form>
          )}
        </BottomSheet>
      </div>
    </>
  );
}

export function StockContent() {
  return (
    <Suspense
      fallback={
        <>
          <div className="space-y-4">
            <Skeleton className="h-10 w-64 rounded-xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </>
      }
    >
      <StockInner />
    </Suspense>
  );
}
