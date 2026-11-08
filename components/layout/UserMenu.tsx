"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { clearOfflineSession } from "@/lib/offline/db";
import { Role } from "@/types/enums";

const roleBadgeConfig: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "neutral" }
> = {
  [Role.ADMIN]: { label: "Admin", variant: "danger" },
  [Role.SYNDIC]: { label: "Syndic", variant: "info" },
  [Role.OWNER]: { label: "Propriétaire", variant: "success" },
  [Role.TENANT]: { label: "Locataire", variant: "neutral" },
  [Role.TECHNICIAN]: { label: "Technicien", variant: "warning" },
};

interface UserMenuProps {
  initialUser?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: Role;
  } | null;
  compact?: boolean;
}

export function UserMenu({ initialUser, compact = false }: UserMenuProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const user = initialUser;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await clearOfflineSession();
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "LOGOUT" });
      }
      await signOut({ redirect: false });
      router.push("/login");
      router.refresh();
    } catch {
      window.location.href = "/login";
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!user?.id) return null;

  const roleInfo = roleBadgeConfig[user.role || ""] || {
    label: user.role || "User",
    variant: "default" as const,
  };
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "SP";

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/profile"
          aria-label="Consulter mon profil"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-xs font-bold text-blue-600 dark:text-blue-400"
        >
          {initials}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          aria-label="Se déconnecter"
          className="flex size-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-white/80 hover:text-rose-600 dark:hover:bg-slate-800/80"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white/60 p-2.5 shadow-xs dark:border-white/[0.06] dark:bg-white/[0.03]">
      <Link href="/profile" className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-xs font-bold text-white shadow-xs">
          {user.name ? initials : <UserIcon className="size-4" aria-hidden />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
            {user.name}
          </p>
          <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
            {roleInfo.label}
          </span>
        </div>
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        aria-label="Se déconnecter"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-white/[0.06]"
      >
        <LogOut className="size-4" aria-hidden />
      </button>
    </div>
  );
}
