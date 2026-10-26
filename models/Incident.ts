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
  /** true si l'incident a été saisi hors ligne puis synchronisé */
  createdOffline: boolean;
  /** uuid généré côté client pour l'idempotence de la synchro offline */
  clientId?: string;
  syncedAt?: Date;
}

export interface IIncidentMethods {
  /** Assigne un technicien et passe le statut à ASSIGNED si l'incident était seulement signalé. */
  assignTo(technicianId: Types.ObjectId | string): IncidentDocument;
  /** Change le statut ; renseigne resolvedAt au passage à RESOLVED. */
  changeStatus(status: IncidentStatus): IncidentDocument;
}

export type IncidentModel = Model<IIncident, {}, IIncidentMethods>;
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
    createdOffline: { type: Boolean, default: false },
    clientId: { type: String, unique: true, sparse: true },
    syncedAt: { type: Date },
  },
  { timestamps: true }
);

IncidentSchema.index({ residence: 1, status: 1 });
IncidentSchema.index({ assignedTo: 1, status: 1 });

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
