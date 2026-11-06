import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, json, parseBody } from "@/lib/api";
import { withAuth, getResidentApartmentIds, type AuthUser } from "@/lib/auth-guard";
import { Charge } from "@/models/Charge";
import { Payment } from "@/models/Payment";
import { Apartment } from "@/models/Apartment";
import { Residence } from "@/models/Residence";
import { notifyUser } from "@/lib/notifications/notify";
import {
  PaymentMethod,
  PaymentValidationStatus,
  ReminderType,
  Role,
} from "@/types/enums";
import { objectId, date, clientId } from "@/lib/validations/common";

const WALLET_METHODS = [
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.FLIP,
  PaymentMethod.D17,
  PaymentMethod.CHEQUE,
  PaymentMethod.CARD,
] as const;

const walletPaymentSchema = z.object({
  charge: objectId,
  amount: z.number().positive(),
  method: z.enum(WALLET_METHODS),
  paymentDate: date.optional(),
  proofUrl: z.string().trim().min(5, "Preuve de paiement obligatoire"),
  clientId: clientId.optional(),
});

/**
 * POST /api/wallet/payments — déclaration résident avec preuve (Flip/D17/virement).
 * Ne crédite la charge qu'après validation syndic.
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthUser) => {
    const data = await parseBody(req, walletPaymentSchema);

    if (data.clientId) {
      const existing = await Payment.findOne({ clientId: data.clientId });
      if (existing) return json(existing.toObject(), 200);
    }

    const charge = await Charge.findById(data.charge);
    if (!charge) throw new HttpError(404, "Charge introuvable");

    const allowedApts = await getResidentApartmentIds(user.id);
    if (!allowedApts.includes(String(charge.apartment))) {
      throw new HttpError(403, "Cette charge ne concerne pas votre lot");
    }

    const pending = await Payment.aggregate<{ total: number }>([
      {
        $match: {
          charge: charge._id,
          validationStatus: PaymentValidationStatus.PENDING_VALIDATION,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const pendingTotal = pending[0]?.total ?? 0;
    const remaining =
      Math.round((charge.amount - (charge.paidAmount || 0) - pendingTotal) * 100) / 100;
    if (data.amount > remaining + 0.001) {
      throw new HttpError(
        400,
        `Montant trop élevé (reste payable : ${remaining.toFixed(2)} TND)`
      );
    }

    const d = new Date();
    const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();

    const payment = await Payment.create({
      charge: charge._id,
      submittedBy: user.id,
      amount: data.amount,
      method: data.method,
      paymentDate: data.paymentDate || new Date(),
      proofUrl: data.proofUrl,
      validationStatus: PaymentValidationStatus.PENDING_VALIDATION,
      receiptNumber: `PRV-${ymd}-${rand}`,
      clientId: data.clientId,
      syncedAt: new Date(),
    });

    // Notifie le syndic de la résidence
    const apt = await Apartment.findById(charge.apartment).select("residence number").lean();
    if (apt?.residence) {
      const residence = await Residence.findById(apt.residence).select("syndic name").lean();
      if (residence?.syndic) {
        await notifyUser({
          userId: String(residence.syndic),
          type: ReminderType.PAYMENT_VALIDATION,
          title: "Preuve de paiement à valider",
          body: `Lot ${apt.number} · ${data.amount.toFixed(2)} TND via ${data.method}`,
          dedupeKey: `pay-proof:${payment._id}`,
          meta: { paymentId: String(payment._id) },
        });
      }
    }

    return json(payment.toObject(), 201);
  },
  { roles: [Role.OWNER, Role.TENANT] }
);
