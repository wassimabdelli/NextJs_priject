import mongoose, { Schema, model, type Model, type Types, type HydratedDocument } from "mongoose";
import { IncidentCategory, IncidentStatus, Priority, values } from "@/types/enums";
import "./User";
import "./Apartment";
import "./Residence";

export interface IIncident {
  residence: Types.ObjectId;
  apartment?: Types.ObjectId;
  reportedBy?: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  title: string;
  description: string;
  category: IncidentCategory;
  /** URLs ou data-URLs des photos */
  photos: string[];
  priority: Priority;
  status: IncidentStatus;
  reportedAt: Date;
  resolvedAt?: Date;
  resolutionDescription?: string;
  resolutionPhotos: string[];
  resolutionSubmittedAt?: Date;
  resolutionConfirmedAt?: Date;
  resolutionRejectedAt?: Date;
  resolutionFeedback?: string;
  /** true si l'incident a été saisi hors ligne puis synchronisé */
  createdOffline: boolean;
  /** uuid généré côté client pour l'idempotence de la synchro offline */
  clientId?: string;
  syncedAt?: Date;
  relatedIncidents: Types.ObjectId[];
  dismissedDuplicates: Types.ObjectId[];
  embedding?: number[];
  aiTriage?: {
    category?: string;
    priority?: string;
    specialty?: string;
    probableCause?: string;
    safetyRisk?: boolean;
    confidence?: number;
    model?: string;
  };
  aiResolutionCheck?: {
    verdict?: string;
    explanation?: string;
    confidence?: number;
    checkedAt?: Date;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IIncidentMethods {
  /** Assigne un technicien et passe le statut à ASSIGNED si l'incident était seulement signalé. */
  assignTo(technicianId: Types.ObjectId | string): IncidentDocument;
  /** Change le statut ; renseigne resolvedAt au passage à RESOLVED. */
  changeStatus(status: IncidentStatus): IncidentDocument;
}

export type IncidentModel = Model<IIncident, Record<string, never>, IIncidentMethods>;
export type IncidentDocument = HydratedDocument<IIncident, IIncidentMethods>;

const IncidentSchema = new Schema<IIncident, IncidentModel, IIncidentMethods>(
  {
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    apartment: { type: Schema.Types.ObjectId, ref: "Apartment" },
    reportedBy: { type: Schema.Types.ObjectId, ref: "User" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, enum: values(IncidentCategory), required: true },
    photos: { type: [String], default: [] },
    priority: { type: String, enum: values(Priority), default: Priority.MEDIUM },
    status: { type: String, enum: values(IncidentStatus), default: IncidentStatus.REPORTED },
    reportedAt: { type: Date, default: () => new Date() },
    resolvedAt: { type: Date },
    resolutionDescription: { type: String, trim: true, maxlength: 2000 },
    resolutionPhotos: { type: [String], default: [] },
    resolutionSubmittedAt: { type: Date },
    resolutionConfirmedAt: { type: Date },
    resolutionRejectedAt: { type: Date },
    resolutionFeedback: { type: String, trim: true, maxlength: 1000 },
    createdOffline: { type: Boolean, default: false },
    clientId: { type: String, unique: true, sparse: true },
    syncedAt: { type: Date },
    relatedIncidents: { type: [{ type: Schema.Types.ObjectId, ref: "Incident" }], default: [] },
    dismissedDuplicates: { type: [{ type: Schema.Types.ObjectId, ref: "Incident" }], default: [] },
    embedding: { type: [Number], select: false, default: undefined },
    aiTriage: {
      type: new Schema(
        {
          category: String,
          priority: String,
          specialty: String,
          probableCause: String,
          safetyRisk: Boolean,
          confidence: Number,
          model: String,
        },
        { _id: false }
      ),
      default: undefined,
    },
    aiResolutionCheck: {
      type: new Schema(
        {
          verdict: String,
          explanation: String,
          confidence: Number,
          checkedAt: Date,
        },
        { _id: false }
      ),
      default: undefined,
    },
  },
  { timestamps: true }
);

IncidentSchema.index({ residence: 1, status: 1 });
IncidentSchema.index({ assignedTo: 1, status: 1 });
IncidentSchema.index({ reportedAt: -1 });
IncidentSchema.index({ priority: -1, createdAt: -1 });
IncidentSchema.index({ status: 1, resolvedAt: 1 });

IncidentSchema.method("assignTo", function (technicianId: Types.ObjectId | string) {
  this.assignedTo = new mongoose.Types.ObjectId(String(technicianId));
  if (this.status === IncidentStatus.REPORTED) this.status = IncidentStatus.ASSIGNED;
  return this;
});

IncidentSchema.method("changeStatus", function (status: IncidentStatus) {
  this.status = status;
  // resolvedAt n'a de sens que pour un incident résolu
  this.resolvedAt = status === IncidentStatus.RESOLVED ? (this.resolvedAt ?? new Date()) : undefined;
  return this;
});

export const Incident =
  (mongoose.models.Incident as IncidentModel) ||
  model<IIncident, IncidentModel>("Incident", IncidentSchema);
