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
| `/api/cron/auctions` | Daily sync (Bearer `CRON_SECRET`) — only from a network setadiran answers |
| `/api/ingest` | Accepts pushed rows from a runner inside Iran (Bearer `CRON_SECRET`) |
| `/api/auctions/status` | Sync progress, polled by the sync button |
| `/api/probe/eauc` | Temporary egress diagnostic — delete once settled |

## How the data flows

`eauc.setadiran.ir` answers **Iranian IPs only**, and Vercel has no Iranian
egress, so production cannot fetch it. Rows are **pushed in** instead: anything
with an Iranian IP — a phone shortcut, a laptop, a bookmarklet — fetches
`mainEstate-Load.action` and POSTs that payload verbatim to `/api/ingest`.

Both paths converge on `commitSnapshot`, the single writer. It normalizes the
rows, runs four validation gates, and only then writes a snapshot to Vercel
Blob. A failed gate refuses the write, so a bad push leaves the previous good
snapshot in place. Normalization deliberately stays on the server, so a runner
supplies rows but never decides their order or shape.

The cron at **03:30 UTC** (07:00 Tehran — Iran has no DST, so the offset is a
constant +03:30) still exists and fetches directly. It fails from Vercel today
and only records `lastError`; it costs nothing and starts working the day
egress does.

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

## Pushing a snapshot

From anywhere with an Iranian IP:

```sh
curl -s "https://eauc.setadiran.ir/eauc/mainEstate-Load.action?rows=5000&page=1" \
  -H "X-Requested-With: XMLHttpRequest" \
  | curl -s -X POST https://the-setad-auctions.vercel.app/api/ingest \
      -H "Authorization: Bearer $CRON_SECRET" \
      -H "Content-Type: application/json" --data-binary @-
```

A success answers `{"ok":true,"records":980,...}`. The daily driver is an iOS
Shortcut doing the same two requests on a 07:00 automation.

As a bookmarklet, run from a tab already on `eauc.setadiran.ir` (same-origin, so
no CORS and the session cookie comes along):

```js
javascript:(async()=>{const d=await(await fetch('/eauc/mainEstate-Load.action?rows=5000&page=1',{headers:{'x-requested-with':'XMLHttpRequest'}})).text();const r=await fetch('https://the-setad-auctions.vercel.app/api/ingest',{method:'POST',headers:{'authorization':'Bearer YOUR_CRON_SECRET','content-type':'application/json'},body:d});alert(await r.text())})()
```

## Open items

- Vercel's egress to `setadiran.ir` is confirmed **blocked**, which is why
  `/api/ingest` exists. `/api/probe/eauc` has served its purpose and can go.
- `/api/ingest` is only as trustworthy as whoever holds `CRON_SECRET`. The four
  gates catch shape damage and truncation, not a plausible forgery.
