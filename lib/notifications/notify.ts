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
 * Envoi via WaAPI (https://waapi.app).
 * Env : WHATSAPP_TOKEN (Bearer) + WAAPI_INSTANCE_ID (après création d'instance + QR).
 * Sans les deux → log uniquement (dev).
 */
async function sendWhatsApp(phone: string, text: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const instanceId = process.env.WAAPI_INSTANCE_ID;
  // Format WaAPI : indicatif + numéro, chiffres seuls (ex. 216XXXXXXXX)
  const digits = phone.replace(/\D/g, "");
  const chatId = digits.includes("@") ? digits : `${digits}@c.us`;

  if (!token || !instanceId) {
    console.info(`[whatsapp:dev] → ${chatId}: ${text.slice(0, 120)}`);
    return;
  }

  const res = await fetch(
    `https://waapi.app/api/v1/instances/${instanceId}/client/action/send-message`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        chatId,
        message: text.slice(0, 4000),
      }),
    }
  );

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`WaAPI ${res.status}: ${JSON.stringify(payload)}`);
  }
  // WaAPI peut renvoyer HTTP 200 avec data.status === "error"
  if (payload?.data?.status === "error" || payload?.status === "error") {
    throw new Error(
      `WaAPI action error: ${payload?.data?.message || payload?.message || "échec"}`
    );
  }
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
