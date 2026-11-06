import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import "./User";
import "./Election";

export interface IElectionVote {
  election: Types.ObjectId;
  voter: Types.ObjectId;
  candidate: Types.ObjectId;
  weight: number;
  votedAt: Date;
}

export type ElectionVoteModel = Model<IElectionVote>;

const ElectionVoteSchema = new Schema<IElectionVote, ElectionVoteModel>(
  {
    election: { type: Schema.Types.ObjectId, ref: "Election", required: true },
    voter: { type: Schema.Types.ObjectId, ref: "User", required: true },
    candidate: { type: Schema.Types.ObjectId, ref: "User", required: true },
    weight: { type: Number, required: true, min: 1, default: 1 },
    votedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// Un seul vote par votant par élection
ElectionVoteSchema.index({ election: 1, voter: 1 }, { unique: true });

export const ElectionVote =
  (mongoose.models.ElectionVote as ElectionVoteModel) ||
  model<IElectionVote, ElectionVoteModel>("ElectionVote", ElectionVoteSchema);

