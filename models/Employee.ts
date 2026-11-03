import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { ContractType, EmployeePosition, values } from "@/types/enums";

export interface IEmployee {
  residence: Types.ObjectId;
  user?: Types.ObjectId;
  fullName: string;
  position: EmployeePosition;
  contractType: ContractType;
  monthlySalary: number;
  hireDate: Date;
  endDate?: Date;
  phone?: string;
  email?: string;
  isActive: boolean;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type EmployeeModel = Model<IEmployee>;

const EmployeeSchema = new Schema<IEmployee, EmployeeModel>(
  {
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    fullName: { type: String, required: true, trim: true },
    position: { type: String, enum: values(EmployeePosition), required: true },
    contractType: { type: String, enum: values(ContractType), required: true },
    monthlySalary: { type: Number, min: 0, default: 0 },
    hireDate: { type: Date, required: true },
    endDate: { type: Date },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    isActive: { type: Boolean, default: true },
    notes: { type: String },
  },
  { timestamps: true }
);

EmployeeSchema.index({ residence: 1, isActive: 1 });
EmployeeSchema.index({ user: 1 }, { unique: true, sparse: true });

export const Employee =
  (mongoose.models.Employee as EmployeeModel) ||
  model<IEmployee, EmployeeModel>("Employee", EmployeeSchema);
