import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { ExpenseCategory, values } from "@/types/enums";

export interface IExpense {
  residence: Types.ObjectId;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: Date;
  proofUrl?: string;
}

export type ExpenseModel = Model<IExpense>;

const ExpenseSchema = new Schema<IExpense, ExpenseModel>(
  {
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    category: { type: String, enum: values(ExpenseCategory), required: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    expenseDate: { type: Date, required: true },
    proofUrl: { type: String },
  },
  { timestamps: true }
);

ExpenseSchema.index({ residence: 1, expenseDate: -1 });

export const Expense =
  (mongoose.models.Expense as ExpenseModel) ||
  model<IExpense, ExpenseModel>("Expense", ExpenseSchema);
