import { AuctionsExplorer } from "@/components/board/AuctionsExplorer";
import { SnapshotMeta } from "@/components/board/SnapshotMeta";
import { SyncButton } from "@/components/board/SyncButton";
import { parseAuctionFilters, parsePagination } from "@/lib/eauc/filters";
import { readSnapshot } from "@/lib/eauc/snapshot-store";
import { getJalaliDateInDays, getTodayJalali } from "@/lib/format/jalali";

/**
 * The ±59 min jitter on a Hobby cron means a 24h threshold would false-positive
 * routinely, so a snapshot is only "قدیمی" past 30h.
 */
const STALE_AFTER_MS = 30 * 60 * 60 * 1000;

/**
 * The manual sync button's server action is invoked via a request to this
 * page's own route, so it inherits this maxDuration rather than needing (or
 * being able to set) its own — route-segment config only applies to a Page,
 * Layout, or Route Handler, never to a bare "use server" file. Kept above the
 * client's 120s give-up: a merely-slow run should still finish and write
 * successfully after the polling UI has stopped waiting for it.
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
            <SyncButton initialFetchedAt={snapshot.fetchedAt} />
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
        // No live fetch here on purpose: a cold upstream pull on a pageview
        // would be several megabytes and seconds of latency. The button below
        // is the way to populate the board before the first cron run.
        <div className="mx-auto max-w-md rounded-xl border border-line bg-surface px-6 py-12 text-center shadow-panel">
          <p className="font-medium">هنوز داده‌ای ثبت نشده</p>
          <p className="mt-1 text-sm text-muted">
            برای پر شدن تابلو، یک بار همگام‌سازی را اجرا کنید.
          </p>
          <div className="mt-4 flex justify-center">
            <SyncButton initialFetchedAt={null} />
          </div>
        </div>
      )}
    </section>
  );
}
