import { Reminder } from "@/models/Reminder";
import { User } from "@/models/User";
import {
  ReminderChannel,
  ReminderStatus,
  ReminderType,
} from "@/types/enums";

export interface NotifyInput {
  userId: string;
  type: ReminderType;
  title: string;
  body: string;
  dedupeKey: string;
  meta?: Record<string, unknown>;
  /** Canaux forcés ; sinon dérivés des préférences utilisateur */
  channels?: ReminderChannel[];
}

interface UserNotifyPrefs {
  phone?: string;
  notifyInApp?: boolean;
  notifyWhatsApp?: boolean;
  notifyPush?: boolean;
  pushSubscription?: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
}

/**
 * Enregistre un rappel in-app et tente WhatsApp / Web Push selon les prefs.
 * Déduplication via dedupeKey + channel (index unique).
 */
export async function notifyUser(input: NotifyInput): Promise<void> {
  const user = (await User.findById(input.userId)
    .select("phone notifyInApp notifyWhatsApp notifyPush pushSubscription")
    .lean()) as UserNotifyPrefs | null;
  if (!user) return;

  const channels =
    input.channels ??
    ([
      user.notifyInApp !== false ? ReminderChannel.IN_APP : null,
      user.notifyWhatsApp && user.phone ? ReminderChannel.WHATSAPP : null,
      user.notifyPush && user.pushSubscription ? ReminderChannel.PUSH : null,
    ].filter(Boolean) as ReminderChannel[]);

  for (const channel of channels) {
    try {
      const existing = await Reminder.findOne({
        dedupeKey: input.dedupeKey,
        channel,
      });
      if (existing && existing.status === ReminderStatus.SENT) continue;

      const reminder =
        existing ||
        (await Reminder.create({
          user: input.userId,
          type: input.type,
          channel,
          title: input.title,
          body: input.body,
          dedupeKey: input.dedupeKey,
          status: ReminderStatus.PENDING,
          scheduledFor: new Date(),
          meta: input.meta,
        }));

      if (channel === ReminderChannel.WHATSAPP) {
        await sendWhatsApp(user.phone!, `${input.title}\n\n${input.body}`);
      } else if (channel === ReminderChannel.PUSH && user.pushSubscription) {
        await sendWebPush(user.pushSubscription, input.title, input.body);
      }

      reminder.status = ReminderStatus.SENT;
      reminder.sentAt = new Date();
      reminder.error = undefined;
      await reminder.save();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec d'envoi";
      await Reminder.findOneAndUpdate(
        { dedupeKey: input.dedupeKey, channel },
        {
          $set: {
            status: ReminderStatus.FAILED,
            error: message,
            title: input.title,
            body: input.body,
            type: input.type,
            user: input.userId,
            scheduledFor: new Date(),
            meta: input.meta,
          },
          $setOnInsert: { channel, dedupeKey: input.dedupeKey },
        },
        { upsert: true }
      );
      console.error(`[notify] ${channel} failed for ${input.userId}:`, message);
    }
  }
}

/**
 * Normalise un numéro vers le format E.164 Meta (ex. 21626801850).
 * Préfixe automatiquement 216 pour un numéro tunisien local à 8 chiffres.
 */
export function formatWhatsAppPhone(phone: string): string {
  const trimmed = phone.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00") && digits.length > 10) {
    digits = digits.slice(2);
  }
  if (digits.length === 8) {
    digits = `216${digits}`;
  }
  if (digits.length < 8) {
    throw new Error("Numéro WhatsApp invalide (minimum 8 chiffres requis).");
  }
  return digits;
}

/** @deprecated Alias pour compatibilité — utilise formatWhatsAppPhone */
export function formatWhatsAppChatId(phone: string): string {
  return formatWhatsAppPhone(phone) + "@c.us";
}

export type WhatsAppProvider = "meta" | "none";

/**
 * Indique si Meta WhatsApp Cloud API est configuré côté serveur.
 */
export function getWhatsAppConfigStatus(): {
  configured: boolean;
  provider: WhatsAppProvider;
  missing: string[];
} {
  const hasToken = Boolean(process.env.META_WA_TOKEN?.trim());
  const hasPhoneId = Boolean(process.env.META_WA_PHONE_ID?.trim());
  if (hasToken && hasPhoneId) {
    return { configured: true, provider: "meta", missing: [] };
  }
  const missing: string[] = [];
  if (!hasToken) missing.push("META_WA_TOKEN");
  if (!hasPhoneId) missing.push("META_WA_PHONE_ID");
  return { configured: false, provider: "none", missing };
}

/**
 * Envoi via Meta WhatsApp Cloud API (gratuit, sans carte bancaire).
 * Docs : https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages
 */
export async function sendWhatsApp(
  phone: string,
  text: string
): Promise<{ chatId: string; provider: Exclude<WhatsAppProvider, "none"> }> {
  const to = formatWhatsAppPhone(phone);
  const { configured, missing } = getWhatsAppConfigStatus();

  if (!configured) {
    console.info(`[whatsapp:dev] (${missing.join(", ")} manquant) → ${to}: ${text.slice(0, 120)}`);
    throw new Error(`Configuration WhatsApp incomplète (${missing.join(", ")} manquant dans .env.local).`);
  }

  const token = process.env.META_WA_TOKEN!.trim();
  const phoneId = process.env.META_WA_PHONE_ID!.trim();

  let res: Response;
  try {
    res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text.slice(0, 4096) },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "connexion impossible";
    throw new Error(`Meta API injoignable (${msg}). Vérifiez votre connexion.`);
  }

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = payload?.error?.message || JSON.stringify(payload);
    throw new Error(`Meta WhatsApp API ${res.status}: ${detail}`);
  }

  return { chatId: to, provider: "meta" };
}

/**
 * Web Push via fetch vers un endpoint VAPID (optionnel).
 * Sans VAPID_PRIVATE_KEY → log uniquement.
 */
async function sendWebPush(
  subscription: NonNullable<UserNotifyPrefs["pushSubscription"]>,
  title: string,
  body: string
): Promise<void> {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY) {
    console.info(`[push:dev] → ${subscription.endpoint.slice(0, 48)}… ${title}`);
    return;
  }

  // Envoi minimal : beaucoup de projets branchent web-push ici.
  // On journalise l'intention tant que le paquet n'est pas ajouté.
  console.info(
    `[push] prêt (VAPID configuré) → ${subscription.endpoint.slice(0, 48)}…`,
    { title, body: body.slice(0, 80) }
  );
}
