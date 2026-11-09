import { z } from "zod";
import {
  EquipmentCategory,
  EquipmentStatus,
  MaintenanceStatus,
  MaintenanceType,
} from "@/types/enums";
import { clientId, date, money, objectId } from "./common";

/* ---------- Équipement ---------- */

const equipmentBase = z.object({
  residence: objectId,
  name: z.string().trim().min(2, "Nom trop court").max(120),
  category: z.enum(EquipmentCategory),
  location: z.string().trim().max(120).optional(),
  serialNumber: z.string().trim().max(80).optional(),
  purchaseDate: date.optional(),
  warrantyEndDate: date.optional(),
  status: z.enum(EquipmentStatus).optional(),
  maintenanceIntervalDays: z.number().int().min(0).max(3650).optional(),
  lastMaintenanceDate: date.optional(),
  provider: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const warrantyRule = (v: { purchaseDate?: Date; warrantyEndDate?: Date }) =>
  !v.purchaseDate || !v.warrantyEndDate || v.warrantyEndDate >= v.purchaseDate;

const warrantyError = {
  message: "La fin de garantie précède la date d'achat",
  path: ["warrantyEndDate"],
};

export const equipmentCreateSchema = equipmentBase.refine(warrantyRule, warrantyError);

export const equipmentUpdateSchema = equipmentBase
  .omit({ residence: true })
  .partial()
  .refine(warrantyRule, warrantyError);

/* ---------- Intervention ---------- */

const checklistItem = z.object({
  label: z.string().trim().min(1).max(200),
  done: z.boolean().optional(),
});

const taskBase = z.object({
  residence: objectId,
  equipment: objectId,
  type: z.enum(MaintenanceType),
  title: z.string().trim().min(3, "Titre trop court").max(160),
  description: z.string().trim().max(2000).optional(),
  scheduledDate: date,
  assignedTo: objectId.optional(),
  incident: objectId.optional(),
  cost: money.optional(),
  notes: z.string().trim().max(1000).optional(),
  checklist: z.array(checklistItem).max(30).optional(),
  createdOffline: z.boolean().optional(),
  clientId: clientId.optional(),
});

export const maintenanceTaskCreateSchema = taskBase;

export const maintenanceTaskUpdateSchema = taskBase
  .omit({
    residence: true,
    equipment: true,
    incident: true,
    createdOffline: true,
    clientId: true,
  })
  .partial()
  .extend({ status: z.enum(MaintenanceStatus).optional() });

/** Pièce de stock utilisée lors de la clôture d'une intervention */
const usedItemSchema = z.object({
  itemId: objectId,
  quantity: z.coerce.number().positive("La quantité doit être supérieure à 0"),
});

/** Clôture d'une intervention (action dédiée) */
export const maintenanceCompleteSchema = z.object({
  cost: money.optional(),
  notes: z.string().trim().max(1000).optional(),
  checklist: z.array(checklistItem).max(30).optional(),
  completedAt: date.optional(),
  usedItems: z.array(usedItemSchema).max(50).optional(),
});

/** PATCH /api/maintenance/[id]/status : démarrage ou annulation (la clôture a sa propre route) */
export const maintenanceStatusSchema = z.object({
  status: z.enum([MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.CANCELLED]),
});

export type EquipmentCreateInput = z.infer<typeof equipmentCreateSchema>;
export type EquipmentUpdateInput = z.infer<typeof equipmentUpdateSchema>;
export type MaintenanceTaskCreateInput = z.infer<typeof maintenanceTaskCreateSchema>;
export type MaintenanceTaskUpdateInput = z.infer<typeof maintenanceTaskUpdateSchema>;
export type MaintenanceCompleteInput = z.infer<typeof maintenanceCompleteSchema>;
export type MaintenanceStatusInput = z.infer<typeof maintenanceStatusSchema>;
