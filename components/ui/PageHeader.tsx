import React from "react";
import clsx from "clsx";

export interface PageHeaderProps {
  /** Sur-titre style redesign (souvent en bleu, uppercase). */
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/** En-tête de page alignée sur le redesign (eyebrow bleu + titre extrabold + sous-titre discret). */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={clsx(
        "flex flex-col gap-3 border-b border-slate-200/80 pb-5 dark:border-white/[0.08] sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="sp-page-header min-w-0">
        {eyebrow ? (
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="sp-title mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="sp-body mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
