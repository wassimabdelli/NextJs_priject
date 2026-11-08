import { residenceCrudRoutes } from "@/lib/crud/residences";

export const {
  getOne: GET,
  update: PATCH,
  remove: DELETE,
} = residenceCrudRoutes;
