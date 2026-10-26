import { connection, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z, ZodError } from "zod";
import { connectDB } from "@/lib/db";
import "@/models";

/** Forme standard d'une erreur renvoyée par l'API. */
export interface ApiErrorBody {
  error: string;
  details?: unknown;
}

/** Erreur métier avec code HTTP explicite (ex : 404 ressource introuvable). */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json<T>(data, { status });
}

/** Lit et valide le corps JSON d'une requête avec un schéma Zod. */
export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Corps JSON invalide");
  }

  // Les formulaires envoient "" pour un champ facultatif laissé vide : on le traite
  // comme un champ absent pour que la validation Zod ne le rejette pas.
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    raw = Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).filter(([, value]) => value !== "")
    );
  }
  return schema.parse(raw);
}

export function isValidObjectId(id: string | null | undefined): id is string {
  return !!id && /^[a-f\d]{24}$/i.test(id);
}

/** Erreur MongoDB "duplicate key" (index unique violé). */
export function isDuplicateKeyError(err: unknown): err is { code: 11000; keyPattern?: Record<string, number> } {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

function toErrorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return json<ApiErrorBody>({ error: err.message, details: err.details }, err.status);
  }
  if (err instanceof ZodError) {
    return json<ApiErrorBody>({ error: "Données invalides", details: z.flattenError(err) }, 400);
  }
  if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
    return json<ApiErrorBody>({ error: "Données invalides", details: err.message }, 400);
  }
  if (isDuplicateKeyError(err)) {
    return json<ApiErrorBody>({ error: "Ressource déjà existante", details: err.keyPattern }, 409);
  }
  console.error("[API]", err);
  return json<ApiErrorBody>({ error: "Erreur interne du serveur" }, 500);
}

/**
 * Enveloppe commune des handlers :
 *  1. `connection()` : avec cacheComponents, indique à Next que la réponse dépend
 *     de la requête -> pas de prérendu au build (sinon il tenterait d'interroger MongoDB).
 *     Appelé hors du try pour ne pas intercepter le signal interne de Next.
 *  2. connexion MongoDB (mise en cache par lib/db.ts)
 *  3. conversion des erreurs en réponses 400 / 404 / 409 / 500
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  await connection();
  try {
    await connectDB();
    return await fn();
  } catch (err) {
    return toErrorResponse(err);
  }
}
