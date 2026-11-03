import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { EquipmentCategory, EquipmentStatus, values } from "@/types/enums";

export interface IEquipment {
  residence: Types.ObjectId;
  name: string;
  category: EquipmentCategory;
  location?: string;
  serialNumber?: string;
  purchaseDate?: Date;
  warrantyEndDate?: Date;
  status: EquipmentStatus;
  maintenanceIntervalDays: number;
  lastMaintenanceDate?: Date;
  nextMaintenanceDate?: Date;
  provider?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type EquipmentModel = Model<IEquipment>;

const EquipmentSchema = new Schema<IEquipment, EquipmentModel>(
  {
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: values(EquipmentCategory), required: true },
    location: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    purchaseDate: { type: Date },
    warrantyEndDate: { type: Date },
    status: {
      type: String,
      enum: values(EquipmentStatus),
      default: EquipmentStatus.OPERATIONAL,
    },
    maintenanceIntervalDays: { type: Number, min: 0, default: 0 },
    lastMaintenanceDate: { type: Date },
    nextMaintenanceDate: { type: Date },
    provider: { type: String, trim: true },
    notes: { type: String },
  },
  { timestamps: true }
);

EquipmentSchema.index({ residence: 1, status: 1 });
EquipmentSchema.index({ residence: 1, nextMaintenanceDate: 1 });

export const Equipment =
  (mongoose.models.Equipment as EquipmentModel) ||
  model<IEquipment, EquipmentModel>("Equipment", EquipmentSchema);
