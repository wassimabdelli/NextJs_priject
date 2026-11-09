import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { MaintenanceStatus, MaintenanceType, values } from "@/types/enums";

export interface IMaintenanceChecklistItem {
  label: string;
  done: boolean;
}

export interface IMaintenanceTask {
  residence: Types.ObjectId;
  equipment: Types.ObjectId;
  type: MaintenanceType;
  title: string;
  description?: string;
  scheduledDate: Date;
  status: MaintenanceStatus;
  assignedTo?: Types.ObjectId;
  incident?: Types.ObjectId;
  cost: number;
  completedAt?: Date;
  notes?: string;
  checklist: IMaintenanceChecklistItem[];
  expense?: Types.ObjectId;
  createdOffline: boolean;
  clientId?: string;
  syncedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type MaintenanceTaskModel = Model<IMaintenanceTask>;

const ChecklistItemSchema = new Schema<IMaintenanceChecklistItem>(
  {
    label: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const MaintenanceTaskSchema = new Schema<IMaintenanceTask, MaintenanceTaskModel>(
  {
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    equipment: { type: Schema.Types.ObjectId, ref: "Equipment", required: true },
    type: { type: String, enum: values(MaintenanceType), required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    scheduledDate: { type: Date, required: true },
    status: {
      type: String,
      enum: values(MaintenanceStatus),
      default: MaintenanceStatus.PLANNED,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    incident: { type: Schema.Types.ObjectId, ref: "Incident" },
    cost: { type: Number, min: 0, default: 0 },
    completedAt: { type: Date },
    notes: { type: String },
    checklist: { type: [ChecklistItemSchema], default: [] },
    expense: { type: Schema.Types.ObjectId, ref: "Expense" },
    createdOffline: { type: Boolean, default: false },
    clientId: { type: String, unique: true, sparse: true },
    syncedAt: { type: Date },
  },
  { timestamps: true }
);

MaintenanceTaskSchema.index({ residence: 1, status: 1, scheduledDate: 1 });
MaintenanceTaskSchema.index({ equipment: 1, scheduledDate: -1 });
MaintenanceTaskSchema.index({ assignedTo: 1, status: 1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.MaintenanceTask) {
  delete mongoose.models.MaintenanceTask;
}

export const MaintenanceTask =
  (mongoose.models.MaintenanceTask as MaintenanceTaskModel) ||
  model<IMaintenanceTask, MaintenanceTaskModel>("MaintenanceTask", MaintenanceTaskSchema);
