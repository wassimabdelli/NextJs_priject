import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { connectDB } from "@/lib/db";
import {
  Charge,
  Expense,
  Payment,
  StockItem,
  Incident,
  Residence,
  Equipment,
  MaintenanceTask,
  Employee,
} from "@/models";
import { IncidentStatus, EquipmentStatus, MaintenanceStatus } from "@/types/enums";

interface ChatMessageInput {
  role: "user" | "assistant";
  content: string;
}

export const POST = withAuth(async (req: NextRequest, user) => {
  await connectDB();

  const body = await req.json().catch(() => ({}));
  const message: string =
    typeof body?.message === "string"
      ? body.message.trim()
      : typeof body?.question === "string"
      ? body.question.trim()
      : "";
  const history: ChatMessageInput[] = Array.isArray(body?.history)
    ? body.history
        .filter(
          (m: unknown): m is ChatMessageInput =>
            Boolean(m) &&
            typeof m === "object" &&
            typeof (m as ChatMessageInput).content === "string"
        )
        .slice(-6)
    : [];

  if (!message) {
    return NextResponse.json(
      { error: "Veuillez saisir une question." },
      { status: 400 }
    );
  }

  // 1. Requêtes d'agrégation légères en parallèle (Data-Augmented Generation / Context Stuffing)
  const [
    residencesList,
    chargeSummaryAgg,
    chargeByStatusAgg,
    expenseSummaryAgg,
    expenseByCategoryAgg,
    recentExpenses,
    paymentSummaryAgg,
    stockItems,
    incidentByStatusAgg,
    incidentByPriorityAgg,
    incidentByCategoryAgg,
    openIncidentsList,
    equipmentAlertList,
    maintenanceSummaryAgg,
    employeeSummaryAgg,
  ] = await Promise.all([
    Residence.find({}, { name: 1, city: 1, totalApartments: 1 }).lean(),
    Charge.aggregate<{
      totalChargesCount: number;
      totalCalledAmount: number;
      totalPaidAmount: number;
    }>([
      {
        $group: {
          _id: null,
          totalChargesCount: { $sum: 1 },
          totalCalledAmount: { $sum: "$amount" },
          totalPaidAmount: { $sum: "$paidAmount" },
        },
      },
    ]),
    Charge.aggregate<{ _id: string; count: number; amount: number; paidAmount: number }>([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
          paidAmount: { $sum: "$paidAmount" },
        },
      },
    ]),
    Expense.aggregate<{ totalExpensesCount: number; totalExpensesAmount: number }>([
      {
        $group: {
          _id: null,
          totalExpensesCount: { $sum: 1 },
          totalExpensesAmount: { $sum: "$amount" },
        },
      },
    ]),
    Expense.aggregate<{ _id: string; count: number; totalAmount: number }>([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]),
    Expense.find({}, { category: 1, description: 1, amount: 1, expenseDate: 1 })
      .sort({ expenseDate: -1 })
      .limit(5)
      .lean(),
    Payment.aggregate<{ totalPaymentsCount: number; totalPaymentsAmount: number }>([
      {
        $group: {
          _id: null,
          totalPaymentsCount: { $sum: 1 },
          totalPaymentsAmount: { $sum: "$amount" },
        },
      },
    ]),
    StockItem.find(
      { isActive: true },
      { name: 1, quantity: 1, minThreshold: 1, unit: 1, location: 1 }
    )
      .sort({ quantity: 1 })
      .lean(),
    Incident.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Incident.aggregate<{ _id: string; count: number }>([
      {
        $match: { status: { $ne: IncidentStatus.RESOLVED } },
      },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]),
    Incident.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
    Incident.find(
      { status: { $ne: IncidentStatus.RESOLVED } },
      { title: 1, category: 1, priority: 1, status: 1, reportedAt: 1 }
    )
      .sort({ reportedAt: -1 })
      .limit(8)
      .lean(),
    Equipment.find(
      {
        status: {
          $in: [EquipmentStatus.UNDER_MAINTENANCE, EquipmentStatus.OUT_OF_SERVICE],
        },
      },
      { name: 1, category: 1, status: 1, location: 1 }
    )
      .limit(10)
      .lean(),
    MaintenanceTask.aggregate<{ _id: string; count: number; totalCost: number }>([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalCost: { $sum: "$cost" },
        },
      },
    ]),
    Employee.aggregate<{ activeCount: number; totalMonthlySalary: number }>([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          activeCount: { $sum: 1 },
          totalMonthlySalary: { $sum: "$monthlySalary" },
        },
      },
    ]),
  ]);

  // 2. Construction du snapshot structuré
  const chargeTotals = chargeSummaryAgg[0] || {
    totalChargesCount: 0,
    totalCalledAmount: 0,
    totalPaidAmount: 0,
  };
  const remainingCharges =
    Math.round(
      Math.max(0, chargeTotals.totalCalledAmount - chargeTotals.totalPaidAmount) * 100
    ) / 100;
  const collectionRate =
    chargeTotals.totalCalledAmount > 0
      ? Math.round(
          (Math.min(chargeTotals.totalPaidAmount, chargeTotals.totalCalledAmount) /
            chargeTotals.totalCalledAmount) *
            1000
        ) / 10
      : 0;

  const expenseTotals = expenseSummaryAgg[0] || {
    totalExpensesCount: 0,
    totalExpensesAmount: 0,
  };
  const paymentTotals = paymentSummaryAgg[0] || {
    totalPaymentsCount: 0,
    totalPaymentsAmount: 0,
  };

  const outOfStockItems = stockItems.filter((item) => item.quantity <= 0);
  const lowStockItems = stockItems.filter(
    (item) => item.quantity > 0 && item.quantity <= item.minThreshold
  );

  const totalIncidents = incidentByStatusAgg.reduce((acc, item) => acc + item.count, 0);
  const resolvedIncidents =
    incidentByStatusAgg.find((item) => item._id === IncidentStatus.RESOLVED)?.count ?? 0;
  const openIncidentsCount = totalIncidents - resolvedIncidents;

  const snapshot = {
    generatedAt: new Date().toISOString(),
    connectedUser: {
      name: user.name || "Utilisateur",
      role: user.role,
    },
    residences: {
      total: residencesList.length,
      items: residencesList.map((r) => ({
        name: r.name,
        city: r.city,
        totalApartments: r.totalApartments,
      })),
    },
    chargesAndFinances: {
      totalChargesCount: chargeTotals.totalChargesCount,
      totalCalledAmount: Math.round(chargeTotals.totalCalledAmount * 100) / 100,
      totalPaidAmount: Math.round(chargeTotals.totalPaidAmount * 100) / 100,
      remainingUnpaidAmount: remainingCharges,
      collectionRatePercent: collectionRate,
      chargesByStatus: chargeByStatusAgg,
      totalPaymentsCount: paymentTotals.totalPaymentsCount,
      totalPaymentsAmount: Math.round(paymentTotals.totalPaymentsAmount * 100) / 100,
      totalExpensesCount: expenseTotals.totalExpensesCount,
      totalExpensesAmount: Math.round(expenseTotals.totalExpensesAmount * 100) / 100,
      netTreasuryBalance:
        Math.round(
          (paymentTotals.totalPaymentsAmount - expenseTotals.totalExpensesAmount) * 100
        ) / 100,
      expensesByCategory: expenseByCategoryAgg,
      recentExpenses: recentExpenses.map((e) => ({
        category: e.category,
        description: e.description,
        amount: e.amount,
        date: e.expenseDate,
      })),
    },
    stock: {
      totalActiveItems: stockItems.length,
      outOfStockCount: outOfStockItems.length,
      lowStockCount: lowStockItems.length,
      outOfStockItems: outOfStockItems.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        minThreshold: i.minThreshold,
        unit: i.unit,
        location: i.location,
      })),
      lowStockItems: lowStockItems.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        minThreshold: i.minThreshold,
        unit: i.unit,
        location: i.location,
      })),
      allItems: stockItems.slice(0, 25).map((i) => ({
        name: i.name,
        quantity: i.quantity,
        minThreshold: i.minThreshold,
        unit: i.unit,
      })),
    },
    incidents: {
      total: totalIncidents,
      openCount: openIncidentsCount,
      resolvedCount: resolvedIncidents,
      byStatus: incidentByStatusAgg,
      openByPriority: incidentByPriorityAgg,
      byCategory: incidentByCategoryAgg,
      recentOpenIncidents: openIncidentsList.map((inc) => ({
        title: inc.title,
        category: inc.category,
        priority: inc.priority,
        status: inc.status,
        reportedAt: inc.reportedAt,
      })),
    },
    equipmentAndMaintenance: {
      alertEquipmentsCount: equipmentAlertList.length,
      alertEquipments: equipmentAlertList.map((eq) => ({
        name: eq.name,
        category: eq.category,
        status: eq.status,
        location: eq.location,
      })),
      maintenanceTasksByStatus: maintenanceSummaryAgg,
      plannedOrInProgressMaintenanceCount: maintenanceSummaryAgg
        .filter(
          (m) =>
            m._id === MaintenanceStatus.PLANNED ||
            m._id === MaintenanceStatus.IN_PROGRESS
        )
        .reduce((acc, m) => acc + m.count, 0),
    },
    humanResources: {
      activeEmployeesCount: employeeSummaryAgg[0]?.activeCount ?? 0,
      totalMonthlySalary: employeeSummaryAgg[0]?.totalMonthlySalary ?? 0,
    },
  };

  // Réponse locale déterministe de secours si la clé Gemini est absente ou indisponible
  const buildFallbackReply = () => {
    return [
      `Voici la synthèse actuelle des données SyndicPro :`,
      `• **Charges & Finances** : ${snapshot.chargesAndFinances.totalCalledAmount} DT appelés, ${snapshot.chargesAndFinances.totalPaidAmount} DT encaissés (${snapshot.chargesAndFinances.collectionRatePercent}% de recouvrement, reste ${snapshot.chargesAndFinances.remainingUnpaidAmount} DT). Dépenses totales : ${snapshot.chargesAndFinances.totalExpensesAmount} DT (${snapshot.chargesAndFinances.totalExpensesCount} dépenses). Solde net : ${snapshot.chargesAndFinances.netTreasuryBalance} DT.`,
      `• **Stock** : ${snapshot.stock.totalActiveItems} articles actifs, dont **${snapshot.stock.outOfStockCount} en rupture** et **${snapshot.stock.lowStockCount} sous le seuil d'alerte**.`,
      `• **Réclamations (Incidents)** : ${snapshot.incidents.openCount} ticket(s) ouvert(s) sur ${snapshot.incidents.total} au total (${snapshot.incidents.resolvedCount} résolu(s)).`,
      `• **Maintenance & RH** : ${snapshot.equipmentAndMaintenance.alertEquipmentsCount} équipement(s) en alerte, ${snapshot.humanResources.activeEmployeesCount} employé(s) actif(s).`,
    ].join("\n");
  };

  // 3. Construction du System Prompt (Context Stuffing)
  const systemPrompt = `Tu es l'assistant IA métier de SyndicPro, spécialisé dans l'analyse des données de copropriété (stock, charges, dépenses, paiements, réclamations/incidents, équipements et personnel).
Réponds toujours en français, de manière claire, structurée et concise, en te basant EXCLUSIVEMENT sur le snapshot JSON temps réel ci-dessous.
Cite les chiffres exacts (montants, quantités, nombres de tickets, noms des articles ou incidents). Si une information ne figure pas dans le snapshot, indique-le honnêtement sans inventer de chiffres.

SNAPSHOT JSON TEMPS RÉEL DE LA BASE DE DONNÉES :
${JSON.stringify(snapshot, null, 2)}`;

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return NextResponse.json({
      reply: buildFallbackReply(),
      snapshot,
    });
  }

  const conversationText = history
    .map((m) => `${m.role === "user" ? "Utilisateur" : "Assistant"}: ${m.content}`)
    .join("\n");

  const fullUserPrompt = conversationText
    ? `${systemPrompt}\n\nHistorique récent :\n${conversationText}\n\nQuestion actuelle de l'utilisateur : ${message}`
    : `${systemPrompt}\n\nQuestion de l'utilisateur : ${message}`;

  // 4. Appel à l'API Gemini native via fetch (zéro SDK externe)
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: fullUserPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      console.error("[AI Chat Gemini Error]", await response.text());
      return NextResponse.json({
        reply: buildFallbackReply(),
        snapshot,
      });
    }

    const data = await response.json();
    const replyText: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      buildFallbackReply();

    return NextResponse.json({
      reply: replyText,
      snapshot,
    });
  } catch (err) {
    console.error("[AI Chat Error]", err);
    return NextResponse.json({
      reply: buildFallbackReply(),
      snapshot,
    });
  }
});
