import { meetingCrudRoutes } from "@/lib/crud/meetings";

export const GET = meetingCrudRoutes.getOne;
export const PATCH = meetingCrudRoutes.update;
export const DELETE = meetingCrudRoutes.remove;
