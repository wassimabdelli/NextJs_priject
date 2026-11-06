import React from "react";
import clsx from "clsx";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

export interface StatCardProps {
  label: string;
  value?: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  trend?: { value: string; direction?: "up" | "down" | "neutral" };
  loading?: boolean;
  className?: string;
  footer?: React.ReactNode;
  size?: "md" | "lg";
}

/** KPI bento — grand chiffre, pastille de tendance, ombre douce. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
  loading,
  className,
  footer,
  size = "md",
}: StatCardProps) {
  return (
    <div className={clsx("sp-card flex flex-col justify-between p-5 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
        {icon ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {icon}
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        {loading ? (
          <Skeleton className="h-10 w-32 rounded-xl" />
        ) : (
          <p
            className={clsx(
              "sp-num font-bold text-slate-900 dark:text-white",
              size === "lg" ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl"
            )}
          >
            {value}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {trend ? (
            <span
              className={clsx(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                trend.direction === "down"
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                  : trend.direction === "neutral"
                    ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
              )}
            >
              {trend.direction === "down" ? (
                <TrendingDown className="size-3" aria-hidden />
              ) : trend.direction === "up" ? (
                <TrendingUp className="size-3" aria-hidden />
              ) : null}
              {trend.value}
            </span>
          ) : null}
          {hint ? (
            <p className="text-pretty text-xs text-slate-500 dark:text-slate-400">{hint}</p>
          ) : null}
        </div>
        {footer ? <div className="mt-4">{footer}</div> : null}
      </div>
    </div>
  );
}
