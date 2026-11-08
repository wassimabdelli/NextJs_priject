"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardView } from "@/components/redesign/DashboardView";
import { TAB_PATHS, useRedesign } from "@/lib/redesign/store";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import type { AttachmentRequest, Charge, Expense, Incident } from "@/lib/redesign/condo";

type DashboardApi = {
  role?: string;
  pendingJoinRequests?: Array<{
    _id: string;
    apartmentNumber?: string;
    residentType?: string;
    residence?: { name?: string };
    user?: { name?: string; email?: string };
  }>;
  kpi?: {
    collectionRate?: number;
    treasury?: number;
    openIncidents?: number;
    unpaidAmount?: number;
  };
  charts?: {
    financialByMonth?: Array<{ month: string; recettes: number; depenses: number }>;
  };
  totalDue?: number;
};

/** Tableau de bord redesign + hydratation API réelle. */
export default function DashboardPage() {
  const store = useRedesign();
  const router = useRouter();
  const [charges, setCharges] = React.useState<Charge[]>(store.charges);
  const [expenses, setExpenses] = React.useState<Expense[]>(store.expenses);
  const [incidents, setIncidents] = React.useState<Incident[]>(store.incidents);
  const [attachments, setAttachments] = React.useState<AttachmentRequest[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [dash, chargesRes, expensesRes, incidentsRes] = await Promise.all([
        fetchWithOffline<DashboardApi>("/api/dashboard"),
        fetchWithOffline<{ data: any[] }>("/api/charges?limit=100").catch(() => ({ data: [] })),
        fetchWithOffline<{ data: any[] }>("/api/expenses?limit=100").catch(() => ({ data: [] })),
        fetchWithOffline<{ data: any[] }>("/api/incidents?limit=50").catch(() => ({ data: [] })),
      ]);

      const mappedCharges: Charge[] = (chargesRes.data || []).map((c: any) => ({
        id: String(c._id),
        lotNumber: c.apartment?.number ? `Lot ${c.apartment.number}` : "Lot —",
        period: c.period || "",
        calledAmount: c.amount || 0,
        paidAmount: c.paidAmount || 0,
        status:
          c.status === "PAID"
            ? "Payé"
            : c.status === "PARTIAL"
              ? "Partiel"
              : "En retard",
        dueDate: c.dueDate
          ? new Date(c.dueDate).toLocaleDateString("fr-FR")
          : "",
        residenceId: String(c.apartment?.residence || store.activeResidence.id),
      }));

      // Si KPI dashboard dispo, injecte une charge synthétique pour coller aux totaux UI
      if (dash.kpi && mappedCharges.length === 0 && (dash.kpi.unpaidAmount || 0) > 0) {
        mappedCharges.push({
          id: "kpi-unpaid",
          lotNumber: "Global",
          period: dash.kpi ? "mois" : "",
          calledAmount: dash.kpi.unpaidAmount || 0,
          paidAmount: 0,
          status: "En retard",
          dueDate: "",
          residenceId: store.activeResidence.id,
        });
      }

      // Ajuste collection via charge fictive paid si treasury/collection fournis
      if (dash.kpi?.collectionRate != null && mappedCharges.length > 0) {
        // laisse calculateFinancialSummary sur données réelles
      }

      const mappedExpenses: Expense[] = (expensesRes.data || []).map((e: any) => ({
        id: String(e._id),
        description: e.description || e.title || "Dépense",
        residenceName: e.residence?.name || store.activeResidence.name,
        category: (e.category || "OTHER") as Expense["category"],
        amount: e.amount || 0,
        date: e.expenseDate
          ? new Date(e.expenseDate).toLocaleDateString("fr-FR")
          : "",
        receiptUrl: e.receiptUrl,
      }));

      // Si pas de dépenses mais KPI treasury, laisse expenses vides
      if (dash.charts?.financialByMonth?.length && mappedExpenses.length === 0) {
        for (const row of dash.charts.financialByMonth) {
          if (row.depenses > 0) {
            mappedExpenses.push({
              id: `exp-${row.month}`,
              description: `Dépenses ${row.month}`,
              residenceName: store.activeResidence.name,
              category: "OTHER",
              amount: row.depenses,
              date: row.month,
            });
          }
        }
      }

      const statusMap: Record<string, Incident["status"]> = {
        REPORTED: "Signalé",
        ASSIGNED: "Assigné",
        IN_PROGRESS: "En cours",
        RESOLVED: "Résolu",
      };
      const mappedIncidents: Incident[] = (incidentsRes.data || []).map((i: any) => ({
        id: String(i._id),
        code: `#${String(i._id).slice(-6).toUpperCase()}`,
        title: i.title || "Incident",
        description: i.description || "",
        priority:
          i.priority === "HIGH" || i.priority === "URGENT"
            ? "Haute"
            : i.priority === "MEDIUM"
              ? "Moyenne"
              : "Basse",
        status: statusMap[i.status] || "Signalé",
        residenceName: i.residence?.name || store.activeResidence.name,
        lotNumber: i.apartment?.number,
        reportedBy: i.reportedBy?.name || "—",
        category: i.category || "Autre",
        createdAt: i.createdAt
          ? new Date(i.createdAt).toLocaleString("fr-FR")
          : "",
      }));

      const joinMapped: AttachmentRequest[] = (dash.pendingJoinRequests || []).map((r) => ({
        id: r._id,
        residentName: r.user?.name || "Résident",
        role: r.residentType === "TENANT" ? "Locataire" : "Propriétaire",
        residenceName: r.residence?.name || store.activeResidence.name,
        lotNumber: r.apartmentNumber || "—",
        email: r.user?.email || "",
        status: "En attente" as const,
        requestDate: new Date().toLocaleDateString("fr-FR"),
      }));

      setCharges(mappedCharges.length ? mappedCharges : store.charges);
      setExpenses(mappedExpenses.length ? mappedExpenses : store.expenses);
      setIncidents(mappedIncidents.length ? mappedIncidents : store.incidents);
      setAttachments(joinMapped);
      store.setIncidents(mappedIncidents.length ? mappedIncidents : store.incidents);
    } catch {
      // garde les données store / démo si API indisponible (offline)
      setCharges(store.charges);
      setExpenses(store.expenses);
      setIncidents(store.incidents);
    } finally {
      setLoading(false);
    }
  }, [store]);

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approve = async (id: string) => {
    try {
      const res = await fetch(`/api/join-requests/${id}/approve`, { method: "PATCH" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(json.error || `Impossible d'approuver (${res.status})`);
        return;
      }
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Erreur réseau");
    }
  };

  const reject = async (id: string) => {
    const reason = prompt("Motif du refus ?") || "Refus syndic";
    try {
      const res = await fetch(`/api/join-requests/${id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(json.error || `Impossible de refuser (${res.status})`);
        return;
      }
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Erreur réseau");
    }
  };

  return (
    <AppLayout>
      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl glass-card" aria-busy="true" />
      ) : (
        <DashboardView
          charges={charges}
          expenses={expenses}
          incidents={incidents}
          attachmentRequests={attachments}
          onApproveAttachment={approve}
          onRejectAttachment={reject}
          onNavigate={(tab) => router.push(TAB_PATHS[tab] || "/dashboard")}
          activeResidence={store.activeResidence}
          onOpenNewIncident={() => router.push("/incidents")}
        />
      )}
    </AppLayout>
  );
}
