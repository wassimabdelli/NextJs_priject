import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { HttpError, json } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { getAnnouncementResidenceIds } from "@/lib/announcements/access";
import { Residence } from "@/models/Residence";
import { Role } from "@/types/enums";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MIME_INFO = {
  "application/pdf": { extensions: ["pdf"], extension: "pdf", signature: (buffer: Buffer) => buffer.subarray(0, 5).toString() === "%PDF-" },
  "image/jpeg": { extensions: ["jpg", "jpeg"], extension: "jpg", signature: (buffer: Buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  "image/png": { extensions: ["png"], extension: "png", signature: (buffer: Buffer) => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
} as const;

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (user.role !== Role.ADMIN && user.role !== Role.SYNDIC) {
    throw new HttpError(403, "Téléversement réservé à ADMIN et SYNDIC");
  }
  const formData = await req.formData();
  const file = formData.get("file");
  const residence = formData.get("residence");
  if (!file || typeof file === "string" || typeof residence !== "string" || !mongoose.isValidObjectId(residence)) {
    throw new HttpError(400, "Fichier ou résidence manquant");
  }
  if (file.size < 1 || file.size > MAX_FILE_SIZE) {
    throw new HttpError(400, "Chaque fichier doit faire au maximum 5 Mo");
  }
  const residenceIds = await getAnnouncementResidenceIds(user);
  if (residenceIds && !residenceIds.includes(residence)) {
    throw new HttpError(403, "Vous ne gérez pas cette résidence");
  }
  if (!await Residence.exists({ _id: residence })) throw new HttpError(404, "Résidence introuvable");

  const mimeType = file.type as keyof typeof MIME_INFO;
  const info = MIME_INFO[mimeType];
  const fileExtension = path.extname(file.name).slice(1).toLowerCase();
  const validExtension = mimeType === "image/jpeg"
    ? fileExtension === "jpg" || fileExtension === "jpeg"
    : info && fileExtension === info.extension;
  if (!info || !validExtension) {
    throw new HttpError(400, "Formats acceptés : PDF, JPG, JPEG et PNG");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!info.signature(buffer)) throw new HttpError(400, "Le contenu du fichier ne correspond pas à son type");

  const fileId = `${randomUUID()}.${info.extension}`;
  const directory = path.join(process.cwd(), "data", "private-announcements");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileId), buffer, { flag: "wx" });
  return json({
    attachment: {
      name: path.basename(file.name).slice(0, 180),
      url: `/api/announcements/attachments/${fileId}`,
      mimeType,
      size: buffer.byteLength,
    },
  }, 201);
});
