import { z } from "zod";
import { date, money, objectId, period } from "./common";

/** paidAmount et status ne sont pas saisis : ils sont dérivés des paiements. */
export const chargeCreateSchema = z.object({
  apartment: objectId,
  period,
  amount: money,
  dueDate: date,
});

export const chargeUpdateSchema = chargeCreateSchema.omit({ apartment: true, period: true }).partial();

export type ChargeCreateInput = z.infer<typeof chargeCreateSchema>;
export type ChargeUpdateInput = z.infer<typeof chargeUpdateSchema>;
