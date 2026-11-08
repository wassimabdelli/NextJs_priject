import { Download, FileImage, FileText } from "lucide-react";
import type { AnnouncementAttachment } from "./types";

export function AnnouncementAttachmentList({ attachments }: { attachments: AnnouncementAttachment[] }) {
  if (!attachments.length) return null;
  return (
    <ul className="space-y-2">
      {attachments.map((attachment) => (
        <li key={attachment.url}>
          <a
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {attachment.mimeType.startsWith("image/") ? <FileImage className="h-5 w-5 text-sky-600" /> : <FileText className="h-5 w-5 text-rose-600" />}
            <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
            <span className="text-xs text-slate-500">{Math.ceil(attachment.size / 1024)} Ko</span>
            <Download className="h-4 w-4" />
          </a>
        </li>
      ))}
    </ul>
  );
}
