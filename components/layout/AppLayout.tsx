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
  Search,
  Bell,
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
              role: u.role || Role.OWNER,
              expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
            }).catch(() => {});
          } else {
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
  const userRole = currentUser?.role || Role.OWNER;
  const visibleNavItems = ALL_NAV_ITEMS.filter((item) =>
    isRouteAllowed(item.href, userRole)
  );
  const firstName = currentUser?.name?.split(" ")[0];

  return (
    <div className="flex min-h-dvh w-full bg-[#f4f5f7] dark:bg-slate-950">
      <aside className="hidden md:fixed md:inset-y-3 md:left-3 md:z-[var(--z-header)] md:flex md:w-[15.25rem] md:flex-col md:rounded-[1.75rem] md:border md:border-slate-200/80 md:bg-white md:shadow-[var(--shadow-card)] md:dark:border-slate-800 md:dark:bg-slate-900">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-sky-500 text-white">
            <Building2 className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-slate-900 dark:text-white">
              Syndic<span className="text-sky-500">Pro</span>
            </p>
            <p className="text-[11px] text-slate-400">Copropriété</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 pb-4" aria-label="Navigation principale">
          <p className="mb-2 px-3 text-[11px] font-medium text-slate-400">Navigation</p>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "flex min-h-11 items-center gap-3 rounded-2xl px-3.5 text-[13px] font-semibold transition-colors duration-150",
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                )}
              >
                <Icon className="size-[18px] stroke-[1.75]" aria-hidden />
                <span>{item.label}</span>
                {item.href === "/incidents" && pendingCount > 0 && (
                  <span className="sp-num ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-900">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-3 dark:border-slate-800">
          <UserMenu initialUser={currentUser} />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col md:pl-[16.75rem]">
        <header className="sticky top-0 z-[var(--z-header)] flex h-14 items-center justify-between border-b border-slate-200/70 bg-[#f4f5f7]/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md md:hidden dark:border-slate-800 dark:bg-slate-950/90">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500 text-white">
              <Building2 className="size-4" aria-hidden />
            </div>
            <span className="text-base font-bold text-slate-900 dark:text-white">
              Syndic<span className="text-sky-500">Pro</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {showOffline && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                <WifiOff className="size-3" aria-hidden />
                Hors ligne
              </span>
            )}
            <UserMenu initialUser={currentUser} compact />
          </div>
        </header>

        <div className="sticky top-0 z-[var(--z-header)] hidden items-center gap-4 px-6 py-4 md:flex lg:px-8">
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-slate-900 dark:text-white">
              {firstName ? `Bonjour, ${firstName}` : "SyndicPro"}
            </p>
            <p className="text-xs text-slate-500">
              {showOffline ? "Mode hors ligne" : "Tout est synchronisé"}
            </p>
          </div>

          <Link
            href="/more"
            className="hidden min-h-11 max-w-sm flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-400 shadow-sm lg:flex dark:border-slate-700 dark:bg-slate-900"
          >
            <Search className="size-4" aria-hidden />
            Rechercher un module…
          </Link>

          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <Bell className="size-4 stroke-[1.75]" aria-hidden />
            {pendingCount > 0 && (
              <span className="absolute top-2 right-2 size-2 rounded-full bg-sky-500" />
            )}
          </Link>

          <UserMenu initialUser={currentUser} compact />
        </div>

        <main className="flex-1 px-4 pb-safe pt-2 sm:px-6 md:px-6 md:pb-10 lg:px-8">
          <div className="mx-auto max-w-6xl sp-page">{children}</div>
        </main>
      </div>

      <nav
        aria-label="Navigation mobile"
        className="fixed bottom-3 left-3 right-3 z-[var(--z-nav)] flex items-center justify-around rounded-[1.5rem] border border-slate-200/80 bg-white/95 px-1 py-1 shadow-[var(--shadow-card)] backdrop-blur-md md:hidden dark:border-slate-800 dark:bg-slate-900/95"
        style={{
          marginBottom: "max(0px, env(safe-area-inset-bottom))",
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
              aria-current={isActive ? "page" : undefined}
              className={clsx(
                "relative flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-semibold transition-colors duration-150",
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-500"
              )}
            >
              <Icon className="size-5 stroke-[1.75]" aria-hidden />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
