import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import {
  ReminderChannel,
  ReminderStatus,
  ReminderType,
  values,
} from "@/types/enums";

export interface IReminder {
  user: Types.ObjectId;
  type: ReminderType;
  channel: ReminderChannel;
  title: string;
  body: string;
  /** Identifiant métier pour dédupliquer (ex: charge:id:2026-03-01) */
  dedupeKey: string;
  status: ReminderStatus;
  scheduledFor: Date;
  sentAt?: Date;
  readAt?: Date;
  error?: string;
  meta?: Record<string, unknown>;
}

export type ReminderModel = Model<IReminder>;

const ReminderSchema = new Schema<IReminder, ReminderModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: values(ReminderType), required: true },
    channel: { type: String, enum: values(ReminderChannel), required: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    dedupeKey: { type: String, required: true },
    status: {
      type: String,
      enum: values(ReminderStatus),
      default: ReminderStatus.PENDING,
    },
    scheduledFor: { type: Date, required: true, default: () => new Date() },
    sentAt: { type: Date },
    readAt: { type: Date },
    error: { type: String },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

ReminderSchema.index({ user: 1, createdAt: -1 });
ReminderSchema.index({ status: 1, scheduledFor: 1 });
ReminderSchema.index({ dedupeKey: 1, channel: 1 }, { unique: true });

// Évite un schéma Mongoose obsolète en mémoire lors du Fast Refresh Next.js
if (process.env.NODE_ENV !== "production" && mongoose.models.Reminder) {
  mongoose.deleteModel("Reminder");
}

export const Reminder =
  (mongoose.models.Reminder as ReminderModel) ||
  model<IReminder, ReminderModel>("Reminder", ReminderSchema);
