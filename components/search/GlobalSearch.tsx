"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  AlertTriangle,
  Megaphone,
  Receipt,
  Building2,
  Users,
  FileText,
  Calendar,
  Clock,
  WifiOff,
  Trash2,
} from "lucide-react";
import { getOfflineDB } from "@/lib/offline/db";

// Types de résultats renvoyés par l'API ou le cache local
export type SearchEntityType =
  | "incident"
  | "announcement"
  | "charge"
  | "apartment"
  | "resident"
  | "document"
  | "meeting";

export interface SearchResult {
  type: SearchEntityType;
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  href: string;
}

const RECENT_STORAGE_KEY = "syndicpro:recent-searches";

// Configuration d'affichage par type d'entité
const GROUP_CONFIG: Record<
  SearchEntityType,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  incident: { label: "Incidents", Icon: AlertTriangle },
  announcement: { label: "Annonces", Icon: Megaphone },
  charge: { label: "Charges", Icon: Receipt },
  apartment: { label: "Appartements", Icon: Building2 },
  resident: { label: "Résidents", Icon: Users },
  document: { label: "Documents", Icon: FileText },
  meeting: { label: "Réunions", Icon: Calendar },
};

const GROUP_ORDER: SearchEntityType[] = [
  "incident",
  "announcement",
  "charge",
  "apartment",
  "resident",
  "document",
  "meeting",
];

// Lecture sécurisée des recherches récentes depuis localStorage
function loadRecentSearches(): string[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string").slice(0, 5);
    }
    return [];
  } catch {
    return [];
  }
}

