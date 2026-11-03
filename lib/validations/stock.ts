import { z } from "zod";
import { StockMovementType, StockUnit } from "@/types/enums";
import { clientId, date, objectId } from "./common";

/* ---------- Article de stock ---------- */

const stockItemBase = z.object({
  residence: objectId,
  name: z.string().trim().min(2, "Nom trop court").max(120),
  unit: z.enum(StockUnit).optional(),
  quantity: z.number().min(0).optional(), // stock initial uniquement
  minThreshold: z.number().min(0).optional(),
  location: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const stockItemCreateSchema = stockItemBase;

/** La quantité ne se modifie QUE par les mouvements : elle est exclue de la mise à jour. */
export const stockItemUpdateSchema = stockItemBase
  .omit({ residence: true, quantity: true })
  .partial();

/* ---------- Mouvement de stock ---------- */

export const stockMovementCreateSchema = z.object({
  residence: objectId.optional(), // déduite de l'article côté serveur
  item: objectId,
  type: z.enum(StockMovementType),
  quantity: z.number().positive("La quantité doit être positive"),
  reason: z.string().trim().max(200).optional(),
  performedBy: objectId.optional(), // forcé côté serveur
  movementDate: date.optional(),
  createdOffline: z.boolean().optional(),
  clientId: clientId.optional(),
});

/** Un mouvement est un historique : seul le motif est modifiable. */
export const stockMovementUpdateSchema = stockMovementCreateSchema
  .pick({ reason: true })
  .partial();

export type StockItemCreateInput = z.infer<typeof stockItemCreateSchema>;
export type StockItemUpdateInput = z.infer<typeof stockItemUpdateSchema>;
export type StockMovementCreateInput = z.infer<typeof stockMovementCreateSchema>;
export type StockMovementUpdateInput = z.infer<typeof stockMovementUpdateSchema>;
