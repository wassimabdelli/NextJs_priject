import React from "react";
import clsx from "clsx";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: { value: string | number; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, id, options, children, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-[13px] font-medium text-slate-600 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          className={clsx(
            "min-h-11 w-full rounded-2xl border bg-white px-4 py-2.5 text-base text-slate-900 shadow-sm transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-2 focus:ring-sky-400/50 disabled:bg-slate-50 disabled:opacity-60 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800",
            error
              ? "border-rose-400 focus:border-rose-500 focus:ring-rose-300"
              : "border-slate-200 focus:border-sky-400 dark:border-slate-700",
            className
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error ? (
          <p className="text-xs text-rose-500" role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-pretty text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Select.displayName = "Select";
