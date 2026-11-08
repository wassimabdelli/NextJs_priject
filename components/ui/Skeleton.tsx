import React from "react";
import clsx from "clsx";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800/60",
        className
      )}
      {...props}
    />
  );
}
