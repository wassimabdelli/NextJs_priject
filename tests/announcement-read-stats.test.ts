import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { Role } from "../types/enums";

const residenceId = "650000000000000000000001";
const apartmentId = "650000000000000000000002";
const ownerId = "650000000000000000000003";
const assignedResidentId = "650000000000000000000004";
const legacyResidentId = "650000000000000000000005";

mock.module(pathToFileURL(resolve("models/Apartment.ts")).href, {
  namedExports: {
    Apartment: {
      find: () => ({
        select: () => ({
          lean: async () => [{
            _id: apartmentId,
            residence: residenceId,
            owner: ownerId,
            residentUser: assignedResidentId,
          }],
        }),
      }),
    },
  },
});

mock.module(pathToFileURL(resolve("models/Resident.ts")).href, {
  namedExports: {
    Resident: {
      find: () => ({
        select: () => ({
          lean: async () => [{
            apartment: apartmentId,
            user: legacyResidentId,
          }],
        }),
      }),
    },
  },
});

mock.module(pathToFileURL(resolve("models/User.ts")).href, {
  namedExports: {
    User: {
      distinct: async (_field: string, filter: { role: string; isActive: boolean; _id: { $in: string[] } }) => {
        assert.equal(filter.role, Role.RESIDENT);
        assert.equal(filter.isActive, true);
        return filter._id.$in;
      },
    },
  },
});

mock.module(pathToFileURL(resolve("models/AnnouncementRead.ts")).href, {
  namedExports: { default: {} },
});

const readStatsModule = import("../lib/announcements/readStats");

test("eligible announcement readers include apartment residentUser assignments", async () => {
  const { getEligibleResidentIdsByResidence } = await readStatsModule;
  const result = await getEligibleResidentIdsByResidence([residenceId]);

  assert.deepEqual(
    [...(result.get(residenceId) ?? [])].sort(),
    [ownerId, assignedResidentId, legacyResidentId].sort()
  );
});
