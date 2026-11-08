import { expenseCrudRoutes } from "@/lib/crud/expenses";

export const { list: GET, create: POST } = expenseCrudRoutes;
