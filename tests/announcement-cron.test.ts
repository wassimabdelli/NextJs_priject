import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { resolve } from "node:path";
import { after, mock, test } from "node:test";
import { pathToFileURL } from "node:url";

type AnnouncementRecord = {
  _id: string;
  status: string;
  scheduledAt: Date;
  publishedAt?: Date;
  expiresAt?: Date | null;
  intelligenceSource?: { reviewStatus: string };
};

const announcements: AnnouncementRecord[] = [];
let connectCalls = 0;
let notificationCalls = 0;
let failNotifications = false;

function matchesDueAnnouncement(
  announcement: AnnouncementRecord,
  filter: Record<string, unknown>
) {
  const scheduledAt = filter.scheduledAt as { $lte: Date };
  const status = filter.status;
  const isApprovedOrRegular = !announcement.intelligenceSource
    || announcement.intelligenceSource.reviewStatus === "APPROVED";
  return (
    announcement.status === status &&
    announcement.scheduledAt <= scheduledAt.$lte &&
    (!announcement.expiresAt || announcement.expiresAt > scheduledAt.$lte) &&
    isApprovedOrRegular
  );
}

mock.module(pathToFileURL(resolve("lib/db.ts")).href, {
  namedExports: {
    connectDB: async () => {
      connectCalls += 1;
    },
  },
});

mock.module(pathToFileURL(resolve("models/Announcement.ts")).href, {
  namedExports: {
    Announcement: {
      find(filter: Record<string, unknown>) {
        return {
          select() {
            return {
              lean: async () => announcements
                .filter((announcement) => matchesDueAnnouncement(announcement, filter))
                .map(({ _id }) => ({ _id })),
            };
          },
        };
      },
      findOneAndUpdate(filter: Record<string, unknown>) {
        return {
          lean: async () => {
            const announcement = announcements.find(
              (item) =>
                item._id === String(filter._id) &&
                matchesDueAnnouncement(item, filter)
            );
            if (!announcement) return null;
            announcement.status = "PUBLISHED";
            announcement.publishedAt = announcement.scheduledAt;
            return { ...announcement };
          },
        };
      },
    },
  },
});

mock.module(pathToFileURL(resolve("lib/notifications/events.ts")).href, {
  namedExports: {
    notifyAnnouncementPublished: async () => {
      notificationCalls += 1;
      if (failNotifications) throw new Error("mock publication notification failure");
    },
  },
});

const cronRoute = import("../app/api/cron/publish-announcements/route");
const vercelCronRoute = import("../app/api/cron/vercel-publish-announcements/route");

const originalCronSecret = process.env.CRON_SECRET;

function makeRequest(authorization?: string) {
  return new NextRequest("http://localhost/api/cron/publish-announcements", {
    method: "POST",
    headers: authorization ? { authorization } : undefined,
  });
}

function setAnnouncements(records: AnnouncementRecord[]) {
  announcements.splice(0, announcements.length, ...records);
  connectCalls = 0;
  notificationCalls = 0;
  failNotifications = false;
}

after(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
});

test("missing CRON_SECRET returns 401 without connecting to the database", async () => {
  const { POST } = await cronRoute;
  delete process.env.CRON_SECRET;
  setAnnouncements([]);

  const response = await POST(makeRequest("Bearer some-secret"));

  assert.equal(response.status, 401);
  assert.equal(connectCalls, 0);
});

test("invalid authorization returns 401", async () => {
  const { POST } = await cronRoute;
  process.env.CRON_SECRET = "expected-secret";
  setAnnouncements([]);

  const response = await POST(makeRequest("Bearer invalid-secret"));

  assert.equal(response.status, 401);
  assert.equal(connectCalls, 0);
});

