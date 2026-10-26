"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import type { ResourceConfig } from "@/lib/resources/types";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface UseResourceReturn<T> {
  items: T[];
  meta: PaginationMeta;
  loading: boolean;
  error: string | null;
  page: number;
  search: string;
  filters: Record<string, any>;
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
  setFilters: (filters: Record<string, any>) => void;
  refresh: () => Promise<void>;
  getOne: (id: string) => Promise<T>;
  create: (data: Partial<T>) => Promise<T>;
  update: (id: string, data: Partial<T>) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

export function useResource<T extends { _id?: string; id?: string }>(
  config: ResourceConfig<T>
): UseResourceReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, any>>({});

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchList = useCallback(
    async (currentPage = page, currentSearch = search, currentFilters = filters) => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("page", currentPage.toString());
        params.set("limit", "20");

        if (currentSearch.trim()) {
          params.set("q", currentSearch.trim());
        }

        if (config.defaultSort) {
          params.set("sort", config.defaultSort);
        }

        Object.entries(currentFilters).forEach(([key, val]) => {
          if (val !== undefined && val !== null && val !== "") {
            params.set(key, String(val));
          }
        });

        const url = `${config.apiPath}?${params.toString()}`;

        const res = await fetchWithOffline<any>(url, {
          entity: config.entityOfflineKey,
        });

        if (!mountedRef.current) return;

        // Détection format API standard { data, meta } ou fallback Dexie (tableau direct)
        if (res && Array.isArray(res.data)) {
          setItems(res.data);
          setMeta(res.meta || { page: currentPage, limit: 20, total: res.data.length });
        } else if (Array.isArray(res)) {
          setItems(res);
          setMeta({ page: currentPage, limit: 20, total: res.length });
        } else {
          setItems([]);
          setMeta({ page: currentPage, limit: 20, total: 0 });
        }
      } catch (err: any) {
        if (!mountedRef.current) return;
        setError(err.message || "Erreur de chargement des données");
        setItems([]);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [config.apiPath, config.entityOfflineKey, config.defaultSort, page, search, filters]
  );

  useEffect(() => {
    fetchList(page, search, filters);
  }, [fetchList, page, search, filters]);

  const refresh = useCallback(async () => {
    await fetchList(page, search, filters);
  }, [fetchList, page, search, filters]);

  const getOne = useCallback(
    async (id: string): Promise<T> => {
      return await fetchWithOffline<T>(`${config.apiPath}/${id}`);
    },
    [config.apiPath]
  );

  const create = useCallback(
    async (data: Partial<T>): Promise<T> => {
      const res = await fetchWithOffline<T>(config.apiPath, {
        method: "POST",
        body: JSON.stringify(data),
        entity: config.entityOfflineKey,
      });
      await refresh();
      return res;
    },
    [config.apiPath, config.entityOfflineKey, refresh]
  );

  const update = useCallback(
    async (id: string, data: Partial<T>): Promise<T> => {
      const res = await fetchWithOffline<T>(`${config.apiPath}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        entity: config.entityOfflineKey,
      });
      await refresh();
      return res;
    },
    [config.apiPath, config.entityOfflineKey, refresh]
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await fetchWithOffline<{ success: boolean }>(`${config.apiPath}/${id}`, {
        method: "DELETE",
      });
      await refresh();
    },
    [config.apiPath, refresh]
  );

  const handleSetSearch = useCallback((newSearch: string) => {
    setSearch(newSearch);
    setPage(1);
  }, []);

  const handleSetFilters = useCallback((newFilters: Record<string, any>) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  return {
    items,
    meta,
    loading,
    error,
    page,
    search,
    filters,
    setPage,
    setSearch: handleSetSearch,
    setFilters: handleSetFilters,
    refresh,
    getOne,
    create,
    update,
    remove,
  };
}
