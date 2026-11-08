import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { AnnouncementAudience, values } from "@/types/enums";
import "./Announcement";
import "./User";
import "./Residence";

export type AnnouncementHistoryAction = "PUBLISHED" | "ARCHIVED";

export interface IAnnouncementHistory {
  announcement: Types.ObjectId;
  residence: Types.ObjectId;
  actor?: Types.ObjectId | null;
  action: AnnouncementHistoryAction;
  title: string;
  audience: AnnouncementAudience;
  priority: string;
  eventKey: string;
  createdAt: Date;
}

const AnnouncementHistorySchema = new Schema<IAnnouncementHistory>(
  {
    announcement: { type: Schema.Types.ObjectId, ref: "Announcement", required: true },
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, enum: ["PUBLISHED", "ARCHIVED"], required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    audience: { type: String, enum: values(AnnouncementAudience), required: true },
    priority: { type: String, enum: ["LOW", "NORMAL", "HIGH", "URGENT"], required: true },
    eventKey: { type: String, required: true, unique: true, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AnnouncementHistorySchema.index({ residence: 1, createdAt: -1 });
AnnouncementHistorySchema.index({ announcement: 1, createdAt: -1 });
AnnouncementHistorySchema.index({ createdAt: -1 });

export const AnnouncementHistory =
  (mongoose.models.AnnouncementHistory as Model<IAnnouncementHistory>) ||
  model<IAnnouncementHistory>("AnnouncementHistory", AnnouncementHistorySchema);
