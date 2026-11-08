import assert from "node:assert/strict";
import mongoose from "mongoose";
import test from "node:test";
import { compareAnnouncementEffectiveness } from "../lib/ai-intelligence/effectiveness";
import type { PopulatedIntelligenceIncident } from "../lib/ai-intelligence/analysis";

const residenceId = new mongoose.Types.ObjectId();
const announcementId = "announcement-1";
const publicationDate = new Date("2026-09-15T12:00:00.000Z");
const now = new Date("2026-11-02T12:00:00.000Z");

function incident(id: string, date: string): PopulatedIntelligenceIncident {
  return {
    _id: new mongoose.Types.ObjectId(id),
    title: "Fuite eau plafond cuisine appartement",
    description: "Une fuite eau au plafond de la cuisine près de la fenêtre.",
    category: "PLUMBING",
    priority: "MEDIUM",
    status: "REPORTED",
    reportedAt: new Date(date),
    residence: { _id: residenceId, name: "Résidence A" },
  };
}

test("effectiveness compares textually similar complaints in explicit 30-day windows without causation claims", () => {
  const result = compareAnnouncementEffectiveness({
    announcementId,
    title: "Information plomberie",
    publishedAt: publicationDate,
    seeds: [incident("650000000000000000000001", "2026-09-01T10:00:00.000Z")],
    candidates: [
      incident("650000000000000000000002", "2026-09-02T10:00:00.000Z"),
      incident("650000000000000000000003", "2026-09-20T10:00:00.000Z"),
    ],
    now,
  });
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.equal(result.beforeCount, 1);
  assert.equal(result.afterCount, 1);
  assert.equal(result.comparisonWindowDays, 30);
  assert.match(result.interpretation, /ne démontre pas/);
});

test("effectiveness reports insufficient data until the complete post-publication period ends", () => {
  const result = compareAnnouncementEffectiveness({
    announcementId,
    title: "Information plomberie",
    publishedAt: publicationDate,
    seeds: [incident("650000000000000000000001", "2026-09-01T10:00:00.000Z")],
    candidates: [],
    now: new Date("2026-10-01T10:00:00.000Z"),
  });
  assert.equal(result.status, "insufficient_data");
  assert.match(result.reason, /30 jours après/);
});

test("effectiveness reports insufficient data when there are too few similar complaints", () => {
  const result = compareAnnouncementEffectiveness({
    announcementId,
    title: "Information plomberie",
    publishedAt: publicationDate,
    seeds: [incident("650000000000000000000001", "2026-09-01T10:00:00.000Z")],
    candidates: [incident("650000000000000000000002", "2026-09-20T10:00:00.000Z")],
    now,
  });
  assert.equal(result.status, "insufficient_data");
  assert.ok("beforeCount" in result);
  assert.equal(result.beforeCount, 0);
  assert.equal(result.afterCount, 1);
});
