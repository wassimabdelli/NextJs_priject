import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { ElectionPhase, values } from "@/types/enums";
import "./User";
import "./Residence";

export interface IElectionCandidate {
  user: Types.ObjectId;
  name: string;
  email?: string;
  statement?: string;
  registeredAt: Date;
}

export interface IElection {
  residence: Types.ObjectId;
  title: string;
  createdBy: Types.ObjectId;
  phase: ElectionPhase;
  candidacyEndDate: Date;
  votingEndDate: Date;
  candidates: IElectionCandidate[];
  winner?: {
    user: Types.ObjectId;
    name: string;
    votesCount: number;
    votesWeight: number;
  };
  announcements: {
    candidacyAnnounced?: boolean;
    votingAnnounced?: boolean;
    resultsAnnounced?: boolean;
  };
}

export type ElectionModel = Model<IElection>;

const CandidateSchema = new Schema<IElectionCandidate>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    statement: { type: String, trim: true },
    registeredAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const ElectionSchema = new Schema<IElection, ElectionModel>(
  {
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    title: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    phase: {
      type: String,
      enum: values(ElectionPhase),
      default: ElectionPhase.CANDIDACY,
    },
    candidacyEndDate: { type: Date, required: true },
    votingEndDate: { type: Date, required: true },
    candidates: { type: [CandidateSchema], default: [] },
    winner: {
      user: { type: Schema.Types.ObjectId, ref: "User" },
      name: { type: String },
      votesCount: { type: Number, default: 0 },
      votesWeight: { type: Number, default: 0 },
    },
    announcements: {
      candidacyAnnounced: { type: Boolean, default: false },
      votingAnnounced: { type: Boolean, default: false },
      resultsAnnounced: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

ElectionSchema.index({ residence: 1, phase: 1, createdAt: -1 });

export const Election =
  (mongoose.models.Election as ElectionModel) ||
  model<IElection, ElectionModel>("Election", ElectionSchema);

