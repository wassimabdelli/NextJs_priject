import { Charge } from "@/models/Charge";
import { Meeting } from "@/models/Meeting";
import { Apartment } from "@/models/Apartment";
import { Resident } from "@/models/Resident";
import { notifyUser } from "@/lib/notifications/notify";
import { ChargeStatus, MeetingStatus, ReminderType } from "@/types/enums";

/**
 * Rappels charges impayées / partielles / en retard (une fois par jour et par charge).
 */
export async function runUnpaidChargeReminders(): Promise<number> {
  const charges = await Charge.find({
    status: { $in: [ChargeStatus.PENDING, ChargeStatus.PARTIAL, ChargeStatus.OVERDUE] },
  })
    .populate({ path: "apartment", select: "number owner residence" })
    .lean();

  const dayKey = new Date().toISOString().slice(0, 10);
  let sent = 0;

  for (const charge of charges) {
    const apt = charge.apartment as
      | { _id: unknown; number?: string; owner?: unknown; residence?: unknown }
      | null;
    if (!apt?._id) continue;

    const remaining =
      Math.round((charge.amount - (charge.paidAmount || 0)) * 100) / 100;
    if (remaining <= 0) continue;

    const userIds = new Set<string>();
    if (apt.owner) userIds.add(String(apt.owner));

    const residents = await Resident.find({
      apartment: apt._id,
      isActive: true,
      user: { $ne: null },
    })
      .select("user")
      .lean();
    for (const r of residents) {
      if (r.user) userIds.add(String(r.user));
    }

    const title = "Rappel de charges";
    const body = `Lot ${apt.number ?? "—"} · période ${charge.period} · reste ${remaining.toFixed(2)} TND (${charge.status}).`;

    for (const userId of userIds) {
      await notifyUser({
        userId,
        type: ReminderType.UNPAID_CHARGE,
        title,
        body,
        dedupeKey: `unpaid:${charge._id}:${userId}:${dayKey}`,
        meta: { chargeId: String(charge._id), remaining },
      });
      sent += 1;
    }
  }

  return sent;
}

/**
 * Rappels AG prévues dans les prochaines 24–48 h.
 */
export async function runMeetingTomorrowReminders(): Promise<number> {
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);

  const meetings = await Meeting.find({
    status: { $in: [MeetingStatus.PLANNED, MeetingStatus.OPEN] },
    date: { $gte: now, $lte: in48h },
  }).lean();

  let sent = 0;
  const dayKey = new Date().toISOString().slice(0, 10);

  for (const meeting of meetings) {
    const apartments = await Apartment.find({ residence: meeting.residence })
      .select("_id owner")
      .lean();
    const aptIds = apartments.map((a) => a._id);
    const userIds = new Set<string>();
    for (const a of apartments) {
      if (a.owner) userIds.add(String(a.owner));
    }
    const residents = await Resident.find({
      apartment: { $in: aptIds },
      isActive: true,
      user: { $ne: null },
    })
      .select("user")
      .lean();
    for (const r of residents) {
      if (r.user) userIds.add(String(r.user));
    }

    const when = new Date(meeting.date).toLocaleString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    const title = "Assemblée générale demain";
    const body = `${meeting.title} — ${when}${meeting.location ? ` · ${meeting.location}` : ""}`;

    for (const userId of userIds) {
      await notifyUser({
        userId,
        type: ReminderType.MEETING_TOMORROW,
        title,
        body,
        dedupeKey: `meeting:${meeting._id}:${userId}:${dayKey}`,
        meta: { meetingId: String(meeting._id) },
      });
      sent += 1;
    }
  }

  return sent;
}

export async function runAllScheduledReminders() {
  const unpaid = await runUnpaidChargeReminders();
  const meetings = await runMeetingTomorrowReminders();
  return { unpaid, meetings };
}
