import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { ShiftStatus, values } from "@/types/enums";

export interface IShift {
  residence: Types.ObjectId;
  employee: Types.ObjectId;
  startAt: Date;
  endAt: Date;
  mission?: string;
  status: ShiftStatus;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ShiftModel = Model<IShift>;

const ShiftSchema = new Schema<IShift, ShiftModel>(
  {
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    startAt: { type: Date, required: true },
    endAt: {
      type: Date,
      required: true,
      validate: {
        validator: function (this: unknown, value: Date): boolean {
          const doc = this as { startAt?: Date } | null;
          // Sur une requête de mise à jour, "this" n'est pas un document : on laisse passer
          // (la validation Zod de l'API contrôle ce cas).
          if (!doc || !doc.startAt || !(value instanceof Date)) return true;
          return value.getTime() > new Date(doc.startAt).getTime();
        },
        message: "L'heure de fin doit suivre l'heure de début",
      },
    },
    mission: { type: String, trim: true },
    status: {
      type: String,
      enum: values(ShiftStatus),
      default: ShiftStatus.PLANNED,
    },
    notes: { type: String },
  },
  { timestamps: true }
);

ShiftSchema.index({ employee: 1, startAt: 1 });
ShiftSchema.index({ residence: 1, startAt: -1 });

export const Shift =
  (mongoose.models.Shift as ShiftModel) ||
  model<IShift, ShiftModel>("Shift", ShiftSchema);
