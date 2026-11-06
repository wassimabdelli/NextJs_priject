import type { NextRequest } from "next/server";
import { json } from "@/lib/api";
import { withAuth, getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { Payment } from "@/models/Payment";
import { Charge } from "@/models/Charge";
import { Apartment } from "@/models/Apartment";
import { PaymentValidationStatus, Role } from "@/types/enums";

/** GET /api/payments/pending — preuves Flip/D17/virement à valider. */
export const GET = withAuth(
  async (_req: NextRequest, user: AuthUser) => {
    const filter: Record<string, unknown> = {
      validationStatus: PaymentValidationStatus.PENDING_VALIDATION,
    };

    if (user.role === Role.SYNDIC) {
      const resIds = await getSyndicResidenceIds(user.id);
      const aptIds = await Apartment.find({ residence: { $in: resIds } }).distinct("_id");
      const chargeIds = await Charge.find({ apartment: { $in: aptIds } }).distinct("_id");
      filter.charge = { $in: chargeIds };
    }

    const data = await Payment.find(filter)
      .populate({
        path: "charge",
        select: "period amount paidAmount status apartment",
        populate: {
          path: "apartment",
          select: "number residence",
          populate: { path: "residence", select: "name" },
        },
      })
      .populate({ path: "submittedBy", select: "name email phone" })
      .sort({ createdAt: -1 })
      .lean();

    return json({ data, meta: { page: 1, limit: data.length, total: data.length } });
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
