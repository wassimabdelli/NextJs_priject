import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import "./User";
import "./Incident";

export interface IIncidentComment {
  incident: Types.ObjectId;
  author: Types.ObjectId;
  content: string;
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
}

const IncidentCommentSchema = new Schema<IIncidentComment>(
  {
    incident: {
      type: Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 3000,
    },
    attachments: {
      type: [String],
      default: [],
      validate: {
        validator: (items: string[]) => items.length <= 3,
        message: "Maximum 3 attachments per comment",
      },
    },
  },
  { timestamps: true }
);

IncidentCommentSchema.index({ incident: 1, createdAt: 1 });

export const IncidentComment =
  (mongoose.models.IncidentComment as Model<IIncidentComment>) ||
  model<IIncidentComment>("IncidentComment", IncidentCommentSchema);
