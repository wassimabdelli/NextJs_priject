import { paymentCrudRoutes } from "@/lib/crud/payments";

export const { list: GET, create: POST } = paymentCrudRoutes;
