import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { resolve } from "node:path";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

const managedResidence = "650000000000000000000001";
let role = "ADMIN";
let databaseReads = 0;
let reportInput: Record<string, unknown> | null = null;
let reportShouldFail = true;
const findFilters: Array<Record<string, unknown>> = [];
let findResults: unknown[][] = [];

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
      return handler(request, user as never);
    },
    getSyndicResidenceIds: async () => [managedResidence],
  },
});

mock.module(pathToFileURL(resolve("lib/ai-intelligence/access.ts")).href, {
  namedExports: {
    resolveIntelligenceResidenceScope: async (user: { role: string }) =>
      user.role === "ADMIN" ? null : [managedResidence],
    residenceScopeFilter: (scope: string[] | null) =>
      scope === null ? {} : { residence: { $in: scope } },
  },
});

mock.module(pathToFileURL(resolve("models/Incident.ts")).href, {
  namedExports: {
    Incident: {
      find: (filter: Record<string, unknown>) => {
        databaseReads += 1;
        findFilters.push(filter);
        const result = findResults.shift() ?? [];
        return {
          sort() { return this; },
          limit() { return this; },
          select() { return this; },
          populate() { return this; },
          lean: async () => result,
        };
      },
      countDocuments: async (filter: Record<string, unknown>) => {
        databaseReads += 1;
        return filter.status === "RESOLVED" ? 2 : 4;
      },
    },
  },
});

mock.module(pathToFileURL(resolve("lib/ai/management-reports.ts")).href, {
  namedExports: {
    explainManagementReport: async (_userId: string, _kind: string, input: Record<string, unknown>) => {
      reportInput = input;
      if (reportShouldFail) throw new Error("Provider unavailable");
      return { summary: "Résumé", observations: [], recommendations: [] };
    },
  },
});

mock.module(pathToFileURL(resolve("lib/ai/redact.ts")).href, {
  namedExports: {
    redactPII: (text: string) => text.replace(/\b\d{8}\b/g, "[TEL]"),
  },
});

const route = import("../app/api/ai/briefing/route");

function reset(nextRole: string) {
  role = nextRole;
  databaseReads = 0;
  reportInput = null;
  reportShouldFail = true;
  findFilters.length = 0;
  findResults = [
    [{
      _id: "650000000000000000000010",
      title: "Fuite 12345678",
      reportedAt: new Date("2026-11-06T08:00:00.000Z"),
      residence: { name: "Résidence A" },
    }],
    [
      {
        _id: "650000000000000000000011",
        title: "Fuite eau plafond cuisine appartement",
        description: "Fuite eau plafond cuisine appartement",
        category: "PLUMBING",
        priority: "HIGH",
        status: "REPORTED",
        reportedAt: new Date("2026-11-05T08:00:00.000Z"),
        residence: { _id: managedResidence, name: "Résidence A" },
      },
      {
        _id: "650000000000000000000012",
        title: "Fuite eau plafond cuisine salon",
        description: "Fuite eau plafond cuisine salon",
        category: "PLUMBING",
        priority: "MEDIUM",
        status: "IN_PROGRESS",
        reportedAt: new Date("2026-11-05T09:00:00.000Z"),
        residence: { _id: managedResidence, name: "Résidence A" },
      },
    ],
  ];
}

test("briefing restricts access and keeps computed facts available when narrative generation fails", async () => {
  reset("RESIDENT");
  const { GET } = await route;
  const denied = await GET(new NextRequest("http://localhost/api/ai/briefing"));
  assert.equal(denied.status, 403);
  assert.equal(databaseReads, 0);

  reset("SYNDIC");
  const response = await GET(new NextRequest("http://localhost/api/ai/briefing?refresh=1"));
  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.facts.criticalUnassigned[0].title, "Fuite 12345678");
  assert.equal(body.facts.staleOverSevenDays, 4);
  assert.equal(body.facts.resolvedLast24h, 2);
  assert.equal(body.facts.recurring.length, 1);
  assert.equal(body.narrative, null);
  assert.equal(body.narrativeUnavailable, true);
  assert.ok(findFilters.length > 0);
  for (const filter of findFilters) {
    assert.deepEqual((filter.residence as { $in: string[] }).$in, [managedResidence]);
  }
  const criticalFilter = findFilters[0];
  assert.deepEqual(criticalFilter.$or, [
    { assignedTo: { $exists: false } },
    { assignedTo: null },
  ]);
  assert.equal(
    (reportInput?.criticalUnassigned as Array<{ title: string }>)[0].title,
    "Fuite [TEL]"
  );
});

test("briefing includes a valid AI narrative alongside independently computed facts", async () => {
  reset("ADMIN");
  reportShouldFail = false;
  const { GET } = await route;
  const response = await GET(new NextRequest("http://localhost/api/ai/briefing?refresh=1"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.narrative, {
    summary: "Résumé",
    observations: [],
    recommendations: [],
  });
  assert.equal(body.narrativeUnavailable, false);
  assert.equal(body.facts.staleOverSevenDays, 4);
  assert.ok(findFilters.every((filter) => !("residence" in filter)));
});
