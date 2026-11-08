import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { HttpError } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Role } from "@/types/enums";
import { isAiEnabled, type ImagePart } from "@/lib/ai/gemini";
import { triageIncident } from "@/lib/ai/triage";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024;
const hits = new Map<string, number[]>();

function rateLimited(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((timestamp) => now - timestamp < 60_000);
  if (recent.length >= 8) return true;
  recent.push(now);
  hits.set(userId, recent);

  if (hits.size > 5000) {
    for (const [id, timestamps] of hits) {
      if (!timestamps.some((timestamp) => now - timestamp < 60_000)) hits.delete(id);
    }
  }
  return false;
}

const InputSchema = z.object({
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
});

async function handleTriage(_req: NextRequest, user: AuthUser) {
  let formData: FormData;
  try {
    formData = await _req.formData();
  } catch {
    throw new HttpError(400, "Formulaire multipart invalide");
  }

  const imageEntries = formData.getAll("images");
  if (imageEntries.length > 3) {
    throw new HttpError(400, "Vous pouvez joindre trois images au maximum");
  }
  const input = InputSchema.safeParse({
    title: formData.get("title") || undefined,
    description: formData.get("description") || undefined,
  });
  if (!input.success) throw new HttpError(400, "Données invalides");

  if (imageEntries.length === 0) {
    if ((input.data.title?.length ?? 0) < 3 || (input.data.description?.length ?? 0) < 10) {
      throw new HttpError(400, "Ajoutez un titre et une description pour l'analyse sans photo");
    }
    if (!isAiEnabled()) {
      return NextResponse.json({ error: "Assistance IA non configurée" }, { status: 503 });
    }
  } else if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "L'analyse des photos nécessite une clé GEMINI_API_KEY valide." },
      { status: 503 }
    );
  }
  if (rateLimited(user.id)) {
    return NextResponse.json(
      { error: "Trop de requêtes, réessayez dans une minute" },
      { status: 429 }
    );
  }

  const images: ImagePart[] = [];
  for (const entry of imageEntries) {
    if (!(entry instanceof File)) {
      throw new HttpError(400, "Fichier image invalide");
    }
    if (!ALLOWED.includes(entry.type) || entry.size > MAX_BYTES) {
      throw new HttpError(400, "Image invalide (jpeg/png/webp, 4 Mo max)");
    }
    images.push({
      mimeType: entry.type,
      data: Buffer.from(await entry.arrayBuffer()).toString("base64"),
    });
  }

  try {
    const data = await triageIncident({
      title: input.data.title,
      description: input.data.description,
      images,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : 0;
    const message = error instanceof Error ? error.message : "";
    if (status === 429 || /quota|resource.?exhausted|rate.?limit/i.test(message)) {
      return NextResponse.json(
        { error: "Quota Gemini atteint. Réessayez plus tard ou vérifiez les limites de votre projet Google AI Studio." },
        { status: 429 }
      );
    }
    if (error instanceof Error && error.message === "AI_UNAVAILABLE") {
      return NextResponse.json(
        { error: "Gemini ne peut pas analyser la photo. Vérifiez la clé et le modèle configurés." },
        { status: 503 }
      );
    }
    console.error("[ai/triage] Provider request failed");
    return NextResponse.json(
      { error: "L'assistance IA est indisponible pour le moment" },
      { status: 502 }
    );
  }
}

export const POST = withAuth(handleTriage, {
  roles: [Role.RESIDENT, Role.SYNDIC, Role.ADMIN],
});
