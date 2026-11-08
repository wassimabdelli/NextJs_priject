"use client";

import React from "react";
import {
  LayoutDashboard,
  Receipt,
  AlertTriangle,
  Megaphone,
  MoreHorizontal,
} from "lucide-react";
import { canAccessTab } from "@/lib/permissions";
import { useRedesign } from "@/lib/redesign/store";

interface MobileBottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  openIncidentsCount?: number;
}

const ITEMS = [
  { id: "dashboard", label: "Accueil", icon: LayoutDashboard },
  { id: "charges", label: "Charges", icon: Receipt },
  { id: "incidents", label: "Incidents", icon: AlertTriangle },
  { id: "announcements", label: "Annonces", icon: Megaphone },
  { id: "more", label: "Plus", icon: MoreHorizontal },
] as const;

/** Barre mobile (équivalent bottom nav Wassim) — design glass SyndicPro. */
export function MobileBottomNav({
  currentTab,
  setCurrentTab,
  openIncidentsCount = 0,
}: MobileBottomNavProps) {
  const { apiRole } = useRedesign();
  const items = ITEMS.filter((item) => !apiRole || canAccessTab(apiRole, item.id));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200/80 bg-white/95 backdrop-blur-lg md:hidden dark:border-white/[0.08] dark:bg-[#0b1220]/95"
      style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom, 0.4rem))" }}
      aria-label="Navigation principale"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        const badge =
          item.id === "incidents" && openIncidentsCount > 0
            ? openIncidentsCount
            : undefined;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setCurrentTab(item.id)}
            className={`relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-bold transition-colors ${
              isActive
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
            {badge !== undefined && (
              <span className="absolute right-[18%] top-1 rounded-full bg-amber-500 px-1.5 text-[9px] font-bold text-white">
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
