import { employeeCrudRoutes } from "@/lib/crud/personnel";

// Routes GET (liste paginée) et POST (création d'un employé)
export const GET = employeeCrudRoutes.GET;
export const POST = employeeCrudRoutes.POST;
