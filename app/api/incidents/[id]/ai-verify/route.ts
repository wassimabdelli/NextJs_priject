import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json } from "@/lib/api";
import { isAiEnabled, type ImagePart } from "@/lib/ai/gemini";
import { verifyResolution } from "@/lib/ai/verifyResolution";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { requireIncidentAccess } from "@/lib/incidents/access";
import { Role } from "@/types/enums";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const DATA_IMAGE_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const UPLOAD_IMAGE_PATTERN = /^\/uploads\/([\w.-]+)$/;

async function loadImageAsBase64(urlOrPath: string): Promise<ImagePart> {
  const dataUrlMatch = DATA_IMAGE_PATTERN.exec(urlOrPath);
  if (dataUrlMatch) {
    const data = dataUrlMatch[2];
    const buffer = Buffer.from(data, "base64");
    if (buffer.length > MAX_IMAGE_BYTES) throw new HttpError(400, "Image trop volumineuse");
    return { mimeType: dataUrlMatch[1], data: buffer.toString("base64") };
  }

  const uploadMatch = UPLOAD_IMAGE_PATTERN.exec(urlOrPath);
  if (!uploadMatch) throw new HttpError(400, "Format de photo non pris en charge");

  const uploadsDirectory = path.resolve(process.cwd(), "public", "uploads");
  const filePath = path.resolve(uploadsDirectory, uploadMatch[1]);
  if (!filePath.startsWith(`${uploadsDirectory}${path.sep}`)) {
    throw new HttpError(400, "Chemin de photo invalide");
  }

  const buffer = await readFile(filePath);
  if (buffer.length > MAX_IMAGE_BYTES) throw new HttpError(400, "Image trop volumineuse");
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = extension === ".jpg" || extension === ".jpeg"
    ? "image/jpeg"
    : extension === ".png"
    ? "image/png"
    : extension === ".webp"
    ? "image/webp"
    : null;
  if (!mimeType) throw new HttpError(400, "Format de photo non pris en charge");
  return { mimeType, data: buffer.toString("base64") };
}

async function handleVerification(
  _req: NextRequest,
  user: AuthUser,
  context?: unknown
) {
  const params = await Promise.resolve((context as RouteContext | undefined)?.params);
  const id = params?.id;
  if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant d'incident invalide");

  const incident = await requireIncidentAccess(user, id);
  if (
    user.role !== Role.ADMIN
    && user.role !== Role.SYNDIC
    && !(user.role === Role.RESIDENT && incident.reportedBy?.toString() === user.id)
  ) {
    throw new HttpError(403, "Accès interdit");
  }
  if (!incident.resolutionPhotos?.length) {
    throw new HttpError(400, "Aucune photo de résolution à vérifier");
  }
  if (!isAiEnabled()) {
    throw new HttpError(503, "Assistance IA non configurée");
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new HttpError(503, "La vérification des photos nécessite une clé Gemini");
  }

  const before = await Promise.all((incident.photos ?? []).slice(0, 3).map(loadImageAsBase64));
  const after = await Promise.all(incident.resolutionPhotos.slice(0, 3).map(loadImageAsBase64));
  let result;
  try {
    result = await verifyResolution({
      problemDescription: incident.description,
      technicianNote: incident.resolutionDescription,
      before,
      after,
    });
  } catch {
    throw new HttpError(502, "La vérification IA est indisponible pour le moment");
  }
  const checkedAt = new Date();
  incident.aiResolutionCheck = { ...result, checkedAt };
  await incident.save();

  return json({ data: { ...result, checkedAt } });
}

export const POST = withAuth(handleVerification, {
  roles: [Role.RESIDENT, Role.SYNDIC, Role.ADMIN],
});
