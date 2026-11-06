"use client";

import React from "react";
import Link from "next/link";
import { LogOut, User as UserIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { Badge } from "@/components/ui/Badge";
import { Role } from "@/types/enums";
import {
  getOfflineDB,
  getOfflineSession,
  saveOfflineSession,
  clearOfflineSession,
  clearAllOfflineData,
  type OfflineSessionProfile,
} from "@/lib/offline/db";

interface UserMenuProps {
  initialUser?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: Role;
  };
  compact?: boolean;
}

const roleBadgeConfig: Record<Role, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  [Role.ADMIN]: { label: "Admin", variant: "danger" },
  [Role.SYNDIC]: { label: "Syndic", variant: "info" },
  [Role.TECHNICIAN]: { label: "Technicien", variant: "warning" },
  [Role.OWNER]: { label: "Propriétaire", variant: "success" },
  [Role.TENANT]: { label: "Locataire", variant: "success" },
};

export function UserMenu({ initialUser, compact = false }: UserMenuProps) {
  const [user, setUser] = React.useState<OfflineSessionProfile | null>(() => {
    if (initialUser?.id && initialUser.role) {
      return {
        id: initialUser.id,
        name: initialUser.name || "Utilisateur",
        email: initialUser.email || "",
        role: initialUser.role,
        expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
      };
    }
    return null;
  });

  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  // Synchronisation du profil dans le cache Dexie pour la persistance hors-ligne
  React.useEffect(() => {
    if (initialUser?.id && initialUser.role) {
      const profile: OfflineSessionProfile = {
        id: initialUser.id,
        name: initialUser.name || "Utilisateur",
        email: initialUser.email || "",
        role: initialUser.role,
        expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
      };
      setUser(profile);
      saveOfflineSession(profile).catch(() => {});
    } else {
      // Si non fourni par le serveur (ex: chargement hors-ligne), lecture depuis Dexie
      getOfflineSession().then((cached) => {
        if (cached) setUser(cached);
      });
    }
  }, [initialUser]);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    try {
      // Exigence H5 : Avertissement si des modifications hors-ligne sont en attente
      const db = getOfflineDB();
      if (db.outbox) {
        const pendingCount = await db.outbox.where("status").anyOf(["pending", "failed"]).count();
        if (pendingCount > 0) {
          const confirmed = window.confirm(
            `${pendingCount} modification(s) non synchronisée(s) seront définitivement perdues. Êtes-vous sûr de vouloir vous déconnecter ?`
          );
          if (!confirmed) return;
        }
      }

      setIsLoggingOut(true);

      // 1. Purge de TOUTES les tables Dexie (données, session, dashboard, et outbox confirmée)
      await clearAllOfflineData(true);

      // 2. Notification au Service Worker pour purger les caches de données privées et pages
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "LOGOUT" });
      }

      // 3. Déconnexion via NextAuth / Auth.js
      await signOut({ callbackUrl: "/login" });
    } catch (err) {
      console.error("[UserMenu] Erreur lors de la déconnexion :", err);
      // Redirection de secours
      window.location.href = "/login";
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!user) {
    return null;
  }

  const roleInfo = roleBadgeConfig[user.role] || { label: user.role, variant: "default" };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/profile"
          aria-label="Consulter mon profil"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-sky-500/20 bg-sky-500 text-xs font-semibold text-white shadow-sm"
          title="Consulter mon profil"
        >
          {user.name.slice(0, 2).toUpperCase()}
        </Link>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          title="Se déconnecter"
          aria-label="Se déconnecter"
          className="flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/80 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-slate-800/80"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="sp-card flex flex-col gap-3 rounded-[1.5rem] border border-slate-200/80 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/80">
      <Link
        href="/profile"
        className="group -m-1 flex items-center gap-3 rounded-2xl p-1.5 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
        title="Consulter mon profil"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-sky-500/15 bg-sky-500 text-sm font-semibold text-white shadow-sm">
          {user.name ? user.name.slice(0, 2).toUpperCase() : <UserIcon className="size-5" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-500 dark:text-white dark:group-hover:text-sky-400">
            {user.name}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <Badge variant={roleInfo.variant} className="text-[10px] px-1.5 py-0">
              {roleInfo.label}
            </Badge>
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-rose-50/80 hover:border-rose-200/80 hover:text-rose-600 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-rose-950/30 dark:hover:border-rose-900/40 dark:hover:text-rose-400"
      >
        <LogOut className="h-4 w-4" />
        <span>{isLoggingOut ? "Déconnexion..." : "Déconnexion"}</span>
      </button>
    </div>
  );
}
