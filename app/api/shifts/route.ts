import { shiftCrudRoutes } from "@/lib/crud/personnel";

// Routes GET (liste des plannings) et POST (création d'un créneau sans chevauchement)
export const GET = shiftCrudRoutes.GET;
export const POST = shiftCrudRoutes.POST;
