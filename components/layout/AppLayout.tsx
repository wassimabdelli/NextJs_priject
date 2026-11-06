"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/redesign/Sidebar";
import { TopHeader } from "@/components/redesign/TopHeader";
import { GlobalSearchModal } from "@/components/redesign/GlobalSearchModal";
import { pathToTab, TAB_PATHS, useRedesign } from "@/lib/redesign/store";

export interface AppLayoutProps {
  children: React.ReactNode;
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string;
  };
}

/** Chrome pixel-perfect du redesign Vite (Sidebar + TopHeader + ambient + Cmd+K). */
export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const store = useRedesign();
  const currentTab = pathToTab(pathname);

  const setCurrentTab = React.useCallback(
    (tab: string) => {
      const path = TAB_PATHS[tab] || "/dashboard";
      router.push(path);
    },
    [router]
  );

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#f4f7fb] text-slate-800 antialiased transition-colors duration-300 selection:bg-blue-600 selection:text-white dark:bg-[#080d1a] dark:text-slate-100">
      {/* Ambient background glowing gradient blobs — exact redesign */}
      <div className="pointer-events-none fixed -top-32 -left-32 -z-0 h-[34rem] w-[34rem] rounded-full bg-gradient-to-tr from-rose-300/35 via-purple-300/30 to-indigo-300/30 filter blur-3xl dark:from-blue-600/15 dark:via-purple-600/10 dark:to-cyan-600/10" />
      <div className="pointer-events-none fixed top-1/4 -right-28 -z-0 h-[38rem] w-[38rem] rounded-full bg-gradient-to-br from-indigo-200/40 via-sky-200/35 to-teal-200/25 filter blur-3xl dark:from-indigo-600/15 dark:via-sky-600/10 dark:to-teal-600/10" />
      <div className="pointer-events-none fixed -bottom-40 left-1/3 -z-0 h-[42rem] w-[42rem] rounded-full bg-gradient-to-tr from-amber-200/30 via-rose-200/25 to-violet-200/30 filter blur-3xl dark:from-violet-600/15 dark:via-rose-600/10 dark:to-amber-600/10" />

      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        currentUser={store.currentUser}
        onSwitchUser={store.setCurrentUser}
        allUsers={store.allUsers}
        openIncidentsCount={store.openIncidentsCount}
      />

      <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col">
        <TopHeader
          currentUser={store.currentUser}
          residences={store.residences}
          activeResidence={store.activeResidence}
          setActiveResidence={store.setActiveResidence}
          onOpenSearch={() => store.setIsSearchOpen(true)}
          onOpenNewIncident={() => setCurrentTab("incidents")}
          onRefresh={() => {
            alert("Données actualisées et synchronisées avec le serveur.");
          }}
          notificationsCount={2}
          onOpenNotifications={() => setCurrentTab("notifications")}
          onOpenProfile={() => setCurrentTab("profile")}
          theme={store.theme}
          onToggleTheme={store.toggleTheme}
        />

        <main className="mx-auto w-full max-w-7xl flex-1 p-6 pb-24 md:pb-6">{children}</main>
      </div>

      <GlobalSearchModal
        isOpen={store.isSearchOpen}
        onClose={() => store.setIsSearchOpen(false)}
        onNavigate={(tab) => {
          store.setIsSearchOpen(false);
          setCurrentTab(tab);
        }}
        onNavigateHref={(href) => router.push(href)}
      />
    </div>
  );
}
