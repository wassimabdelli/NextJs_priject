import { equipmentCrudRoutes } from "@/lib/crud/equipment";

export const { getOne: GET, update: PATCH, remove: DELETE } = equipmentCrudRoutes;
