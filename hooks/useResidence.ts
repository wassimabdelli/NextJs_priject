"use client";

import { useState, useEffect, useCallback } from "react";

export interface ResidenceOption {
  _id: string;
  name: string;
  city: string;
  address?: string;
  totalApartments?: number;
}

const STORAGE_KEY = "syndicpro_selected_residence";

/**
 * Hook qui charge les résidences de l'utilisateur connecté
 * et gère la résidence actuellement sélectionnée (persiste dans localStorage).
 */
export function useResidence() {
  const [residences, setResidences] = useState<ResidenceOption[]>([]);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchResidences = async () => {
      try {
        const res = await fetch("/api/residences/mine");
        if (!res.ok) return;
        const data = await res.json();
        const list: ResidenceOption[] = data?.data || [];

        if (!mounted) return;
        setResidences(list);

        // Restaure la sélection enregistrée, ou prend la première par défaut
        const saved = localStorage.getItem(STORAGE_KEY);
        const validSaved = saved && list.some((r) => r._id === saved);
        const initialId = validSaved ? saved : list[0]?._id ?? null;
        setSelectedIdState(initialId);
        if (initialId) localStorage.setItem(STORAGE_KEY, initialId);
      } catch {
        // ignore – pas bloquant
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchResidences();
    return () => {
      mounted = false;
    };
  }, []);

  const setSelectedId = useCallback((id: string) => {
    setSelectedIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const selected = residences.find((r) => r._id === selectedId) ?? null;

  return { residences, selectedId, selected, setSelectedId, loading };
}

