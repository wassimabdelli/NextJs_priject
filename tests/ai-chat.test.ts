import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { resolve } from "node:path";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

const userId = "650000000000000000000099";
const residenceId = "650000000000000000000001";
const incidentIds = [
  "650000000000000000000010",
  "650000000000000000000011",
];

let role = "RESIDENT";
let incidentFilter: Record<string, unknown> | null = null;
let incidentRows: Array<Record<string, unknown>> = [];
let conversationMessages: Array<{ role: string; content: string }> | null = null;
let deleteCalls: Array<Record<string, unknown>> = [];
let findOneAndUpdateCall: {
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
  options: Record<string, unknown>;
} | null = null;
let assistantCall: {
  userId: string;
  role: string;
  message: string;
  context: Record<string, unknown>;
  history: Array<{ role: string; content: string }>;
} | null = null;

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
      handler: (request: NextRequest, user: { id: string; role: string }) => Promise<Response>
    ) => async (request: NextRequest) => {
      try {
        return await handler(request, { id: userId, role });
      } catch (error) {
        if (error && typeof error === "object" && "status" in error) {
          const status = Number(error.status);
          const message = error instanceof Error ? error.message : "Request failed";
          return Response.json({ error: message }, { status });
        }
        throw error;
      }
    },
    getResidentResidenceIds: async () => [residenceId],
    getSyndicResidenceIds: async () => [residenceId],
    getTechnicianResidenceIds: async () => [residenceId],
  },
});

mock.module(pathToFileURL(resolve("lib/ai/incident-assistant.ts")).href, {
  namedExports: {
    answerIncidentQuestion: async (
      assistantUserId: string,
      assistantRole: string,
      message: string,
      context: Record<string, unknown>,
      history: Array<{ role: string; content: string }>
    ) => {
      assistantCall = {
        userId: assistantUserId,
        role: assistantRole,
        message,
        context,
        history,
      };
      return { answer: "Une fuite est en cours." };
    },
  },
});

mock.module(pathToFileURL(resolve("lib/ai/schemas.ts")).href, {
  namedExports: {
    chatInputSchema: { parse: (value: unknown) => value },
  },
});

mock.module(pathToFileURL(resolve("models/AIConversation.ts")).href, {
  namedExports: {
    AIConversation: {
      deleteOne: async (filter: Record<string, unknown>) => {
        deleteCalls.push(filter);
        return { deletedCount: 0 };
      },
      findOne: () => ({
        lean: async () => conversationMessages ? { messages: conversationMessages } : null,
      }),
      findOneAndUpdate: async (
        filter: Record<string, unknown>,
        update: Record<string, unknown>,
        options: Record<string, unknown>
      ) => {
        findOneAndUpdateCall = { filter, update, options };
        return null;
      },
    },
  },
});

mock.module(pathToFileURL(resolve("models/Incident.ts")).href, {
  namedExports: {
    Incident: {
      find: (filter: Record<string, unknown>) => {
        incidentFilter = filter;
        return {
          sort() { return this; },
          limit() { return this; },
          select() { return this; },
          lean: async () => incidentRows,
        };
      },
      aggregate: async () => [],
    },
  },
});

mock.module(pathToFileURL(resolve("models/Announcement.ts")).href, {
  namedExports: {
    Announcement: {
      find: () => ({
        sort() { return this; },
        limit() { return this; },
        select() { return this; },
        lean: async () => [],
      }),
    },
  },
});

mock.module(pathToFileURL(resolve("models/Residence.ts")).href, {
  namedExports: {
    Residence: {
      find: () => ({
        select() { return this; },
        lean: async () => [],
      }),
    },
  },
});

const route = import("../app/api/ai/chat/route");

function reset(nextRole: string) {
  role = nextRole;
  incidentFilter = null;
  deleteCalls = [];
  findOneAndUpdateCall = null;
  assistantCall = null;
  conversationMessages = null;
  incidentRows = incidentIds.map((id, index) => ({
    _id: id,
    title: index === 0 ? "Fuite dans la cuisine" : "Infiltration au plafond",
    description: "Une fuite est signalée dans le logement.",
    category: "PLUMBING",
    priority: "HIGH",
    status: "IN_PROGRESS",
    reportedAt: new Date(`2026-11-0${index + 1}T09:00:00.000Z`),
  }));
}

async function post(message = "Où en est la fuite ?") {
  const { POST } = await route;
  return POST(new NextRequest("http://localhost/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
    headers: { "content-type": "application/json" },
  }));
}

test("resident chat scopes context and removes expired or mismatched conversations before appending", async () => {
  reset("RESIDENT");
  const beforeRequest = Date.now();
  const response = await post();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.answer, "Une fuite est en cours.");
  assert.match(body.conversationId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal((incidentFilter?.reportedBy as { toString(): string }).toString(), userId);
  assert.deepEqual(
    ((incidentFilter?.residence as { $in: Array<{ toString(): string }> }).$in).map(String),
    [residenceId]
  );

  assert.equal(deleteCalls.length, 2);
  assert.ok((deleteCalls[0].expiresAt as { $lte: unknown }).$lte instanceof Date);
  assert.equal((deleteCalls[1].role as { $ne: string }).$ne, "RESIDENT");

  assert.ok(findOneAndUpdateCall);
  assert.equal(findOneAndUpdateCall.options.upsert, true);
  const update = findOneAndUpdateCall.update;
  const expiresAt = (update.$set as { expiresAt: Date }).expiresAt;
  assert.ok(expiresAt instanceof Date);
  assert.ok(expiresAt.getTime() >= beforeRequest + 23 * 60 * 60 * 1000);
  assert.ok(expiresAt.getTime() <= Date.now() + 25 * 60 * 60 * 1000);
  const pushedMessages = (update.$push as {
    messages: { $each: Array<{ role: string; content: string }>; $slice: number };
  }).messages;
  assert.equal(pushedMessages.$each.length, 2);
  assert.deepEqual(pushedMessages.$each.map((item) => item.role), ["user", "model"]);
  assert.equal(pushedMessages.$slice, -8);
});

test("technician chat scopes context to assigned incidents", async () => {
  reset("TECHNICIAN");
  const response = await post();

  assert.equal(response.status, 200);
  assert.equal((incidentFilter?.assignedTo as { toString(): string }).toString(), userId);
});

test("chat returns 403 for unauthenticated roles", async () => {
  reset("ANONYMOUS");
  const response = await post();

  assert.equal(response.status, 403);
  assert.equal(assistantCall, null);
});

test("existing conversation history is passed to the assistant", async () => {
  reset("SYNDIC");
  conversationMessages = [
    { role: "user", content: "Bonjour" },
    { role: "model", content: "Bonjour, comment puis-je aider ?" },
  ];

  const response = await post("Une fuite est-elle déjà signalée ?");

  assert.equal(response.status, 200);
  assert.ok(assistantCall);
  assert.deepEqual(assistantCall.history, conversationMessages);
});
