import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { StockMovementType, values } from "@/types/enums";

export interface IStockMovement {
  residence: Types.ObjectId;
  item: Types.ObjectId;
  type: StockMovementType;
  quantity: number;
  reason?: string;
  reference?: string;
  performedBy?: Types.ObjectId;
  movementDate: Date;
  createdOffline: boolean;
  clientId?: string;
  syncedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type StockMovementModel = Model<IStockMovement>;

const StockMovementSchema = new Schema<IStockMovement, StockMovementModel>(
  {
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    item: { type: Schema.Types.ObjectId, ref: "StockItem", required: true },
    type: { type: String, enum: values(StockMovementType), required: true },
    quantity: {
      type: Number,
      required: true,
      validate: {
        validator(value: number): boolean {
          return value > 0;
        },
        message: "La quantité doit être positive",
      },
    },
    reason: { type: String, trim: true },
    reference: { type: String, trim: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "User" },
    movementDate: { type: Date, default: Date.now },
    createdOffline: { type: Boolean, default: false },
    clientId: { type: String, unique: true, sparse: true },
    syncedAt: { type: Date },
  },
  { timestamps: true }
);

StockMovementSchema.index({ item: 1, movementDate: -1 });
StockMovementSchema.index({ residence: 1, movementDate: -1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.StockMovement) {
  delete mongoose.models.StockMovement;
}

export const StockMovement =
  (mongoose.models.StockMovement as StockMovementModel) ||
  model<IStockMovement, StockMovementModel>("StockMovement", StockMovementSchema);
