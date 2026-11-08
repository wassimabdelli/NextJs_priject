import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { resolve } from "node:path";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

const userId = "650000000000000000000099";
const residenceId = "650000000000000000000001";
let role = "SYNDIC";
let scopedResidences: string[] | null = [residenceId];
let failResidents = false;
let failIncidents = false;
let failPrevious = false;
let incidentPipeline: unknown[] = [];

class MockHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

mock.module(pathToFileURL(resolve("lib/api.ts")).href, {
  namedExports: {
    HttpError: MockHttpError,
    isValidObjectId: (id: string | null | undefined) => Boolean(id && /^[a-f\d]{24}$/i.test(id)),
    json: (body: unknown, status = 200) => Response.json(body, { status }),
  },
});

mock.module(pathToFileURL(resolve("lib/auth-guard.ts")).href, {
  namedExports: {
    withAuth: (
      handler: (request: NextRequest, user: { id: string; role: string }) => Promise<Response>,
      options?: { roles?: string[] }
    ) => async (request: NextRequest) => {
      const user = { id: userId, role };
      if (options?.roles && !options.roles.includes(user.role)) {
        return Response.json({ error: "Accès interdit" }, { status: 403 });
      }
      try {
        return await handler(request, user);
      } catch (error) {
        if (error instanceof MockHttpError) {
          return Response.json({ error: error.message }, { status: error.status });
        }
        throw error;
      }
    },
  },
});

mock.module(pathToFileURL(resolve("lib/announcements/access.ts")).href, {
  namedExports: {
    getAnnouncementResidenceIds: async () => scopedResidences,
  },
});

mock.module(pathToFileURL(resolve("lib/announcements/readStats.ts")).href, {
  namedExports: {
    getEligibleResidentIdsByResidence: async () => {
      if (failResidents) throw new Error("resident lookup failed");
      return new Map([[residenceId, new Set(["r1", "r2", "r3"])]]);
    },
  },
});

mock.module(pathToFileURL(resolve("models/Incident.ts")).href, {
  namedExports: {
    Incident: {
      aggregate: async (pipeline: unknown[]) => {
        incidentPipeline = pipeline;
        if (failIncidents) throw new Error("incident lookup failed");
        return [
          { _id: "PLUMBING", count: 3 },
          { _id: "ELEVATOR", count: 1 },
          { _id: "UNKNOWN", count: 10 },
        ];
      },
    },
  },
});

mock.module(pathToFileURL(resolve("models/Announcement.ts")).href, {
  namedExports: {
    Announcement: {
      findOne: (filter: Record<string, unknown>) => {
        assert.equal(String(filter.residence), residenceId);
        assert.equal(filter.category, "MAINTENANCE");
        assert.equal(filter.status, "PUBLISHED");
        const query = {
          sort(value: unknown) { assert.deepEqual(value, { publishedAt: -1 }); return this; },
          select(value: string) { assert.equal(value, "title publishedAt"); return this; },
          lean: async () => {
            if (failPrevious) throw new Error("announcement lookup failed");
            return { title: "Travaux planifiés", publishedAt: new Date("2026-10-25T10:00:00Z") };
          },
        };
        return query;
      },
    },
  },
});

const route = import("../app/api/ai/announcements/context/route");

function request(category = "MAINTENANCE", id = residenceId) {
  return new NextRequest(
    `http://localhost/api/ai/announcements/context?residenceId=${id}${category ? `&category=${category}` : ""}`
  );
}

test("announcement context returns verified, localized facts for an authorized residence", async () => {
  role = "SYNDIC";
  scopedResidences = [residenceId];
  failResidents = false;
  failIncidents = false;
  failPrevious = false;
  const { GET } = await route;
  const response = await GET(request());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.facts.length, 4);
  assert.equal(body.facts[0].label, "3 résidents actifs seront concernés");
  assert.match(body.facts[1].label, /3 réclamations ouvertes en plomberie dans cette résidence/);
  assert.match(body.facts[2].label, /1 réclamation ouverte en ascenseur dans cette résidence/);
  assert.match(body.facts[3].label, /Dernière annonce de cette catégorie : « Travaux planifiés » le /);
  assert.equal((incidentPipeline[0] as { $match: { status: { $ne: string } } }).$match.status.$ne, "RESOLVED");

  scopedResidences = [];
  const forbidden = await GET(request());
  assert.equal(forbidden.status, 403);
});

test("announcement context independently skips facts when lookups fail and validates inputs", async () => {
  role = "ADMIN";
  scopedResidences = null;
  failResidents = true;
  failIncidents = true;
  failPrevious = true;
  const { GET } = await route;
  const response = await GET(request());
  assert.deepEqual(await response.json(), { facts: [] });

  const invalidId = await GET(request("MAINTENANCE", "invalid"));
  assert.equal(invalidId.status, 400);
  const invalidCategory = await GET(request("NOT_A_CATEGORY"));
  assert.equal(invalidCategory.status, 400);

  failResidents = false;
  failIncidents = false;
  failPrevious = false;
});
