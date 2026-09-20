# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A single-user, Persian/RTL mirror of the setadiran **منقول** auction board (Next.js 15 App Router, React 19, Tailwind 4, pnpm). Longer explanations live in `docs/`; this file is the short version plus what's easy to get wrong.

## Commands

```sh
pnpm dev          # next dev
pnpm build        # next build
pnpm typecheck    # tsc --noEmit — the only static check
```

There is **no linter and no test suite**. Verify with `pnpm typecheck`, `pnpm build`, and by running the app. To exercise the sync pipeline without Iranian egress, POST a gzipped `{gridModel, records}` payload to `/api/ingest` (see `docs/ingest.md`, `docs/staging.md`).

## Architecture

**Data comes in by push, not pull.** `eauc.setadiran.ir` answers Iranian IPs only and Vercel can't reach it. Rows are POSTed to `/api/ingest`, or fetched directly when `EAUC_DIRECT_FETCH=true` (cron, sync button, detail pages). Both converge on `commitSnapshot` in `lib/eauc/sync.ts`, the single writer: normalize → four validation gates → write Blob → `revalidateTag` → Telegram notify → `patchSyncState`. A failed gate keeps the previous snapshot. Normalization stays server-side, so a runner never controls row order or shape.

**One snapshot, filtered in the browser.** The whole board is one JSON file in Vercel Blob. `app/page.tsx` reads it and `AuctionsExplorer` filters it client-side, with the URL as the only state. The read goes through `unstable_cache`, which **survives redeploys** — after editing Blob by hand, the board stays stale until an ingest succeeds. Sync progress lives in a separate uncached blob (`sync-state.ts`) on purpose.

**`lib/eauc/filters.ts` is shared by four callers**: the server page, the client explorer, the Telegram notifier, and link building. A new filter needs: the `AuctionFilters` field, `EMPTY_FILTERS`, `parseAuctionFilters`, `buildAuctionQuery`, `countActiveFilters`, `summarizeFilters`, `applyAuctionFilters`, a control and chip in `AuctionFilterBar`, and — if typed rather than clicked — the text-edit list in `AuctionsExplorer.handleFilterChange` so it uses `replace`, not `push`, history. Anything relative to "now" (`since` keywords, "within 7 days") is resolved once on the server by `buildFilterWindow` and passed down, so server and client renders can't disagree.

**Dates are raw Jalali strings, never converted.** They're zero-padded and fixed-width, so string comparison is date comparison (`jalaliSortKey` / `jalaliInputToSortKey` in `lib/format/jalali.ts`). Only relative window *boundaries* go through ICU. Records carry `firstSeenAt` (ISO) beside `firstSeenAtJalali` for exactly this reason. That stamp is set once and copied forward in `buildSnapshot` — never recompute it per sync.

**Telegram** (`lib/telegram/`): subscriptions live in Redis, not Blob (Blob reads can be stale, and its `ifMatch` didn't stop overlapping writers). `notifyNewAuctions` fans out to **every** linked subscription in whichever Redis it can see, using whichever bot token that environment holds, and a subscription records no environment. So each environment must have its own Redis, bot and webhook secret. A stored subscription never carries `since`; each notification's link is pinned to its own sync's stamp instead. Links need an absolute origin (`siteOrigin()`), otherwise the buttons are dropped.

Lot/auction ids are **strings** (upstream exceeds `MAX_SAFE_INTEGER`); never coerce to number. Modules that touch secrets or storage start with `import "server-only"`. UI strings are Persian; comments explain *why*, not what.

## Environments

Staging and production share nothing but `CRON_SECRET`. Staging is the Vercel Preview environment, aliased at `the-auctions-staging.vercel.app`, with its own Blob store, Redis and bot. See `docs/environments.md`.

- `.env.stage` and `.env.prod` are **source files, not auto-loaded**. `.env` is what local dev reads (currently staging). `.env.prod` holds live tokens; running a sync against it writes production and can notify the real subscriber.
- Variable names are exactly `BLOB_READ_WRITE_TOKEN`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` — no `PROD_`/`PREVIEW_` prefix. A prefixed Blob token leaves the app with none.
- `vercel env rm NAME <env>` removes the variable from **every** environment. Read production's values first.
- After changing env vars use `vercel deploy`, not `vercel redeploy` (which reuses the old env), then `vercel alias set <url> the-auctions-staging.vercel.app`.
- Leave `EAUC_DIRECT_FETCH` unset anywhere outside Iran; the fetch can't succeed and the sync button would only fail.
