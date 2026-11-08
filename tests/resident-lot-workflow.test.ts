import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { apartmentCreateSchema, apartmentUpdateSchema } from "../lib/validations/apartment";
import { residentCreateSchema } from "../lib/validations/resident";
import { userUpdateSchema } from "../lib/validations/user";
import { apartmentConfig, residentConfig, userConfig } from "../lib/resources/registry";

const residenceId = "650000000000000000000001";
const residentId = "650000000000000000000002";
const apartmentId = "650000000000000000000003";
const state: {
  resident?: { residence: string; isActive: boolean; role: string };
  duplicateApartment: boolean;
} = { duplicateApartment: false };

mock.module(pathToFileURL(resolve("lib/crud/createCrudRoutes.ts")).href, {
  namedExports: {
    createCrudRoutes: (config: Record<string, unknown>) => config,
  },
});

mock.module(pathToFileURL(resolve("models/Apartment.ts")).href, {
  namedExports: {
    Apartment: {
      findOne: () => ({ lean: async () => null }),
      exists: async () => state.duplicateApartment,
      findById: () => ({
        select: () => ({ lean: async () => ({ _id: apartmentId, residence: residenceId }) }),
      }),
    },
  },
});

mock.module(pathToFileURL(resolve("models/User.ts")).href, {
  namedExports: {
    User: {
      findOne: () => ({
        select: () => ({ lean: async () => state.resident ?? null }),
      }),
    },
  },
});

mock.module(pathToFileURL(resolve("models/Residence.ts")).href, {
  namedExports: {
    Residence: { exists: async () => true },
  },
});

mock.module(pathToFileURL(resolve("models/Charge.ts")).href, {
  namedExports: {
    Charge: { exists: async () => false },
  },
});

mock.module(pathToFileURL(resolve("lib/auth-guard.ts")).href, {
  namedExports: {
    getResidentApartmentIds: async () => [],
    getSyndicResidenceIds: async () => [residenceId],
  },
});

mock.module(pathToFileURL(resolve("lib/api.ts")).href, {
  namedExports: {
    HttpError: class HttpError extends Error {
      constructor(public status: number, message: string) {
        super(message);
      }
    },
  },
});

const apartmentCrud = import("../lib/crud/apartments");

const baseResident = {
  fullName: "Jean Dupont",
  email: "jean@example.com",
  type: "TENANT" as const,
  moveInDate: "2026-11-02",
};

test("a resident profile can be created for a residence without assigning a lot", () => {
  const parsed = residentCreateSchema.safeParse({
    ...baseResident,
    residence: residenceId,
  });

  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.apartment, undefined);
});

test("resident creation still requires a residence or an existing apartment", () => {
  assert.equal(residentCreateSchema.safeParse(baseResident).success, false);
});

test("a lot can be created with an optional resident assignment", () => {
  const parsed = apartmentCreateSchema.safeParse({
    residence: residenceId,
    number: "A101",
    floor: 1,
    surface: 55,
    shares: 100,
    residentUser: residentId,
  });

  assert.equal(parsed.success, true);
});

test("a user account can be assigned a residence from the Users form", () => {
  assert.equal(userUpdateSchema.safeParse({ residence: residenceId }).success, true);
  assert.equal(userUpdateSchema.safeParse({ residence: null }).success, true);
  assert.ok(userConfig.fields.some((field) => field.name === "residence"));
});

test("the lot assignment can be cleared when editing a lot", () => {
  assert.equal(apartmentUpdateSchema.safeParse({ residentUser: null }).success, true);
});

test("the lot form selects resident accounts within its selected residence", () => {
  assert.equal(residentConfig.fields.some((field) => field.name === "apartment"), false);
  assert.equal(
    residentConfig.fields.find((field) => field.name === "residence")?.required,
    true
  );
  const residentField = apartmentConfig.fields.find((field) => field.name === "residentUser");
  assert.equal(residentField?.relation?.dependsOn, "residence");
  assert.equal(residentField?.relation?.queryParam, "residence");
  assert.equal(residentField?.relation?.resource, "users");
  assert.equal(residentConfig.fields.some((field) => field.name === "user"), false);
});

test("a lot accepts an active user already assigned to the same residence", async () => {
  state.resident = { residence: residenceId, isActive: true, role: "RESIDENT" };
  state.duplicateApartment = false;
  const { apartmentCrudRoutes } = await apartmentCrud;
  const hooks = apartmentCrudRoutes as unknown as {
    beforeCreate: (user: { id: string; role: string }, body: Record<string, string>) => Promise<void>;
  };
  const body = { residence: residenceId, number: "A101", residentUser: residentId };

  await hooks.beforeCreate({ id: "admin", role: "ADMIN" }, body);
});

test("lot assignment rejects accounts from another residence or already assigned to a lot", async () => {
  state.duplicateApartment = false;
  const { apartmentCrudRoutes } = await apartmentCrud;
  const hooks = apartmentCrudRoutes as unknown as {
    beforeCreate: (user: { id: string; role: string }, body: Record<string, string>) => Promise<void>;
  };
  const body = { residence: residenceId, number: "A102", residentUser: residentId };

  state.resident = {
    residence: "650000000000000000000099",
    isActive: true,
    role: "RESIDENT",
  };
  await assert.rejects(
    hooks.beforeCreate({ id: "admin", role: "ADMIN" }, body),
    /même résidence/i
  );

  state.resident = { residence: residenceId, isActive: true, role: "RESIDENT" };
  state.duplicateApartment = true;
  await assert.rejects(
    hooks.beforeCreate({ id: "admin", role: "ADMIN" }, body),
    /déjà associé/i
  );
});
