import { z } from "zod";
import {
  ContractType,
  EmployeePosition,
  LeaveStatus,
  LeaveType,
  ShiftStatus,
} from "@/types/enums";
import { date, money, objectId } from "./common";

/* ---------- Employé ---------- */

const employeeBase = z.object({
  residence: objectId,
  user: objectId.optional(),
  fullName: z.string().trim().min(2, "Nom trop court").max(120),
  position: z.enum(EmployeePosition),
  contractType: z.enum(ContractType),
  monthlySalary: money.optional(),
  hireDate: date,
  endDate: date.optional(),
  phone: z.string().trim().min(6, "Téléphone invalide").max(30).optional(),
  email: z.email("Email invalide").optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional(),
});

const employeeDatesRule = (v: { hireDate?: Date; endDate?: Date }) =>
  !v.hireDate || !v.endDate || v.endDate >= v.hireDate;

export const employeeCreateSchema = employeeBase.refine(employeeDatesRule, {
  message: "La date de fin précède la date d'embauche",
  path: ["endDate"],
});

export const employeeUpdateSchema = employeeBase
  .omit({ residence: true })
  .partial()
  .refine(employeeDatesRule, {
    message: "La date de fin précède la date d'embauche",
    path: ["endDate"],
  });

/* ---------- Créneau de planning ---------- */

const MAX_SHIFT_MS = 24 * 60 * 60 * 1000;

const shiftBase = z.object({
  residence: objectId,
  employee: objectId,
  startAt: date,
  endAt: date,
  mission: z.string().trim().max(120).optional(),
  status: z.enum(ShiftStatus).optional(),
  notes: z.string().trim().max(500).optional(),
});

const shiftTimeRule = (v: { startAt?: Date; endAt?: Date }) =>
  !v.startAt ||
  !v.endAt ||
  (v.endAt > v.startAt && v.endAt.getTime() - v.startAt.getTime() <= MAX_SHIFT_MS);

const shiftTimeError = {
  message: "Créneau invalide : la fin doit suivre le début (24 h maximum)",
  path: ["endAt"],
};

export const shiftCreateSchema = shiftBase.refine(shiftTimeRule, shiftTimeError);

export const shiftUpdateSchema = shiftBase
  .omit({ residence: true, employee: true })
  .partial()
  .refine(shiftTimeRule, shiftTimeError);

/* ---------- Congé ---------- */

const leaveBase = z.object({
  residence: objectId,
  employee: objectId,
  type: z.enum(LeaveType),
  startDate: date,
  endDate: date,
  reason: z.string().trim().max(500).optional(),
});

const leaveRule = (v: { startDate?: Date; endDate?: Date }) =>
  !v.startDate || !v.endDate || v.endDate >= v.startDate;

const leaveError = {
  message: "La fin du congé précède son début",
  path: ["endDate"],
};

export const leaveCreateSchema = leaveBase.refine(leaveRule, leaveError);

export const leaveUpdateSchema = leaveBase
  .omit({ residence: true, employee: true })
  .partial()
  .refine(leaveRule, leaveError);

/** Décision du responsable : uniquement accepter ou refuser */
export const leaveDecisionSchema = z.object({
  status: z.enum([LeaveStatus.APPROVED, LeaveStatus.REJECTED]),
});

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;
export type ShiftCreateInput = z.infer<typeof shiftCreateSchema>;
export type ShiftUpdateInput = z.infer<typeof shiftUpdateSchema>;
export type LeaveCreateInput = z.infer<typeof leaveCreateSchema>;
export type LeaveUpdateInput = z.infer<typeof leaveUpdateSchema>;
export type LeaveDecisionInput = z.infer<typeof leaveDecisionSchema>;
