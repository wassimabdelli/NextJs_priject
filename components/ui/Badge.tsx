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
    success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    danger: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    info: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };

  return (
    <span
      className={clsx(
        "inline-flex select-none items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        variantStyles[computedVariant],
        className
      )}
      {...props}
    >
      {content}
    </span>
  );
}
