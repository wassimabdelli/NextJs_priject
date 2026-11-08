"use client";

import { CircleAlert } from "lucide-react";

export function AIError({ message }: { message: string }) {
  return <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{message}</p>;
}
