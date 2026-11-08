import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { VoteChoice, values } from "@/types/enums";

export interface IVote {
  resolution: Types.ObjectId;
  apartment: Types.ObjectId;
  voter?: Types.ObjectId;
  choice: VoteChoice;
  /** Poids du vote = tantièmes du lot au moment du vote */
  weight: number;
  votedAt: Date;
}

export type VoteModel = Model<IVote>;

const VoteSchema = new Schema<IVote, VoteModel>(
  {
    resolution: { type: Schema.Types.ObjectId, ref: "Resolution", required: true },
    apartment: { type: Schema.Types.ObjectId, ref: "Apartment", required: true },
    voter: { type: Schema.Types.ObjectId, ref: "User" },
    choice: { type: String, enum: values(VoteChoice), required: true },
    weight: { type: Number, required: true, min: 0 },
    votedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// Un seul vote par lot et par résolution
VoteSchema.index({ resolution: 1, apartment: 1 }, { unique: true });

export const Vote =
  (mongoose.models.Vote as VoteModel) || model<IVote, VoteModel>("Vote", VoteSchema);
