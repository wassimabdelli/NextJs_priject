import { registry, ErrorResponseSchema } from "../registry";
import { z } from "zod";

export function registerDashboardPaths() {
  registry.registerPath({
    method: "get",
    path: "/api/dashboard",
    tags: ["Tableau de bord"],
    summary: "Données consolidées du tableau de bord selon le rôle",
    description: "Endpoint unique retournant les KPI et graphiques (ADMIN/SYNDIC), la situation comptable et annonces (RESIDENT) ou les interventions de maintenance (TECHNICIAN). Mis en cache localement dans Dexie.\n\n**Rôles autorisés** : Tous.",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Données agrégées du tableau de bord",
        content: {
          "application/json": {
            schema: z.object({
              role: z.string(),
              kpi: z.any().optional(),
              charts: z.any().optional(),
              whatIOwe: z.any().optional(),
              latestAnnouncements: z.any().optional(),
              myIncidents: z.any().optional(),
              myInterventions: z.any().optional(),
            }),
          },
        },
      },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });
}
