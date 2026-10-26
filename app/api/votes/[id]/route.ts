import { voteCrudRoutes } from "@/lib/crud/votes";

export const GET = voteCrudRoutes.getOne;
export const PATCH = voteCrudRoutes.update;
export const DELETE = voteCrudRoutes.remove;
