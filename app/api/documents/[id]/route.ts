import { documentCrudRoutes } from "@/lib/crud/documents";

export const GET = documentCrudRoutes.getOne;
export const PATCH = documentCrudRoutes.update;
export const DELETE = documentCrudRoutes.remove;
