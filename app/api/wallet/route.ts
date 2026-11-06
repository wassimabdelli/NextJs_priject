import type { NextRequest } from "next/server";
import { json } from "@/lib/api";
import { withAuth, getResidentApartmentIds, type AuthUser } from "@/lib/auth-guard";
import { Charge } from "@/models/Charge";
import { Payment } from "@/models/Payment";
import { ChargeStatus, PaymentValidationStatus, Role } from "@/types/enums";

/**
 * GET /api/wallet — solde résident : ce que je dois + preuves en attente.
 */
export const GET = withAuth(
  async (_req: NextRequest, user: AuthUser) => {
    const aptIds = await getResidentApartmentIds(user.id);
    if (aptIds.length === 0) {
      return json({
        data: {
          totalDue: 0,
          totalPendingProof: 0,
          charges: [],
          pendingPayments: [],
        },
      });
    }

    const charges = await Charge.find({
      apartment: { $in: aptIds },
      status: {
        $in: [ChargeStatus.PENDING, ChargeStatus.PARTIAL, ChargeStatus.OVERDUE],
      },
    })
      .populate({
        path: "apartment",
        select: "number floor residence",
        populate: { path: "residence", select: "name city" },
      })
      .sort({ dueDate: 1 })
      .lean();

    const chargeIds = charges.map((c) => c._id);
    const pendingPayments = await Payment.find({
      charge: { $in: chargeIds },
      validationStatus: PaymentValidationStatus.PENDING_VALIDATION,
      submittedBy: user.id,
    })
      .sort({ createdAt: -1 })
      .lean();

    const pendingByCharge = new Map<string, number>();
    for (const p of pendingPayments) {
      const key = String(p.charge);
      pendingByCharge.set(key, (pendingByCharge.get(key) || 0) + p.amount);
    }

    const enriched = charges.map((c) => {
      const remaining = Math.round((c.amount - (c.paidAmount || 0)) * 100) / 100;
      const pendingProof = pendingByCharge.get(String(c._id)) || 0;
      return {
        ...c,
        remaining,
        pendingProof,
        payableNow: Math.round((remaining - pendingProof) * 100) / 100,
      };
    });

    const totalDue = enriched.reduce((s, c) => s + c.remaining, 0);
    const totalPendingProof = pendingPayments.reduce((s, p) => s + p.amount, 0);

    return json({
      data: {
        totalDue: Math.round(totalDue * 100) / 100,
        totalPendingProof: Math.round(totalPendingProof * 100) / 100,
        charges: enriched,
        pendingPayments,
      },
    });
  },
  { roles: [Role.OWNER, Role.TENANT, Role.ADMIN, Role.SYNDIC] }
);
