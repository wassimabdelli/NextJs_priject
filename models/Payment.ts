import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import {
  PaymentMethod,
  PaymentValidationStatus,
  values,
} from "@/types/enums";
import { Charge } from "./Charge";

export interface IPayment {
  charge: Types.ObjectId;
  receivedBy?: Types.ObjectId;
  /** Résident ayant déclaré le paiement (portefeuille) */
  submittedBy?: Types.ObjectId;
  amount: number;
  paymentDate: Date;
  method: PaymentMethod;
  receiptNumber: string;
  /** Preuve (Flip / D17 / virement) */
  proofUrl?: string;
  validationStatus: PaymentValidationStatus;
  validatedBy?: Types.ObjectId;
  validatedAt?: Date;
  rejectionReason?: string;
  clientId?: string;
  syncedAt?: Date;
}

export type PaymentModel = Model<IPayment>;

const PaymentSchema = new Schema<IPayment, PaymentModel>(
  {
    charge: { type: Schema.Types.ObjectId, ref: "Charge", required: true },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    amount: { type: Number, required: true, min: 0.01 },
    paymentDate: { type: Date, default: () => new Date() },
    method: { type: String, enum: values(PaymentMethod), required: true },
    receiptNumber: { type: String, required: true, unique: true },
    proofUrl: { type: String },
    validationStatus: {
      type: String,
      enum: values(PaymentValidationStatus),
      default: PaymentValidationStatus.VALIDATED,
    },
    validatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    validatedAt: { type: Date },
    rejectionReason: { type: String },
    clientId: { type: String, unique: true, sparse: true },
    syncedAt: { type: Date },
  },
  { timestamps: true }
);

PaymentSchema.index({ charge: 1 });
PaymentSchema.index({ validationStatus: 1, createdAt: -1 });

PaymentSchema.pre("validate", function () {
  if (!this.receiptNumber) {
    const d = new Date();
    const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    this.receiptNumber = `REC-${ymd}-${rand}`;
  }
});

/** Seuls les paiements VALIDATED comptent dans paidAmount. */
PaymentSchema.post("save", async function (doc) {
  const [agg] = await Payment.aggregate<{ total: number }>([
    {
      $match: {
        charge: doc.charge,
        // Rétrocompat : anciens paiements sans champ = validés
        validationStatus: {
          $nin: [
            PaymentValidationStatus.PENDING_VALIDATION,
            PaymentValidationStatus.REJECTED,
          ],
        },
      },
    },
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
