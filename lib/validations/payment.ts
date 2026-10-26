import { z } from "zod";
import { PaymentMethod } from "@/types/enums";
import { clientId, date, objectId } from "./common";

export const paymentCreateSchema = z.object({
  charge: objectId,
  receivedBy: objectId.optional(),
  amount: z.number().positive(),
  paymentDate: date.optional(),
  method: z.enum(PaymentMethod),
  /** Optionnel : généré par le serveur s'il est absent */
  receiptNumber: z.string().trim().min(3).optional(),
  /** Clé d'idempotence : présente quand le paiement vient de la file offline */
  clientId: clientId.optional(),
});

export const paymentUpdateSchema = paymentCreateSchema
  .pick({ amount: true, paymentDate: true, method: true })
  .partial();

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>;
