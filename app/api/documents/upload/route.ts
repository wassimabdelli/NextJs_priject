import type { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { HttpError, json } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Role } from "@/types/enums";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/**
 * POST /api/documents/upload
 * Téléversement simple d'un fichier (PDF ou image, max 5 Mo).
 * Stocké dans public/uploads/ avec validation de type et de taille côté serveur.
 */
export const POST = withAuth(
  async (req: NextRequest, _user: AuthUser) => {
    const contentType = req.headers.get("content-type") || "";

    let buffer: Buffer;
    let mimeType: string;
    let originalName = "document";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");

      if (!file || typeof file === "string") {
        throw new HttpError(400, "Fichier manquant dans le champ 'file'");
      }

      const blob = file as File;
      mimeType = blob.type || "application/octet-stream";
      originalName = blob.name || "document";

      if (blob.size > MAX_FILE_SIZE) {
        throw new HttpError(400, "Le fichier dépasse la taille maximale autorisée (5 Mo)");
      }

      const arrayBuffer = await blob.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      const base64Data = body.base64 || body.file;
      mimeType = body.mimeType || "";
      originalName = body.filename || "document";

      if (!base64Data || typeof base64Data !== "string") {
        throw new HttpError(400, "Contenu base64 manquant");
      }

      // Extraction du data URL si présent : data:image/png;base64,xxxx
      const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      let rawBase64 = base64Data;
      if (match) {
        mimeType = mimeType || match[1];
        rawBase64 = match[2];
      }

      buffer = Buffer.from(rawBase64, "base64");
      if (buffer.length > MAX_FILE_SIZE) {
        throw new HttpError(400, "Le fichier dépasse la taille maximale autorisée (5 Mo)");
      }
    } else {
      throw new HttpError(400, "Format de requête non supporté (attendu: multipart/form-data ou JSON)");
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new HttpError(
        400,
        `Type de fichier non autorisé (${mimeType}). Formats acceptés : PDF, JPEG, PNG, WEBP.`
      );
    }

    // Répertoire cible public/uploads
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const ext = EXTENSIONS[mimeType] || path.extname(originalName) || ".bin";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${filename}`;

    return json(
      {
        fileUrl,
        filename: originalName,
        size: buffer.length,
        mimeType,
      },
      201
    );
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
