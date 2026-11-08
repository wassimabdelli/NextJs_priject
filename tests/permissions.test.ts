import assert from "node:assert/strict";
import test from "node:test";
import { can, isRouteAllowed } from "@/lib/permissions";
import { Role } from "@/types/enums";

test("known page routes preserve role-specific permissions", () => {
  assert.equal(isRouteAllowed("/dashboard", Role.TECHNICIAN), true);
  assert.equal(isRouteAllowed("/residences", Role.RESIDENT), false);
  assert.equal(isRouteAllowed("/residences/123", Role.SYNDIC), true);
  assert.equal(isRouteAllowed("/activity", Role.RESIDENT), true);
  assert.equal(isRouteAllowed("/api-docs", Role.TECHNICIAN), false);
});

test("resource permissions remain role-bound", () => {
  assert.equal(can(Role.RESIDENT, "create", "incident"), true);
  assert.equal(can(Role.RESIDENT, "delete", "incident"), false);
  assert.equal(can(Role.TECHNICIAN, "update", "incident"), true);
  assert.equal(can(Role.TECHNICIAN, "create", "announcement"), false);
  assert.equal(can(Role.ADMIN, "delete", "announcement"), true);
});
