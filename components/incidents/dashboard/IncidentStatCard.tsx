import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

const colors = {
  blue: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  orange: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  red: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  purple: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

export interface IncidentStatCardProps {
  title: string;
  value: number | string;
  description?: string;
  icon: ReactNode;
  trend?: number;
  color?: keyof typeof colors;
}

export function IncidentStatCard({
  title,
  value,
  description,
  icon,
  trend,
  color = "blue",
}: IncidentStatCardProps) {
  return (
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
          {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
          {trend !== undefined && (
            <p className="mt-1 text-xs font-medium text-slate-500">
              {trend > 0 ? "+" : ""}{trend}% sur la période
            </p>
          )}
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors[color]}`}>{icon}</span>
      </div>
    </Card>
  );
}
