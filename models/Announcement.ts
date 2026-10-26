import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import "./User";
import "./Residence";

export interface IAnnouncement {
  residence: Types.ObjectId;
  author?: Types.ObjectId;
  title: string;
  content: string;
  publishedAt: Date;
  isPinned: boolean;
}

export type AnnouncementModel = Model<IAnnouncement>;

const AnnouncementSchema = new Schema<IAnnouncement, AnnouncementModel>(
  {
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User" },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    publishedAt: { type: Date, default: () => new Date() },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AnnouncementSchema.index({ residence: 1, isPinned: -1, publishedAt: -1 });

export const Announcement =
  (mongoose.models.Announcement as AnnouncementModel) ||
  model<IAnnouncement, AnnouncementModel>("Announcement", AnnouncementSchema);
