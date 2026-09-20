# Data flow

`eauc.setadiran.ir` answers **Iranian IPs only**, and Vercel has no Iranian
egress, so production cannot fetch it. Rows are **pushed in** instead: anything
with an Iranian IP — a phone shortcut, a laptop, a bookmarklet — fetches
`mainEstate-Load.action` and POSTs that payload verbatim to `/api/ingest`
(see [ingest.md](ingest.md)).

Both paths converge on `commitSnapshot`, the single writer. It normalizes the
rows, runs four validation gates, and only then writes a snapshot to Vercel
Blob. A failed gate refuses the write, so a bad push leaves the previous good
snapshot in place. Normalization deliberately stays on the server, so a runner
supplies rows but never decides their order or shape.

After a successful write it calls `revalidateTag` and then notifies Telegram
subscribers (best-effort: a failed send never undoes the write).

The board loads the snapshot once (~58 KB gzipped) and filters it in the
browser. Detail pages read the same snapshot. The lot item grid and deposit
amount exist only on upstream's per-lot endpoints, so those pages link out for
them rather than showing them.

## The snapshot

One JSON file in Blob (`auctions/estate-snapshot.json`). Each record is a
flattened upstream row, plus:

- `snapshotRow` / `snapshotPage` — frozen at normalize time, so filtering and
  paging can only ever subset the array. A row can never drift from the
  position setadiran shows it at.
- `firstSeenAt` / `firstSeenAtJalali` — when this app first saw the lot. See
  [new-since-filter.md](new-since-filter.md).

## Caching

The board reads the snapshot through `unstable_cache` (one Blob read per hour
per region). Two consequences:

- A successful sync clears it with `revalidateTag`, so fresh data shows
  immediately.
- It **survives redeploys**. If you change the Blob by hand, the board keeps
  serving the old copy until an ingest succeeds or the hour is up.

Blob's own CDN copy is set to 60 seconds, and reads are versioned by
`uploadedAt` so a read right after a write cannot return the previous file.

Without a Blob token the snapshot falls back to `.cache/auctions-snapshot.json`
on disk, uncached, which is what makes local development work with no cloud
setup.

## Dates

All upstream dates stay raw Jalali strings and are never converted. The format
is zero-padded and fixed-width, so lexicographic comparison *is* chronological
comparison: no calendar library anywhere.

The one place a Gregorian date appears is relative windows ("in 7 days",
"yesterday"). `getJalaliDateInDays` does the offset in Gregorian from
`Date.now()` and converts only the resulting **boundary** to Jalali, once per
request; records are never converted.
