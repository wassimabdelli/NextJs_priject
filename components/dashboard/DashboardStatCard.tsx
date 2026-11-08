import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";

type StatTone = "neutral" | "info" | "warning" | "danger" | "success";

const toneClasses: Record<StatTone, { icon: string; value: string }> = {
  neutral: { icon: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", value: "text-slate-900 dark:text-white" },
  info: { icon: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300", value: "text-slate-900 dark:text-white" },
  warning: { icon: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", value: "text-amber-800 dark:text-amber-200" },
  danger: { icon: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300", value: "text-rose-700 dark:text-rose-300" },
  success: { icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", value: "text-emerald-700 dark:text-emerald-300" },
};

export function DashboardStatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
  tone?: StatTone;
}) {
  const classes = toneClasses[tone];
  return (
    <Card className="flex min-w-0 items-start gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${classes.icon}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className={`mt-1 text-2xl font-bold tracking-tight ${classes.value}`}>{value}</p>
        {detail && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>}
      </div>
    </Card>
  );
}
