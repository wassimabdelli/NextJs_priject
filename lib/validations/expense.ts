import { z } from "zod";
import { ExpenseCategory } from "@/types/enums";
import { date, money, objectId } from "./common";

export const expenseCreateSchema = z.object({
  residence: objectId,
  category: z.enum(ExpenseCategory),
  description: z.string().trim().min(2),
  amount: money,
  expenseDate: date,
  proofUrl: z.string().optional(),
});

export const expenseUpdateSchema = expenseCreateSchema.omit({ residence: true }).partial();

export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;