// Sauvegarde sécurisée dans localStorage (5 max)
function saveRecentSearch(term: string): string[] {
  const cleaned = term.trim();
  if (cleaned.length < 2) return loadRecentSearches();
  try {
    const current = loadRecentSearches();
    const updated = [cleaned, ...current.filter((q) => q.toLowerCase() !== cleaned.toLowerCase())].slice(0, 5);
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

// Recherche locale dans IndexedDB via Dexie en mode hors ligne
async function searchOfflineDexie(q: string): Promise<SearchResult[]> {
  const needle = q.toLowerCase();
  const db = getOfflineDB();
  const results: SearchResult[] = [];

  try {
    const [incidents, announcements, charges, documents] = await Promise.all([
      db.incidents
        .filter(
          (i) =>
            Boolean(i.title?.toLowerCase().includes(needle)) ||
            Boolean(i.description?.toLowerCase().includes(needle))
        )
        .limit(5)
        .toArray()
        .catch(() => []),
      db.announcements
        .filter(
          (a) =>
            Boolean(a.title?.toLowerCase().includes(needle)) ||
            Boolean(a.content?.toLowerCase().includes(needle))
        )
        .limit(5)
        .toArray()
        .catch(() => []),
      db.charges
        .filter((c) => Boolean(c.period?.toLowerCase().includes(needle)))
        .limit(5)
        .toArray()
        .catch(() => []),
      db.documents
        .filter((d) => Boolean(d.title?.toLowerCase().includes(needle)))
        .limit(5)
        .toArray()
        .catch(() => []),
    ]);

    for (const inc of incidents) {
      const title = inc.title || "";
      results.push({
        type: "incident",
        id: String(inc._id),
        title,
        subtitle: inc.description ? inc.description.slice(0, 80) : undefined,
        badge: inc.status,
        href: `/incidents?q=${encodeURIComponent(title)}`,
      });
    }

    for (const ann of announcements) {
      const title = ann.title || "";
      results.push({
        type: "announcement",
        id: String(ann._id),
        title,
        subtitle: ann.content ? ann.content.slice(0, 80) : undefined,
        href: `/announcements?q=${encodeURIComponent(title)}`,
      });
    }

    for (const ch of charges) {
      const period = ch.period || "";
      results.push({
        type: "charge",
        id: String(ch._id),
        title: `Charge ${period}`,
        badge: ch.status,
        href: `/charges?q=${encodeURIComponent(period)}`,
      });
    }

    for (const doc of documents) {
      const title = doc.title || "";
      results.push({
        type: "document",
        id: String(doc._id),
        title,
        badge: doc.type,
        href: `/documents?q=${encodeURIComponent(title)}`,
      });
    }
  } catch {
    // Retourne les résultats partiels en cas d'erreur Dexie
  }

  return results;
}

export function GlobalSearch({ variant }: { variant: "icon" | "field" }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineResult, setIsOfflineResult] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());

  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Nettoyage des timers et requêtes en cours
  const cleanupPendingSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Ouverture de la modale de recherche
  const openModal = useCallback(() => {
    setRecentSearches(loadRecentSearches());
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  }, []);

  // Fermeture et réinitialisation de la modale
  const closeModal = useCallback(() => {
    cleanupPendingSearch();
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setIsLoading(false);
    setError(null);
    setIsOfflineResult(false);
    setSelectedIndex(-1);
  }, [cleanupPendingSearch]);

  // Exécution effective de la recherche (API ou repli Dexie hors ligne)
  const executeSearch = useCallback(async (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      setIsOfflineResult(false);
      setSelectedIndex(-1);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Mode hors ligne direct
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      try {
        const localData = await searchOfflineDexie(trimmed);
        if (!controller.signal.aborted) {
          setResults(localData);
          setIsOfflineResult(true);
          setError(null);
          setIsLoading(false);
          setSelectedIndex(localData.length > 0 ? 0 : -1);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Impossible de charger les résultats hors ligne.");
          setIsLoading(false);
        }
      }
      return;
    }

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Erreur réseau");
      }

      const payload = (await response.json()) as { data?: SearchResult[] };
      if (!controller.signal.aborted) {
        const list = Array.isArray(payload.data) ? payload.data : [];
        setResults(list);
        setIsOfflineResult(false);
        setError(null);
        setIsLoading(false);
        setSelectedIndex(list.length > 0 ? 0 : -1);
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        return;
      }
      // En cas d'échec de fetch, tentative sur la base locale Dexie
      try {
        const localData = await searchOfflineDexie(trimmed);
        if (!controller.signal.aborted) {
          setResults(localData);
          setIsOfflineResult(true);
          setError(null);
          setIsLoading(false);
          setSelectedIndex(localData.length > 0 ? 0 : -1);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Une erreur réseau est survenue lors de la recherche.");
          setResults([]);
          setIsLoading(false);
        }
      }
    }
  }, []);

  // Déclenchement de la recherche depuis onChange avec debounce de 300 ms
  const handleInputChange = (value: string) => {
    setQuery(value);
    cleanupPendingSearch();

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      setIsOfflineResult(false);
      setSelectedIndex(-1);
      return;
    }

    setIsLoading(true);
    setError(null);

    debounceTimerRef.current = setTimeout(() => {
      void executeSearch(trimmed);
    }, 300);
  };

  // Sélection d'un résultat et navigation
  const handleSelectResult = useCallback(
    (item: SearchResult) => {
      const updated = saveRecentSearch(query.trim() || item.title);
      setRecentSearches(updated);
      closeModal();
      router.push(item.href);
    },
    [query, closeModal, router]
  );

  // Liste ordonnée à plat pour la navigation clavier
  const orderedResults: SearchResult[] = [];
  for (const type of GROUP_ORDER) {
    for (const r of results) {
      if (r.type === type) {
        orderedResults.push(r);
      }
    }
  }

  // Raccourcis clavier globaux (Ctrl+K / Cmd+K et Échap)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          closeModal();
        } else {
          openModal();
        }
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        closeModal();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [isOpen, openModal, closeModal]);

  // Nettoyage au démontage du composant
  useEffect(() => {
    return () => {
      cleanupPendingSearch();
    };
  }, [cleanupPendingSearch]);

  // Navigation clavier dans le champ de recherche (Flèches Haut/Bas et Entrée)
  const handleKeyDownInModal = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (orderedResults.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % orderedResults.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (orderedResults.length > 0) {
        setSelectedIndex((prev) => (prev <= 0 ? orderedResults.length - 1 : prev - 1));
      }
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && selectedIndex < orderedResults.length) {
        e.preventDefault();
        handleSelectResult(orderedResults[selectedIndex]);
      }
    }
  };

  // Effacer l'historique des recherches récentes
  const handleClearRecent = () => {
    try {
      window.localStorage.removeItem(RECENT_STORAGE_KEY);
    } catch {
      // Ignore les erreurs d'accès au stockage
    }
    setRecentSearches([]);
  };

  const trimmedQuery = query.trim();

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={openModal}
          aria-label="Rechercher"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <Search className="h-5 w-5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="flex min-h-[44px] w-full max-w-xs items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-500 transition-colors hover:border-sky-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400 dark:hover:border-sky-700 dark:hover:bg-slate-800"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
            <span>Rechercher…</span>
          </span>
          <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-medium text-slate-500 sm:inline-block dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
            Ctrl K
          </kbd>
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-white pt-[env(safe-area-inset-top)] md:items-center md:justify-start md:bg-slate-900/50 md:pt-20 md:backdrop-blur-xs dark:bg-slate-900 dark:md:bg-slate-950/70"
          onClick={closeModal}
        >
          <div
            className="flex h-full w-full flex-col overflow-hidden bg-white md:h-auto md:max-h-[80vh] md:max-w-2xl md:rounded-2xl md:border md:border-slate-200 md:shadow-2xl dark:bg-slate-900 dark:md:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barre de saisie supérieure */}
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
              <Search className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />
              <input
                ref={inputRef}
                type="search"
                autoFocus
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDownInModal}
                placeholder="Rechercher un incident, résident, document…"
                className="min-h-[44px] flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              {query.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    handleInputChange("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Effacer la saisie"
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={closeModal}
                aria-label="Fermer la recherche"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Fermer
              </button>
            </div>

            {/* Bandeau hors ligne */}
            {isOfflineResult && (
              <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                <WifiOff className="h-4 w-4 shrink-0" />
                <span>Résultats locaux (hors ligne)</span>
              </div>
            )}

            {/* Corps des résultats */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Champ vide : affichage des recherches récentes */}
              {trimmedQuery.length === 0 && (
                <div>
                  {recentSearches.length > 0 ? (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                          Recherches récentes
                        </span>
                        <button
                          type="button"
                          onClick={handleClearRecent}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Effacer</span>
                        </button>
                      </div>
                      <ul className="space-y-1">
                        {recentSearches.map((term) => (
                          <li key={term}>
                            <button
                              type="button"
                              onClick={() => handleInputChange(term)}
                              className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                              <span className="truncate">{term}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      Saisissez au moins 2 caractères pour lancer la recherche.
                    </p>
                  )}
                </div>
              )}

              {/* Moins de 2 caractères */}
              {trimmedQuery.length === 1 && (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Saisissez au moins 2 caractères pour rechercher.
                </p>
              )}

              {/* État de chargement (skeleton) */}
              {trimmedQuery.length >= 2 && isLoading && (
                <div className="space-y-3" aria-busy="true" aria-label="Chargement des résultats">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="flex min-h-[52px] animate-pulse items-center gap-3 rounded-xl bg-slate-100 p-3 dark:bg-slate-800/60"
                    >
                      <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-700" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
                        <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* État d'erreur réseau */}
              {trimmedQuery.length >= 2 && !isLoading && error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                  {error}
                </div>
              )}

              {/* Aucun résultat */}
              {trimmedQuery.length >= 2 &&
                !isLoading &&
                !error &&
                orderedResults.length === 0 && (
                  <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    Aucun résultat pour « {trimmedQuery} »
                  </p>
                )}

              {/* Liste des résultats groupés par type */}
              {trimmedQuery.length >= 2 && !isLoading && !error && orderedResults.length > 0 && (
                <div className="space-y-5">
                  {GROUP_ORDER.map((groupType) => {
                    const groupItems = results.filter((r) => r.type === groupType);
                    if (groupItems.length === 0) return null;

                    const { label, Icon } = GROUP_CONFIG[groupType];

                    return (
                      <div key={groupType}>
                        <div className="mb-1.5 px-2 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                          {label}
                        </div>
                        <ul className="space-y-1">
                          {groupItems.map((item) => {
                            const flatIdx = orderedResults.findIndex(
                              (r) => r.type === item.type && r.id === item.id
                            );
                            const isSelected = flatIdx === selectedIndex;

                            return (
                              <li key={`${item.type}-${item.id}`}>
                                <button
                                  type="button"
                                  onClick={() => handleSelectResult(item)}
                                  onMouseEnter={() => setSelectedIndex(flatIdx)}
                                  className={`flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                                    isSelected
                                      ? "bg-sky-50 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100"
                                      : "text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/70"
                                  }`}
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    <span
                                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                        isSelected
                                          ? "bg-sky-100 text-sky-600 dark:bg-sky-900/70 dark:text-sky-300"
                                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                      }`}
                                    >
                                      <Icon className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium">{item.title}</p>
                                      {item.subtitle && (
                                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                          {item.subtitle}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {item.badge && (
                                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                      {item.badge}
                                    </span>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
