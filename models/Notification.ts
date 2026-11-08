import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import "./User";
import "./Residence";

export const notificationTypes = [
  "INCIDENT_CREATED",
  "INCIDENT_ASSIGNED",
  "INCIDENT_STATUS_CHANGED",
  "INCIDENT_COMMENTED",
  "INCIDENT_RESOLUTION_SUBMITTED",
  "INCIDENT_RESOLUTION_CONFIRMED",
  "INCIDENT_RESOLUTION_REJECTED",
  "ANNOUNCEMENT_PUBLISHED",
  "ANNOUNCEMENT_EXPIRING",
  "SYSTEM",
] as const;

export type NotificationType = (typeof notificationTypes)[number];
export type NotificationResourceType = "INCIDENT" | "ANNOUNCEMENT" | "SYSTEM";

export interface INotification {
  recipient: Types.ObjectId;
  actor?: Types.ObjectId | null;
  type: NotificationType;
  title: string;
  message: string;
  relatedResource: {
    resourceType: NotificationResourceType;
    resourceId?: Types.ObjectId | null;
  };
  residence?: Types.ObjectId | null;
  isRead: boolean;
  readAt?: Date | null;
  metadata: Record<string, unknown>;
  eventKey: string;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    type: { type: String, enum: notificationTypes, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    relatedResource: {
      resourceType: { type: String, enum: ["INCIDENT", "ANNOUNCEMENT", "SYSTEM"], required: true },
      resourceId: { type: Schema.Types.ObjectId, default: null },
    },
    residence: { type: Schema.Types.ObjectId, ref: "Residence", default: null },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    eventKey: { type: String, required: true, maxlength: 200 },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });
NotificationSchema.index({ "relatedResource.resourceType": 1, "relatedResource.resourceId": 1 });
NotificationSchema.index({ recipient: 1, eventKey: 1 }, { unique: true });

export const Notification =
  (mongoose.models.Notification as Model<INotification>) ||
  model<INotification>("Notification", NotificationSchema);
