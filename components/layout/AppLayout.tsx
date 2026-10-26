"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  AlertTriangle,
  Megaphone,
  MoreHorizontal,
  Building2,
  WifiOff,
} from "lucide-react";
import clsx from "clsx";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { UserMenu } from "@/components/layout/UserMenu";
import { isRouteAllowed } from "@/lib/permissions";
import { Role } from "@/types/enums";
import { getOfflineSession, saveOfflineSession } from "@/lib/offline/db";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { label: "Accueil", href: "/dashboard", icon: LayoutDashboard },
  { label: "Charges", href: "/charges", icon: Receipt },
  { label: "Incidents", href: "/incidents", icon: AlertTriangle },
  { label: "Annonces", href: "/announcements", icon: Megaphone },
  { label: "Plus", href: "/more", icon: MoreHorizontal },
];

export interface AppLayoutProps {
  children: React.ReactNode;
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: Role;
  };
}

export function AppLayout({ children, user: serverUser }: AppLayoutProps) {
  const pathname = usePathname();
  const { isOnline, pendingCount } = useOnlineStatus();
  const [mounted, setMounted] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState(serverUser);

  React.useEffect(() => {
    setMounted(true);
    if (!serverUser) {
      // Tente d'abord de récupérer la session courante via l'API Auth.js
      fetch("/api/auth/session")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.user?.id) {
            const u = {
              id: data.user.id,
              name: data.user.name,
              email: data.user.email,
              role: data.user.role as Role,
            };
            setCurrentUser(u);
            saveOfflineSession({
              id: u.id,
              name: u.name || "Utilisateur",
              email: u.email || "",
              role: u.role || Role.RESIDENT,
              expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
            }).catch(() => {});
          } else {
            // Repli sur la session en cache local Dexie (mode hors ligne)
            getOfflineSession().then((offline) => {
              if (offline) {
                setCurrentUser({
                  id: offline.id,
                  name: offline.name,
                  email: offline.email,
                  role: offline.role,
                });
              }
            });
          }
        })
        .catch(() => {
          getOfflineSession().then((offline) => {
            if (offline) {
              setCurrentUser({
                id: offline.id,
                name: offline.name,
                email: offline.email,
                role: offline.role,
              });
            }
          });
        });
    } else {
      setCurrentUser(serverUser);
    }
  }, [serverUser]);

  const showOffline = mounted && !isOnline;
  const userRole = currentUser?.role || Role.RESIDENT;

  // Filtrage strict des éléments de navigation selon la matrice de permissions
  const visibleNavItems = ALL_NAV_ITEMS.filter((item) =>
    isRouteAllowed(item.href, userRole)
  );

  return (
    <div className="flex min-h-screen w-full bg-slate-50 dark:bg-slate-950">
      {/* ============================================================ */}
      {/* 1. SIDEBAR DESKTOP & TABLETTE (>= md)                        */}
      {/* ============================================================ */}
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col md:border-r md:border-slate-200 md:bg-white md:dark:border-slate-800 md:dark:bg-slate-900/80 md:backdrop-blur-md">
        {/* Logo SyndicPro */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6 dark:border-slate-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 text-white shadow-md shadow-sky-500/20">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Syndic<span className="text-sky-500">Pro</span>
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              PWA Copropriété
            </span>
          </div>
        </div>

        {/* Liens de navigation desktop filtrés par rôle */}
        <nav className="flex-1 space-y-1.5 px-4 py-6">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-semibold transition-all",
                  isActive
                    ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
                )}
              >
                <Icon className={clsx("h-5 w-5", isActive ? "text-white" : "text-slate-400")} />
                <span>{item.label}</span>
                {item.href === "/incidents" && pendingCount > 0 && (
                  <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Pied de sidebar : Profil utilisateur & Statut réseau */}
        <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
          <UserMenu initialUser={currentUser} />

          <div className="flex items-center gap-2.5 rounded-xl bg-slate-100 p-3 text-xs dark:bg-slate-800/60">
            <div
              className={clsx(
                "h-2.5 w-2.5 rounded-full",
                !showOffline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              )}
            />
            <div className="flex-1 overflow-hidden">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {!showOffline ? "Connecté au serveur" : "Mode Hors Ligne"}
              </p>
              <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                {pendingCount > 0
                  ? `${pendingCount} action(s) en attente`
                  : "Données synchronisées"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* 2. ZONE PRINCIPALE DE CONTENU                                */}
      {/* ============================================================ */}
      <div className="flex flex-1 flex-col md:pl-64">
        {/* Header mobile (< md) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md md:hidden dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-white shadow-sm">
              <Building2 className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Syndic<span className="text-sky-500">Pro</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {showOffline && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                <WifiOff className="h-3 w-3" />
                Hors ligne
              </span>
            )}
            {pendingCount > 0 && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
            <UserMenu initialUser={currentUser} compact />
          </div>
        </header>

        {/* Contenu de la page */}
        <main className="flex-1 px-4 py-5 pb-24 sm:px-6 md:px-8 md:py-8 md:pb-12">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {/* ============================================================ */}
      {/* 3. BARRE DE NAVIGATION EN BAS (Mobile < md)                  */}
      {/* ============================================================ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white/95 backdrop-blur-lg md:hidden dark:border-slate-800 dark:bg-slate-900/95"
        style={{
          paddingBottom: "max(0.4rem, env(safe-area-inset-bottom, 0.4rem))",
        }}
      >
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "relative flex min-h-[48px] min-w-[56px] flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-all active:scale-95",
                isActive
                  ? "text-sky-500 font-bold"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              <div className="relative">
                <Icon
                  className={clsx(
                    "h-5 w-5 transition-transform",
                    isActive ? "scale-110 stroke-[2.25]" : "stroke-[1.75]"
                  )}
                />
                {item.href === "/incidents" && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-2 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
                )}
              </div>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
