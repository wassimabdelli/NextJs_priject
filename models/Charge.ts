import mongoose, { Schema, model, type Model, type Types, type HydratedDocument } from "mongoose";
import { ChargeStatus, values } from "@/types/enums";
import "./Apartment";

export interface ICharge {
  apartment: Types.ObjectId;
  /** Période au format "YYYY-MM" */
  period: string;
  amount: number;
  paidAmount: number;
  dueDate: Date;
  status: ChargeStatus;
}

export interface IChargeMethods {
  getRemainingAmount(): number;
  isOverdue(now?: Date): boolean;
  /** Recalcule le statut à partir de paidAmount / amount / dueDate (sans sauvegarder). */
  updateStatus(now?: Date): ChargeStatus;
}

export type ChargeModel = Model<ICharge, {}, IChargeMethods>;
export type ChargeDocument = HydratedDocument<ICharge, IChargeMethods>;

/**
 * Règle de statut, extraite en fonction pure pour pouvoir être réutilisée
 * (méthode d'instance, seed, UI).
 */
export function computeChargeStatus(
  c: Pick<ICharge, "amount" | "paidAmount" | "dueDate">,
  now: Date = new Date()
): ChargeStatus {
  if (c.paidAmount >= c.amount) return ChargeStatus.PAID;
  if (c.paidAmount > 0) return ChargeStatus.PARTIAL;
  if (new Date(c.dueDate).getTime() < now.getTime()) return ChargeStatus.OVERDUE;
  return ChargeStatus.PENDING;
}

const ChargeSchema = new Schema<ICharge, ChargeModel, IChargeMethods>(
  {
    apartment: { type: Schema.Types.ObjectId, ref: "Apartment", required: true },
    period: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    amount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: values(ChargeStatus), default: ChargeStatus.PENDING },
  },
  { timestamps: true }
);

// Une seule charge par lot et par mois
ChargeSchema.index({ apartment: 1, period: 1 }, { unique: true });
ChargeSchema.index({ status: 1 });

ChargeSchema.method("getRemainingAmount", function () {
  return Math.max(0, this.amount - this.paidAmount);
});

ChargeSchema.method("isOverdue", function (now: Date = new Date()) {
  return this.dueDate.getTime() < now.getTime() && this.paidAmount < this.amount;
});

ChargeSchema.method("updateStatus", function (now: Date = new Date()) {
  this.status = computeChargeStatus(this, now);
  return this.status;
});

// Le statut est toujours recalculé avant sauvegarde : il ne peut pas diverger des montants
ChargeSchema.pre("save", function () {
  this.status = computeChargeStatus(this);
});

export const Charge =
  (mongoose.models.Charge as ChargeModel) || model<ICharge, ChargeModel>("Charge", ChargeSchema);
