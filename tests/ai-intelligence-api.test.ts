import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { resolve } from "node:path";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

const managedResidence = "650000000000000000000001";
let role = "ADMIN";
let databaseReads = 0;
const capturedIncidentFilters: Array<Record<string, unknown>> = [];

mock.module(pathToFileURL(resolve("lib/api.ts")).href, {
  namedExports: {
    HttpError: class HttpError extends Error {
      constructor(public status: number, message: string) {
        super(message);
      }
    },
    json: (body: unknown, status = 200) => Response.json(body, { status }),
  },
});

mock.module(pathToFileURL(resolve("lib/auth-guard.ts")).href, {
  namedExports: {
    withAuth: (
      handler: (request: NextRequest, user: { id: string; role: string }) => Promise<Response>,
      options?: { roles?: string[] }
    ) => async (request: NextRequest) => {
      const user = { id: "650000000000000000000099", role };
      if (options?.roles && !options.roles.includes(user.role)) {
        return Response.json({ error: "Accès interdit" }, { status: 403 });
      }
      try {
        return await handler(request, user as never);
      } catch (error) {
        const status = error && typeof error === "object" && "status" in error
          ? Number(error.status)
          : 500;
        return Response.json({ error: error instanceof Error ? error.message : "Erreur" }, { status });
      }
    },
    getSyndicResidenceIds: async () => [managedResidence],
  },
});

mock.module(pathToFileURL(resolve("models/Residence.ts")).href, {
  namedExports: {
    Residence: {
      exists: async () => true,
      find: () => ({
        select() { return this; },
        sort() { return this; },
        limit() { return this; },
        lean: async () => [],
      }),
    },
  },
});

mock.module(pathToFileURL(resolve("models/Announcement.ts")).href, {
  namedExports: {
    Announcement: {
      countDocuments: async () => 0,
      find: () => ({
        sort() { return this; },
        limit() { return this; },
        select() { return this; },
        lean: async () => [],
      }),
    },
  },
});

mock.module(pathToFileURL(resolve("models/Incident.ts")).href, {
  namedExports: {
    Incident: {
      countDocuments: async (filter: Record<string, unknown>) => {
        databaseReads += 1;
        capturedIncidentFilters.push(filter);
        return 0;
      },
      aggregate: async (pipeline: Array<{ $match?: Record<string, unknown> }>) => {
        databaseReads += 1;
        const match = pipeline.find((stage) => stage.$match)?.$match;
        if (match) capturedIncidentFilters.push(match);
        return [];
      },
      find: (filter: Record<string, unknown>) => {
        databaseReads += 1;
        capturedIncidentFilters.push(filter);
        return {
          sort() { return this; },
          limit() { return this; },
          select() { return this; },
          populate() { return this; },
          lean: async () => [],
        };
      },
    },
  },
});

const analyticsRoute = import("../app/api/ai/intelligence/analytics/route");

function reset(roleName: string) {
  role = roleName;
  databaseReads = 0;
  capturedIncidentFilters.length = 0;
}

test("analytics API denies non-management roles before reading complaint data", async () => {
  reset("RESIDENT");
  const { GET } = await analyticsRoute;
  const response = await GET(new NextRequest("http://localhost/api/ai/intelligence/analytics"));
  assert.equal(response.status, 403);
  assert.equal(databaseReads, 0);
});

test("syndic analytics rejects requests for a residence outside the managed scope", async () => {
  reset("SYNDIC");
  const { GET } = await analyticsRoute;
  const response = await GET(new NextRequest(
    "http://localhost/api/ai/intelligence/analytics?residence=650000000000000000000002"
  ));
  assert.equal(response.status, 403);
  assert.equal(databaseReads, 0);
});

test("syndic analytics constrains every complaint query to managed residences", async () => {
  reset("SYNDIC");
  const { GET } = await analyticsRoute;
  const response = await GET(new NextRequest("http://localhost/api/ai/intelligence/analytics"));
  assert.equal(response.status, 200, await response.clone().text());
  const body = await response.json();
  assert.deepEqual(body.data.metrics, {
    openComplaints: 0,
    attentionCount: 0,
    recurringPatternsCount: 0,
    recentComplaintCount: 0,
    publishedAnnouncementsCount: 0,
  });
  assert.deepEqual(body.data.categories, []);
  assert.deepEqual(body.data.statuses, []);
  assert.deepEqual(body.data.attentionComplaints, []);
  assert.deepEqual(body.data.comparison, {
    currentComplaintCount: 0,
    previousComplaintCount: 0,
    change: 0,
    changePercent: null,
  });
  assert.ok(capturedIncidentFilters.length > 0);
  for (const filter of capturedIncidentFilters) {
    const residence = filter.residence as { $in?: Array<{ toString(): string }> } | undefined;
    assert.ok(residence?.$in);
    assert.deepEqual(residence.$in.map(String), [managedResidence]);
  }
});

test("admin analytics use the authorized global scope unless a residence filter is requested", async () => {
  reset("ADMIN");
  const { GET } = await analyticsRoute;
  const response = await GET(new NextRequest("http://localhost/api/ai/intelligence/analytics"));
  assert.equal(response.status, 200);
  assert.ok(capturedIncidentFilters.length > 0);
  assert.ok(capturedIncidentFilters.every((filter) => !("residence" in filter)));
});

test("analytics accepts today's date and caps the end time at now", async () => {
  reset("ADMIN");
  const { GET } = await analyticsRoute;
  const today = new Date().toISOString().slice(0, 10);
  const response = await GET(new NextRequest(
    `http://localhost/api/ai/intelligence/analytics?from=${today}&to=${today}`
  ));
  assert.equal(response.status, 200, await response.clone().text());
  const body = await response.json();
  const endTime = new Date(body.data.period.to).getTime();
  assert.ok(endTime <= Date.now());
  assert.ok(endTime >= Date.now() - 5_000);
});

test("analytics rejects a future calendar date", async () => {
  reset("ADMIN");
  const { GET } = await analyticsRoute;
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const response = await GET(new NextRequest(
    `http://localhost/api/ai/intelligence/analytics?to=${tomorrow}`
  ));
  assert.equal(response.status, 400);
  assert.equal(databaseReads, 0);
});
