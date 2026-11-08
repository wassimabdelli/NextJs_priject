"use client";

import React from "react";
import {
  Check,
  X,
  Clock,
  RefreshCw,
  AlertTriangle,
  Building2,
  UserRound,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Role } from "@/types/enums";

type JoinItem = {
  _id: string;
  apartmentNumber: string;
  residentType: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  message?: string;
  rejectionReason?: string;
  createdAt: string;
  residence?: { _id: string; name?: string; city?: string };
  user?: { _id: string; name?: string; email?: string; phone?: string };
};

export default function JoinRequestsClientPage() {
  const [items, setItems] = React.useState<JoinItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [role, setRole] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sess = await fetch("/api/auth/session").then((r) => r.json());
      const r = sess?.user?.role as string | undefined;
      setRole(r || null);
      if (r !== Role.ADMIN && r !== Role.SYNDIC) {
        setItems([]);
        setError("Réservé au syndic et à l’administrateur.");
        return;
      }
      const res = await fetch("/api/join-requests?status=PENDING&limit=50");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Impossible de charger les demandes");
      setItems(json.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const approve = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/join-requests/${id}/approve`, { method: "PATCH" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Échec approbation (${res.status})`);
      setItems((prev) => prev.filter((i) => i._id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l’approbation");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    const reason = window.prompt("Motif du refus (facultatif) :") || undefined;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/join-requests/${id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Échec refus (${res.status})`);
      setItems((prev) => prev.filter((i) => i._id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec du refus");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fadeIn pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Validation syndic
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
              Demandes de rattachement
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Approuvez ou refusez les demandes des résidents pour un lot
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-xs text-rose-800 dark:text-rose-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="h-40 animate-pulse rounded-3xl glass-card" />
        ) : items.length === 0 ? (
          <div className="rounded-3xl glass-card p-8 text-center text-sm text-slate-500">
            Aucune demande en attente.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item._id}
                className="rounded-3xl glass-card p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 border border-amber-500/25">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {item.user?.name || "Demandeur"}
                      </p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25">
                        {item.residentType === "TENANT" ? "Locataire" : "Propriétaire"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      {item.residence?.name || "Résidence"} — Lot {item.apartmentNumber}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5" />
                      {item.user?.email || "—"}
                      {item.user?.phone ? ` · ${item.user.phone}` : ""}
                    </p>
                    {item.message && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                        « {item.message} »
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400">
                      Demandée le {new Date(item.createdAt).toLocaleString("fr-FR")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busyId === item._id}
                    onClick={() => void approve(item._id)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-xs font-bold text-white disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Approuver
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item._id}
                    onClick={() => void reject(item._id)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200 disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" />
                    Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {role && role !== Role.ADMIN && role !== Role.SYNDIC && (
          <p className="text-xs text-slate-500">Connectez-vous en tant que syndic pour gérer les demandes.</p>
        )}
      </div>
    </AppLayout>
  );
}
