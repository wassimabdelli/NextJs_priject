import { leaveRequestCrudRoutes } from "@/lib/crud/personnel";

// Routes PATCH (validation / rejet de congé) et DELETE (suppression)
export const PATCH = leaveRequestCrudRoutes.PATCH;
export const DELETE = leaveRequestCrudRoutes.DELETE;
