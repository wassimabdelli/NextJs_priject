"use client";

import React from "react";
import {
  User,
  Shield,
  Building,
  CheckCircle2,
  AlertTriangle,
  LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { UserProfile, Residence } from "@/lib/redesign/condo";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { clearOfflineSession } from "@/lib/offline/db";
import { apiRoleToRedesignRole, formatDateFrShort } from "@/components/redesign/apiMappers";

type ProfileApi = {
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    createdAt?: string;
  };
  residences: Array<{
    id?: string;
    _id?: string;
    name: string;
    address?: string;
    city?: string;
    totalApartments?: number;
  }>;
  details?: Record<string, unknown>;
};

type ProfileRes = { data: ProfileApi };

export const ProfileView: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentUser, setCurrentUser] = React.useState<UserProfile | null>(null);
  const [residences, setResidences] = React.useState<Residence[]>([]);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");

  const [savedSuccess, setSavedSuccess] = React.useState(false);
  const [passwordSuccess, setPasswordSuccess] = React.useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await clearOfflineSession();
      if (typeof navigator !== "undefined" && navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "LOGOUT" });
      }
      await signOut({ redirect: false });
      router.push("/login");
      router.refresh();
    } catch {
      window.location.href = "/login";
    } finally {
      setLoggingOut(false);
    }
  };

  const applyUser = (u: ProfileApi["user"], resList: ProfileApi["residences"] = []) => {
    const role = apiRoleToRedesignRole(u.role);
    setCurrentUser({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone || "",
      role,
      residenceId: resList?.[0]?.id || resList?.[0]?._id || "",
      active: true,
      registeredDate: formatDateFrShort(u.createdAt),
    });
    setName(u.name);
    setPhone(u.phone || "");
    setResidences(
      (resList || []).map((r) => ({
        id: String(r.id ?? r._id ?? ""),
        name: r.name,
        city: r.city ?? "",
        address: r.address ?? "",
        totalLots: r.totalApartments ?? 0,
        syndicName: "",
      }))
    );
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchWithOffline<ProfileRes | ProfileApi>("/api/profile");
      const d = "data" in json && json.data ? json.data : (json as ProfileApi);
      if (!d?.user) throw new Error("Profil introuvable");
      applyUser(d.user, d.residences || []);
    } catch (e) {
      // Session encore valide → afficher un profil minimal + bouton déconnexion
      try {
        const session = await fetch("/api/auth/session").then((r) => r.json());
        if (session?.user?.id) {
          applyUser(
            {
              id: session.user.id,
              name: session.user.name || "Utilisateur",
              email: session.user.email || "",
              phone: "",
              role: session.user.role || "OWNER",
            },
            []
          );
          setError(
            "Profil serveur indisponible (session obsolète après un reseed ?). Vous pouvez vous déconnecter puis vous reconnecter."
          );
        } else {
          setError(e instanceof Error ? e.message : "Erreur de chargement");
        }
      } catch {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await fetchWithOffline("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible");
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await fetchWithOffline("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mot de passe inchangé");
    }
  };

  if (loading) {
    return <div className="glass-card rounded-3xl p-10 animate-pulse min-h-[240px]" />;
  }

  if (!currentUser) {
    return (
      <div className="space-y-4 animate-fadeIn pb-12">
        <div className="glass-card rounded-3xl p-6 border border-rose-500/25 text-xs text-rose-800 dark:text-rose-200 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error || "Profil indisponible."}
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="w-full min-h-11 flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md disabled:opacity-60"
        >
          <LogOut className="w-4 h-4" />
          {loggingOut ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Paramètres Utilisateur
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
            Mon Profil & Sécurité
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gérez vos coordonnées, résidences rattachées et options d&apos;authentification
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="min-h-11 px-4 flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-500/20 disabled:opacity-60"
        >
          <LogOut className="w-4 h-4" />
          {loggingOut ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="glass-card rounded-3xl p-4 border border-rose-500/25 bg-rose-500/10 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="p-6 rounded-3xl glass-card flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
            {currentUser.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{currentUser.name}</h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                {currentUser.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              {currentUser.email} · {currentUser.phone} · Inscrit le {currentUser.registeredDate}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Building className="w-4 h-4 text-blue-500" />
          <h3>Copropriétés sous votre mandat de gestion</h3>
        </div>

        {residences.length === 0 ? (
          <div className="glass-card rounded-3xl p-6 text-xs text-slate-500 text-center">
            Aucune résidence listée pour ce profil.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {residences.map((res) => (
              <div key={res.id} className="p-5 rounded-3xl glass-card space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{res.name}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{res.address}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-mono font-bold pt-2">
                  {res.totalLots} lots sous gestion active
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        <div className="p-6 rounded-3xl glass-card space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <User className="w-4 h-4 text-blue-500" />
            <h3>Coordonnées de contact</h3>
          </div>

          <form onSubmit={(e) => void handleUpdateContact(e)} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Nom & Prénom *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Numéro de téléphone</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Adresse email (fixée)</label>
              <input
                type="email"
                disabled
                value={currentUser.email}
                className="w-full bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl px-3 py-2 text-slate-400 font-mono cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400 block mt-1">L’identifiant de connexion est géré par l’administration.</span>
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-md shadow-blue-500/20 transition-all"
            >
              Mettre à jour mes coordonnées
            </button>

            {savedSuccess && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Coordonnées mises à jour avec succès.
              </p>
            )}
          </form>
        </div>

        <div className="p-6 rounded-3xl glass-card space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Shield className="w-4 h-4 text-blue-500" />
            <h3>Sécurité du compte</h3>
          </div>

          <form onSubmit={(e) => void handleUpdatePassword(e)} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Mot de passe actuel</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Nouveau mot de passe</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 font-bold border border-slate-200 dark:border-white/[0.08] transition-all"
            >
              Changer le mot de passe
            </button>

            {passwordSuccess && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Nouveau mot de passe enregistré en toute sécurité.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
