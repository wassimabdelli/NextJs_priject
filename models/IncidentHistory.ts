import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import "./User";
import "./Incident";

export type IncidentHistoryAction =
  | "CREATED"
  | "ASSIGNED"
  | "STATUS_CHANGED"
  | "COMMENT_ADDED"
  | "RESOLUTION_SUBMITTED"
  | "RESOLUTION_CONFIRMED"
  | "RESOLUTION_REJECTED"
  | "UPDATED";

export interface IIncidentHistory {
  incident: Types.ObjectId;
  actor: Types.ObjectId;
  action: IncidentHistoryAction;
  description: string;
  oldValue?: string;
  newValue?: string;
  createdAt: Date;
}

const IncidentHistorySchema = new Schema<IIncidentHistory>(
  {
    incident: {
      type: Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
      index: true,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: [
        "CREATED",
        "ASSIGNED",
        "STATUS_CHANGED",
        "COMMENT_ADDED",
        "RESOLUTION_SUBMITTED",
        "RESOLUTION_CONFIRMED",
        "RESOLUTION_REJECTED",
        "UPDATED",
      ],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    oldValue: String,
    newValue: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

IncidentHistorySchema.index({ incident: 1, createdAt: -1 });
IncidentHistorySchema.index({ createdAt: -1 });

export const IncidentHistory =
  (mongoose.models.IncidentHistory as Model<IIncidentHistory>) ||
  model<IIncidentHistory>("IncidentHistory", IncidentHistorySchema);
