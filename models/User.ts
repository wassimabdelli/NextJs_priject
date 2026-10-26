import mongoose, { Schema, model, type Model } from "mongoose";
import { Role, values } from "@/types/enums";

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  role: Role;
  isActive: boolean;
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
    role: { type: String, enum: values(Role), default: Role.RESIDENT, required: true },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

UserSchema.index({ role: 1 });

export const User =
  (mongoose.models.User as UserModel) || model<IUser, UserModel>("User", UserSchema);

