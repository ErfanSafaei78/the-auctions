"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { TOOLTIP_ANCHOR, useTooltip } from "@/components/ui/Tooltip";
import { syncAuctionsAction, type SyncActionResult } from "@/lib/eauc/actions";
import { formatJalaliInstant } from "@/lib/format/jalali";
import { cn } from "@/lib/cn";

interface SyncButtonProps {
  initialFetchedAt: string | null;
  /** False where setadiran is unreachable — see lib/eauc/direct-fetch.ts. */
  canSync: boolean;
}

const UNAVAILABLE_NOTE =
  "همگام‌سازی دستی از طریق سایت در دسترس نیست. داده‌ها روزی یک‌بار به‌صورت خودکار به‌روز می‌شود.";

/**
 * Two states of one control, split so each calls its own hooks: a React
 * component cannot branch around a hook call.
 */
export function SyncButton({ initialFetchedAt, canSync }: SyncButtonProps) {
  return canSync ? (
    <ActiveSyncButton initialFetchedAt={initialFetchedAt} />
  ) : (
    <UnavailableSyncButton />
  );
}

function UnavailableSyncButton() {
  const { anchorProps, tooltip } = useTooltip<HTMLSpanElement>(UNAVAILABLE_NOTE);

  return (
    <div className="flex flex-col items-end gap-1.5">
      {/*
        A disabled button is pointer-events:none, so it never fires hover or
        focus itself — the wrapper has to be the tooltip anchor.
      */}
      <span {...anchorProps} className={cn(TOOLTIP_ANCHOR, "inline-flex")}>
        <Button type="button" variant="outline" size="sm" disabled>
          <RefreshCw />
          همگام‌سازی
          <span className="text-subtle">(به‌زودی)</span>
        </Button>
      </span>

      {tooltip}
    </div>
  );
}

type WatchState =
  | { kind: "idle" }
  | { kind: "watching" }
  | { kind: "too-soon"; nextAllowedAt: string }
  | { kind: "timeout" }
  | { kind: "failed" };

const POLL_INTERVAL_MS = 2000;
const WATCH_TIMEOUT_MS = 120_000;

interface StatusPayload {
  fetchedAt: string | null;
  records: number;
  running: boolean;
}

async function fetchStatus(): Promise<StatusPayload | null> {
  try {
    const response = await fetch("/api/auctions/status", { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as StatusPayload;
  } catch {
    return null;
  }
}

function ActiveSyncButton({
  initialFetchedAt,
}: Pick<SyncButtonProps, "initialFetchedAt">) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<WatchState>({ kind: "idle" });

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<(() => Promise<void>) | null>(null);
  // Bumped whenever a watch starts or stops, so a status request still in
  // flight from an ended watch can't change state or refresh a second time.
  const watchId = useRef(0);

  const stopWatching = useCallback(() => {
    watchId.current += 1;
    tickRef.current = null;
    if (pollTimer.current !== null) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const beginWatching = useCallback(
    (baseline: string | null) => {
      stopWatching();
      const id = watchId.current;
      const deadline = Date.now() + WATCH_TIMEOUT_MS;
      setState({ kind: "watching" });

      const tick = async () => {
        if (document.visibilityState !== "visible") return;

        if (Date.now() > deadline) {
          stopWatching();
          setState({ kind: "timeout" });
          return;
        }

        const status = await fetchStatus();
        if (id !== watchId.current) return;
        if (!status || status.running) return;

        stopWatching();

        if (status.fetchedAt && status.fetchedAt !== baseline) {
          setState({ kind: "idle" });
          router.refresh();
          return;
        }

        // running flipped false but fetchedAt never moved: the run failed.
        setState({ kind: "failed" });
      };

      tickRef.current = tick;
      void tick();
      pollTimer.current = setInterval(() => void tick(), POLL_INTERVAL_MS);
    },
    [router, stopWatching],
  );

  // Resume promptly when the tab regains focus rather than waiting out the
  // remainder of the current interval tick.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void tickRef.current?.();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => stopWatching, [stopWatching]);

  const handleClick = useCallback(() => {
    startTransition(async () => {
      let result: SyncActionResult;
      try {
        result = await syncAuctionsAction();
      } catch {
        // Uncaught, this would reach the route's error boundary and replace
        // the whole board with an error panel.
        setState({ kind: "failed" });
        return;
      }

      if (result.status === "unavailable") {
        // Only reachable if the flag flipped off since this page rendered.
        setState({ kind: "failed" });
        return;
      }

      if (result.status === "started" || result.status === "already-running") {
        // "already-running" means someone else's run (another tab, the cron)
        // is mid-flight — watch for it to land rather than telling the user
        // to try again.
        beginWatching(initialFetchedAt);
        return;
      }

      // A sync landed after this page rendered (the cron, another tab), so
      // the board is older than the data the message below calls current.
      if (result.fetchedAt !== initialFetchedAt) router.refresh();

      setState({ kind: "too-soon", nextAllowedAt: result.nextAllowedAt });
    });
  }, [beginWatching, initialFetchedAt, router]);

  const isWatching = state.kind === "watching";
  const isBusy = isPending || isWatching;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isBusy || state.kind === "too-soon"}
        onClick={handleClick}
      >
        <RefreshCw className={cn(isBusy && "animate-spin")} />
        {isPending
          ? "در حال همگام‌سازی…"
          : isWatching
            ? "در انتظار پایان همگام‌سازی…"
            : "همگام‌سازی"}
      </Button>

      {state.kind === "too-soon" ? (
        <p className="text-xs text-subtle">
          داده‌ها به‌روز است — می‌توانید ساعت{" "}
          {formatJalaliInstant(state.nextAllowedAt) ?? ""} دوباره همگام‌سازی کنید
        </p>
      ) : null}

      {state.kind === "timeout" ? (
        <p className="text-xs text-danger">
          این کار بیشتر از حد معمول طول کشید. کمی بعد صفحه را تازه کنید.
        </p>
      ) : null}

      {state.kind === "failed" ? (
        <p className="text-xs text-danger">
          همگام‌سازی ناموفق بود. داده‌های قبلی همچنان نمایش داده می‌شود.
        </p>
      ) : null}
    </div>
  );
}
