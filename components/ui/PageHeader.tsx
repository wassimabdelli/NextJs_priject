import React from "react";
import clsx from "clsx";

export interface PageHeaderProps {
  /** Libellé discret au-dessus du titre (style SaaS bento). */
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/** En-tête de page standard SyndicPro (sur-titre discret + titre fort + actions). */
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
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="sp-page-header min-w-0">
        {eyebrow ? (
          <p className="text-pretty text-xs font-medium text-slate-500 dark:text-slate-400">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="sp-title text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="sp-body mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
