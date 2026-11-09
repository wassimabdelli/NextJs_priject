import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { StockUnit, values } from "@/types/enums";

export interface IStockItem {
  residence: Types.ObjectId;
  name: string;
  unit: StockUnit;
  quantity: number;
  minThreshold: number;
  minQuantity?: number;
  alertThreshold?: number;
  location?: string;
  notes?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type StockItemModel = Model<IStockItem>;

const StockItemSchema = new Schema<IStockItem, StockItemModel>(
  {
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    name: { type: String, required: true, trim: true },
    unit: {
      type: String,
      enum: values(StockUnit),
      default: StockUnit.PIECE,
    },
    quantity: { type: Number, min: 0, default: 0 },
    minThreshold: { type: Number, min: 0, default: 0 },
    minQuantity: { type: Number, min: 0 },
    alertThreshold: { type: Number, min: 0 },
    location: { type: String, trim: true },
    notes: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

StockItemSchema.index({ residence: 1, name: 1 }, { unique: true });
StockItemSchema.index({ residence: 1, isActive: 1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.StockItem) {
  delete mongoose.models.StockItem;
}

export const StockItem =
  (mongoose.models.StockItem as StockItemModel) ||
  model<IStockItem, StockItemModel>("StockItem", StockItemSchema);
