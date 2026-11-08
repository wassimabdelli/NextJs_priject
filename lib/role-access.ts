import type { Role } from "@/types/enums";

export function roleAccessStatus(
  role: Role,
  allowedRoles: readonly Role[]
): 403 | null {
  return allowedRoles.includes(role) ? null : 403;
}
