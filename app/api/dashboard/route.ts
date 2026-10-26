import type { NextRequest } from "next/server";
import { json } from "@/lib/api";
import { withAuth, type AuthUser, getSyndicResidenceIds, getResidentApartmentIds, getResidentResidenceIds } from "@/lib/auth-guard";
import { Role, IncidentStatus, ChargeStatus } from "@/types/enums";
import { Apartment } from "@/models/Apartment";
import { Charge } from "@/models/Charge";
import { Payment } from "@/models/Payment";
import { Expense } from "@/models/Expense";
import { Incident } from "@/models/Incident";
import { Announcement } from "@/models/Announcement";

/**
 * GET /api/dashboard
 * Endpoint unique retournant les métriques et chiffres adaptés selon le rôle connecté :
 * - ADMIN / SYNDIC : KPI (taux recouvrement, trésorerie, incidents ouverts, impayés) + graphiques
 * - RESIDENT : Ce que je dois, dernières annonces, mes incidents
 * - TECHNICIAN : Mes interventions (assignées, en cours, résolues)
 */
export const GET = withAuth(
  async (_req: NextRequest, user: AuthUser) => {
    // -------------------------------------------------------------
    // 1. SYNDIC & ADMIN
    // -------------------------------------------------------------
    if (user.role === Role.ADMIN || user.role === Role.SYNDIC) {
      let residenceFilter: any = {};
      let residenceIds: string[] = [];

      if (user.role === Role.SYNDIC) {
        residenceIds = await getSyndicResidenceIds(user.id);
        residenceFilter = { residence: { $in: residenceIds } };
      }

      // Lots de la copropriété
      const aptIds = await Apartment.find(residenceFilter).distinct("_id");
      const currentMonth = new Date().toISOString().slice(0, 7);

      // Charges du mois et taux de recouvrement
      const monthCharges = await Charge.find({
        apartment: { $in: aptIds },
        period: currentMonth,
      }).lean();

      let totalMonthAmount = 0;
      let totalMonthPaid = 0;
      monthCharges.forEach((c) => {
        totalMonthAmount += c.amount || 0;
        totalMonthPaid += c.paidAmount || 0;
      });

      const collectionRate =
        totalMonthAmount > 0
          ? Math.round((totalMonthPaid / totalMonthAmount) * 100)
          : 100;

      // Trésorerie = Recettes encaissées - Dépenses
      const chargeIds = await Charge.find({ apartment: { $in: aptIds } }).distinct("_id");
      const [paymentSum] = await Payment.aggregate<{ total: number }>([
        { $match: { charge: { $in: chargeIds } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      const [expenseSum] = await Expense.aggregate<{ total: number }>([
        { $match: residenceFilter },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      const totalPayments = paymentSum?.total || 0;
      const totalExpenses = expenseSum?.total || 0;
      const treasury = Math.round((totalPayments - totalExpenses) * 100) / 100;

      // Incidents ouverts
      const incFilter: any = {
        status: { $in: [IncidentStatus.REPORTED, IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS] },
      };
      if (residenceIds.length > 0) incFilter.residence = { $in: residenceIds };
      const openIncidents = await Incident.countDocuments(incFilter);

      // Impayés globaux
      const unpaidCharges = await Charge.find({
        apartment: { $in: aptIds },
        status: { $in: [ChargeStatus.PENDING, ChargeStatus.PARTIAL, ChargeStatus.OVERDUE] },
      }).lean();
      const unpaidAmount = Math.round(
        unpaidCharges.reduce(
          (acc: number, c: any) => acc + Math.max(0, (c.amount || 0) - (c.paidAmount || 0)),
          0
        ) * 100
      ) / 100;

      // Graphique 1 : Recettes vs Dépenses par mois (6 derniers mois)
      const months: string[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(d.toISOString().slice(0, 7));
      }

      // Agrégation dépenses par mois
      const expensesByMonth = await Expense.aggregate<{ _id: string; total: number }>([
        { $match: residenceFilter },
        {
          $group: {
            _id: { $substr: [{ $dateToString: { date: "$expenseDate" } }, 0, 7] },
            total: { $sum: "$amount" },
          },
        },
      ]);
      const expMap = new Map(expensesByMonth.map((e) => [e._id, e.total]));

      // Agrégation paiements par mois
      const paymentsByMonth = await Payment.aggregate<{ _id: string; total: number }>([
        { $match: { charge: { $in: chargeIds } } },
        {
          $group: {
            _id: { $substr: [{ $dateToString: { date: "$paymentDate" } }, 0, 7] },
            total: { $sum: "$amount" },
          },
        },
      ]);
      const payMap = new Map(paymentsByMonth.map((p) => [p._id, p.total]));

      const financialByMonth = months.map((m) => {
        const dateObj = new Date(m + "-01");
        const monthLabel = dateObj.toLocaleDateString("fr-FR", { month: "short" });
        return {
          month: monthLabel,
          period: m,
          recettes: Math.round((payMap.get(m) || 0) * 100) / 100,
          depenses: Math.round((expMap.get(m) || 0) * 100) / 100,
        };
      });

      // Graphique 2 : Incidents par statut
      const incAggregation = await Incident.aggregate<{ _id: string; count: number }>([
        { $match: residenceIds.length > 0 ? { residence: { $in: residenceIds } } : {} },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);
      const statusMap = new Map(incAggregation.map((i) => [i._id, i.count]));

      const incidentsByStatus = [
        { status: "REPORTED", label: "Signalé", count: statusMap.get(IncidentStatus.REPORTED) || 0, color: "#38bdf8" },
        { status: "ASSIGNED", label: "Assigné", count: statusMap.get(IncidentStatus.ASSIGNED) || 0, color: "#f59e0b" },
        { status: "IN_PROGRESS", label: "En cours", count: statusMap.get(IncidentStatus.IN_PROGRESS) || 0, color: "#6366f1" },
        { status: "RESOLVED", label: "Résolu", count: statusMap.get(IncidentStatus.RESOLVED) || 0, color: "#10b981" },
      ];

      return json({
        role: user.role,
        kpi: {
          period: currentMonth,
          collectionRate,
          treasury,
          openIncidents,
          unpaidAmount,
          totalApartments: aptIds.length,
        },
        charts: {
          financialByMonth,
          incidentsByStatus,
        },
      });
    }

    // -------------------------------------------------------------
    // 2. RESIDENT
    // -------------------------------------------------------------
    if (user.role === Role.RESIDENT) {
      const aptIds = await getResidentApartmentIds(user.id);
      const resIds = await getResidentResidenceIds(user.id);

      // Ce que je dois
      const unpaidCharges = await Charge.find({
        apartment: { $in: aptIds },
        status: { $in: [ChargeStatus.PENDING, ChargeStatus.PARTIAL, ChargeStatus.OVERDUE] },
      })
        .populate("apartment", "number floor")
        .sort({ dueDate: 1 })
        .lean();

      const totalDue = Math.round(
        unpaidCharges.reduce(
          (acc: number, c: any) => acc + Math.max(0, (c.amount || 0) - (c.paidAmount || 0)),
          0
        ) * 100
      ) / 100;


      // Dernières annonces
      const announcements = await Announcement.find({
        residence: { $in: resIds },
      })
        .populate("author", "name")
        .sort({ isPinned: -1, publishedAt: -1 })
        .limit(5)
        .lean();

      // Mes incidents signalés
      const incidents = await Incident.find({
        reportedBy: user.id,
      })
        .sort({ reportedAt: -1 })
        .limit(5)
        .lean();

      const totalIncidents = await Incident.countDocuments({ reportedBy: user.id });
      const openIncidents = await Incident.countDocuments({
        reportedBy: user.id,
        status: { $in: [IncidentStatus.REPORTED, IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS] },
      });

      return json({
        role: user.role,
        whatIOwe: {
          totalDue,
          unpaidCharges,
        },
        latestAnnouncements: announcements,
        myIncidents: {
          items: incidents,
          total: totalIncidents,
          open: openIncidents,
        },
      });
    }

    // -------------------------------------------------------------
    // 3. TECHNICIAN
    // -------------------------------------------------------------
    if (user.role === Role.TECHNICIAN) {
      const interventions = await Incident.find({
        assignedTo: user.id,
      })
        .populate("residence", "name city address")
        .populate("apartment", "number floor")
        .sort({ reportedAt: -1 })
        .lean();

      const pendingInterventions = interventions.filter(
        (i) => i.status !== IncidentStatus.RESOLVED
      );
      const resolvedInterventions = interventions
        .filter((i) => i.status === IncidentStatus.RESOLVED)
        .slice(0, 5);

      const assignedCount = interventions.filter(
        (i) => i.status === IncidentStatus.ASSIGNED
      ).length;
      const inProgressCount = interventions.filter(
        (i) => i.status === IncidentStatus.IN_PROGRESS
      ).length;
      const resolvedCount = interventions.filter(
        (i) => i.status === IncidentStatus.RESOLVED
      ).length;

      return json({
        role: user.role,
        myInterventions: {
          pending: pendingInterventions,
          recentResolved: resolvedInterventions,
          counts: {
            assigned: assignedCount,
            inProgress: inProgressCount,
            resolved: resolvedCount,
            total: interventions.length,
          },
        },
      });
    }

    return json({ role: user.role, message: "Aucune donnée spécifique pour ce rôle" });
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT, Role.TECHNICIAN] }
);
