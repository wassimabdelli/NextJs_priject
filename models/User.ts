import mongoose, { Schema, model, type Model } from "mongoose";
import { IncidentCategory, Role, values } from "@/types/enums";

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  role: Role;
  isActive: boolean;
  /** Spécialités technicien pour auto-assignation */
  technicianCategories?: IncidentCategory[];
  notifyInApp?: boolean;
  notifyWhatsApp?: boolean;
  notifyPush?: boolean;
  pushSubscription?: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserModel = Model<IUser>;

const UserSchema = new Schema<IUser, UserModel>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false -> le hash n'est jamais renvoyé par défaut dans les requêtes
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    role: { type: String, enum: values(Role), default: Role.OWNER, required: true },
    isActive: { type: Boolean, default: true, required: true },
    technicianCategories: {
      type: [{ type: String, enum: values(IncidentCategory) }],
      default: [],
    },
    notifyInApp: { type: Boolean, default: true },
    notifyWhatsApp: { type: Boolean, default: false },
    notifyPush: { type: Boolean, default: false },
    pushSubscription: {
      endpoint: String,
      keys: { p256dh: String, auth: String },
    },
  },
  { timestamps: true }
);

UserSchema.index({ role: 1 });

export const User =
  (mongoose.models.User as UserModel) || model<IUser, UserModel>("User", UserSchema);

