import assert from "node:assert/strict";
import { after, test, mock } from "node:test";
import { z } from "zod";

type GeminiRequest = {
  contents: Array<{ parts: Array<Record<string, unknown>> }>;
};

let geminiHandler: (request: GeminiRequest) => Promise<unknown>;
const geminiRequests: GeminiRequest[] = [];
let groqCalls = 0;
const originalFetch = globalThis.fetch;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalGroqKey = process.env.GROQ_API_KEY;
const originalZhipuKey = process.env.ZHIPU_API_KEY;
const originalMongoUri = process.env.MONGODB_URI;

mock.module("@google/genai", {
  namedExports: {
    GoogleGenAI: class {
      models = {
        generateContent: async (request: GeminiRequest) => {
          geminiRequests.push(request);
          return await geminiHandler(request);
        },
      };
    },
  },
});

const aiModules = Promise.all([
  import("../lib/ai/triage"),
  import("../lib/ai/verifyResolution"),
]);

const triageResponse = {
  title: "Fuite sous l'évier",
  description: "Une fuite est visible au niveau du raccord sous l'évier.",
  category: "PLUMBING",
  priority: "MEDIUM",
  specialty: "plombier",
  probableCause: "Fuite au niveau du raccord.",
  safetyRisk: false,
  confidence: 0.9,
  reasoning: "La description indique une fuite.",
};

function mockGroq(response: unknown) {
  groqCalls = 0;
  globalThis.fetch = async (input) => {
    assert.match(String(input), /api\.groq\.com/);
    groqCalls += 1;
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(response) } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };
}

function resetGemini(handler: typeof geminiHandler) {
  geminiRequests.length = 0;
  geminiHandler = handler;
}

after(() => {
  globalThis.fetch = originalFetch;
  if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGeminiKey;
  if (originalGroqKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalGroqKey;
  if (originalZhipuKey === undefined) delete process.env.ZHIPU_API_KEY;
  else process.env.ZHIPU_API_KEY = originalZhipuKey;
  if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = originalMongoUri;
});

test("text-only triage falls back to Groq when Gemini fails", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const [{ triageIncident }] = await aiModules;
  process.env.GEMINI_API_KEY = "test-gemini-key";
  process.env.GROQ_API_KEY = "test-groq-key";
  resetGemini(async () => {
    throw new Error("mock Gemini failure");
  });
  mockGroq(triageResponse);

  const result = await triageIncident({ title: "Fuite", description: "Une fuite d'eau." });

  assert.equal(result.category, "PLUMBING");
  assert.equal(groqCalls, 1);
});

test("structured RAG provider falls back from Gemini and Groq to Zhipu", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/syndicpro-test";
  const { generateValidated } = await import("../lib/ai/provider");
  process.env.GEMINI_API_KEY = "test-gemini-key";
  process.env.GROQ_API_KEY = "test-groq-key";
  process.env.ZHIPU_API_KEY = "test-zhipu-key";
  resetGemini(async () => {
    throw new Error("mock Gemini failure");
  });
  let groqRequests = 0;
  let zhipuRequests = 0;
  globalThis.fetch = async (input) => {
    if (String(input).includes("api.groq.com")) {
      groqRequests += 1;
      return new Response("", { status: 503 });
    }
    assert.match(String(input), /open\.bigmodel\.cn\/api\/paas\/v4\/chat\/completions/);
    zhipuRequests += 1;
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ answer: "Dossier retrouvé." }) } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const result = await generateValidated(
    "test-user",
    "rag-zhipu-fallback",
    z.object({ answer: z.string() }),
    "Réponds au sujet des dossiers."
  );

  assert.deepEqual(result, { answer: "Dossier retrouvé." });
  assert.equal(groqRequests, 1);
  assert.equal(zhipuRequests, 1);
});

test("image-based triage does not fall back to Groq when Gemini fails", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const [{ triageIncident }] = await aiModules;
  process.env.GEMINI_API_KEY = "test-gemini-key";
  process.env.GROQ_API_KEY = "test-groq-key";
  resetGemini(async () => {
    throw new Error("mock Gemini failure");
  });
  mockGroq(triageResponse);

  await assert.rejects(
    triageIncident({
      title: "Fuite",
      description: "Une fuite d'eau.",
      images: [{ mimeType: "image/jpeg", data: "mock-image-data" }],
    }),
    { message: "AI_UNAVAILABLE" }
  );
  assert.equal(groqCalls, 0);
});

test("image-based triage returns AI_UNAVAILABLE when Gemini is unavailable", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const [{ triageIncident }] = await aiModules;
  delete process.env.GEMINI_API_KEY;
  process.env.GROQ_API_KEY = "test-groq-key";
  resetGemini(async () => {
    throw new Error("Gemini must not be called without its key");
  });
  mockGroq(triageResponse);

  await assert.rejects(
    triageIncident({
      title: "Fuite",
      description: "Une fuite d'eau.",
      images: [{ mimeType: "image/jpeg", data: "mock-image-data" }],
    }),
    { message: "AI_UNAVAILABLE" }
  );
  assert.equal(geminiRequests.length, 0);
  assert.equal(groqCalls, 0);
});

test("Gemini receives image data during image-based triage", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const [{ triageIncident }] = await aiModules;
  process.env.GEMINI_API_KEY = "test-gemini-key";
  process.env.GROQ_API_KEY = "test-groq-key";
  resetGemini(async () => ({
    text: JSON.stringify(triageResponse),
  }));
  mockGroq(triageResponse);
  const image = { mimeType: "image/jpeg", data: "mock-image-data" };

  const result = await triageIncident({
    title: "Fuite",
    description: "Une fuite d'eau.",
    images: [image],
  });

  assert.equal(result.category, "PLUMBING");
  assert.equal(result.title, triageResponse.title);
  assert.equal(result.description, triageResponse.description);
  assert.deepEqual(geminiRequests[0].contents[0].parts[1], {
    inlineData: image,
  });
  assert.equal(groqCalls, 0);
});

test("resolution verification prohibits Groq text fallback after Gemini fails", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const [, { verifyResolution }] = await aiModules;
  process.env.GEMINI_API_KEY = "test-gemini-key";
  process.env.GROQ_API_KEY = "test-groq-key";
  resetGemini(async () => {
    throw new Error("mock Gemini failure");
  });
  mockGroq({
    verdict: "FIXED",
    explanation: "La réparation semble terminée.",
    confidence: 0.9,
  });

  await assert.rejects(
    verifyResolution({
      problemDescription: "Une fuite d'eau.",
      before: [{ mimeType: "image/jpeg", data: "before-image" }],
      after: [{ mimeType: "image/jpeg", data: "after-image" }],
    }),
    { message: "AI_UNAVAILABLE" }
  );
  assert.equal(groqCalls, 0);
});
