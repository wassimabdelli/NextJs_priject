import Link from "next/link";
import { Bell, ExternalLink } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";

interface NotificationPreviewItem {
  _id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedResource?: { resourceType: string; resourceId?: string | null };
}

function notificationHref(item: NotificationPreviewItem) {
  const resource = item.relatedResource;
  if (resource?.resourceType === "INCIDENT" && resource.resourceId) {
    return `/incidents?incident=${encodeURIComponent(resource.resourceId)}`;
  }
  if (resource?.resourceType === "ANNOUNCEMENT" && resource.resourceId) {
    return `/announcements?announcement=${encodeURIComponent(resource.resourceId)}`;
  }
  return "/notifications";
}

export function NotificationPreview({
  items = [],
  unreadCount,
}: {
  items?: NotificationPreviewItem[];
  unreadCount?: number;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          <CardTitle>Notifications récentes</CardTitle>
          {unreadCount !== undefined && unreadCount > 0 && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">{unreadCount} non lue(s)</span>}
        </div>
        <Link href="/notifications" className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300">
          Tout voir <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      {!items.length ? (
        <p className="py-3 text-sm text-slate-500">Aucune notification récente.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((item) => (
            <li key={item._id} className="py-3 first:pt-0 last:pb-0">
              <Link href={notificationHref(item)} className="flex items-start gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.isRead ? "bg-slate-300 dark:bg-slate-600" : "bg-sky-500"}`} aria-label={item.isRead ? "Lue" : "Non lue"} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{item.message}</span>
                </span>
                <time dateTime={item.createdAt} className="shrink-0 text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleDateString("fr-FR")}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
