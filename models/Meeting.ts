import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { MeetingStatus, values } from "@/types/enums";
import { Resolution } from "./Resolution";
import { Vote } from "./Vote";
import { Apartment } from "./Apartment";

export interface IMeetingAttendee {
  apartment: Types.ObjectId;
  present: boolean;
  shares: number;
  markedAt?: Date;
}

export interface IMeeting {
  residence: Types.ObjectId;
  title: string;
  date: Date;
  location?: string;
  agenda?: string;
  agendaItems: string[];
  status: MeetingStatus;
  /** Quorum requis (0–1), défaut 0.5 */
  quorumRequired: number;
  attendees: IMeetingAttendee[];
  minutesSignedAt?: Date;
  minutesSignedBy?: Types.ObjectId;
  minutesDocumentUrl?: string;
  /** Lien visioconférence (Jitsi par défaut) */
  meetUrl?: string;
  meetProvider?: "jitsi" | "custom";
  meetCreatedAt?: Date;
  /** Transcription / compte-rendu oral sauvegardé */
  transcript?: string;
  transcriptSavedAt?: Date;
  /** Brouillon de PV généré par l'IA à partir du transcript */
  aiMinutesDraft?: string;
  aiGeneratedAt?: Date;
}

export interface IMeetingMethods {
  isQuorumReached(): Promise<boolean>;
  getQuorumStats(): Promise<{
    totalShares: number;
    presentShares: number;
    percentage: number;
    requiredPercentage: number;
    reached: boolean;
    source: "attendance" | "votes";
  }>;
}

export type MeetingModel = Model<IMeeting, {}, IMeetingMethods>;

const AttendeeSchema = new Schema<IMeetingAttendee>(
  {
    apartment: { type: Schema.Types.ObjectId, ref: "Apartment", required: true },
    present: { type: Boolean, default: false },
    shares: { type: Number, default: 0 },
    markedAt: { type: Date },
  },
  { _id: false }
);

const MeetingSchema = new Schema<IMeeting, MeetingModel, IMeetingMethods>(
  {
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    location: { type: String },
    agenda: { type: String },
    agendaItems: { type: [String], default: [] },
    status: { type: String, enum: values(MeetingStatus), default: MeetingStatus.PLANNED },
    quorumRequired: { type: Number, default: 0.5, min: 0, max: 1 },
    attendees: { type: [AttendeeSchema], default: [] },
    minutesSignedAt: { type: Date },
    minutesSignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    minutesDocumentUrl: { type: String },
    meetUrl: { type: String },
    meetProvider: { type: String, enum: ["jitsi", "custom"] },
    meetCreatedAt: { type: Date },
    transcript: { type: String },
    transcriptSavedAt: { type: Date },
    aiMinutesDraft: { type: String },
    aiGeneratedAt: { type: Date },
  },
  { timestamps: true }
);

MeetingSchema.index({ residence: 1, date: -1 });

MeetingSchema.method("getQuorumStats", async function () {
  const totalShares = await Apartment.totalShares(this.residence);
  const requiredPercentage = Math.round((this.quorumRequired || 0.5) * 10000) / 100;

  const presentFromAttendance = (this.attendees || [])
    .filter((a) => a.present)
    .reduce((sum, a) => sum + (a.shares || 0), 0);

  if ((this.attendees || []).length > 0) {
    const percentage =
      totalShares > 0
        ? Math.round((presentFromAttendance / totalShares) * 10000) / 100
        : 0;
    return {
      totalShares,
      presentShares: presentFromAttendance,
      percentage,
      requiredPercentage,
      reached: totalShares > 0 && presentFromAttendance / totalShares > (this.quorumRequired || 0.5),
      source: "attendance" as const,
    };
  }

  // Repli historique : présents = ont voté au moins une résolution
  const resolutionIds = await Resolution.find({ meeting: this._id }).distinct("_id");
  const apartmentIds = await Vote.find({ resolution: { $in: resolutionIds } }).distinct(
    "apartment"
  );
  const [present] = await Apartment.aggregate<{ total: number }>([
    { $match: { _id: { $in: apartmentIds } } },
    { $group: { _id: null, total: { $sum: "$shares" } } },
  ]);
  const presentShares = present?.total ?? 0;
  const percentage =
    totalShares > 0 ? Math.round((presentShares / totalShares) * 10000) / 100 : 0;

  return {
    totalShares,
    presentShares,
    percentage,
    requiredPercentage,
    reached: totalShares > 0 && presentShares / totalShares > (this.quorumRequired || 0.5),
    source: "votes" as const,
  };
});

MeetingSchema.method("isQuorumReached", async function () {
  const stats = await this.getQuorumStats();
  return stats.reached;
});

export const Meeting =
  (mongoose.models.Meeting as MeetingModel) ||
  model<IMeeting, MeetingModel>("Meeting", MeetingSchema);
