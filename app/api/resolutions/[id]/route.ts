import { resolutionCrudRoutes } from "@/lib/crud/resolutions";

export const GET = resolutionCrudRoutes.getOne;
export const PATCH = resolutionCrudRoutes.update;
export const DELETE = resolutionCrudRoutes.remove;
