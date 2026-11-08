"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";

interface ActivityItem {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  href: string;
}

function isActivityItem(value: unknown): value is ActivityItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string"
    && typeof item.title === "string"
    && typeof item.message === "string"
    && typeof item.createdAt === "string"
    && typeof item.href === "string";
}

export function RecentActivityWidget() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/activity?limit=5", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result: unknown = await response.json();
        if (!response.ok) {
          const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
            ? result.error
            : "L'activité récente n'est pas disponible.";
          throw new Error(message);
        }
        if (!result || typeof result !== "object" || !Array.isArray((result as { data?: unknown }).data)) {
          throw new Error("La réponse du centre d'activité est invalide.");
        }
        const records = (result as { data: unknown[] }).data;
        if (!records.every(isActivityItem)) throw new Error("Les éléments d'activité reçus sont invalides.");
        setItems(records);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Impossible de charger l'activité récente.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          <CardTitle>Activité récente</CardTitle>
        </div>
        <Link href="/activity" className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300">
          Tout voir <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {loading ? (
        <p className="text-sm text-slate-500">Chargement de l&apos;activité…</p>
      ) : error ? (
        <p role="status" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
      ) : items.length === 0 ? (
        <p className="py-3 text-sm text-slate-500">Aucune activité récente.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((item) => (
            <li key={item.id} className="py-3 first:pt-0 last:pb-0">
              <Link href={item.href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.message}</p>
                  <time className="text-[11px] text-slate-400" dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleDateString("fr-FR")}
                  </time>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
