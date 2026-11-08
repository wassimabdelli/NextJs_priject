"use client";

import React from "react";
import {
  Plus,
  Search,
  CheckCircle,
  X,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import type { UserProfile, Role } from "@/lib/redesign/condo";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { Role as ApiRole } from "@/types/enums";
import { apiRoleToRedesignRole, formatDateFrShort } from "@/components/redesign/apiMappers";

type SessionRes = { user?: { role?: string } };
type UserApi = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive?: boolean;
  createdAt?: string;
};
type ListRes = { data: UserApi[] };

function redesignRoleToApi(r: Role): string {
  switch (r) {
    case "Locataire":
      return ApiRole.TENANT;
    case "Technicien":
      return ApiRole.TECHNICIAN;
    case "Syndic":
      return ApiRole.SYNDIC;
    case "Copropriétaire":
    default:
      return ApiRole.OWNER;
  }
}

export const ResidentsView: React.FC = () => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("Tous");
  const [showModal, setShowModal] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [sessionRole, setSessionRole] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("+216 98 000 000");
  const [role, setRole] = React.useState<Role>("Copropriétaire");
  const [password, setPassword] = React.useState("");
  const [apartmentId, setApartmentId] = React.useState("");
  const [apartments, setApartments] = React.useState<
    Array<{ _id: string; number: string; residence?: { name?: string } }>
  >([]);

  const canList = sessionRole === ApiRole.ADMIN || sessionRole === ApiRole.SYNDIC;

  const mapUser = React.useCallback((u: UserApi): UserProfile => {
    const r = apiRoleToRedesignRole(u.role);
    return {
      id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone || "",
      role: r,
      active: u.isActive !== false,
      registeredDate: formatDateFrShort(u.createdAt),
      residenceId: "",
    };
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sess = (await fetch("/api/auth/session").then((r) => r.json())) as SessionRes;
      const r = sess?.user?.role ?? null;
      setSessionRole(r);
      if (r === ApiRole.ADMIN || r === ApiRole.SYNDIC) {
        const json = await fetchWithOffline<ListRes>("/api/users?limit=200");
        setUsers((json.data || []).map(mapUser));
      } else {
        setUsers([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [mapUser]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone && u.phone.includes(searchTerm));
    const matchesRole = roleFilter === "Tous" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const openCreateModal = async () => {
    setShowModal(true);
    setError(null);
    try {
      const json = await fetchWithOffline<{ data: Array<{ _id: string; number: string; residence?: { name?: string } }> }>(
        "/api/apartments?limit=200"
      );
      const list = json.data || [];
      setApartments(list);
      if (list[0]?._id) setApartmentId(list[0]._id);
    } catch {
      setApartments([]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !apartmentId) return;
    if (role !== "Copropriétaire" && role !== "Locataire") {
      setError("Choisissez Propriétaire ou Locataire pour rattacher un lot.");
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/residents/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apartment: apartmentId,
          fullName: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          password,
          type: redesignRoleToApi(role) === ApiRole.TENANT ? "TENANT" : "OWNER",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Échec (${res.status})`);
      setSuccess(
        json.meta?.createdAccount
          ? "Compte créé et résident rattaché au lot."
          : "Compte existant rattaché au lot."
      );
      setShowModal(false);
      setName("");
      setEmail("");
      setPassword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec");
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Annuaire & Gouvernance
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
            Fiches Copropriétaires & Résidents
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Annuaire des résidents, coordonnées certifiées et gestion des rôles
          </p>
        </div>

        {canList && (
          <button
            onClick={() => void openCreateModal()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter au lot</span>
          </button>
        )}
      </div>

      {(error || success) && (
        <div className="space-y-2">
          {error && (
            <div
              role="alert"
              className="glass-card rounded-3xl p-4 border border-rose-500/25 bg-rose-500/10 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div
              role="status"
              className="glass-card rounded-3xl p-4 border border-emerald-500/25 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}
        </div>
      )}

      {!canList && !loading && (
        <div className="glass-card rounded-3xl p-5 border border-amber-500/25 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200">
          Liste des comptes réservée au syndic et à l’administrateur.
        </div>
      )}

      <div className="p-4 rounded-3xl glass-card flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par nom, email ou numéro de téléphone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Rôle:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px]"
            >
              <option value="Tous">Tous</option>
              <option value="Copropriétaire">Copropriétaire</option>
              <option value="Locataire">Locataire</option>
              <option value="Syndic">Syndic</option>
              <option value="Technicien">Technicien</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-card rounded-3xl p-10 animate-pulse min-h-[200px]" />
      ) : canList ? (
        <div className="rounded-3xl glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/60 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.06] text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="py-3.5 px-5">Nom</th>
                  <th className="py-3.5 px-4">Rôle</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Téléphone</th>
                  <th className="py-3.5 px-5 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-5 text-center text-slate-500">
                      Aucun utilisateur.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors group">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold text-[11px] flex items-center justify-center shadow-xs">
                            {item.name
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")}
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">{item.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            item.role === "Syndic"
                              ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                              : item.role === "Copropriétaire"
                                ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                                : item.role === "Locataire"
                                  ? "bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30"
                                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {item.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">{item.email}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">{item.phone || "—"}</td>
                      <td className="py-3.5 px-5 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{item.active ? "Actif" : "Inactif"}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {showModal && canList && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowModal(false)}
        >
          <div className="w-full max-w-md glass-card rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/[0.08]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Ajouter un résident à un lot
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreate(e)} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">
                  Appartement / Lot *
                </label>
                <select
                  required
                  value={apartmentId}
                  onChange={(e) => setApartmentId(e.target.value)}
                  className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                >
                  {apartments.length === 0 && <option value="">Aucun lot disponible</option>}
                  {apartments.map((a) => (
                    <option key={a._id} value={a._id}>
                      Lot {a.number}
                      {a.residence?.name ? ` — ${a.residence.name}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Nom complet *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Khaled Ben Salem"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Adresse email *</label>
                <input
                  type="email"
                  required
                  placeholder="ex: khaled@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Mot de passe initial *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Téléphone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Qualité</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="Copropriétaire">Propriétaire</option>
                    <option value="Locataire">Locataire</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-md shadow-blue-500/20"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
