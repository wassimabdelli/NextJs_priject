import mongoose from "mongoose";
import { Announcement } from "@/models/Announcement";
import { AnnouncementStatus } from "@/types/enums";
import { notifyAnnouncementPublished } from "@/lib/notifications/events";

export async function publishDueAnnouncements(residenceIds: string[] | null, now = new Date()) {
  if (residenceIds?.length === 0) return 0;
  const filter: Record<string, unknown> = {
    status: AnnouncementStatus.SCHEDULED,
    scheduledAt: { $lte: now },
    $and: [
      {
        $or: [
          { expiresAt: null },
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: now } },
        ],
      },
      {
        $or: [
          { intelligenceSource: { $exists: false } },
          { "intelligenceSource.reviewStatus": "APPROVED" },
        ],
      },
    ],
  };
  if (residenceIds) {
    filter.residence = {
      $in: residenceIds.map((id) => new mongoose.Types.ObjectId(id)),
    };
  }
  const due = await Announcement.find(filter).select("_id").lean();
  let publishedCount = 0;
  for (const { _id } of due) {
    const published = await Announcement.findOneAndUpdate(
      { ...filter, _id },
      [
        {
          $set: {
            status: AnnouncementStatus.PUBLISHED,
            publishedAt: "$scheduledAt",
            scheduledAt: null,
          },
        },
      ],
      { new: true }
    ).lean();
    if (published) {
      publishedCount += 1;
      await notifyAnnouncementPublished(
        published,
        `announcement:${published._id}:published:${new Date(published.publishedAt).toISOString()}`
      );
    }
  }
  return publishedCount;
}
