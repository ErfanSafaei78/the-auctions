"use client";

import { useEffect, useId, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { PER_PAGE_OPTIONS } from "@/lib/eauc/filters";
import { toLatinDigits, toPersianDigits } from "@/lib/format/digits";
import { formatCount } from "@/lib/format/number";

interface AuctionPaginationProps {
  page: number;
  totalPages: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

export function AuctionPagination({
  page,
  totalPages,
  perPage,
  onPageChange,
  onPerPageChange,
}: AuctionPaginationProps) {
  const inputId = useId();
  const [draft, setDraft] = useState(() => toPersianDigits(String(page)));

  // Re-seed whenever the page moves from elsewhere (buttons, the other pager,
  // Back/forward), so the field never shows a stale number.
  useEffect(() => {
    setDraft(toPersianDigits(String(page)));
  }, [page]);

  // Commit on Enter or blur, not per keystroke: typing "12" must not visit
  // page 1 on the way. Anything unparseable snaps back to the current page.
  function commitDraft() {
    const parsed = Number.parseInt(toLatinDigits(draft), 10);
    if (!Number.isFinite(parsed)) {
      setDraft(toPersianDigits(String(page)));
      return;
    }

    const next = Math.min(Math.max(parsed, 1), Math.max(totalPages, 1));
    setDraft(toPersianDigits(String(next)));
    if (next !== page) onPageChange(next);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        {/* The page is RTL throughout, so "previous" points right. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronRight />
          قبلی
        </Button>

        <span className="flex items-center gap-1.5 text-sm text-muted">
          <label htmlFor={inputId}>صفحه</label>
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={draft}
            onChange={(event) =>
              setDraft(toPersianDigits(event.target.value.replace(/[^\d۰-۹٠-٩]/g, "")))
            }
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitDraft();
              }
            }}
            onFocus={(event) => event.target.select()}
            className="h-8 w-14 rounded-md border border-line bg-surface px-2 text-center text-sm text-fg transition-[border-color,box-shadow] duration-150 ease-out focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
          />
          از {formatCount(Math.max(totalPages, 1))}
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          بعدی
          <ChevronLeft />
        </Button>
      </div>

      <div className="w-44">
        <ToggleGroup<string>
          label="در هر صفحه"
          value={String(perPage)}
          onValueChange={(value) => onPerPageChange(Number(value))}
          options={PER_PAGE_OPTIONS.map((option) => ({
            value: String(option),
            label: formatCount(option),
          }))}
        />
      </div>
    </div>
  );
}
