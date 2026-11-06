import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { User } from "@/models/User";
import { Role } from "@/types/enums";

const prefsSchema = z.object({
  notifyInApp: z.boolean().optional(),
  notifyWhatsApp: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
  phone: z.string().trim().min(8).max(20).optional(),
  pushSubscription: z
    .object({
      endpoint: z.string().url(),
      keys: z.object({ p256dh: z.string(), auth: z.string() }),
    })
    .nullable()
    .optional(),
});

export const GET = withAuth(
  async (_req: NextRequest, user: AuthUser) => {
    const doc = await User.findById(user.id)
      .select("phone notifyInApp notifyWhatsApp notifyPush pushSubscription")
      .lean();
    if (!doc) throw new HttpError(404, "Utilisateur introuvable");
    return json({
      phone: doc.phone || "",
      notifyInApp: doc.notifyInApp !== false,
      notifyWhatsApp: !!doc.notifyWhatsApp,
      notifyPush: !!doc.notifyPush,
      hasPushSubscription: !!doc.pushSubscription?.endpoint,
      vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null,
    });
  },
  {
    roles: [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT, Role.TECHNICIAN],
  }
);

export const PATCH = withAuth(
  async (req: NextRequest, user: AuthUser) => {
    const data = await parseBody(req, prefsSchema);
    const update: Record<string, unknown> = {};
    if (data.notifyInApp !== undefined) update.notifyInApp = data.notifyInApp;
    if (data.notifyWhatsApp !== undefined) update.notifyWhatsApp = data.notifyWhatsApp;
    if (data.notifyPush !== undefined) update.notifyPush = data.notifyPush;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.pushSubscription === null) update.pushSubscription = undefined;
    else if (data.pushSubscription) update.pushSubscription = data.pushSubscription;

    const doc = await User.findByIdAndUpdate(user.id, { $set: update }, { new: true })
      .select("phone notifyInApp notifyWhatsApp notifyPush")
      .lean();

    return json(doc, 200);
  },
  {
    roles: [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT, Role.TECHNICIAN],
  }
);
