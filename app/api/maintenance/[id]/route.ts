import { maintenanceCrudRoutes } from "@/lib/crud/maintenance";

export const { getOne: GET, update: PATCH, remove: DELETE } = maintenanceCrudRoutes;
