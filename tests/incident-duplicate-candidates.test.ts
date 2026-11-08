import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import {
  buildDuplicateCandidateFilter,
  canSearchDuplicateResidence,
} from "../lib/ai/duplicate-candidate-policy";
import { IncidentStatus, Role } from "../types/enums";

const residenceId = "650000000000000000000001";
const sourceId = "650000000000000000000002";
const relatedId = "650000000000000000000003";
const dismissedId = "650000000000000000000004";

type Candidate = {
  _id: mongoose.Types.ObjectId;
  residence: mongoose.Types.ObjectId;
  reportedAt: Date;
  status: string;
  reportedBy?: string;
  assignedTo?: string;
};

function matchesCandidateFilter(
  candidate: Candidate,
  filter: ReturnType<typeof buildDuplicateCandidateFilter>
) {
  const since = filter.reportedAt.$gte;
  if (!candidate.residence.equals(filter.residence)) return false;
  if (candidate.reportedAt < since) return false;
  if (candidate.status === filter.status.$ne) return false;
  const idFilter = filter._id;
  if (idFilter) {
    if (candidate._id.equals(idFilter.$ne)) return false;
    if (idFilter.$nin.some((id) => candidate._id.equals(id))) return false;
  }
  return true;
}

function candidate(
  id: string,
  fields: Partial<Candidate> = {}
): Candidate {
  return {
    _id: new mongoose.Types.ObjectId(id),
    residence: new mongoose.Types.ObjectId(residenceId),
    reportedAt: new Date(),
    status: IncidentStatus.IN_PROGRESS,
    ...fields,
  };
}

test("resident duplicate search includes another resident's incident in the same residence", () => {
  const filter = buildDuplicateCandidateFilter({ residenceId, excludeIds: [] });
  const otherResidentIncident = candidate("650000000000000000000010", {
    reportedBy: "650000000000000000000011",
  });

  assert.equal(matchesCandidateFilter(otherResidentIncident, filter), true);
  assert.equal("reportedBy" in filter, false);
});

test("technician duplicate search includes incidents assigned to other technicians in the residence", () => {
  const filter = buildDuplicateCandidateFilter({ residenceId, excludeIds: [] });
  const otherTechnicianIncident = candidate("650000000000000000000012", {
    assignedTo: "650000000000000000000013",
  });

  assert.equal(matchesCandidateFilter(otherTechnicianIncident, filter), true);
  assert.equal("assignedTo" in filter, false);
});

test("resident cannot search a residence outside their authorized scope", () => {
  assert.equal(
    canSearchDuplicateResidence(Role.RESIDENT, residenceId, ["650000000000000000000020"]),
    false
  );
  assert.equal(canSearchDuplicateResidence(Role.RESIDENT, residenceId, [residenceId]), true);
});

test("technician cannot search a residence outside their authorized scope", () => {
  assert.equal(
    canSearchDuplicateResidence(Role.TECHNICIAN, residenceId, ["650000000000000000000021"]),
    false
  );
  assert.equal(
    canSearchDuplicateResidence(Role.TECHNICIAN, residenceId, [residenceId]),
    true
  );
});

test("resolved incidents are excluded from duplicate candidates", () => {
  const filter = buildDuplicateCandidateFilter({ residenceId, excludeIds: [] });
  assert.equal(
    matchesCandidateFilter(
      candidate("650000000000000000000014", { status: IncidentStatus.RESOLVED }),
      filter
    ),
    false
  );
  assert.equal(filter.status.$ne, IncidentStatus.RESOLVED);
});

test("incidents older than the 90-day search window are excluded", () => {
  const filter = buildDuplicateCandidateFilter({ residenceId, excludeIds: [] });
  const olderIncident = candidate("650000000000000000000016", {
    reportedAt: new Date(filter.reportedAt.$gte.getTime() - 1),
  });
  const incidentAtCutoff = candidate("650000000000000000000017", {
    reportedAt: filter.reportedAt.$gte,
  });

  assert.equal(matchesCandidateFilter(olderIncident, filter), false);
  assert.equal(matchesCandidateFilter(incidentAtCutoff, filter), true);
});

test("a source incident is excluded from its own duplicate results", () => {
  const filter = buildDuplicateCandidateFilter({ residenceId, incidentId: sourceId, excludeIds: [] });
  assert.equal(matchesCandidateFilter(candidate(sourceId), filter), false);
});

test("related and dismissed duplicate incidents remain excluded", () => {
  const excludedIds = [new mongoose.Types.ObjectId(relatedId), new mongoose.Types.ObjectId(dismissedId)];
  const filter = buildDuplicateCandidateFilter({
    residenceId,
    incidentId: sourceId,
    excludeIds: excludedIds,
  });

  assert.equal(matchesCandidateFilter(candidate(relatedId), filter), false);
  assert.equal(matchesCandidateFilter(candidate(dismissedId), filter), false);
  assert.equal(matchesCandidateFilter(candidate("650000000000000000000015"), filter), true);
});
