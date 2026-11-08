import { readFile } from "fs/promises";
import path from "path";
import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { canManageAnnouncement, canReadAnnouncement, getAnnouncementResidenceIds } from "@/lib/announcements/access";
import { publishDueAnnouncements } from "@/lib/announcements/publication";
import { Announcement } from "@/models/Announcement";
import { Role } from "@/types/enums";

type RouteContext = { params: Promise<{ fileId: string }> };
const FILE_ID_PATTERN = /^[a-f\d-]{36}\.(pdf|jpg|png)$/i;

export const GET = withAuth(async (req: NextRequest, user: AuthUser, context?: RouteContext) => {
  const { fileId = "" } = await (context?.params ?? Promise.resolve({ fileId: "" }));
  if (!FILE_ID_PATTERN.test(fileId)) throw new HttpError(404, "Fichier introuvable");
  const residenceIds = await getAnnouncementResidenceIds(user);
  await publishDueAnnouncements(residenceIds);
  const attachmentUrl = `/api/announcements/attachments/${fileId}`;
  const announcement = await Announcement.findOne({ "attachments.url": attachmentUrl }).lean();
  if (!announcement) throw new HttpError(404, "Fichier introuvable");
  const manager = user.role === Role.ADMIN || user.role === Role.SYNDIC;
  const authorized = manager
    ? canManageAnnouncement(user, announcement, residenceIds)
    : canReadAnnouncement(user, announcement, residenceIds);
  if (!authorized || !isValidObjectId(String(announcement._id))) {
    throw new HttpError(404, "Fichier introuvable");
  }

  const filePath = path.join(process.cwd(), "data", "private-announcements", fileId);
  let bytes: Buffer;
  try {
    bytes = await readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new HttpError(404, "Fichier introuvable");
    throw error;
  }
  const attachment = announcement.attachments.find((item) => item.url === attachmentUrl);
  const filename = encodeURIComponent(attachment?.name || "announcement-attachment");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment?.mimeType || "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${req.nextUrl.searchParams.get("inline") === "1" && attachment?.mimeType.startsWith("image/") ? "inline" : "attachment"}; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
