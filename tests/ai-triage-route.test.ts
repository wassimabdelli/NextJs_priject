import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { resolve } from "node:path";
import { after, mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { Role } from "../types/enums";

const state: {
  receivedInput: Record<string, unknown>;
  triageCalls: number;
  triageResult: Record<string, unknown>;
  triageError?: Error;
} = { receivedInput: {}, triageCalls: 0, triageResult: {} };
const user = { id: "650000000000000000000099", role: Role.RESIDENT };

mock.module(pathToFileURL(resolve("lib/api.ts")).href, {
  namedExports: {
    HttpError: class HttpError extends Error {
      constructor(public status: number, message: string) {
        super(message);
      }
    },
  },
});

mock.module(pathToFileURL(resolve("lib/auth-guard.ts")).href, {
  namedExports: {
    withAuth: (handler: (request: NextRequest, authUser: typeof user) => Promise<Response>) =>
      (request: NextRequest) => handler(request, user),
  },
});

mock.module(pathToFileURL(resolve("lib/ai/gemini.ts")).href, {
  namedExports: {
    isAiEnabled: () => Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY),
  },
});

mock.module(pathToFileURL(resolve("lib/ai/triage.ts")).href, {
  namedExports: {
    triageIncident: async (input: Record<string, unknown>) => {
      Object.assign(state.receivedInput, input);
      state.triageCalls += 1;
      if (state.triageError) throw state.triageError;
      return state.triageResult;
    },
  },
});

const triageRoute = import("../app/api/ai/triage/route");
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalGroqKey = process.env.GROQ_API_KEY;

function photoRequest() {
  const formData = new FormData();
  formData.append("images", new Blob([Uint8Array.of(1, 2, 3)], { type: "image/jpeg" }), "photo.jpg");
  return new NextRequest("http://localhost/api/ai/triage", {
    method: "POST",
    body: formData,
  });
}

after(() => {
  if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGeminiKey;
  if (originalGroqKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalGroqKey;
});

function triageResult(overrides: Record<string, unknown> = {}) {
  return {
    title: "Peinture écaillée sur le mur",
    description: "La peinture se décolle par endroits sur le mur.",
    category: "OTHER",
    priority: "LOW",
    specialty: "peintre",
    probableCause: "L'adhérence de la peinture semble dégradée.",
    safetyRisk: false,
    confidence: 0.85,
    reasoning: "Défaut esthétique sans danger immédiat visible.",
    ...overrides,
  };
}

test("the triage API accepts photo-only input and returns generated incident fields", async () => {
  const { POST } = await triageRoute;
  process.env.GEMINI_API_KEY = "test-gemini-key";
  state.receivedInput = {};
  state.triageCalls = 0;
  state.triageResult = triageResult({
    title: "Fuite visible",
    description: "Une fuite est visible sur la photo.",
    category: "PLUMBING",
    priority: "HIGH",
  });

  const response = await POST(photoRequest());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.title, "Fuite visible");
  assert.equal(body.data.description, "Une fuite est visible sur la photo.");
  assert.equal(state.triageCalls, 1);
  assert.equal(state.receivedInput.title, undefined);
  assert.equal(state.receivedInput.description, undefined);
  assert.equal((state.receivedInput.images as Array<{ mimeType: string }>)[0].mimeType, "image/jpeg");
});

test("the triage API preserves AI-generated fields when the photo fits Other", async () => {
  const { POST } = await triageRoute;
  process.env.GEMINI_API_KEY = "test-gemini-key";
  state.receivedInput = {};
  state.triageCalls = 0;
  state.triageResult = triageResult();

  const response = await POST(photoRequest());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.category, "OTHER");
  assert.equal(body.data.title, "Peinture écaillée sur le mur");
  assert.equal(body.data.description, "La peinture se décolle par endroits sur le mur.");
  assert.equal(body.data.priority, "LOW");
});

test("the triage API rejects photo analysis without Gemini and never calls text-only AI", async () => {
  const { POST } = await triageRoute;
  delete process.env.GEMINI_API_KEY;
  process.env.GROQ_API_KEY = "test-groq-key";
  state.triageCalls = 0;

  const response = await POST(photoRequest());
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.match(body.error, /GEMINI_API_KEY/);
  assert.equal(state.triageCalls, 0);
});

test("the triage API reports Gemini quota exhaustion as a retryable quota error", async () => {
  const { POST } = await triageRoute;
  process.env.GEMINI_API_KEY = "test-gemini-key";
  state.triageError = Object.assign(new Error("RESOURCE_EXHAUSTED quota exceeded"), { status: 429 });

  const response = await POST(photoRequest());
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.match(body.error, /Quota Gemini atteint/);
  state.triageError = undefined;
});
