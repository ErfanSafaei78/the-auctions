# تابلوی مزایده‌ها — the-auctions

A personal, single-user mirror of the **منقول** (movable goods) auction board on
`eauc.setadiran.ir`, with the three things the original cannot do: filters that
are actually applied, URLs that survive a refresh, and a Back button that works.

Persian-only, RTL, light/dark. Three pages and nothing else.

## Why it exists

The upstream board is a Struts/jqGrid app with three defects:

- its filter and sort parameters are **ignored by the server** — passing a
  province, a usage type, or a nonsense title all return the identical record
  count;
- auction and lot links are `$.post` calls injected into a `<div>`, so refresh
  and Back destroy your state;
- nothing is linkable.

This reads the same public data once a day, normalizes it, and renders it as a
board you can filter, bookmark and share.

## Routes

| Route | What it is |
|---|---|
| `/` | The board — 980-ish lots, filtered client-side from one snapshot |
| `/auction/[auctionId]` | One auction, fetched live, plus its sibling lots |
| `/party/[partyId]` | One lot, fetched live, plus its item grid |
| `/api/cron/auctions` | Daily sync (Bearer `CRON_SECRET`) |
| `/api/auctions/status` | Sync progress, polled by the sync button |
| `/api/probe/eauc` | Temporary egress diagnostic — delete once settled |

## How the data flows

A cron at **03:30 UTC** (07:00 Tehran — Iran has no DST, so the offset is a
constant +03:30) fetches all rows in one request, normalizes them, runs four
validation gates, and only then writes a snapshot to Vercel Blob. A failed gate
refuses the write, so a bad run leaves the previous good snapshot in place.

The board loads that snapshot once (~58 KB gzipped) and filters it in the
browser. Detail pages always fetch live.

Row numbers are frozen into the data at normalize time (`snapshotRow`,
`snapshotPage`), so filtering and paging can only ever subset the array — a row
can never drift from the position setadiran shows it at.

All dates stay raw Jalali strings and are never converted. The format is
zero-padded and fixed-width, so lexicographic comparison *is* chronological
comparison: no calendar library anywhere.

## Setup

```sh
pnpm install
pnpm dev
```

Environment:

| Variable | Needed for |
|---|---|
| `CRON_SECRET` | Authenticates `/api/cron/auctions` and `/api/probe/eauc` |
| `BLOB_READ_WRITE_TOKEN` | Injected by a linked Vercel Blob store |

Without a Blob token the snapshot falls back to `.cache/auctions-snapshot.json`
on disk, which is what makes local development work with no cloud setup.

Seed the first snapshot from a running instance with the **همگام‌سازی** button,
or by hand:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/auctions
```

## Open items

- Vercel's egress to `setadiran.ir` is **unverified**. Deploy a preview and hit
  `/api/probe/eauc?key=$CRON_SECRET` before trusting the cron. If it is blocked,
  the fallback is a push model: a runner with Iranian access performs the scrape
  and POSTs the snapshot to an authenticated ingest route, and Vercel never
  contacts setadiran at all. Everything above the fetch layer is unaffected.
- Delete `/api/probe/eauc` once that is settled.
