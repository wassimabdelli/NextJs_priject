import mongoose, { Schema, model, type Types } from "mongoose";

export type IntelligencePatternReviewStatus = "CONFIRMED" | "DISMISSED";

export interface IIntelligencePatternReview {
  residence: Types.ObjectId;
  patternKey: string;
  status: IntelligencePatternReviewStatus;
  reviewer: Types.ObjectId;
  reviewedAt: Date;
}

const IntelligencePatternReviewSchema = new Schema<IIntelligencePatternReview>(
  {
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    patternKey: { type: String, required: true, maxlength: 100 },
    status: { type: String, enum: ["CONFIRMED", "DISMISSED"], required: true },
    reviewer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

IntelligencePatternReviewSchema.index({ residence: 1, patternKey: 1 }, { unique: true });

export const IntelligencePatternReview =
  mongoose.models.IntelligencePatternReview
  || model<IIntelligencePatternReview>("IntelligencePatternReview", IntelligencePatternReviewSchema);
