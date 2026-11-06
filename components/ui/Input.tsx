import React from "react";
import clsx from "clsx";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const errorId = error && inputId ? `${inputId}-error` : undefined;
    const helperId = helperText && inputId ? `${inputId}-help` : undefined;

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium text-slate-600 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, helperId].filter(Boolean).join(" ") || undefined}
          className={clsx(
            "min-h-11 w-full rounded-2xl border bg-white px-4 py-2.5 text-base text-slate-900 shadow-sm transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/50 disabled:bg-slate-50 disabled:opacity-60 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:disabled:bg-slate-800",
            error
              ? "border-rose-400 focus:border-rose-500 focus:ring-rose-300"
              : "border-slate-200 focus:border-sky-400 dark:border-slate-700",
            className
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} className="text-xs text-rose-500" role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-pretty text-xs text-slate-500 dark:text-slate-400">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
