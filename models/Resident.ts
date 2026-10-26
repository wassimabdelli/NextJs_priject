import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { ResidentType, values } from "@/types/enums";

export interface IResident {
  apartment: Types.ObjectId;
  user?: Types.ObjectId;
  fullName: string;
  phone?: string;
  email?: string;
  type: ResidentType;
  moveInDate: Date;
  moveOutDate?: Date;
  isActive: boolean;
}

export type ResidentModel = Model<IResident>;

const ResidentSchema = new Schema<IResident, ResidentModel>(
  {
    apartment: { type: Schema.Types.ObjectId, ref: "Apartment", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    type: { type: String, enum: values(ResidentType), required: true },
    moveInDate: { type: Date, required: true },
    moveOutDate: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ResidentSchema.index({ apartment: 1, isActive: 1 });

export const Resident =
  (mongoose.models.Resident as ResidentModel) ||
  model<IResident, ResidentModel>("Resident", ResidentSchema);
