import assert from "node:assert/strict";
import test from "node:test";
import { canTransition, nextIncidentStatus } from "@/lib/incidents/workflow";
import { IncidentStatus } from "@/types/enums";

test("incident workflow permits only the next lifecycle transition", () => {
  assert.equal(canTransition(IncidentStatus.REPORTED, IncidentStatus.ASSIGNED), true);
  assert.equal(canTransition(IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS), true);
  assert.equal(canTransition(IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED), true);
  assert.equal(canTransition(IncidentStatus.REPORTED, IncidentStatus.RESOLVED), false);
  assert.equal(canTransition(IncidentStatus.RESOLVED, IncidentStatus.REPORTED), false);
});

test("resolved is terminal and other statuses expose their next stage", () => {
  assert.equal(nextIncidentStatus(IncidentStatus.REPORTED), IncidentStatus.ASSIGNED);
  assert.equal(nextIncidentStatus(IncidentStatus.ASSIGNED), IncidentStatus.IN_PROGRESS);
  assert.equal(nextIncidentStatus(IncidentStatus.IN_PROGRESS), IncidentStatus.RESOLVED);
  assert.equal(nextIncidentStatus(IncidentStatus.RESOLVED), null);
});
