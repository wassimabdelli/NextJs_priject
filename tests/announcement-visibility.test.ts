import assert from "node:assert/strict";
import test from "node:test";
import { isAnnouncementVisible } from "@/lib/announcements/visibility";
import { AnnouncementAudience, AnnouncementStatus, Role } from "@/types/enums";

const now = new Date("2026-10-31T12:00:00.000Z");

test("announcement visibility enforces audience role", () => {
  assert.equal(isAnnouncementVisible({
    status: AnnouncementStatus.PUBLISHED,
    audience: AnnouncementAudience.TECHNICIANS,
  }, Role.RESIDENT, now), false);
  assert.equal(isAnnouncementVisible({
    status: AnnouncementStatus.PUBLISHED,
    audience: AnnouncementAudience.RESIDENTS,
  }, Role.TECHNICIAN, now), false);
  assert.equal(isAnnouncementVisible({
    status: AnnouncementStatus.PUBLISHED,
    audience: AnnouncementAudience.ALL,
  }, Role.TECHNICIAN, now), true);
});

test("drafts, future announcements, and expired announcements are hidden", () => {
  assert.equal(isAnnouncementVisible({
    status: AnnouncementStatus.DRAFT,
    audience: AnnouncementAudience.ALL,
  }, Role.ADMIN, now), false);
  assert.equal(isAnnouncementVisible({
    status: AnnouncementStatus.PUBLISHED,
    scheduledAt: "2026-10-31T12:01:00.000Z",
  }, Role.RESIDENT, now), false);
  assert.equal(isAnnouncementVisible({
    status: AnnouncementStatus.PUBLISHED,
    expiresAt: "2026-10-31T12:00:00.000Z",
  }, Role.RESIDENT, now), false);
});
