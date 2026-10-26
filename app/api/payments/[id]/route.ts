import { paymentCrudRoutes } from "@/lib/crud/payments";

export const {
  getOne: GET,
  update: PATCH,
  remove: DELETE,
} = paymentCrudRoutes;
