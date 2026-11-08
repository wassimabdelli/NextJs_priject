import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import { resolve } from "node:path";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { Role } from "../types/enums";

const residenceId = "650000000000000000000001";
const candidateId = "650000000000000000000010";
const testUser: { id: string; role: Role } = {
  id: "650000000000000000000020",
  role: Role.RESIDENT,
};
let authorizedResidenceIds = [residenceId];
let input = { residenceId, title: "Fuite", description: "Fuite dans le plafond" };
let searchArguments: Record<string, unknown> | undefined;

mock.module(pathToFileURL(resolve("lib/api.ts")).href, {
  namedExports: {
    HttpError: class HttpError extends Error {
      constructor(public status: number, message: string) {
        super(message);
      }
    },
    handle: async (handler: () => Promise<Response>) => {
      try {
        return await handler();
      } catch (error) {
        if (error instanceof Error && "status" in error) {
          return NextResponse.json(
            { error: error.message },
            { status: Number(error.status) }
          );
        }
        throw error;
      }
    },
    json: (body: unknown, status = 200) =>
      NextResponse.json(body, { status }),
    parseBody: async () => input,
  },
});

mock.module(pathToFileURL(resolve("lib/auth-guard.ts")).href, {
  namedExports: {
    withAuth: (handler: (request: NextRequest, user: typeof testUser) => Promise<Response>) =>
      async (request: NextRequest) => {
        try {
          return await handler(request, testUser);
        } catch (error) {
          if (error instanceof Error && "status" in error) {
            return NextResponse.json(
              { error: error.message },
              { status: Number(error.status) }
            );
          }
          throw error;
        }
      },
    getResidentResidenceIds: async () => authorizedResidenceIds,
    getSyndicResidenceIds: async () => authorizedResidenceIds,
    getTechnicianResidenceIds: async () => authorizedResidenceIds,
  },
});

mock.module(pathToFileURL(resolve("models/Incident.ts")).href, {
  namedExports: { Incident: {} },
});

mock.module(pathToFileURL(resolve("lib/ai/similarity.ts")).href, {
  namedExports: {
    findSimilarIncidents: async (args: Record<string, unknown>) => {
      searchArguments = args;
      return [{
        id: candidateId,
        title: "Fuite dans le plafond",
        description: "Une autre unité constate une fuite.",
        status: "IN_PROGRESS",
        createdAt: new Date(),
        score: 0.9,
        method: "embedding",
      }];
    },
  },
});

mock.module(pathToFileURL(resolve("lib/ai/duplicate-detector.ts")).href, {
  namedExports: {
    similarityScore: () => 0.9,
    explainDuplicates: async (_userId: string, _source: unknown, candidates: Array<{ incidentId: string }>) => ({
      matches: candidates.map(({ incidentId }) => ({
        incidentId,
        similar: true,
        explanation: "Même fuite signalée dans la résidence.",
      })),
    }),
  },
});

mock.module(pathToFileURL(resolve("lib/ai/schemas.ts")).href, {
  namedExports: { duplicatesInputSchema: {} },
});

const duplicateRoute = import("../app/api/ai/incidents/duplicates/route");

function reset(role: Role, allowedResidences: string[]) {
  testUser.role = role;
  authorizedResidenceIds = allowedResidences;
  input = { residenceId, title: "Fuite", description: "Fuite dans le plafond" };
  searchArguments = undefined;
}

async function post() {
  const { POST } = await duplicateRoute;
  return POST(new NextRequest("http://localhost/api/ai/incidents/duplicates", {
    method: "POST",
    body: "{}",
    headers: { "content-type": "application/json" },
  }));
}

test("resident duplicate route searches other residents' candidates across the authorized residence", async () => {
  reset(Role.RESIDENT, [residenceId]);

  const response = await post();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.possibleDuplicates[0].incidentId, candidateId);
  assert.deepEqual(searchArguments?.scopeFilter, {});
});

test("technician duplicate route searches incidents assigned to other technicians in the residence", async () => {
  reset(Role.TECHNICIAN, [residenceId]);

  const response = await post();

  assert.equal(response.status, 200);
  assert.deepEqual(searchArguments?.scopeFilter, {});
});

test("duplicate route rejects a residence outside the user's authorized scope", async () => {
  reset(Role.RESIDENT, ["650000000000000000000030"]);

  const response = await post();

  assert.equal(response.status, 403);
  assert.equal(searchArguments, undefined);
});
