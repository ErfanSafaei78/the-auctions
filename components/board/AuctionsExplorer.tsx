"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  applyAuctionFilters,
  buildAuctionQuery,
  DEFAULT_PER_PAGE,
  EMPTY_FILTERS,
  parseAuctionFilters,
  parsePagination,
  type AuctionFilters,
  type DeadlineWindow,
} from "@/lib/eauc/filters";
import type { AuctionSnapshot } from "@/lib/eauc/types";
import { formatCount } from "@/lib/format/number";

import { AuctionCardList } from "./AuctionCardList";
import { AuctionFilterBar } from "./AuctionFilterBar";
import { AuctionPagination } from "./AuctionPagination";
import { AuctionTable } from "./AuctionTable";

interface AuctionsExplorerProps {
  snapshot: AuctionSnapshot;
  initialFilters: AuctionFilters;
  initialPage: number;
  initialPerPage: number;
  deadlineWindow: DeadlineWindow;
  telegramEnabled: boolean;
}

/** Text edits should not push a history entry per keystroke. */
const URL_SYNC_DELAY_MS = 300;

export function AuctionsExplorer({
  snapshot,
  initialFilters,
  initialPage,
  initialPerPage,
  deadlineWindow,
  telegramEnabled,
}: AuctionsExplorerProps) {
  const router = useRouter();

  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(initialPage);
  const [perPage, setPerPage] = useState(initialPerPage);

  // "replace" while typing, "push" for discrete choices so Back undoes one
  // filter at a time rather than one character at a time. Starts as
  // "replace" so normalizing a hand-edited URL on load (?page=999) doesn't
  // add a history entry.
  const historyModeRef = useRef<"push" | "replace">("replace");
  const resultsRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => applyAuctionFilters(snapshot.records, filters, deadlineWindow),
    [snapshot.records, filters, deadlineWindow],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const visible = useMemo(
    () => filtered.slice((safePage - 1) * perPage, safePage * perPage),
    [filtered, safePage, perPage],
  );

  const query = buildAuctionQuery(filters, safePage, perPage);

  // Keep the URL in step with state, through the router rather than raw
  // history.pushState. Raw history calls leave Next's own router unaware of
  // the entries they create, so once a real <Link> navigation (to a detail
  // page) lands on top of them, the router's internal bookkeeping and the
  // real browser stack disagree — Back then restores the wrong entry and
  // drops the query string. Going through router.replace/push keeps one
  // consistent history stack, which is what gives Back its default
  // (and scroll-restoring) behaviour for free.
  //
  // Mount and Back/forward need no special-casing: the URL already matches
  // state there, so the equality check below makes the sync a no-op.
  useEffect(() => {
    const mode = historyModeRef.current;
    const timer = window.setTimeout(
      () => {
        const next = query
          ? `${window.location.pathname}?${query}`
          : window.location.pathname;
        if (next === `${window.location.pathname}${window.location.search}`) {
          return;
        }

        if (mode === "push") {
          router.push(next, { scroll: false });
        } else {
          router.replace(next, { scroll: false });
        }
      },
      mode === "replace" ? URL_SYNC_DELAY_MS : 0,
    );

    return () => window.clearTimeout(timer);
  }, [query, router]);

  // Back/forward restores the URL without necessarily remounting this
  // component (Next preserves it across search-param-only navigations), so
  // state has to be re-derived from the URL or the view would silently
  // disagree with it.
  useEffect(() => {
    function onPopState() {
      // Not Object.fromEntries: it keeps only the last value of a repeated
      // key, so Back would drop all but one selected group, province or city.
      const search = new URLSearchParams(window.location.search);
      const params: Record<string, string[]> = {};
      for (const key of new Set(search.keys())) {
        params[key] = search.getAll(key);
      }

      // Normalizing a restored URL must not push an entry and erase Forward.
      historyModeRef.current = "replace";
      setFilters(parseAuctionFilters(params));
      const pagination = parsePagination(params);
      setPage(pagination.page);
      setPerPage(pagination.perPage);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleFilterChange = useCallback((next: Partial<AuctionFilters>) => {
    const isTextEdit =
      "auctionNo" in next ||
      "lotNo" in next ||
      "deadlineFrom" in next ||
      "deadlineTo" in next;

    historyModeRef.current = isTextEdit ? "replace" : "push";
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }, []);

  const handleClear = useCallback(() => {
    historyModeRef.current = "push";
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }, []);

  // Every pagination action lands the reader at the start of the results,
  // whichever pager it came from.
  const scrollToResults = useCallback(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    resultsRef.current?.scrollIntoView({
      block: "start",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, []);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      historyModeRef.current = "push";
      setPage(nextPage);
      scrollToResults();
    },
    [scrollToResults],
  );

  const handlePerPageChange = useCallback(
    (nextPerPage: number) => {
      historyModeRef.current = "push";
      setPerPage(nextPerPage || DEFAULT_PER_PAGE);
      setPage(1);
      scrollToResults();
    },
    [scrollToResults],
  );

  return (
    <div className="flex flex-col gap-4">
      <AuctionFilterBar
        filters={filters}
        facets={snapshot.facets}
        onChange={handleFilterChange}
        onClear={handleClear}
        telegramEnabled={telegramEnabled}
      />

      <p className="text-sm text-muted">
        نمایش {formatCount(visible.length)} از {formatCount(filtered.length)}{" "}
        پارتی
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface px-6 py-12 text-center">
          <p className="font-medium">هیچ پارتی با این فیلترها یافت نشد.</p>
          <p className="mt-1 text-sm text-muted">یکی از فیلترها را بردارید.</p>
        </div>
      ) : (
        // scroll-mt clears the sticky site header (h-14) plus breathing room.
        <div ref={resultsRef} className="flex scroll-mt-20 flex-col gap-4">
          <AuctionPagination
            page={safePage}
            totalPages={totalPages}
            perPage={perPage}
            onPageChange={handlePageChange}
            onPerPageChange={handlePerPageChange}
          />

          <div className="hidden md:block">
            <AuctionTable records={visible} />
          </div>
          <div className="md:hidden">
            <AuctionCardList records={visible} />
          </div>

          <AuctionPagination
            page={safePage}
            totalPages={totalPages}
            perPage={perPage}
            onPageChange={handlePageChange}
            onPerPageChange={handlePerPageChange}
          />
        </div>
      )}
    </div>
  );
}
