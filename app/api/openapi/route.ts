import type { NextRequest } from "next/server";
import { HttpError, json } from "@/lib/api";
import { withAuth } from "@/lib/auth-guard";
import { Role } from "@/types/enums";
import { getOpenApiDocument } from "@/lib/openapi/generate";

/**
 * GET /api/openapi
 * Renvoie la spécification OpenAPI 3.0 au format JSON.
 * Rôles autorisés : ADMIN, SYNDIC.
 * En production : désactivée sauf si ENABLE_API_DOCS === "true".
 */
export const GET = withAuth(
  async (_req: NextRequest) => {
    if (process.env.NODE_ENV === "production" && process.env.ENABLE_API_DOCS !== "true") {
      throw new HttpError(404, "Documentation API non disponible");
    }

    const spec = getOpenApiDocument();
    return json(spec);
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
