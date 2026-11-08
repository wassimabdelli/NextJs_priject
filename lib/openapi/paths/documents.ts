import { registry, DocumentCreateSchema, DocumentUpdateSchema, ErrorResponseSchema } from "../registry";
import { z } from "zod";

export function registerDocumentsPaths() {
  registry.registerPath({
    method: "get",
    path: "/api/documents",
    tags: ["Documents"],
    summary: "Lister les documents de la copropriété",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Liste des documents",
        content: {
          "application/json": {
            schema: z.object({
              data: z.array(z.any()),
              meta: z.object({ page: z.number(), limit: z.number(), total: z.number() }).optional(),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/documents",
    tags: ["Documents"],
    summary: "Enregistrer une notice de document",
    security: [{ cookieAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: DocumentCreateSchema } } },
    },
    responses: {
      201: { description: "Document créé" },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/documents/{id}",
    tags: ["Documents"],
    summary: "Supprimer un document",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: { description: "Document supprimé" },
    },
  });

  // POST /api/documents/upload
  registry.registerPath({
    method: "post",
    path: "/api/documents/upload",
    tags: ["Documents"],
    summary: "Téléverser un fichier (PDF ou image, max 5 Mo)",
    description: "Téléversement d'un document stocké dans public/uploads. Taille max 5 Mo, types autorisés : PDF, JPEG, PNG, WEBP.\n\n**Rôles autorisés** : ADMIN, SYNDIC.",
    security: [{ cookieAuth: [] }],
    responses: {
      201: {
        description: "Fichier téléversé avec succès",
        content: {
          "application/json": {
            schema: z.object({
              fileUrl: z.string(),
              filename: z.string(),
              size: z.number(),
              mimeType: z.string(),
            }),
          },
        },
      },
      400: { description: "Taille > 5 Mo ou type de fichier invalide" },
    },
  });
}
