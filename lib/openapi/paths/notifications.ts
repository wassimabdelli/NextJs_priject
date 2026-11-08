import { z } from "zod";
import { registry, ErrorResponseSchema } from "../registry";
import { notificationTypes } from "@/models/Notification";

const notificationItemSchema = z.object({
  _id: z.string(),
  type: z.enum(notificationTypes),
  title: z.string(),
  message: z.string(),
  isRead: z.boolean(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
  relatedResource: z.object({
    resourceType: z.enum(["INCIDENT", "ANNOUNCEMENT", "SYSTEM"]),
    resourceId: z.string().nullable().optional(),
  }),
});

export function registerNotificationPaths() {
  registry.registerPath({
    method: "get",
    path: "/api/notifications",
    tags: ["Notifications"],
    summary: "Lister les notifications du compte connecté",
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        read: z.enum(["true", "false"]).optional(),
        type: z.enum(notificationTypes).optional(),
        q: z.string().max(100).optional(),
      }),
    },
    responses: {
      200: {
        description: "Page de notifications privée à l'utilisateur",
        content: { "application/json": { schema: z.object({
          data: z.array(notificationItemSchema),
          meta: z.object({ page: z.number(), limit: z.number(), total: z.number() }),
          unreadCount: z.number(),
        }) } },
      },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });
  registry.registerPath({
    method: "get",
    path: "/api/notifications/unread-count",
    tags: ["Notifications"],
    summary: "Compter les notifications non lues du compte",
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: "Nombre de notifications non lues", content: { "application/json": { schema: z.object({ unreadCount: z.number() }) } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });
  registry.registerPath({
    method: "patch",
    path: "/api/notifications/read-all",
    tags: ["Notifications"],
    summary: "Marquer les notifications du compte comme lues",
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: "Nombre de notifications mises à jour", content: { "application/json": { schema: z.object({ updatedCount: z.number() }) } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });
  registry.registerPath({
    method: "patch",
    path: "/api/notifications/{id}/read",
    tags: ["Notifications"],
    summary: "Marquer une notification personnelle comme lue",
    security: [{ cookieAuth: [] }],
    request: { params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }) },
    responses: {
      200: { description: "Notification marquée comme lue", content: { "application/json": { schema: notificationItemSchema } } },
      404: { description: "Notification introuvable", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });
  registry.registerPath({
    method: "delete",
    path: "/api/notifications/{id}",
    tags: ["Notifications"],
    summary: "Supprimer une notification personnelle",
    security: [{ cookieAuth: [] }],
    request: { params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }) },
    responses: {
      200: { description: "Notification supprimée", content: { "application/json": { schema: z.object({ success: z.literal(true) }) } } },
      404: { description: "Notification introuvable", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });
  registry.registerPath({
    method: "get",
    path: "/api/activity",
    tags: ["Activity"],
    summary: "Lister les événements accessibles au compte",
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(50).optional(),
        kind: z.enum(["INCIDENT", "ANNOUNCEMENT"]).optional(),
      }),
    },
    responses: {
      200: { description: "Activité autorisée par rôle", content: { "application/json": { schema: z.object({
        data: z.array(z.object({
          id: z.string(), kind: z.enum(["INCIDENT", "ANNOUNCEMENT"]), title: z.string(),
          message: z.string(), createdAt: z.unknown(), href: z.string(),
        })),
        meta: z.object({ page: z.number(), limit: z.number(), total: z.number() }),
      }) } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });
}
