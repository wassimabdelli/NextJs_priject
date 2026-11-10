import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import {
  formatWhatsAppPhone,
  getWhatsAppConfigStatus,
  sendWhatsApp,
} from "@/lib/notifications/notify";
import { User } from "@/models/User";
import { Role } from "@/types/enums";

const testWhatsAppSchema = z.object({
  phone: z.string().trim().min(8, "Numéro trop court (min. 8 caractères)").max(20).optional(),
});

/**
 * POST /api/notifications/test-whatsapp
 * Envoie un message WhatsApp de test à l'utilisateur connecté via Meta Cloud API.
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthUser) => {
    const data = await parseBody(req, testWhatsAppSchema);

    const dbUser = await User.findById(user.id).select("name phone").lean();
    if (!dbUser) throw new HttpError(404, "Utilisateur introuvable");

    const targetPhone = data.phone ?? dbUser.phone ?? "";
    if (!targetPhone.trim()) {
      throw new HttpError(400, "Veuillez saisir votre numéro WhatsApp avant de tester.");
    }

    let chatId: string;
    try {
      chatId = formatWhatsAppPhone(targetPhone);
    } catch (err) {
      throw new HttpError(400, err instanceof Error ? err.message : "Numéro invalide");
    }

    // Enregistre le numéro saisi sur le compte connecté si fourni
    if (data.phone && data.phone !== dbUser.phone) {
      await User.findByIdAndUpdate(user.id, { $set: { phone: data.phone } });
    }

    const { configured, provider, missing } = getWhatsAppConfigStatus();
    if (!configured) {
      throw new HttpError(
        400,
        `Configuration WhatsApp incomplète (${missing.join(", ")} manquant dans .env.local). Numéro prêt : ${chatId}.`
      );
    }

    const timeLabel = new Date().toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const text = `SyndicPro · Test WhatsApp (${provider.toUpperCase()}) réussi pour ${dbUser.name || user.name || "votre compte"} (${timeLabel}).`;

    try {
      const result = await sendWhatsApp(targetPhone, text);
      return json(
        {
          ok: true,
          chatId: result.chatId,
          provider: result.provider,
          message: `Message WhatsApp de test envoyé vers ${result.chatId} via ${result.provider.toUpperCase()}.`,
        },
        200
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de l'envoi WhatsApp";
      throw new HttpError(502, message);
    }
  },
  {
    roles: [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT, Role.TECHNICIAN],
  }
);

