import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import { resolve } from "node:path";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

const authenticatedUserId = "650000000000000000000099";
let parseBodyCalls = 0;

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
    parseBody: async () => {
      parseBodyCalls += 1;
      throw new Error("Technician authorization should reject before parsing");
    },
    json: (body: unknown, status = 200) =>
      NextResponse.json(body, { status }),
    isValidObjectId: (id: string | null | undefined): id is string =>
      Boolean(id && /^[a-f\d]{24}$/i.test(id)),
  },
});

mock.module(pathToFileURL(resolve("auth.ts")).href, {
  namedExports: {
    auth: async () => ({ user: { id: authenticatedUserId } }),
  },
});

mock.module(pathToFileURL(resolve("models/User.ts")).href, {
  namedExports: {
    User: {
      findById: () => ({
        select: () => ({
          lean: async () => ({
            _id: authenticatedUserId,
            role: "TECHNICIAN",
            isActive: true,
          }),
        }),
      }),
    },
  },
});

const incidentsRoute = import("../app/api/incidents/route");

test("the incident creation API returns HTTP 403 for technicians before parsing the body", async () => {
  const { POST } = await incidentsRoute;
  parseBodyCalls = 0;

  const response = await POST(
    new NextRequest("http://localhost/api/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Test", description: "Test incident" }),
    })
  );

  assert.equal(response.status, 403);
  assert.equal(parseBodyCalls, 0);
});
