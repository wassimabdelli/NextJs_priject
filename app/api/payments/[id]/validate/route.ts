import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import { withAuth, getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { Payment } from "@/models/Payment";
import { Charge } from "@/models/Charge";
import { Apartment } from "@/models/Apartment";
import { recalculateCharge } from "@/lib/crud/payments";
import { notifyUser } from "@/lib/notifications/notify";
import {
  PaymentValidationStatus,
  ReminderType,
  Role,
} from "@/types/enums";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

const validateSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().trim().min(3).max(500).optional(),
});

/**
 * PATCH /api/payments/[id]/validate
 * Valide ou rejette une preuve de paiement résident.
 */
export const PATCH = withAuth(
  async (req: NextRequest, user: AuthUser, context?: unknown) => {
    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant invalide");

    const data = await parseBody(req, validateSchema);
    const payment = await Payment.findById(id);
    if (!payment) throw new HttpError(404, "Paiement introuvable");

    if (payment.validationStatus !== PaymentValidationStatus.PENDING_VALIDATION) {
      throw new HttpError(409, "Ce paiement n'est plus en attente de validation");
    }

    const charge = await Charge.findById(payment.charge);
    if (!charge) throw new HttpError(404, "Charge introuvable");
    const apt = await Apartment.findById(charge.apartment).lean();

    if (user.role === Role.SYNDIC) {
      const resIds = await getSyndicResidenceIds(user.id);
      if (!apt || !resIds.includes(String(apt.residence))) {
        throw new HttpError(403, "Vous n'administrez pas cette résidence");
      }
    }

    if (data.action === "reject") {
      if (!data.rejectionReason) {
        throw new HttpError(400, "Motif de rejet obligatoire");
      }
      payment.validationStatus = PaymentValidationStatus.REJECTED;
      payment.rejectionReason = data.rejectionReason;
      payment.validatedBy = user.id as never;
      payment.validatedAt = new Date();
      await payment.save();
      await recalculateCharge(payment.charge);

      if (payment.submittedBy) {
        await notifyUser({
          userId: String(payment.submittedBy),
          type: ReminderType.PAYMENT_VALIDATION,
          title: "Preuve de paiement rejetée",
          body: data.rejectionReason,
          dedupeKey: `pay-reject:${payment._id}`,
        });
      }

      return json(payment.toObject(), 200);
    }

    const remaining =
      Math.round((charge.amount - (charge.paidAmount || 0)) * 100) / 100;
    if (payment.amount > remaining + 0.001) {
      throw new HttpError(
        400,
        `Impossible de valider : dépasse le reste (${remaining.toFixed(2)} TND)`
      );
    }

    payment.validationStatus = PaymentValidationStatus.VALIDATED;
    payment.validatedBy = user.id as never;
    payment.validatedAt = new Date();
    payment.receivedBy = user.id as never;
    payment.rejectionReason = undefined;
    await payment.save();
    await recalculateCharge(payment.charge);

    if (payment.submittedBy) {
      await notifyUser({
        userId: String(payment.submittedBy),
        type: ReminderType.PAYMENT_VALIDATION,
        title: "Paiement validé",
        body: `${payment.amount.toFixed(2)} TND crédité sur votre charge.`,
        dedupeKey: `pay-ok:${payment._id}`,
      });
    }

    await payment.populate([
      {
        path: "charge",
        select: "period amount paidAmount status apartment",
        populate: { path: "apartment", select: "number" },
      },
      { path: "submittedBy", select: "name email" },
      { path: "validatedBy", select: "name" },
    ]);

    return json(payment.toObject(), 200);
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
