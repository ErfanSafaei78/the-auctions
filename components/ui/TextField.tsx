"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface TextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, value, onValueChange, className, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-xs font-medium text-muted">
          {label}
        </label>

        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            className={cn(
              "h-9 w-full rounded-md border border-line bg-surface px-3 pe-8 text-sm text-fg",
              "placeholder:text-subtle transition-[border-color,box-shadow] duration-150 ease-out",
              "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft",
              className,
            )}
            {...props}
          />

          {value ? (
            <button
              type="button"
              aria-label="پاک کردن"
              onClick={() => onValueChange("")}
              className="absolute end-1 top-1/2 -translate-y-1/2 rounded-sm p-1 text-subtle transition-colors hover:text-fg"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    );
  },
);

TextField.displayName = "TextField";
