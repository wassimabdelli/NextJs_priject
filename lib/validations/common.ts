import { z } from "zod";

/** ObjectId MongoDB (24 caractères hexadécimaux) */
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Identifiant invalide");

/** Période mensuelle "YYYY-MM" */
export const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format attendu : YYYY-MM");

/** uuid généré côté client, sert de clé d'idempotence pour la synchro offline */
export const clientId = z.uuid("clientId doit être un uuid");

/** Accepte une date ISO (string) ou un objet Date */
export const date = z.coerce.date();

export const money = z.number().nonnegative();
