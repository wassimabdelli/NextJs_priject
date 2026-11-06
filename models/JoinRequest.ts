import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { Role, ResidentType, values } from "@/types/enums";

/** Statuts possibles d'une demande de rattachement. */
export const JoinRequestStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type JoinRequestStatus = (typeof JoinRequestStatus)[keyof typeof JoinRequestStatus];

export interface IJoinRequest {
  user: Types.ObjectId;
  residence: Types.ObjectId;
  /** Numéro du lot tel que saisi par le demandeur (ex : "A101") */
  apartmentNumber: string;
  /** Rôle demandé : OWNER ou TENANT */
  requestedRole: typeof Role.OWNER | typeof Role.TENANT;
  /** Type de résidence dans l'appartement */
  residentType: typeof ResidentType.OWNER | typeof ResidentType.TENANT;
  status: JoinRequestStatus;
  /** Message facultatif laissé par le demandeur */
  message?: string;
  /** Raison du refus (remplie par le syndic/admin en cas de rejet) */
  rejectionReason?: string;
  /** Référence vers la fiche Resident créée lors de l'approbation */
  residentId?: Types.ObjectId;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
}

export type JoinRequestModel = Model<IJoinRequest>;

const JoinRequestSchema = new Schema<IJoinRequest, JoinRequestModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    apartmentNumber: { type: String, required: true, trim: true },
    requestedRole: {
      type: String,
      enum: [Role.OWNER, Role.TENANT],
      required: true,
    },
    residentType: {
      type: String,
      enum: [ResidentType.OWNER, ResidentType.TENANT],
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(JoinRequestStatus),
      default: JoinRequestStatus.PENDING,
    },
    message: { type: String, trim: true },
    rejectionReason: { type: String, trim: true },
    residentId: { type: Schema.Types.ObjectId, ref: "Resident" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

// Un utilisateur ne peut avoir qu'une seule demande en attente par résidence
JoinRequestSchema.index(
  { user: 1, residence: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: JoinRequestStatus.PENDING },
  }
);

export const JoinRequest =
  (mongoose.models.JoinRequest as JoinRequestModel) ||
  model<IJoinRequest, JoinRequestModel>("JoinRequest", JoinRequestSchema);

