"use client";

import { CalendarClock, CalendarDays, Pin, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { AnnouncementItem } from "./types";
import { AnnouncementAudienceLabel, AnnouncementCategoryBadge, AnnouncementPriorityBadge, AnnouncementStatusBadge } from "./AnnouncementBadges";

function isExpired(item: AnnouncementItem) {
  return item.status === "PUBLISHED" && Boolean(item.expiresAt && new Date(item.expiresAt) <= new Date());
}

const categoryStrip: Record<AnnouncementItem["category"], string> = {
  GENERAL: "bg-sky-500",
  MAINTENANCE: "bg-amber-500",
  SECURITY: "bg-rose-500",
  MEETING: "bg-indigo-500",
  PAYMENT: "bg-emerald-500",
  EMERGENCY: "bg-rose-600",
  OTHER: "bg-slate-500",
};

export function AnnouncementCard({
  announcement,
  manager,
  onOpen,
  onEdit,
  onPublish,
  onArchive,
  onReadStats,
}: {
  announcement: AnnouncementItem;
  manager: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onPublish: () => void;
  onArchive: () => void;
  onReadStats: () => void;
}) {
  const residence = typeof announcement.residence === "string" ? "" : announcement.residence.name;
  const status = isExpired(announcement) ? "EXPIRED" : announcement.status;
  return (
    <Card className={`relative flex h-full flex-col gap-3 overflow-hidden border-t-0 pt-5 ${announcement.isPinned ? "border-sky-300 dark:border-sky-800" : ""}`}>
      <div aria-hidden="true" className={`absolute inset-x-0 top-0 h-0.5 ${categoryStrip[announcement.category]}`} />
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onOpen} className="min-h-[44px] min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500">
          <div className="flex items-center gap-2">
            {announcement.priority === "URGENT" && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-rose-600 ring-2 ring-rose-200 dark:ring-rose-900" />}
            <h2 className="line-clamp-2 text-base font-bold text-slate-900 hover:text-sky-700 dark:text-white dark:hover:text-sky-300">{announcement.title}</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">{residence || "Résidence"}{residence && typeof announcement.residence !== "string" && announcement.residence.city ? ` · ${announcement.residence.city}` : ""}</p>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {announcement.isPinned && <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-200"><Pin aria-hidden="true" className="h-3 w-3" />Épinglée</span>}
          {!manager && announcement.isRead === false && <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-200">NOUVEAU</span>}
        </div>
      </div>

      <p className="line-clamp-3 flex-1 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{announcement.content}</p>
      <div className="flex flex-wrap items-center gap-2">
        <AnnouncementCategoryBadge category={announcement.category} />
        <AnnouncementPriorityBadge priority={announcement.priority} />
        <AnnouncementStatusBadge status={status} />
        <AnnouncementAudienceLabel audience={announcement.audience} />
      </div>
      {manager && announcement.readStats && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500"><span>Lectures</span><strong>{announcement.readStats.readPercentage}%</strong></div>
          <div
            role="progressbar"
            aria-label="Taux de lecture"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={announcement.readStats.readPercentage}
            className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"
          >
            <div className="h-1.5 rounded-full bg-sky-600" style={{ width: `${announcement.readStats.readPercentage}%` }} />
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{status === "SCHEDULED" && announcement.scheduledAt ? new Date(announcement.scheduledAt).toLocaleString("fr-FR") : new Date(announcement.publishedAt).toLocaleDateString("fr-FR")}</span>
        {announcement.expiresAt && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />Expire {new Date(announcement.expiresAt).toLocaleDateString("fr-FR")}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onOpen} className="min-h-[44px] flex-1 rounded-xl bg-sky-50 px-3 text-sm font-semibold text-sky-800 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:bg-sky-950 dark:text-sky-200 dark:hover:bg-sky-900">Ouvrir</button>
        {manager && (
          <>
            <button type="button" onClick={onEdit} className="min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Modifier</button>
            {announcement.status === "DRAFT" || announcement.status === "SCHEDULED" ? <button type="button" onClick={onPublish} className="min-h-[44px] rounded-xl border border-emerald-200 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-900 dark:text-emerald-300">Publier</button> : null}
            <button type="button" onClick={onReadStats} className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Statistiques de lecture"><Users className="h-4 w-4" /></button>
            {announcement.status !== "ARCHIVED" && <button type="button" onClick={onArchive} className="min-h-[44px] rounded-xl border border-rose-200 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-900 dark:text-rose-300">Archiver</button>}
          </>
        )}
      </div>
    </Card>
  );
}
