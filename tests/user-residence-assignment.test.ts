import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import { resolve } from "node:path";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

const userId = "650000000000000000000001";
const residenceId = "650000000000000000000002";
const state: {
  user: {
    _id: { toString: () => string };
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    residence?: { toString: () => string };
    save: () => Promise<void>;
  };
  payload: Record<string, unknown>;
  actorRole: string;
  managedResidences: string[];
  assignedApartment: boolean;
  residenceExists: boolean;
  saved: boolean;
} = {
  user: null as never,
  payload: {},
  actorRole: "ADMIN",
  managedResidences: [residenceId],
  assignedApartment: false,
  residenceExists: true,
  saved: false,
};

function resetState() {
  state.saved = false;
  state.assignedApartment = false;
  state.residenceExists = true;
  state.actorRole = "ADMIN";
  state.managedResidences = [residenceId];
  state.payload = { residence: residenceId };
  state.user = {
    _id: { toString: () => userId },
    name: "Resident Test",
    email: "resident@example.com",
    role: "RESIDENT",
    isActive: true,
    save: async () => {
      state.saved = true;
    },
  };
}

mock.module(pathToFileURL(resolve("lib/api.ts")).href, {
  namedExports: {
    HttpError: class HttpError extends Error {
      constructor(public status: number, message: string) {
        super(message);
      }
    },
    isValidObjectId: (id: string | null | undefined): id is string =>
      Boolean(id && /^[a-f\d]{24}$/i.test(id)),
    json: (body: unknown, status = 200) => NextResponse.json(body, { status }),
    parseBody: async () => state.payload,
  },
});

mock.module(pathToFileURL(resolve("lib/auth-guard.ts")).href, {
  namedExports: {
    withAuth:
      (handler: (request: NextRequest, user: { id: string; role: string }, context?: unknown) => Promise<Response>) =>
      async (request: NextRequest, context?: unknown) => {
        try {
          return await handler(
            request,
            { id: "650000000000000000000099", role: state.actorRole },
            context
          );
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
    getSyndicResidenceIds: async () => state.managedResidences,
  },
});

mock.module(pathToFileURL(resolve("models/User.ts")).href, {
  namedExports: {
    User: {
      findById: async () => state.user,
    },
  },
});

mock.module(pathToFileURL(resolve("models/Residence.ts")).href, {
  namedExports: {
    Residence: { exists: async () => state.residenceExists },
  },
});

mock.module(pathToFileURL(resolve("models/Apartment.ts")).href, {
  namedExports: {
    Apartment: {
      findOne: () => ({
        select: () => ({ lean: async () => null }),
      }),
      exists: async () => state.assignedApartment,
    },
  },
});

const userRoute = import("../app/api/users/[id]/route");

async function patchUser() {
  const { PATCH } = await userRoute;
  return PATCH(
    new NextRequest(`http://localhost/api/users/${userId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state.payload),
    }),
    { params: Promise.resolve({ id: userId }) }
  );
}

test("admin can assign an existing resident account to a residence", async () => {
  resetState();
  const response = await patchUser();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(state.saved, true);
  assert.equal(body.residence, residenceId);
  assert.equal(state.user.residence?.toString(), residenceId);
});

test("syndic cannot assign a resident account to a residence they do not manage", async () => {
  resetState();
  state.actorRole = "SYNDIC";
  state.managedResidences = ["650000000000000000000003"];
  const response = await patchUser();

  assert.equal(response.status, 403);
  assert.equal(state.saved, false);
});

test("non-resident accounts cannot be assigned a residence", async () => {
  resetState();
  state.payload = { role: "TECHNICIAN", residence: residenceId };
  const response = await patchUser();

  assert.equal(response.status, 400);
  assert.equal(state.saved, false);
});

test("a resident cannot be detached from a residence while still assigned to a lot", async () => {
  resetState();
  state.payload = { residence: null };
  state.assignedApartment = true;
  const response = await patchUser();

  assert.equal(response.status, 409);
  assert.equal(state.saved, false);
});
