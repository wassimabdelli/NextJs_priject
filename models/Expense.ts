import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { ExpenseCategory, values } from "@/types/enums";

export interface IExpense {
  residence: Types.ObjectId;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: Date;
  status?: string;
  proofUrl?: string;
}

export type ExpenseModel = Model<IExpense>;

const ExpenseSchema = new Schema<IExpense, ExpenseModel>(
  {
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    category: { type: String, enum: values(ExpenseCategory), required: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    expenseDate: { type: Date, required: true, default: Date.now },
    status: { type: String, trim: true, default: "VALIDATED" },
    proofUrl: { type: String },
  },
  { timestamps: true }
);

ExpenseSchema.index({ residence: 1, expenseDate: -1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.Expense) {
  delete mongoose.models.Expense;
}

export const Expense =
  (mongoose.models.Expense as ExpenseModel) ||
  model<IExpense, ExpenseModel>("Expense", ExpenseSchema);
