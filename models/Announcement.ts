import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import {
  AnnouncementAudience,
  AnnouncementCategory,
  IncidentCategory,
  AnnouncementPriority,
  AnnouncementStatus,
  IntelligenceReviewStatus,
  values,
} from "@/types/enums";
import "./User";
import "./Residence";

export interface IAnnouncementAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface IAnnouncement {
  residence: Types.ObjectId;
  author?: Types.ObjectId;
  title: string;
  content: string;
  publishedAt: Date;
  isPinned: boolean;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  scheduledAt?: Date | null;
  expiresAt?: Date | null;
  attachments: IAnnouncementAttachment[];
  updatedAt?: Date;
  intelligenceSource?: {
    patternKey: string;
    category: IncidentCategory;
    incidentIds: Types.ObjectId[];
    generatedAt: Date;
    language?: "FR" | "AR" | "EN";
    reviewStatus: IntelligenceReviewStatus;
  };
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
    category: { type: String, enum: values(AnnouncementCategory), default: AnnouncementCategory.GENERAL },
    priority: { type: String, enum: values(AnnouncementPriority), default: AnnouncementPriority.NORMAL },
    audience: { type: String, enum: values(AnnouncementAudience), default: AnnouncementAudience.RESIDENTS },
    status: { type: String, enum: values(AnnouncementStatus), default: AnnouncementStatus.PUBLISHED },
    scheduledAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    attachments: {
      type: [{
        name: { type: String, required: true, trim: true, maxlength: 180 },
        url: { type: String, required: true, trim: true },
        mimeType: { type: String, required: true },
        size: { type: Number, required: true, min: 1 },
      }],
      default: [],
    },
    intelligenceSource: {
      type: new Schema(
        {
          patternKey: { type: String, required: true, trim: true, maxlength: 180 },
          category: { type: String, enum: values(IncidentCategory), required: true },
          incidentIds: { type: [{ type: Schema.Types.ObjectId, ref: "Incident" }], required: true },
          generatedAt: { type: Date, required: true },
          language: { type: String, enum: ["FR", "AR", "EN"], required: false },
          reviewStatus: { type: String, enum: values(IntelligenceReviewStatus), required: true, default: IntelligenceReviewStatus.DRAFT },
        },
        { _id: false }
      ),
      default: undefined,
    },
  },
  { timestamps: true }
);

AnnouncementSchema.index({ residence: 1, isPinned: -1, publishedAt: -1 });
AnnouncementSchema.index({ residence: 1, status: 1, publishedAt: -1 });
AnnouncementSchema.index({ residence: 1, category: 1, audience: 1, priority: 1 });
AnnouncementSchema.index({ status: 1, scheduledAt: 1, expiresAt: 1 });
AnnouncementSchema.index(
  { residence: 1, "intelligenceSource.patternKey": 1 },
  { unique: true, partialFilterExpression: { "intelligenceSource.patternKey": { $type: "string" } } }
);

export const Announcement =
  (mongoose.models.Announcement as AnnouncementModel) ||
  model<IAnnouncement, AnnouncementModel>("Announcement", AnnouncementSchema);
