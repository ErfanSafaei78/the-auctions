"use client";

import { cn } from "@/lib/cn";

export interface ToggleGroupOption<T extends string> {
  value: T;
  label: string;
}

export interface ToggleGroupProps<T extends string> {
  label: string;
  options: ToggleGroupOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
}

export function ToggleGroup<T extends string>({
  label,
  options,
  value,
  onValueChange,
}: ToggleGroupProps<T>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>

      <div
        role="group"
        aria-label={label}
        className="flex h-9 items-center gap-1 rounded-md border border-line bg-surface p-1"
      >
        {options.map((option) => {
          const active = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onValueChange(option.value)}
              className={cn(
                "flex-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors duration-150 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-raised hover:text-fg",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
