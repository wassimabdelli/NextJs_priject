import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { LeaveStatus, LeaveType, values } from "@/types/enums";

export interface ILeaveRequest {
  residence: Types.ObjectId;
  employee: Types.ObjectId;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  reason?: string;
  status: LeaveStatus;
  decidedBy?: Types.ObjectId;
  decidedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type LeaveRequestModel = Model<ILeaveRequest>;

const LeaveRequestSchema = new Schema<ILeaveRequest, LeaveRequestModel>(
  {
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    type: { type: String, enum: values(LeaveType), required: true },
    startDate: { type: Date, required: true },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (this: unknown, value: Date): boolean {
          const doc = this as { startDate?: Date } | null;
          if (!doc || !doc.startDate || !(value instanceof Date)) return true;
          return value.getTime() >= new Date(doc.startDate).getTime();
        },
        message: "La fin du congé précède son début",
      },
    },
    reason: { type: String },
    status: {
      type: String,
      enum: values(LeaveStatus),
      default: LeaveStatus.PENDING,
    },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decidedAt: { type: Date },
  },
  { timestamps: true }
);

LeaveRequestSchema.index({ employee: 1, startDate: 1 });
LeaveRequestSchema.index({ residence: 1, status: 1 });

export const LeaveRequest =
  (mongoose.models.LeaveRequest as LeaveRequestModel) ||
  model<ILeaveRequest, LeaveRequestModel>("LeaveRequest", LeaveRequestSchema);

export const Leave = LeaveRequest;
