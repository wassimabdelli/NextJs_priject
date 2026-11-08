import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAttentionRecommendations,
  detectCategoryTrends,
  detectRecurringProblems,
  type IntelligenceIncident,
} from "../lib/ai-intelligence/analysis";
import { DEFAULT_INCIDENT_OVERDUE_HOURS } from "../lib/incidents/constants";

const now = new Date("2026-11-02T12:00:00.000Z");

function incident(
  id: string,
  description: string,
  overrides: Partial<IntelligenceIncident> = {}
): IntelligenceIncident {
  return {
    id,
    title: "Problème signalé",
    description,
    category: "PLUMBING",
    priority: "MEDIUM",
    status: "REPORTED",
    reportedAt: new Date("2026-10-25T10:00:00.000Z"),
    residenceId: "residence-a",
    residenceName: "Résidence A",
    ...overrides,
  };
}

test("category trends report counts and evidence without claiming a recurring cause", () => {
  const trends = detectCategoryTrends([
    incident("1", "La porte du garage ne ferme pas"),
    incident("2", "Le robinet de la cuisine goutte", { category: "PLUMBING" }),
    incident("3", "Plusieurs ampoules sont eteintes", { category: "ELECTRICITY" }),
  ]);
  assert.equal(trends.length, 1);
  assert.equal(trends[0].category, "PLUMBING");
  assert.equal(trends[0].count, 2);
  assert.deepEqual(trends[0].incidentIds, ["1", "2"]);
  assert.equal(trends[0].detectionMethod, "category_count");
  assert.equal(trends[0].evidenceLevel, "category_only");
});

test("similar meaningful descriptions form a possible pattern with dates and location", () => {
  const patterns = detectRecurringProblems([
    incident("1", "fuite eau plafond cuisine appartement", {
      reportedAt: new Date("2026-10-20T10:00:00.000Z"),
      apartmentId: "lot-1",
      apartmentNumber: "12",
      apartmentFloor: 2,
    }),
    incident("2", "fuite eau plafond cuisine salon", {
      status: "IN_PROGRESS",
      priority: "HIGH",
      reportedAt: new Date("2026-10-25T10:00:00.000Z"),
      apartmentId: "lot-1",
      apartmentNumber: "12",
      apartmentFloor: 2,
    }),
  ]);
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].count, 2);
  assert.deepEqual(patterns[0].incidentIds, ["1", "2"]);
  assert.equal(patterns[0].category, "PLUMBING");
  assert.equal(patterns[0].residenceId, "residence-a");
  assert.equal(patterns[0].location, "Résidence A, Lot 12, étage 2");
  assert.equal(patterns[0].firstReportedAt, "2026-10-20T10:00:00.000Z");
  assert.equal(patterns[0].latestReportedAt, "2026-10-25T10:00:00.000Z");
  assert.equal(patterns[0].detectionMethod, "meaningful_text_overlap");
  assert.deepEqual(patterns[0].sharedTerms, ["cuisine", "eau", "fuite", "plafond"]);
});

test("multilingual descriptions can match through semantic embeddings", () => {
  const patterns = detectRecurringProblems([
    incident("1", "fuite d'eau au plafond", {
      embedding: [1, 0, 0],
    }),
    incident("2", "water leaking through the ceiling", {
      embedding: [0.99, 0.1, 0],
    }),
  ]);

  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].detectionMethod, "semantic_embedding");
  assert.deepEqual(patterns[0].incidentIds, ["1", "2"]);
});

test("three same-category complaints in one residence form a category-only lead", () => {
  const patterns = detectRecurringProblems([
    incident("1", "La porte du garage grince", { apartmentId: "lot-1" }),
    incident("2", "Le robinet de la cuisine goutte", { apartmentId: "lot-2" }),
    incident("3", "Le chauffage ne démarre plus", { apartmentId: "lot-3" }),
    incident("4", "Fuite dans la cave", { residenceId: "residence-b" }),
  ]);

  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].count, 3);
  assert.deepEqual(patterns[0].incidentIds, ["1", "2", "3"]);
  assert.equal(patterns[0].residenceId, "residence-a");
  assert.equal(patterns[0].detectionMethod, "category_count");
  assert.equal(patterns[0].evidenceLevel, "category_only");
  assert.deepEqual(patterns[0].sharedTerms, []);
});

test("generic wording alone does not produce a potential recurring problem", () => {
  const patterns = detectRecurringProblems([
    incident("1", "There is a problem in the building, please fix this"),
    incident("2", "There is a problem in the hallway, please check this"),
  ]);
  assert.deepEqual(patterns, []);
});

test("similar complaints from different residences are never clustered", () => {
  const patterns = detectRecurringProblems([
    incident("1", "fuite eau plafond cuisine appartement", { residenceId: "residence-a" }),
    incident("2", "fuite eau plafond cuisine appartement", { residenceId: "residence-b" }),
  ]);
  assert.deepEqual(patterns, []);
});

test("empty complaint data produces no trends or recurring patterns", () => {
  assert.deepEqual(detectCategoryTrends([]), []);
  assert.deepEqual(detectRecurringProblems([]), []);
  assert.deepEqual(buildAttentionRecommendations([], [], now), []);
});

test("attention recommendations explain existing priority and age evidence without inventing SLAs", () => {
  const urgent = incident("urgent", "fuite eau plafond cuisine appartement", {
    priority: "URGENT",
    reportedAt: new Date(now.getTime() - (DEFAULT_INCIDENT_OVERDUE_HOURS + 1) * 3_600_000),
  });
  const resolved = incident("resolved", "fuite eau plafond cuisine appartement", {
    priority: "URGENT",
    status: "RESOLVED",
    reportedAt: new Date(now.getTime() - 200 * 3_600_000),
  });
  const recommendations = buildAttentionRecommendations([urgent, resolved], [], now);
  assert.equal(recommendations.length, 2);
  assert.ok(recommendations.some((item) => item.type === "urgent_unresolved"));
  const aged = recommendations.find((item) => item.type === "aged_unresolved");
  assert.ok(aged?.explanation.includes(`${DEFAULT_INCIDENT_OVERDUE_HOURS} heures`));
  assert.ok(aged?.explanation.includes("pas un SLA"));
  assert.ok(recommendations.every((item) => !item.incidentIds.includes("resolved")));
});