test("valid authorization runs publication and publishes only due announcements", async () => {
  const { POST } = await cronRoute;
  process.env.CRON_SECRET = "expected-secret";
  const now = Date.now();
  setAnnouncements([
    {
      _id: "due",
      status: "SCHEDULED",
      scheduledAt: new Date(now - 60_000),
    },
    {
      _id: "future",
      status: "SCHEDULED",
      scheduledAt: new Date(now + 60 * 60_000),
    },
  ]);

  const response = await POST(makeRequest("Bearer expected-secret"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(connectCalls, 1);
  assert.equal(body.publishedCount, 1);
  assert.equal(announcements[0].status, "PUBLISHED");
  assert.equal(announcements[1].status, "SCHEDULED");
  assert.equal(notificationCalls, 1);
});

test("repeated authorized scheduler calls do not publish the same announcement twice", async () => {
  const { POST } = await cronRoute;
  process.env.CRON_SECRET = "expected-secret";
  setAnnouncements([
    {
      _id: "due",
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() - 60_000),
    },
  ]);

  const firstResponse = await POST(makeRequest("Bearer expected-secret"));
  const secondResponse = await POST(makeRequest("Bearer expected-secret"));
  const firstBody = await firstResponse.json();
  const secondBody = await secondResponse.json();

  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);
  assert.equal(firstBody.publishedCount, 1);
  assert.equal(secondBody.publishedCount, 0);
  assert.equal(notificationCalls, 1);
  assert.equal(announcements[0].status, "PUBLISHED");
});

test("a future announcement is not published early", async () => {
  const { POST } = await cronRoute;
  process.env.CRON_SECRET = "expected-secret";
  setAnnouncements([
    {
      _id: "future",
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() + 60 * 60_000),
    },
  ]);

  const response = await POST(makeRequest("Bearer expected-secret"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.publishedCount, 0);
  assert.equal(announcements[0].status, "SCHEDULED");
  assert.equal(notificationCalls, 0);
});

test("the scheduler never publishes or notifies an unapproved AI suggestion", async () => {
  const { POST } = await cronRoute;
  const cronSecret = `test-secret-${Date.now()}`;
  process.env.CRON_SECRET = cronSecret;
  setAnnouncements([
    {
      _id: "unapproved-ai",
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() - 60_000),
      intelligenceSource: { reviewStatus: "UNDER_REVIEW" },
    },
  ]);

  const response = await POST(makeRequest(`Bearer ${cronSecret}`));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.publishedCount, 0);
  assert.equal(announcements[0].status, "SCHEDULED");
  assert.equal(notificationCalls, 0);
});

test("the POST endpoint does not expose a GET handler", async () => {
  const route = await cronRoute;
  assert.equal("GET" in route, false);
});

test("Vercel GET adapter forwards authorized calls to the existing POST endpoint", async () => {
  const { GET } = await vercelCronRoute;
  process.env.CRON_SECRET = "expected-secret";
  setAnnouncements([
    {
      _id: "due",
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() - 60_000),
    },
  ]);
  const request = new NextRequest(
    "http://localhost/api/cron/vercel-publish-announcements",
    { headers: { authorization: "Bearer expected-secret" } }
  );

  const response = await GET(request);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.publishedCount, 1);
  assert.equal(connectCalls, 1);
});

test("unauthorized Vercel GET adapter calls do not connect to MongoDB", async () => {
  const { GET } = await vercelCronRoute;
  process.env.CRON_SECRET = "expected-secret";
  setAnnouncements([]);
  const request = new NextRequest(
    "http://localhost/api/cron/vercel-publish-announcements"
  );

  const response = await GET(request);

  assert.equal(response.status, 401);
  assert.equal(connectCalls, 0);
});

test("publication errors return 500 without exposing the secret", async () => {
  const { POST } = await cronRoute;
  const secret = "very-private-cron-secret";
  process.env.CRON_SECRET = secret;
  setAnnouncements([
    {
      _id: "due",
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() - 60_000),
    },
  ]);
  failNotifications = true;
  const logged: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => logged.push(args);

  try {
    const response = await POST(makeRequest(`Bearer ${secret}`));
    const responseText = await response.text();

    assert.equal(response.status, 500);
    assert.equal(responseText.includes(secret), false);
    assert.equal(JSON.stringify(logged).includes(secret), false);
    assert.deepEqual(logged, [["[cron] Announcement publication failed"]]);
  } finally {
    console.error = originalConsoleError;
  }
});
