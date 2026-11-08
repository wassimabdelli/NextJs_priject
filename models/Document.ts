import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { DocumentType, values } from "@/types/enums";

export interface IDocument {
  residence: Types.ObjectId;
  meeting?: Types.ObjectId;
  uploadedBy?: Types.ObjectId;
  title: string;
  type: DocumentType;
  fileUrl: string;
  uploadedAt: Date;
}

export type DocumentModel = Model<IDocument>;

const DocumentSchema = new Schema<IDocument, DocumentModel>(
  {
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    meeting: { type: Schema.Types.ObjectId, ref: "Meeting" },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: values(DocumentType), required: true },
    fileUrl: { type: String, required: true },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

DocumentSchema.index({ residence: 1, type: 1 });

// Nom "ResidenceDocument" côté JS pour ne pas masquer le type global DOM `Document`.
export const ResidenceDocument =
  (mongoose.models.Document as DocumentModel) ||
  model<IDocument, DocumentModel>("Document", DocumentSchema);
