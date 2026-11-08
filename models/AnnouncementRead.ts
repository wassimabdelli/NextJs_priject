import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import "./Announcement";
import "./User";

export interface IAnnouncementRead {
  announcement: Types.ObjectId;
  resident: Types.ObjectId;
  readAt: Date;
}

const AnnouncementReadSchema = new Schema<IAnnouncementRead>(
  {
    announcement: {
      type: Schema.Types.ObjectId,
      ref: "Announcement",
      required: true,
      index: true,
    },
    resident: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    readAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

AnnouncementReadSchema.index({ announcement: 1, resident: 1 }, { unique: true });

const AnnouncementRead =
  (mongoose.models.AnnouncementRead as Model<IAnnouncementRead>) ||
  model<IAnnouncementRead>("AnnouncementRead", AnnouncementReadSchema);

export default AnnouncementRead;
