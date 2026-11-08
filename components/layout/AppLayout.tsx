"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  WifiOff,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import clsx from "clsx";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { UserMenu } from "@/components/layout/UserMenu";
import { isRouteAllowed } from "@/lib/permissions";
import { Role } from "@/types/enums";
import { getOfflineSession, saveOfflineSession } from "@/lib/offline/db";
import { AIChatWidget } from "@/components/ai/AIChatWidget";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { NAVIGATION_ITEMS } from "@/components/layout/navigation";

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
  const mounted = React.useSyncExternalStore(() => () => {}, () => true, () => false);
  const [currentUser, setCurrentUser] = React.useState(serverUser);
  const [clientAuthenticatedUserId, setClientAuthenticatedUserId] = React.useState<string>();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const authenticatedUserId = serverUser?.id ?? clientAuthenticatedUserId;
  const resolvedUser = serverUser ?? currentUser;

  React.useEffect(() => {
    if (serverUser?.id) {
      return;
    }
    // Tente d'abord de récupérer la session courante via l'API Auth.js
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.id) {
          setClientAuthenticatedUserId(data.user.id);
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
          setClientAuthenticatedUserId(undefined);
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
        setClientAuthenticatedUserId(undefined);
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
  }, [serverUser]);

  const showOffline = mounted && !isOnline;
  const userRole = resolvedUser?.role;

  // Filtrage strict des éléments de navigation selon la matrice de permissions
  const visibleNavItems = userRole && Object.values(Role).includes(userRole)
    ? NAVIGATION_ITEMS.filter((item) => item.roles.includes(userRole) && isRouteAllowed(item.href, userRole))
    : [];
  const mobilePrimaryItems = visibleNavItems.filter((item) => item.mobilePrimary).slice(0, 4);
  const currentPage = visibleNavItems.find((item) =>
    pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(`${item.href}/`))
  );

  return (
    <div className="flex min-h-screen w-full bg-slate-50 dark:bg-slate-950">
      {/* ============================================================ */}
      {/* 1. SIDEBAR DESKTOP & TABLETTE (>= md)                        */}
      {/* ============================================================ */}
      <aside className={clsx(
        "hidden md:fixed md:inset-y-0 md:flex md:flex-col md:border-r md:border-slate-200 md:bg-white md:dark:border-slate-800 md:dark:bg-slate-900/80 md:backdrop-blur-md",
        sidebarCollapsed ? "md:w-20" : "md:w-64"
      )}>
        {/* Logo SyndicPro */}
        <div className={clsx("flex h-16 items-center border-b border-slate-200 dark:border-slate-800", sidebarCollapsed ? "justify-center px-2" : "gap-3 px-6")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 text-white shadow-md shadow-sky-500/20">
            <Building2 className="h-5 w-5" />
          </div>
          {!sidebarCollapsed && <div>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Syndic<span className="text-sky-500">Pro</span>
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              PWA Copropriété
            </span>
          </div>}
        </div>

        {/* Liens de navigation desktop filtrés par rôle */}
        <nav className={clsx(
          "min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-y-contain py-6",
          sidebarCollapsed ? "px-2" : "px-4"
        )}>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                title={sidebarCollapsed ? item.label : undefined}
                aria-label={sidebarCollapsed ? item.label : undefined}
                className={clsx(
                  "flex items-center rounded-xl py-3 text-sm font-semibold transition-all",
                  sidebarCollapsed ? "justify-center px-2" : "gap-3.5 px-4",
                  isActive
                    ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
                )}
              >
                <Icon className={clsx("h-5 w-5", isActive ? "text-white" : "text-slate-400")} />
                {!sidebarCollapsed && <span>{item.label}</span>}
                {item.href === "/incidents" && pendingCount > 0 && (
                  <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    {sidebarCollapsed ? "•" : pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Pied de sidebar : Profil utilisateur & Statut réseau */}
        <div className={clsx("shrink-0 space-y-3 border-t border-slate-200 dark:border-slate-800", sidebarCollapsed ? "p-2" : "p-4")}>
          <UserMenu initialUser={resolvedUser} compact={sidebarCollapsed} />

          {!sidebarCollapsed && (
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
          )}
        </div>
      </aside>

      {/* ============================================================ */}
      {/* 2. ZONE PRINCIPALE DE CONTENU                                */}
      {/* ============================================================ */}
      <div className={clsx("flex min-w-0 flex-1 flex-col", sidebarCollapsed ? "md:pl-20" : "md:pl-64")}>
        {/* Header mobile (< md) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md md:h-16 md:px-8 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5 md:hidden">
            <button type="button" onClick={() => setMobileNavOpen(true)} aria-label="Ouvrir la navigation" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-white shadow-sm">
              <Building2 className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Syndic<span className="text-sky-500">Pro</span>
            </span>
          </div>

          <div className="hidden min-w-0 items-center gap-3 md:flex">
            <button type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? "Développer le menu" : "Réduire le menu"} title={sidebarCollapsed ? "Développer le menu" : "Réduire le menu"} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            <span className="truncate text-sm font-semibold text-slate-600 dark:text-slate-300">
              {currentPage?.label ?? "SyndicPro"}
            </span>
          </div>

          <div className="mx-3 hidden min-w-0 flex-1 md:block">
            <GlobalSearch variant="field" />
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
            <NotificationBell userId={authenticatedUserId} />
            <div className="md:hidden">
              <GlobalSearch variant="icon" />
            </div>
            <div className="md:hidden">
              <UserMenu initialUser={resolvedUser} compact />
            </div>
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
        {mobilePrimaryItems.map((item) => {
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
        <button type="button" onClick={() => setMobileNavOpen(true)} aria-label="Afficher toute la navigation" className="flex min-h-[48px] min-w-[56px] flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
          <Menu className="h-5 w-5" />
          <span>Menu</span>
        </button>
      </nav>
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Fermer la navigation" onClick={() => setMobileNavOpen(false)} className="absolute inset-0 bg-slate-950/40" />
          <div className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-white">Navigation</span>
              <button type="button" aria-label="Fermer" onClick={() => setMobileNavOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileNavOpen(false)} className={clsx("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium", isActive ? "bg-sky-500 text-white" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800")}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-slate-200 p-4 dark:border-slate-800">
              <UserMenu initialUser={resolvedUser} />
            </div>
          </div>
        </div>
      )}
      {mounted && resolvedUser?.id && <AIChatWidget />}
    </div>
  );
}
