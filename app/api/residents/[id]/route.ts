import { residentCrudRoutes } from "@/lib/crud/residents";

export const {
  getOne: GET,
  update: PATCH,
  remove: DELETE,
} = residentCrudRoutes;
