import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { json } from "@/lib/api";
import { withAuth, type AuthUser, getSyndicResidenceIds, getResidentApartmentIds, getResidentResidenceIds } from "@/lib/auth-guard";
import { Role, IncidentStatus, ChargeStatus, AnnouncementAudience, AnnouncementStatus } from "@/types/enums";
import { Apartment } from "@/models/Apartment";
import { Charge } from "@/models/Charge";
import { Payment } from "@/models/Payment";
import { Expense } from "@/models/Expense";
import { Incident } from "@/models/Incident";
import { Announcement } from "@/models/Announcement";
import { User } from "@/models/User";
import { Residence } from "@/models/Residence";
import AnnouncementRead from "@/models/AnnouncementRead";
import { Notification } from "@/models/Notification";
import { getTechnicianResidenceIds } from "@/lib/auth-guard";
import { publishedAnnouncementFilter } from "@/lib/announcements/visibility";
import { getEligibleResidentIdsByResidence, getReadCountsByAnnouncement } from "@/lib/announcements/readStats";
import { publishDueAnnouncements } from "@/lib/announcements/publication";

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
      let residenceFilter: Record<string, unknown> = {};
      let residenceIds: string[] = [];

      if (user.role === Role.SYNDIC) {
        residenceIds = await getSyndicResidenceIds(user.id);
        residenceFilter = { residence: { $in: residenceIds } };
      }
      await publishDueAnnouncements(user.role === Role.ADMIN ? null : residenceIds);

      // Lots de la copropriété
      const aptIds = await Apartment.find(residenceFilter).distinct("_id");
      const currentMonth = new Date().toISOString().slice(0, 7);

      // Charges du mois et taux de recouvrement
      const [monthChargeSummary] = await Charge.aggregate<{ totalAmount: number; totalPaid: number }>([
        { $match: { apartment: { $in: aptIds }, period: currentMonth } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" }, totalPaid: { $sum: "$paidAmount" } } },
      ]);
      const totalMonthAmount = monthChargeSummary?.totalAmount ?? 0;
      const totalMonthPaid = monthChargeSummary?.totalPaid ?? 0;

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
      const incFilter: Record<string, unknown> = {
        status: { $in: [IncidentStatus.REPORTED, IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS] },
      };
      if (user.role === Role.SYNDIC) incFilter.residence = { $in: residenceIds };
      const openIncidents = await Incident.countDocuments(incFilter);

      // Impayés globaux
      const [unpaidChargeSummary] = await Charge.aggregate<{ total: number }>([
        { $match: { apartment: { $in: aptIds }, status: { $in: [ChargeStatus.PENDING, ChargeStatus.PARTIAL, ChargeStatus.OVERDUE] } } },
        { $addFields: { remainingAmount: { $subtract: [{ $ifNull: ["$amount", 0] }, { $ifNull: ["$paidAmount", 0] }] } } },
        { $group: { _id: null, total: { $sum: { $cond: [{ $gt: ["$remainingAmount", 0] }, "$remainingAmount", 0] } } } },
      ]);
      const unpaidAmount = Math.round((unpaidChargeSummary?.total ?? 0) * 100) / 100;

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
      const managedIncidentFilter = user.role === Role.SYNDIC
        ? { residence: { $in: residenceIds } }
        : {};
      const [
        roleCounts,
        residenceCount,
        incidentCounts,
        publishedAnnouncementCount,
        scheduledAnnouncementCount,
        announcementTrendRows,
        urgentIncidents,
        latestAnnouncements,
        workloadRows,
        latestNotifications,
      ] = await Promise.all([
        user.role === Role.ADMIN
          ? User.aggregate<{ _id: string; count: number }>([
              { $match: { isActive: true } },
              { $group: { _id: "$role", count: { $sum: 1 } } },
            ])
          : Promise.resolve([]),
        Residence.countDocuments(user.role === Role.SYNDIC ? { _id: { $in: residenceIds } } : {}),
        Incident.aggregate<{ _id: string; count: number }>([
          { $match: managedIncidentFilter },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Announcement.countDocuments({
          ...residenceFilter,
          ...publishedAnnouncementFilter(),
          status: AnnouncementStatus.PUBLISHED,
          publishedAt: { $lte: new Date() },
        }),
        Announcement.countDocuments({ ...residenceFilter, status: AnnouncementStatus.SCHEDULED }),
        Announcement.aggregate<{ _id: string; count: number }>([
          {
            $match: {
              ...residenceFilter,
              ...publishedAnnouncementFilter(),
              status: AnnouncementStatus.PUBLISHED,
              publishedAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1), $lte: now },
            },
          },
          { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$publishedAt" } }, count: { $sum: 1 } } },
        ]),
        Incident.aggregate<{
          _id: mongoose.Types.ObjectId;
          title: string;
          category: string;
          priority: string;
          status: string;
          createdAt: Date;
          residence: mongoose.Types.ObjectId;
          residenceName: string;
        }>([
          { $match: { ...managedIncidentFilter, status: { $ne: IncidentStatus.RESOLVED }, priority: { $in: ["URGENT", "HIGH"] } } },
          { $addFields: { priorityOrder: { $cond: [{ $eq: ["$priority", "URGENT"] }, 2, 1] } } },
          { $sort: { priorityOrder: -1, createdAt: 1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: Residence.collection.name,
              localField: "residence",
              foreignField: "_id",
              pipeline: [{ $project: { name: 1 } }],
              as: "residenceDoc",
            },
          },
          { $addFields: { residenceName: { $ifNull: [{ $arrayElemAt: ["$residenceDoc.name", 0] }, ""] } } },
          { $project: { title: 1, category: 1, priority: 1, status: 1, createdAt: 1, residence: 1, residenceName: 1 } },
        ]),
        Announcement.find({
          ...residenceFilter,
          ...publishedAnnouncementFilter(),
          status: AnnouncementStatus.PUBLISHED,
          publishedAt: { $lte: new Date() },
        })
          .sort({ isPinned: -1, publishedAt: -1 })
          .limit(5)
          .select("title category priority audience publishedAt residence")
          .populate<{ residence: { _id: mongoose.Types.ObjectId; name: string } }>({ path: "residence", select: "name" })
          .lean(),
        Incident.aggregate<{ _id: string; assigned: number; inProgress: number; resolved: number }>([
          { $match: { ...managedIncidentFilter, assignedTo: { $ne: null } } },
          { $group: {
            _id: "$assignedTo",
            assigned: { $sum: { $cond: [{ $eq: ["$status", IncidentStatus.ASSIGNED] }, 1, 0] } },
            inProgress: { $sum: { $cond: [{ $eq: ["$status", IncidentStatus.IN_PROGRESS] }, 1, 0] } },
            resolved: { $sum: { $cond: [{ $eq: ["$status", IncidentStatus.RESOLVED] }, 1, 0] } },
          } },
          { $limit: 20 },
        ]),
        Notification.find({ recipient: user.id })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("title message type isRead createdAt relatedResource")
          .lean(),
      ]);
      const statusMap = new Map(incidentCounts.map((item) => [item._id, item.count]));
      const usersByRole = new Map(roleCounts.map((item) => [item._id, item.count]));
      let scopedResidentCount = usersByRole.get(Role.RESIDENT) ?? 0;
      let scopedTechnicianCount = usersByRole.get(Role.TECHNICIAN) ?? 0;
      if (user.role === Role.SYNDIC) {
        const [eligibleByResidence, assignedTechnicianIds] = await Promise.all([
          getEligibleResidentIdsByResidence(residenceIds),
          Incident.distinct("assignedTo", {
            residence: { $in: residenceIds },
            assignedTo: { $ne: null },
          }),
        ]);
        scopedResidentCount = [...eligibleByResidence.values()].reduce((sum, ids) => sum + ids.size, 0);
        scopedTechnicianCount = await User.countDocuments({
          _id: { $in: assignedTechnicianIds },
          role: Role.TECHNICIAN,
          isActive: true,
        });
      }
      const workloadUsers = await User.find({
        _id: { $in: workloadRows.map((item) => item._id) },
        isActive: true,
      }).select("_id name").lean();
      const workloadNames = new Map(workloadUsers.map((item) => [String(item._id), item.name]));
      const eligibleResidents = await getEligibleResidentIdsByResidence(
        [...new Set(latestAnnouncements.map((item) => String(item.residence && typeof item.residence === "object" ? item.residence._id : item.residence)))]
      );
      const readsByAnnouncement = await getReadCountsByAnnouncement(
        latestAnnouncements.map((announcement) => ({
          id: String(announcement._id),
          residenceId: String(announcement.residence && typeof announcement.residence === "object"
            ? announcement.residence._id
            : announcement.residence),
        })),
        eligibleResidents
      );
      const announcementOverview = latestAnnouncements.map((announcement) => {
        const residenceId = String(announcement.residence && typeof announcement.residence === "object" ? announcement.residence._id : announcement.residence);
        const eligible = announcement.audience === AnnouncementAudience.TECHNICIANS
          ? null
          : eligibleResidents.get(residenceId)?.size ?? 0;
        const reads = eligible === null
          ? 0
          : Math.min(readsByAnnouncement.get(String(announcement._id)) ?? 0, eligible);
        return {
          id: String(announcement._id),
          title: announcement.title,
          category: announcement.category,
          priority: announcement.priority,
          publishedAt: announcement.publishedAt,
          residence: announcement.residence && typeof announcement.residence === "object" ? announcement.residence.name : "",
          readCount: reads,
          eligibleReadCount: eligible,
          readPercentage: eligible === null ? null : eligible ? Math.round((reads / eligible) * 100) : 0,
        };
      });

      const incidentsByStatus = [
        { status: "REPORTED", label: "Signalé", count: statusMap.get(IncidentStatus.REPORTED) || 0, color: "#38bdf8" },
        { status: "ASSIGNED", label: "Assigné", count: statusMap.get(IncidentStatus.ASSIGNED) || 0, color: "#f59e0b" },
        { status: "IN_PROGRESS", label: "En cours", count: statusMap.get(IncidentStatus.IN_PROGRESS) || 0, color: "#6366f1" },
        { status: "RESOLVED", label: "Résolu", count: statusMap.get(IncidentStatus.RESOLVED) || 0, color: "#10b981" },
      ];
      const announcementTrendCounts = new Map(announcementTrendRows.map((item) => [item._id, item.count]));
      const announcementByMonth = months.map((period) => ({
        month: new Date(`${period}-01T00:00:00.000Z`).toLocaleDateString("fr-FR", { month: "short" }),
        period,
        count: announcementTrendCounts.get(period) ?? 0,
      }));

      const technicianWorkload = workloadRows.map((item) => ({
        technicianId: String(item._id),
        name: workloadNames.get(String(item._id)) ?? "Technicien",
        assigned: item.assigned,
        inProgress: item.inProgress,
        resolved: item.resolved,
        currentWorkload: item.assigned + item.inProgress,
      })).filter((item) => item.name);

      const overview = {
        residences: residenceCount,
        users: user.role === Role.ADMIN
          ? [...usersByRole.values()].reduce((sum, count) => sum + count, 0)
          : scopedResidentCount + scopedTechnicianCount + (user.role === Role.SYNDIC ? 1 : 0),
        residents: scopedResidentCount,
        technicians: scopedTechnicianCount,
        incidents: [...statusMap.values()].reduce((sum, count) => sum + count, 0),
        reported: statusMap.get(IncidentStatus.REPORTED) ?? 0,
        assigned: statusMap.get(IncidentStatus.ASSIGNED) ?? 0,
        inProgress: statusMap.get(IncidentStatus.IN_PROGRESS) ?? 0,
        resolved: statusMap.get(IncidentStatus.RESOLVED) ?? 0,
        urgent: await Incident.countDocuments({ ...managedIncidentFilter, status: { $ne: IncidentStatus.RESOLVED }, priority: "URGENT" }),
        rejectedResolutions: await Incident.countDocuments({
          ...managedIncidentFilter,
          status: { $ne: IncidentStatus.RESOLVED },
          resolutionRejectedAt: { $exists: true },
        }),
        publishedAnnouncements: publishedAnnouncementCount,
        scheduledAnnouncements: scheduledAnnouncementCount,
        urgentIncidents: urgentIncidents.map((item) => ({
          id: String(item._id),
          title: item.title,
          category: item.category,
          priority: item.priority,
          status: item.status,
          createdAt: item.createdAt,
          residence: item.residenceName,
        })),
        recentAnnouncements: announcementOverview,
        technicianWorkload,
        unreadNotifications: await Notification.countDocuments({ recipient: user.id, isRead: false }),
      };

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
          announcementByMonth,
        },
        overview,
        latestNotifications,
      });
    }

    // -------------------------------------------------------------
    // 2. RESIDENT
    // -------------------------------------------------------------
    if (user.role === Role.RESIDENT) {
      const aptIds = await getResidentApartmentIds(user.id);
      const resIds = await getResidentResidenceIds(user.id);
      await publishDueAnnouncements(resIds);

      // Ce que je dois
      const unpaidChargeFilter = {
        apartment: { $in: aptIds },
        status: { $in: [ChargeStatus.PENDING, ChargeStatus.PARTIAL, ChargeStatus.OVERDUE] },
      };
      const [unpaidCharges, unpaidChargeSummary] = await Promise.all([
        Charge.find(unpaidChargeFilter)
          .populate("apartment", "number floor")
          .sort({ dueDate: 1 })
          .limit(5)
          .select("period dueDate amount paidAmount status apartment")
          .lean(),
        Charge.aggregate<{ total: number }>([
          { $match: unpaidChargeFilter },
          { $addFields: { remainingAmount: { $subtract: [{ $ifNull: ["$amount", 0] }, { $ifNull: ["$paidAmount", 0] }] } } },
          { $group: { _id: null, total: { $sum: { $cond: [{ $gt: ["$remainingAmount", 0] }, "$remainingAmount", 0] } } } },
        ]),
      ]);
      const totalDue = Math.round((unpaidChargeSummary[0]?.total ?? 0) * 100) / 100;


      // Dernières annonces
      const announcementFilter = {
        residence: { $in: resIds },
        ...publishedAnnouncementFilter(),
        audience: { $in: [AnnouncementAudience.RESIDENTS, AnnouncementAudience.ALL] },
      };
      const [announcements, incidents, incidentCounts, notifications, apartments, unreadNotificationCount] = await Promise.all([
        Announcement.find(announcementFilter)
          .sort({ isPinned: -1, priority: -1, publishedAt: -1 })
          .limit(6)
          .select("title content category priority isPinned publishedAt residence")
          .lean(),
        Incident.find({ reportedBy: user.id })
          .sort({ createdAt: -1, reportedAt: -1 })
          .limit(6)
          .select("title category priority status reportedAt createdAt updatedAt resolutionSubmittedAt")
          .lean(),
        Incident.aggregate<{ _id: string; count: number }>([
          { $match: { reportedBy: new mongoose.Types.ObjectId(user.id) } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Notification.find({ recipient: user.id })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("title message type isRead createdAt relatedResource")
          .lean(),
        Apartment.find({ _id: { $in: aptIds } })
          .select("number floor residence")
          .populate<{ residence: { _id: mongoose.Types.ObjectId; name: string; city: string } }>({ path: "residence", select: "name city" })
          .lean(),
        Notification.countDocuments({ recipient: user.id, isRead: false }),
      ]);
      const announcementIds = announcements.map((item) => item._id);
      const readAnnouncementIds = new Set((await AnnouncementRead.distinct("announcement", {
        resident: user.id,
        announcement: { $in: announcementIds },
      })).map(String));
      const unreadAnnouncementRows = await Announcement.aggregate<{ count: number }>([
        { $match: announcementFilter },
        {
          $lookup: {
            from: AnnouncementRead.collection.name,
            let: { announcementId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$announcement", "$$announcementId"] },
                      { $eq: ["$resident", new mongoose.Types.ObjectId(user.id)] },
                    ],
                  },
                },
              },
              { $limit: 1 },
              { $project: { _id: 1 } },
            ],
            as: "readRecord",
          },
        },
        { $match: { readRecord: { $size: 0 } } },
        { $count: "count" },
      ]);
      const unreadAnnouncements = unreadAnnouncementRows[0]?.count ?? 0;
      const countByStatus = new Map(incidentCounts.map((item) => [item._id, item.count]));
      const totalIncidents = [...countByStatus.values()].reduce((sum, count) => sum + count, 0);
      const openIncidents = totalIncidents - (countByStatus.get(IncidentStatus.RESOLVED) ?? 0);
      const residenceDetails = [...new Map(apartments.flatMap((apartment) => {
        if (!apartment.residence || typeof apartment.residence !== "object") return [];
        return [[String(apartment.residence._id), {
          id: String(apartment.residence._id),
          name: apartment.residence.name,
          city: apartment.residence.city,
        }] as const];
      })).values()];

      return json({
        role: user.role,
        overview: {
          total: totalIncidents,
          reported: countByStatus.get(IncidentStatus.REPORTED) ?? 0,
          assigned: countByStatus.get(IncidentStatus.ASSIGNED) ?? 0,
          inProgress: countByStatus.get(IncidentStatus.IN_PROGRESS) ?? 0,
          resolved: countByStatus.get(IncidentStatus.RESOLVED) ?? 0,
          urgent: await Incident.countDocuments({ reportedBy: user.id, status: { $ne: IncidentStatus.RESOLVED }, priority: "URGENT" }),
          open: openIncidents,
          unreadAnnouncements,
          unreadNotifications: unreadNotificationCount,
        },
        residences: residenceDetails,
        whatIOwe: {
          totalDue,
          unpaidCharges: unpaidCharges.map((charge) => ({
            ...charge,
            remaining: Math.max(0, charge.amount - (charge.paidAmount ?? 0)),
          })),
        },
        latestAnnouncements: announcements.map((announcement) => ({
          ...announcement,
          _id: String(announcement._id),
          isRead: readAnnouncementIds.has(String(announcement._id)),
        })),
        latestNotifications: notifications,
        myIncidents: {
          items: incidents.map((incident) => ({
            ...incident,
            _id: String(incident._id),
            latestUpdate: incident.updatedAt ?? incident.createdAt ?? incident.reportedAt,
          })),
          total: totalIncidents,
          open: openIncidents,
        },
      });
    }

    // -------------------------------------------------------------
    // 3. TECHNICIAN
    // -------------------------------------------------------------
    if (user.role === Role.TECHNICIAN) {
      const assignedFilter = { assignedTo: new mongoose.Types.ObjectId(user.id) };
      const technicianResidenceIds = await getTechnicianResidenceIds(user.id);
      await publishDueAnnouncements(technicianResidenceIds);
      const announcementFilter = {
        residence: { $in: technicianResidenceIds },
        ...publishedAnnouncementFilter(),
        audience: { $in: [AnnouncementAudience.TECHNICIANS, AnnouncementAudience.ALL] },
      };
      const [incidentCounts, pendingInterventions, resolvedInterventions, latestAnnouncements, notifications, unreadNotificationCount] = await Promise.all([
        Incident.aggregate<{ _id: string; count: number }>([
          { $match: assignedFilter },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Incident.aggregate([
          { $match: { ...assignedFilter, status: { $ne: IncidentStatus.RESOLVED } } },
          {
            $addFields: {
              priorityOrder: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$priority", "URGENT"] }, then: 4 },
                    { case: { $eq: ["$priority", "HIGH"] }, then: 3 },
                    { case: { $eq: ["$priority", "MEDIUM"] }, then: 2 },
                    { case: { $eq: ["$priority", "LOW"] }, then: 1 },
                  ],
                  default: 0,
                },
              },
            },
          },
          { $sort: { priorityOrder: -1, createdAt: 1 } },
          { $limit: 8 },
          { $lookup: { from: Residence.collection.name, localField: "residence", foreignField: "_id", as: "residenceDoc" } },
          { $unwind: { path: "$residenceDoc", preserveNullAndEmptyArrays: true } },
          { $lookup: { from: Apartment.collection.name, localField: "apartment", foreignField: "_id", as: "apartmentDoc" } },
          { $unwind: { path: "$apartmentDoc", preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
                residence: {
                  $cond: [
                    { $ifNull: ["$residenceDoc._id", false] },
                    { name: "$residenceDoc.name", city: "$residenceDoc.city" },
                    null,
                  ],
                },
                apartment: {
                  $cond: [
                    { $ifNull: ["$apartmentDoc._id", false] },
                    { number: "$apartmentDoc.number", floor: "$apartmentDoc.floor" },
                    null,
                  ],
                },
              },
          },
          { $project: { priorityOrder: 0, residenceDoc: 0, apartmentDoc: 0 } },
        ]),
        Incident.find({ ...assignedFilter, status: IncidentStatus.RESOLVED })
          .sort({ resolvedAt: -1, updatedAt: -1 })
          .limit(5)
          .select("title category priority status resolvedAt resolutionDescription")
          .populate({ path: "residence", select: "name city" })
          .lean(),
        Announcement.find(announcementFilter)
          .sort({ isPinned: -1, publishedAt: -1 })
          .limit(5)
          .select("title category priority isPinned publishedAt residence")
          .populate({ path: "residence", select: "name city" })
          .lean(),
        Notification.find({ recipient: user.id })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("title message type isRead createdAt relatedResource")
          .lean(),
        Notification.countDocuments({ recipient: user.id, isRead: false }),
      ]);
      const countByStatus = new Map(incidentCounts.map((item) => [item._id, item.count]));
      const assignedCount = countByStatus.get(IncidentStatus.ASSIGNED) ?? 0;
      const inProgressCount = countByStatus.get(IncidentStatus.IN_PROGRESS) ?? 0;
      const resolvedCount = countByStatus.get(IncidentStatus.RESOLVED) ?? 0;
      const totalCount = [...countByStatus.values()].reduce((sum, count) => sum + count, 0);
      const urgentCount = await Incident.countDocuments({
        ...assignedFilter,
        status: { $ne: IncidentStatus.RESOLVED },
        priority: "URGENT",
      });
      const average = await Incident.aggregate<{ averageHours: number }>([
        { $match: { ...assignedFilter, status: IncidentStatus.RESOLVED, resolvedAt: { $ne: null } } },
        { $group: { _id: null, averageHours: { $avg: { $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 3_600_000] } } } },
      ]);

      return json({
        role: user.role,
        overview: {
          total: totalCount,
          assigned: assignedCount,
          inProgress: inProgressCount,
          resolved: resolvedCount,
          urgent: urgentCount,
          averageResolutionHours: Math.round((average[0]?.averageHours ?? 0) * 10) / 10,
          awaitingReview: await Incident.countDocuments({
            ...assignedFilter,
            resolutionSubmittedAt: { $exists: true },
            resolutionConfirmedAt: { $exists: false },
            resolutionRejectedAt: { $exists: false },
          }),
          unreadNotifications: unreadNotificationCount,
        },
        myInterventions: {
          pending: pendingInterventions,
          recentResolved: resolvedInterventions,
          counts: {
            assigned: assignedCount,
            inProgress: inProgressCount,
            resolved: resolvedCount,
            urgent: urgentCount,
            total: totalCount,
          },
        },
        latestAnnouncements,
        latestNotifications: notifications,
      });
    }

    return json({ role: user.role, message: "Aucune donnée spécifique pour ce rôle" });
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT, Role.TECHNICIAN] }
);
