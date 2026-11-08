import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

const userId = "650000000000000000000001";
const residenceId = "650000000000000000000002";

mock.module(pathToFileURL(resolve("auth.ts")).href, {
  namedExports: { auth: async () => null },
});

mock.module(pathToFileURL(resolve("lib/api.ts")).href, {
  namedExports: {
    HttpError: class HttpError extends Error {},
    handle: async (handler: () => Promise<Response>) => handler(),
    isValidObjectId: () => true,
  },
});

mock.module(pathToFileURL(resolve("models/User.ts")).href, {
  namedExports: {
    User: {
      findOne: () => ({
        select: () => ({
          lean: async () => ({ _id: userId, role: "RESIDENT", residence: residenceId }),
        }),
      }),
    },
  },
});

mock.module(pathToFileURL(resolve("models/Apartment.ts")).href, {
  namedExports: {
    Apartment: {
      find: () => ({ distinct: async () => [] }),
    },
  },
});

mock.module(pathToFileURL(resolve("models/Resident.ts")).href, {
  namedExports: {
    Resident: {
      find: () => ({ distinct: async () => [] }),
    },
  },
});

mock.module(pathToFileURL(resolve("models/Residence.ts")).href, {
  namedExports: { Residence: {} },
});

mock.module(pathToFileURL(resolve("models/Incident.ts")).href, {
  namedExports: { Incident: {} },
});

const authGuard = import("../lib/auth-guard");

test("a resident account assigned directly to a residence is authorized without a lot", async () => {
  const { getResidentResidenceIds } = await authGuard;
  assert.deepEqual(await getResidentResidenceIds(userId), [residenceId]);
});
