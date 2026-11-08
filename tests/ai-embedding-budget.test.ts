import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

mock.module(pathToFileURL(resolve("lib/api.ts")).href, {
  namedExports: {
    HttpError: class HttpError extends Error {
      constructor(public status: number, message: string) {
        super(message);
      }
    },
  },
});

const budgetModule = import("../lib/ai/embedding-budget");

test("embedding budget allows the configured number of analyses then returns a rate limit", async () => {
  const { assertEmbeddingBudget } = await budgetModule;
  const userId = `embedding-budget-${Date.now()}-${Math.random()}`;
  assert.doesNotThrow(() => assertEmbeddingBudget(userId, 2, 60_000));
  assert.doesNotThrow(() => assertEmbeddingBudget(userId, 2, 60_000));
  assert.throws(
    () => assertEmbeddingBudget(userId, 2, 60_000),
    (error: unknown) => error instanceof Error && "status" in error && error.status === 429
  );
});
