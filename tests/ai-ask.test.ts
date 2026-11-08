import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { resolve } from "node:path";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

const userId = "650000000000000000000099";
const residenceId = "650000000000000000000001";
const matchingId = "650000000000000000000010";
const unrelatedId = "650000000000000000000011";
let role = "ADMIN";
let rows: Array<Record<string, unknown>> = [];
let incidentFilter: Record<string, unknown> | null = null;
let generated = false;
let generatedPrompt = "";
let returnedSourceIds = [matchingId, "not-an-authorized-source", matchingId];
let embeddingBudgetCalls = 0;

mock.module(pathToFileURL(resolve("lib/api.ts")).href, {
  namedExports: {
    HttpError: class HttpError extends Error {
      constructor(public status: number, message: string) {
        super(message);
      }
    },
    json: (body: unknown, status = 200) => Response.json(body, { status }),
    parseBody: async (request: Request, schema: { parse(value: unknown): unknown }) =>
      schema.parse(await request.json()),
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
      return handler(request, user as never);
    },
    getResidentResidenceIds: async () => [residenceId],
    getSyndicResidenceIds: async () => [residenceId],
    getTechnicianResidenceIds: async () => [residenceId],
  },
});

mock.module(pathToFileURL(resolve("lib/ai/embedding-budget.ts")).href, {
  namedExports: {
    assertEmbeddingBudget: () => { embeddingBudgetCalls += 1; },
  },
});

mock.module(pathToFileURL(resolve("lib/ai/gemini.ts")).href, {
  namedExports: {
    embedText: async () => [1, 0],
  },
});

mock.module(pathToFileURL(resolve("lib/ai/provider.ts")).href, {
  namedExports: {
    generateValidated: async (_userId: string, _operation: string, _schema: unknown, prompt: string) => {
      generated = true;
      generatedPrompt = prompt;
      return { answer: "Une fuite est encore en cours.", sourceIds: returnedSourceIds };
    },
  },
});

mock.module(pathToFileURL(resolve("lib/ai/prompts.ts")).href, {
  namedExports: {
    structuredPrompt: (task: string, input: unknown) => `${task}\n${JSON.stringify(input)}`,
  },
});

mock.module(pathToFileURL(resolve("models/Incident.ts")).href, {
  namedExports: {
    Incident: {
      find: (filter: Record<string, unknown>) => {
        incidentFilter = filter;
        return {
          select() { return this; },
          sort() { return this; },
          limit() { return this; },
          lean: async () => rows,
        };
      },
    },
  },
});

const route = import("../app/api/ai/ask/route");

function reset(nextRole: string) {
  role = nextRole;
  incidentFilter = null;
  generated = false;
  generatedPrompt = "";
  returnedSourceIds = [matchingId, "not-an-authorized-source", matchingId];
  embeddingBudgetCalls = 0;
  rows = [
    {
      _id: matchingId,
      title: "Fuite contact user@example.com",
      description: "Fuite au plafond, contact user@example.com",
      category: "PLUMBING",
      priority: "HIGH",
      status: "IN_PROGRESS",
      reportedAt: new Date("2026-11-06T09:00:00.000Z"),
      embedding: [1, 0],
    },
    {
      _id: unrelatedId,
      title: "Ascenseur en panne",
      description: "L'ascenseur est arrêté",
      category: "ELEVATOR",
      priority: "MEDIUM",
      status: "REPORTED",
      reportedAt: new Date("2026-11-06T08:00:00.000Z"),
      embedding: [0, 1],
    },
    {
      _id: "650000000000000000000012",
      title: "Ancienne réclamation",
      description: "Pas d'embedding",
      category: "OTHER",
      priority: "LOW",
      status: "RESOLVED",
      reportedAt: new Date("2026-11-05T08:00:00.000Z"),
    },
  ];
}

async function post(question = "Fuite à user@example.com") {
  const { POST } = await route;
  return POST(new NextRequest("http://localhost/api/ai/ask", {
    method: "POST",
    body: JSON.stringify({ question }),
    headers: { "content-type": "application/json" },
  }));
}

test("ask endpoint scopes resident records, redacts provider input, and filters citations to matched records", async () => {
  reset("RESIDENT");
  const response = await post();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.answer, "Une fuite est encore en cours.");
  assert.deepEqual(body.sources, [{
    id: matchingId,
    title: "Fuite contact [EMAIL]",
    status: "IN_PROGRESS",
    similarity: 100,
  }]);
  assert.deepEqual(body.coverage, { searched: 3, withoutEmbedding: 1 });
  assert.equal((incidentFilter?.reportedBy as { toString(): string }).toString(), userId);
  assert.deepEqual(
    ((incidentFilter?.residence as { $in: Array<{ toString(): string }> }).$in).map(String),
    [residenceId]
  );
  assert.equal(embeddingBudgetCalls, 1);
  assert.match(generatedPrompt, /\[EMAIL\]/);
  assert.doesNotMatch(generatedPrompt, /user@example\.com/);
});

test("ask endpoint limits technicians to assigned incidents", async () => {
  reset("TECHNICIAN");
  const response = await post("Panne d'ascenseur");
  assert.equal(response.status, 200);
  assert.equal((incidentFilter?.assignedTo as { toString(): string }).toString(), userId);
});

test("ask endpoint skips generation when no embedded records are relevant", async () => {
  reset("ADMIN");
  rows = [];
  const response = await post("Question sans dossier");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(generated, false);
  assert.deepEqual(body.sources, []);
  assert.deepEqual(body.coverage, { searched: 0, withoutEmbedding: 0 });
});
