"use client";

import React from "react";
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
  [Role.RESIDENT]: { label: "Résident", variant: "success" },
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
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-700 font-bold text-xs dark:bg-sky-950 dark:text-sky-300">
          {user.name.slice(0, 2).toUpperCase()}
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          title="Se déconnecter"
          aria-label="Se déconnecter"
          className="flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-rose-600 transition-colors dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-sky-400 font-bold text-white shadow-sm shadow-sky-500/20">
          {user.name ? user.name.slice(0, 2).toUpperCase() : <UserIcon className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {user.name}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <Badge variant={roleInfo.variant} className="text-[10px] px-1.5 py-0">
              {roleInfo.label}
            </Badge>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 active:scale-[0.98] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-rose-950/30 dark:hover:border-rose-900/40 dark:hover:text-rose-400"
      >
        <LogOut className="h-4 w-4" />
        <span>{isLoggingOut ? "Déconnexion..." : "Déconnexion"}</span>
      </button>
    </div>
  );
}
