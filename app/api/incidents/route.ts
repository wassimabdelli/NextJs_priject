import { incidentCrudRoutes } from "@/lib/crud/incidents";

export const { list: GET, create: POST } = incidentCrudRoutes;
