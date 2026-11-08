import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { MeetingStatus, values } from "@/types/enums";
import { Resolution } from "./Resolution";
import { Vote } from "./Vote";
import { Apartment } from "./Apartment";

export interface IMeeting {
  residence: Types.ObjectId;
  title: string;
  date: Date;
  location?: string;
  agenda?: string;
  status: MeetingStatus;
}

export interface IMeetingMethods {
  /**
   * Quorum atteint si la somme des tantièmes des lots ayant voté à au moins
   * une résolution de l'AG dépasse 50 % des tantièmes de la résidence.
   * Hypothèse : "présent" = a voté (pas de feuille de présence dans le modèle).
   */
  isQuorumReached(): Promise<boolean>;
}

export type MeetingModel = Model<IMeeting, {}, IMeetingMethods>;

const MeetingSchema = new Schema<IMeeting, MeetingModel, IMeetingMethods>(
  {
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    location: { type: String },
    agenda: { type: String },
    status: { type: String, enum: values(MeetingStatus), default: MeetingStatus.PLANNED },
  },
  { timestamps: true }
);

MeetingSchema.index({ residence: 1, date: -1 });

MeetingSchema.method("isQuorumReached", async function () {
  const resolutionIds = await Resolution.find({ meeting: this._id }).distinct("_id");
  const apartmentIds = await Vote.find({ resolution: { $in: resolutionIds } }).distinct("apartment");

  const [present] = await Apartment.aggregate<{ total: number }>([
    { $match: { _id: { $in: apartmentIds } } },
    { $group: { _id: null, total: { $sum: "$shares" } } },
  ]);
  const total = await Apartment.totalShares(this.residence);
  if (total === 0) return false;
  return (present?.total ?? 0) / total > 0.5;
});

export const Meeting =
  (mongoose.models.Meeting as MeetingModel) ||
  model<IMeeting, MeetingModel>("Meeting", MeetingSchema);
