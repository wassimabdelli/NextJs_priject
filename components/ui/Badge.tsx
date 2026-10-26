import React from "react";
import clsx from "clsx";
import {
  chargeStatusLabel,
  incidentStatusLabel,
  priorityLabel,
  type ChargeStatus,
  type IncidentStatus,
  type Priority,
} from "@/types/enums";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "neutral";
  chargeStatus?: ChargeStatus;
  incidentStatus?: IncidentStatus;
  priority?: Priority;
}

export function Badge({
  className,
  variant,
  chargeStatus,
  incidentStatus,
  priority,
  children,
  ...props
}: BadgeProps) {
  let computedVariant = variant || "default";
  let content = children;

  if (chargeStatus) {
    content = chargeStatusLabel[chargeStatus];
    switch (chargeStatus) {
      case "PAID":
        computedVariant = "success";
        break;
      case "PARTIAL":
        computedVariant = "warning";
        break;
      case "OVERDUE":
        computedVariant = "danger";
        break;
      case "PENDING":
        computedVariant = "info";
        break;
    }
  } else if (incidentStatus) {
    content = incidentStatusLabel[incidentStatus];
    switch (incidentStatus) {
      case "RESOLVED":
        computedVariant = "success";
        break;
      case "IN_PROGRESS":
        computedVariant = "info";
        break;
      case "ASSIGNED":
        computedVariant = "warning";
        break;
      case "REPORTED":
        computedVariant = "danger";
        break;
    }
  } else if (priority) {
    content = priorityLabel[priority];
    switch (priority) {
      case "URGENT":
        computedVariant = "danger";
        break;
      case "HIGH":
        computedVariant = "warning";
        break;
      case "MEDIUM":
        computedVariant = "info";
        break;
      case "LOW":
        computedVariant = "neutral";
        break;
    }
  }

  const variantStyles = {
    default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    success:
      "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-emerald-400/20",
    warning:
      "bg-amber-500/10 text-amber-700 border border-amber-500/20 dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-400/20",
    danger:
      "bg-rose-500/10 text-rose-700 border border-rose-500/20 dark:bg-rose-400/10 dark:text-rose-400 dark:border-rose-400/20",
    info:
      "bg-sky-500/10 text-sky-700 border border-sky-500/20 dark:bg-sky-400/10 dark:text-sky-400 dark:border-sky-400/20",
    neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide select-none",
        variantStyles[computedVariant],
        className
      )}
      {...props}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {content}
    </span>
  );
}
