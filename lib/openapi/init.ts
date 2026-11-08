import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Étend Zod avec les méthodes OpenAPI (.openapi())
extendZodWithOpenApi(z);

const openapiFn = (z as any).ZodType?.prototype?.openapi;

/**
 * Garantit que le schéma possède la méthode .openapi() même si le schéma a été instancié
 * avant l'appel à extendZodWithOpenApi (par exemple suite au hoisting d'imports par Turbopack).
 */
export function ensureOpenApi<T>(schema: T): T {
  if (schema && typeof (schema as any).openapi !== "function" && openapiFn) {
    const proto = Object.getPrototypeOf(schema);
    if (proto && !proto.openapi) {
      proto.openapi = openapiFn;
    }
    (schema as any).openapi = openapiFn;
  }
  return schema;
}
