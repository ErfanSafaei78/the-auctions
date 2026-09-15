import { AuctionsExplorer } from "@/components/board/AuctionsExplorer";
import { SnapshotMeta } from "@/components/board/SnapshotMeta";
import { SyncButton } from "@/components/board/SyncButton";
import { isDirectFetchEnabled } from "@/lib/eauc/direct-fetch";
import { parseAuctionFilters, parsePagination } from "@/lib/eauc/filters";
import { readSnapshot } from "@/lib/eauc/snapshot-store";
import { getJalaliDateInDays, getTodayJalali } from "@/lib/format/jalali";

/**
 * The ±59 min jitter on a Hobby cron means a 24h threshold would false-positive
 * routinely, so a snapshot is only "قدیمی" past 30h.
 */
const STALE_AFTER_MS = 30 * 60 * 60 * 1000;

/**
 * Only consumed when direct fetch is on: the sync action is invoked via a
 * request to this page's own route, so it inherits this rather than setting
 * its own — route-segment config applies to a Page, Layout or Route Handler,
 * never to a bare "use server" file. Kept above the client's 120s give-up so
 * a merely-slow run still finishes and writes.
 */
export const maxDuration = 150;

interface BoardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const params = await searchParams;

  const snapshot = await readSnapshot();
  const filters = parseAuctionFilters(params);
  const { page, perPage } = parsePagination(params);

  // Computed server-side and handed down, so deadline filtering is
  // deterministic and cannot drift between the server and client render.
  const deadlineWindow = {
    today: getTodayJalali(),
    inSevenDays: getJalaliDateInDays(7),
  };

  const isStale = snapshot
    ? Date.now() - Date.parse(snapshot.fetchedAt) > STALE_AFTER_MS
    : false;

  const canSync = isDirectFetchEnabled();

  return (
    <section className="mx-auto w-full max-w-[112rem] animate-fade-in px-4 py-6 sm:px-6">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          مزایده‌های اموال منقول
        </h1>
        <p className="text-sm text-muted">
          فهرست پارتی‌های در جریان سامانه ستاد ایران، با امکان جست‌وجو و فیلتر.
        </p>
      </header>

      {snapshot ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SnapshotMeta
              fetchedAtJalali={snapshot.fetchedAtJalali}
              records={snapshot.records.length}
              isStale={isStale}
            />
            <SyncButton
              initialFetchedAt={snapshot.fetchedAt}
              canSync={canSync}
            />
          </div>

          <AuctionsExplorer
            snapshot={snapshot}
            initialFilters={filters}
            initialPage={page}
            initialPerPage={perPage}
            deadlineWindow={deadlineWindow}
          />
        </div>
      ) : (
        // No live fetch on a pageview either way: a cold upstream pull would
        // be several megabytes and seconds of latency.
        <div className="mx-auto max-w-md rounded-xl border border-line bg-surface px-6 py-12 text-center shadow-panel">
          <p className="font-medium">هنوز داده‌ای ثبت نشده</p>
          <p className="mt-1 text-sm text-muted">
            {canSync
              ? "برای پر شدن تابلو، یک بار همگام‌سازی را اجرا کنید."
              : "با اولین همگام‌سازی خودکار، تابلو پر می‌شود."}
          </p>
          {canSync ? (
            <div className="mt-4 flex justify-center">
              <SyncButton initialFetchedAt={null} canSync />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
