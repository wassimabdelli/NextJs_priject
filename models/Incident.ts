import mongoose, { Schema, model, type Model, type Types, type HydratedDocument } from "mongoose";
import {
  IncidentCategory,
  IncidentStatus,
  IncidentTimelineType,
  Priority,
  values,
} from "@/types/enums";
import "./User";
import "./Apartment";
import "./Residence";

export interface IIncidentTimelineEntry {
  at: Date;
  by?: Types.ObjectId;
  type: IncidentTimelineType;
  message: string;
  meta?: Record<string, unknown>;
}

export interface IIncident {
  residence: Types.ObjectId;
  apartment?: Types.ObjectId;
  reportedBy?: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  title: string;
  description: string;
  category: IncidentCategory;
  /** Photos générales (rétrocompat) */
  photos: string[];
  beforePhotos: string[];
  afterPhotos: string[];
  priority: Priority;
  status: IncidentStatus;
  reportedAt: Date;
  resolvedAt?: Date;
  slaDueAt?: Date;
  slaBreached: boolean;
  timeline: IIncidentTimelineEntry[];
  createdOffline: boolean;
  clientId?: string;
  syncedAt?: Date;
  resolutionDescription?: string;
  resolutionPhotos: string[];
  resolutionSubmittedAt?: Date;
  resolutionConfirmedAt?: Date;
  resolutionRejectedAt?: Date;
  resolutionFeedback?: string;
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
}

export interface IIncidentMethods {
  assignTo(technicianId: Types.ObjectId | string): IncidentDocument;
  changeStatus(status: IncidentStatus): IncidentDocument;
}

export type IncidentModel = Model<IIncident, {}, IIncidentMethods>;
export type IncidentDocument = HydratedDocument<IIncident, IIncidentMethods>;

const TimelineSchema = new Schema<IIncidentTimelineEntry>(
  {
    at: { type: Date, default: () => new Date() },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: values(IncidentTimelineType), required: true },
    message: { type: String, required: true },
    meta: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

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
    beforePhotos: { type: [String], default: [] },
    afterPhotos: { type: [String], default: [] },
    priority: { type: String, enum: values(Priority), default: Priority.MEDIUM },
    status: { type: String, enum: values(IncidentStatus), default: IncidentStatus.REPORTED },
    reportedAt: { type: Date, default: () => new Date() },
    resolvedAt: { type: Date },
    slaDueAt: { type: Date },
    slaBreached: { type: Boolean, default: false },
    timeline: { type: [TimelineSchema], default: [] },
    createdOffline: { type: Boolean, default: false },
    clientId: { type: String, unique: true, sparse: true },
    syncedAt: { type: Date },
    resolutionDescription: { type: String, trim: true, maxlength: 2000 },
    resolutionPhotos: { type: [String], default: [] },
    resolutionSubmittedAt: { type: Date },
    resolutionConfirmedAt: { type: Date },
    resolutionRejectedAt: { type: Date },
    resolutionFeedback: { type: String, trim: true, maxlength: 1000 },
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
IncidentSchema.index({ slaDueAt: 1, status: 1 });

IncidentSchema.method("assignTo", function (technicianId: Types.ObjectId | string) {
  this.assignedTo = new mongoose.Types.ObjectId(String(technicianId));
  if (this.status === IncidentStatus.REPORTED) this.status = IncidentStatus.ASSIGNED;
  return this;
});

IncidentSchema.method("changeStatus", function (status: IncidentStatus) {
  this.status = status;
  this.resolvedAt = status === IncidentStatus.RESOLVED ? (this.resolvedAt ?? new Date()) : undefined;
  return this;
});

export const Incident =
  (mongoose.models.Incident as IncidentModel) ||
  model<IIncident, IncidentModel>("Incident", IncidentSchema);
