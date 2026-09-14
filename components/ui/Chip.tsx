"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ChipProps {
  label: string;
  onRemove?: () => void;
  className?: string;
}

export function Chip({ label, onRemove, className }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-line bg-raised px-2.5 py-1 text-xs text-fg",
        className,
      )}
    >
      <span className="max-w-48 truncate">{label}</span>

      {onRemove ? (
        <button
          type="button"
          aria-label={`حذف ${label}`}
          onClick={onRemove}
          className="rounded-full p-0.5 text-subtle transition-colors hover:text-fg"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  );
}
