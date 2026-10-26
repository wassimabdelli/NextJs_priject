import { apartmentCrudRoutes } from "@/lib/crud/apartments";

export const {
  getOne: GET,
  update: PATCH,
  remove: DELETE,
} = apartmentCrudRoutes;
