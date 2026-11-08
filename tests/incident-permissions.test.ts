import assert from "node:assert/strict";
import test from "node:test";
import {
  INCIDENT_CREATE_ROLES,
  INCIDENT_READ_ROLES,
  INCIDENT_RESOLUTION_SUBMISSION_ROLES,
  INCIDENT_WORKFLOW_ROLES,
  isResidenceManagedBySyndic,
  technicianIncidentScope,
} from "../lib/incidents/access-policy";
import { canTransition } from "../lib/incidents/workflow";
import { roleAccessStatus } from "../lib/role-access";
import { IncidentStatus, Role } from "../types/enums";

test("incident creation permits resident, admin, and syndic but denies technician with HTTP 403", () => {
  assert.deepEqual(INCIDENT_CREATE_ROLES, [Role.ADMIN, Role.SYNDIC, Role.RESIDENT]);
  assert.equal(roleAccessStatus(Role.RESIDENT, INCIDENT_CREATE_ROLES), null);
  assert.equal(roleAccessStatus(Role.ADMIN, INCIDENT_CREATE_ROLES), null);
  assert.equal(roleAccessStatus(Role.SYNDIC, INCIDENT_CREATE_ROLES), null);
  assert.equal(roleAccessStatus(Role.TECHNICIAN, INCIDENT_CREATE_ROLES), 403);
});

test("syndics may create incidents only within their managed residences", () => {
  const managedResidences = ["residence-1", "residence-2"];
  assert.equal(isResidenceManagedBySyndic("residence-1", managedResidences), true);
  assert.equal(isResidenceManagedBySyndic("residence-3", managedResidences), false);
});

test("technicians retain read access scoped to incidents assigned to them", () => {
  assert.deepEqual(INCIDENT_READ_ROLES, [
    Role.ADMIN,
    Role.SYNDIC,
    Role.RESIDENT,
    Role.TECHNICIAN,
  ]);
  assert.ok(INCIDENT_READ_ROLES.some((role) => role === Role.TECHNICIAN));
  assert.deepEqual(technicianIncidentScope("technician-id"), {
    assignedTo: "technician-id",
  });
});

test("technicians retain permission to submit intervention and resolution information", () => {
  assert.ok(INCIDENT_RESOLUTION_SUBMISSION_ROLES.some((role) => role === Role.TECHNICIAN));
});

test("technicians retain permitted workflow transitions", () => {
  assert.ok(INCIDENT_WORKFLOW_ROLES.some((role) => role === Role.TECHNICIAN));
  assert.equal(canTransition(IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS), true);
  assert.equal(canTransition(IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED), true);
  assert.equal(canTransition(IncidentStatus.REPORTED, IncidentStatus.RESOLVED), false);
});
