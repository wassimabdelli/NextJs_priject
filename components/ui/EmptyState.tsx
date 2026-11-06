import React from "react";
import { FolderOpen } from "lucide-react";
import clsx from "clsx";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "sp-card flex min-h-56 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200/80 bg-white p-8 text-center dark:border-slate-700/80 dark:bg-slate-900",
        className
      )}
    >
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
        {icon || <FolderOpen className="size-6 stroke-[1.75]" aria-hidden />}
      </div>
      <h4 className="text-balance text-base font-semibold text-slate-800 dark:text-slate-200">
        {title}
      </h4>
      {description && (
        <p className="mt-1 max-w-sm text-pretty text-xs text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
