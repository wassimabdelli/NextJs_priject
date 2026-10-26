import { chargeCrudRoutes } from "@/lib/crud/charges";

export const {
  getOne: GET,
  update: PATCH,
  remove: DELETE,
} = chargeCrudRoutes;
