# Rapport technique - Interfaces de gestion de SyndicPro

**Date :** 5 novembre 2026  
**Perimetre :** code source complet des pages d’interface de gestion et de leurs principaux modules client (presentation, etat, formulaires, navigation, filtres, operations declenchees par l’interface et integration hors ligne).

## Resume

SyndicPro centralise l’administration d’une copropriete : tableau de bord, residences et logements, comptes des residents, finances, reclamations, annonces, documents et suivi d’activite. Les pages sont adaptees aux roles; les outils d’intelligence artificielle sont facultatifs et leurs suggestions restent soumises a validation humaine.

## Comment lire le code ci-dessous

Chaque bloc reproduit integralement le fichier indique dans le projet a la date du rapport. Les ecrans de residences, logements, residents, utilisateurs et depenses reutilisent le moteur CRUD configure dans lib/resources/registry.tsx; les charges et reclamations ont aussi des comportements propres. Les primitives UI et les helpers partages essentiels sont inclus au debut.

Ce document couvre le code **frontend** des interfaces et leurs principaux modules client. Les routes API, modeles MongoDB, authentification et secrets d’environnement (.env.local) ne sont pas inclus : ce sont des services serveur distincts et les cles privees ne doivent jamais etre copiees dans un rapport.

## Navigation et composants partages

### `components/layout/AppLayout.tsx`

````tsx
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
````

### `components/layout/navigation.ts`

````ts
import {
  Activity,
  AlertTriangle,
  Bell,
  BrainCircuit,
  Building2,
  FileText,
  LayoutDashboard,
  Megaphone,
  MoreHorizontal,
  Receipt,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Role } from "@/types/enums";

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
  mobilePrimary?: boolean;
}

const allRoles = [Role.ADMIN, Role.SYNDIC, Role.RESIDENT, Role.TECHNICIAN];
const managementRoles = [Role.ADMIN, Role.SYNDIC];

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: allRoles, mobilePrimary: true },
  { label: "AI Intelligence", href: "/ai-intelligence", icon: BrainCircuit, roles: managementRoles },
  { label: "Résidences", href: "/residences", icon: Building2, roles: managementRoles },
  { label: "Résidents", href: "/residents", icon: Users, roles: managementRoles },
  { label: "Utilisateurs", href: "/users", icon: Users, roles: [Role.ADMIN, Role.SYNDIC] },
  { label: "Charges", href: "/charges", icon: Receipt, roles: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT] },
  { label: "Dépenses", href: "/expenses", icon: Wallet, roles: managementRoles },
  { label: "Réclamations", href: "/incidents", icon: AlertTriangle, roles: allRoles, mobilePrimary: true },
  { label: "Annonces", href: "/announcements", icon: Megaphone, roles: allRoles, mobilePrimary: true },
  { label: "Notifications", href: "/notifications", icon: Bell, roles: allRoles, mobilePrimary: true },
  { label: "Activité", href: "/activity", icon: Activity, roles: allRoles },
  { label: "Documents", href: "/documents", icon: FileText, roles: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT] },
  { label: "Plus", href: "/more", icon: MoreHorizontal, roles: allRoles },
];
````

### `components/ui/Button.tsx`

````tsx
import React from "react";
import clsx from "clsx";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none";

    const variants = {
      primary:
        "bg-sky-600 text-white hover:bg-sky-500 active:bg-sky-700 shadow-sm focus:ring-sky-500",
      secondary:
        "bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 focus:ring-slate-400",
      outline:
        "border border-slate-300 bg-transparent text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60 focus:ring-slate-400",
      danger:
        "bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 shadow-sm focus:ring-rose-500",
      ghost:
        "bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 focus:ring-slate-400",
    };

    // Hauteur minimale garantie >= 44px sur mobile pour confort tactile
    const sizes = {
      sm: "min-h-[40px] px-3.5 py-1.5 text-xs rounded-xl gap-1.5",
      md: "min-h-[44px] px-4 py-2 text-sm rounded-xl gap-2",
      lg: "min-h-[48px] px-5 py-2.5 text-base rounded-2xl gap-2.5 font-semibold",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
````

### `components/ui/Card.tsx`

````tsx
import React from "react";
import clsx from "clsx";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all dark:border-slate-800/80 dark:bg-slate-900/60 sm:p-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("mb-3 flex flex-col gap-1", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={clsx("text-base font-semibold tracking-tight text-slate-900 dark:text-white sm:text-lg", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={clsx("text-xs text-slate-500 dark:text-slate-400 sm:text-sm", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("", className)} {...props}>
      {children}
    </div>
  );
}
````

### `components/ui/Badge.tsx`

````tsx
import React from "react";
import clsx from "clsx";
import {
  chargeStatusLabel,
  incidentStatusLabel,
  priorityLabel,
  type ChargeStatus,
  type IncidentStatus,
  type Priority,
} from "@/types/enums";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "neutral";
  chargeStatus?: ChargeStatus;
  incidentStatus?: IncidentStatus;
  priority?: Priority;
}

export function Badge({
  className,
  variant,
  chargeStatus,
  incidentStatus,
  priority,
  children,
  ...props
}: BadgeProps) {
  let computedVariant = variant || "default";
  let content = children;

  if (chargeStatus) {
    content = chargeStatusLabel[chargeStatus];
    switch (chargeStatus) {
      case "PAID":
        computedVariant = "success";
        break;
      case "PARTIAL":
        computedVariant = "warning";
        break;
      case "OVERDUE":
        computedVariant = "danger";
        break;
      case "PENDING":
        computedVariant = "info";
        break;
    }
  } else if (incidentStatus) {
    content = incidentStatusLabel[incidentStatus];
    switch (incidentStatus) {
      case "RESOLVED":
        computedVariant = "success";
        break;
      case "IN_PROGRESS":
        computedVariant = "info";
        break;
      case "ASSIGNED":
        computedVariant = "warning";
        break;
      case "REPORTED":
        computedVariant = "danger";
        break;
    }
  } else if (priority) {
    content = priorityLabel[priority];
    switch (priority) {
      case "URGENT":
        computedVariant = "danger";
        break;
      case "HIGH":
        computedVariant = "warning";
        break;
      case "MEDIUM":
        computedVariant = "info";
        break;
      case "LOW":
        computedVariant = "neutral";
        break;
    }
  }

  const variantStyles = {
    default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    success:
      "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-emerald-400/20",
    warning:
      "bg-amber-500/10 text-amber-700 border border-amber-500/20 dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-400/20",
    danger:
      "bg-rose-500/10 text-rose-700 border border-rose-500/20 dark:bg-rose-400/10 dark:text-rose-400 dark:border-rose-400/20",
    info:
      "bg-sky-500/10 text-sky-700 border border-sky-500/20 dark:bg-sky-400/10 dark:text-sky-400 dark:border-sky-400/20",
    neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide select-none",
        variantStyles[computedVariant],
        className
      )}
      {...props}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {content}
    </span>
  );
}
````

### `components/ui/Input.tsx`

````tsx
import React from "react";
import clsx from "clsx";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={clsx(
            "min-h-[44px] w-full rounded-xl border bg-white px-3.5 py-2 text-base text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-100 disabled:opacity-60 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:disabled:bg-slate-800",
            error
              ? "border-rose-500 focus:border-rose-500 focus:ring-rose-400"
              : "border-slate-300 dark:border-slate-700 focus:border-sky-500",
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-rose-500">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
````

### `components/ui/Select.tsx`

````tsx
import React from "react";
import clsx from "clsx";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: { value: string | number; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, id, options, children, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={clsx(
            "min-h-[44px] w-full rounded-xl border bg-white px-3.5 py-2 text-base text-slate-900 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-100 disabled:opacity-60 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800",
            error
              ? "border-rose-500 focus:border-rose-500 focus:ring-rose-400"
              : "border-slate-300 dark:border-slate-700 focus:border-sky-500",
            className
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error ? (
          <p className="text-xs text-rose-500">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Select.displayName = "Select";
````

### `components/ui/BottomSheet.tsx`

````tsx
"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}: BottomSheetProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    // Bloque le défilement arrière-plan
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      {/* Backdrop sombre avec flou */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Conteneur : Bottom Sheet sur mobile (< sm/md), Modal centré sur desktop */}
      <div
        className={clsx(
          "relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl transition-all dark:bg-slate-900 sm:max-w-lg sm:rounded-3xl sm:border sm:border-slate-800",
          className
        )}
        style={{
          paddingBottom: "max(1rem, env(safe-area-inset-bottom, 1rem))",
        }}
      >
        {/* Poignée de glissement sur mobile */}
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />

        {/* En-tête */}
        <div className="flex items-start justify-between px-6 pt-4 pb-3">
          <div>
            {title && (
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenu avec défilement interne fluide */}
        <div className="flex-1 overflow-y-auto px-6 py-2">{children}</div>
      </div>
    </div>
  );
}
````

### `components/ui/Skeleton.tsx`

````tsx
import React from "react";
import clsx from "clsx";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800/60",
        className
      )}
      {...props}
    />
  );
}
````

### `components/ui/EmptyState.tsx`

````tsx
import React from "react";
import { FolderOpen } from "lucide-react";
import clsx from "clsx";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-800",
        className
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:bg-sky-400/10 dark:text-sky-400">
        {icon || <FolderOpen className="h-6 w-6 stroke-[1.75]" />}
      </div>
      <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200">
        {title}
      </h4>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
````

### `lib/offline/apiClient.ts`

````ts
import { getOfflineDB } from "./db";
import type {
  ResidenceDTO,
  ApartmentDTO,
  ChargeDTO,
  IncidentDTO,
  AnnouncementDTO,
  DocumentDTO,
  PaymentDTO,
} from "@/types/api";

interface FetchOptions extends RequestInit {
  entity?: "residence" | "apartment" | "charge" | "incident" | "announcement" | "payment" | "document";
  offlineFallbackData?: unknown;
}

/**
 * Client HTTP : Fonctionnement 100% standard en ligne, avec repli automatique
 * uniquement si la connexion internet est coupée.
 */
export async function fetchWithOffline<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const db = getOfflineDB();

  const isActuallyOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  // -------------------------------------------------------------
  // 1. REQUÊTES EN LECTURE (GET)
  // -------------------------------------------------------------
  if (method === "GET") {
    // Si on a du réseau : appel direct au serveur comme un site normal
    if (isActuallyOnline) {
      try {
        const res = await fetch(url, options);
        if (res.ok) {
          const data = (await res.json()) as T;
          // Mise en cache asynchrone en arrière-plan sans bloquer
          cacheGetResult(url, data).catch(() => {});
          return data;
        }
        // Si le serveur a répondu (ex: 400 ou 500), on remonte l'erreur sans basculer sur le offline
        const errorText = await res.text();
        throw new Error(`Erreur serveur (${res.status}): ${errorText}`);
      } catch (networkError: unknown) {
        // Seulement si c'est une VRAIE erreur de coupure réseau (ex: Failed to fetch)
        if (
          !navigator.onLine ||
          (networkError instanceof TypeError && networkError.message.includes("fetch"))
        ) {
          console.warn("[ApiClient] Connexion réseau perdue, passage automatique au cache local.");
        } else {
          throw networkError;
        }
      }
    }

    // Réseau coupé : repli transparent sur le cache local Dexie
    const cached = await readFromLocalCache<T>(url);
    if (cached !== null) {
      return cached;
    }

    if (options.offlineFallbackData !== undefined) {
      return options.offlineFallbackData as T;
    }

    throw new Error("Vous êtes hors ligne et cette ressource n'a pas encore été consultée.");
  }

  // -------------------------------------------------------------
  // 2. REQUÊTES EN SUPPRESSION (DELETE)
  // -------------------------------------------------------------
  const entityType = options.entity || inferEntityFromUrl(url);
  const targetId = url.split("?")[0].split("/").filter(Boolean).pop();

  if (method === "DELETE") {
    if (isActuallyOnline) {
      try {
        const res = await fetch(url, options);
        if (res.ok) {
          const responseData = (await res.json().catch(() => ({ success: true }))) as T;
          if (targetId) {
            removeLocalCacheItem(entityType, targetId).catch(() => {});
          }
          return responseData;
        }
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `Erreur serveur (${res.status})`);
      } catch (networkError: unknown) {
        if (!navigator.onLine || (networkError instanceof TypeError && networkError.message.includes("fetch"))) {
          console.warn("[ApiClient] Coupure réseau pendant le DELETE, bascule automatique sur l'Outbox.");
        } else {
          throw networkError;
        }
      }
    }

    // Réseau coupé pour DELETE : enregistrement outbox et retrait du cache local
    const clientId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const { getOfflineSession } = await import("./db");
    const offlineUser = await getOfflineSession();

    await db.outbox.put({
      id: clientId,
      userId: offlineUser?.id,
      entity: (entityType as any) || "incident",
      method: "DELETE",
      url,
      payload: {},
      createdAt: new Date().toISOString(),
      status: "pending",
      retries: 0,
    });

    if (targetId) {
      await removeLocalCacheItem(entityType, targetId);
    }

    return { success: true } as unknown as T;
  }

  // -------------------------------------------------------------
  // 3. REQUÊTES EN ÉCRITURE (POST / PATCH / PUT)
  // -------------------------------------------------------------
  const rawBody = options.body ? JSON.parse(options.body as string) : {};

  // Si on est en ligne : envoi direct normal au serveur
  if (isActuallyOnline) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        body: JSON.stringify(rawBody),
      });

      if (res.ok) {
        const responseData = (await res.json()) as T;
        updateLocalCacheAfterMutation(entityType, responseData, false, method).catch(() => {});
        return responseData;
      }

      // Si le serveur a rejeté la requête métier (ex: validation 400), on retourne l'erreur
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.error || `Erreur serveur (${res.status})`);
    } catch (networkError: unknown) {
      if (
        !navigator.onLine ||
        (networkError instanceof TypeError && networkError.message.includes("fetch"))
      ) {
        console.warn("[ApiClient] Coupure réseau pendant la mutation, bascule automatique sur l'Outbox.");
      } else {
        throw networkError;
      }
    }
  }

  // Réseau coupé : enregistrement automatique dans la file Outbox et réponse optimiste
  const { getOfflineSession } = await import("./db");
  const offlineUser = await getOfflineSession();

  // PATCH hors ligne : met à jour l'élément existant dans Dexie sans créer de faux élément
  if (method === "PATCH") {
    const clientId =
      rawBody.clientId ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

    await db.outbox.put({
      id: clientId,
      userId: offlineUser?.id,
      entity: (entityType as any) || "incident",
      method: "PATCH",
      url,
      payload: rawBody,
      createdAt: new Date().toISOString(),
      status: "pending",
      retries: 0,
    });

    const updated = await patchLocalCacheItem(entityType, targetId || "", rawBody);
    return updated as unknown as T;
  }

  // POST hors ligne : création optimiste
  const clientId =
    rawBody.clientId ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

  const payload = {
    ...rawBody,
    clientId,
  };

  await db.outbox.put({
    id: clientId,
    userId: offlineUser?.id,
    entity: (entityType as any) || "incident",
    method: "POST",
    url,
    payload,
    createdAt: new Date().toISOString(),
    status: "pending",
    retries: 0,
  });

  const optimisticResult = createOptimisticResponse(entityType, payload, clientId);
  await updateLocalCacheAfterMutation(entityType, optimisticResult, true, "POST");

  return optimisticResult as unknown as T;
}

function inferEntityFromUrl(url: string): string {
  if (url.includes("/api/incidents")) return "incident";
  if (url.includes("/api/payments")) return "payment";
  if (url.includes("/api/charges")) return "charge";
  if (url.includes("/api/announcements")) return "announcement";
  if (url.includes("/api/residences")) return "residence";
  if (url.includes("/api/apartments")) return "apartment";
  if (url.includes("/api/documents")) return "document";
  return "unknown";
}

async function cacheGetResult(url: string, rawData: unknown) {
  if (typeof window === "undefined" || !rawData) return;
  const db = getOfflineDB();

  // Les réponses API sont { data: [...], meta } ou tableau
  const data =
    typeof rawData === "object" && rawData !== null && "data" in rawData
      ? (rawData as any).data
      : rawData;

  try {
    if (url.includes("/api/residences")) {
      const list = Array.isArray(data) ? (data as ResidenceDTO[]) : [data as ResidenceDTO];
      await db.residences.bulkPut(list);
    } else if (url.includes("/api/apartments")) {
      const list = Array.isArray(data) ? (data as ApartmentDTO[]) : [data as ApartmentDTO];
      await db.apartments.bulkPut(list);
    } else if (url.includes("/api/charges")) {
      const list = Array.isArray(data) ? (data as ChargeDTO[]) : [data as ChargeDTO];
      await db.charges.bulkPut(list);
    } else if (url.includes("/api/incidents")) {
      const list = Array.isArray(data) ? (data as IncidentDTO[]) : [data as IncidentDTO];
      await db.incidents.bulkPut(list);
    } else if (url.includes("/api/announcements")) {
      const list = Array.isArray(data) ? (data as AnnouncementDTO[]) : [data as AnnouncementDTO];
      await db.announcements.bulkPut(list);
    } else if (url.includes("/api/documents")) {
      const list = Array.isArray(data) ? (data as DocumentDTO[]) : [data as DocumentDTO];
      await db.documents.bulkPut(list);
    } else if (url.includes("/api/dashboard")) {
      await db.dashboard.put({
        id: "current",
        data: rawData,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch {
    // Ignorer silencieusement
  }
}

async function readFromLocalCache<T>(url: string): Promise<T | null> {
  if (typeof window === "undefined") return null;
  const db = getOfflineDB();

  try {
    if (url.includes("/api/dashboard")) {
      const cached = await db.dashboard.get("current");
      return (cached?.data || null) as unknown as T;
    }

    // Gestion ressource unique /api/<entity>/[id]
    const pathNoQuery = url.split("?")[0];
    const matchId = pathNoQuery.match(/\/api\/([a-z]+)\/([a-f0-9]{24}|[a-zA-Z0-9_-]{10,})$/i);
    if (matchId) {
      const entity = matchId[1];
      const id = matchId[2];
      let item = null;
      if (entity === "residences") item = await db.residences.get(id);
      else if (entity === "apartments") item = await db.apartments.get(id);
      else if (entity === "charges") item = await db.charges.get(id);
      else if (entity === "incidents") item = await db.incidents.get(id);
      else if (entity === "announcements") item = await db.announcements.get(id);
      else if (entity === "documents") item = await db.documents.get(id);
      if (item) return item as unknown as T;
    }

    let items: any[] = [];
    if (url.includes("/api/residences")) {
      items = await db.residences.toArray();
    } else if (url.includes("/api/apartments")) {
      items = await db.apartments.toArray();
    } else if (url.includes("/api/charges")) {
      items = await db.charges.toArray();
    } else if (url.includes("/api/incidents")) {
      items = await db.incidents.reverse().sortBy("reportedAt");
    } else if (url.includes("/api/announcements")) {
      items = await db.announcements.reverse().sortBy("publishedAt");
    } else if (url.includes("/api/documents")) {
      items = await db.documents.reverse().sortBy("uploadedAt");
    }

    if (items.length > 0) {
      return {
        data: items,
        meta: {
          page: 1,
          limit: items.length,
          total: items.length,
        },
      } as unknown as T;
    }
  } catch {
    // Ignorer silencieusement
  }
  return null;
}

function createOptimisticResponse(entity: string, payload: Record<string, unknown>, clientId: string) {
  const now = new Date().toISOString();

  if (entity === "incident") {
    return {
      _id: clientId,
      clientId,
      residence: payload.residence,
      apartment: payload.apartment,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      photos: payload.photos || [],
      priority: payload.priority || "MEDIUM",
      status: "REPORTED",
      reportedAt: now,
      createdOffline: true,
      pending: true,
    } as IncidentDTO;
  }

  if (entity === "payment") {
    return {
      _id: clientId,
      clientId,
      charge: payload.charge,
      amount: payload.amount,
      paymentDate: now,
      method: payload.method,
      receiptNumber: `OFFLINE-${Date.now().toString().slice(-6)}`,
      createdOffline: true,
    } as PaymentDTO;
  }

  return {
    _id: clientId,
    ...payload,
    createdOffline: true,
  };
}

async function removeLocalCacheItem(entity: string, id: string) {
  if (typeof window === "undefined" || !id) return;
  const db = getOfflineDB();
  try {
    if (entity === "incident") await db.incidents.delete(id);
    else if (entity === "charge") await db.charges.delete(id);
    else if (entity === "residence") await db.residences.delete(id);
    else if (entity === "apartment") await db.apartments.delete(id);
    else if (entity === "announcement") await db.announcements.delete(id);
    else if (entity === "document") await db.documents.delete(id);
  } catch {
    // Ignorer
  }
}

async function patchLocalCacheItem(entity: string, id: string, patch: Record<string, unknown>) {
  if (typeof window === "undefined" || !id) return { _id: id, ...patch };
  const db = getOfflineDB();
  try {
    if (entity === "incident") {
      const existing = await db.incidents.get(id);
      if (existing) {
        const merged = { ...existing, ...patch, pending: true };
        await db.incidents.put(merged);
        return merged;
      }
    } else if (entity === "charge") {
      const existing = await db.charges.get(id);
      if (existing) {
        const merged = { ...existing, ...patch };
        await db.charges.put(merged);
        return merged;
      }
    } else if (entity === "residence") {
      const existing = await db.residences.get(id);
      if (existing) {
        const merged = { ...existing, ...patch };
        await db.residences.put(merged);
        return merged;
      }
    } else if (entity === "apartment") {
      const existing = await db.apartments.get(id);
      if (existing) {
        const merged = { ...existing, ...patch };
        await db.apartments.put(merged);
        return merged;
      }
    } else if (entity === "announcement") {
      const existing = await db.announcements.get(id);
      if (existing) {
        const merged = { ...existing, ...patch };
        await db.announcements.put(merged);
        return merged;
      }
    } else if (entity === "document") {
      const existing = await db.documents.get(id);
      if (existing) {
        const merged = { ...existing, ...patch };
        await db.documents.put(merged);
        return merged;
      }
    }
  } catch {
    // Ignorer
  }
  return { _id: id, ...patch };
}

async function updateLocalCacheAfterMutation(
  entity: string,
  data: unknown,
  isOptimistic = false,
  _method = "POST"
) {
  if (typeof window === "undefined" || !data) return;
  const db = getOfflineDB();

  try {
    if (entity === "incident") {
      const incident = data as IncidentDTO;
      await db.incidents.put({
        ...incident,
        pending: isOptimistic,
      });
    } else if (entity === "payment") {
      const payment = data as PaymentDTO;
      if (isOptimistic) {
        // En mode optimiste hors ligne : mise à jour temporaire
        const charge = await db.charges.get(payment.charge);
        if (charge) {
          const updatedPaid = (charge.paidAmount || 0) + payment.amount;
          await db.charges.update(charge._id, {
            paidAmount: updatedPaid,
            remaining: Math.max(0, charge.amount - updatedPaid),
            status: updatedPaid >= charge.amount ? "PAID" : "PARTIAL",
          });
        }
      } else {
        // En ligne / synchro : recalcule à partir des données serveur au lieu d'ajouter le montant
        try {
          const chargeRes = await fetch(`/api/charges/${payment.charge}`);
          if (chargeRes.ok) {
            const chargeData = await chargeRes.json();
            const chargeToStore =
              chargeData && typeof chargeData === "object" && "data" in chargeData
                ? chargeData.data
                : chargeData;
            if (chargeToStore && chargeToStore._id) {
              await db.charges.put(chargeToStore);
            }
          }
        } catch {
          // Si échec réseau, on ne sur-ajoute pas
        }
      }
    }
  } catch {
    // Ignorer
  }
}
````

### `lib/offline/db.ts`

````ts
import Dexie, { type Table } from "dexie";
import type {
  ResidenceDTO,
  ApartmentDTO,
  ChargeDTO,
  AnnouncementDTO,
  IncidentDTO,
  DocumentDTO,
} from "@/types/api";
import { Role } from "@/types/enums";

export interface OfflineSessionProfile {
  id: string; // userId
  name: string;
  email: string;
  role: Role;
  expiresAt: number; // timestamp ms
}

export interface OutboxItem {
  id: string; // uuid = clientId
  userId?: string; // id de l'utilisateur ayant émis la requête
  entity: "incident" | "payment" | "charge" | "announcement" | "residence" | "apartment" | "document";
  method: "POST" | "PATCH" | "DELETE";
  url: string;
  payload: Record<string, unknown>;
  createdAt: string;
  status: "pending" | "syncing" | "failed";
  retries: number;
  error?: string;
}

export interface AnnouncementFeedSnapshot {
  key: string;
  data: unknown;
  updatedAt: string;
}

export class SyndicProDatabase extends Dexie {
  residences!: Table<ResidenceDTO, string>;
  apartments!: Table<ApartmentDTO, string>;
  charges!: Table<ChargeDTO, string>;
  announcements!: Table<AnnouncementDTO, string>;
  incidents!: Table<IncidentDTO, string>;
  documents!: Table<DocumentDTO, string>;
  outbox!: Table<OutboxItem, string>;
  session!: Table<OfflineSessionProfile, string>;
  dashboard!: Table<{ id: string; data: unknown; updatedAt: string }, string>;
  announcementFeeds!: Table<AnnouncementFeedSnapshot, string>;

  constructor() {
    super("SyndicProDB");
    this.version(1).stores({
      residences: "_id",
      apartments: "_id, residence",
      charges: "_id, apartment, period, status",
      announcements: "_id, residence, isPinned, publishedAt",
      incidents: "_id, residence, status, clientId, reportedAt",
      documents: "_id, residence, type",
      outbox: "id, status, createdAt, entity",
    });
    this.version(2).stores({
      outbox: "id, status, createdAt, entity, userId",
      session: "id",
    });
    this.version(3).stores({
      dashboard: "id",
    });
    this.version(4).stores({
      announcementFeeds: "key, updatedAt",
    });
  }
}


// Instance singleton utilisable côté client uniquement
let dbInstance: SyndicProDatabase | null = null;

export function getOfflineDB(): SyndicProDatabase {
  if (typeof window === "undefined") {
    // Si appelé côté serveur (SSR), on retourne un proxy vide sécurisé
    return new Proxy({} as SyndicProDatabase, {
      get() {
        return undefined;
      },
    });
  }
  if (!dbInstance) {
    dbInstance = new SyndicProDatabase();
  }
  return dbInstance;
}

/**
 * Enregistre le profil utilisateur dans Dexie à la connexion réussie.
 */
export async function saveOfflineSession(profile: OfflineSessionProfile): Promise<void> {
  const db = getOfflineDB();
  if (db.session) {
    await db.session.put(profile);
  }
}

/**
 * Récupère le profil utilisateur actif en cache Dexie (utile en mode hors-ligne).
 */
export async function getOfflineSession(): Promise<OfflineSessionProfile | undefined> {
  const db = getOfflineDB();
  if (!db.session) return undefined;
  const sessions = await db.session.toArray();
  const session = sessions[0];
  if (!session) return undefined;
  // Vérifie si la session offline a expiré
  if (session.expiresAt && session.expiresAt < Date.now()) {
    await db.session.clear();
    return undefined;
  }
  return session;
}

/**
 * Supprime la session offline lors de la déconnexion.
 */
export async function clearOfflineSession(): Promise<void> {
  const db = getOfflineDB();
  if (db.session) {
    await db.session.clear();
  }
}

/**
 * Vide TOUTES les tables Dexie (données, session, dashboard, et optionnellement outbox).
 */
export async function clearAllOfflineData(clearOutbox = true): Promise<void> {
  const db = getOfflineDB();
  const tasks: Promise<void>[] = [];
  if (db.residences) tasks.push(db.residences.clear());
  if (db.apartments) tasks.push(db.apartments.clear());
  if (db.charges) tasks.push(db.charges.clear());
  if (db.announcements) tasks.push(db.announcements.clear());
  if (db.incidents) tasks.push(db.incidents.clear());
  if (db.documents) tasks.push(db.documents.clear());
  if (db.session) tasks.push(db.session.clear());
  if (db.dashboard) tasks.push(db.dashboard.clear());
  if (db.announcementFeeds) tasks.push(db.announcementFeeds.clear());
  if (clearOutbox && db.outbox) tasks.push(db.outbox.clear());
  await Promise.all(tasks);
}
````

## Tableau de bord de gestion

### `app/dashboard/page.tsx`

````tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  AlertTriangle,
  Receipt,
  RefreshCw,
  PlusCircle,
  Megaphone,
  Wrench,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  BarChart3,
  PieChart as PieIcon,
  Calendar,
  Building2,
  Users,
  Timer,
  ClipboardList,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { Role, type IncidentCategory as IncidentCategoryType, type IncidentStatus as IncidentStatusType, type Priority as PriorityType } from "@/types/enums";
import { DashboardStatCard } from "@/components/dashboard/DashboardStatCard";
import { RecentActivityWidget } from "@/components/dashboard/RecentActivityWidget";
import { NotificationPreview } from "@/components/dashboard/NotificationPreview";
import { AIReportPanel } from "@/components/ai/AIReportPanel";

interface DashboardIncident {
  _id: string;
  title: string;
  category: IncidentCategoryType;
  priority: PriorityType;
  status: IncidentStatusType;
  reportedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  latestUpdate?: string;
  description?: string;
  resolutionDescription?: string;
  resolvedAt?: string;
  residence?: { name?: string; city?: string } | string | null;
  apartment?: { number?: string | number } | null;
}

interface DashboardAnnouncement {
  _id?: string;
  id?: string;
  title: string;
  content?: string;
  category?: string;
  priority?: string;
  isPinned?: boolean;
  isRead?: boolean;
  publishedAt?: string;
  residence?: string;
  readCount?: number;
  eligibleReadCount?: number;
  readPercentage?: number | null;
}

interface DashboardNotification {
  _id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedResource?: { resourceType: string; resourceId?: string | null };
}

interface DashboardData {
  role: Role;
  kpi?: {
    period: string;
    collectionRate: number;
    treasury: number;
    openIncidents: number;
    unpaidAmount: number;
    totalApartments: number;
  };
  charts?: {
    financialByMonth: Array<{ month: string; recettes: number; depenses: number }>;
    incidentsByStatus: Array<{ status: string; label: string; count: number; color: string }>;
    announcementByMonth: Array<{ month: string; period: string; count: number }>;
  };
  overview?: {
    residences?: number;
    users?: number;
    residents?: number;
    technicians?: number;
    incidents?: number;
    total?: number;
    reported?: number;
    assigned?: number;
    inProgress?: number;
    resolved?: number;
    urgent?: number;
    rejectedResolutions?: number;
    open?: number;
    publishedAnnouncements?: number;
    scheduledAnnouncements?: number;
    unreadAnnouncements?: number;
    unreadNotifications?: number;
    awaitingReview?: number;
    averageResolutionHours?: number;
    urgentIncidents?: Array<Pick<DashboardIncident, "title" | "category" | "priority" | "status" | "createdAt"> & { id: string; residence?: string }>;
    recentAnnouncements?: DashboardAnnouncement[];
    technicianWorkload?: Array<{ technicianId: string; name: string; assigned: number; inProgress: number; resolved: number; currentWorkload: number }>;
  };
  residences?: Array<{ id: string; name: string; city?: string }>;
  whatIOwe?: { totalDue: number; unpaidCharges: Array<{ _id: string; period: string; dueDate: string; amount: number; paidAmount?: number; remaining?: number }> };
  latestAnnouncements?: DashboardAnnouncement[];
  latestNotifications?: DashboardNotification[];
  myIncidents?: { items: DashboardIncident[]; total: number; open: number };
  myInterventions?: {
    pending: DashboardIncident[];
    recentResolved: DashboardIncident[];
    counts: { assigned: number; inProgress: number; resolved: number; urgent: number; total: number };
  };
}

const INCIDENT_STAGES = ["REPORTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"];
const TECHNICIAN_PRIORITY_GROUPS: Array<{ priority: PriorityType; label: string }> = [
  { priority: "URGENT", label: "Urgent" },
  { priority: "HIGH", label: "Élevée" },
  { priority: "MEDIUM", label: "Moyenne" },
  { priority: "LOW", label: "Faible" },
];

function formatDashboardDate(value?: string) {
  return value ? new Date(value).toLocaleDateString("fr-FR") : "Date indisponible";
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (background = false) => {
    try {
      if (!background) setLoading(true);
      setError(null);
      const res = await fetchWithOffline<DashboardData>("/api/dashboard", {
        cache: "no-store",
      });
      setData(res);
    } catch (err: unknown) {
      console.error("[Dashboard] Erreur chargement :", err);
      setError(err instanceof Error ? err.message : "Erreur de chargement du tableau de bord");
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    const refresh = () => void loadDashboard(true);
    const refreshWhenVisible = () => {
      if (!document.hidden) refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, 15_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("syndicpro:dashboard-refresh", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("syndicpro:dashboard-refresh", refresh);
    };
  }, [loadDashboard]);

  const role = data?.role;
  const pendingInterventions = data?.myInterventions?.pending ?? [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              {role === Role.ADMIN
                ? "Platform Overview"
                : role === Role.SYNDIC
                ? "My Management Dashboard"
                : role === Role.RESIDENT
                ? "My Residence"
                : role === Role.TECHNICIAN
                ? "My Work Dashboard"
                : "Tableau de bord"}
            </h1>
            <p className="text-xs text-slate-500 sm:text-sm dark:text-slate-400">
              {role === Role.ADMIN
                ? "Monitor residences, reclamations, announcements, and maintenance activity across the platform."
                : role === Role.SYNDIC
                ? "Monitor your residences, follow reclamations, and communicate with residents."
                : role === Role.RESIDENT
                ? "Follow your reclamations and stay informed about your residence."
                : role === Role.TECHNICIAN
                ? "Manage your assigned reclamations and track your maintenance activity."
                : "Pilotage SyndicPro"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadDashboard()}
              className="gap-1.5 min-h-[44px] text-xs sm:min-h-[36px]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            {role === Role.RESIDENT && (
              <Link href="/incidents?action=new">
                <Button size="sm" className="gap-1.5 min-h-[44px] text-xs sm:min-h-[36px]">
                  <PlusCircle className="h-4 w-4" />
                  Signaler un incident
                </Button>
              </Link>
            )}
            {(role === Role.ADMIN || role === Role.SYNDIC) && (
              <Link href="/announcements">
                <Button size="sm" className="gap-1.5 min-h-[44px] text-xs sm:min-h-[36px]">
                  <Megaphone className="h-4 w-4" />
                  Gérer les annonces
                </Button>
              </Link>
            )}
            {role === Role.TECHNICIAN && (
              <Link href="/incidents">
                <Button size="sm" className="gap-1.5 min-h-[44px] text-xs sm:min-h-[36px]">
                  <Wrench className="h-4 w-4" />
                  Voir mon travail
                </Button>
              </Link>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {(role === Role.ADMIN || role === Role.SYNDIC) && data?.overview && (
          <section aria-label="Vue d'ensemble" className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <DashboardStatCard label="Résidences" value={data.overview.residences ?? 0} icon={Building2} tone="info" />
              <DashboardStatCard label="Utilisateurs actifs" value={data.overview.users ?? 0} icon={Users} />
              <DashboardStatCard label="Résidents" value={data.overview.residents ?? 0} icon={Users} />
              <DashboardStatCard label="Techniciens" value={data.overview.technicians ?? 0} icon={Wrench} />
              <DashboardStatCard label="Réclamations" value={data.overview.incidents ?? 0} icon={AlertTriangle} />
              <DashboardStatCard label="Urgentes" value={data.overview.urgent ?? 0} icon={ShieldAlert} tone="danger" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
              <DashboardStatCard label="Signalées" value={data.overview.reported ?? 0} icon={Clock} tone="warning" />
              <DashboardStatCard label="Assignées" value={data.overview.assigned ?? 0} icon={ClipboardList} />
              <DashboardStatCard label="En cours" value={data.overview.inProgress ?? 0} icon={Wrench} tone="info" />
              <DashboardStatCard label="Résolues" value={data.overview.resolved ?? 0} icon={CheckCircle2} tone="success" />
              <DashboardStatCard label="Résolutions refusées" value={data.overview.rejectedResolutions ?? 0} icon={ShieldAlert} tone="danger" />
              <DashboardStatCard label="Annonces publiées" value={data.overview.publishedAnnouncements ?? 0} icon={Megaphone} />
              <DashboardStatCard label="Annonces programmées" value={data.overview.scheduledAnnouncements ?? 0} icon={Calendar} />
            </div>
          </section>
        )}

        {role === Role.RESIDENT && data?.overview && (
          <section className="space-y-4">
            <Card className="border-sky-200 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/20">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Bienvenue dans votre espace résidence</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {data.residences?.length
                      ? data.residences.map((residence) => [residence.name, residence.city].filter(Boolean).join(" · ")).join(" / ")
                      : "Aucune résidence associée n'est disponible."}
                  </p>
                </div>
                <Link href="/announcements" className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300">Voir les annonces</Link>
              </div>
            </Card>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <DashboardStatCard label="Mes réclamations" value={data.overview.total ?? 0} icon={AlertTriangle} />
              <DashboardStatCard label="À assigner" value={data.overview.reported ?? 0} icon={Clock} tone="warning" />
              <DashboardStatCard label="En cours" value={data.overview.inProgress ?? 0} icon={Wrench} tone="info" />
              <DashboardStatCard label="Résolues" value={data.overview.resolved ?? 0} icon={CheckCircle2} tone="success" />
              <DashboardStatCard label="Annonces non lues" value={data.overview.unreadAnnouncements ?? 0} icon={Megaphone} tone="warning" />
            </div>
          </section>
        )}

        {role === Role.TECHNICIAN && data?.overview && (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Résumé de mon activité">
            <DashboardStatCard label="Affectées" value={data.overview.assigned ?? 0} icon={ClipboardList} tone="warning" />
            <DashboardStatCard label="En cours" value={data.overview.inProgress ?? 0} icon={Wrench} tone="info" />
            <DashboardStatCard label="Urgentes" value={data.overview.urgent ?? 0} icon={ShieldAlert} tone="danger" />
            <DashboardStatCard label="Résolues" value={data.overview.resolved ?? 0} icon={CheckCircle2} tone="success" />
            <DashboardStatCard label="En revue" value={data.overview.awaitingReview ?? 0} icon={Clock} />
            <DashboardStatCard label="Temps moyen" value={data.overview.averageResolutionHours !== undefined ? `${data.overview.averageResolutionHours} h` : "—"} icon={Timer} detail="Sur les dossiers résolus" />
          </section>
        )}

        {/* ======================================================== */}
        {/* 1. VUE ADMIN / SYNDIC : KPI + 2 GRAPHIQUES RECHARTS      */}
        {/* ======================================================== */}
        {(role === Role.ADMIN || role === Role.SYNDIC) && (
          <div className="space-y-6">
            {/* Grille des 4 KPI */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* KPI 1 : Taux de recouvrement du mois */}
              <Card className="border-sky-500/20 bg-gradient-to-br from-white to-sky-50/50 dark:from-slate-900 dark:to-slate-900/60">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Recouvrement mois
                    </span>
                    <TrendingUp className="h-5 w-5 text-sky-500" />
                  </div>
                  {loading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div>
                      <div className="text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">
                        {data?.kpi?.collectionRate ?? 0} %
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Période : {data?.kpi?.period || "En cours"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* KPI 2 : Trésorerie disponible */}
              <Card className="border-emerald-500/20 bg-gradient-to-br from-white to-emerald-50/50 dark:from-slate-900 dark:to-slate-900/60">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Trésorerie nette
                    </span>
                    <Wallet className="h-5 w-5 text-emerald-500" />
                  </div>
                  {loading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div>
                      <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 sm:text-3xl">
                        {(data?.kpi?.treasury ?? 0).toLocaleString("fr-FR", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        €
                      </div>
                      <p className="text-[11px] text-slate-500">Recettes - Dépenses totales</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* KPI 3 : Incidents ouverts */}
              <Card className="border-amber-500/20 bg-gradient-to-br from-white to-amber-50/50 dark:from-slate-900 dark:to-slate-900/60">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Incidents ouverts
                    </span>
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  </div>
                  {loading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div>
                      <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 sm:text-3xl">
                        {data?.kpi?.openIncidents ?? 0}
                      </div>
                      <p className="text-[11px] text-slate-500">En attente ou en cours</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* KPI 4 : Impayés */}
              <Card className="border-rose-500/20 bg-gradient-to-br from-white to-rose-50/50 dark:from-slate-900 dark:to-slate-900/60">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Total impayés
                    </span>
                    <Receipt className="h-5 w-5 text-rose-500" />
                  </div>
                  {loading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div>
                      <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 sm:text-3xl">
                        {(data?.kpi?.unpaidAmount ?? 0).toLocaleString("fr-FR", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        €
                      </div>
                      <p className="text-[11px] text-slate-500">Reste dû par les lots</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 2 Graphiques Recharts */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Graphique 1 : Recettes vs Dépenses par mois */}
              <Card className="p-4">
                <div className="flex items-center justify-between pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <BarChart3 className="h-4 w-4 text-sky-500" />
                      Recettes vs Dépenses (6 derniers mois)
                    </h3>
                    <p className="text-xs text-slate-500">Comparatif des flux de trésorerie en €</p>
                  </div>
                </div>

                {loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <div className="h-64 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.charts?.financialByMonth || []}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => [`${value} €`, ""]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="recettes" name="Recettes (€)" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="depenses" name="Dépenses (€)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>

              {/* Graphique 2 : Incidents par statut */}
              <Card className="p-4">
                <div className="flex items-center justify-between pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <PieIcon className="h-4 w-4 text-sky-500" />
                      Répartition des Incidents par Statut
                    </h3>
                    <p className="text-xs text-slate-500">Nombre d&apos;incidents selon leur étape</p>
                  </div>
                </div>

                {loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <div className="h-64 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data?.charts?.incidentsByStatus || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="count"
                          nameKey="label"
                        >
                          {(data?.charts?.incidentsByStatus || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val) => [`${val} incident(s)`, "Volume"]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>

            <Card>
              <div className="pb-3">
                <h2 className="font-semibold text-slate-900 dark:text-white">Tendance des annonces publiées</h2>
                <p className="text-xs text-slate-500">Publications des six derniers mois dans le périmètre autorisé.</p>
              </div>
              {loading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.charts?.announcementByMonth ?? []}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Annonces publiées" fill="#0284c7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Réclamations à traiter en priorité</h2>
                  <Link href="/incidents" className="text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300">Tout voir</Link>
                </div>
                {!data?.overview?.urgentIncidents?.length ? (
                  <p className="py-4 text-sm text-slate-500">Aucune réclamation urgente ou prioritaire ouverte.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.overview.urgentIncidents.map((incident) => (
                      <li key={incident.id} className="py-3 first:pt-0 last:pb-0">
                        <Link href={`/incidents?incident=${encodeURIComponent(incident.id)}`} className="flex flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{incident.title}</span>
                            <span className="text-xs text-slate-500">{incident.residence} · {incident.category}</span>
                          </span>
                          <Badge priority={incident.priority} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Charge des techniciens</h2>
                  <span className="text-xs text-slate-500">Dossiers affectés ou en cours</span>
                </div>
                {!data?.overview?.technicianWorkload?.length ? (
                  <p className="py-4 text-sm text-slate-500">Aucune charge technicienne à afficher.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.overview.technicianWorkload.map((technician) => (
                      <li key={technician.technicianId} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-200">{technician.name}</span>
                        <span className="shrink-0 text-xs text-slate-500">{technician.assigned} affectée(s) · {technician.inProgress} en cours · {technician.resolved} résolue(s)</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Annonces récentes</h2>
                  <Link href="/announcements" className="text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300">Gérer</Link>
                </div>
                {!data?.overview?.recentAnnouncements?.length ? (
                  <p className="py-4 text-sm text-slate-500">Aucune annonce publiée récemment.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.overview.recentAnnouncements.map((announcement) => (
                      <li key={announcement.id ?? announcement._id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{announcement.title}</span>
                          <span className="text-xs text-slate-500">
                            {announcement.residence || "Résidence"} · {announcement.readPercentage === null
                              ? "Lectures non calculables pour cette audience"
                              : `${announcement.readCount ?? 0}/${announcement.eligibleReadCount ?? 0} lectures (${announcement.readPercentage ?? 0} %)`}
                          </span>
                        </span>
                        {announcement.priority === "URGENT" && <Badge priority={announcement.priority} />}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Actions de gestion</h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Link href="/residences" className="rounded-lg border border-slate-200 p-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">Résidences</Link>
                  <Link href="/users" className="rounded-lg border border-slate-200 p-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">Utilisateurs</Link>
                  <Link href="/incidents" className="rounded-lg border border-slate-200 p-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">Toutes les réclamations</Link>
                  <Link href="/incidents" className="rounded-lg border border-slate-200 p-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">Analyses et filtres de dates</Link>
                  <Link href="/announcements" className="rounded-lg border border-slate-200 p-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">Annonces</Link>
                </div>
              </Card>
            </div>
            <Card>
              <div className="mb-3">
                <h2 className="font-semibold text-slate-900 dark:text-white">Management insights</h2>
                <p className="mt-1 text-xs text-slate-500">Observations générées par l&apos;IA à partir des données autorisées de vos résidences.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <AIReportPanel endpoint="/api/ai/reports/incidents" title="Générer un rapport IA sur les réclamations" />
                <AIReportPanel endpoint="/api/ai/reports/announcements" title="Analyser les annonces" />
              </div>
            </Card>
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. VUE RESIDENT : Ce que je dois, Annonces, Mes incidents*/}
        {/* ======================================================== */}
        {role === Role.RESIDENT && (
          <div className="space-y-6">
            {/* Ce que je dois */}
            <Card className="border-sky-500/20 bg-gradient-to-br from-white to-sky-50/40 p-4 dark:from-slate-900 dark:to-slate-900/60">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Situation de mon compte copropriétaire
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                      {(data?.whatIOwe?.totalDue ?? 0).toFixed(2)} €
                    </span>
                    <span className="text-xs text-slate-500">solde total restant dû</span>
                  </div>
                </div>
                <Link href="/charges">
                  <Button variant="primary" className="min-h-[44px] gap-2 text-xs">
                    <Receipt className="h-4 w-4" />
                    Consulter mes appels de charges
                  </Button>
                </Link>
              </div>

              {data?.whatIOwe?.unpaidCharges && data.whatIOwe.unpaidCharges.length > 0 && (
                <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100 text-xs dark:divide-slate-800 dark:border-slate-800">
                  {data.whatIOwe.unpaidCharges.map((ch) => (
                    <div key={ch._id} className="flex items-center justify-between py-2.5">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Appel de charges — {ch.period}
                        </span>
                        <p className="text-[11px] text-slate-400">
                          Échéance : {new Date(ch.dueDate).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {(ch.remaining ?? ch.amount).toFixed(2)} €
                        </span>
                        <p className="text-[10px] text-slate-400">sur {ch.amount} €</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Dernières annonces */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-sky-500" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Dernières annonces de l&apos;immeuble
                    </h3>
                  </div>
                  <Link href="/announcements" className="text-xs text-sky-600 hover:underline">
                    Tout voir
                  </Link>
                </div>

                {!data?.latestAnnouncements || data.latestAnnouncements.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    Aucune annonce récente publiée.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {data.latestAnnouncements.map((a) => (
                      <div
                        key={a._id}
                        className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                      >
                        <Link href={`/announcements?announcement=${encodeURIComponent(String(a._id))}`} className="block">
                          <div className="flex items-center justify-between gap-2 font-semibold text-slate-900 dark:text-white">
                            <span>{a.title}</span>
                            <span className="flex shrink-0 items-center gap-1">
                              {a.priority === "URGENT" && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">Urgente</span>}
                              {!a.isRead && <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">Non lue</span>}
                              {a.isPinned && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">Épinglée</span>}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-slate-600 dark:text-slate-300">{a.content}</p>
                          <p className="mt-1.5 text-[10px] text-slate-400">{a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("fr-FR") : ""}</p>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Mes incidents */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Mes signalements d&apos;incidents
                    </h3>
                  </div>
                  <Link href="/incidents" className="text-xs text-sky-600 hover:underline">
                    Gérer ({data?.myIncidents?.total ?? 0})
                  </Link>
                </div>

                {!data?.myIncidents?.items || data.myIncidents.items.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Vous n&apos;avez signalé aucun incident pour le moment.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {data.myIncidents.items.map((inc) => (
                      <div
                        key={inc._id}
                        className="rounded-xl border border-slate-100 p-3 text-xs dark:border-slate-800"
                      >
                        <Link href={`/incidents?incident=${encodeURIComponent(inc._id)}`} className="flex items-center justify-between gap-3">
                          <div>
                          <p className="font-bold text-slate-900 dark:text-white">{inc.title}</p>
                          <p className="text-[11px] text-slate-400">
                            {formatDashboardDate(inc.latestUpdate ?? inc.reportedAt)} • {inc.category} • Dernière mise à jour
                          </p>
                          </div>
                          <Badge incidentStatus={inc.status} />
                        </Link>
                        <div className="mt-3">
                          <div className="flex items-center gap-1" aria-label={`Étape actuelle : ${inc.status}`}>
                            {INCIDENT_STAGES.map((stage, index) => {
                              const currentIndex = INCIDENT_STAGES.indexOf(inc.status);
                              const complete = index <= currentIndex;
                              return <span key={stage} className={`h-1.5 flex-1 rounded-full ${complete ? "bg-sky-500" : "bg-slate-200 dark:bg-slate-700"}`} title={stage} />;
                            })}
                          </div>
                          <p className="mt-1 text-[10px] text-slate-400">Signalé → Assigné → En cours → Résolu</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. VUE TECHNICIAN : Mes interventions                      */}
        {/* ======================================================== */}
        {role === Role.TECHNICIAN && (
          <div className="space-y-6">
            {/* KPI Interventions */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card className="border-amber-500/20 bg-amber-50/40 p-4 dark:bg-amber-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-amber-800 dark:text-amber-300">
                    Assignées (À traiter)
                  </span>
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <p className="mt-2 text-3xl font-extrabold text-amber-900 dark:text-amber-200">
                  {data?.myInterventions?.counts?.assigned ?? 0}
                </p>
              </Card>

              <Card className="border-indigo-500/20 bg-indigo-50/40 p-4 dark:bg-indigo-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-indigo-800 dark:text-indigo-300">
                    En cours de réparation
                  </span>
                  <Wrench className="h-5 w-5 text-indigo-500" />
                </div>
                <p className="mt-2 text-3xl font-extrabold text-indigo-900 dark:text-indigo-200">
                  {data?.myInterventions?.counts?.inProgress ?? 0}
                </p>
              </Card>

              <Card className="border-emerald-500/20 bg-emerald-50/40 p-4 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-emerald-800 dark:text-emerald-300">
                    Interventions résolues
                  </span>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="mt-2 text-3xl font-extrabold text-emerald-900 dark:text-emerald-200">
                  {data?.myInterventions?.counts?.resolved ?? 0}
                </p>
              </Card>
            </div>

            {/* Liste des interventions en attente */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-sky-500" />
                  Interventions actives sur le terrain
                </h3>
                <Link href="/incidents" className="text-xs text-sky-600 hover:underline">
                  Ouvrir le module Incidents
                </Link>
              </div>

              {pendingInterventions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Bravo ! Vous n&apos;avez aucune intervention en attente.
                </div>
              ) : (
                <div className="space-y-5">
                  {TECHNICIAN_PRIORITY_GROUPS.map((group) => {
                    const incidents = pendingInterventions.filter((incident) => incident.priority === group.priority);
                    if (incidents.length === 0) return null;
                    return (
                      <section key={group.priority} className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {group.label} <span className="font-medium">({incidents.length})</span>
                        </h4>
                        {incidents.map((it) => (
                          <div
                            key={it._id}
                            className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-center"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white">{it.title}</span>
                                <Badge priority={it.priority} />
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-300">
                                {typeof it.residence === "string"
                                  ? it.residence
                                  : it.residence
                                  ? [it.residence.name, it.residence.city].filter(Boolean).join(" · ")
                                  : "Résidence indisponible"} —{" "}
                                {it.apartment ? `Lot ${it.apartment.number}` : "Parties communes"}
                              </p>
                              <p className="text-[11px] text-slate-400">{it.description}</p>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-center">
                              <Badge incidentStatus={it.status} />
                              <Link href={`/incidents?incident=${encodeURIComponent(it._id)}`}>
                                <Button size="sm" variant="secondary" className="min-h-[44px] gap-1 text-xs">
                                  Traiter
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        ))}
                      </section>
                    );
                  })}
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Historique récent</h2>
                  <Link href="/incidents" className="text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300">Tout l&apos;historique</Link>
                </div>
                {!data?.myInterventions?.recentResolved?.length ? (
                  <p className="py-4 text-sm text-slate-500">Aucune réclamation résolue récemment.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.myInterventions.recentResolved.map((incident) => (
                      <li key={incident._id} className="py-3 first:pt-0 last:pb-0">
                        <Link href={`/incidents?incident=${encodeURIComponent(incident._id)}`} className="flex items-center justify-between gap-3">
                          <span>
                            <span className="block text-sm font-semibold text-slate-900 dark:text-white">{incident.title}</span>
                            <span className="text-xs text-slate-500">{incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleDateString("fr-FR") : "Résolue"} · {incident.resolutionDescription || "Aucun compte rendu disponible"}</span>
                          </span>
                          <Badge incidentStatus={incident.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Annonces de maintenance et sécurité</h2>
                  <Link href="/announcements" className="text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300">Tout voir</Link>
                </div>
                {!data?.latestAnnouncements?.length ? (
                  <p className="py-4 text-sm text-slate-500">Aucune annonce pertinente récente.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.latestAnnouncements.map((announcement) => (
                      <li key={announcement._id ?? announcement.id ?? announcement.title} className="py-3 first:pt-0 last:pb-0">
                        <Link href={`/announcements?announcement=${encodeURIComponent(String(announcement._id ?? announcement.id))}`} className="block">
                          <span className="block text-sm font-semibold text-slate-900 dark:text-white">{announcement.title}</span>
                          <span className="text-xs text-slate-500">{announcement.category} · {announcement.publishedAt ? new Date(announcement.publishedAt).toLocaleDateString("fr-FR") : ""}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        )}
        {data && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <NotificationPreview items={data.latestNotifications} unreadCount={data.overview?.unreadNotifications} />
            <RecentActivityWidget />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
````

### `components/dashboard/DashboardStatCard.tsx`

````tsx
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";

type StatTone = "neutral" | "info" | "warning" | "danger" | "success";

const toneClasses: Record<StatTone, { icon: string; value: string }> = {
  neutral: { icon: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", value: "text-slate-900 dark:text-white" },
  info: { icon: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300", value: "text-slate-900 dark:text-white" },
  warning: { icon: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", value: "text-amber-800 dark:text-amber-200" },
  danger: { icon: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300", value: "text-rose-700 dark:text-rose-300" },
  success: { icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", value: "text-emerald-700 dark:text-emerald-300" },
};

export function DashboardStatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
  tone?: StatTone;
}) {
  const classes = toneClasses[tone];
  return (
    <Card className="flex min-w-0 items-start gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${classes.icon}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className={`mt-1 text-2xl font-bold tracking-tight ${classes.value}`}>{value}</p>
        {detail && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>}
      </div>
    </Card>
  );
}
````

### `components/dashboard/RecentActivityWidget.tsx`

````tsx
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
````

### `components/dashboard/NotificationPreview.tsx`

````tsx
import Link from "next/link";
import { Bell, ExternalLink } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";

interface NotificationPreviewItem {
  _id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedResource?: { resourceType: string; resourceId?: string | null };
}

function notificationHref(item: NotificationPreviewItem) {
  const resource = item.relatedResource;
  if (resource?.resourceType === "INCIDENT" && resource.resourceId) {
    return `/incidents?incident=${encodeURIComponent(resource.resourceId)}`;
  }
  if (resource?.resourceType === "ANNOUNCEMENT" && resource.resourceId) {
    return `/announcements?announcement=${encodeURIComponent(resource.resourceId)}`;
  }
  return "/notifications";
}

export function NotificationPreview({
  items = [],
  unreadCount,
}: {
  items?: NotificationPreviewItem[];
  unreadCount?: number;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          <CardTitle>Notifications récentes</CardTitle>
          {unreadCount !== undefined && unreadCount > 0 && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">{unreadCount} non lue(s)</span>}
        </div>
        <Link href="/notifications" className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300">
          Tout voir <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      {!items.length ? (
        <p className="py-3 text-sm text-slate-500">Aucune notification récente.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((item) => (
            <li key={item._id} className="py-3 first:pt-0 last:pb-0">
              <Link href={notificationHref(item)} className="flex items-start gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.isRead ? "bg-slate-300 dark:bg-slate-600" : "bg-sky-500"}`} aria-label={item.isRead ? "Lue" : "Non lue"} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{item.message}</span>
                </span>
                <time dateTime={item.createdAt} className="shrink-0 text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleDateString("fr-FR")}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
````

## Residences, logements, residents et comptes

### `app/residences/page.tsx`

````tsx
"use client";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { residenceConfig } from "@/lib/resources/registry";

export default function ResidencesPage() {
  return <ResourcePage config={residenceConfig} />;
}
````

### `app/apartments/page.tsx`

````tsx
"use client";

import { AlertTriangle, CheckCircle2, PieChart } from "lucide-react";
import { ResourcePage } from "@/components/crud/ResourcePage";
import { apartmentConfig } from "@/lib/resources/registry";
import type { ApartmentDTO } from "@/types/api";

export default function ApartmentsPage() {
  return (
    <ResourcePage
      config={apartmentConfig}
      headerExtra={(items: ApartmentDTO[]) => {
        const totalShares = items.reduce((acc, curr) => acc + (Number(curr.shares) || 0), 0);
        const isOver = totalShares > 1000;
        const isExact = totalShares === 1000;

        return (
          <div
            className={`rounded-2xl border p-4 transition-all ${
              isOver
                ? "border-rose-500/30 bg-rose-50/80 text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200"
                : isExact
                ? "border-emerald-500/30 bg-emerald-50/80 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border-sky-500/20 bg-sky-50/60 text-sky-900 dark:border-sky-500/30 dark:bg-sky-950/30 dark:text-sky-200"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {isOver ? (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white shadow-sm">
                    <AlertTriangle className="h-5 w-5 stroke-[2.25]" />
                  </div>
                ) : isExact ? (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
                    <CheckCircle2 className="h-5 w-5 stroke-[2.25]" />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm">
                    <PieChart className="h-5 w-5 stroke-[2]" />
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-bold">
                    {isOver
                      ? "Attention : Dépassement de la base des tantièmes !"
                      : isExact
                      ? "Répartition complète et conforme (1 000 / 1 000)"
                      : "Répartition courante des tantièmes"}
                  </h4>
                  <p className="text-xs opacity-85">
                    {isOver
                      ? `Le total des tantièmes est de ${totalShares.toLocaleString("fr-FR")} / 1 000. Il excède la quote-part maximale légale de ${totalShares - 1000} tantièmes.`
                      : isExact
                      ? "La somme de l'ensemble des quotes-parts atteint exactement la base légale de 1 000 tantièmes."
                      : `Total actuel : ${totalShares.toLocaleString("fr-FR")} / 1 000 tantièmes (${1000 - totalShares} tantièmes restants à allouer).`}
                  </p>
                </div>
              </div>

              <div className="hidden shrink-0 text-right sm:block">
                <span className="text-lg font-extrabold">{totalShares}</span>
                <span className="text-xs opacity-75"> / 1000</span>
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
````

### `app/residents/page.tsx`

````tsx
"use client";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { residentConfig } from "@/lib/resources/registry";

export default function ResidentsPage() {
  return <ResourcePage config={residentConfig} />;
}
````

### `app/users/page.tsx`

````tsx
"use client";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { userConfig } from "@/lib/resources/registry";

export default function UsersPage() {
  return (
    <ResourcePage
      config={userConfig}
      title="Utilisateurs"
      description="Gérez les comptes et les rôles, et rattachez chaque compte résident à sa résidence."
    />
  );
}
````

### `lib/resources/registry.tsx`

````tsx
import { Role } from "@/types/enums";
import type { ResourceConfig } from "./types";
import type {
  AnnouncementDTO,
  ResidenceDTO,
  ApartmentDTO,
  ChargeDTO,
  PaymentDTO,
  ExpenseDTO,
  IncidentDTO,
  MeetingDTO,
  ResolutionDTO,
  VoteDTO,
  DocumentDTO,
  UserDTO,
} from "@/types/api";



/* ============================================================ */
/* 1. ANNONCES                                                  */
/* ============================================================ */
export const announcementConfig: ResourceConfig<AnnouncementDTO> = {
  key: "announcements",
  label: "Annonce",
  plural: "Annonces",
  apiPath: "/api/announcements",
  entityOfflineKey: "announcement",
  searchPlaceholder: "Rechercher par titre ou contenu...",
  defaultSort: "-isPinned,-publishedAt",

  fields: [
    {
      name: "title",
      label: "Titre de l'annonce",
      type: "text",
      required: true,
      placeholder: "Ex : Travaux de ravalement, Réunion syndic...",
    },
    {
      name: "residence",
      label: "Résidence concernée",
      type: "relation",
      required: true,
      relation: {
        resource: "residences",
        apiPath: "/api/residences",
        labelField: "name",
        valueField: "_id",
      },
    },
    {
      name: "content",
      label: "Contenu de l'annonce",
      type: "textarea",
      required: true,
      placeholder: "Précisez l'objet, la date des interventions, les consignes aux résidents...",
    },
    {
      name: "publishedAt",
      label: "Date de publication",
      type: "date",
    },
    {
      name: "isPinned",
      label: "Épingler l'annonce",
      type: "boolean",
      defaultValue: false,
      helpText: "Affiche l'annonce en priorité en tête de liste pour tous les résidents",
    },
  ],

  listColumns: [
    {
      key: "title",
      label: "Titre",
    },
    {
      key: "residence",
      label: "Résidence",
      type: "relation",
    },
    {
      key: "publishedAt",
      label: "Date",
      type: "date",
    },
    {
      key: "isPinned",
      label: "Épinglée",
      type: "boolean",
    },
  ],

  cardTitle: (item) => item.title || "Annonce",
  cardSubtitle: (item) => item.content || "",

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  filterDefs: [
    {
      key: "isPinned",
      label: "Épinglées",
      type: "boolean",
    },
  ],
};

/* ============================================================ */
/* 2. RÉSIDENCES                                                */
/* ============================================================ */
export const residenceConfig: ResourceConfig<ResidenceDTO> = {
  key: "residences",
  label: "Résidence",
  plural: "Résidences",
  apiPath: "/api/residences",
  entityOfflineKey: "residence",
  searchPlaceholder: "Rechercher une résidence par nom, ville ou adresse...",
  defaultSort: "name",

  fields: [
    {
      name: "name",
      label: "Nom de la copropriété",
      type: "text",
      required: true,
      placeholder: "Ex : Résidence Les Oliviers",
    },
    {
      name: "address",
      label: "Adresse complète",
      type: "text",
      required: true,
      placeholder: "Ex : 14 rue de la République",
    },
    {
      name: "city",
      label: "Ville",
      type: "text",
      required: true,
      placeholder: "Ex : Nice",
    },
    {
      name: "floors",
      label: "Nombre d'étages",
      type: "number",
      required: true,
      defaultValue: 1,
    },
    {
      name: "totalApartments",
      label: "Nombre total de lots",
      type: "number",
      required: true,
      defaultValue: 10,
    },
    {
      name: "syndic",
      label: "Syndic gestionnaire",
      type: "relation",
      required: true,
      helpText: "Le syndic ne verra la résidence que si elle lui est rattachée",
      relation: {
        resource: "users",
        apiPath: "/api/users?role=SYNDIC",
        labelField: "name",
        valueField: "_id",
      },
    },
  ],

  listColumns: [
    {
      key: "name",
      label: "Nom",
    },
    {
      key: "city",
      label: "Ville",
    },
    {
      key: "address",
      label: "Adresse",
    },
    {
      key: "totalApartments",
      label: "Nombre de lots",
      type: "number",
    },
    {
      key: "syndic",
      label: "Syndic",
      type: "relation",
    },
  ],

  cardTitle: (item) => item.name || "Résidence",
  cardSubtitle: (item) => `${item.city || ""} • ${item.totalApartments || 0} lots • ${item.address || ""}`,

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
};

/* ============================================================ */
/* 3. APPARTEMENTS                                              */
/* ============================================================ */
export const apartmentConfig: ResourceConfig<ApartmentDTO> = {
  key: "apartments",
  label: "Appartement",
  plural: "Appartements",
  apiPath: "/api/apartments",
  entityOfflineKey: "apartment",
  searchPlaceholder: "Rechercher par numéro de lot...",
  defaultSort: "floor,number",

  fields: [
    {
      name: "residence",
      label: "Résidence",
      type: "relation",
      required: true,
      relation: {
        resource: "residences",
        apiPath: "/api/residences",
        labelField: "name",
        valueField: "_id",
      },
      helpText: "Le résident sera associé à son appartement plus tard, depuis la création ou la modification du lot.",
    },
    {
      name: "number",
      label: "Numéro de lot / porte",
      type: "text",
      required: true,
      placeholder: "Ex : A101, B204, Lot 12",
    },
    {
      name: "floor",
      label: "Étage",
      type: "number",
      required: true,
      defaultValue: 0,
    },
    {
      name: "surface",
      label: "Surface (m²)",
      type: "number",
      required: true,
      defaultValue: 50,
    },
    {
      name: "shares",
      label: "Tantièmes (parts)",
      type: "number",
      required: true,
      defaultValue: 100,
      helpText: "Quote-part pour la répartition des charges (base légale usuelle : 1 000)",
    },
    {
      name: "isOccupied",
      label: "Lot actuellement occupé",
      type: "boolean",
      defaultValue: true,
    },
    {
      name: "residentUser",
      label: "Résident associé",
      type: "relation",
      clearOnEdit: true,
      relation: {
        resource: "users",
        apiPath: "/api/users?role=RESIDENT&isActive=true&limit=200",
        labelField: "name",
        valueField: "_id",
        dependsOn: "residence",
        queryParam: "residence",
      },
      helpText:
        "Choisissez un compte résident déjà rattaché à cette résidence. Vous pouvez laisser le lot sans résident.",
    },
  ],

  listColumns: [
    {
      key: "number",
      label: "N° Lot",
    },
    {
      key: "residence",
      label: "Résidence",
      type: "relation",
    },
    {
      key: "floor",
      label: "Étage",
      type: "number",
    },
    {
      key: "surface",
      label: "Surface (m²)",
      type: "number",
    },
    {
      key: "shares",
      label: "Tantièmes",
      type: "number",
    },
    {
      key: "isOccupied",
      label: "Occupé",
      type: "boolean",
    },
    {
      key: "residentUser",
      label: "Résident associé",
      type: "relation",
    },
  ],

  cardTitle: (item) => `Lot n° ${item.number}`,
  cardSubtitle: (item) => {
    const resName =
      item.residence && typeof item.residence === "object"
        ? (item.residence as any).name
        : "Copropriété";
    return `${resName} • Étage ${item.floor} • ${item.surface} m² • ${item.shares} tantièmes`;
  },

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
};

/* ============================================================ */
/* 4. RÉSIDENTS                                                 */
/* ============================================================ */
export const residentConfig: ResourceConfig<any> = {
  key: "residents",
  label: "Résident",
  plural: "Résidents",
  apiPath: "/api/residents",
  searchPlaceholder: "Rechercher par nom, email ou téléphone...",
  defaultSort: "fullName",

  fields: [
    {
      name: "residence",
      label: "Résidence",
      type: "relation",
      required: true,
      relation: {
        resource: "residences",
        apiPath: "/api/residences",
        labelField: "name",
        valueField: "_id",
      },
    },
    {
      name: "fullName",
      label: "Nom et prénom",
      type: "text",
      required: true,
      placeholder: "Ex : Jean Dupont",
    },
    {
      name: "type",
      label: "Statut d'occupation",
      type: "select",
      required: true,
      defaultValue: "TENANT",
      options: [
        { label: "Propriétaire", value: "OWNER" },
        { label: "Locataire", value: "TENANT" },
      ],
    },
    {
      name: "email",
      label: "Adresse email",
      type: "text",
      placeholder: "Ex : jean.dupont@email.com",
    },
    {
      name: "phone",
      label: "Téléphone",
      type: "text",
      placeholder: "Ex : 06 12 34 56 78",
    },
    {
      name: "moveInDate",
      label: "Date d'emménagement",
      type: "date",
      required: true,
    },
    {
      name: "isActive",
      label: "Résident actuellement actif",
      type: "boolean",
      defaultValue: true,
    },
  ],

  listColumns: [
    {
      key: "fullName",
      label: "Nom",
    },
    {
      key: "apartment",
      label: "Lot",
      type: "relation",
      render: (val: any) => (val?.number ? `Lot ${val.number}` : "—"),
    },
    {
      key: "residence",
      label: "Résidence",
      type: "relation",
    },
    {
      key: "type",
      label: "Statut",
      render: (val: string) => {
        const labels: Record<string, string> = {
          TENANT: "Locataire",
          OWNER: "Propriétaire",
        };
        return labels[val] || val || "—";
      },
    },
    {
      key: "email",
      label: "Email",
    },
    {
      key: "phone",
      label: "Téléphone",
    },
    {
      key: "isActive",
      label: "Actif",
      type: "boolean",
    },
  ],

  cardTitle: (item) => item.fullName || "Résident",
  cardSubtitle: (item) => {
    const aptNumber =
      item.apartment && typeof item.apartment === "object"
        ? `Lot ${item.apartment.number}`
        : "Appartement";
    return `${aptNumber} • ${item.phone || item.email || item.type || ""}`;
  },

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  filterDefs: [
    {
      key: "type",
      label: "Type",
      type: "select",
      options: [
        { value: "OWNER", label: "Propriétaire" },
        { value: "TENANT", label: "Locataire" },
      ],
    },
    {
      key: "isActive",
      label: "Actif",
      type: "boolean",
    },
  ],
  exportPath: "/api/residents/export",
};

/* ============================================================ */
/* 5. CHARGES                                                   */
/* ============================================================ */
export const chargeConfig: ResourceConfig<ChargeDTO> = {
  key: "charges",
  label: "Charge",
  plural: "Charges",
  apiPath: "/api/charges",
  entityOfflineKey: "charge",
  searchPlaceholder: "Rechercher par période (ex: 2026-10)...",
  defaultSort: "-period",

  fields: [
    {
      name: "apartment",
      label: "Appartement / Lot",
      type: "relation",
      required: true,
      relation: {
        resource: "apartments",
        apiPath: "/api/apartments",
        labelField: "number",
        valueField: "_id",
      },
    },
    {
      name: "period",
      label: "Période (AAAA-MM)",
      type: "text",
      required: true,
      placeholder: "Ex : 2026-10",
    },
    {
      name: "amount",
      label: "Montant appelé (€)",
      type: "number",
      required: true,
      defaultValue: 150,
    },
    {
      name: "dueDate",
      label: "Date d'échéance",
      type: "date",
      required: true,
    },
  ],

  listColumns: [
    {
      key: "apartment",
      label: "Lot",
      type: "relation",
      render: (val: any) => (val?.number ? `Lot ${val.number}` : "—"),
    },
    {
      key: "period",
      label: "Période",
    },
    {
      key: "amount",
      label: "Appelé",
      render: (val: number) => `${(val || 0).toFixed(2)} €`,
    },
    {
      key: "paidAmount",
      label: "Réglé",
      render: (val: number) => `${(val || 0).toFixed(2)} €`,
    },
    {
      key: "status",
      label: "Statut",
      type: "badge",
      render: (val: string) => {
        const labels: Record<string, { text: string; bg: string }> = {
          PAID: { text: "Payé", bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
          PARTIAL: { text: "Partiel", bg: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
          PENDING: { text: "En attente", bg: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400" },
          OVERDUE: { text: "En retard", bg: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" },
        };
        const item = labels[val] || { text: val, bg: "bg-slate-100 text-slate-700" };
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${item.bg}`}>
            {item.text}
          </span>
        );
      },
    },
    {
      key: "dueDate",
      label: "Échéance",
      type: "date",
    },
  ],

  cardTitle: (item) => {
    const aptNumber =
      item.apartment && typeof item.apartment === "object"
        ? (item.apartment as any).number
        : "N/A";
    return `Charge ${item.period} • Lot ${aptNumber}`;
  },
  cardSubtitle: (item) =>
    `${(item.amount || 0).toFixed(2)} € appelés • ${(item.paidAmount || 0).toFixed(2)} € réglés (reste : ${Math.max(
      0,
      (item.amount || 0) - (item.paidAmount || 0)
    ).toFixed(2)} €)`,

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  filterDefs: [
    {
      key: "period",
      label: "Période",
      type: "month",
    },
    {
      key: "status",
      label: "Statut",
      type: "select",
      options: [
        { value: "PENDING", label: "En attente" },
        { value: "PARTIAL", label: "Partiel" },
        { value: "PAID", label: "Payé" },
        { value: "OVERDUE", label: "En retard" },
      ],
    },
  ],
  sortOptions: [
    { value: "dueDate:asc", label: "Échéance proche" },
    { value: "dueDate:desc", label: "Échéance lointaine" },
  ],
  exportPath: "/api/charges/export",
};

/* ============================================================ */
/* 6. PAIEMENTS                                                 */
/* ============================================================ */
export const paymentConfig: ResourceConfig<PaymentDTO> = {
  key: "payments",
  label: "Paiement",
  plural: "Paiements",
  apiPath: "/api/payments",
  entityOfflineKey: "payment",
  searchPlaceholder: "Rechercher par n° de reçu (REC-...)...",
  defaultSort: "-paymentDate",

  fields: [
    {
      name: "charge",
      label: "Charge à régler",
      type: "relation",
      required: true,
      relation: {
        resource: "charges",
        apiPath: "/api/charges",
        labelField: "period",
        valueField: "_id",
      },
    },
    {
      name: "amount",
      label: "Montant encaissé (€)",
      type: "number",
      required: true,
    },
    {
      name: "method",
      label: "Mode de règlement",
      type: "select",
      required: true,
      defaultValue: "BANK_TRANSFER",
      options: [
        { label: "Espèces", value: "CASH" },
        { label: "Virement bancaire", value: "BANK_TRANSFER" },
        { label: "Chèque", value: "CHEQUE" },
        { label: "Carte bancaire", value: "CARD" },
      ],
    },
    {
      name: "paymentDate",
      label: "Date de règlement",
      type: "date",
    },
    {
      name: "receiptNumber",
      label: "Numéro de reçu",
      type: "text",
      placeholder: "Laissez vide pour auto-génération (REC-YYYY-NNNN)",
      helpText: "Auto-généré sous le format REC-YYYY-NNNN si non renseigné",
    },
  ],

  listColumns: [
    {
      key: "receiptNumber",
      label: "N° Reçu",
    },
    {
      key: "amount",
      label: "Montant",
      render: (val: number) => (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {(val || 0).toFixed(2)} €
        </span>
      ),
    },
    {
      key: "method",
      label: "Mode",
      render: (val: string) => {
        const labels: Record<string, string> = {
          BANK_TRANSFER: "Virement",
          CHEQUE: "Chèque",
          CASH: "Espèces",
          CARD: "Carte",
        };
        return labels[val] || val || "—";
      },
    },
    {
      key: "paymentDate",
      label: "Date",
      type: "date",
    },
  ],

  cardTitle: (item) => item.receiptNumber || "Paiement",
  cardSubtitle: (item) =>
    `${(item.amount || 0).toFixed(2)} € réglés par ${item.method} le ${new Date(
      item.paymentDate
    ).toLocaleDateString("fr-FR")}`,

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  filterDefs: [
    {
      key: "method",
      label: "Mode",
      type: "select",
      options: [
        { value: "CASH", label: "Espèces" },
        { value: "BANK_TRANSFER", label: "Virement" },
        { value: "CHEQUE", label: "Chèque" },
        { value: "CARD", label: "Carte" },
      ],
    },
    {
      key: "dates",
      label: "Période de paiement",
      type: "dateRange",
    },
  ],
  sortOptions: [
    { value: "paymentDate:desc", label: "Plus récents" },
    { value: "paymentDate:asc", label: "Plus anciens" },
  ],
  exportPath: "/api/payments/export",
  rowLinks: [
    {
      label: "Reçu PDF",
      href: (item) => `/api/payments/${item._id}/receipt`,
      roles: ["ADMIN", "SYNDIC", "RESIDENT"],
    },
  ],
};

/* ============================================================ */
/* 7. DÉPENSES                                                  */
/* ============================================================ */
export const expenseConfig: ResourceConfig<ExpenseDTO> = {
  key: "expenses",
  label: "Dépense",
  plural: "Dépenses",
  apiPath: "/api/expenses",
  searchPlaceholder: "Rechercher par description ou libellé...",
  defaultSort: "-expenseDate",

  fields: [
    {
      name: "residence",
      label: "Résidence",
      type: "relation",
      required: true,
      relation: {
        resource: "residences",
        apiPath: "/api/residences",
        labelField: "name",
        valueField: "_id",
      },
    },
    {
      name: "category",
      label: "Catégorie",
      type: "select",
      required: true,
      defaultValue: "MAINTENANCE",
      options: [
        { label: "Eau", value: "WATER" },
        { label: "Électricité", value: "ELECTRICITY" },
        { label: "Ascenseur", value: "ELEVATOR" },
        { label: "Nettoyage", value: "CLEANING" },
        { label: "Sécurité", value: "SECURITY" },
        { label: "Entretien / Maintenance", value: "MAINTENANCE" },
        { label: "Autre", value: "OTHER" },
      ],
    },
    {
      name: "description",
      label: "Libellé de la dépense",
      type: "text",
      required: true,
      placeholder: "Ex : Réparation ascenseur, Facture EDF parties communes...",
    },
    {
      name: "amount",
      label: "Montant TTC (€)",
      type: "number",
      required: true,
      defaultValue: 0,
    },
    {
      name: "expenseDate",
      label: "Date de la facture",
      type: "date",
      required: true,
    },
    {
      name: "proofUrl",
      label: "Lien justificatif (URL)",
      type: "text",
      placeholder: "https://...",
    },
  ],

  listColumns: [
    {
      key: "description",
      label: "Description",
    },
    {
      key: "residence",
      label: "Résidence",
      type: "relation",
    },
    {
      key: "category",
      label: "Catégorie",
    },
    {
      key: "amount",
      label: "Montant",
      render: (val: number) => (
        <span className="font-semibold text-rose-600 dark:text-rose-400">
          {(val || 0).toFixed(2)} €
        </span>
      ),
    },
    {
      key: "expenseDate",
      label: "Date",
      type: "date",
    },
  ],

  cardTitle: (item) => item.description || "Dépense",
  cardSubtitle: (item) =>
    `${(item.amount || 0).toFixed(2)} € • ${item.category} • ${new Date(
      item.expenseDate
    ).toLocaleDateString("fr-FR")}`,

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  filterDefs: [
    {
      key: "category",
      label: "Catégorie",
      type: "select",
      options: [
        { value: "WATER", label: "Eau" },
        { value: "ELECTRICITY", label: "Électricité" },
        { value: "ELEVATOR", label: "Ascenseur" },
        { value: "CLEANING", label: "Nettoyage" },
        { value: "SECURITY", label: "Sécurité" },
        { value: "MAINTENANCE", label: "Maintenance" },
        { value: "OTHER", label: "Autre" },
      ],
    },
    {
      key: "dates",
      label: "Période",
      type: "dateRange",
    },
  ],
  sortOptions: [
    { value: "expenseDate:desc", label: "Plus récentes" },
    { value: "expenseDate:asc", label: "Plus anciennes" },
  ],
  exportPath: "/api/expenses/export",
};

/* ============================================================ */
/* 8. INCIDENTS                                                 */
/* ============================================================ */
export const incidentConfig: ResourceConfig<IncidentDTO> = {
  key: "incidents",
  label: "Incident",
  plural: "Incidents",
  apiPath: "/api/incidents",
  entityOfflineKey: "incident",
  searchPlaceholder: "Rechercher par titre ou description...",
  defaultSort: "-reportedAt",

  fields: [
    {
      name: "residence",
      label: "Résidence concernée",
      type: "relation",
      required: true,
      relation: {
        resource: "residences",
        apiPath: "/api/residences",
        labelField: "name",
        valueField: "_id",
      },
    },
    {
      name: "apartment",
      label: "Appartement / Lot (facultatif)",
      type: "relation",
      relation: {
        resource: "apartments",
        apiPath: "/api/apartments",
        labelField: "number",
        valueField: "_id",
      },
    },
    {
      name: "title",
      label: "Titre de l'incident",
      type: "text",
      required: true,
      placeholder: "Ex : Fuite d'eau cage d'escalier B",
    },
    {
      name: "category",
      label: "Catégorie",
      type: "select",
      required: true,
      defaultValue: "PLUMBING",
      options: [
        { label: "Plomberie", value: "PLUMBING" },
        { label: "Électricité", value: "ELECTRICITY" },
        { label: "Ascenseur", value: "ELEVATOR" },
        { label: "Nettoyage", value: "CLEANING" },
        { label: "Sécurité", value: "SECURITY" },
        { label: "Autre", value: "OTHER" },
      ],
    },
    {
      name: "priority",
      label: "Priorité",
      type: "select",
      required: true,
      defaultValue: "MEDIUM",
      options: [
        { label: "Basse", value: "LOW" },
        { label: "Moyenne", value: "MEDIUM" },
        { label: "Haute", value: "HIGH" },
        { label: "Urgente", value: "URGENT" },
      ],
    },
    {
      name: "description",
      label: "Description détaillée",
      type: "textarea",
      required: true,
      placeholder: "Décrivez précisément le lieu et les constatations...",
    },
  ],

  listColumns: [
    {
      key: "title",
      label: "Incident",
    },
    {
      key: "residence",
      label: "Résidence",
      type: "relation",
    },
    {
      key: "category",
      label: "Catégorie",
    },
    {
      key: "priority",
      label: "Priorité",
      type: "badge",
    },
    {
      key: "status",
      label: "Statut",
      type: "badge",
      render: (val: string) => {
        const labels: Record<string, { text: string; bg: string }> = {
          REPORTED: { text: "Signalé", bg: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400" },
          ASSIGNED: { text: "Assigné", bg: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
          IN_PROGRESS: { text: "En cours", bg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400" },
          RESOLVED: { text: "Résolu", bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
        };
        const item = labels[val] || { text: val, bg: "bg-slate-100 text-slate-700" };
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${item.bg}`}>
            {item.text}
          </span>
        );
      },
    },
    {
      key: "reportedAt",
      label: "Signalé le",
      type: "date",
    },
  ],

  cardTitle: (item) => item.title || "Incident",
  cardSubtitle: (item) =>
    `${item.category} • ${item.priority} • ${item.description}`,

  canCreate: () => true, // Tous les rôles peuvent créer
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  filterDefs: [
    {
      key: "status",
      label: "Statut",
      type: "select",
      options: [
        { value: "REPORTED", label: "Signalé" },
        { value: "ASSIGNED", label: "Assigné" },
        { value: "IN_PROGRESS", label: "En cours" },
        { value: "RESOLVED", label: "Résolu" },
      ],
    },
    {
      key: "priority",
      label: "Priorité",
      type: "select",
      options: [
        { value: "LOW", label: "Basse" },
        { value: "MEDIUM", label: "Moyenne" },
        { value: "HIGH", label: "Haute" },
        { value: "URGENT", label: "Urgente" },
      ],
    },
    {
      key: "category",
      label: "Catégorie",
      type: "select",
      options: [
        { value: "PLUMBING", label: "Plomberie" },
        { value: "ELECTRICITY", label: "Électricité" },
        { value: "ELEVATOR", label: "Ascenseur" },
        { value: "CLEANING", label: "Nettoyage" },
        { value: "SECURITY", label: "Sécurité" },
        { value: "OTHER", label: "Autre" },
      ],
    },
  ],
  sortOptions: [
    { value: "reportedAt:desc", label: "Plus récents" },
    { value: "reportedAt:asc", label: "Plus anciens" },
  ],
};

/* ============================================================ */
/* 9. ASSEMBLÉES GÉNÉRALES (MEETINGS)                         */
/* ============================================================ */
export const meetingConfig: ResourceConfig<MeetingDTO> = {
  key: "meetings",
  label: "Assemblée Générale",
  plural: "Assemblées Générales",
  apiPath: "/api/meetings",
  searchPlaceholder: "Rechercher par titre ou lieu...",
  defaultSort: "-date",

  fields: [
    {
      name: "residence",
      label: "Résidence",
      type: "relation",
      required: true,
      relation: {
        resource: "residences",
        apiPath: "/api/residences",
        labelField: "name",
        valueField: "_id",
      },
    },
    {
      name: "title",
      label: "Titre de l'AG",
      type: "text",
      required: true,
      placeholder: "Ex : AG Ordinaire 2026",
    },
    {
      name: "date",
      label: "Date et heure",
      type: "date",
      required: true,
    },
    {
      name: "location",
      label: "Lieu",
      type: "text",
      placeholder: "Ex : Salle commune ou visioconférence",
    },
    {
      name: "status",
      label: "Statut",
      type: "select",
      required: true,
      defaultValue: "PLANNED",
      options: [
        { label: "Planifiée", value: "PLANNED" },
        { label: "Ouverte (Votes autorisés)", value: "OPEN" },
        { label: "Clôturée", value: "CLOSED" },
      ],
    },
    {
      name: "agenda",
      label: "Ordre du jour",
      type: "textarea",
      placeholder: "Détaillez les points à l'ordre du jour...",
    },
  ],

  listColumns: [
    {
      key: "title",
      label: "Titre",
    },
    {
      key: "residence",
      label: "Résidence",
      type: "relation",
    },
    {
      key: "date",
      label: "Date",
      type: "date",
    },
    {
      key: "status",
      label: "Statut",
      type: "badge",
      render: (val: string) => {
        const badges: Record<string, { text: string; bg: string }> = {
          PLANNED: { text: "Planifiée", bg: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
          OPEN: { text: "Ouverte aux votes", bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
          CLOSED: { text: "Clôturée", bg: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" },
        };
        const item = badges[val] || { text: val, bg: "bg-slate-100 text-slate-700" };
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${item.bg}`}>
            {item.text}
          </span>
        );
      },
    },
    {
      key: "location",
      label: "Lieu",
    },
  ],

  cardTitle: (item) => item.title || "Assemblée Générale",
  cardSubtitle: (item) =>
    `${item.status} • ${new Date(item.date).toLocaleDateString("fr-FR")} • ${item.location || "Lieu non précisé"}`,

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
};

/* ============================================================ */
/* 10. RÉSOLUTIONS                                              */
/* ============================================================ */
export const resolutionConfig: ResourceConfig<ResolutionDTO> = {
  key: "resolutions",
  label: "Résolution",
  plural: "Résolutions",
  apiPath: "/api/resolutions",
  searchPlaceholder: "Rechercher une résolution...",
  defaultSort: "-createdAt",

  fields: [
    {
      name: "meeting",
      label: "Assemblée Générale",
      type: "relation",
      required: true,
      relation: {
        resource: "meetings",
        apiPath: "/api/meetings",
        labelField: "title",
        valueField: "_id",
      },
    },
    {
      name: "title",
      label: "Titre de la résolution",
      type: "text",
      required: true,
      placeholder: "Ex : Approbation des comptes de l'exercice 2025",
    },
    {
      name: "requiredMajority",
      label: "Majorité requise (%)",
      type: "number",
      required: true,
      defaultValue: 50,
      min: 0,
      max: 100,
    },
    {
      name: "description",
      label: "Description détaillée",
      type: "textarea",
      placeholder: "Texte complet soumis au vote des copropriétaires...",
    },
  ],

  listColumns: [
    {
      key: "title",
      label: "Titre",
    },
    {
      key: "meeting",
      label: "Assemblée",
      type: "relation",
      render: (m: any) => m?.title || "—",
    },
    {
      key: "requiredMajority",
      label: "Majorité",
      render: (val: number) => (
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {val ?? 50} %
        </span>
      ),
    },
  ],

  cardTitle: (item) => item.title || "Résolution",
  cardSubtitle: (item) =>
    `Majorité ${item.requiredMajority}% • ${item.description || "Aucune description"}`,

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
};

/* ============================================================ */
/* 11. VOTES                                                    */
/* ============================================================ */
export const voteConfig: ResourceConfig<VoteDTO> = {
  key: "votes",
  label: "Vote",
  plural: "Votes",
  apiPath: "/api/votes",
  searchPlaceholder: "Rechercher par choix...",
  defaultSort: "-votedAt",

  fields: [
    {
      name: "resolution",
      label: "Résolution",
      type: "relation",
      required: true,
      relation: {
        resource: "resolutions",
        apiPath: "/api/resolutions",
        labelField: "title",
        valueField: "_id",
      },
    },
    {
      name: "apartment",
      label: "Lot votant",
      type: "relation",
      required: true,
      relation: {
        resource: "apartments",
        apiPath: "/api/apartments",
        labelField: "number",
        valueField: "_id",
      },
    },
    {
      name: "choice",
      label: "Choix du vote",
      type: "select",
      required: true,
      options: [
        { label: "POUR (FOR)", value: "FOR" },
        { label: "CONTRE (AGAINST)", value: "AGAINST" },
        { label: "ABSTENTION (ABSTAIN)", value: "ABSTAIN" },
      ],
    },
  ],

  listColumns: [
    {
      key: "resolution",
      label: "Résolution",
      type: "relation",
      render: (r: any) => r?.title || "—",
    },
    {
      key: "apartment",
      label: "Lot",
      type: "relation",
      render: (a: any) => (a?.number ? `Lot ${a.number}` : "—"),
    },
    {
      key: "choice",
      label: "Vote",
      render: (val: string) => {
        const styles: Record<string, { label: string; cls: string }> = {
          FOR: { label: "POUR", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
          AGAINST: { label: "CONTRE", cls: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" },
          ABSTAIN: { label: "ABSTENTION", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
        };
        const s = styles[val] || { label: val, cls: "bg-slate-100 text-slate-700" };
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${s.cls}`}>
            {s.label}
          </span>
        );
      },
    },
    {
      key: "weight",
      label: "Tantièmes",
      render: (val: number) => <span className="font-semibold">{val} / 1000</span>,
    },
    {
      key: "votedAt",
      label: "Date",
      type: "date",
    },
  ],

  cardTitle: (item) => `Vote : ${item.choice}`,
  cardSubtitle: (item) => `Poids : ${item.weight} tantièmes`,

  canCreate: () => true, // Tous les rôles votants
  canEdit: (_item, role) => role === Role.ADMIN,
  canDelete: (_item, role) => role === Role.ADMIN,
};

/* ============================================================ */
/* 12. DOCUMENTS                                                */
/* ============================================================ */
export const documentConfig: ResourceConfig<DocumentDTO> = {
  key: "documents",
  label: "Document",
  plural: "Documents",
  apiPath: "/api/documents",
  searchPlaceholder: "Rechercher par titre...",
  defaultSort: "-uploadedAt",

  fields: [
    {
      name: "residence",
      label: "Résidence",
      type: "relation",
      required: true,
      relation: {
        resource: "residences",
        apiPath: "/api/residences",
        labelField: "name",
        valueField: "_id",
      },
    },
    {
      name: "meeting",
      label: "Assemblée Générale liée (facultatif)",
      type: "relation",
      relation: {
        resource: "meetings",
        apiPath: "/api/meetings",
        labelField: "title",
        valueField: "_id",
      },
    },
    {
      name: "title",
      label: "Nom du document",
      type: "text",
      required: true,
      placeholder: "Ex : Procès-Verbal AG 2026, Règlement de copropriété",
    },
    {
      name: "type",
      label: "Type de document",
      type: "select",
      required: true,
      defaultValue: "OTHER",
      options: [
        { label: "Procès-verbal d'assemblée", value: "MINUTES" },
        { label: "Règlement de copropriété", value: "RULES" },
        { label: "Contrat", value: "CONTRACT" },
        { label: "Facture", value: "INVOICE" },
        { label: "Autre", value: "OTHER" },
      ],
    },
    {
      name: "fileUrl",
      label: "URL du fichier",
      type: "text",
      required: true,
      placeholder: "/uploads/... ou URL",
    },
  ],

  listColumns: [
    {
      key: "title",
      label: "Titre",
    },
    {
      key: "residence",
      label: "Résidence",
      type: "relation",
    },
    {
      key: "type",
      label: "Catégorie",
    },
    {
      key: "fileUrl",
      label: "Fichier",
      render: (val: string) => (
        <a
          href={val}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-600 underline hover:text-sky-700 dark:text-sky-400"
        >
          Ouvrir le fichier
        </a>
      ),
    },
    {
      key: "uploadedAt",
      label: "Déposé le",
      type: "date",
    },
  ],

  cardTitle: (item) => item.title || "Document",
  cardSubtitle: (item) => `${item.type} • Déposé le ${new Date(item.uploadedAt).toLocaleDateString("fr-FR")}`,

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
};

/* ============================================================ */
/* 13. UTILISATEURS (USERS)                                     */
/* ============================================================ */
export const userConfig: ResourceConfig<UserDTO> = {
  key: "users",
  label: "Utilisateur",
  plural: "Utilisateurs",
  apiPath: "/api/users",
  searchPlaceholder: "Rechercher par nom ou email...",
  defaultSort: "-createdAt",

  fields: [
    {
      name: "name",
      label: "Nom complet",
      type: "text",
      required: true,
      placeholder: "Ex : Jean Dupont",
    },
    {
      name: "email",
      label: "Adresse email",
      type: "text",
      required: true,
      placeholder: "jean.dupont@example.com",
    },
    {
      name: "password",
      label: "Mot de passe (création)",
      type: "text",
      placeholder: "Minimum 6 caractères",
    },
    {
      name: "phone",
      label: "Téléphone",
      type: "text",
      placeholder: "+33 6 12 34 56 78",
    },
    {
      name: "role",
      label: "Rôle dans SyndicPro",
      type: "select",
      required: true,
      defaultValue: "RESIDENT",
      options: [
        { label: "Résident / Copropriétaire", value: "RESIDENT" },
        { label: "Technicien d'intervention", value: "TECHNICIAN" },
        { label: "Syndic gestionnaire", value: "SYNDIC" },
        { label: "Administrateur système", value: "ADMIN" },
      ],
    },
    {
      name: "residence",
      label: "Résidence du résident",
      type: "relation",
      clearOnEdit: true,
      relation: {
        resource: "residences",
        apiPath: "/api/residences",
        labelField: "name",
        valueField: "_id",
      },
      helpText: "À renseigner pour autoriser ce compte résident à accéder à cette résidence.",
    },
    {
      name: "isActive",
      label: "Compte actif",
      type: "boolean",
      defaultValue: true,
    },
  ],

  listColumns: [
    {
      key: "name",
      label: "Nom",
    },
    {
      key: "email",
      label: "Email",
    },
    {
      key: "role",
      label: "Rôle",
      type: "badge",
      render: (val: string) => {
        const badges: Record<string, { label: string; cls: string }> = {
          ADMIN: { label: "Admin", cls: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" },
          SYNDIC: { label: "Syndic", cls: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400" },
          TECHNICIAN: { label: "Technicien", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
          RESIDENT: { label: "Résident", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
        };
        const b = badges[val] || { label: val, cls: "bg-slate-100 text-slate-700" };
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${b.cls}`}>
            {b.label}
          </span>
        );
      },
    },
    {
      key: "residence",
      label: "Résidence",
      type: "relation",
      render: (val: any) => val?.name || "—",
    },
    {
      key: "phone",
      label: "Téléphone",
    },
    {
      key: "isActive",
      label: "Statut",
      type: "boolean",
      render: (val: boolean) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
            val !== false
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {val !== false ? "Actif" : "Désactivé"}
        </span>
      ),
    },
  ],

  cardTitle: (item) => item.name || "Utilisateur",
  cardSubtitle: (item) => `${item.role} • ${item.email} • ${item.isActive !== false ? "Actif" : "Désactivé"}`,

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN,
};

export const resourcesRegistry = {
  announcements: announcementConfig,
  residences: residenceConfig,
  apartments: apartmentConfig,
  residents: residentConfig,
  charges: chargeConfig,
  payments: paymentConfig,
  expenses: expenseConfig,
  incidents: incidentConfig,
  meetings: meetingConfig,
  resolutions: resolutionConfig,
  votes: voteConfig,
  documents: documentConfig,
  users: userConfig,
};
````

### `lib/resources/types.ts`

````ts
import React from "react";

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "textarea"
  | "relation"
  | "boolean";

export interface FieldOption {
  label: string;
  value: string | number | boolean;
}

export interface RelationConfig {
  resource: string; // Ex: "residences", "apartments", "users"
  apiPath?: string; // Ex: "/api/residences" (par défaut `/api/${resource}`)
  labelField: string; // Champ affiché, ex: "name" ou "title"
  valueField?: string; // Champ clé, ex: "_id" (par défaut "_id")
  dependsOn?: string;
  queryParam?: string;
}

export interface ResourceField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  defaultValue?: any;
  placeholder?: string;
  options?: FieldOption[];
  relation?: RelationConfig;
  readOnly?: boolean;
  clearOnEdit?: boolean;
  helpText?: string;
  min?: number;
  max?: number;
}

export interface ListColumn<T = any> {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "badge" | "boolean" | "relation";
  render?: (value: any, item: T) => React.ReactNode;
}

export interface BadgeFieldConfig {
  name: string;
  variantMap?: Record<
    string,
    {
      label: string;
      color?: "default" | "success" | "warning" | "danger" | "info";
      className?: string;
    }
  >;
}

export interface FilterDef {
  key: string; // nom du paramètre de requête (ex "status")
  label: string; // libellé français
  type: "select" | "boolean" | "month" | "dateRange";
  options?: { value: string; label: string }[]; // pour "select"
}
// "boolean" : valeurs "true" / "false". "month" : valeur "YYYY-MM".
// "dateRange" : utilise les deux clés fixes "from" et "to" (YYYY-MM-DD) ; key sert d'identifiant.

export interface SortOption {
  value: string;
  label: string;
} // value = "champ:asc" ou "champ:desc"

export interface RowLink {
  label: string;
  href: (item: any) => string;
  roles?: string[]; // rôles autorisés ; absent = tous
}

export interface ResourceConfig<T = any> {
  key: string;
  label: string;
  plural: string;
  apiPath: string;
  entityOfflineKey?: "announcement" | "incident" | "payment" | "charge" | "residence" | "apartment";

  fields: ResourceField[];
  listColumns: ListColumn<T>[];
  cardTitle: (item: T) => string;
  cardSubtitle: (item: T) => string;
  badgeField?: BadgeFieldConfig;
  searchPlaceholder?: string;
  defaultSort?: string;
  canCreate?: (userRole?: string) => boolean;
  canEdit?: (item: T, userRole?: string) => boolean;
  canDelete?: (item: T, userRole?: string) => boolean;
  filterDefs?: FilterDef[];
  sortOptions?: SortOption[];
  exportPath?: string; // ex "/api/payments/export"
  rowLinks?: RowLink[];
}
````

### `components/crud/ResourcePage.tsx`

````tsx
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
````

### `components/crud/ResourceForm.tsx`

````tsx
"use client";

import React, { useState, useEffect } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import type { ResourceField, RelationConfig } from "@/lib/resources/types";

export interface ResourceFormProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  fields: ResourceField[];
  title: string;
  description?: string;
  initialData?: Partial<T> | null;
  loading?: boolean;
  onSubmit: (values: Record<string, any>) => Promise<void>;
}

export function ResourceForm<T = any>({
  isOpen,
  onClose,
  fields,
  title,
  description,
  initialData,
  loading = false,
  onSubmit,
}: ResourceFormProps<T>) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [relationOptions, setRelationOptions] = useState<
    Record<string, Array<{ label: string; value: string }>>
  >({});
  const [loadingRelations, setLoadingRelations] = useState(false);
  const relationDependencyKey = JSON.stringify(
    fields
      .filter((field) => field.type === "relation" && field.relation?.dependsOn)
      .map((field) => [
        field.name,
        field.relation?.dependsOn,
        String(values[field.relation?.dependsOn ?? ""] ?? ""),
      ])
  );

  // Initialisation des valeurs du formulaire
  useEffect(() => {
    if (!isOpen) return;

    const initial: Record<string, any> = {};
    fields.forEach((f) => {
      if (initialData && initialData[f.name as keyof T] !== undefined) {
        let val: any = initialData[f.name as keyof T];
        // Si le champ est un objet relation peuplé (ex: author: { _id, name }), on prend l'_id
        if (val && typeof val === "object" && "_id" in val) {
          val = val._id;
        }
        if (f.type === "date" && val) {
          try {
            val = new Date(val).toISOString().split("T")[0];
          } catch {
            // garder la valeur
          }
        }
        initial[f.name] = val;
      } else if (f.defaultValue !== undefined) {
        initial[f.name] = f.defaultValue;
      } else if (f.type === "date") {
        initial[f.name] = new Date().toISOString().split("T")[0];
      } else if (f.type === "boolean") {
        initial[f.name] = false;
      } else {
        initial[f.name] = "";
      }

    });

    setValues(initial);
    setErrors({});
  }, [isOpen, fields, initialData]);

  // Chargement asynchrone des options pour les champs de type "relation"
  useEffect(() => {
    if (!isOpen) return;

    const relationFields = fields.filter((f) => f.type === "relation" && f.relation);
    if (relationFields.length === 0) return;

    let isMounted = true;
    async function loadRelations() {
      setLoadingRelations(true);
      const optionsMap: Record<string, Array<{ label: string; value: string }>> = {};
      const dependencies = new Map<string, string>(
        (JSON.parse(relationDependencyKey) as Array<[string, string, string]>).map(
          ([fieldName, , value]) => [fieldName, value]
        )
      );

      await Promise.all(
        relationFields.map(async (field) => {
          const rel = field.relation as RelationConfig;
          const dependencyValue = rel.dependsOn ? dependencies.get(field.name) : undefined;
          if (rel.dependsOn && !dependencyValue) {
            optionsMap[field.name] = [];
            return;
          }
          const endpointUrl = new URL(
            rel.apiPath || `/api/${rel.resource}`,
            window.location.origin
          );
          if (rel.queryParam && dependencyValue) {
            endpointUrl.searchParams.set(rel.queryParam, dependencyValue);
          }
          try {
            const res = await fetchWithOffline<any>(
              `${endpointUrl.pathname}${endpointUrl.search}`
            );
            const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
            const valueKey = rel.valueField || "_id";

            optionsMap[field.name] = items.map((item: any) => ({
              label: String(item[rel.labelField] || item.name || item.title || item._id),
              value: String(item[valueKey] || item._id),
            }));
          } catch (err) {
            console.warn(`[ResourceForm] Erreur chargement relation ${field.name}:`, err);
            optionsMap[field.name] = [];
          }
        })
      );

      if (isMounted) {
        setRelationOptions(optionsMap);
        setLoadingRelations(false);
      }
    }

    loadRelations();

    return () => {
      isMounted = false;
    };
  }, [isOpen, fields, relationDependencyKey]);

  const handleChange = (name: string, val: any) => {
    setValues((prev) => ({ ...prev, [name]: val }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    fields.forEach((f) => {
      const val = values[f.name];
      if (f.required) {
        if (val === undefined || val === null || val === "") {
          newErrors[f.name] = `Le champ "${f.label}" est obligatoire`;
        }
      }
      if (f.type === "number" && val !== "" && val !== undefined) {
        if (isNaN(Number(val))) {
          newErrors[f.name] = `Veuillez saisir un nombre valide`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Nettoyage et typage avant soumission
    const cleaned: Record<string, any> = {};
    fields.forEach((f) => {
      const val = values[f.name];
      if (f.type === "number") {
        cleaned[f.name] = val === "" || val === undefined ? undefined : Number(val);
      } else if (f.type === "boolean") {
        cleaned[f.name] = Boolean(val);
      } else if (f.type === "date") {
        if (!val) {
          cleaned[f.name] = f.required ? "" : undefined;
        } else {
          cleaned[f.name] = new Date(val).toISOString();
        }
      } else if (f.type === "relation" || f.type === "select") {
        cleaned[f.name] =
          val === ""
            ? f.type === "relation" && f.clearOnEdit && initialData
              ? null
              : undefined
            : val;
      } else if (f.type === "text" || f.type === "textarea") {
        cleaned[f.name] = val === "" && !f.required ? undefined : val;
      } else {
        cleaned[f.name] = val;
      }
    });

    await onSubmit(cleaned);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title} description={description}>
      <form onSubmit={handleSubmit} className="space-y-4 pt-2 pb-4">
        {fields.map((field) => {
          const errorMsg = errors[field.name];
          const val = values[field.name] ?? "";

          // 1. SELECT CLASSIQUE
          if (field.type === "select") {
            const rawOpts = (field.options || []).map((o) => ({
              label: o.label,
              value: String(o.value),
            }));
            const opts =
              !field.required && field.defaultValue === undefined
                ? [{ value: "", label: "— Aucun —" }, ...rawOpts]
                : rawOpts;
            return (
              <Select
                key={field.name}
                id={`field-${field.name}`}
                label={field.label}
                required={field.required}
                options={opts}
                value={String(val)}
                onChange={(e) => handleChange(field.name, e.target.value)}
                error={errorMsg}
                disabled={loading || field.readOnly}
              />
            );
          }

          // 2. RELATION DYNAMIQUE
          if (field.type === "relation") {
            const rawOpts = relationOptions[field.name] || [];
            const opts = [
              { value: "", label: field.required ? "— Sélectionner —" : "— Aucun —" },
              ...rawOpts,
            ];
            return (
              <div key={field.name} className="space-y-1">
                <Select
                  id={`field-${field.name}`}
                  label={field.label}
                  required={field.required}
                  options={opts}
                  value={String(val)}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  error={errorMsg}
                  disabled={loading || loadingRelations || field.readOnly}
                />
                {loadingRelations && (
                  <p className="text-[11px] text-slate-400">Chargement des options...</p>
                )}
              </div>
            );
          }

          // 3. TEXTAREA
          if (field.type === "textarea") {
            return (
              <div key={field.name} className="space-y-1.5">
                <label
                  htmlFor={`field-${field.name}`}
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {field.label} {field.required && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  id={`field-${field.name}`}
                  rows={4}
                  value={String(val)}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  disabled={loading || field.readOnly}
                  className={`w-full rounded-2xl border bg-white p-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 sm:text-sm dark:bg-slate-900 dark:text-white ${
                    errorMsg
                      ? "border-rose-500 focus:ring-rose-500/20"
                      : "border-slate-200 focus:border-sky-500 focus:ring-sky-500/20 dark:border-slate-800"
                  }`}
                />
                {errorMsg && <p className="text-xs text-rose-500">{errorMsg}</p>}
                {field.helpText && !errorMsg && (
                  <p className="text-[11px] text-slate-400">{field.helpText}</p>
                )}
              </div>
            );
          }

          // 4. BOOLEAN (SWITCH / CHECKBOX)
          if (field.type === "boolean") {
            return (
              <div
                key={field.name}
                className="flex min-h-[44px] items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40"
              >
                <div>
                  <label
                    htmlFor={`field-${field.name}`}
                    className="text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    {field.label}
                  </label>
                  {field.helpText && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{field.helpText}</p>
                  )}
                </div>
                <input
                  type="checkbox"
                  id={`field-${field.name}`}
                  checked={Boolean(val)}
                  onChange={(e) => handleChange(field.name, e.target.checked)}
                  disabled={loading || field.readOnly}
                  className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700"
                />
              </div>
            );
          }

          // 5. INPUT STANDARD (text, number, date)
          return (
            <Input
              key={field.name}
              id={`field-${field.name}`}
              label={field.label}
              type={field.type}
              required={field.required}
              placeholder={field.placeholder}
              value={val}
              onChange={(e) => handleChange(field.name, e.target.value)}
              error={errorMsg}
              disabled={loading || field.readOnly}
              helperText={field.helpText}
            />
          );
        })}

        {/* Boutons d'action tactiles */}
        <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="min-h-[44px] w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={loading}
            className="min-h-[44px] w-full sm:w-auto"
          >
            Enregistrer
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
````

### `components/crud/ResourceList.tsx`

````tsx
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
````

### `components/crud/FilterBar.tsx`

````tsx
"use client";

import React, { useState } from "react";
import { Search, Plus, X, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/Button";

type FilterDef = {
  key: string;
  label: string;
  type: "select" | "boolean" | "month" | "dateRange";
  options?: { value: string; label: string }[];
};

type SortOption = {
  value: string;
  label: string;
};

export interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  canCreate?: boolean;
  createLabel?: string;
  onCreateClick?: () => void;
  children?: React.ReactNode;
  defs?: FilterDef[];
  values?: Record<string, string>;
  onValuesChange?: (v: Record<string, string>) => void;
  sortOptions?: SortOption[];
  sort?: string;
  onSortChange?: (s: string) => void;
}

// Met à jour une clé dans un objet de valeurs en supprimant les clés vides
function updateValueMap(
  current: Record<string, string>,
  key: string,
  val: string
): Record<string, string> {
  const next = { ...current };
  if (!val || val.trim() === "") {
    delete next[key];
  } else {
    next[key] = val;
  }
  return next;
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Rechercher...",
  canCreate = false,
  createLabel = "Nouveau",
  onCreateClick,
  children,
  defs,
  values = {},
  onValuesChange,
  sortOptions,
  sort = "",
  onSortChange,
}: FilterBarProps) {
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [draftSort, setDraftSort] = useState<string>("");

  const hasDefs = Array.isArray(defs) && defs.length > 0;
  const hasSortOptions = Array.isArray(sortOptions) && sortOptions.length > 0;

  // Construction des puces (chips) de filtres actifs
  const activeChips: { key: string; label: string; displayValue: string }[] = [];
  if (hasDefs && defs) {
    for (const def of defs) {
      if (def.type === "dateRange") {
        if (values.from) {
          activeChips.push({
            key: "from",
            label: `${def.label} (du)`,
            displayValue: values.from,
          });
        }
        if (values.to) {
          activeChips.push({
            key: "to",
            label: `${def.label} (au)`,
            displayValue: values.to,
          });
        }
      } else {
        const rawVal = values[def.key];
        if (rawVal !== undefined && rawVal !== "") {
          let displayValue = rawVal;
          if (def.type === "boolean") {
            displayValue = rawVal === "true" ? "Oui" : "Non";
          } else if (def.type === "select" && def.options) {
            const found = def.options.find((o) => o.value === rawVal);
            if (found) displayValue = found.label;
          }
          activeChips.push({
            key: def.key,
            label: def.label,
            displayValue,
          });
        }
      }
    }
  }

  const activeCount = activeChips.length;

  // Ouverture du panneau mobile avec copie de l'état courant
  const openMobileSheet = () => {
    setDraftValues({ ...values });
    setDraftSort(sort || "");
    setIsMobileSheetOpen(true);
  };

  // Application des filtres du panneau mobile
  const applyMobileSheet = () => {
    onValuesChange?.(draftValues);
    if (hasSortOptions && onSortChange) {
      onSortChange(draftSort);
    }
    setIsMobileSheetOpen(false);
  };

  // Réinitialisation dans le panneau mobile
  const resetMobileSheet = () => {
    setDraftValues({});
    if (hasSortOptions && sortOptions?.[0]) {
      setDraftSort(sortOptions[0].value);
    } else {
      setDraftSort("");
    }
  };

  // Suppression d'un filtre actif via sa puce
  const handleRemoveChip = (chipKey: string) => {
    if (!onValuesChange) return;
    onValuesChange(updateValueMap(values, chipKey, ""));
  };

  // Effacement de tous les filtres actifs
  const handleClearAll = () => {
    onValuesChange?.({});
  };

  const controlClassName =
    "min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-800 dark:bg-slate-900/60 dark:text-white";

  // Rendu d'un contrôle de filtre unitaire (utilisé en desktop et en mobile)
  const renderFilterControl = (
    def: FilterDef,
    currentValues: Record<string, string>,
    onChangeMap: (next: Record<string, string>) => void,
    fullWidth = false
  ) => {
    const widthClass = fullWidth ? "w-full" : "w-auto";

    if (def.type === "select") {
      return (
        <div key={def.key} className={`flex flex-col gap-1 ${widthClass}`}>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {def.label}
          </label>
          <select
            aria-label={def.label}
            value={currentValues[def.key] || ""}
            onChange={(e) =>
              onChangeMap(updateValueMap(currentValues, def.key, e.target.value))
            }
            className={`${controlClassName} ${widthClass}`}
          >
            <option value="">Tous</option>
            {def.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (def.type === "boolean") {
      return (
        <div key={def.key} className={`flex flex-col gap-1 ${widthClass}`}>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {def.label}
          </label>
          <select
            aria-label={def.label}
            value={currentValues[def.key] || ""}
            onChange={(e) =>
              onChangeMap(updateValueMap(currentValues, def.key, e.target.value))
            }
            className={`${controlClassName} ${widthClass}`}
          >
            <option value="">Tous</option>
            <option value="true">Oui</option>
            <option value="false">Non</option>
          </select>
        </div>
      );
    }

    if (def.type === "month") {
      return (
        <div key={def.key} className={`flex flex-col gap-1 ${widthClass}`}>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {def.label}
          </label>
          <input
            type="month"
            aria-label={def.label}
            value={currentValues[def.key] || ""}
            onChange={(e) =>
              onChangeMap(updateValueMap(currentValues, def.key, e.target.value))
            }
            className={`${controlClassName} ${widthClass}`}
          />
        </div>
      );
    }

    if (def.type === "dateRange") {
      return (
        <div
          key={def.key}
          className={`flex flex-col gap-1 ${fullWidth ? "w-full" : "sm:flex-row sm:items-end sm:gap-2"}`}
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {def.label} (du)
            </label>
            <input
              type="date"
              aria-label={`${def.label} du`}
              value={currentValues.from || ""}
              onChange={(e) =>
                onChangeMap(updateValueMap(currentValues, "from", e.target.value))
              }
              className={`${controlClassName} ${widthClass}`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {def.label} (au)
            </label>
            <input
              type="date"
              aria-label={`${def.label} au`}
              value={currentValues.to || ""}
              onChange={(e) =>
                onChangeMap(updateValueMap(currentValues, "to", e.target.value))
              }
              className={`${controlClassName} ${widthClass}`}
            />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Zone de recherche tactile */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white py-2.5 pr-10 pl-10 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-800 dark:bg-slate-900/60 dark:text-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute inset-y-0 right-0 flex min-w-[44px] items-center justify-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Effacer la recherche"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filtres additionnels éventuels, bouton Filtres mobile & Bouton Créer */}
        <div className="flex flex-wrap items-center gap-2">
          {(hasDefs || hasSortOptions) && (
            <button
              type="button"
              onClick={openMobileSheet}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-50 md:hidden dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filtres</span>
              {activeCount > 0 && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-600 px-1.5 text-xs font-semibold text-white">
                  {activeCount}
                </span>
              )}
            </button>
          )}

          {children}

          {canCreate && onCreateClick && (
            <Button
              type="button"
              onClick={onCreateClick}
              size="md"
              className="min-h-[44px] flex-1 gap-2 whitespace-nowrap sm:flex-initial"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>{createLabel}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Barre de filtres et de tri en ligne sur Desktop (md+) */}
      {(hasDefs || hasSortOptions) && (
        <div className="hidden flex-wrap items-end gap-3 md:flex">
          {hasDefs &&
            defs?.map((def) =>
              renderFilterControl(def, values, (next) => onValuesChange?.(next), false)
            )}

          {hasSortOptions && (
            <div className="ml-auto flex flex-col gap-1">
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span>Trier par</span>
              </label>
              <select
                aria-label="Trier par"
                value={sort}
                onChange={(e) => onSortChange?.(e.target.value)}
                className={controlClassName}
              >
                {sortOptions?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Puces (chips) des filtres actifs */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 py-1 pr-1.5 pl-3 text-xs font-medium text-sky-900 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-200"
            >
              <span>
                {chip.label} : <strong>{chip.displayValue}</strong>
              </span>
              <button
                type="button"
                onClick={() => handleRemoveChip(chip.key)}
                aria-label={`Retirer le filtre ${chip.label}`}
                className="inline-flex min-h-[28px] min-w-[28px] items-center justify-center rounded-full text-sky-700 hover:bg-sky-200/60 dark:text-sky-300 dark:hover:bg-sky-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex min-h-[36px] items-center rounded-lg px-2.5 text-xs font-medium text-slate-600 underline-offset-2 hover:underline dark:text-slate-400"
          >
            Tout effacer
          </button>
        </div>
      )}

      {/* Panneau inférieur mobile local (sous md) */}
      {isMobileSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/50 backdrop-blur-xs md:hidden dark:bg-slate-950/70"
          onClick={() => setIsMobileSheetOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Filtres et tri
              </h3>
              <button
                type="button"
                onClick={() => setIsMobileSheetOpen(false)}
                aria-label="Fermer les filtres"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {hasDefs &&
                defs?.map((def) =>
                  renderFilterControl(def, draftValues, setDraftValues, true)
                )}

              {hasSortOptions && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Trier par
                  </label>
                  <select
                    aria-label="Trier par"
                    value={draftSort}
                    onChange={(e) => setDraftSort(e.target.value)}
                    className={`${controlClassName} w-full`}
                  >
                    {sortOptions?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={resetMobileSheet}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Réinitialiser
              </button>
              <button
                type="button"
                onClick={applyMobileSheet}
                className="min-h-[44px] flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-base font-medium text-white hover:bg-sky-700"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
````

### `components/crud/ConfirmDialog.tsx`

````tsx
"use client";

import React, { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title = "Confirmer l'action",
  message = "Êtes-vous sûr de vouloir continuer ? Cette action est irréversible.",
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  isDestructive = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Arrière-plan flouté */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Conteneur modal tactile */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              isDestructive
                ? "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
                : "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
            }`}
          >
            <AlertTriangle className="h-6 w-6 stroke-[2]" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="min-h-[44px] w-full sm:w-auto"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={isDestructive ? "danger" : "primary"}
            onClick={onConfirm}
            isLoading={loading}
            className="min-h-[44px] w-full sm:w-auto"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
````

### `hooks/useResource.ts`

````ts
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
````

## Finances : charges, paiements et depenses

### `app/charges/page.tsx`

````tsx
"use client";

import React, { useState, useEffect } from "react";
import { Calculator, CheckCircle2, AlertCircle } from "lucide-react";
import { ResourcePage } from "@/components/crud/ResourcePage";
import { chargeConfig } from "@/lib/resources/registry";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { Role } from "@/types/enums";
import { getOfflineSession } from "@/lib/offline/db";

export default function ChargesPage() {
  const [userRole, setUserRole] = useState<Role | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [residences, setResidences] = useState<Array<{ label: string; value: string }>>([]);
  const [selectedResidence, setSelectedResidence] = useState("");
  const [period, setPeriod] = useState("");
  const [totalBudget, setTotalBudget] = useState<number | "">("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    setPeriod(new Date().toISOString().slice(0, 7));
    setDueDate(new Date().toISOString().split("T")[0]);

    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role as Role);
      })
      .catch(() => {
        getOfflineSession().then((offline) => {
          if (offline) setUserRole(offline.role);
        });
      });

    // Chargement des résidences
    fetchWithOffline<any>("/api/residences")
      .then((res) => {
        const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const opts = items.map((r: any) => ({
          label: r.name,
          value: r._id,
        }));
        setResidences(opts);
        if (opts.length > 0) setSelectedResidence(opts[0].value);
      })
      .catch(() => {});
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResidence || !totalBudget || Number(totalBudget) <= 0) {
      setErrorMessage("Veuillez sélectionner une copropriété et saisir un budget valide.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      const res = await fetchWithOffline<any>("/api/charges/generate", {
        method: "POST",
        body: JSON.stringify({
          residenceId: selectedResidence,
          period,
          totalBudget: Number(totalBudget),
          dueDate,
        }),
      });

      setSuccessMessage(
        res?.message || `Charges du mois ${period} générées avec succès au prorata des tantièmes !`
      );
      setIsModalOpen(false);
      setRefreshTrigger((prev) => prev + 1);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors de la génération des charges");
    } finally {
      setLoading(false);
    }
  };

  const isStaff = userRole === Role.ADMIN || userRole === Role.SYNDIC;

  return (
    <>
      <ResourcePage
        key={refreshTrigger}
        config={chargeConfig}
        headerExtra={() => (
          <div className="space-y-3">
            {/* Message de succès */}
            {successMessage && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-50/80 p-3.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Bouton d'action Générer réservé aux ADMIN / SYNDIC */}
            {isStaff && (
              <div className="flex flex-col gap-2 rounded-2xl border border-sky-500/20 bg-sky-50/50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-sky-500/20 dark:bg-sky-950/20">
                <div>
                  <h4 className="text-sm font-bold text-sky-950 dark:text-sky-200">
                    Appel de charges groupé
                  </h4>
                  <p className="text-xs text-sky-700/80 dark:text-sky-400">
                    Générez en un clic les charges pour tous les lots d&apos;une copropriété au
                    prorata des tantièmes.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setErrorMessage(null);
                    setIsModalOpen(true);
                  }}
                  className="min-h-[44px] gap-2 whitespace-nowrap text-xs sm:min-h-[36px]"
                >
                  <Calculator className="h-4 w-4" />
                  Générer les charges du mois
                </Button>
              </div>
            )}
          </div>
        )}
      />

      {/* Modal de génération des charges */}
      <BottomSheet
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Générer les charges du mois"
        description="Crée automatiquement une charge par lot au prorata de ses tantièmes, sans doublon."
      >
        <form onSubmit={handleGenerate} className="space-y-4 pt-2 pb-4">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Select
            label="Copropriété"
            required
            options={residences}
            value={selectedResidence}
            onChange={(e) => setSelectedResidence(e.target.value)}
            disabled={loading}
          />

          <Input
            label="Période (AAAA-MM)"
            type="text"
            required
            value={period}
            placeholder="Ex : 2026-10"
            onChange={(e) => setPeriod(e.target.value)}
            disabled={loading}
          />

          <Input
            label="Budget total à répartir (€)"
            type="number"
            required
            value={totalBudget}
            placeholder="Ex : 2500"
            onChange={(e) => setTotalBudget(parseFloat(e.target.value) || "")}
            disabled={loading}
            helperText="Le montant de chaque lot sera calculé : Budget × Tantièmes / Somme tantièmes"
          />

          <Input
            label="Date d'échéance"
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={loading}
          />

          <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={loading}
              className="min-h-[44px]"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={loading}
              className="min-h-[44px]"
            >
              Lancer la génération
            </Button>
          </div>
        </form>
      </BottomSheet>
    </>
  );
}
````

### `app/payments/page.tsx`

````tsx
"use client";

import React, { useState, useEffect } from "react";
import { HandCoins, CheckCircle2, AlertCircle } from "lucide-react";
import { ResourcePage } from "@/components/crud/ResourcePage";
import { paymentConfig } from "@/lib/resources/registry";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { Role, PaymentMethod } from "@/types/enums";
import { getOfflineSession } from "@/lib/offline/db";

export default function PaymentsPage() {
  const [userRole, setUserRole] = useState<Role | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [charges, setCharges] = useState<any[]>([]);
  const [selectedChargeId, setSelectedChargeId] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.BANK_TRANSFER);
  const [paymentDate, setPaymentDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    setPaymentDate(new Date().toISOString().split("T")[0]);

    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role as Role);
      })
      .catch(() => {
        getOfflineSession().then((offline) => {
          if (offline) setUserRole(offline.role);
        });
      });

    // Chargement des charges ouvertes pour sélection dans l'encaissement
    fetchWithOffline<any>("/api/charges")
      .then((res) => {
        const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setCharges(items);
        if (items.length > 0) {
          const first = items[0];
          setSelectedChargeId(first._id);
          const rem = Math.max(0, (first.amount || 0) - (first.paidAmount || 0));
          setAmount(rem > 0 ? rem : first.amount);
        }
      })
      .catch(() => {});
  }, []);

  const selectedCharge = charges.find((c) => c._id === selectedChargeId);
  const remaining = selectedCharge
    ? Math.max(0, (selectedCharge.amount || 0) - (selectedCharge.paidAmount || 0))
    : 0;

  const handleChargeChange = (id: string) => {
    setSelectedChargeId(id);
    const c = charges.find((item) => item._id === id);
    if (c) {
      const rem = Math.max(0, (c.amount || 0) - (c.paidAmount || 0));
      setAmount(rem > 0 ? rem : c.amount);
    }
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChargeId || !amount || Number(amount) <= 0) {
      setErrorMessage("Veuillez sélectionner une charge et saisir un montant valide.");
      return;
    }

    if (Number(amount) > remaining + 0.001) {
      setErrorMessage(
        `Le montant saisi (${Number(amount).toFixed(2)} €) dépasse le reste dû (${remaining.toFixed(2)} €).`
      );
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      const clientId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      await fetchWithOffline("/api/payments", {
        method: "POST",
        entity: "payment",
        body: JSON.stringify({
          charge: selectedChargeId,
          amount: Number(amount),
          method,
          paymentDate,
          clientId,
        }),
      });

      setSuccessMessage(
        "Règlement enregistré avec succès ! Reçu généré et charge mise à jour (fonctionne hors ligne)."
      );
      setIsModalOpen(false);
      setRefreshTrigger((prev) => prev + 1);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors de l'enregistrement du règlement");
    } finally {
      setLoading(false);
    }
  };

  const isStaff = userRole === Role.ADMIN || userRole === Role.SYNDIC;

  return (
    <>
      <ResourcePage
        key={refreshTrigger}
        config={paymentConfig}
        headerExtra={() => (
          <div className="space-y-3">
            {/* Message de succès */}
            {successMessage && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-50/80 p-3.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Écran d'action Encaisser utilisable hors ligne */}
            {isStaff && (
              <div className="flex flex-col gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-50/40 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-500/20 dark:bg-emerald-950/20">
                <div>
                  <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                    Encaissement de règlement (Hors ligne garanti)
                  </h4>
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                    Enregistrez un paiement par chèque, virement ou espèces avec reçu automatique et
                    contrôle du reste à payer.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setErrorMessage(null);
                    setIsModalOpen(true);
                  }}
                  className="min-h-[44px] gap-2 whitespace-nowrap bg-emerald-600 text-xs hover:bg-emerald-500 active:bg-emerald-700 sm:min-h-[36px]"
                >
                  <HandCoins className="h-4 w-4" />
                  Encaisser un règlement
                </Button>
              </div>
            )}
          </div>
        )}
      />

      {/* Modal / BottomSheet d'encaissement */}
      <BottomSheet
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Encaisser un règlement"
        description="Enregistre la transaction avec identifiant idempotent, date et calcul automatique du solde."
      >
        <form onSubmit={handleCollectPayment} className="space-y-4 pt-2 pb-4">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Sélection de la charge */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Charge à régler <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedChargeId}
              onChange={(e) => handleChargeChange(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              disabled={loading}
            >
              {charges.map((c) => {
                const aptNum =
                  typeof c.apartment === "object" ? c.apartment?.number : "N/A";
                const rem = Math.max(0, (c.amount || 0) - (c.paidAmount || 0));
                return (
                  <option key={c._id} value={c._id}>
                    Lot {aptNum} • {c.period} (Appelé : {c.amount} € - Reste : {rem.toFixed(2)} €)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Détails de la charge sélectionnée */}
          {selectedCharge && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex justify-between py-0.5 text-slate-500">
                <span>Montant total :</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {(selectedCharge.amount || 0).toFixed(2)} €
                </span>
              </div>
              <div className="flex justify-between py-0.5 text-slate-500">
                <span>Déjà réglé :</span>
                <span className="font-semibold text-emerald-600">
                  {(selectedCharge.paidAmount || 0).toFixed(2)} €
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900 dark:border-slate-700 dark:text-white">
                <span>Reste à payer :</span>
                <span className="text-rose-600">{remaining.toFixed(2)} €</span>
              </div>
            </div>
          )}

          <Input
            label="Montant du versement (€)"
            type="number"
            required
            value={amount}
            step="0.01"
            min="0.01"
            max={remaining}
            onChange={(e) => setAmount(parseFloat(e.target.value) || "")}
            disabled={loading}
            helperText={`Maximum autorisé : ${remaining.toFixed(2)} €`}
          />

          <Select
            label="Mode de règlement"
            required
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            disabled={loading}
            options={[
              { label: "Virement bancaire", value: "BANK_TRANSFER" },
              { label: "Chèque", value: "CHEQUE" },
              { label: "Espèces (Cash)", value: "CASH" },
              { label: "Carte bancaire", value: "CARD" },
            ]}
          />

          <Input
            label="Date d'encaissement"
            type="date"
            required
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            disabled={loading}
          />

          <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={loading}
              className="min-h-[44px]"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={loading}
              className="min-h-[44px] bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700"
            >
              Confirmer l&apos;encaissement
            </Button>
          </div>
        </form>
      </BottomSheet>
    </>
  );
}
````

### `app/expenses/page.tsx`

````tsx
"use client";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { expenseConfig } from "@/lib/resources/registry";

export default function ExpensesPage() {
  return <ResourcePage config={expenseConfig} />;
}
````

## Reclamations, traitement et outils d’aide

### `app/incidents/page.tsx`

````tsx
"use client";

import { useCallback, useEffect, useState, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  PlusCircle,
  Camera,
  X,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  UserCheck,
  ArrowRight,
  ShieldAlert,
  ClipboardList,
  History,
  MessageCircle,
  Wrench,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import type { IncidentDTO, ResidenceDTO } from "@/types/api";
import { IncidentCategory, Priority, IncidentStatus, Role } from "@/types/enums";
import { IncidentHistory } from "@/components/incidents/IncidentHistory";
import { IncidentComments } from "@/components/incidents/IncidentComments";
import { IncidentWorkflowTimeline } from "@/components/incidents/IncidentWorkflowTimeline";
import { ResolutionReview } from "@/components/incidents/ResolutionReview";
import { ResolutionSubmissionForm } from "@/components/incidents/ResolutionSubmissionForm";
import { IncidentDashboard } from "@/components/incidents/dashboard/IncidentDashboard";
import { AIIncidentTools } from "@/components/ai/AIIncidentTools";
import { AIPriorityPanel } from "@/components/ai/AIPriorityPanel";
import { AIReportPanel } from "@/components/ai/AIReportPanel";
import { AIDuplicateReview } from "@/components/ai/AIDuplicateReview";
import AiTriagePanel, { type AiTriageSuggestion } from "@/components/ai/AiTriagePanel";
import { IncidentAIReview } from "@/components/ai/IncidentAIReview";

// Libellés français
const CATEGORY_LABELS: Record<string, string> = {
  [IncidentCategory.PLUMBING]: "Plomberie",
  [IncidentCategory.ELECTRICITY]: "Électricité",
  [IncidentCategory.ELEVATOR]: "Ascenseur",
  [IncidentCategory.CLEANING]: "Nettoyage",
  [IncidentCategory.SECURITY]: "Sécurité",
  [IncidentCategory.OTHER]: "Autre",
};

const STATUS_LABELS: Record<string, string> = {
  [IncidentStatus.REPORTED]: "Signalé",
  [IncidentStatus.ASSIGNED]: "Assigné",
  [IncidentStatus.IN_PROGRESS]: "En cours",
  [IncidentStatus.RESOLVED]: "Résolu",
};

const PRIORITY_BORDER_CLASSES: Record<Priority, string> = {
  [Priority.URGENT]: "border-l-rose-500",
  [Priority.HIGH]: "border-l-amber-500",
  [Priority.MEDIUM]: "border-l-yellow-500",
  [Priority.LOW]: "border-l-slate-400 dark:border-l-slate-600",
};

const WORKFLOW_STEPS: Array<{ key: IncidentStatus; label: string }> = [
  { key: IncidentStatus.REPORTED, label: "Signalé" },
  { key: IncidentStatus.ASSIGNED, label: "Assigné" },
  { key: IncidentStatus.IN_PROGRESS, label: "En cours" },
  { key: IncidentStatus.RESOLVED, label: "Résolu" },
];

function getProp(obj: unknown, key: string): string | number | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

function formatFullDate(dateVal?: string | Date): string {
  if (!dateVal) return "—";
  try {
    const d = new Date(dateVal);
    const datePart = d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timePart = d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePart} à ${timePart}`;
  } catch {
    return "—";
  }
}

function formatRelativeTime(dateVal?: string | Date): string {
  if (!dateVal) return "";
  try {
    const diffMs = Date.now() - new Date(dateVal).getTime();
    if (diffMs < 0) return "à l'instant";
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `il y a ${days} j`;
    const months = Math.floor(days / 30);
    if (months < 12) return `il y a ${months} mois`;
    const years = Math.floor(months / 12);
    return `il y a ${years} an${years > 1 ? "s" : ""}`;
  } catch {
    return "";
  }
}

function compressedDataUrlToFile(dataUrl: string, fileName: string): File {
  const [metadata, encoded] = dataUrl.split(",");
  const mimeType = metadata.match(/^data:(.*?);base64$/)?.[1] ?? "image/jpeg";
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new File([bytes], fileName, { type: mimeType });
}

function IncidentsContent() {
  const searchParams = useSearchParams();
  const [incidents, setIncidents] = useState<IncidentDTO[]>([]);
  const [residences, setResidences] = useState<ResidenceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: Role } | null>(null);
  const [technicians, setTechnicians] = useState<Array<{ _id: string; name: string; email: string }>>([]);

  // Filtres
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [residenceFilter, setResidenceFilter] = useState<string>("ALL");
  const [technicianFilter, setTechnicianFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalIncidents, setTotalIncidents] = useState(0);
  const pageSize = 20;

  // Modal de création
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<IncidentCategory>(IncidentCategory.PLUMBING);
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [residenceId, setResidenceId] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const [acceptedTriage, setAcceptedTriage] = useState<AiTriageSuggestion | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal d'assignation
  const [assigningIncident, setAssigningIncident] = useState<IncidentDTO | null>(null);
  const [selectedTechId, setSelectedTechId] = useState<string>("");
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  // Modal de détail d'incident & zoom photo
  const [selectedIncident, setSelectedIncident] = useState<IncidentDTO | null>(null);
  const [selectedIncidentTab, setSelectedIncidentTab] = useState<
    "overview" | "history" | "discussion" | "resolution"
  >("overview");
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  // État local pour le déploiement des descriptions longues
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const submitLock = useRef(false);
  const clientIdRef = useRef<string | null>(null);

  const getClientId = () => {
    if (!clientIdRef.current) {
      if (!globalThis.crypto?.randomUUID) {
        throw new Error("La génération d'identifiant sécurisé n'est pas disponible.");
      }
      clientIdRef.current = globalThis.crypto.randomUUID();
    }
    return clientIdRef.current;
  };

  const resetClientId = () => {
    clientIdRef.current = null;
  };

  const toggleExpandDescription = (id: string) => {
    setExpandedDescriptions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
      if (residenceFilter !== "ALL") params.set("residence", residenceFilter);
      if (technicianFilter !== "ALL") params.set("assignedTo", technicianFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const sortValues: Record<string, string> = {
        newest: "reportedAt:desc",
        oldest: "reportedAt:asc",
        priority: "priority:desc",
        status: "status:asc",
      };
      params.set("sort", sortValues[sortOrder] || sortValues.newest);
      const incRes = await fetchWithOffline<
        IncidentDTO[] | { data?: IncidentDTO[]; meta?: { total?: number } }
      >(`/api/incidents?${params}`);
      const incList = Array.isArray(incRes) ? incRes : incRes?.data || [];
      setIncidents(incList);
      setTotalIncidents(Array.isArray(incRes) ? incList.length : incRes.meta?.total || 0);
      const requestedIncidentId = searchParams.get("incident");
      if (requestedIncidentId) {
        let requestedIncident = incList.find((incident) => incident._id === requestedIncidentId);
        if (!requestedIncident) {
          const response = await fetchWithOffline<
            IncidentDTO | { data?: IncidentDTO | IncidentDTO[] }
          >(
            `/api/incidents/${encodeURIComponent(requestedIncidentId)}`
          );
          if (response && "_id" in response) {
            requestedIncident = response;
          } else if (response?.data && !Array.isArray(response.data)) {
            requestedIncident = response.data;
          }
        }
        if (requestedIncident) {
          setSelectedIncidentTab("overview");
          setSelectedIncident(requestedIncident);
        }
      }

      if (currentUser && currentUser.role !== Role.TECHNICIAN) {
        const resRes = await fetchWithOffline<
          ResidenceDTO[] | { data?: ResidenceDTO[] }
        >("/api/residences");
        const resList = Array.isArray(resRes) ? resRes : resRes?.data || [];
        setResidences(resList);
        if (resList.length > 0) {
          setResidenceId((current) => current || resList[0]._id);
        }
      } else {
        setResidences([]);
      }
    } catch (err) {
      console.error("[Incidents] Erreur chargement :", err);
      setErrorMessage(err instanceof Error ? err.message : "Impossible de charger les réclamations.");
    } finally {
      setLoading(false);
    }
  }, [
    categoryFilter,
    currentUser,
    dateFrom,
    dateTo,
    page,
    priorityFilter,
    residenceFilter,
    search,
    searchParams,
    sortOrder,
    statusFilter,
    technicianFilter,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
      if (searchParams.get("action") === "new" || searchParams.get("new") === "1") {
        setIsModalOpen(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData, searchParams]);

  useEffect(() => {
    // Récupérer la session utilisateur courante
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setCurrentUser({ id: data.user.id, role: data.user.role as Role });
          if (data.user.role === Role.ADMIN || data.user.role === Role.SYNDIC) {
            fetch("/api/users?role=TECHNICIAN&limit=50")
              .then((r) => (r.ok ? r.json() : null))
              .then((techs) => {
                const list = Array.isArray(techs) ? techs : techs?.data || [];
                setTechnicians(list);
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, []);

  // Compression photo côté client via canvas (strictement <= 1 Mo)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        // Compression adaptative assurant taille <= 1 Mo
        let quality = 0.75;
        let compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        while (compressedDataUrl.length > 1_000_000 && quality > 0.25) {
          quality -= 0.15;
          compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        }

        const compressedFileName = `${file.name.replace(/\.[^.]+$/, "") || "incident-photo"}.jpg`;
        setPhotos((prev) => [...prev.slice(0, 2), compressedDataUrl]);
        setAiFiles((prev) => [
          ...prev.slice(0, 2),
          compressedDataUrlToFile(compressedDataUrl, compressedFileName),
        ]);
        setAcceptedTriage(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;

    if (!residenceId) {
      setErrorMessage("Veuillez sélectionner une résidence.");
      submitLock.current = false;
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const trimmedDescription = description.trim();
      const firstSentence = trimmedDescription.split(/[.!?\r\n]/, 1)[0].trim();
      const submittedTitle =
        title.trim() ||
        (firstSentence.length >= 3
          ? firstSentence.slice(0, 180)
          : trimmedDescription.slice(0, 180));
      const newIncident = await fetchWithOffline<IncidentDTO>("/api/incidents", {
        method: "POST",
        entity: "incident",
        body: JSON.stringify({
          residence: residenceId,
          title: submittedTitle,
          description: trimmedDescription,
          category,
          ...(residentWithoutPhoto ? {} : { priority }),
          photos,
          ...(acceptedTriage ? { aiTriage: acceptedTriage } : {}),
          clientId: getClientId(),
        }),
      });

      setIncidents((prev) => [newIncident, ...prev]);
      setTitle("");
      setDescription("");
      setPhotos([]);
      setAiFiles([]);
      setAcceptedTriage(null);
      resetClientId();
      setIsModalOpen(false);

      setSuccessMessage(
        newIncident.createdOffline || newIncident.pending
          ? "Incident enregistré HORS LIGNE avec succès ! Il sera synchronisé dès le retour du réseau."
          : "Incident signalé et transmis au syndic avec succès !"
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors du signalement";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
      submitLock.current = false;
    }
  };

  const inspectIncident = async (incidentId: string) => {
    const cached = incidents.find((item) => item._id === incidentId);
    if (cached) {
      setSelectedIncident(cached);
      setSelectedIncidentTab("overview");
      return;
    }
    try {
      const response = await fetch(`/api/incidents/${incidentId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Incident inaccessible.");
      setSelectedIncident(data as IncidentDTO);
      setSelectedIncidentTab("overview");
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Impossible d’ouvrir l’incident.");
    }
  };

  // Progression de statut stricte : REPORTED -> ASSIGNED -> IN_PROGRESS -> RESOLVED
  const handleAdvanceStatus = async (incidentId: string, nextStatus: IncidentStatus) => {
    setIsActionLoading(incidentId);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/incidents/${incidentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors du changement de statut");
      }
      setIncidents((prev) =>
        prev.map((inc) => (inc._id === incidentId ? { ...inc, ...data } : inc))
      );
      setSelectedIncident((prev) => prev?._id === incidentId ? { ...prev, ...data } : prev);
      window.dispatchEvent(new Event("syndicpro:dashboard-refresh"));
      setSuccessMessage(`Statut de l'incident passé à : ${STATUS_LABELS[nextStatus] || nextStatus}`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erreur lors du changement de statut");
    } finally {
      setIsActionLoading(null);
    }
  };

  // Assignation d'un technicien par ADMIN / SYNDIC
  const handleAssignTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningIncident || !selectedTechId) return;

    setIsActionLoading(assigningIncident._id);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/incidents/${assigningIncident._id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: selectedTechId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'assignation");
      }
      setIncidents((prev) =>
        prev.map((inc) => (inc._id === assigningIncident._id ? { ...inc, ...data } : inc))
      );
      setSelectedIncident((prev) =>
        prev?._id === assigningIncident._id ? { ...prev, ...data } : prev
      );
      window.dispatchEvent(new Event("syndicpro:dashboard-refresh"));
      setAssigningIncident(null);
      setSelectedTechId("");
      setSuccessMessage("Technicien assigné avec succès ! Statut passé à ASSIGNED.");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erreur lors de l'assignation");
    } finally {
      setIsActionLoading(null);
    }
  };

  const filteredIncidents = useMemo(() => incidents, [incidents]);

  const canAssign =
    currentUser?.role === Role.ADMIN || currentUser?.role === Role.SYNDIC;
  const canCreateIncident =
    currentUser?.role === Role.ADMIN ||
    currentUser?.role === Role.SYNDIC ||
    currentUser?.role === Role.RESIDENT;
  const residentWithoutPhoto =
    currentUser?.role === Role.RESIDENT && photos.length === 0;

  const isFilterActive =
    statusFilter !== "ALL" ||
    categoryFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    residenceFilter !== "ALL" ||
    technicianFilter !== "ALL" ||
    Boolean(dateFrom || dateTo) ||
    search.trim() !== "";

  const clearFilters = () => {
    setPage(1);
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setPriorityFilter("ALL");
    setResidenceFilter("ALL");
    setTechnicianFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setSortOrder("newest");
    setSearch("");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <IncidentDashboard />
        {(currentUser?.role === Role.ADMIN || currentUser?.role === Role.SYNDIC) && (
          <AIReportPanel endpoint="/api/ai/reports/incidents" title="Générer le rapport IA des incidents" />
        )}
        {/* En-tête */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              Incidents & Pannes
            </h1>
            <p className="text-xs text-slate-500 sm:text-sm dark:text-slate-400">
              Déclarez et suivez la résolution des pannes même sans connexion internet
            </p>
          </div>
          {canCreateIncident && (
            <Button
              size="md"
              onClick={() => setIsModalOpen(true)}
              className="self-start sm:self-auto gap-2 min-h-[44px]"
            >
              <PlusCircle className="h-4 w-4" />
              Nouveau signalement
            </Button>
          )}
        </div>

        {/* Message de succès */}
        {successMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3.5 text-sm font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Message d'erreur */}
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3.5 text-sm font-semibold text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Filtres et recherche */}
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un incident (ex: fuite, ascenseur)..."
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-base sm:text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base sm:text-sm font-medium text-slate-700 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="REPORTED">Signalé</option>
              <option value="ASSIGNED">Assigné</option>
              <option value="IN_PROGRESS">En cours</option>
              <option value="RESOLVED">Résolu</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => {
                setPage(1);
                setCategoryFilter(e.target.value);
              }}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base sm:text-sm font-medium text-slate-700 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">Toutes catégories</option>
              <option value="PLUMBING">Plomberie</option>
              <option value="ELECTRICITY">Électricité</option>
              <option value="ELEVATOR">Ascenseur</option>
              <option value="CLEANING">Nettoyage</option>
              <option value="SECURITY">Sécurité</option>
              <option value="OTHER">Autre</option>
            </select>

            <select
              aria-label="Filtrer par priorité"
              value={priorityFilter}
              onChange={(e) => {
                setPage(1);
                setPriorityFilter(e.target.value);
              }}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base sm:text-sm font-medium text-slate-700 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">Toutes priorités</option>
              <option value="URGENT">Urgente</option>
              <option value="HIGH">Haute</option>
              <option value="MEDIUM">Moyenne</option>
              <option value="LOW">Basse</option>
            </select>

            {(currentUser?.role === Role.ADMIN || currentUser?.role === Role.SYNDIC) && (
              <>
                <select
                  aria-label="Filtrer par résidence"
                  value={residenceFilter}
                  onChange={(e) => {
                    setPage(1);
                    setResidenceFilter(e.target.value);
                  }}
                  className="min-h-[44px] max-w-56 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base sm:text-sm font-medium text-slate-700 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="ALL">Toutes résidences</option>
                  {residences.map((residence) => <option key={residence._id} value={residence._id}>{residence.name}</option>)}
                </select>
                <select
                  aria-label="Filtrer par technicien"
                  value={technicianFilter}
                  onChange={(e) => {
                    setPage(1);
                    setTechnicianFilter(e.target.value);
                  }}
                  className="min-h-[44px] max-w-56 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base sm:text-sm font-medium text-slate-700 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="ALL">Tous les techniciens</option>
                  {technicians.map((technician) => <option key={technician._id} value={technician._id}>{technician.name}</option>)}
                </select>
              </>
            )}

            <select
              aria-label="Trier les réclamations"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base sm:text-sm font-medium text-slate-700 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="newest">Plus récentes</option>
              <option value="oldest">Plus anciennes</option>
              <option value="priority">Priorité</option>
              <option value="status">Statut</option>
            </select>
          </div>

          </div>

          <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
              Du
              <input type="date" value={dateFrom} max={dateTo || new Date().toISOString().slice(0, 10)} onChange={(e) => { setPage(1); setDateFrom(e.target.value); }} className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
              Au
              <input type="date" value={dateTo} min={dateFrom || undefined} max={new Date().toISOString().slice(0, 10)} onChange={(e) => { setPage(1); setDateTo(e.target.value); }} className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </label>
            {isFilterActive && <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>Effacer les filtres</Button>}
          </div>
        </div>

        <AiTriagePanel
          title={title}
          description={description}
          files={aiFiles}
          onApply={(suggestion) => {
            setTitle(suggestion.title);
            setDescription(suggestion.description);
            setCategory(suggestion.category as IncidentCategory);
            setPriority(suggestion.priority as Priority);
          }}
          onSuggestionAccepted={setAcceptedTriage}
        />
        <AIIncidentTools
          title={title}
          description={description}
          residenceId={residenceId}
          currentPriority={priority}
          showOnlyDuplicates
          onApply={() => {}}
        />

        {/* LISTE DES INCIDENTS */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : filteredIncidents.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" />}
            title="Aucun incident à afficher"
            description={
              isFilterActive
                ? "Aucune panne ou anomalie ne correspond à votre filtre actuel."
                : currentUser?.role === Role.RESIDENT
                ? "Vous n'avez signalé aucun incident pour le moment."
                : "Aucun incident enregistré."
            }
            action={
              <Button onClick={() => setIsModalOpen(true)} className="min-h-[44px]">
                Signaler une anomalie
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filteredIncidents.map((inc) => {
              const assignedToObj =
                typeof inc.assignedTo === "object" && inc.assignedTo ? inc.assignedTo : undefined;
              const assignedToId =
                assignedToObj?._id ?? (typeof inc.assignedTo === "string" ? inc.assignedTo : undefined);
              const isAssignedTech =
                currentUser?.role === Role.TECHNICIAN &&
                Boolean(assignedToId) &&
                assignedToId === currentUser.id;

              const canAdvanceInProgress =
                inc.status === IncidentStatus.ASSIGNED &&
                (isAssignedTech || canAssign);

              const canAdvanceResolved =
                inc.status === IncidentStatus.IN_PROGRESS &&
                (isAssignedTech || canAssign);

              const priorityBorderClass = PRIORITY_BORDER_CLASSES[inc.priority] || "border-l-slate-300 dark:border-l-slate-700";

              const idShort = inc._id ? inc._id.slice(-6).toUpperCase() : "";
              const fullDateStr = formatFullDate(inc.reportedAt);
              const relativeTimeStr = formatRelativeTime(inc.reportedAt);

              const resName = getProp(inc.residence, "name");
              const resCity = getProp(inc.residence, "city");
              const residenceLabel = [resName, resCity].filter(Boolean).join(", ") || "—";

              const aptNumber = getProp(inc.apartment, "number");
              const aptFloor = getProp(inc.apartment, "floor");
              let aptLabel = "—";
              if (aptNumber) {
                aptLabel = `Lot ${aptNumber}${aptFloor !== undefined && aptFloor !== null && aptFloor !== "" ? ` (Étage ${aptFloor})` : ""}`;
              }

              const reporterId =
                typeof inc.reportedBy === "object" && inc.reportedBy
                  ? inc.reportedBy._id
                  : inc.reportedBy;
              const isCurrentUserReporter = currentUser?.id && reporterId === currentUser.id;
              const reporterName = isCurrentUserReporter ? "Vous" : getProp(inc.reportedBy, "name") || "—";

              const categoryLabel = CATEGORY_LABELS[inc.category] || inc.category;
              const isExpanded = !!expandedDescriptions[inc._id];
              const desc = inc.description || "";

              const techName = typeof inc.assignedTo === "object" ? (assignedToObj?.name || assignedToObj?.email) : (inc.assignedTo ? "Technicien" : null);
              const techPhone = typeof inc.assignedTo === "object" ? assignedToObj?.phone : null;

              const stepIdx = WORKFLOW_STEPS.findIndex((s) => s.key === inc.status);
              const currentStepIndex = stepIdx >= 0 ? stepIdx : 0;

              return (
                <Card
                  key={inc._id}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest("button, a, input, select, textarea")) return;
                    setSelectedIncidentTab("overview");
                    setSelectedIncident(inc);
                  }}
                  className={`flex flex-col justify-between space-y-3 border-l-4 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 ${priorityBorderClass}`}
                >
                  <div className="space-y-3">
                    {/* En-tête : Titre + Badge de priorité */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {inc.title}
                          </span>
                          {(inc.pending || inc.createdOffline) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                              <Clock className="h-3 w-3" />
                              En attente de synchro
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {idShort && <span className="font-mono font-semibold">#{idShort}</span>}
                          {idShort && " • "}
                          {fullDateStr}
                          {relativeTimeStr && ` (${relativeTimeStr})`}
                        </p>
                      </div>
                      <Badge priority={inc.priority} />
                    </div>

                    {/* Grille d'infos (2 colonnes dès sm:) */}
                    <div className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 sm:grid-cols-2 dark:bg-slate-900/60 dark:text-slate-300">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Résidence</span>
                        <p className="truncate font-medium text-slate-800 dark:text-slate-200">{residenceLabel}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Lot</span>
                        <p className="truncate font-medium text-slate-800 dark:text-slate-200">{aptLabel}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Signalé par</span>
                        <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                          {reporterName}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Catégorie</span>
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          <span className="inline-block rounded-md bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
                            {categoryLabel}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Description limitée à 3 lignes avec voir plus/moins */}
                    <div>
                      <p
                        className={`text-xs leading-relaxed text-slate-600 dark:text-slate-300 ${
                          !isExpanded ? "line-clamp-3" : ""
                        }`}
                      >
                        {desc}
                      </p>
                      {desc.length > 120 && (
                        <button
                          type="button"
                          onClick={() => toggleExpandDescription(inc._id)}
                          className="mt-1 text-[11px] font-semibold text-sky-600 hover:underline dark:text-sky-400"
                        >
                          {isExpanded ? "Voir moins" : "Voir plus"}
                        </button>
                      )}
                    </div>

                    {/* Photos avec miniatures et compteur */}
                    {inc.photos && inc.photos.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-slate-500">
                            {inc.photos.length} photo{inc.photos.length > 1 ? "s" : ""} :
                          </span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {inc.photos.map((photoUrl, idx) => (
                            <div
                              key={idx}
                              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photoUrl}
                                alt={`Photo incident ${idx + 1}`}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!loading && totalIncidents > pageSize && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-sm text-slate-500">
                          Page {page} sur {Math.max(1, Math.ceil(totalIncidents / pageSize))} · {totalIncidents} réclamation(s)
                        </p>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Précédent</Button>
                          <Button type="button" size="sm" variant="outline" disabled={page >= Math.ceil(totalIncidents / pageSize)} onClick={() => setPage((value) => value + 1)}>Suivant</Button>
                        </div>
                      </div>
                    )}

                    {/* Technicien assigné */}
                    <div className="text-xs">
                      {techName ? (
                        <div className="flex flex-wrap items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <UserCheck className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                          <span>
                            Technicien : <strong>{techName}</strong>
                          </span>
                          {techPhone && (
                            <a
                              href={`tel:${techPhone}`}
                              className="inline-flex items-center gap-1 text-sky-600 font-semibold underline hover:text-sky-700 dark:text-sky-400"
                            >
                              ({techPhone})
                            </a>
                          )}
                        </div>
                      ) : canAssign ? (
                        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>Non assigné</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Mini barre de progression en 4 étapes */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        {WORKFLOW_STEPS.map((step, idx) => {
                          const isPassed = idx <= currentStepIndex;
                          const isCurrent = idx === currentStepIndex;
                          return (
                            <span
                              key={step.key}
                              className={
                                isCurrent
                                  ? "text-sky-600 dark:text-sky-400 font-bold"
                                  : isPassed
                                  ? "text-slate-700 dark:text-slate-300"
                                  : "text-slate-400 dark:text-slate-600"
                              }
                            >
                              {step.label}
                            </span>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {WORKFLOW_STEPS.map((step, idx) => {
                          const isPassed = idx <= currentStepIndex;
                          const isCurrent = idx === currentStepIndex;
                          let barColor = "bg-slate-200 dark:bg-slate-800";
                          if (isCurrent) {
                            barColor =
                              inc.status === IncidentStatus.RESOLVED
                                ? "bg-emerald-500"
                                : "bg-sky-600 ring-2 ring-sky-300 dark:ring-sky-900";
                          } else if (isPassed) {
                            barColor = "bg-sky-500";
                          }
                          return (
                            <div
                              key={step.key}
                              className={`h-1.5 rounded-full transition-all ${barColor}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Statut du workflow */}
                  <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Statut :</span>
                      <Badge incidentStatus={inc.status} />
                    </div>

                    {/* Actions de workflow strict */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {inc.status === IncidentStatus.REPORTED && canAssign && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full text-xs min-h-[44px] gap-1"
                          onClick={() => {
                            setAssigningIncident(inc);
                            setSelectedTechId(
                              technicians.length > 0 ? technicians[0]._id : ""
                            );
                          }}
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Assigner un technicien
                        </Button>
                      )}

                      {canAdvanceInProgress && (
                        <Button
                          size="sm"
                          variant="primary"
                          className="w-full text-xs min-h-[44px] gap-1 bg-indigo-600 hover:bg-indigo-700"
                          isLoading={isActionLoading === inc._id}
                          onClick={() =>
                            handleAdvanceStatus(inc._id, IncidentStatus.IN_PROGRESS)
                          }
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                          Prendre en charge (En cours)
                        </Button>
                      )}

                      {canAdvanceResolved && (
                        <Button
                          size="sm"
                          variant="primary"
                          className="w-full text-xs min-h-[44px] gap-1 bg-emerald-600 hover:bg-emerald-700"
                          isLoading={isActionLoading === inc._id}
                          onClick={() =>
                            handleAdvanceStatus(inc._id, IncidentStatus.RESOLVED)
                          }
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Marquer comme résolu
                        </Button>
                      )}

                      {inc.status === IncidentStatus.RESOLVED && inc.resolvedAt && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Résolu le {formatFullDate(inc.resolvedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Modal d'assignation de technicien */}
        <BottomSheet
          isOpen={!!assigningIncident}
          onClose={() => setAssigningIncident(null)}
          title="Assigner un technicien"
          description="Sélectionnez le technicien pour intervenir sur cet incident. Le statut passera à ASSIGNÉ."
        >
          <form onSubmit={handleAssignTechnician} className="space-y-4 pt-2">
            {technicians.length === 0 ? (
              <p className="text-sm text-slate-500">
                Aucun compte avec le rôle TECHNICIEN trouvé. Veuillez d&apos;abord en créer un dans la gestion des utilisateurs.
              </p>
            ) : (
              <Select
                label="Technicien qualifié"
                value={selectedTechId}
                onChange={(e) => setSelectedTechId(e.target.value)}
                required
              >
                {technicians.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name || t.email} ({t.email})
                  </option>
                ))}
              </Select>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                disabled={technicians.length === 0}
                isLoading={isActionLoading === assigningIncident?._id}
                className="w-full min-h-[44px]"
              >
                Confirmer l&apos;assignation (Statut ASSIGNED)
              </Button>
            </div>
          </form>
        </BottomSheet>

        {/* BOTTOM SHEET : FORMULAIRE NOUVEL INCIDENT (OFFLINE READY) */}
        {canCreateIncident && (
          <BottomSheet
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="Signaler un incident"
            description="Enregistrez une anomalie même sans connexion, avec photo jointe (max 1 Mo)."
          >
          <form onSubmit={handleCreateIncident} className="space-y-4 pt-2">
            {errorMessage && (
              <div className="rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {errorMessage}
              </div>
            )}

            {residences.length > 1 && (
              <Select
                label="Résidence concernée"
                value={residenceId}
                onChange={(e) => setResidenceId(e.target.value)}
                required
              >
                {residences.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name} ({r.city})
                  </option>
                ))}
              </Select>
            )}

            <Input
              label="Titre de l'incident"
              placeholder="Facultatif — généré depuis la photo ou la description"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setAcceptedTriage(null);
              }}
            />

            <div className={`grid gap-3 ${residentWithoutPhoto ? "grid-cols-1" : "grid-cols-2"}`}>
              <Select
                label="Type de problème"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as IncidentCategory);
                  setAcceptedTriage(null);
                }}
              >
                <option value={IncidentCategory.PLUMBING}>Plomberie</option>
                <option value={IncidentCategory.ELECTRICITY}>Électricité</option>
                <option value={IncidentCategory.ELEVATOR}>Ascenseur</option>
                <option value={IncidentCategory.CLEANING}>Nettoyage</option>
                <option value={IncidentCategory.SECURITY}>Sécurité</option>
                <option value={IncidentCategory.OTHER}>Autre</option>
              </Select>

              {!residentWithoutPhoto && (
                <Select
                  label="Priorité"
                  value={priority}
                  onChange={(e) => {
                    setPriority(e.target.value as Priority);
                    setAcceptedTriage(null);
                  }}
                >
                  <option value={Priority.LOW}>Basse</option>
                  <option value={Priority.MEDIUM}>Moyenne</option>
                  <option value={Priority.HIGH}>Haute</option>
                  <option value={Priority.URGENT}>Urgente</option>
                </Select>
              )}
            </div>

            {residentWithoutPhoto && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sans photo, vous n&apos;avez pas à choisir la priorité. Elle sera provisoirement enregistrée comme moyenne et pourra être réévaluée par le syndic.
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300">
                Description détaillée
              </label>
              <textarea
                rows={3}
                placeholder="Indiquez l'emplacement précis et l'ampleur du problème..."
                minLength={5}
                maxLength={2000}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setAcceptedTriage(null);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                required
              />
            </div>

            {/* Ajout de photo (Appareil photo mobile ou fichier, max 1 Mo) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Photo du problème (compression canvas &le; 1 Mo, hors ligne)
              </label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                className="hidden"
              />

              <div className="flex flex-wrap items-center gap-2">
                {photos.map((photo, i) => (
                  <div
                    key={i}
                    className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo}
                      alt="Capture"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotos((prev) => prev.filter((_, idx) => idx !== i));
                        setAiFiles((prev) => prev.filter((_, idx) => idx !== i));
                        setAcceptedTriage(null);
                      }}
                      className="absolute top-1 right-1 rounded-full bg-slate-900/80 p-1 text-white hover:bg-rose-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label="Supprimer la photo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {photos.length < 3 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 min-h-[44px]"
                  >
                    <Camera className="h-5 w-5 text-sky-500" />
                    <span>Ajouter</span>
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                isLoading={isSubmitting}
                className="w-full min-h-[44px]"
              >
                Envoyer le signalement (Offline supporté)
              </Button>
            </div>
          </form>
          </BottomSheet>
        )}

        {/* MODALE DÉTAIL DE L'INCIDENT (Bottom sheet sur mobile, modale centrée dès md:) */}
        {selectedIncident && (() => {
          const inc = selectedIncident;
          const assignedToObj =
            typeof inc.assignedTo === "object" && inc.assignedTo ? inc.assignedTo : undefined;
          const assignedToId =
            assignedToObj?._id ?? (typeof inc.assignedTo === "string" ? inc.assignedTo : undefined);
          const isAssignedTech =
            currentUser?.role === Role.TECHNICIAN &&
            Boolean(assignedToId) &&
            assignedToId === currentUser.id;

          const canAdvanceInProgress =
            inc.status === IncidentStatus.ASSIGNED && (isAssignedTech || canAssign);
          const canAdvanceResolved =
            inc.status === IncidentStatus.IN_PROGRESS && (isAssignedTech || canAssign);

          const idShort = inc._id ? inc._id.slice(-6).toUpperCase() : "";
          const resName = getProp(inc.residence, "name");
          const resCity = getProp(inc.residence, "city");
          const residenceLabel = [resName, resCity].filter(Boolean).join(", ") || "—";

          const aptNumber = getProp(inc.apartment, "number");
          const aptFloor = getProp(inc.apartment, "floor");
          let aptLabel = "—";
          if (aptNumber) {
            aptLabel = `Lot ${aptNumber}${aptFloor !== undefined && aptFloor !== null && aptFloor !== "" ? ` (Étage ${aptFloor})` : ""}`;
          }

          const reporterName = getProp(inc.reportedBy, "name") || "—";
          const reporterEmail = getProp(inc.reportedBy, "email");

          const techName = typeof inc.assignedTo === "object" ? (assignedToObj?.name || assignedToObj?.email) : (inc.assignedTo ? "Technicien" : null);
          const techEmail = typeof inc.assignedTo === "object" ? assignedToObj?.email : null;
          const techPhone = typeof inc.assignedTo === "object" ? assignedToObj?.phone : null;

          const categoryLabel = CATEGORY_LABELS[inc.category] || inc.category;
          const hasResolutionProof = Boolean(inc.resolutionSubmittedAt);
          const canSubmitResolution =
            inc.status === IncidentStatus.IN_PROGRESS && (isAssignedTech || canAssign);
          const showResolutionTab =
            currentUser?.role === Role.RESIDENT
              ? hasResolutionProof
              : Boolean(isAssignedTech || canAssign) &&
                (hasResolutionProof || inc.status === IncidentStatus.IN_PROGRESS);
          const tabs = [
            { id: "overview" as const, label: "Aperçu", icon: ClipboardList },
            { id: "history" as const, label: "Historique", icon: History },
            { id: "discussion" as const, label: "Discussion", icon: MessageCircle },
            ...(showResolutionTab
              ? [{ id: "resolution" as const, label: "Résolution", icon: Wrench }]
              : []),
          ];

          return (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm transition-opacity md:items-center p-0 md:p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedIncident(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSelectedIncident(null);
              }}
              tabIndex={-1}
            >
              <div
                role="dialog"
                aria-modal="true"
                className="flex max-h-[90vh] w-full flex-col rounded-t-3xl md:rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all md:max-w-2xl dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-100 p-4 sm:p-5 dark:border-slate-800">
                  <div className="space-y-1 pr-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
                        {inc.title}
                      </h2>
                      {(inc.pending || inc.createdOffline) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          <Clock className="h-3 w-3" />
                          En attente de synchro
                        </span>
                      )}
                    </div>
                    {idShort && (
                      <p className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
                        Incident #{idShort}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedIncident(null)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 active:scale-95 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label="Fermer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5 sm:px-5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <Badge priority={inc.priority} />
                  <Badge incidentStatus={inc.status} />
                  <span className="inline-block rounded-md bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
                    {categoryLabel}
                  </span>
                </div>

                <div role="tablist" aria-label="Détails de la réclamation" className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 dark:border-slate-800">
                  {tabs.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={selectedIncidentTab === id}
                      onClick={() => setSelectedIncidentTab(id)}
                      className={`inline-flex min-h-[48px] shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold transition-colors sm:text-sm ${
                        selectedIncidentTab === id
                          ? "border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-300"
                          : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Contenu déroulant */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                  {selectedIncidentTab === "overview" && (
                  <div className="space-y-4">
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Progression</h3>
                    <IncidentWorkflowTimeline status={inc.status} />
                  </section>

                  {/* Description complète */}
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Description complète
                    </h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {inc.description || "Aucune description fournie."}
                    </p>
                  </div>
                  <IncidentAIReview
                    incidentId={inc._id}
                    aiTriage={inc.aiTriage}
                    aiResolutionCheck={inc.aiResolutionCheck}
                    resolutionPhotos={inc.resolutionPhotos ?? []}
                    showTriage={canAssign}
                    canVerify={
                      canAssign ||
                      (currentUser?.role === Role.RESIDENT &&
                        (typeof inc.reportedBy === "string"
                          ? inc.reportedBy === currentUser.id
                          : inc.reportedBy?._id === currentUser.id))
                    }
                    onResolutionCheckSaved={(check) => {
                      const updates: Partial<IncidentDTO> = { aiResolutionCheck: check };
                      setSelectedIncident((previous) =>
                        previous ? { ...previous, ...updates } : previous
                      );
                      setIncidents((previous) =>
                        previous.map((item) =>
                          item._id === inc._id ? { ...item, ...updates } : item
                        )
                      );
                    }}
                  />
                      {canAssign && (
                    <>
                      <AIPriorityPanel
                        incidentId={inc._id}
                        description={`${inc.title}\n${inc.description}`.slice(0, 4000)}
                        currentPriority={inc.priority}
                        onApplied={(suggestedPriority) => {
                          const updated = { ...inc, priority: suggestedPriority };
                          setSelectedIncident(updated);
                          setIncidents((items) => items.map((item) => item._id === inc._id ? updated : item));
                        }}
                      />
                      <AIDuplicateReview
                        incidentId={inc._id}
                        residenceId={String(getProp(inc.residence, "_id") || inc.residence)}
                        title={inc.title}
                        description={inc.description}
                        onInspect={(candidateId) => void inspectIncident(candidateId)}
                      />
                    </>
                  )}

                  {/* Informations de localisation et signalement */}
                  <div className="grid grid-cols-1 gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-2 dark:bg-slate-800/40 text-xs">
                    <div>
                      <span className="font-semibold text-slate-400">Résidence :</span>{" "}
                      <strong className="text-slate-800 dark:text-slate-200">{residenceLabel}</strong>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400">Lot / Appartement :</span>{" "}
                      <strong className="text-slate-800 dark:text-slate-200">{aptLabel}</strong>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400">Signalé par :</span>{" "}
                      <strong className="text-slate-800 dark:text-slate-200">{reporterName}</strong>
                      {reporterEmail && (
                        <span className="block text-[11px] text-slate-500">
                          {reporterEmail}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400">Signalé le :</span>{" "}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {formatFullDate(inc.reportedAt)}
                      </strong>
                    </div>
                    {inc.resolvedAt && (
                      <div className="sm:col-span-2">
                        <span className="font-semibold text-slate-400">Résolu le :</span>{" "}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {formatFullDate(inc.resolvedAt)}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Technicien assigné */}
                  <div className="space-y-1.5 rounded-2xl border border-slate-100 p-3 dark:border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Technicien assigné
                    </h3>
                    {techName ? (
                      <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                        <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <UserCheck className="h-4 w-4 text-sky-500" />
                          {techName}
                        </p>
                        <div className="flex flex-wrap gap-3 pt-1">
                          {techEmail && (
                            <a
                              href={`mailto:${techEmail}`}
                              className="text-sky-600 underline hover:text-sky-700 dark:text-sky-400"
                            >
                              {techEmail}
                            </a>
                          )}
                          {techPhone && (
                            <a
                              href={`tel:${techPhone}`}
                              className="text-sky-600 font-semibold underline hover:text-sky-700 dark:text-sky-400"
                            >
                              Tél : {techPhone}
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        Aucun technicien assigné pour le moment.
                      </p>
                    )}
                  </div>

                  {/* Photos en grand format */}
                  {inc.photos && inc.photos.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Photos jointes ({inc.photos.length})
                      </h3>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {inc.photos.map((photoUrl, idx) => (
                          <div
                            key={idx}
                            onClick={() => setFullscreenPhoto(photoUrl)}
                            className="group relative aspect-video cursor-pointer overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photoUrl}
                              alt={`Photo ${idx + 1}`}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                              Agrandir
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  </div>
                  )}
                  {selectedIncidentTab === "history" && <IncidentHistory incidentId={inc._id} />}
                  {selectedIncidentTab === "discussion" && (
                    <IncidentComments incidentId={inc._id} currentUserId={currentUser?.id || ""} />
                  )}
                  {selectedIncidentTab === "resolution" && showResolutionTab && (
                    <div className="space-y-5">
                      {hasResolutionProof && (
                        <ResolutionReview
                          incidentId={inc._id}
                          resolution={inc}
                          canRespond={currentUser?.role === Role.RESIDENT}
                          onPhotoClick={setFullscreenPhoto}
                          onUpdated={(data) => {
                            const updates: Partial<IncidentDTO> = {
                              status: data.status,
                              resolvedAt: data.resolvedAt,
                              resolutionDescription: data.resolutionDescription,
                              resolutionPhotos: data.resolutionPhotos,
                              resolutionSubmittedAt: data.resolutionSubmittedAt,
                              resolutionConfirmedAt: data.resolutionConfirmedAt,
                              resolutionRejectedAt: data.resolutionRejectedAt,
                              resolutionFeedback: data.resolutionFeedback,
                            };
                            setSelectedIncident((previous) => previous ? { ...previous, ...updates } : previous);
                            setIncidents((previous) => previous.map((item) =>
                              item._id === inc._id ? { ...item, ...updates, status: updates.status ?? item.status } : item
                            ));
                          }}
                        />
                      )}
                      {canSubmitResolution && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                          <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
                            {hasResolutionProof ? "Mettre à jour la preuve" : "Soumettre une preuve de résolution"}
                          </h3>
                          <ResolutionSubmissionForm
                            incidentId={inc._id}
                            onSubmitted={(data) => {
                              const updates: Partial<IncidentDTO> = {
                                resolutionDescription: data.resolutionDescription,
                                resolutionPhotos: data.resolutionPhotos,
                                resolutionSubmittedAt: data.resolutionSubmittedAt,
                                resolutionConfirmedAt: data.resolutionConfirmedAt,
                                resolutionRejectedAt: data.resolutionRejectedAt,
                                resolutionFeedback: data.resolutionFeedback,
                              };
                              setSelectedIncident((previous) => previous ? { ...previous, ...updates } : previous);
                              setIncidents((previous) => previous.map((item) =>
                                item._id === inc._id ? { ...item, ...updates } : item
                              ));
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer avec boutons d'actions */}
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  {inc.status === IncidentStatus.REPORTED && canAssign && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="min-h-[44px] gap-1"
                      onClick={() => {
                        setAssigningIncident(inc);
                        setSelectedTechId(technicians.length > 0 ? technicians[0]._id : "");
                      }}
                    >
                      <UserCheck className="h-4 w-4" />
                      Assigner un technicien
                    </Button>
                  )}

                  {canAdvanceInProgress && (
                    <Button
                      size="sm"
                      variant="primary"
                      className="min-h-[44px] gap-1 bg-indigo-600 hover:bg-indigo-700"
                      isLoading={isActionLoading === inc._id}
                      onClick={async () => {
                        await handleAdvanceStatus(inc._id, IncidentStatus.IN_PROGRESS);
                        setSelectedIncident((prev) =>
                          prev && prev._id === inc._id ? { ...prev, status: IncidentStatus.IN_PROGRESS } : prev
                        );
                      }}
                    >
                      <ArrowRight className="h-4 w-4" />
                      Prendre en charge (En cours)
                    </Button>
                  )}

                  {canAdvanceResolved && (
                    <Button
                      size="sm"
                      variant="primary"
                      className="min-h-[44px] gap-1 bg-emerald-600 hover:bg-emerald-700"
                      isLoading={isActionLoading === inc._id}
                      onClick={async () => {
                        await handleAdvanceStatus(inc._id, IncidentStatus.RESOLVED);
                        setSelectedIncident((prev) =>
                          prev && prev._id === inc._id
                            ? { ...prev, status: IncidentStatus.RESOLVED, resolvedAt: new Date().toISOString() }
                            : prev
                        );
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Marquer comme résolu
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => setSelectedIncident(null)}
                  >
                    Fermer
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Visionneuse photo plein écran */}
        {fullscreenPhoto && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
            onClick={() => setFullscreenPhoto(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setFullscreenPhoto(null);
            }}
            tabIndex={-1}
          >
            <button
              type="button"
              onClick={() => setFullscreenPhoto(null)}
              className="absolute top-4 right-4 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
              aria-label="Fermer l'image"
            >
              <X className="h-6 w-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fullscreenPhoto}
              alt="Photo plein écran"
              className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function IncidentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
        </div>
      }
    >
      <IncidentsContent />
    </Suspense>
  );
}
````

### `components/incidents/IncidentHistory.tsx`

````tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Clock3, MessageCircle, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface HistoryEntry {
  _id: string;
  action: string;
  description: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
  actor?: { name?: string; role?: string } | null;
}

const actionIcons: Record<string, typeof Activity> = {
  CREATED: Activity,
  ASSIGNED: UserCheck,
  COMMENT_ADDED: MessageCircle,
  RESOLUTION_CONFIRMED: CheckCircle2,
  RESOLUTION_SUBMITTED: CheckCircle2,
  RESOLUTION_REJECTED: AlertCircle,
};

export function IncidentHistory({ incidentId }: { incidentId: string }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/history?limit=50`, { signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger l'historique.");
      setEntries(Array.isArray(result.data) ? result.data : []);
      setTotal(Number(result.meta?.total) || 0);
      setPage(Number(result.meta?.page) || 1);
    } catch (err) {
      if (!signal.aborted) {
        setError(err instanceof Error ? err.message : "Impossible de charger l'historique.");
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, reload]);

  const loadMore = async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/history?page=${page + 1}&limit=50`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger la suite de l'historique.");
      setEntries((current) => [...current, ...(Array.isArray(result.data) ? result.data : [])]);
      setPage(Number(result.meta?.page) || page + 1);
      setTotal(Number(result.meta?.total) || total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger la suite de l'historique.");
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-3" aria-label="Chargement de l'historique">
      {[1, 2, 3].map((item) => <div key={item} className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800" />)}
    </div>;
  }

  if (error) {
    return <div role="alert" className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
      <p>{error}</p>
      <Button variant="outline" size="sm" onClick={() => setReload((value) => value + 1)}>Réessayer</Button>
    </div>;
  }

  if (entries.length === 0) {
    return <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">Aucun historique pour le moment.</p>;
  }

  return (
    <div className="space-y-3">
    <ol className="space-y-0">
      {[...entries].reverse().map((entry, index) => {
        const Icon = actionIcons[entry.action] || Clock3;
        return (
          <li key={entry._id} className="relative flex gap-3 pb-5 last:pb-0">
            {index < entries.length - 1 && <span aria-hidden="true" className="absolute left-4 top-9 h-full w-px bg-slate-200 dark:bg-slate-700" />}
            <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{entry.description}</p>
              {entry.oldValue && entry.newValue && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {entry.oldValue} <span aria-hidden="true">→</span> {entry.newValue}
                </p>
              )}
              {entry.newValue && entry.action === "RESOLUTION_REJECTED" && (
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400">{entry.newValue}</p>
              )}
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {entry.actor?.name || "Utilisateur"}{entry.actor?.role ? ` · ${entry.actor.role}` : ""}
                {" · "}
                <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString("fr-FR")}>
                  {new Date(entry.createdAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                </time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
    {entries.length < total && (
      <Button variant="outline" size="sm" isLoading={loadingMore} onClick={() => void loadMore()}>
        Afficher l&apos;historique précédent
      </Button>
    )}
    {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
````

### `components/incidents/IncidentComments.tsx`

````tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { compressIncidentImage } from "./compressIncidentImage";

interface CommentEntry {
  _id: string;
  content: string;
  attachments: string[];
  createdAt: string;
  author?: { _id?: string; name?: string; role?: string } | null;
}

function chronological(comments: CommentEntry[]) {
  return [...comments].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
}

export function IncidentComments({ incidentId, currentUserId }: { incidentId: string; currentUserId: string }) {
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [readingFiles, setReadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/comments?limit=50`, { signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger la discussion.");
      setComments(chronological(Array.isArray(result.data) ? result.data : []));
      setTotal(Number(result.meta?.total) || 0);
      setPage(Number(result.meta?.page) || 1);
    } catch (err) {
      if (!signal.aborted) setError(err instanceof Error ? err.message : "Impossible de charger la discussion.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [incidentId]);

  const loadMore = async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/comments?page=${page + 1}&limit=50`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger la suite de la discussion.");
      setComments((current) => chronological([...current, ...(Array.isArray(result.data) ? result.data : [])]));
      setPage(Number(result.meta?.page) || page + 1);
      setTotal(Number(result.meta?.total) || total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger la suite de la discussion.");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, reload]);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files).slice(0, Math.max(0, 3 - attachments.length));
    if (!selected.length) {
      setError("Maximum 3 pièces jointes par commentaire.");
      return;
    }
    setReadingFiles(true);
    setError(null);
    try {
      const values = await Promise.all(selected.map(compressIncidentImage));
      setAttachments((current) => [...current, ...values].slice(0, 3));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de lire la pièce jointe.");
    } finally {
      setReadingFiles(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim() || sending || readingFiles) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, attachments }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible d'envoyer le commentaire.");
      setComments((current) => chronological([...current, result]));
      setTotal((current) => current + 1);
      setContent("");
      setAttachments([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer le commentaire.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="flex min-h-[360px] flex-col gap-3">
      <div className="flex-1 space-y-3">
        {loading ? (
          <div className="animate-pulse space-y-3" aria-label="Chargement de la discussion">
            <div className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="ml-8 h-20 rounded-xl bg-slate-100 dark:bg-slate-800" />
          </div>
        ) : error && comments.length === 0 ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            <p>{error}</p>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => setReload((value) => value + 1)}>Réessayer</Button>
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-6 text-center dark:bg-slate-800/50">
            <MessageCircle className="mx-auto h-7 w-7 text-slate-400" />
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No comments yet. Start the discussion.</p>
          </div>
        ) : comments.map((comment) => {
          const ownComment = comment.author?._id === currentUserId;
          return (
            <article key={comment._id} className={`max-w-[92%] rounded-2xl border p-3 sm:max-w-[80%] ${ownComment ? "ml-auto border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
              <p className="whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-100">{comment.content}</p>
              {comment.attachments.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {comment.attachments.map((src, index) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={`${comment._id}-${index}`} src={src} alt={`Pièce jointe ${index + 1}`} className="aspect-square w-full rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
                  ))}
                </div>
              )}
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {comment.author?.name || "Utilisateur"}{comment.author?.role ? ` · ${comment.author.role}` : ""}
                {" · "}
                <time dateTime={comment.createdAt} title={new Date(comment.createdAt).toLocaleString("fr-FR")}>
                  {new Date(comment.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </time>
              </p>
            </article>
          );
        })}
      </div>

      {comments.length < total && (
        <Button className="self-start" type="button" variant="outline" size="sm" isLoading={loadingMore} onClick={() => void loadMore()}>
          Afficher les commentaires suivants
        </Button>
      )}
      {error && comments.length > 0 && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      <form onSubmit={submit} className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
        <label htmlFor="incident-comment" className="sr-only">Votre commentaire</label>
        <textarea
          id="incident-comment"
          rows={3}
          maxLength={3000}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Écrire un message..."
          className="w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          required
        />
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((src, index) => (
              <div key={src} className="relative h-14 w-14 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Pièce jointe ${index + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => setAttachments((current) => current.filter((_, item) => item !== index))} aria-label="Retirer la pièce jointe" className="absolute right-0 top-0 rounded-bl-md bg-slate-900/80 p-1 text-white"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={(event) => void addFiles(event.target.files)} />
          <Button type="button" variant="outline" size="sm" disabled={attachments.length >= 3 || readingFiles} onClick={() => fileInput.current?.click()}>
            <Paperclip className="h-4 w-4" /> {readingFiles ? "Lecture..." : "Joindre une image"}
          </Button>
          <Button type="submit" size="sm" disabled={!content.trim() || readingFiles} isLoading={sending}>
            <Send className="h-4 w-4" /> Envoyer
          </Button>
        </div>
      </form>
    </section>
  );
}
````

### `components/incidents/IncidentWorkflowTimeline.tsx`

````tsx
import { Check, ClipboardList, UserCheck, Wrench, CheckCircle2 } from "lucide-react";
import { IncidentStatus, incidentStatusLabel } from "@/types/enums";

const steps = [
  { status: IncidentStatus.REPORTED, icon: ClipboardList },
  { status: IncidentStatus.ASSIGNED, icon: UserCheck },
  { status: IncidentStatus.IN_PROGRESS, icon: Wrench },
  { status: IncidentStatus.RESOLVED, icon: CheckCircle2 },
] as const;

export function IncidentWorkflowTimeline({ status }: { status: IncidentStatus }) {
  const currentIndex = steps.findIndex((step) => step.status === status);

  return (
    <ol
      aria-label="Progression de la réclamation"
      className="grid grid-cols-4 gap-2"
    >
      {steps.map(({ status: stepStatus, icon: Icon }, index) => {
        const complete = index < currentIndex;
        const current = index === currentIndex;

        return (
          <li key={stepStatus} className="relative min-w-0 text-center">
            {index > 0 && (
              <span
                aria-hidden="true"
                className={`absolute right-1/2 top-5 h-0.5 w-full ${
                  index <= currentIndex ? "bg-sky-500" : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            )}
            <span
              className={`relative mx-auto flex h-10 w-10 items-center justify-center rounded-full border ${
                current
                  ? "border-sky-500 bg-sky-600 text-white ring-4 ring-sky-500/15"
                  : complete
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900"
              }`}
            >
              {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </span>
            <span
              className={`mt-2 block text-[11px] font-semibold sm:text-xs ${
                current
                  ? "text-sky-700 dark:text-sky-300"
                  : complete
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {incidentStatusLabel[stepStatus]}
            </span>
            <span className="sr-only">
              {current ? "Étape en cours" : complete ? "Étape terminée" : "Étape à venir"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
````

### `components/incidents/ResolutionReview.tsx`

````tsx
"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ResolutionData } from "./ResolutionSubmissionForm";

export function ResolutionReview({
  incidentId,
  resolution,
  onUpdated,
  onPhotoClick,
  canRespond,
}: {
  incidentId: string;
  resolution: ResolutionData;
  onUpdated: (data: ResolutionData) => void;
  onPhotoClick: (photo: string) => void;
  canRespond: boolean;
}) {
  const [feedback, setFeedback] = useState("");
  const [rejectionForm, setRejectionForm] = useState(false);
  const [loading, setLoading] = useState<"confirm" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirmed = Boolean(resolution.resolutionConfirmedAt);
  const resolvedWithoutConfirmation = resolution.status === "RESOLVED" && !confirmed;

  const send = async (action: "confirm" | "reject") => {
    setLoading(action);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/resolution/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        ...(action === "reject" ? { body: JSON.stringify({ feedback }) } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible d'enregistrer votre réponse.");
      onUpdated(result);
      setRejectionForm(false);
      setFeedback("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer votre réponse.");
    } finally {
      setLoading(null);
    }
  };

  if (!resolution.resolutionSubmittedAt) {
    return <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">Aucune preuve de résolution n&apos;a encore été soumise.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Preuve envoyée le {new Date(resolution.resolutionSubmittedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-100">{resolution.resolutionDescription}</p>
        {resolution.resolutionPhotos.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {resolution.resolutionPhotos.map((photo, index) => (
              <button key={`${photo.slice(0, 32)}-${index}`} type="button" onClick={() => onPhotoClick(photo)} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={`Preuve photo ${index + 1}`} className="aspect-video w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {confirmed ? (
        <div role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5" /> Résolution confirmée.
        </div>
      ) : resolvedWithoutConfirmation ? (
        <div role="status" className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          L&apos;incident est marqué comme résolu, sans confirmation du résident.
        </div>
      ) : resolution.resolutionRejectedAt && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="flex items-center gap-2 font-semibold"><XCircle className="h-4 w-4" /> Problème signalé comme non résolu</p>
          <p className="mt-1 whitespace-pre-wrap">{resolution.resolutionFeedback}</p>
        </div>
      )}

      {!confirmed && !resolvedWithoutConfirmation && canRespond && (
        <div className="space-y-3">
          {rejectionForm ? (
            <form onSubmit={(event) => { event.preventDefault(); void send("reject"); }} className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <label htmlFor="resolution-feedback" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Expliquez pourquoi le problème persiste</label>
              <textarea id="resolution-feedback" rows={3} maxLength={1000} value={feedback} onChange={(event) => setFeedback(event.target.value)} required className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setRejectionForm(false)}>Annuler</Button>
                <Button type="submit" variant="danger" size="sm" disabled={!feedback.trim()} isLoading={loading === "reject"}>Envoyer le retour</Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void send("confirm")} isLoading={loading === "confirm"}><CheckCircle2 className="h-4 w-4" /> Confirmer la résolution</Button>
              <Button variant="outline" onClick={() => setRejectionForm(true)}><XCircle className="h-4 w-4" /> Problème non résolu</Button>
            </div>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
````

### `components/incidents/ResolutionSubmissionForm.tsx`

````tsx
"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { IncidentStatus } from "@/types/enums";
import { compressIncidentImage } from "./compressIncidentImage";

export interface ResolutionData {
  resolutionDescription?: string;
  resolutionPhotos: string[];
  resolutionSubmittedAt?: string;
  resolutionConfirmedAt?: string;
  resolutionRejectedAt?: string;
  resolutionFeedback?: string;
  resolvedAt?: string;
  status?: IncidentStatus;
}

export function ResolutionSubmissionForm({
  incidentId,
  onSubmitted,
}: {
  incidentId: string;
  onSubmitted: (data: ResolutionData) => void;
}) {
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files).slice(0, Math.max(0, 3 - photos.length));
    try {
      const compressed = await Promise.all(selected.map(compressIncidentImage));
      setPhotos((current) => [...current, ...compressed].slice(0, 3));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de lire la photo.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/resolution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, photos }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible d'envoyer la preuve.");
      onSubmitted(result);
      setDescription("");
      setPhotos([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer la preuve.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="resolution-description" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Travaux effectués</label>
        <textarea id="resolution-description" rows={4} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} required placeholder="Décrivez l'intervention et le résultat obtenu..." className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      </div>
      <div className="space-y-2">
        <span className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Photos justificatives (3 maximum)</span>
        <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={(event) => void addPhotos(event.target.files)} />
        <div className="flex flex-wrap gap-2">
          {photos.map((photo, index) => (
            <div key={photo} className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={`Photo justificative ${index + 1}`} className="h-full w-full object-cover" />
              <button type="button" onClick={() => setPhotos((current) => current.filter((_, item) => item !== index))} aria-label="Supprimer la photo" className="absolute right-1 top-1 rounded-full bg-slate-900/80 p-1 text-white"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {photos.length < 3 && (
            <button type="button" onClick={() => fileInput.current?.click()} className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <Camera className="h-5 w-5 text-sky-500" /> Ajouter
            </button>
          )}
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      <Button type="submit" isLoading={loading} disabled={!description.trim()} className="w-full">Envoyer la preuve de résolution</Button>
    </form>
  );
}
````

### `components/incidents/dashboard/IncidentDashboard.tsx`

````tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardDateFilter } from "./DashboardDateFilter";
import { DashboardEmptyState } from "./DashboardEmptyState";
import { IncidentCategoryChart } from "./IncidentCategoryChart";
import { IncidentPriorityList } from "./IncidentPriorityList";
import { IncidentStatCard } from "./IncidentStatCard";
import { IncidentStatusChart } from "./IncidentStatusChart";
import { IncidentTrendChart } from "./IncidentTrendChart";
import { RecentIncidents } from "./RecentIncidents";
import { ResidenceComparisonChart } from "./ResidenceComparisonChart";
import { TechnicianPerformanceTable } from "./TechnicianPerformanceTable";
import type { IncidentDashboardData, IncidentDashboardFilters } from "./types";

export function IncidentDashboard() {
  const router = useRouter();
  const [data, setData] = useState<IncidentDashboardData | null>(null);
  const [filters, setFilters] = useState<IncidentDashboardFilters>({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestNumber, setRequestNumber] = useState(0);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    for (const key of ["from", "to", "residence", "technician"] as const) {
      const value = filters[key];
      if (value) params.set(key, value);
    }

    try {
      const response = await fetch(`/api/incidents/dashboard?${params}`, {
        signal,
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger le tableau des réclamations.");
      const dashboardData = result.data as IncidentDashboardData;
      setData(dashboardData);
      if (!filters.from && !filters.to) {
        setFilters((current) => current.from || current.to ? current : {
          ...current,
          from: dashboardData.dateRange.from.slice(0, 10),
          to: dashboardData.dateRange.to.slice(0, 10),
        });
      }
    } catch (err) {
      if (!signal.aborted) {
        setError(err instanceof Error ? err.message : "Impossible de charger le tableau des réclamations.");
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, requestNumber]);

  useEffect(() => {
    const refresh = () => setRequestNumber((value) => value + 1);
    const refreshWhenVisible = () => {
      if (!document.hidden) refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, 15_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("syndicpro:dashboard-refresh", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("syndicpro:dashboard-refresh", refresh);
    };
  }, []);

  const role = data?.role;
  const isManager = role === "ADMIN" || role === "SYNDIC";
  const isResident = role === "RESIDENT";
  const isTechnician = role === "TECHNICIAN";
  const stats = data?.statistics;

  const updateFilters = (next: IncidentDashboardFilters) => {
    setPage(1);
    setFilters(next);
  };
  const openIncident = (id: string) => router.push(`/incidents?incident=${encodeURIComponent(id)}`);
  const exportReport = () => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.residence) params.set("residence", filters.residence);
    if (filters.technician) params.set("assignedTo", filters.technician);
    window.location.assign(`/api/incidents/export?${params.toString()}`);
  };

  const title = role === "ADMIN"
    ? "Pilotage global des réclamations"
    : role === "SYNDIC"
    ? "Réclamations de mes résidences"
    : role === "RESIDENT"
    ? "Mes réclamations"
    : role === "TECHNICIAN"
    ? "Mon espace d'intervention"
    : "Gestion des réclamations";

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">Suivi opérationnel</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isResident ? "Suivez vos demandes et répondez aux preuves de résolution." : isTechnician ? "Suivez uniquement les interventions qui vous sont assignées." : "Indicateurs agrégés calculés sur vos incidents autorisés."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {role === "ADMIN" && (
            <Button type="button" variant="outline" size="sm" onClick={exportReport}>
              <Download className="h-4 w-4" /> Exporter CSV
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setRequestNumber((value) => value + 1)} isLoading={loading}>
            <RefreshCw className="h-4 w-4" /> Actualiser
          </Button>
        </div>
      </header>

      {data && (
        <DashboardDateFilter
          role={data.role}
          filters={filters}
          residences={data.residences}
          technicians={data.technicians}
          onChange={updateFilters}
        />
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">{error}</div>
          <Button type="button" variant="outline" size="sm" onClick={() => setRequestNumber((value) => value + 1)}>Réessayer</Button>
        </div>
      )}

      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-28 rounded-2xl" />)}
        </div>
      ) : data && stats ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <IncidentStatCard title={isTechnician ? "Interventions assignées" : "Total réclamations"} value={stats.total} icon={<ClipboardList className="h-5 w-5" />} color="blue" />
            <IncidentStatCard title={isTechnician ? "Nouvelles assignations" : isResident ? "En attente" : "Ouvertes"} value={stats.reported + stats.assigned + stats.inProgress} description={isResident ? `${stats.reported + stats.assigned} en attente de prise en charge` : "Non résolues"} icon={<Clock3 className="h-5 w-5" />} color="orange" />
            <IncidentStatCard title="Résolues" value={stats.resolved} description={`Taux : ${stats.resolutionRate}%`} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
            <IncidentStatCard title="Urgentes" value={stats.urgent} description={`${stats.high} priorité haute`} icon={<AlertTriangle className="h-5 w-5" />} color="red" />
            <IncidentStatCard title="À surveiller" value={stats.overdue} description="Ouvertes depuis plus de 72 h" icon={<Wrench className="h-5 w-5" />} color="purple" />
          </div>

          {isResident && data.awaitingConfirmation > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-sky-900 dark:bg-sky-950/30">
              <div>
                <p className="font-semibold text-sky-900 dark:text-sky-200">Une résolution attend votre confirmation</p>
                <p className="mt-1 text-sm text-sky-800 dark:text-sky-300">{data.awaitingConfirmation} réclamation(s) avec une preuve envoyée.</p>
              </div>
              <Button type="button" onClick={() => router.push("/incidents")}>Examiner mes réclamations</Button>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <IncidentTrendChart data={data.monthlyTrends} />
            <IncidentStatusChart data={data.byStatus} total={stats.total} />
          </div>
          <div className={`grid gap-4 ${isManager ? "xl:grid-cols-2" : "xl:grid-cols-[1.1fr_0.9fr]"}`}>
            <IncidentCategoryChart data={data.byCategory} />
            <IncidentPriorityList incidents={data.priorityIncidents} onView={openIncident} />
          </div>

          {isManager && (
            <>
              <TechnicianPerformanceTable data={data.technicianPerformance} />
              <ResidenceComparisonChart data={data.residenceComparison} />
            </>
          )}

          {isTechnician && (
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Assignées", stats.assigned],
                ["En cours", stats.inProgress],
                ["Terminées", stats.resolved],
              ].map(([label, value]) => (
                <IncidentStatCard key={label} title={`Mes tâches ${String(label).toLowerCase()}`} value={value} icon={<UserCheck className="h-5 w-5" />} />
              ))}
              <p className="text-xs text-slate-500 sm:col-span-3">Temps moyen de résolution : {stats.resolved ? `${stats.averageResolutionHours} h` : "—"}</p>
            </div>
          )}

          <RecentIncidents
            incidents={data.recentIncidents.data}
            page={data.recentIncidents.meta.page}
            limit={data.recentIncidents.meta.limit}
            total={data.recentIncidents.meta.total}
            onPageChange={setPage}
            onView={openIncident}
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Activité récente</h2>
            {data.recentActivity.length === 0 ? <div className="mt-3"><DashboardEmptyState message="Aucune activité pour cette période." /></div> : (
              <ol className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {data.recentActivity.map((activity) => (
                  <li key={activity._id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <button type="button" onClick={() => openIncident(activity.incidentId)} className="truncate text-left text-sm font-semibold text-slate-900 hover:text-sky-700 dark:text-white dark:hover:text-sky-300">{activity.title}</button>
                      <p className="text-xs text-slate-500">{activity.description}</p>
                    </div>
                    <time className="shrink-0 text-xs text-slate-500" dateTime={activity.createdAt}>{new Date(activity.createdAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</time>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
````

### `components/incidents/dashboard/DashboardDateFilter.tsx`

````tsx
"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Role } from "@/types/enums";
import type { IncidentDashboardFilters } from "./types";

type Preset = "7days" | "30days" | "3months" | "6months" | "year" | "custom";

function localDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangeFor(preset: Exclude<Preset, "custom">) {
  const today = new Date();
  const to = localDateInput(today);
  const fromDate = new Date(today);
  if (preset === "7days") fromDate.setDate(fromDate.getDate() - 6);
  if (preset === "30days") fromDate.setDate(fromDate.getDate() - 29);
  if (preset === "3months") fromDate.setMonth(fromDate.getMonth() - 3);
  if (preset === "6months") fromDate.setMonth(fromDate.getMonth() - 6);
  if (preset === "year") fromDate.setMonth(0, 1);
  return { from: localDateInput(fromDate), to };
}

export function DashboardDateFilter({
  role,
  filters,
  residences,
  technicians,
  onChange,
}: {
  role: Role;
  filters: IncidentDashboardFilters;
  residences: Array<{ id: string; name: string }>;
  technicians: Array<{ id: string; name: string }>;
  onChange: (filters: IncidentDashboardFilters) => void;
}) {
  const [preset, setPreset] = useState<Preset>("6months");
  const canFilterScope = role === Role.ADMIN || role === Role.SYNDIC;
  const today = localDateInput(new Date());
  const applyPreset = (value: Preset) => {
    setPreset(value);
    if (value !== "custom") {
      onChange({ ...filters, ...rangeFor(value) });
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Période</span>
        <select value={preset} onChange={(event) => applyPreset(event.target.value as Preset)} className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <option value="7days">7 derniers jours</option>
          <option value="30days">30 derniers jours</option>
          <option value="3months">3 derniers mois</option>
          <option value="6months">6 derniers mois</option>
          <option value="year">Cette année</option>
          <option value="custom">Personnalisée</option>
        </select>
      </label>

      {preset === "custom" && (
        <>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Du
            <input type="date" value={filters.from || ""} max={filters.to || today} onChange={(event) => onChange({ ...filters, from: event.target.value })} className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Au
            <input type="date" value={filters.to || ""} min={filters.from || undefined} max={today} onChange={(event) => onChange({ ...filters, to: event.target.value })} className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </label>
        </>
      )}

      {canFilterScope && residences.length > 0 && (
        <label className="flex min-w-44 flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Résidence
          <select value={filters.residence || ""} onChange={(event) => onChange({ ...filters, residence: event.target.value || undefined })} className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option value="">Toutes les résidences autorisées</option>
            {residences.map((residence) => <option key={residence.id} value={residence.id}>{residence.name}</option>)}
          </select>
        </label>
      )}

      {canFilterScope && technicians.length > 0 && (
        <label className="flex min-w-44 flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Technicien
          <select value={filters.technician || ""} onChange={(event) => onChange({ ...filters, technician: event.target.value || undefined })} className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option value="">Tous les techniciens</option>
            {technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.name}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
````

### `components/incidents/dashboard/DashboardEmptyState.tsx`

````tsx
import { ClipboardList } from "lucide-react";

export function DashboardEmptyState({ message = "Aucune réclamation pour cette période." }: { message?: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-8 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <ClipboardList className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">{message}</p>
    </div>
  );
}
````

### `components/incidents/dashboard/IncidentCategoryChart.tsx`

````tsx
"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { IncidentCategory } from "@/types/enums";
import { incidentCategoryLabel } from "@/types/enums";
import { DashboardEmptyState } from "./DashboardEmptyState";

const categories = Object.values(IncidentCategory);

export function IncidentCategoryChart({ data }: { data: Array<{ category: IncidentCategory; count: number }> }) {
  const chartData = categories.map((category) => ({
    name: incidentCategoryLabel[category],
    count: data.find((item) => item.category === category)?.count ?? 0,
  }));
  const hasData = chartData.some((item) => item.count > 0);
  return (
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <div className="p-4 sm:p-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Réclamations par catégorie</h2>
        {!hasData ? <div className="mt-4"><DashboardEmptyState /></div> : (
          <div className="mt-3 h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [value, "Réclamations"]} />
                <Bar dataKey="count" name="Réclamations" fill="#0284c7" radius={[0, 5, 5, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
````

### `components/incidents/dashboard/IncidentPriorityList.tsx`

````tsx
"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { incidentCategoryLabel } from "@/types/enums";
import type { IncidentDashboardData } from "./types";
import { DashboardEmptyState } from "./DashboardEmptyState";

export function IncidentPriorityList({
  incidents,
  onView,
}: {
  incidents: IncidentDashboardData["priorityIncidents"];
  onView: (id: string) => void;
}) {
  return (
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <div className="flex items-center gap-2 p-4 sm:p-5">
        <AlertTriangle className="h-5 w-5 text-rose-600" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Priorité haute / urgente</h2>
      </div>
      {incidents.length === 0 ? <div className="px-4 pb-4 sm:px-5 sm:pb-5"><DashboardEmptyState message="Aucune réclamation urgente ou haute en cours." /></div> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {incidents.map((incident) => (
            <li key={incident._id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <button type="button" onClick={() => onView(incident._id)} className="block max-w-full truncate text-left text-sm font-semibold text-slate-900 hover:text-sky-700 dark:text-white dark:hover:text-sky-300">{incident.title}</button>
                <p className="mt-1 truncate text-xs text-slate-500">{incident.residence?.name ? `${incident.residence.name} · ` : ""}{incidentCategoryLabel[incident.category]}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge priority={incident.priority} />
                <Button variant="ghost" size="sm" onClick={() => onView(incident._id)} aria-label="Ouvrir la réclamation"><ArrowUpRight className="h-4 w-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
````

### `components/incidents/dashboard/IncidentStatCard.tsx`

````tsx
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

const colors = {
  blue: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  orange: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  red: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  purple: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

export interface IncidentStatCardProps {
  title: string;
  value: number | string;
  description?: string;
  icon: ReactNode;
  trend?: number;
  color?: keyof typeof colors;
}

export function IncidentStatCard({
  title,
  value,
  description,
  icon,
  trend,
  color = "blue",
}: IncidentStatCardProps) {
  return (
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
          {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
          {trend !== undefined && (
            <p className="mt-1 text-xs font-medium text-slate-500">
              {trend > 0 ? "+" : ""}{trend}% sur la période
            </p>
          )}
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors[color]}`}>{icon}</span>
      </div>
    </Card>
  );
}
````

### `components/incidents/dashboard/IncidentStatusChart.tsx`

````tsx
"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/Card";
import { incidentStatusLabel, IncidentStatus } from "@/types/enums";
import { DashboardEmptyState } from "./DashboardEmptyState";

const colors: Record<IncidentStatus, string> = {
  REPORTED: "#f97316",
  ASSIGNED: "#eab308",
  IN_PROGRESS: "#0ea5e9",
  RESOLVED: "#10b981",
};

export function IncidentStatusChart({ data, total }: { data: Array<{ status: IncidentStatus; count: number }>; total: number }) {
  const chartData = Object.values(IncidentStatus).map((status) => ({
    status,
    name: incidentStatusLabel[status],
    value: data.find((item) => item.status === status)?.count ?? 0,
  }));
  return (
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <div className="p-4 sm:p-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Réclamations par statut</h2>
        {total === 0 ? <div className="mt-4"><DashboardEmptyState /></div> : (
          <div className="mt-3 grid grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(160px,1fr)_minmax(140px,0.8fr)]">
            <div className="relative h-52 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3} stroke="none">
                    {chartData.map((item) => <Cell key={item.status} fill={colors[item.status]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [value, "Réclamations"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{total}</span>
                <span className="text-xs text-slate-500">au total</span>
              </div>
            </div>
            <ul className="space-y-2">
              {chartData.map((item) => (
                <li key={item.status} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[item.status] }} />{item.name}</span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{item.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
````

### `components/incidents/dashboard/IncidentTrendChart.tsx`

````tsx
"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { DashboardEmptyState } from "./DashboardEmptyState";

export function IncidentTrendChart({ data }: { data: Array<{ month: string; reported: number; resolved: number }> }) {
  const hasData = data.some((item) => item.reported || item.resolved);
  const chartData = data.map((item) => ({
    ...item,
    label: new Date(`${item.month}-01T00:00:00`).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
  }));
  return (
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <div className="p-4 sm:p-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Tendance mensuelle</h2>
        {!hasData ? <div className="mt-4"><DashboardEmptyState /></div> : (
          <div className="mt-3 h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="reported" name="Signalées" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resolved" name="Résolues" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
````

### `components/incidents/dashboard/RecentIncidents.tsx`

````tsx
"use client";

import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { incidentCategoryLabel } from "@/types/enums";
import type { IncidentDashboardData } from "./types";
import { DashboardEmptyState } from "./DashboardEmptyState";

export function RecentIncidents({
  incidents,
  page,
  limit,
  total,
  onPageChange,
  onView,
}: {
  incidents: IncidentDashboardData["recentIncidents"]["data"];
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onView: (id: string) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Réclamations récentes</h2>
          <p className="mt-1 text-xs text-slate-500">{total} au total sur la période</p>
        </div>
      </div>
      {incidents.length === 0 ? <div className="px-4 pb-4 sm:px-5 sm:pb-5"><DashboardEmptyState /></div> : (
        <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr><th className="px-4 py-3">Réclamation</th><th className="px-4 py-3">Résidence</th><th className="px-4 py-3">Priorité</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Détails</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {incidents.map((incident) => (
                <tr key={incident._id} className="text-slate-700 dark:text-slate-300">
                  <td className="px-4 py-3"><p className="font-semibold text-slate-900 dark:text-white">{incident.title}</p><p className="mt-0.5 text-xs text-slate-500">{incidentCategoryLabel[incident.category]}</p></td>
                  <td className="px-4 py-3">{incident.residence?.name || "—"}</td>
                  <td className="px-4 py-3"><Badge priority={incident.priority} /></td>
                  <td className="px-4 py-3"><Badge incidentStatus={incident.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(incident.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => onView(incident._id)} aria-label={`Voir ${incident.title}`}><Eye className="h-4 w-4" /> Ouvrir</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs dark:border-slate-800">
            <span className="text-slate-500">Page {page} sur {pages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Précédent</Button>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Suivant</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
````

### `components/incidents/dashboard/ResidenceComparisonChart.tsx`

````tsx
"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { DashboardEmptyState } from "./DashboardEmptyState";

export function ResidenceComparisonChart({ data }: { data: Array<{ residenceId: string; name: string; incidents: number }> }) {
  return (
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <div className="p-4 sm:p-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Comparaison des résidences</h2>
        {!data.length ? <div className="mt-4"><DashboardEmptyState message="Aucune donnée de résidence pour cette période." /></div> : (
          <div className="mt-3 h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [value, "Réclamations"]} />
                <Bar dataKey="incidents" name="Réclamations" fill="#8b5cf6" radius={[0, 5, 5, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
````

### `components/incidents/dashboard/TechnicianPerformanceTable.tsx`

````tsx
"use client";

import { Card } from "@/components/ui/Card";
import type { IncidentDashboardData } from "./types";
import { DashboardEmptyState } from "./DashboardEmptyState";

export function TechnicianPerformanceTable({ data }: { data: IncidentDashboardData["technicianPerformance"] }) {
  return (
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <div className="p-4 sm:p-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Charge et résolution par technicien</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Temps moyen calculé sur les incidents résolus de la période.</p>
      </div>
      {data.length === 0 ? <div className="px-4 pb-4 sm:px-5 sm:pb-5"><DashboardEmptyState message="Aucune intervention assignée sur cette période." /></div> : (
        <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr><th className="px-4 py-3">Technicien</th><th className="px-4 py-3">Assignées</th><th className="px-4 py-3">Terminées</th><th className="px-4 py-3">En cours</th><th className="px-4 py-3">Temps moyen</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.map((item) => <tr key={item.technicianId} className="text-slate-700 dark:text-slate-300"><td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{item.name}</td><td className="px-4 py-3 tabular-nums">{item.assigned}</td><td className="px-4 py-3 tabular-nums">{item.completed}</td><td className="px-4 py-3 tabular-nums">{item.inProgress}</td><td className="px-4 py-3 tabular-nums">{item.completed ? `${item.averageResolutionHours} h` : "—"}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
````

### `components/incidents/dashboard/types.ts`

````ts
import type { IncidentCategory, IncidentStatus, Priority, Role } from "@/types/enums";

export interface IncidentDashboardData {
  role: Role;
  dateRange: { from: string; to: string };
  statistics: {
    total: number;
    reported: number;
    assigned: number;
    inProgress: number;
    resolved: number;
    urgent: number;
    high: number;
    overdue: number;
    averageResolutionHours: number;
    resolutionRate: number;
  };
  awaitingConfirmation: number;
  byStatus: Array<{ status: IncidentStatus; count: number }>;
  byCategory: Array<{ category: IncidentCategory; count: number }>;
  monthlyTrends: Array<{ month: string; reported: number; resolved: number }>;
  recentActivity: Array<{
    _id: string;
    incidentId: string;
    title: string;
    category: IncidentCategory;
    priority: Priority;
    status: IncidentStatus;
    action: string;
    description: string;
    createdAt: string;
  }>;
  technicianPerformance: Array<{
    technicianId: string;
    name: string;
    assigned: number;
    completed: number;
    inProgress: number;
    averageResolutionHours: number;
  }>;
  residenceComparison: Array<{ residenceId: string; name: string; incidents: number }>;
  residences: Array<{ id: string; name: string }>;
  technicians: Array<{ id: string; name: string }>;
  recentIncidents: {
    data: Array<{
      _id: string;
      title: string;
      category: IncidentCategory;
      priority: Priority;
      status: IncidentStatus;
      createdAt: string;
      residence: { id: string; name: string } | null;
    }>;
    meta: { page: number; limit: number; total: number };
  };
  priorityIncidents: Array<{
    _id: string;
    title: string;
    category: IncidentCategory;
    priority: Priority;
    status: IncidentStatus;
    residence: { id: string; name: string } | null;
  }>;
}

export interface IncidentDashboardFilters {
  from?: string;
  to?: string;
  residence?: string;
  technician?: string;
}
````

### `components/ai/AIIncidentTools.tsx`

````tsx
"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IncidentCategory, Priority } from "@/types/enums";
import { AIButton } from "./AIButton";
import { AIConfidenceIndicator } from "./AIConfidenceIndicator";
import { AIError } from "./AIError";
import { AILoading } from "./AILoading";
import { AIRecommendation, type PrioritySuggestion } from "./AIRecommendation";
import { AIDuplicateWarning, type PossibleDuplicate } from "./AIDuplicateWarning";
import { AIResultCard } from "./AIResultCard";

interface Classification {
  category: IncidentCategory;
  priority: Priority;
  summary: string;
  suggestedAction: string;
  confidence: number;
}

export function AIIncidentTools({
  title,
  description,
  residenceId,
  currentPriority,
  onApply,
  showOnlyDuplicates = false,
}: {
  title: string;
  description: string;
  residenceId: string;
  currentPriority: Priority;
  onApply: (value: { category?: IncidentCategory; priority?: Priority }) => void;
  showOnlyDuplicates?: boolean;
}) {
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [classification, setClassification] = useState<Classification | null>(null);
  const [priority, setPriority] = useState<PrioritySuggestion | null>(null);
  const [matches, setMatches] = useState<PossibleDuplicate[]>([]);

  const request = async (path: string, payload: unknown) => {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Gemini est temporairement indisponible.");
    return data;
  };
  const analyze = async () => {
    setLoading("classify");
    setError("");
    try { setClassification(await request("/api/ai/incidents/classify", { title, description })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Analyse impossible."); }
    finally { setLoading(""); }
  };
  const recommend = async () => {
    setLoading("priority");
    setError("");
    try { setPriority(await request("/api/ai/incidents/priority", { description })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Recommandation impossible."); }
    finally { setLoading(""); }
  };
  const findDuplicates = async () => {
    setLoading("duplicates");
    setError("");
    try {
      const data = await request("/api/ai/incidents/duplicates", { title, description, residenceId });
      setMatches(data.possibleDuplicates);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Recherche impossible."); }
    finally { setLoading(""); }
  };

  return <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
    <p className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><Sparkles className="h-4 w-4 text-sky-600" />{showOnlyDuplicates ? "Vérifiez si une réclamation similaire existe déjà." : "Outils d’aide facultatifs — vos champs ne changent qu’après votre validation."}</p>
    <div className="flex flex-wrap gap-2">
      {!showOnlyDuplicates && (
        <>
          <AIButton disabled={Boolean(loading) || title.trim().length < 3 || description.trim().length < 5} onClick={() => void analyze()}>Analyser avec l’IA</AIButton>
          <Button type="button" variant="outline" disabled={Boolean(loading) || description.trim().length < 5} onClick={() => void recommend()}>Suggérer une priorité</Button>
        </>
      )}
      <Button type="button" variant="outline" disabled={Boolean(loading) || !residenceId || title.trim().length < 3 || description.trim().length < 5} onClick={() => void findDuplicates()}>Vérifier les réclamations similaires</Button>
    </div>
    {loading && <AILoading label={loading === "duplicates" ? "Recherche de correspondances…" : undefined} />}
    {error && <AIError message={error} />}
    {!showOnlyDuplicates && classification && <AIResultCard title="Classification suggérée — à confirmer">
      <div className="space-y-3">
        <p><strong>Catégorie :</strong> {classification.category} · <strong>Priorité :</strong> {classification.priority}</p>
        <p><strong>Résumé :</strong> {classification.summary}</p>
        <p><strong>Action suggérée :</strong> {classification.suggestedAction}</p>
        <AIConfidenceIndicator confidence={classification.confidence} />
        {["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(classification.priority) < ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(currentPriority) && <p className="text-xs text-amber-700 dark:text-amber-300">La priorité actuelle est plus élevée; la suggestion ne la réduira pas.</p>}
        <Button type="button" size="sm" onClick={() => onApply({
          category: classification.category,
          ...( ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(classification.priority) >= ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(currentPriority)
            ? { priority: classification.priority }
            : {}),
        })}>Appliquer les suggestions</Button>
      </div>
    </AIResultCard>}
    {!showOnlyDuplicates && priority && <AIRecommendation result={priority} onAccept={["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(priority.suggestedPriority) >= ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(currentPriority) ? () => onApply({ priority: priority.suggestedPriority }) : undefined} />}
    {!showOnlyDuplicates && priority && ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(priority.suggestedPriority) < ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(currentPriority) && <p className="text-xs text-amber-700 dark:text-amber-300">La recommandation ne peut pas réduire la priorité actuelle.</p>}
    <AIDuplicateWarning matches={matches} />
  </div>;
}
````

### `components/ai/AIPriorityPanel.tsx`

````tsx
"use client";

import { useState } from "react";
import { AIError } from "./AIError";
import { AILoading } from "./AILoading";
import { AIRecommendation, type PrioritySuggestion } from "./AIRecommendation";

export function AIPriorityPanel({
  incidentId,
  description,
  currentPriority,
  onApplied,
}: {
  incidentId: string;
  description: string;
  currentPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  onApplied: (priority: PrioritySuggestion["suggestedPriority"]) => void;
}) {
  const [result, setResult] = useState<PrioritySuggestion | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const getRecommendation = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/ai/incidents/priority", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Recommandation indisponible.");
      setResult(data as PrioritySuggestion);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Recommandation impossible."); }
    finally { setLoading(false); }
  };
  const apply = async () => {
    if (!result) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/incidents/${incidentId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: result.suggestedPriority }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible d’appliquer la priorité.");
      onApplied(result.suggestedPriority);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Mise à jour impossible."); }
    finally { setSaving(false); }
  };
  return <section className="space-y-2 rounded-xl border border-sky-200 p-3 dark:border-sky-900">
    {!result && <button type="button" disabled={loading} onClick={() => void getRecommendation()} className="min-h-10 rounded-lg border border-sky-300 px-3 text-sm font-semibold text-sky-800 disabled:opacity-50 dark:border-sky-800 dark:text-sky-200">Suggérer une priorité avec l’IA</button>}
    {loading && <AILoading />}
    {error && <AIError message={error} />}
    {result && <AIRecommendation result={result} onAccept={!saving && ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(result.suggestedPriority) >= ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(currentPriority) ? () => void apply() : undefined} />}
    {result && ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(result.suggestedPriority) < ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(currentPriority) && <p className="text-xs text-amber-700 dark:text-amber-300">La suggestion est inférieure à la priorité humaine actuelle; elle ne sera pas appliquée automatiquement.</p>}
    {saving && <AILoading label="Enregistrement de la priorité…" />}
  </section>;
}
````

### `components/ai/AIReportPanel.tsx`

````tsx
"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AIError } from "./AIError";
import { AILoading } from "./AILoading";
import { AIResultCard } from "./AIResultCard";

interface Report {
  summary: string;
  observations: string[];
  recommendations: string[];
}

export function AIReportPanel({ endpoint, title }: { endpoint: string; title: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Rapport IA indisponible.");
      setReport(data as Report);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de produire le rapport."); }
    finally { setLoading(false); }
  };

  return <section className="space-y-3">
    <Button type="button" variant="outline" onClick={() => void generate()} disabled={loading}><Sparkles className="h-4 w-4" />{title}</Button>
    {loading && <AILoading label="Analyse des statistiques…" />}
    {error && <AIError message={error} />}
    {report && <AIResultCard title="Rapport IA — basé sur les statistiques de la base">
      <p className="font-medium">{report.summary}</p>
      {report.observations.length > 0 && <div className="mt-3"><strong>Observations</strong><ul className="mt-1 list-disc space-y-1 pl-5">{report.observations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      {report.recommendations.length > 0 && <div className="mt-3"><strong>Pistes de réflexion</strong><ul className="mt-1 list-disc space-y-1 pl-5">{report.recommendations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      <p className="mt-3 text-xs">L’IA explique les indicateurs calculés par SyndicPro; vérifiez les recommandations avant d’agir.</p>
    </AIResultCard>}
  </section>;
}
````

### `components/ai/AIDuplicateReview.tsx`

````tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AILoading } from "./AILoading";
import { AIError } from "./AIError";
import { AIDuplicateWarning, type PossibleDuplicate } from "./AIDuplicateWarning";

export function AIDuplicateReview({
  incidentId,
  residenceId,
  title,
  description,
  onInspect,
}: {
  incidentId: string;
  residenceId: string;
  title: string;
  description: string;
  onInspect: (id: string) => void;
}) {
  const [matches, setMatches] = useState<PossibleDuplicate[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState("");
  const [feedback, setFeedback] = useState("");

  const search = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/ai/incidents/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId, residenceId, title, description }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Recherche impossible.");
      setMatches(data.possibleDuplicates);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Recherche impossible."); }
    finally { setLoading(false); }
  };

  const review = async (targetIncidentId: string, action: "LINK" | "DISMISS") => {
    setReviewingId(targetIncidentId); setError("");
    try {
      const response = await fetch(`/api/incidents/${incidentId}/duplicates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetIncidentId, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible d’enregistrer votre décision.");
      setMatches((current) => current.filter((item) => item.incidentId !== targetIncidentId));
      setFeedback(action === "LINK" ? "Incidents liés comme dossiers associés." : "Correspondance écartée.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Action impossible."); }
    finally { setReviewingId(""); }
  };

  return <section className="space-y-3 rounded-xl border border-sky-200 p-3 dark:border-sky-900">
    <Button type="button" variant="outline" disabled={loading} onClick={() => void search()}>Rechercher des incidents potentiellement similaires</Button>
    <p className="text-xs text-slate-500">Les rapprochements sont des suggestions; un syndic doit examiner et décider avant de lier ou d’écarter.</p>
    {loading && <AILoading label="Analyse des incidents autorisés…" />}
    {error && <AIError message={error} />}
    {feedback && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{feedback}</p>}
    <AIDuplicateWarning matches={matches} context="Correspondance possible uniquement; vérifiez le dossier avant de lier ou d’écarter." />
    {matches.map((item) => <div key={item.incidentId} className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => onInspect(item.incidentId)}>Voir le dossier</Button>
      <Button type="button" size="sm" disabled={Boolean(reviewingId)} onClick={() => void review(item.incidentId, "LINK")}>Lier comme incident associé</Button>
      <Button type="button" variant="ghost" size="sm" disabled={Boolean(reviewingId)} onClick={() => void review(item.incidentId, "DISMISS")}>Écarter cette correspondance</Button>
      {reviewingId === item.incidentId && <AILoading label="Enregistrement…" />}
    </div>)}
  </section>;
}
````

### `components/ai/AiTriagePanel.tsx`

````tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { AIError } from "@/components/ai/AIError";
import { AIResultCard } from "@/components/ai/AIResultCard";
import { Button } from "@/components/ui/Button";

export type AiTriageSuggestion = {
  title: string;
  description: string;
  category: string;
  priority: string;
  specialty: string;
  probableCause: string;
  safetyRisk: boolean;
  confidence: number;
  reasoning: string;
};

type Props = {
  title: string;
  description: string;
  files: File[];
  onApply: (suggestion: {
    title: string;
    description: string;
    category: string;
    priority: string;
  }) => void;
  onSuggestionAccepted?: (suggestion: AiTriageSuggestion) => void;
};

const CATEGORY_LABELS: Record<string, string> = {
  PLUMBING: "Plomberie",
  ELECTRICITY: "Électricité",
  ELEVATOR: "Ascenseur",
  CLEANING: "Nettoyage",
  SECURITY: "Sécurité",
  OTHER: "Autre",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  URGENT: "Urgente",
};

export default function AiTriagePanel({
  title,
  description,
  files,
  onApply,
  onSuggestionAccepted,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiTriageSuggestion | null>(null);
  const analysisRef = useRef<() => Promise<void>>(async () => {});
  const latestRequest = useRef({
    title,
    description,
    files,
    onApply,
    onSuggestionAccepted,
  });

  useEffect(() => {
    latestRequest.current = {
      title,
      description,
      files,
      onApply,
      onSuggestionAccepted,
    };
  }, [description, files, onApply, onSuggestionAccepted, title]);

  useEffect(() => {
    analysisRef.current = async () => {
      const request = latestRequest.current;
      if (request.files.length === 0) return;
      setLoading(true);
      setError(null);
      setResult(null);
      const formData = new FormData();
      if (request.title.trim()) formData.append("title", request.title);
      if (request.description.trim()) formData.append("description", request.description);
      request.files.slice(0, 3).forEach((file) => formData.append("images", file));

      try {
        const response = await fetch("/api/ai/triage", {
          method: "POST",
          body: formData,
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Erreur IA");
        const suggestion = json.data as AiTriageSuggestion;
        setResult(suggestion);
        request.onApply(suggestion);
        request.onSuggestionAccepted?.(suggestion);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Erreur IA");
      } finally {
        setLoading(false);
      }
    };
  }, []);

  useEffect(() => {
    if (files.length > 0) void analysisRef.current();
  }, [files]);

  if (files.length === 0) return null;

  return (
    <div className="space-y-3">
      {files.length > 0 && (
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300" aria-live="polite">
          {loading
            ? "Analyse de la photo en cours avec Gemini…"
            : result
              ? "Suggestions Gemini appliquées aux champs — vérifiez-les avant l'envoi."
              : "La photo sera analysée par Gemini."}
        </p>
      )}

      {error && <AIError message={error} />}
      {error && files.length > 0 && (
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          isLoading={loading}
          onClick={() => void analysisRef.current()}
        >
          <RefreshCw className="h-4 w-4" />
          Réessayer l&apos;analyse
        </Button>
      )}

      {result && (
        <AIResultCard title="Suggestion IA — à vérifier">
          <div className="space-y-3">
            <p><span className="font-semibold">Titre suggéré : </span>{result.title}</p>
            <p><span className="font-semibold">Description suggérée : </span>{result.description}</p>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Catégorie</dt>
                <dd className="font-medium">{CATEGORY_LABELS[result.category] ?? result.category}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Priorité</dt>
                <dd className="font-medium">{PRIORITY_LABELS[result.priority] ?? result.priority}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Spécialité conseillée</dt>
                <dd className="font-medium">{result.specialty}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Confiance estimée</dt>
                <dd className="font-medium">{Math.round(result.confidence * 100)} %</dd>
              </div>
            </dl>

            <p>
              <span className="font-semibold">Cause probable : </span>
              {result.probableCause}
            </p>

            {result.safetyRisk && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Risque potentiel pour la sécurité : vérifiez la situation rapidement.
              </p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              « Autre » indique uniquement que le problème ne correspond pas aux catégories principales. Le titre, la description et la priorité restent proposés. Vérifiez toutes les suggestions avant l&apos;envoi.
            </p>
          </div>
        </AIResultCard>
      )}
    </div>
  );
}
````

### `components/ai/IncidentAIReview.tsx`

````tsx
"use client";

import { useState } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { AIError } from "@/components/ai/AIError";
import { Button } from "@/components/ui/Button";

type AiTriage = {
  probableCause?: string;
  specialty?: string;
  safetyRisk?: boolean;
};

type AiResolutionCheck = {
  verdict?: string;
  explanation?: string;
  confidence?: number;
  checkedAt?: string;
};

type Props = {
  incidentId: string;
  aiTriage?: AiTriage;
  aiResolutionCheck?: AiResolutionCheck;
  resolutionPhotos: string[];
  showTriage: boolean;
  canVerify: boolean;
  onResolutionCheckSaved: (check: AiResolutionCheck) => void;
};

const VERDICT_LABELS: Record<string, string> = {
  FIXED: "Semble résolu",
  PARTIALLY_FIXED: "Partiellement résolu",
  NOT_FIXED: "Semble non résolu",
  UNCLEAR: "Impossible à déterminer",
};

export function IncidentAIReview({
  incidentId,
  aiTriage,
  aiResolutionCheck,
  resolutionPhotos,
  showTriage,
  canVerify,
  onResolutionCheckSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestCheck, setLatestCheck] = useState<AiResolutionCheck | undefined>();
  const resolutionCheck = latestCheck ?? aiResolutionCheck;
  const hasTriage = showTriage && Boolean(aiTriage);
  const canRequestCheck = canVerify && resolutionPhotos.length > 0;

  if (!hasTriage && !resolutionCheck && !canRequestCheck) return null;

  async function verifyResolution() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/ai-verify`, {
        method: "POST",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Vérification IA indisponible");
      setLatestCheck(json.data as AiResolutionCheck);
      onResolutionCheckSaved(json.data as AiResolutionCheck);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Vérification IA indisponible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900 dark:bg-sky-950/20">
      <h3 className="flex items-center gap-2 text-sm font-bold text-sky-900 dark:text-sky-200">
        <Sparkles className="h-4 w-4" />
        Assistance IA
      </h3>

      {hasTriage && (
        <div className="space-y-2 rounded-xl bg-white/70 p-3 text-sm dark:bg-slate-900/50">
          <h4 className="font-semibold text-slate-900 dark:text-white">Analyse IA</h4>
          {aiTriage?.probableCause && <p><span className="font-semibold">Cause probable : </span>{aiTriage.probableCause}</p>}
          {aiTriage?.specialty && <p><span className="font-semibold">Spécialité : </span>{aiTriage.specialty}</p>}
          {aiTriage?.safetyRisk && (
            <p className="flex items-start gap-2 font-semibold text-rose-700 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Risque potentiel pour la sécurité
            </p>
          )}
        </div>
      )}

      {resolutionCheck && (
        <div className="space-y-1 rounded-xl bg-white/70 p-3 text-sm dark:bg-slate-900/50">
          <h4 className="font-semibold text-slate-900 dark:text-white">Vérification de la résolution</h4>
          <p>
            <span className="font-semibold">Avis : </span>
            {VERDICT_LABELS[resolutionCheck.verdict ?? ""] ?? resolutionCheck.verdict ?? "Non disponible"}
          </p>
          {resolutionCheck.explanation && <p>{resolutionCheck.explanation}</p>}
          {typeof resolutionCheck.confidence === "number" && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Confiance estimée : {Math.round(resolutionCheck.confidence * 100)} %
            </p>
          )}
        </div>
      )}

      {canRequestCheck && (
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          isLoading={loading}
          onClick={verifyResolution}
        >
          Vérifier la résolution avec l&apos;IA
        </Button>
      )}

      {error && <AIError message={error} />}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Avis indicatif uniquement : il ne modifie pas le statut de la réclamation.
      </p>
    </section>
  );
}
````

## Annonces et communications

### `app/announcements/page.tsx`

````tsx
import { Suspense } from "react";
import { AnnouncementDashboard } from "@/components/announcements/AnnouncementDashboard";

export default function AnnouncementsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Chargement des annonces…</div>}>
      <AnnouncementDashboard />
    </Suspense>
  );
}
````

### `components/announcements/AnnouncementDashboard.tsx`

````tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  Megaphone,
  Plus,
  Search,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Role } from "@/types/enums";
import { getOfflineSession, getOfflineDB } from "@/lib/offline/db";
import { AnnouncementAttachmentList } from "./AnnouncementAttachmentList";
import { AnnouncementCard } from "./AnnouncementCard";
import { AnnouncementContent } from "./AnnouncementContent";
import { AnnouncementEditor } from "./AnnouncementEditor";
import { AnnouncementEmptyState } from "./AnnouncementEmptyState";
import { AnnouncementReadStats, type AnnouncementReadStatsData } from "./AnnouncementReadStats";
import { AnnouncementCategoryBadge, AnnouncementPriorityBadge, AnnouncementStatusBadge } from "./AnnouncementBadges";
import type { AnnouncementAttachment, AnnouncementItem, AnnouncementResidence } from "./types";
import type { AnnouncementAudience, AnnouncementCategory, AnnouncementPriority, AnnouncementStatus } from "@/types/enums";
import { AIReportPanel } from "@/components/ai/AIReportPanel";
import { AITranslationPanel } from "@/components/ai/AITranslationPanel";
import { useSearchParams } from "next/navigation";

interface ApiList {
  data: AnnouncementItem[];
  meta: { page: number; limit: number; total: number };
}

interface DashboardStats {
  total: number;
  published: number;
  scheduled: number;
  drafts: number;
  expired: number;
  averageReadPercentage: number;
  byResidence?: Array<{
    residenceId: string;
    residenceName: string;
    readCount: number;
    eligibleReadCount: number;
    readPercentage: number;
  }>;
}

const isManagerRole = (role?: Role) => role === Role.ADMIN || role === Role.SYNDIC;

function announcementStatus(item: AnnouncementItem): AnnouncementStatus | "EXPIRED" {
  if (item.status === "PUBLISHED" && item.expiresAt && new Date(item.expiresAt) <= new Date()) return "EXPIRED";
  return item.status;
}

function unwrapList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && "data" in value && Array.isArray(value.data)) return value.data as T[];
  return [];
}

export function AnnouncementDashboard() {
  const searchParams = useSearchParams();
  const announcementFromUrl = searchParams.get("announcement");
  const autoOpenedAnnouncement = useRef<string | null>(null);
  const [role, setRole] = useState<Role>();
  const [userId, setUserId] = useState("");
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [residences, setResidences] = useState<AnnouncementResidence[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [audience, setAudience] = useState("");
  const [sort, setSort] = useState("newest");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [readFilter, setReadFilter] = useState("");
  const [residence, setResidence] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementItem | null>(null);
  const [selected, setSelected] = useState<AnnouncementItem | null>(null);
  const [selectedStats, setSelectedStats] = useState<AnnouncementReadStatsData | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then(async (response) => response.ok ? response.json() : null)
      .then(async (session) => {
        if (!active) return;
        if (session?.user?.id && session.user.role) {
          setUserId(session.user.id);
          setRole(session.user.role as Role);
          return;
        }
        const offlineSession = await getOfflineSession();
        if (active && offlineSession) {
          setUserId(offlineSession.id);
          setRole(offlineSession.role);
          setOffline(true);
        } else if (active) {
          setError("Authentification requise pour consulter les annonces.");
          setLoading(false);
        }
      })
      .catch(async () => {
        const offlineSession = await getOfflineSession();
        if (active && offlineSession) {
          setUserId(offlineSession.id);
          setRole(offlineSession.role);
          setOffline(true);
        } else if (active) {
          setError("Authentification requise pour consulter les annonces.");
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search.trim()) params.set("q", search.trim());
    if (category) params.set("category", category);
    if (priority) params.set("priority", priority);
    if (status && isManagerRole(role)) params.set("status", status);
    if (audience && isManagerRole(role)) params.set("audience", audience);
    if (readFilter && role === Role.RESIDENT) params.set("read", readFilter);
    if (residence && isManagerRole(role)) params.set("residence", residence);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    params.set("sort", sort);
    return params;
  }, [page, limit, search, category, priority, status, audience, readFilter, residence, dateFrom, dateTo, sort, role]);

  const load = useCallback(async (silent = false) => {
    if (!role) return;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    const cacheKey = `${userId}:${query.toString()}`;
    try {
      const response = await fetch(`/api/announcements?${query}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger les annonces.");
      const list = result as ApiList;
      setAnnouncements(list.data || []);
      setTotal(list.meta?.total || 0);
      setOffline(false);
      if (userId) {
        await getOfflineDB().announcementFeeds.put({
          key: cacheKey,
          data: list,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (fetchError) {
      if (!navigator.onLine && userId) {
        const cached = await getOfflineDB().announcementFeeds.get(cacheKey);
        const data = cached?.data as ApiList | undefined;
        if (data?.data) {
          setAnnouncements(data.data);
          setTotal(data.meta?.total || 0);
          setOffline(true);
        } else {
          setError("Hors ligne : aucune annonce déjà consultée ne correspond à ces filtres.");
        }
      } else {
        setError(fetchError instanceof Error ? fetchError.message : "Impossible de charger les annonces.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [role, userId, query]);

  useEffect(() => {
    if (!role) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, role, refreshKey]);

  useEffect(() => {
    if (!isManagerRole(role)) return;
    fetch("/api/residences")
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => setResidences(unwrapList<AnnouncementResidence>(result)))
      .catch(() => setResidences([]));
  }, [role]);

  const loadStats = useCallback(async () => {
    if (!isManagerRole(role)) return;
    try {
      const response = await fetch("/api/announcements/stats", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger les indicateurs.");
      setStats(result as DashboardStats);
    } catch (statsError) {
      setError(statsError instanceof Error ? statsError.message : "Erreur de statistiques.");
    }
  }, [role]);

  const selectedAnnouncementId = selected?._id;
  const refreshSelectedStats = useCallback(async () => {
    if (!selectedAnnouncementId || !isManagerRole(role)) return;
    try {
      const response = await fetch(`/api/announcements/${selectedAnnouncementId}/read-stats`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible d'actualiser les statistiques de lecture.");
      const readStats = result as AnnouncementReadStatsData;
      setSelectedStats(readStats);
      setSelected((current) => current?._id === selectedAnnouncementId ? { ...current, readStats } : current);
    } catch (statsError) {
      setError(statsError instanceof Error ? statsError.message : "Erreur de statistiques.");
    }
  }, [role, selectedAnnouncementId]);

  useEffect(() => {
    if (!isManagerRole(role)) return;
    const timer = window.setTimeout(() => void loadStats(), 0);
    return () => window.clearTimeout(timer);
  }, [loadStats, role, refreshKey]);

  useEffect(() => {
    if (!role || offline) return;
    const refreshVisibleData = () => {
      if (document.visibilityState !== "visible") return;
      void load(true);
      void loadStats();
      void refreshSelectedStats();
    };
    const interval = window.setInterval(refreshVisibleData, 15_000);
    document.addEventListener("visibilitychange", refreshVisibleData);
    window.addEventListener("focus", refreshVisibleData);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshVisibleData);
      window.removeEventListener("focus", refreshVisibleData);
    };
  }, [load, loadStats, offline, refreshSelectedStats, role]);

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 4000);
  };

  const openAnnouncement = useCallback(async (item: AnnouncementItem) => {
    setSelected(item);
    setSelectedStats(null);
    if (role !== Role.RESIDENT || item.isRead) return;
    try {
      const response = await fetch(`/api/announcements/${item._id}/read`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible d'enregistrer la lecture.");
      setAnnouncements((current) => current.map((announcement) =>
        announcement._id === item._id ? { ...announcement, isRead: true } : announcement
      ));
      setSelected((current) => current?._id === item._id ? { ...current, isRead: true } : current);
      const snapshotKey = `${userId}:${query.toString()}`;
      const cached = await getOfflineDB().announcementFeeds.get(snapshotKey);
      const data = cached?.data as ApiList | undefined;
      if (data?.data) {
        data.data = data.data.map((announcement) =>
          announcement._id === item._id ? { ...announcement, isRead: true } : announcement
        );
        await getOfflineDB().announcementFeeds.put({ ...cached!, data });
      }
    } catch (readError) {
      if (navigator.onLine) notify(readError instanceof Error ? readError.message : "Erreur lors de l'enregistrement de lecture.");
    }
  }, [role, userId, query]);

  useEffect(() => {
    if (!announcementFromUrl || !role || autoOpenedAnnouncement.current === announcementFromUrl) return;
    autoOpenedAnnouncement.current = announcementFromUrl;
    const timer = window.setTimeout(() => {
      fetch(`/api/announcements/${encodeURIComponent(announcementFromUrl)}`)
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Annonce inaccessible.");
          await openAnnouncement(result as AnnouncementItem);
        })
        .catch((openError) => setError(openError instanceof Error ? openError.message : "Annonce inaccessible."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [announcementFromUrl, openAnnouncement, role]);

  const openReadStats = async (item: AnnouncementItem) => {
    setSelected(item);
    setLoadingStats(true);
    setSelectedStats(null);
    try {
      const response = await fetch(`/api/announcements/${item._id}/read-stats`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger les statistiques de lecture.");
      setSelectedStats(result as AnnouncementReadStatsData);
    } catch (statsError) {
      notify(statsError instanceof Error ? statsError.message : "Erreur de lecture des statistiques.");
    } finally {
      setLoadingStats(false);
    }
  };

  const uploadFiles = async (files: File[], residenceId: string): Promise<AnnouncementAttachment[]> => {
    const uploaded: AnnouncementAttachment[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("residence", residenceId);
      const response = await fetch("/api/announcements/upload", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Échec du téléversement de ${file.name}`);
      uploaded.push(result.attachment as AnnouncementAttachment);
    }
    return uploaded;
  };

  const saveAnnouncement = async (data: {
    residence: string;
    title: string;
    content: string;
    category: AnnouncementCategory;
    priority: AnnouncementPriority;
    audience: AnnouncementAudience;
    status: AnnouncementStatus;
    scheduledAt: string | null;
    expiresAt: string | null;
    isPinned: boolean;
    attachments: AnnouncementAttachment[];
    files: File[];
  }) => {
    setSaving(true);
    setError("");
    try {
      const uploaded = await uploadFiles(data.files, data.residence);
      const body = {
        ...data,
        files: undefined,
        attachments: [...data.attachments, ...uploaded],
      };
      const response = await fetch(editing ? `/api/announcements/${editing._id}` : "/api/announcements", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible d'enregistrer l'annonce.");
      setEditorOpen(false);
      setEditing(null);
      setPage(1);
      setRefreshKey((value) => value + 1);
      notify(editing ? "Annonce mise à jour." : data.status === "DRAFT" ? "Brouillon enregistré." : data.status === "SCHEDULED" ? "Annonce programmée." : "Annonce publiée.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  };

  const publish = async (item: AnnouncementItem) => {
    const response = await fetch(`/api/announcements/${item._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PUBLISHED" }),
    });
    const result = await response.json();
    if (!response.ok) {
      notify(result.error || "Impossible de publier l'annonce.");
      return;
    }
    notify("Annonce publiée.");
    setRefreshKey((value) => value + 1);
  };

  const archive = async (item: AnnouncementItem) => {
    if (!window.confirm(`Archiver « ${item.title} » ?`)) return;
    const response = await fetch(`/api/announcements/${item._id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) {
      notify(result.error || "Impossible d'archiver l'annonce.");
      return;
    }
    notify("Annonce archivée.");
    setSelected(null);
    setRefreshKey((value) => value + 1);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pendingLoad = loading;
  const title = role === Role.ADMIN ? "Annonces — administration globale"
    : role === Role.SYNDIC ? "Annonces de mes résidences"
    : role === Role.TECHNICIAN ? "Informations pour les techniciens"
    : "Actualités de ma résidence";

  return (
    <AppLayout>
      <main className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-sky-700 dark:text-sky-300">SyndicPro · Communication</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{isManagerRole(role) ? "Publiez, programmez et suivez les communications de vos résidences." : "Consultez les informations qui vous sont destinées."}</p>
          </div>
          {isManagerRole(role) && <Button onClick={() => { setEditing(null); setEditorOpen(true); }} disabled={!residences.length}><Plus className="h-4 w-4" /> Nouvelle annonce</Button>}
        </header>

        {isManagerRole(role) && <AIReportPanel endpoint="/api/ai/reports/announcements" title="Générer le rapport IA des annonces" />}
        {offline && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Mode hors ligne : annonces précédemment consultées sur cet appareil.</div>}
        {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</div>}
        {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span className="flex-1">{error}</span><button type="button" aria-label="Fermer l'erreur" onClick={() => setError("")}><X className="h-4 w-4" /></button></div>}

        {isManagerRole(role) && (
          <section aria-label="Statistiques des annonces" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Total", stats?.total],
              ["Publiées", stats?.published],
              ["Programmées", stats?.scheduled],
              ["Brouillons", stats?.drafts],
              ["Expirées", stats?.expired],
            ].map(([label, value]) => <Card key={String(label)} className="p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value ?? "—"}</p></Card>)}
            <Card className="p-4 sm:col-span-2 lg:col-span-5">
              <div className="flex items-center justify-between text-sm"><span className="font-semibold text-slate-800 dark:text-slate-200">Taux de lecture des résidents</span><strong>{stats?.averageReadPercentage ?? "—"}{stats ? "%" : ""}</strong></div>
              <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded-full bg-sky-600" style={{ width: `${stats?.averageReadPercentage || 0}%` }} /></div>
            </Card>
          </section>
        )}
        {role === Role.ADMIN && (stats?.byResidence?.length || 0) > 0 && (
          <Card className="space-y-3">
            <div><h2 className="text-base font-bold text-slate-900 dark:text-white">Lecture par résidence</h2><p className="mt-1 text-xs text-slate-500">Agrégats uniquement, sans données personnelles.</p></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Résidence</th><th className="py-2">Lectures / éligibles</th><th className="py-2">Taux</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats?.byResidence?.map((row) => <tr key={row.residenceId}><td className="py-2 font-medium text-slate-800 dark:text-slate-200">{row.residenceName}</td><td className="py-2 text-slate-600 dark:text-slate-300">{row.readCount} / {row.eligibleReadCount}</td><td className="py-2 font-semibold">{row.readPercentage}%</td></tr>)}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="relative min-w-48 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input aria-label="Rechercher une annonce" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Rechercher un titre ou un contenu..." className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </label>
            <div className="flex flex-wrap gap-2">
              <select aria-label="Filtrer par catégorie" value={category} onChange={(event) => { setPage(1); setCategory(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="">Toutes catégories</option><option value="GENERAL">Général</option><option value="MAINTENANCE">Maintenance</option><option value="SECURITY">Sécurité</option><option value="MEETING">Réunion</option><option value="PAYMENT">Paiement</option><option value="EMERGENCY">Urgence</option><option value="OTHER">Autre</option>
              </select>
              <select aria-label="Filtrer par priorité" value={priority} onChange={(event) => { setPage(1); setPriority(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="">Toutes priorités</option><option value="URGENT">Urgente</option><option value="HIGH">Haute</option><option value="NORMAL">Normale</option><option value="LOW">Basse</option>
              </select>
              {isManagerRole(role) && <>
                <select aria-label="Filtrer par statut" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  <option value="">Tous les statuts</option><option value="DRAFT">Brouillons</option><option value="SCHEDULED">Programmées</option><option value="PUBLISHED">Publiées</option><option value="EXPIRED">Expirées</option><option value="ARCHIVED">Archivées</option>
                </select>
                {residences.length > 0 && <select aria-label="Filtrer par résidence" value={residence} onChange={(event) => { setPage(1); setResidence(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="">{role === Role.ADMIN ? "Toutes résidences" : "Toutes mes résidences"}</option>{residences.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select>}
                  <select aria-label="Filtrer par destinataires" value={audience} onChange={(event) => { setPage(1); setAudience(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="">Tous les destinataires</option><option value="RESIDENTS">Résidents</option><option value="TECHNICIANS">Techniciens</option><option value="ALL">Tous</option></select>
                </>}
                <select aria-label="Trier les annonces" value={sort} onChange={(event) => { setPage(1); setSort(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="newest">Plus récentes</option><option value="oldest">Plus anciennes</option><option value="priority">Priorité</option></select>
                <label className="flex items-center gap-2 text-xs text-slate-500">Du<input type="date" aria-label="Date de début" max={dateTo || undefined} value={dateFrom} onChange={(event) => { setPage(1); setDateFrom(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
                <label className="flex items-center gap-2 text-xs text-slate-500">Au<input type="date" aria-label="Date de fin" min={dateFrom || undefined} value={dateTo} onChange={(event) => { setPage(1); setDateTo(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
              {(search || category || priority || status || audience || readFilter || residence || dateFrom || dateTo || sort !== "newest") && <Button variant="ghost" size="sm" onClick={() => { setPage(1); setSearch(""); setCategory(""); setPriority(""); setStatus(""); setAudience(""); setReadFilter(""); setResidence(""); setDateFrom(""); setDateTo(""); setSort("newest"); }}>Effacer les filtres</Button>}
              {role === Role.RESIDENT && <select aria-label="Filtrer par lecture" value={readFilter} onChange={(event) => { setPage(1); setReadFilter(event.target.value); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="">Toutes</option><option value="false">Non lues</option><option value="true">Lues</option></select>}
            </div>
          </div>
        </section>

        {pendingLoad ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />)}</div>
          : announcements.length === 0 ? <AnnouncementEmptyState message={error ? "Les annonces n'ont pas pu être chargées." : undefined} />
          : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{announcements.map((item) => <AnnouncementCard key={item._id} announcement={item} manager={isManagerRole(role)} onOpen={() => void openAnnouncement(item)} onEdit={() => { setEditing(item); setEditorOpen(true); }} onPublish={() => void publish(item)} onArchive={() => void archive(item)} onReadStats={() => void openReadStats(item)} />)}</div>}

        {!pendingLoad && total > 0 && <div className="flex items-center justify-between gap-3 text-sm text-slate-500"><span>Page {page} sur {totalPages} · {total} annonce(s)</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" /> Précédent</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Suivant <ChevronRight className="h-4 w-4" /></Button></div></div>}

        {editorOpen && <AnnouncementEditor initial={editing} residences={residences} saving={saving} onClose={() => { setEditorOpen(false); setEditing(null); }} onSubmit={saveAnnouncement} />}

        {selected && <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="announcement-detail-title" className="max-h-[92vh] w-full max-w-3xl space-y-5 overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl dark:bg-slate-900 sm:rounded-2xl sm:p-6">
            <header className="flex items-start justify-between gap-4">
              <div><div className="mb-2 flex flex-wrap gap-2"><AnnouncementCategoryBadge category={selected.category} /><AnnouncementPriorityBadge priority={selected.priority} /><AnnouncementStatusBadge status={announcementStatus(selected)} /></div><h2 id="announcement-detail-title" className="text-xl font-bold text-slate-900 dark:text-white">{selected.title}</h2><p className="mt-1 text-xs text-slate-500">{typeof selected.residence === "string" ? "" : selected.residence.name} · {new Date(selected.publishedAt).toLocaleString("fr-FR")}</p></div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Fermer le détail" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </header>
            {selected.isPinned && <p className="flex items-center gap-2 rounded-xl bg-sky-50 p-3 text-sm font-medium text-sky-800 dark:bg-sky-950/40 dark:text-sky-200"><Bell className="h-4 w-4" />Annonce importante épinglée</p>}
            <AnnouncementContent content={selected.content} />
            <AITranslationPanel content={selected.content} readonly />
            {selected.attachments?.some((attachment) => attachment.mimeType.startsWith("image/")) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {selected.attachments.filter((attachment) => attachment.mimeType.startsWith("image/")).map((attachment) => (
                  <a key={attachment.url} href={`${attachment.url}?inline=1`} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${attachment.url}?inline=1`} alt={attachment.name} loading="lazy" className="max-h-72 w-full object-contain" />
                    <span className="block truncate px-3 py-2 text-xs text-slate-500">{attachment.name}</span>
                  </a>
                ))}
              </div>
            )}
            <AnnouncementAttachmentList attachments={selected.attachments || []} />
            {role === Role.RESIDENT && selected.isRead && <p className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300"><Check className="h-4 w-4" />Lecture enregistrée</p>}
            {isManagerRole(role) && <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200"><Megaphone className="h-4 w-4" />Statistiques de lecture</div>
              {selected.readStats && <AnnouncementReadStats stats={selected.readStats} />}
              {selectedStats && <AnnouncementReadStats stats={selectedStats} />}
              {loadingStats && <p className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Chargement…</p>}
              {!selected.readStats && !selectedStats && !loadingStats && <Button variant="outline" size="sm" onClick={() => void openReadStats(selected)}><Archive className="h-4 w-4" />Actualiser les statistiques</Button>}
            </div>}
            <footer className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800"><Button variant="outline" onClick={() => setSelected(null)}>Fermer</Button></footer>
          </section>
        </div>}
      </main>
    </AppLayout>
  );
}
````

### `components/announcements/AnnouncementAttachmentList.tsx`

````tsx
import { Download, FileImage, FileText } from "lucide-react";
import type { AnnouncementAttachment } from "./types";

export function AnnouncementAttachmentList({ attachments }: { attachments: AnnouncementAttachment[] }) {
  if (!attachments.length) return null;
  return (
    <ul className="space-y-2">
      {attachments.map((attachment) => (
        <li key={attachment.url}>
          <a
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {attachment.mimeType.startsWith("image/") ? <FileImage className="h-5 w-5 text-sky-600" /> : <FileText className="h-5 w-5 text-rose-600" />}
            <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
            <span className="text-xs text-slate-500">{Math.ceil(attachment.size / 1024)} Ko</span>
            <Download className="h-4 w-4" />
          </a>
        </li>
      ))}
    </ul>
  );
}
````

### `components/announcements/AnnouncementCard.tsx`

````tsx
"use client";

import { CalendarClock, CalendarDays, Pin, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { AnnouncementItem } from "./types";
import { AnnouncementAudienceLabel, AnnouncementCategoryBadge, AnnouncementPriorityBadge, AnnouncementStatusBadge } from "./AnnouncementBadges";

function isExpired(item: AnnouncementItem) {
  return item.status === "PUBLISHED" && Boolean(item.expiresAt && new Date(item.expiresAt) <= new Date());
}

export function AnnouncementCard({
  announcement,
  manager,
  onOpen,
  onEdit,
  onPublish,
  onArchive,
  onReadStats,
}: {
  announcement: AnnouncementItem;
  manager: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onPublish: () => void;
  onArchive: () => void;
  onReadStats: () => void;
}) {
  const residence = typeof announcement.residence === "string" ? "" : announcement.residence.name;
  const status = isExpired(announcement) ? "EXPIRED" : announcement.status;
  return (
    <Card className={`flex h-full flex-col gap-3 ${announcement.isPinned ? "border-sky-300 dark:border-sky-800" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            {announcement.isPinned && <Pin aria-label="Annonce épinglée" className="h-4 w-4 shrink-0 text-sky-600" />}
            <h2 className="line-clamp-2 text-base font-bold text-slate-900 hover:text-sky-700 dark:text-white dark:hover:text-sky-300">{announcement.title}</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">{residence || "Résidence"}{residence && typeof announcement.residence !== "string" && announcement.residence.city ? ` · ${announcement.residence.city}` : ""}</p>
        </button>
        {!manager && announcement.isRead === false && <span className="mt-1 rounded-full bg-sky-100 px-2 py-1 text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-200">NOUVEAU</span>}
      </div>

      <p className="line-clamp-3 flex-1 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{announcement.content}</p>
      <div className="flex flex-wrap items-center gap-2">
        <AnnouncementCategoryBadge category={announcement.category} />
        <AnnouncementPriorityBadge priority={announcement.priority} />
        <AnnouncementStatusBadge status={status} />
        <AnnouncementAudienceLabel audience={announcement.audience} />
      </div>
      {manager && announcement.readStats && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500"><span>Lectures</span><strong>{announcement.readStats.readPercentage}%</strong></div>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-1.5 rounded-full bg-sky-600" style={{ width: `${announcement.readStats.readPercentage}%` }} /></div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{status === "SCHEDULED" && announcement.scheduledAt ? new Date(announcement.scheduledAt).toLocaleString("fr-FR") : new Date(announcement.publishedAt).toLocaleDateString("fr-FR")}</span>
        {announcement.expiresAt && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />Expire {new Date(announcement.expiresAt).toLocaleDateString("fr-FR")}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onOpen} className="min-h-10 flex-1 rounded-xl bg-sky-50 px-3 text-sm font-semibold text-sky-800 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-200 dark:hover:bg-sky-900">Ouvrir</button>
        {manager && (
          <>
            <button type="button" onClick={onEdit} className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Modifier</button>
            {announcement.status === "DRAFT" || announcement.status === "SCHEDULED" ? <button type="button" onClick={onPublish} className="min-h-10 rounded-xl border border-emerald-200 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300">Publier</button> : null}
            <button type="button" onClick={onReadStats} className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Statistiques de lecture"><Users className="h-4 w-4" /></button>
            {announcement.status !== "ARCHIVED" && <button type="button" onClick={onArchive} className="min-h-10 rounded-xl border border-rose-200 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300">Archiver</button>}
          </>
        )}
      </div>
    </Card>
  );
}
````

### `components/announcements/AnnouncementContent.tsx`

````tsx
import React from "react";

function inlineContent(text: string, keyPrefix: string): React.ReactNode[] {
  const tokenPattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  const pieces = text.split(tokenPattern);
  return pieces.map((piece, index) => {
    if (piece.startsWith("**") && piece.endsWith("**")) {
      return <strong key={`${keyPrefix}-${index}`}>{piece.slice(2, -2)}</strong>;
    }
    const link = piece.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link) {
      try {
        const url = new URL(link[2]);
        if (url.protocol === "http:" || url.protocol === "https:") {
          return <a key={`${keyPrefix}-${index}`} href={url.href} target="_blank" rel="noreferrer" className="text-sky-700 underline dark:text-sky-300">{link[1]}</a>;
        }
      } catch {
        return piece;
      }
    }
    return piece;
  });
}

export function AnnouncementContent({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
      {content.split(/\r?\n/).map((line, index) => {
        const key = `line-${index}`;
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return <div key={key} className="flex gap-2 pl-2"><span aria-hidden="true">•</span><span>{inlineContent(line.slice(2), key)}</span></div>;
        }
        return <p key={key}>{line ? inlineContent(line, key) : "\u00a0"}</p>;
      })}
    </div>
  );
}
````

### `components/announcements/AnnouncementEditor.tsx`

````tsx
"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AnnouncementContent } from "./AnnouncementContent";
import { AIAnnouncementGenerator } from "@/components/ai/AIAnnouncementGenerator";
import { AITranslationPanel } from "@/components/ai/AITranslationPanel";
import type { AnnouncementItem, AnnouncementResidence, AnnouncementAttachment } from "./types";
import type { AnnouncementAudience, AnnouncementCategory, AnnouncementPriority, AnnouncementStatus } from "@/types/enums";

type PublishMode = "DRAFT" | "PUBLISHED" | "SCHEDULED";

function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function AnnouncementEditor({
  initial,
  residences,
  onClose,
  onSubmit,
  saving,
}: {
  initial: AnnouncementItem | null;
  residences: AnnouncementResidence[];
  onClose: () => void;
  onSubmit: (data: {
    residence: string;
    title: string;
    content: string;
    category: AnnouncementCategory;
    priority: AnnouncementPriority;
    audience: AnnouncementAudience;
    status: AnnouncementStatus;
    scheduledAt: string | null;
    expiresAt: string | null;
    isPinned: boolean;
    attachments: AnnouncementAttachment[];
    files: File[];
  }) => Promise<void>;
  saving: boolean;
}) {
  const initialResidence = typeof initial?.residence === "string" ? initial.residence : initial?.residence._id;
  const [residence, setResidence] = useState(initialResidence || residences[0]?._id || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [content, setContent] = useState(initial?.content || "");
  const [category, setCategory] = useState<AnnouncementCategory>(initial?.category || "GENERAL");
  const [priority, setPriority] = useState<AnnouncementPriority>(initial?.priority || "NORMAL");
  const [audience, setAudience] = useState<AnnouncementAudience>(initial?.audience || "RESIDENTS");
  const [status, setStatus] = useState<PublishMode>(
    initial?.status === "SCHEDULED" ? "SCHEDULED" : initial?.status === "DRAFT" ? "DRAFT" : "PUBLISHED"
  );
  const [scheduledAt, setScheduledAt] = useState(localDateTime(initial?.scheduledAt));
  const [expiresAt, setExpiresAt] = useState(localDateTime(initial?.expiresAt));
  const [isPinned, setIsPinned] = useState(initial?.isPinned || false);
  const [attachments, setAttachments] = useState(initial?.attachments || []);
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({
      residence,
      title,
      content,
      category,
      priority,
      audience,
      status,
      scheduledAt: status === "SCHEDULED" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      isPinned,
      attachments,
      files,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form onSubmit={submit} className="max-h-[95vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl dark:bg-slate-900 sm:rounded-2xl sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{initial ? "Modifier l'annonce" : "Nouvelle annonce"}</h2>
            <p className="mt-1 text-sm text-slate-500">Les annonces planifiées restent invisibles jusqu&apos;à leur date de publication.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300 sm:col-span-2">Résidence
            <select required value={residence} onChange={(event) => setResidence(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
              <option value="">Choisir une résidence</option>{residences.map((item) => <option key={item._id} value={item._id}>{item.name}{item.city ? ` — ${item.city}` : ""}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300 sm:col-span-2">Titre
            <input required minLength={3} maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Catégorie
            <select value={category} onChange={(event) => setCategory(event.target.value as AnnouncementCategory)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
              <option value="GENERAL">Général</option><option value="MAINTENANCE">Maintenance</option><option value="SECURITY">Sécurité</option><option value="MEETING">Réunion</option><option value="PAYMENT">Paiement</option><option value="EMERGENCY">Urgence</option><option value="OTHER">Autre</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Priorité
            <select value={priority} onChange={(event) => setPriority(event.target.value as AnnouncementPriority)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
              <option value="LOW">Basse</option><option value="NORMAL">Normale</option><option value="HIGH">Haute</option><option value="URGENT">Urgente</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Destinataires
            <select value={audience} onChange={(event) => setAudience(event.target.value as AnnouncementAudience)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
              <option value="RESIDENTS">Résidents</option><option value="TECHNICIANS">Techniciens</option><option value="ALL">Tous</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Publication
            <select value={status} onChange={(event) => setStatus(event.target.value as PublishMode)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
              <option value="DRAFT">Enregistrer comme brouillon</option><option value="PUBLISHED">Publier maintenant</option><option value="SCHEDULED">Programmer</option>
            </select>
          </label>
          {status === "SCHEDULED" && <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Date et heure de publication
            <input type="datetime-local" required min={localDateTime(new Date().toISOString())} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800" />
          </label>}
          <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Expiration (facultative)
            <input type="datetime-local" min={status === "SCHEDULED" ? scheduledAt : localDateTime(new Date().toISOString())} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800" />
          </label>
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="announcement-content" className="text-sm font-medium text-slate-700 dark:text-slate-300">Contenu (Markdown léger : **gras**, - liste, [lien](https://...))</label>
            <button type="button" onClick={() => setPreview((value) => !value)} className="text-xs font-semibold text-sky-700 dark:text-sky-300">{preview ? "Modifier" : "Aperçu"}</button>
          </div>
          {preview ? <div className="min-h-40 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><AnnouncementContent content={content} /></div> : <textarea id="announcement-content" required minLength={3} maxLength={20_000} rows={7} value={content} onChange={(event) => setContent(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-800" />}
        </section>
        <AIAnnouncementGenerator
          title={title}
          content={content}
          category={category}
          audience={audience}
          onApply={(suggestion) => {
            setTitle(suggestion.title);
            setContent(suggestion.content);
            setCategory(suggestion.suggestedCategory);
            setPriority(suggestion.suggestedPriority);
          }}
        />
        <AITranslationPanel content={content} onApply={setContent} />

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-sky-600" /> Épingler en haut du fil
        </label>
        <section className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Pièces jointes (PDF/JPG/PNG, 5 Mo chacune, 5 maximum)
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple onChange={(event) => {
              const added = Array.from(event.target.files || []);
              if (attachments.length + files.length + added.length > 5) {
                window.alert("Vous pouvez ajouter jusqu'à 5 pièces jointes.");
                event.target.value = "";
                return;
              }
              setFiles((current) => [...current, ...added]);
            }} className="mt-2 block w-full text-sm" />
          </label>
          <ul className="space-y-1 text-xs text-slate-500">
            {attachments.map((item) => <li key={item.url} className="flex items-center justify-between gap-2"><span className="truncate">{item.name}</span><button type="button" onClick={() => setAttachments((current) => current.filter((value) => value.url !== item.url))} className="text-rose-600">Retirer</button></li>)}
            {files.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2"><span className="truncate">{file.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} className="text-rose-600">Retirer</button></li>)}
          </ul>
        </section>
        <footer className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="submit" isLoading={saving} disabled={!residence || residences.length === 0}>{initial ? "Enregistrer" : status === "DRAFT" ? "Enregistrer le brouillon" : status === "SCHEDULED" ? "Programmer" : "Publier"}</Button>
        </footer>
      </form>
    </div>
  );
}
````

### `components/announcements/AnnouncementEmptyState.tsx`

````tsx
import { Megaphone } from "lucide-react";

export function AnnouncementEmptyState({ message = "Aucune annonce ne correspond à ces filtres." }: { message?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
      <Megaphone className="mx-auto h-9 w-9 text-slate-400" />
      <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">Rien à afficher</h3>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
    </div>
  );
}
````

### `components/announcements/AnnouncementReadStats.tsx`

````tsx
import { Users, CheckCheck, CircleDashed } from "lucide-react";
import { Card } from "@/components/ui/Card";

export interface AnnouncementReadStatsData {
  totalEligibleResidents: number;
  readCount: number;
  unreadCount: number;
  readPercentage: number;
}

export function AnnouncementReadStats({ stats }: { stats: AnnouncementReadStatsData }) {
  return (
    <Card className="space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-white">Suivi des lectures</h3>
        <p className="mt-1 text-sm text-slate-500">Résidents actifs de la résidence concernée</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={stats.readPercentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${stats.readPercentage}% des résidents ont lu l'annonce`}>
        <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${stats.readPercentage}%` }} />
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.readPercentage}% <span className="text-sm font-medium text-slate-500">lus</span></p>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><Users className="mb-1 h-4 w-4 text-slate-500" /><strong>{stats.totalEligibleResidents}</strong><p className="text-xs text-slate-500">Éligibles</p></div>
        <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30"><CheckCheck className="mb-1 h-4 w-4 text-emerald-600" /><strong>{stats.readCount}</strong><p className="text-xs text-slate-500">Lus</p></div>
        <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30"><CircleDashed className="mb-1 h-4 w-4 text-amber-600" /><strong>{stats.unreadCount}</strong><p className="text-xs text-slate-500">Non lus</p></div>
      </div>
    </Card>
  );
}
````

### `components/announcements/AnnouncementBadges.tsx`

````tsx
import { Badge } from "@/components/ui/Badge";
import type { AnnouncementAudience, AnnouncementPriority, AnnouncementCategory, AnnouncementStatus } from "@/types/enums";

const priorityClasses: Record<AnnouncementPriority, string> = {
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  NORMAL: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  HIGH: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  URGENT: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

const statusNames: Record<AnnouncementStatus | "EXPIRED", string> = {
  DRAFT: "Brouillon",
  SCHEDULED: "Programmée",
  PUBLISHED: "Publiée",
  ARCHIVED: "Archivée",
  EXPIRED: "Expirée",
};

const categoryNames: Record<AnnouncementCategory, string> = {
  GENERAL: "Général",
  MAINTENANCE: "Maintenance",
  SECURITY: "Sécurité",
  MEETING: "Réunion",
  PAYMENT: "Paiement",
  EMERGENCY: "Urgence",
  OTHER: "Autre",
};

export function AnnouncementPriorityBadge({ priority }: { priority: AnnouncementPriority }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClasses[priority]}`}>{priority}</span>;
}

export function AnnouncementStatusBadge({ status }: { status: AnnouncementStatus | "EXPIRED" }) {
  const variant = status === "PUBLISHED" ? "success" : status === "SCHEDULED" ? "info" : status === "EXPIRED" ? "warning" : "neutral";
  return <Badge variant={variant}>{statusNames[status]}</Badge>;
}

export function AnnouncementCategoryBadge({ category }: { category: AnnouncementCategory }) {
  return <Badge variant="neutral">{categoryNames[category]}</Badge>;
}

export function AnnouncementAudienceLabel({ audience }: { audience: AnnouncementAudience }) {
  return <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{audience === "ALL" ? "Tous" : audience === "RESIDENTS" ? "Résidents" : "Techniciens"}</span>;
}
````

### `components/announcements/types.ts`

````ts
import type {
  AnnouncementAudience,
  AnnouncementCategory,
  AnnouncementPriority,
  AnnouncementStatus,
} from "@/types/enums";

export interface AnnouncementAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface AnnouncementItem {
  _id: string;
  residence: string | { _id: string; name: string; city?: string };
  author?: string | { _id: string; name: string };
  title: string;
  content: string;
  publishedAt: string;
  scheduledAt?: string | null;
  expiresAt?: string | null;
  isPinned: boolean;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  attachments: AnnouncementAttachment[];
  isRead?: boolean;
  readStats?: {
    totalEligibleResidents: number;
    readCount: number;
    unreadCount: number;
    readPercentage: number;
  };
}

export interface AnnouncementResidence {
  _id: string;
  name: string;
  city?: string;
}
````

### `components/ai/AITranslationPanel.tsx`

````tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AIButton } from "./AIButton";
import { AIError } from "./AIError";
import { AILoading } from "./AILoading";
import { AIResultCard } from "./AIResultCard";

interface Translation {
  translatedContent: string;
  detectedLanguage: string;
}

export function AITranslationPanel({ content, onApply, readonly = false }: { content: string; onApply?: (translation: string) => void; readonly?: boolean }) {
  const [targetLanguage, setTargetLanguage] = useState("EN");
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const translate = async () => {
    setLoading(true); setError(""); setTranslation(null);
    try {
      const response = await fetch("/api/ai/announcements/translate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, targetLanguage }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Traduction indisponible.");
      setTranslation(data as Translation);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Traduction impossible."); }
    finally { setLoading(false); }
  };
  return <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs font-medium">Traduire vers<select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} className="mt-1 min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="FR">Français</option><option value="AR">العربية</option><option value="EN">English</option></select></label>
      <AIButton disabled={loading || content.trim().length === 0} onClick={() => void translate()}>Traduire</AIButton>
    </div>
    {loading && <AILoading label="Traduction en cours…" />}
    {error && <AIError message={error} />}
    {translation && <AIResultCard title={`Traduction ${translation.detectedLanguage} → ${targetLanguage} — à vérifier`}>
      <div className={targetLanguage === "AR" ? "space-y-3 text-right" : "space-y-3"} dir={targetLanguage === "AR" ? "rtl" : "auto"}>
        {readonly
          ? <p className="whitespace-pre-wrap">{translation.translatedContent}</p>
          : <textarea aria-label="Modifier la traduction avant utilisation" rows={6} maxLength={20000} value={translation.translatedContent} onChange={(event) => setTranslation({ ...translation, translatedContent: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-800" />}
        {!readonly && onApply && <Button type="button" size="sm" onClick={() => onApply(translation.translatedContent)}>Remplacer le contenu après confirmation</Button>}
      </div>
    </AIResultCard>}
  </div>;
}
````

## Activite et documents

### `app/activity/page.tsx`

````tsx
import { Suspense } from "react";
import { ActivityCenter } from "@/components/activity/ActivityCenter";
import { auth } from "@/auth";

async function AuthenticatedActivityCenter() {
  const session = await auth();
  return <ActivityCenter userId={session?.user?.id} />;
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Chargement de l’activité…</div>}>
      <AuthenticatedActivityCenter />
    </Suspense>
  );
}
````

### `components/activity/ActivityCenter.tsx`

````tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Megaphone, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ActivityItem {
  id: string;
  kind: "INCIDENT" | "ANNOUNCEMENT";
  title: string;
  message: string;
  createdAt: string;
  href: string;
}

export function ActivityCenter({ userId }: { userId?: string }) {
  const [rows, setRows] = useState<ActivityItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [kind, setKind] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setError("Authentification requise.");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (kind) params.set("kind", kind);
      const response = await fetch(`/api/activity?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Impossible de charger l'activité.");
      setRows(payload.data);
      setTotal(payload.meta.total);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }, [kind, page, userId]);

  useEffect(() => {
    if (!userId) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, userId]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">Historique partagé</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Centre d’activité</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Événements visibles selon votre rôle et vos accès.</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={kind} onChange={(event) => { setKind(event.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
              <option value="">Tous les événements</option><option value="INCIDENT">Réclamations</option><option value="ANNOUNCEMENT">Annonces</option>
            </select>
            <Button variant="secondary" onClick={() => void load()} disabled={loading} aria-label="Actualiser l’activité">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}

        <Card><CardContent className="p-4 sm:p-6">
          {rows.length === 0 && !loading ? (
            <div className="py-10 text-center text-sm text-slate-500">Aucune activité pour ces filtres.</div>
          ) : (
            <ol className="space-y-0">
              {rows.map((item, index) => {
                const Icon = item.kind === "INCIDENT" ? AlertTriangle : Megaphone;
                return (
                  <li key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {index < rows.length - 1 && <span className="absolute left-[17px] top-9 h-[calc(100%-1.25rem)] w-px bg-slate-200 dark:bg-slate-700" />}
                    <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.kind === "INCIDENT" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" : "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={item.href} className="font-semibold text-slate-900 hover:text-sky-700 dark:text-white dark:hover:text-sky-300">{item.title}</Link>
                      <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-300">{item.message}</p>
                      <time className="mt-1 block text-xs text-slate-400" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent></Card>
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
          <span>{total} événement(s)</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</Button>
            <Button variant="secondary" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)}>Suivant</Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
````

### `app/documents/page.tsx`

````tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { ResourcePage } from "@/components/crud/ResourcePage";
import { documentConfig } from "@/lib/resources/registry";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { Role } from "@/types/enums";
import { getOfflineSession } from "@/lib/offline/db";

export default function DocumentsPage() {
  const [userRole, setUserRole] = useState<Role | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [residences, setResidences] = useState<Array<{ label: string; value: string }>>([]);
  const [selectedResidence, setSelectedResidence] = useState("");
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("OTHER");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role as Role);
      })
      .catch(() => {
        getOfflineSession().then((offline) => {
          if (offline) setUserRole(offline.role);
        });
      });

    // Chargement des résidences
    fetchWithOffline<any>("/api/residences")
      .then((res) => {
        const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const opts = items.map((r: any) => ({
          label: r.name,
          value: r._id,
        }));
        setResidences(opts);
        if (opts.length > 0) setSelectedResidence(opts[0].value);
      })
      .catch(() => {});
  }, []);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage("Veuillez choisir un fichier (PDF ou image, max 5 Mo).");
      return;
    }
    if (!selectedResidence) {
      setErrorMessage("Veuillez sélectionner une résidence.");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      // 1. Envoi du fichier à /api/documents/upload
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || "Erreur lors du téléversement du fichier");
      }

      // 2. Création de la ressource Document avec l'URL renvoyée
      const createRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residence: selectedResidence,
          title: title.trim() || file.name,
          type: docType,
          fileUrl: uploadData.fileUrl,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData.error || "Erreur lors de l'enregistrement du document");
      }

      setSuccessMessage("Document téléversé et enregistré avec succès !");
      setIsModalOpen(false);
      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setRefreshTrigger((prev) => prev + 1);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erreur de téléversement");
    } finally {
      setIsUploading(false);
    }
  };

  const isStaff = userRole === Role.ADMIN || userRole === Role.SYNDIC;

  return (
    <>
      <ResourcePage
        key={refreshTrigger}
        config={documentConfig}
        title="Documents & Contrats"
        description="Règlements, procès-verbaux, contrats et attestations de la copropriété."
        headerExtra={() => (
          <div className="space-y-3">
            {successMessage && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-50/80 p-3.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {isStaff && (
              <div className="flex flex-col gap-2 rounded-2xl border border-sky-500/20 bg-sky-50/50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-sky-500/20 dark:bg-sky-950/20">
                <div>
                  <h4 className="text-sm font-bold text-sky-950 dark:text-sky-200">
                    Dépôt de document certifié
                  </h4>
                  <p className="text-xs text-sky-700/80 dark:text-sky-400">
                    Téléversez un document PDF ou une image (max 5 Mo) validé côté serveur.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setErrorMessage(null);
                    setIsModalOpen(true);
                  }}
                  className="min-h-[44px] gap-2 whitespace-nowrap text-xs sm:min-h-[36px]"
                >
                  <UploadCloud className="h-4 w-4" />
                  Téléverser un document
                </Button>
              </div>
            )}
          </div>
        )}
      />

      <BottomSheet
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Téléverser un document"
        description="Fichier PDF ou image jusqu'à 5 Mo, stocké de façon sécurisée."
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4 pt-2 pb-4">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Select
            label="Résidence concernée"
            required
            options={residences}
            value={selectedResidence}
            onChange={(e) => setSelectedResidence(e.target.value)}
            disabled={isUploading}
          />

          <Input
            label="Titre du document"
            placeholder="Ex : PV Assemblée Générale 2026"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={isUploading}
          />

          <Select
            label="Catégorie de document"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            required
            disabled={isUploading}
            options={[
              { label: "Procès-verbal d'assemblée", value: "MINUTES" },
              { label: "Règlement de copropriété", value: "RULES" },
              { label: "Contrat", value: "CONTRACT" },
              { label: "Facture", value: "INVOICE" },
              { label: "Autre", value: "OTHER" },
            ]}
          />

          {/* Fichier input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Fichier (PDF ou image JPEG/PNG/WEBP, max 5 Mo)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const files = e.target.files;
                if (files && files[0]) {
                  setFile(files[0]);
                  if (!title) setTitle(files[0].name.replace(/\.[^/.]+$/, ""));
                }
              }}
              required
              className="block w-full text-xs text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-sky-50 file:px-4 file:py-2.5 file:text-xs file:font-semibold file:text-sky-700 hover:file:bg-sky-100 dark:text-slate-400 dark:file:bg-sky-950/40 dark:file:text-sky-300"
            />
            {file && (
              <p className="text-[11px] text-slate-500">
                Fichier sélectionné : {file.name} ({(file.size / 1024 / 1024).toFixed(2)} Mo)
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isUploading}
              className="min-h-[44px]"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isUploading}
              className="min-h-[44px]"
            >
              Téléverser et enregistrer
            </Button>
          </div>
        </form>
      </BottomSheet>
    </>
  );
}
````

## Intelligence de gestion (optionnelle)

### `app/ai-intelligence/page.tsx`

````tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import AIIntelligenceDashboard from "@/components/ai-intelligence/AIIntelligenceDashboard";
import { Role } from "@/types/enums";

export const metadata: Metadata = {
  title: "AI Intelligence | SyndicPro",
  description: "Analyse intelligente de vos réclamations et annonces.",
};

async function AuthorizedAIIntelligencePage() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/ai-intelligence");
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.SYNDIC) {
    redirect("/forbidden");
  }

  return (
    <AppLayout user={session.user}>
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <AIIntelligenceDashboard />
      </main>
    </AppLayout>
  );
}

export default function AIIntelligencePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Chargement de l’analyse…</div>}>
      <AuthorizedAIIntelligencePage />
    </Suspense>
  );
}
````

### `components/ai-intelligence/AIExplanationDialog.tsx`

````tsx
"use client";

import { useState } from "react";
import { LoaderCircle, Sparkles, X } from "lucide-react";
import type { RecurringPattern } from "@/types/ai-intelligence";

type Explanation = { summary: string; observations: string[]; recommendations: string[] };

export default function AIExplanationDialog({ pattern, onClose }: { pattern: RecurringPattern; onClose: () => void }) {
  const [result, setResult] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const explain = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai/intelligence/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          residenceId: pattern.residenceId,
          patternId: pattern.id,
          incidentIds: pattern.complaintIds,
        }),
      });
      const payload: { data?: Explanation; error?: string; message?: string } = await response.json();
      if (!response.ok || !payload.data) throw new Error(payload.error ?? payload.message ?? "L’explication n’a pas pu être générée.");
      setResult(payload.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div role="presentation" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="ai-explanation-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-2xl sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div><span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600"><Sparkles aria-hidden="true" className="h-4 w-4" />Analyse à la demande</span><h2 id="ai-explanation-title" className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">Expliquer ce rapprochement</h2></div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </header>
        <div className="mt-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60"><p className="font-medium text-slate-900 dark:text-white">{pattern.title}</p><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{pattern.evidence}</p><p className="mt-3 text-xs text-slate-500">{pattern.complaintCount} réclamations · {pattern.periodLabel}</p></div>
        {!result && !error && <p className="mt-4 text-sm text-slate-500">L’explication utilise uniquement les informations autorisées de ce groupe et n’est générée qu’après votre demande.</p>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
        {result && <div className="mt-5 space-y-4 text-sm leading-6 text-slate-700 dark:text-slate-300"><p>{result.summary}</p><div><h3 className="font-semibold text-slate-900 dark:text-white">Observations</h3><ul className="mt-1 list-disc space-y-1 pl-5">{result.observations.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div><div><h3 className="font-semibold text-slate-900 dark:text-white">Pistes d’action</h3><ul className="mt-1 list-disc space-y-1 pl-5">{result.recommendations.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div><p className="rounded-lg border border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-700">Une similarité observée ne confirme pas une cause commune et ne démontre pas de causalité.</p></div>}
        <footer className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Fermer</button>
          <button type="button" disabled={loading} onClick={() => void explain()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{result ? "Regénérer" : "Générer l’explication"}</button>
        </footer>
      </section>
    </div>
  );
}
````

### `components/ai-intelligence/AIIntelligenceDashboard.tsx`

````tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, CalendarDays, RefreshCw } from "lucide-react";
import AIOverviewCards from "./AIOverviewCards";
import AnnouncementDraftDialog from "./AnnouncementDraftDialog";
import AnnouncementImpact from "./AnnouncementImpact";
import AIExplanationDialog from "./AIExplanationDialog";
import AIIntelligenceSkeleton from "./AIIntelligenceSkeleton";
import CommunicationOpportunities from "./CommunicationOpportunities";
import ComplaintTrends from "./ComplaintTrends";
import NeedsAttention from "./NeedsAttention";
import RecurringIssues from "./RecurringIssues";
import type {
  AIIntelligenceResponse,
  AnnouncementImpactItem,
  AnnouncementSuggestion,
  IntelligenceAnalyticsApiData,
  RecurringPattern,
} from "@/types/ai-intelligence";
import { incidentCategoryLabel } from "@/types/enums";

function localDate(date: Date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 10);
}

function displayDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}

function categoryName(category: string) {
  return category in incidentCategoryLabel
    ? incidentCategoryLabel[category as keyof typeof incidentCategoryLabel]
    : category;
}

function normalizeData(api: IntelligenceAnalyticsApiData): AIIntelligenceResponse {
  const recurringPatterns: RecurringPattern[] = api.recurringProblems.map((pattern) => ({
    id: pattern.id,
    residenceId: pattern.residenceId,
    title: pattern.detectionMethod === "category_count"
      ? `Plusieurs réclamations · ${categoryName(pattern.category)}`
      : pattern.detectionMethod === "semantic_embedding"
      ? `Descriptions de sens proche · ${categoryName(pattern.category)}`
      : pattern.sharedTerms.length
      ? `Descriptions similaires : ${pattern.sharedTerms.slice(0, 3).join(" · ")}`
      : `Réclamations similaires · ${categoryName(pattern.category)}`,
    patternType: pattern.detectionMethod === "category_count" ? "category" : "description",
    complaintCount: pattern.count,
    category: pattern.category,
    location: pattern.location ?? undefined,
    periodLabel: `Du ${displayDate(pattern.firstReportedAt)} au ${displayDate(pattern.latestReportedAt)}`,
    evidence: pattern.detectionMethod === "category_count"
      ? "Au moins trois réclamations de cette résidence ont la même catégorie. Les descriptions ne montrent pas de rapprochement textuel suffisant : vérifiez manuellement s’il s’agit du même problème."
      : pattern.detectionMethod === "semantic_embedding"
      ? "Les descriptions ont un sens proche selon leur représentation multilingue. Vérifiez les réclamations : cette similarité ne confirme pas une cause commune."
      : `Chevauchement textuel détecté${pattern.sharedTerms.length ? ` autour de : ${pattern.sharedTerms.join(", ")}` : ""}. Cela suggère une similarité de description, pas une cause commune confirmée.`,
    complaintIds: pattern.incidentIds,
    evidenceLevel: pattern.evidenceLevel,
    detectionMethod: pattern.detectionMethod,
    reviewStatus: pattern.reviewStatus,
    patternKey: pattern.patternKey,
    sharedTerms: pattern.sharedTerms,
    statuses: pattern.statuses,
    priorities: pattern.priorities,
  }));
  const suggestions: AnnouncementSuggestion[] = api.announcementSuggestions.map((suggestion) => ({
    ...suggestion,
    residenceName: api.residences.find((residence) => residence.id === suggestion.residenceId)?.name,
  }));
  const announcementImpact: AnnouncementImpactItem[] = api.announcementEffectiveness.comparisons.map((comparison) => {
    const publishedAt = comparison.publishedAt ?? api.lastUpdated;
    const publishedMs = new Date(publishedAt).getTime();
    return {
      id: comparison.announcementId,
      title: comparison.title,
      publishedAt,
      category: comparison.category,
      beforeCount: comparison.beforeCount,
      afterCount: comparison.afterCount,
      beforePeriod: comparison.beforePeriod
        ? { start: comparison.beforePeriod.from, end: comparison.beforePeriod.to }
        : { start: new Date(publishedMs - 30 * 86_400_000).toISOString(), end: publishedAt },
      afterPeriod: comparison.afterPeriod
        ? { start: comparison.afterPeriod.from, end: comparison.afterPeriod.to }
        : { start: publishedAt, end: new Date(publishedMs + 30 * 86_400_000).toISOString() },
      sufficientData: comparison.status === "available",
      limitation: comparison.reason,
      percentageChange: comparison.beforeCount && comparison.afterCount !== undefined
        ? Number((((comparison.afterCount - comparison.beforeCount) / comparison.beforeCount) * 100).toFixed(1))
        : undefined,
    };
  });

  return {
    metrics: api.metrics,
    recurringPatterns,
    attentionComplaints: api.attentionComplaints,
    trends: api.trendSeries.map((point) => ({
      period: point.date,
      count: point.complaints,
      unresolvedCount: point.unresolved,
    })),
    categories: api.categories,
    statuses: api.statuses,
    communicationOpportunities: api.communicationOpportunities.map((opportunity) => ({
      ...opportunity,
      residenceName: opportunity.residenceName
        ?? api.residences.find((residence) => residence.id === opportunity.residenceId)?.name,
    })),
    announcementImpact,
    announcementSuggestions: suggestions,
    residences: api.residences,
    lastUpdated: api.lastUpdated,
    complaintComparison: {
      current: api.comparison.currentComplaintCount,
      previous: api.comparison.previousComplaintCount,
      change: api.comparison.change,
      changePercent: api.comparison.changePercent,
    },
    analysisCoverage: api.analysisCoverage,
  };
}

export default function AIIntelligenceDashboard() {
  const router = useRouter();
  const [data, setData] = useState<AIIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(() => localDate(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(() => localDate(new Date()));
  const [residence, setResidence] = useState("");
  const [selectedPattern, setSelectedPattern] = useState<RecurringPattern | null>(null);
  const [draftPattern, setDraftPattern] = useState<RecurringPattern | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AnnouncementSuggestion | null>(null);
  const [previewSuggestion, setPreviewSuggestion] = useState<AnnouncementSuggestion | null>(null);
  const [complaintIds, setComplaintIds] = useState<string[] | null>(null);
  const [reviewingPatternId, setReviewingPatternId] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (residence) params.set("residence", residence);
    return params.toString();
  }, [from, to, residence]);

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/ai/intelligence/analytics${query ? `?${query}` : ""}`, {
        method: "GET",
        cache: "no-store",
      });
      const payload: { success?: boolean; data?: IntelligenceAnalyticsApiData; error?: string; message?: string } = await response.json();
      if (!response.ok || !payload.data) {
        if (response.status === 403) throw new Error("Accès réservé aux comptes ADMIN et SYNDIC autorisés.");
        throw new Error(payload.error ?? payload.message ?? "Impossible de charger les données d’intelligence.");
      }
      setData(normalizeData(payload.data));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Une erreur inattendue est survenue.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const refreshAfterSave = () => { void loadData(true); };
  const openComplaint = (id: string) => router.push(`/incidents?incident=${encodeURIComponent(id)}`);
  const reviewPattern = async (pattern: RecurringPattern, status: "CONFIRMED" | "DISMISSED" | "CLEAR") => {
    setReviewingPatternId(pattern.id);
    setError("");
    try {
      const response = await fetch("/api/ai/intelligence/patterns/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          residenceId: pattern.residenceId,
          patternId: pattern.id,
          incidentIds: pattern.complaintIds,
          status,
        }),
      });
      const result: { error?: string; message?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? result.message ?? "Le retour n'a pas été enregistré.");
      await loadData(true);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Le retour n'a pas été enregistré.");
    } finally {
      setReviewingPatternId("");
    }
  };

  if (loading && !data) return <AIIntelligenceSkeleton />;

  if (!data && error) {
    return (
      <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 dark:border-rose-900 dark:bg-rose-950/30">
        <h1 className="font-semibold text-rose-900 dark:text-rose-100">Impossible de charger AI Intelligence</h1>
        <p className="mt-2 text-sm text-rose-800 dark:text-rose-200">{error}</p>
        <button type="button" onClick={() => void loadData()} className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800">Réessayer</button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8 pb-10">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2"><span className="rounded-xl bg-indigo-100 p-2 dark:bg-indigo-950/60"><BrainCircuit aria-hidden="true" className="h-5 w-5 text-indigo-700 dark:text-indigo-300" /></span><span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">SYNDICPRO INTELLIGENCE</span></div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">AI Intelligence</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Analyse intelligente de vos réclamations et annonces : tendances, suivis et occasions de communication.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">Du<input type="date" max={to || localDate(new Date())} value={from} onChange={(event) => setFrom(event.target.value)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" /></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">Au<input type="date" max={localDate(new Date())} min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" /></label>
          {data.residences.length > 1 && <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">Résidence<select value={residence} onChange={(event) => setResidence(event.target.value)} className="min-h-10 min-w-44 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><option value="">Toutes mes résidences</option>{data.residences.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          <button type="button" disabled={refreshing} onClick={() => void loadData(true)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Actualiser</button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        <span className="inline-flex items-center gap-2"><CalendarDays aria-hidden="true" className="h-4 w-4" />Période du {displayDate(from || data.lastUpdated)} au {displayDate(to || data.lastUpdated)}</span>
        <span>Mise à jour : {new Date(data.lastUpdated).toLocaleString("fr-FR")}</span>
      </div>
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><p>{error} Les dernières données chargées restent affichées.</p><button type="button" onClick={() => void loadData(true)} className="font-semibold underline">Réessayer</button></div>}

      <AIOverviewCards metrics={data.metrics} />
      {data.complaintComparison && <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">Période précédente : {data.complaintComparison.previous.toLocaleString("fr-FR")} réclamations · évolution du volume : {data.complaintComparison.change > 0 ? "+" : ""}{data.complaintComparison.change.toLocaleString("fr-FR")}{data.complaintComparison.changePercent === null ? "" : ` (${data.complaintComparison.changePercent > 0 ? "+" : ""}${data.complaintComparison.changePercent} %)`}. Cette comparaison ne prouve aucune causalité.</p>}
      {(data.analysisCoverage?.patternAnalysisTruncated || data.analysisCoverage?.attentionAnalysisTruncated) && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Le volume des réclamations dépasse la limite d’échantillonnage pour une partie de l’analyse. Les tendances agrégées restent exactes, mais certains rapprochements ou éléments à examiner peuvent manquer.</p>}

      <section>
        <div className="mb-4"><h2 className="text-lg font-semibold text-slate-900 dark:text-white">Problèmes récurrents possibles</h2><p className="mt-1 text-sm text-slate-500">Rapprochements fondés sur le sens des descriptions, leurs mots ou leur catégorie. Ils ne confirment pas une cause commune.</p></div>
        <RecurringIssues
          patterns={data.recurringPatterns}
          onExplain={setSelectedPattern}
          onViewComplaints={setComplaintIds}
          onReview={(pattern, status) => void reviewPattern(pattern, status)}
          reviewingPatternId={reviewingPatternId}
        />
      </section>

      <section>
        <div className="mb-4"><h2 className="text-lg font-semibold text-slate-900 dark:text-white">À examiner</h2><p className="mt-1 text-sm text-slate-500">Règles déterministes basées sur le statut, la priorité et les éléments liés.</p></div>
        <NeedsAttention complaints={data.attentionComplaints} onOpen={openComplaint} />
      </section>

      <ComplaintTrends data={data.trends} categories={data.categories} statuses={data.statuses} />

      <CommunicationOpportunities
        opportunities={data.communicationOpportunities}
        suggestions={data.announcementSuggestions}
        patterns={data.recurringPatterns}
        onCreateDraft={setDraftPattern}
        onEditDraft={setSelectedSuggestion}
        onPreview={setPreviewSuggestion}
      />

      <AnnouncementImpact
        items={data.announcementImpact}
        emptyReason="Une comparaison apparaîtra après publication d’une annonce IA approuvée et après observation des deux périodes de 30 jours."
      />

      {selectedPattern && <AIExplanationDialog key={selectedPattern.id} pattern={selectedPattern} onClose={() => setSelectedPattern(null)} />}
      {draftPattern && <AnnouncementDraftDialog key={`new-${draftPattern.id}`} pattern={draftPattern} onClose={() => setDraftPattern(null)} onSaved={refreshAfterSave} />}
      {selectedSuggestion && <AnnouncementDraftDialog key={`edit-${selectedSuggestion.id}`} suggestion={selectedSuggestion} onClose={() => setSelectedSuggestion(null)} onSaved={refreshAfterSave} />}
      {previewSuggestion && <AnnouncementDraftDialog key={`preview-${previewSuggestion.id}`} suggestion={previewSuggestion} previewOnly onClose={() => setPreviewSuggestion(null)} onSaved={refreshAfterSave} />}
      {complaintIds && <div role="presentation" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setComplaintIds(null); }}><section role="dialog" aria-modal="true" aria-labelledby="supporting-complaints-title" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-2xl"><div className="flex items-center justify-between gap-3"><h2 id="supporting-complaints-title" className="font-semibold text-slate-900 dark:text-white">Réclamations justificatives</h2><button type="button" onClick={() => setComplaintIds(null)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Fermer</button></div><p className="mt-1 text-sm text-slate-500">Ouvrez une réclamation dans le module existant.</p><ul className="mt-4 space-y-2">{complaintIds.map((id) => <li key={id}><button type="button" onClick={() => openComplaint(id)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-50 dark:border-slate-700 dark:text-indigo-300 dark:hover:bg-indigo-950/40"><span>Ouvrir la réclamation</span><span className="font-mono text-xs text-slate-400">{id}</span></button></li>)}</ul></section></div>}
    </div>
  );
}
````

### `components/ai-intelligence/AIIntelligenceSkeleton.tsx`

````tsx
export default function AIIntelligenceSkeleton() {
  return (
    <div aria-label="Chargement des analyses" aria-busy="true" className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-3"><div className="h-4 w-48 animate-pulse rounded bg-slate-200" /><div className="h-9 w-64 animate-pulse rounded bg-slate-200" /><div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-100" /></div>
        <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-200" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-100" />)}</div>
      <div className="grid gap-5 lg:grid-cols-2"><div className="h-80 animate-pulse rounded-2xl bg-slate-100" /><div className="h-80 animate-pulse rounded-2xl bg-slate-100" /></div>
    </div>
  );
}
````

### `components/ai-intelligence/AIOverviewCards.tsx`

````tsx
"use client";

import { Activity, AlertTriangle, ClipboardList, Megaphone, Repeat2 } from "lucide-react";

type Props = {
  metrics: {
    openComplaints: number;
    attentionCount: number;
    recurringPatternsCount: number;
    recentComplaintCount: number;
    publishedAnnouncementsCount: number;
  };
};

export default function AIOverviewCards({ metrics }: Props) {
  const cards = [
    { label: "Réclamations ouvertes", value: metrics.openComplaints, description: "Encore non résolues", icon: ClipboardList },
    { label: "À examiner", value: metrics.attentionCount, description: "Règles de suivi transparentes", icon: AlertTriangle },
    { label: "Similarités détectées", value: metrics.recurringPatternsCount, description: "Rapprochements possibles", icon: Repeat2 },
    { label: "Réclamations récentes", value: metrics.recentComplaintCount, description: "Période sélectionnée", icon: Activity },
    { label: "Annonces publiées", value: metrics.publishedAnnouncementsCount, description: "Période sélectionnée", icon: Megaphone },
  ];

  return (
    <section aria-label="Indicateurs" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map(({ label, value, description, icon: Icon }) => (
        <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
            <span className="rounded-xl bg-indigo-50 p-2.5 dark:bg-indigo-950/60"><Icon aria-hidden="true" className="h-5 w-5 text-indigo-600 dark:text-indigo-300" /></span>
          </div>
          <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{value.toLocaleString("fr-FR")}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </article>
      ))}
    </section>
  );
}
````

### `components/ai-intelligence/AnnouncementDraftDialog.tsx`

````tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, FileEdit, LoaderCircle, Sparkles, X } from "lucide-react";
import type { AnnouncementSuggestion, RecurringPattern } from "@/types/ai-intelligence";

type Props = {
  pattern?: RecurringPattern;
  suggestion?: AnnouncementSuggestion;
  previewOnly?: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type ReviewStatus = AnnouncementSuggestion["source"]["reviewStatus"];
type DraftResponse = {
  success?: boolean;
  created?: boolean;
  error?: string;
  message?: string;
  announcement?: {
    _id?: string;
    id?: string;
    title?: string;
    content?: string;
    intelligenceSource?: { reviewStatus?: ReviewStatus };
  };
};

function messageFrom(payload: { error?: string; message?: string }) {
  return payload.error ?? payload.message ?? "La demande n’a pas pu aboutir.";
}

export default function AnnouncementDraftDialog({ pattern, suggestion, previewOnly = false, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(suggestion?.title ?? "");
  const [content, setContent] = useState(suggestion?.content ?? "");
  const [announcementId, setAnnouncementId] = useState(suggestion?.id ?? "");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>(suggestion?.source.reviewStatus ?? "DRAFT");
  const [audience, setAudience] = useState(suggestion?.audience ?? "RESIDENTS");
  const [language, setLanguage] = useState("FR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const request = async (url: string, method: string, body: unknown) => {
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload: DraftResponse = await response.json();
    if (!response.ok) throw new Error(messageFrom(payload));
    return payload;
  };

  const generateDraft = async () => {
    if (!pattern) return;
    setLoading(true);
    setError("");
    try {
      const payload = await request("/api/ai/intelligence/announcements", "POST", {
        residenceId: pattern.residenceId,
        patternId: pattern.id,
        incidentIds: pattern.complaintIds,
        audience,
        language,
      });
      const announcement = payload.announcement;
      if (!announcement) throw new Error("Le brouillon n’a pas été retourné par le serveur.");
      setAnnouncementId(announcement._id ?? announcement.id ?? "");
      setTitle(announcement.title ?? "");
      setContent(announcement.content ?? "");
      const returnedStatus = announcement.intelligenceSource?.reviewStatus;
      if (returnedStatus) setReviewStatus(returnedStatus);
      setNotice(payload.created === false
        ? "Un brouillon existe déjà pour ce groupe; il est prêt à être relu."
        : "Brouillon créé et enregistré. Il reste à relire avant toute publication.");
      onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async () => {
    if (!announcementId) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/announcements/${encodeURIComponent(announcementId)}`, "PATCH", { title, content });
      setNotice("Brouillon enregistré.");
      onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  };

  const updateReview = async (nextStatus: "UNDER_REVIEW" | "APPROVED" | "REJECTED") => {
    if (!announcementId) return;
    if (nextStatus === "REJECTED" && !window.confirm("Confirmer le rejet de cette suggestion ?")) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/ai/intelligence/suggestions/${encodeURIComponent(announcementId)}/review`, "PATCH", { status: nextStatus });
      setReviewStatus(nextStatus);
      setNotice(nextStatus === "APPROVED" ? "Suggestion approuvée. Elle n’a pas été publiée." : nextStatus === "REJECTED" ? "Suggestion rejetée." : "Suggestion transmise pour examen.");
      onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  };

  const canEdit = !previewOnly && reviewStatus === "DRAFT" && Boolean(announcementId);
  const titleText = previewOnly ? "Aperçu de la suggestion" : suggestion ? "Réviser le brouillon" : "Créer un brouillon";

  return (
    <div role="presentation" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="announcement-draft-title" className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-2xl sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div><span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600"><FileEdit aria-hidden="true" className="h-4 w-4" />Révision humaine requise</span><h2 id="announcement-draft-title" className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{titleText}</h2><p className="mt-1 text-sm text-slate-500">Aucune annonce n’est publiée ni envoyée automatiquement.</p></div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </header>

        {!announcementId && pattern && !previewOnly && <div className="mt-5 space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60"><p className="font-medium text-slate-900 dark:text-white">{pattern.title}</p><p className="mt-1 text-sm text-slate-500">{pattern.evidence}</p><p className="mt-2 text-xs text-slate-400">{pattern.complaintCount} réclamations · {pattern.periodLabel}</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Langue<select value={language} onChange={(event) => setLanguage(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800"><option value="FR">Français</option><option value="AR">العربية</option><option value="EN">English</option></select></label>
            <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Destinataires<select value={audience} onChange={(event) => setAudience(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800"><option value="RESIDENTS">Résidents</option><option value="ALL">Tous</option><option value="TECHNICIANS">Techniciens</option></select></label>
          </div>
          <button type="button" disabled={loading} onClick={() => void generateDraft()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Générer et enregistrer le brouillon</button>
        </div>}

        {announcementId && <>
          <div className="mt-5 space-y-4">
            <label className="block space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Titre<input disabled={!canEdit} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:disabled:bg-slate-800/60" /></label>
            <label className="block space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Contenu<textarea disabled={!canEdit} value={content} onChange={(event) => setContent(event.target.value)} maxLength={20_000} rows={8} className="w-full rounded-xl border border-slate-200 bg-white p-3 leading-6 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:disabled:bg-slate-800/60" /></label>
            <p className="text-xs text-slate-500">Statut de revue : <span className="font-semibold">{reviewStatus === "UNDER_REVIEW" ? "À examiner" : reviewStatus === "APPROVED" ? "Approuvée" : reviewStatus === "REJECTED" ? "Refusée" : "Brouillon"}</span></p>
            {reviewStatus === "APPROVED" && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">Approuvée, mais toujours non publiée. Pour publier via le workflow existant : <Link className="font-semibold underline" href={`/announcements?announcement=${encodeURIComponent(announcementId)}`} onClick={onClose}>ouvrir l’annonce</Link>.</p>}
          </div>
        </>}

        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}

        <footer className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Fermer</button>
          {canEdit && <button type="button" disabled={loading} onClick={() => void saveDraft()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}Enregistrer</button>}
          {!previewOnly && announcementId && reviewStatus === "DRAFT" && <button type="button" disabled={loading} onClick={() => void updateReview("UNDER_REVIEW")} className="min-h-10 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">Soumettre à la revue</button>}
          {!previewOnly && announcementId && reviewStatus === "UNDER_REVIEW" && <>
            <button type="button" disabled={loading} onClick={() => void updateReview("REJECTED")} className="min-h-10 rounded-xl border border-rose-200 px-4 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40">Rejeter</button>
            <button type="button" disabled={loading} onClick={() => void updateReview("APPROVED")} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"><Check className="h-4 w-4" />Approuver</button>
          </>}
        </footer>
      </section>
    </div>
  );
}
````

### `components/ai-intelligence/AnnouncementImpact.tsx`

````tsx
"use client";

import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import type { AnnouncementImpactItem } from "@/types/ai-intelligence";

type Props = { items: AnnouncementImpactItem[]; emptyReason?: string };
const disclaimer = "Les variations d’activité autour d’une annonce ne prouvent pas que l’annonce les a causées.";

function periodLabel(period?: { start: string; end: string }) {
  if (!period) return "Période non disponible";
  return `${new Date(period.start).toLocaleDateString("fr-FR")} – ${new Date(period.end).toLocaleDateString("fr-FR")}`;
}

export default function AnnouncementImpact({ items, emptyReason }: Props) {
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Activité autour des annonces</h2>
        <p className="mt-1 text-sm text-slate-500">Comparaisons descriptives avant et après publication, lorsque les données sont suffisantes.</p>
      </header>
      {!items.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900"><Info aria-hidden="true" className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">Aucune comparaison disponible</p><p className="mt-1 text-sm text-slate-500">{emptyReason ?? "Une comparaison apparaîtra après publication et lorsque les périodes d’observation seront complètes."}</p></div> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => {
            const change = item.beforeCount && item.afterCount !== undefined
              ? item.afterCount - item.beforeCount
              : undefined;
            return <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Publiée le {new Date(item.publishedAt).toLocaleDateString("fr-FR")}</p><h3 className="mt-2 font-semibold text-slate-900 dark:text-white">{item.title}</h3></div>
                {item.sufficientData && change !== undefined && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${change < 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : change > 0 ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{change < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : change > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : null}{change > 0 ? "+" : ""}{change}{item.percentageChange === undefined ? "" : ` (${item.percentageChange > 0 ? "+" : ""}${item.percentageChange} %)`}</span>}
              </div>
              {!item.sufficientData ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">{item.limitation ?? "Données insuffisantes pour comparer les périodes."}</p> : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><p className="text-xs text-slate-500">Avant · {periodLabel(item.beforePeriod)}</p><p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{item.beforeCount ?? "—"}</p><p className="text-xs text-slate-500">réclamations similaires</p></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><p className="text-xs text-slate-500">Après · {periodLabel(item.afterPeriod)}</p><p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{item.afterCount ?? "—"}</p><p className="text-xs text-slate-500">réclamations similaires</p></div></div>
              )}
              <p className="mt-4 flex gap-2 text-xs leading-5 text-slate-500"><Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{disclaimer}</p>
            </article>;
          })}
        </div>
      )}
    </section>
  );
}
````

### `components/ai-intelligence/CommunicationOpportunities.tsx`

````tsx
"use client";

import { ArrowUpRight, FileEdit, Megaphone, Sparkles } from "lucide-react";
import Link from "next/link";
import type { AnnouncementSuggestion, CommunicationOpportunity, RecurringPattern } from "@/types/ai-intelligence";

type Props = {
  opportunities: CommunicationOpportunity[];
  suggestions: AnnouncementSuggestion[];
  patterns: RecurringPattern[];
  onCreateDraft: (pattern: RecurringPattern) => void;
  onEditDraft: (suggestion: AnnouncementSuggestion) => void;
  onPreview: (suggestion: AnnouncementSuggestion) => void;
};

const reviewLabel: Record<AnnouncementSuggestion["source"]["reviewStatus"], string> = {
  DRAFT: "Brouillon",
  UNDER_REVIEW: "À examiner",
  APPROVED: "Approuvée",
  REJECTED: "Refusée",
};

const reviewStyle: Record<AnnouncementSuggestion["source"]["reviewStatus"], string> = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  UNDER_REVIEW: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  APPROVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export default function CommunicationOpportunities({ opportunities, suggestions, patterns, onCreateDraft, onEditDraft, onPreview }: Props) {
  const patternById = new Map(patterns.map((pattern) => [pattern.id, pattern]));
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Occasions de communication</h2>
        <p className="mt-1 text-sm text-slate-500">Suggestions factuelles à examiner. Aucun message n’est publié automatiquement.</p>
      </header>
      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex items-center gap-2"><Megaphone aria-hidden="true" className="h-5 w-5 text-indigo-600" /><h3 className="font-semibold text-slate-900 dark:text-white">À évaluer</h3></div>
          {!opportunities.length ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/60">Aucune opportunité de communication n’est signalée par les données actuelles.</p> : (
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {opportunities.map((item) => {
                const pattern = patternById.get(item.patternId);
                return <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                  <p className="font-medium text-slate-900 dark:text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
                  <p className="mt-2 text-xs text-slate-400">{[item.residenceName, `${item.complaintCount} réclamations`].filter(Boolean).join(" · ")}</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.suggestedAction}</p>
                  {pattern && <button type="button" onClick={() => onCreateDraft(pattern)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900"><Sparkles aria-hidden="true" className="h-4 w-4" />Préparer un brouillon</button>}
                </li>;
              })}
            </ul>
          )}
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex items-center gap-2"><FileEdit aria-hidden="true" className="h-5 w-5 text-indigo-600" /><h3 className="font-semibold text-slate-900 dark:text-white">Brouillons et revues</h3></div>
          {!suggestions.length ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/60">Aucun brouillon de communication IA pour le périmètre sélectionné.</p> : (
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {suggestions.map((item) => <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${reviewStyle[item.source.reviewStatus]}`}>{reviewLabel[item.source.reviewStatus]}</span>
                  <span className="text-xs text-slate-400">{new Date(item.source.generatedAt).toLocaleDateString("fr-FR")}</span>
                </div>
                <h4 className="mt-3 font-semibold text-slate-900 dark:text-white">{item.title}</h4>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{item.content}</p>
                <p className="mt-2 text-xs text-slate-400">{[item.residenceName, item.source.language, `${item.source.incidentIds.length} références liées`].filter(Boolean).join(" · ")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onPreview(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Aperçu</button>
                  {item.source.reviewStatus !== "REJECTED" && item.source.reviewStatus !== "APPROVED" && <button type="button" onClick={() => onEditDraft(item)} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">Modifier / examiner</button>}
                  {item.source.reviewStatus === "APPROVED" && item.status !== "PUBLISHED" && <Link href={`/announcements?announcement=${encodeURIComponent(item.id)}`} className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300">Ouvrir les annonces <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>}
                </div>
              </li>)}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
````

### `components/ai-intelligence/ComplaintTrends.tsx`

````tsx
"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryPoint, StatusPoint, TrendPoint } from "@/types/ai-intelligence";
import { incidentCategoryLabel, incidentStatusLabel } from "@/types/enums";

type Props = { data: TrendPoint[]; categories: CategoryPoint[]; statuses: StatusPoint[] };
const statusColors = ["#f59e0b", "#6366f1", "#8b5cf6", "#10b981"];
const cardClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6";

function categoryName(category: string) {
  return category in incidentCategoryLabel
    ? incidentCategoryLabel[category as keyof typeof incidentCategoryLabel]
    : category;
}

function statusName(status: string) {
  return status in incidentStatusLabel
    ? incidentStatusLabel[status as keyof typeof incidentStatusLabel]
    : status;
}

export default function ComplaintTrends({ data, categories, statuses }: Props) {
  const trendData = data.map((item) => ({
    ...item,
    label: new Date(`${item.period}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
  }));
  const categoryData = categories.map((item) => ({ name: categoryName(item.category), count: item.count }));
  const statusData = statuses.map((item) => ({ name: statusName(item.status), count: item.count }));
  const hasTrend = trendData.some((item) => item.count > 0);

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tendances des réclamations</h2>
        <p className="mt-1 text-sm text-slate-500">Volumes observés et répartition selon les données de la période sélectionnée.</p>
      </header>
      <div className="grid gap-4 xl:grid-cols-2">
        <article className={cardClass}>
          <h3 className="font-semibold text-slate-900 dark:text-white">Activité des réclamations</h3>
          <p className="mt-1 text-sm text-slate-500">Signalements quotidiens et réclamations non résolues.</p>
          {!hasTrend ? <div className="flex h-64 items-center justify-center text-sm text-slate-500">Aucune réclamation sur cette période.</div> : (
            <div className="mt-5 h-64 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, bottom: 4 }}>
                  <defs><linearGradient id="aiComplaintGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.22} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} minTickGap={20} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" name="Toutes" stroke="#6366f1" strokeWidth={2.5} fill="url(#aiComplaintGradient)" />
                  <Area type="monotone" dataKey="unresolvedCount" name="Non résolues" stroke="#f59e0b" strokeWidth={2} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>
        <article className={cardClass}>
          <h3 className="font-semibold text-slate-900 dark:text-white">Réclamations par catégorie</h3>
          <p className="mt-1 text-sm text-slate-500">Répartition réelle des signalements de la période.</p>
          {!categoryData.length ? <div className="flex h-64 items-center justify-center text-sm text-slate-500">Aucune donnée de catégorie disponible.</div> : (
            <div className="mt-5 h-64 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={94} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }} formatter={(value) => [value, "Réclamations"]} />
                  <Bar dataKey="count" name="Réclamations" fill="#6366f1" radius={[0, 5, 5, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>
        <article className={`${cardClass} xl:col-span-2`}>
          <h3 className="font-semibold text-slate-900 dark:text-white">Réclamations par statut</h3>
          <p className="mt-1 text-sm text-slate-500">Les statuts suivent le workflow des réclamations.</p>
          {!statusData.length ? <div className="flex h-56 items-center justify-center text-sm text-slate-500">Aucune donnée de statut disponible.</div> : (
            <div className="grid items-center gap-4 sm:grid-cols-[minmax(160px,260px)_1fr]">
              <div className="relative mx-auto h-56 w-full max-w-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="count" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={3} stroke="none">
                      {statusData.map((item, index) => <Cell key={item.name} fill={statusColors[index % statusColors.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {statusData.map((item, index) => <li key={item.name} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60"><span className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColors[index % statusColors.length] }} />{item.name}</span><span className="font-semibold tabular-nums text-slate-900 dark:text-white">{item.count.toLocaleString("fr-FR")}</span></li>)}
              </ul>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
````

### `components/ai-intelligence/NeedsAttention.tsx`

````tsx
"use client";

import { AlertTriangle, Clock3 } from "lucide-react";
import type { AttentionComplaint } from "@/types/ai-intelligence";
import { incidentCategoryLabel, incidentStatusLabel, priorityLabel } from "@/types/enums";

type Props = { complaints: AttentionComplaint[]; onOpen: (id: string) => void };

function label(value: string, labels: Record<string, string>) {
  return labels[value] ?? value.replaceAll("_", " ");
}

export default function NeedsAttention({ complaints, onOpen }: Props) {
  if (!complaints.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <AlertTriangle aria-hidden="true" className="mx-auto h-8 w-8 text-slate-400" />
        <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">Aucun suivi prioritaire</h3>
        <p className="mt-1 text-sm text-slate-500">Aucune réclamation ne correspond actuellement aux règles de suivi.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {complaints.map((item, index) => (
        <button key={item.id} type="button" onClick={() => onOpen(item.id)} className={`flex w-full flex-col gap-3 p-5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:flex-row sm:items-center sm:justify-between ${index ? "border-t border-slate-100 dark:border-slate-800" : ""}`}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.priority === "URGENT" ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : item.priority === "HIGH" ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>{label(item.priority, priorityLabel)}</span>
              <span className="text-xs text-slate-500">{label(item.status, incidentStatusLabel)}</span>
              <span className="text-xs text-slate-400">{label(item.category, incidentCategoryLabel)}</span>
            </div>
            <h3 className="mt-2 truncate font-semibold text-slate-900 dark:text-white">{item.title}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.reason}</p>
            <p className="mt-2 text-xs text-slate-400">{[item.residenceName, item.apartmentLabel].filter(Boolean).join(" · ")}</p>
          </div>
          <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500"><Clock3 aria-hidden="true" className="h-4 w-4" />{new Date(item.createdAt).toLocaleDateString("fr-FR")}</span>
        </button>
      ))}
    </div>
  );
}
````

### `components/ai-intelligence/RecurringIssues.tsx`

````tsx
"use client";

import { ArrowUpRight, Check, LoaderCircle, MapPin, Repeat2, X } from "lucide-react";
import type { RecurringPattern } from "@/types/ai-intelligence";
import { incidentCategoryLabel, incidentStatusLabel, priorityLabel } from "@/types/enums";

type Props = {
  patterns: RecurringPattern[];
  onExplain: (pattern: RecurringPattern) => void;
  onViewComplaints: (ids: string[]) => void;
  onReview: (pattern: RecurringPattern, status: "CONFIRMED" | "DISMISSED" | "CLEAR") => void;
  reviewingPatternId: string;
};

const categoryLabel = (category?: string) =>
  category && category in incidentCategoryLabel
    ? incidentCategoryLabel[category as keyof typeof incidentCategoryLabel]
    : category ?? "Autre";

export default function RecurringIssues({ patterns, onExplain, onViewComplaints, onReview, reviewingPatternId }: Props) {
  if (!patterns.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <Repeat2 aria-hidden="true" className="mx-auto h-8 w-8 text-slate-400" />
        <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">Aucun rapprochement détecté</h3>
        <p className="mt-1 text-sm text-slate-500">Un rapprochement apparaîtra lorsque les descriptions fourniront suffisamment d’éléments.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {patterns.map((pattern) => (
        <article key={pattern.id} className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-indigo-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800">
          <div className="flex flex-col justify-between gap-4 sm:flex-row">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">{pattern.evidenceLevel === "category_only" ? "Même catégorie · à vérifier" : pattern.detectionMethod === "semantic_embedding" ? "Sens similaire · multilingue" : "Similarité textuelle"}</span>
                {pattern.reviewStatus && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${pattern.reviewStatus === "CONFIRMED" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{pattern.reviewStatus === "CONFIRMED" ? "Confirmé par le gestionnaire" : "Écarté par le gestionnaire"}</span>}
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{categoryLabel(pattern.category)}</span>
                {pattern.evidenceLevel !== "category_only" && <span className="text-xs text-slate-500">Éléments {pattern.evidenceLevel === "moderate" ? "modérés" : "faibles"}</span>}
              </div>
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{pattern.title}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{pattern.evidence}</p>
              <p className="mt-2 text-xs text-slate-500">
                Statuts : {Object.entries(pattern.statuses).map(([status, count]) => `${incidentStatusLabel[status as keyof typeof incidentStatusLabel] ?? status} ${count}`).join(" · ") || "—"}
                {" · "}Priorités : {Object.entries(pattern.priorities).map(([priority, count]) => `${priorityLabel[priority as keyof typeof priorityLabel] ?? priority} ${count}`).join(" · ") || "—"}
              </p>
              {pattern.location && <p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><MapPin aria-hidden="true" className="h-3.5 w-3.5" />{pattern.location}</p>}
              <p className="mt-2 text-xs text-slate-400">{pattern.periodLabel}</p>
            </div>
            <div className="flex shrink-0 flex-row flex-wrap items-center gap-x-4 gap-y-2 sm:flex-col sm:items-end sm:justify-center">
              <span className="text-2xl font-semibold text-slate-900 dark:text-white">{pattern.complaintCount}</span>
              <span className="text-xs text-slate-500">réclamations liées</span>
              <button type="button" onClick={() => onExplain(pattern)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-300">Expliquer <ArrowUpRight aria-hidden="true" className="ml-1 inline h-4 w-4" /></button>
              <button type="button" onClick={() => onViewComplaints(pattern.complaintIds)} className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">Voir les réclamations</button>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button
                  type="button"
                  disabled={reviewingPatternId === pattern.id}
                  onClick={() => onReview(pattern, pattern.reviewStatus === "CONFIRMED" ? "CLEAR" : "CONFIRMED")}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-emerald-200 px-2.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                >
                  {reviewingPatternId === pattern.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {pattern.reviewStatus === "CONFIRMED" ? "Annuler la confirmation" : "Confirmer"}
                </button>
                <button
                  type="button"
                  disabled={reviewingPatternId === pattern.id}
                  onClick={() => onReview(pattern, pattern.reviewStatus === "DISMISSED" ? "CLEAR" : "DISMISSED")}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <X className="h-3.5 w-3.5" />
                  {pattern.reviewStatus === "DISMISSED" ? "Annuler le rejet" : "Écarter"}
                </button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
````

