import { expenseCrudRoutes } from "@/lib/crud/expenses";

export const {
  getOne: GET,
  update: PATCH,
  remove: DELETE,
} = expenseCrudRoutes;
