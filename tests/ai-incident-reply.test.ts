import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { resolve } from "node:path";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

const userId = "650000000000000000000099";
const incidentId = "650000000000000000000010";
const day = 86_400_000;
let role = "SYNDIC";
let shouldFailGeneration = false;
let generatedPrompt = "";
let requestedFilter: Record<string, unknown> | null = null;
let commentQuery: { sort?: unknown; limit?: number; populated?: unknown } = {};
class MockHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const incident = {
  _id: incidentId,
  title: "Fuite contact user@example.com",
  description: "Une fuite est visible, contactez le 12345678.",
  status: "IN_PROGRESS",
  category: "PLUMBING",
  reportedAt: new Date(Date.now() - 10.5 * day),
  assignedTo: "650000000000000000000020",
};
const comments = [
  {
    author: { role: "RESIDENT" },
    content: "Bonjour, contactez-moi à resident@example.com",
    createdAt: new Date(Date.now() - 3.5 * day),
  },
  {
    author: { role: "SYNDIC" },
    content: "Nous avons bien reçu votre message.",
    createdAt: new Date(Date.now() - 4.5 * day),
  },
];

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
      handler: (request: NextRequest, user: { id: string; role: string }, context?: unknown) => Promise<Response>,
      options?: { roles?: string[] }
    ) => async (request: NextRequest, context?: unknown) => {
      const user = { id: userId, role };
      if (options?.roles && !options.roles.includes(user.role)) {
        return Response.json({ error: "Accès interdit" }, { status: 403 });
      }
      try {
        return await handler(request, user, context);
      } catch (error) {
        if (error instanceof MockHttpError) {
          return Response.json({ error: error.message }, { status: error.status });
        }
        throw error;
      }
    },
  },
});

mock.module(pathToFileURL(resolve("lib/incidents/access.ts")).href, {
  namedExports: {
    requireIncidentAccess: async () => incident,
  },
});

mock.module(pathToFileURL(resolve("lib/ai/provider.ts")).href, {
  namedExports: {
    generateValidated: async (
      _userId: string,
      _operation: string,
      _schema: unknown,
      prompt: string
    ) => {
      generatedPrompt = prompt;
      if (shouldFailGeneration) throw new Error("provider unavailable");
      return { reply: "Nous avons bien pris en compte votre signalement." };
    },
  },
});

mock.module(pathToFileURL(resolve("lib/ai/prompts.ts")).href, {
  namedExports: {
    structuredPrompt: (task: string, input: unknown) => `${task}\n${JSON.stringify(input)}`,
  },
});

mock.module(pathToFileURL(resolve("models/IncidentComment.ts")).href, {
  namedExports: {
    IncidentComment: {
      find: (filter: Record<string, unknown>) => {
        requestedFilter = filter;
        const query = {
          sort(value: unknown) { commentQuery.sort = value; return this; },
          limit(value: number) { commentQuery.limit = value; return this; },
          populate(value: unknown) { commentQuery.populated = value; return this; },
          lean: async () => comments,
        };
        return query;
      },
    },
  },
});

const route = import("../app/api/ai/incidents/[id]/reply/route");

test("incident reply is manager-only, redacts provider input, and returns code-computed facts", async () => {
  role = "SYNDIC";
  shouldFailGeneration = false;
  generatedPrompt = "";
  requestedFilter = null;
  commentQuery = {};

  const { POST } = await route;
  const response = await POST(
    new NextRequest(`http://localhost/api/ai/incidents/${incidentId}/reply`, { method: "POST" }),
    { params: Promise.resolve({ id: incidentId }) }
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.reply, "Nous avons bien pris en compte votre signalement.");
  assert.equal(body.facts.ageDays, 10);
  assert.equal(body.facts.assigned, true);
  assert.equal(body.facts.waitingDays, 3);
  assert.deepEqual(requestedFilter, { incident: incidentId });
  assert.deepEqual(commentQuery.sort, { createdAt: -1 });
  assert.equal(commentQuery.limit, 5);
  assert.match(JSON.stringify(commentQuery.populated), /role/);
  assert.doesNotMatch(generatedPrompt, /user@example\.com|resident@example\.com|12345678/);
  assert.match(generatedPrompt, /\[EMAIL\]|\[TEL\]/);

  role = "RESIDENT";
  const denied = await POST(
    new NextRequest(`http://localhost/api/ai/incidents/${incidentId}/reply`, { method: "POST" }),
    { params: Promise.resolve({ id: incidentId }) }
  );
  assert.equal(denied.status, 403);
});

test("incident reply returns a French 502 when generation fails without modifying incident data", async () => {
  role = "ADMIN";
  shouldFailGeneration = true;
  const before = { ...incident };
  const { POST } = await route;
  const response = await POST(
    new NextRequest(`http://localhost/api/ai/incidents/${incidentId}/reply`, { method: "POST" }),
    { params: Promise.resolve({ id: incidentId }) }
  );
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.match(body.error, /indisponible/i);
  assert.deepEqual(incident, before);
  shouldFailGeneration = false;
});
