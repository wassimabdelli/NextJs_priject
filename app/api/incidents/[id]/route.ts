import { incidentCrudRoutes } from "@/lib/crud/incidents";

export const {
  getOne: GET,
  update: PATCH,
  remove: DELETE,
} = incidentCrudRoutes;
