import { leaveRequestCrudRoutes } from "@/lib/crud/personnel";

// Routes GET (liste des congés) et POST (création d'une demande de congé)
export const GET = leaveRequestCrudRoutes.GET;
export const POST = leaveRequestCrudRoutes.POST;
