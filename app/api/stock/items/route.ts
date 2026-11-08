import { stockItemCrudRoutes } from "@/lib/crud/stock";

// Routes GET (liste paginée) et POST (création d'un article de stock)
export const GET = stockItemCrudRoutes.GET;
export const POST = stockItemCrudRoutes.POST;
