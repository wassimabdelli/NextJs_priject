import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { VoteChoice } from "@/types/enums";
import { Vote } from "./Vote";

export interface IResolution {
  meeting: Types.ObjectId;
  title: string;
  description?: string;
  /** Majorité requise en % des voix exprimées (FOR + AGAINST) */
  requiredMajority: number;
}

export type VoteTally = Record<VoteChoice, number>;

export interface IResolutionMethods {
  /** Somme des poids (tantièmes) par choix. */
  countVotes(): Promise<VoteTally>;
  /** FOR / (FOR + AGAINST) * 100 >= requiredMajority. Les abstentions ne comptent pas. */
  isAdopted(): Promise<boolean>;
}

export type ResolutionModel = Model<IResolution, {}, IResolutionMethods>;

const ResolutionSchema = new Schema<IResolution, ResolutionModel, IResolutionMethods>(
  {
    meeting: { type: Schema.Types.ObjectId, ref: "Meeting", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    requiredMajority: { type: Number, default: 50, min: 0, max: 100 },
  },
  { timestamps: true }
);

ResolutionSchema.index({ meeting: 1 });

ResolutionSchema.method("countVotes", async function () {
  const rows = await Vote.aggregate<{ _id: VoteChoice; total: number }>([
    { $match: { resolution: this._id } },
    { $group: { _id: "$choice", total: { $sum: "$weight" } } },
  ]);
  const tally: VoteTally = { FOR: 0, AGAINST: 0, ABSTAIN: 0 };
  for (const r of rows) tally[r._id] = r.total;
  return tally;
});

ResolutionSchema.method("isAdopted", async function () {
  const t = await this.countVotes();
  const expressed = t.FOR + t.AGAINST;
  if (expressed === 0) return false;
  return (t.FOR / expressed) * 100 >= this.requiredMajority;
});

export const Resolution =
  (mongoose.models.Resolution as ResolutionModel) ||
  model<IResolution, ResolutionModel>("Resolution", ResolutionSchema);
