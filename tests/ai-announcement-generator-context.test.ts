import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

let receivedPrompt = "";

mock.module(pathToFileURL(resolve("lib/ai/provider.ts")).href, {
  namedExports: {
    generateValidated: async (
      _userId: string,
      _operation: string,
      _schema: unknown,
      prompt: string
    ) => {
      receivedPrompt = prompt;
      return {
        title: "Information",
        content: "Contenu",
        suggestedCategory: "MAINTENANCE",
        suggestedPriority: "NORMAL",
      };
    },
  },
});

mock.module(pathToFileURL(resolve("lib/ai/prompts.ts")).href, {
  namedExports: {
    structuredPrompt: (task: string, input: unknown) => `${task}\n${JSON.stringify(input)}`,
  },
});

const generator = import("../lib/ai/announcement-generator");

test("announcement generator includes only supplied facts and redacts provider input", async () => {
  const { generateAnnouncement } = await generator;
  await generateAnnouncement("650000000000000000000099", {
    topic: "Contacter gestionnaire@example.com au sujet du planning",
    category: "MAINTENANCE",
    audience: "RESIDENTS",
    tone: "PROFESSIONAL",
    language: "FR",
    mode: "GENERATE",
    facts: [
      "3 résidents actifs seront concernés",
      "Contact gestionnaire@example.com",
    ],
  });

  assert.match(receivedPrompt, /Verified facts you may use if relevant/);
  assert.match(receivedPrompt, /3 résidents actifs seront concernés \| Contact \[EMAIL\]/);
  assert.doesNotMatch(receivedPrompt, /gestionnaire@example\.com/);
});
