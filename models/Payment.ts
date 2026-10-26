import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { PaymentMethod, values } from "@/types/enums";
import { Charge } from "./Charge";

export interface IPayment {
  charge: Types.ObjectId;
  receivedBy?: Types.ObjectId;
  amount: number;
  paymentDate: Date;
  method: PaymentMethod;
  receiptNumber: string;
  /**
   * Identifiant généré côté client (uuid) : permet de rejouer une requête
   * depuis la file offline sans créer de doublon (idempotence).
   */
  clientId?: string;
  /** Date de réception par le serveur (utile pour tracer les synchros offline). */
  syncedAt?: Date;
}

export type PaymentModel = Model<IPayment>;

const PaymentSchema = new Schema<IPayment, PaymentModel>(
  {
    charge: { type: Schema.Types.ObjectId, ref: "Charge", required: true },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    amount: { type: Number, required: true, min: 0.01 },
    paymentDate: { type: Date, default: () => new Date() },
    method: { type: String, enum: values(PaymentMethod), required: true },
    receiptNumber: { type: String, required: true, unique: true },
    // sparse : l'unicité ne s'applique qu'aux documents qui ont un clientId
    clientId: { type: String, unique: true, sparse: true },
    syncedAt: { type: Date },
  },
  { timestamps: true }
);

PaymentSchema.index({ charge: 1 });

/** Génère un numéro de reçu lisible si absent : REC-AAAAMMJJ-XXXXXX */
PaymentSchema.pre("validate", function () {
  if (!this.receiptNumber) {
    const d = new Date();
    const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    this.receiptNumber = `REC-${ymd}-${rand}`;
  }
});

/**
 * Hook post-save : met à jour la charge liée.
 * On RECALCULE paidAmount comme la somme de tous les paiements de la charge
 * (au lieu d'incrémenter) : le résultat reste juste même si le hook est rejoué.
 */
PaymentSchema.post("save", async function (doc) {
  const [agg] = await Payment.aggregate<{ total: number }>([
    { $match: { charge: doc.charge } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const charge = await Charge.findById(doc.charge);
  if (!charge) return;
  charge.paidAmount = Math.round((agg?.total ?? 0) * 100) / 100;
  charge.updateStatus();
  await charge.save();
});

export const Payment =
  (mongoose.models.Payment as PaymentModel) ||
  model<IPayment, PaymentModel>("Payment", PaymentSchema);
