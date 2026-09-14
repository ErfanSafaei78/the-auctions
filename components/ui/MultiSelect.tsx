"use client";

import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { toPersianDigits } from "@/lib/format/digits";
import { useDismiss } from "@/lib/use-dismiss";

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onSelectedChange: (next: string[]) => void;
  placeholder: string;
  /** Shows a filter box inside the menu — required for the 166-city list. */
  searchable?: boolean;
}

/**
 * Upstream text uses Persian ی and ک, but an Arabic keyboard layout types ي
 * and ك, and a typed space often stands in for the data's ZWNJ.
 */
function normalizeForSearch(text: string) {
  return text
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/‌/g, " ")
    .trim()
    .toLowerCase();
}

export function MultiSelect({
  label,
  options,
  selected,
  onSelectedChange,
  placeholder,
  searchable = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const menuId = React.useId();

  // Closing also clears the search, so reopening shows the full list.
  const close = React.useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  const rootRef = useDismiss(open, close);

  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  const visible = React.useMemo(() => {
    const needle = normalizeForSearch(query);
    if (!needle) return options;
    return options.filter((option) =>
      normalizeForSearch(option.label).includes(needle),
    );
  }, [options, query]);

  function toggleOpen() {
    if (open) close();
    else setOpen(true);
  }

  function toggle(value: string) {
    onSelectedChange(
      selectedSet.has(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    );
  }

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? placeholder)
        : `${toPersianDigits(String(selected.length))} مورد`;

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>

      {/*
        A native <button> can't contain another interactive control, so the
        clear affordance below lives inside a non-button trigger — a real
        <button> inside a <button> is invalid HTML and browsers silently hoist
        it out, breaking the click.
      */}
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => toggleOpen()}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          toggleOpen();
        }}
        className={cn(
          "flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm",
          "transition-colors duration-150 ease-out",
          "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft",
          selected.length > 0 ? "text-fg" : "text-subtle",
        )}
      >
        <span className="flex-1 truncate text-start">{summary}</span>

        {selected.length > 0 ? (
          <>
            <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-xs font-medium text-accent">
              {toPersianDigits(String(selected.length))}
            </span>
            {/* Clears this one filter. "پاک کردن همه" resets every filter. */}
            <button
              type="button"
              aria-label={`پاک کردن ${label}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectedChange([]);
              }}
              className="shrink-0 rounded-sm p-0.5 text-subtle transition-colors hover:text-fg"
            >
              <X className="size-3.5" />
            </button>
          </>
        ) : null}

        <ChevronDown className="size-3.5 shrink-0 text-subtle" />
      </div>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="absolute end-0 top-full z-50 mt-1 max-h-72 w-full min-w-52 overflow-hidden rounded-md border border-line bg-surface p-1 shadow-panel"
        >
          {searchable ? (
            <div className="relative p-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="جستجو…"
                className="h-8 w-full rounded-sm border border-line bg-canvas ps-8 pe-2 text-sm text-fg placeholder:text-subtle focus-visible:border-accent focus-visible:outline-none"
              />
            </div>
          ) : null}

          <div className="scroll-thin max-h-56 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-subtle">
                موردی یافت نشد
              </p>
            ) : (
              visible.map((option) => {
                const checked = selectedSet.has(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={checked}
                    onClick={() => toggle(option.value)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors",
                      checked
                        ? "bg-accent-soft text-accent"
                        : "text-fg hover:bg-raised",
                    )}
                  >
                    <span className="flex-1 text-start">{option.label}</span>
                    {checked ? (
                      <Check className="size-3.5 shrink-0" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
