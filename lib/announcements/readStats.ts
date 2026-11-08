import mongoose from "mongoose";
import { Apartment } from "@/models/Apartment";
import { Resident } from "@/models/Resident";
import { User } from "@/models/User";
import AnnouncementRead from "@/models/AnnouncementRead";
import { Role } from "@/types/enums";

export async function getEligibleResidentIdsByResidence(residenceIds: string[]) {
  const result = new Map<string, Set<string>>();
  if (residenceIds.length === 0) return result;

  const objectIds = residenceIds.map((id) => new mongoose.Types.ObjectId(id));
  const apartments = await Apartment.find({ residence: { $in: objectIds } })
    .select("_id residence owner residentUser")
    .lean();
  const apartmentIds = apartments.map((apartment) => apartment._id);
  const activeResidents = await Resident.find({
    apartment: { $in: apartmentIds },
    isActive: true,
    user: { $ne: null },
  }).select("apartment user").lean();

  const usersByResidence = new Map<string, Set<string>>();
  const apartmentResidence = new Map(apartments.map((apartment) => [
    String(apartment._id),
    String(apartment.residence),
  ]));
  for (const apartment of apartments) {
    const residenceId = String(apartment.residence);
    const users = usersByResidence.get(residenceId) ?? new Set<string>();
    if (apartment.owner) users.add(String(apartment.owner));
    if (apartment.residentUser) users.add(String(apartment.residentUser));
    usersByResidence.set(residenceId, users);
  }
  for (const resident of activeResidents) {
    if (!resident.user) continue;
    const residenceId = apartmentResidence.get(String(resident.apartment));
    if (!residenceId) continue;
    const users = usersByResidence.get(residenceId) ?? new Set<string>();
    users.add(String(resident.user));
    usersByResidence.set(residenceId, users);
  }

  const allUserIds = [...new Set([...usersByResidence.values()].flatMap((ids) => [...ids]))];
  const validUserIds = new Set((await User.distinct("_id", {
    _id: { $in: allUserIds },
    role: { $in: [Role.OWNER, Role.TENANT] },
    isActive: true,
  })).map(String));
  for (const residenceId of residenceIds) {
    result.set(residenceId, new Set(
      [...(usersByResidence.get(residenceId) ?? [])].filter((id) => validUserIds.has(id))
    ));
  }
  return result;
}

export async function getAnnouncementReadStats(announcementId: string, residenceId: string) {
  const eligibleByResidence = await getEligibleResidentIdsByResidence([residenceId]);
  const eligible = eligibleByResidence.get(residenceId) ?? new Set<string>();
  const readCount = eligible.size
    ? await AnnouncementRead.countDocuments({
        announcement: announcementId,
        resident: { $in: [...eligible].map((id) => new mongoose.Types.ObjectId(id)) },
      })
    : 0;
  const totalEligibleResidents = eligible.size;
  return {
    totalEligibleResidents,
    readCount,
    unreadCount: Math.max(0, totalEligibleResidents - readCount),
    readPercentage: totalEligibleResidents
      ? Math.round((readCount / totalEligibleResidents) * 100)
      : 0,
  };
}

export async function getReadCountsByAnnouncement(
  announcements: Array<{ id: string; residenceId: string }>,
  eligibleByResidence: Map<string, Set<string>>
) {
  if (announcements.length === 0) return new Map<string, number>();
  const ids = announcements.map((item) => item.id);
  const eligibleUsers = [...new Set(
    announcements.flatMap((item) => [...(eligibleByResidence.get(item.residenceId) ?? [])])
  )];
  if (eligibleUsers.length === 0) return new Map<string, number>();
  const residenceByAnnouncement = new Map(announcements.map((item) => [item.id, item.residenceId]));
  const rows = await AnnouncementRead.aggregate<{
    _id: { announcement: mongoose.Types.ObjectId; resident: mongoose.Types.ObjectId };
  }>([
    {
      $match: {
        announcement: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
        resident: { $in: eligibleUsers.map((id) => new mongoose.Types.ObjectId(id)) },
      },
    },
    { $group: { _id: { announcement: "$announcement", resident: "$resident" } } },
  ]);
  const counts = new Map<string, number>();
  for (const row of rows) {
    const announcementId = String(row._id.announcement);
    const residenceId = residenceByAnnouncement.get(announcementId);
    if (!residenceId || !eligibleByResidence.get(residenceId)?.has(String(row._id.resident))) continue;
    counts.set(announcementId, (counts.get(announcementId) ?? 0) + 1);
  }
  return counts;
}
