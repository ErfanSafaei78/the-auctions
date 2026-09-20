# Overview

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
| `/auction/[auctionId]` | One auction, plus its sibling lots |
| `/party/[partyId]` | One lot |
| `/api/cron/auctions` | Daily sync (Bearer `CRON_SECRET`) — needs `EAUC_DIRECT_FETCH` |
| `/api/ingest` | Accepts pushed rows from a runner inside Iran (Bearer `CRON_SECRET`) |
| `/api/auctions/status` | Sync progress, polled by the sync button |
| `/api/probe/eauc` | Temporary egress diagnostic — delete once settled |
| `/api/telegram/webhook` | Telegram bot updates (`X-Telegram-Bot-Api-Secret-Token`) |

## Open items

- Vercel's egress to `setadiran.ir` is confirmed **blocked**, which is why
  `/api/ingest` exists. `/api/probe/eauc` has served its purpose and can go.
- `/api/ingest` is only as trustworthy as whoever holds `CRON_SECRET`. The four
  gates catch shape damage and truncation, not a plausible forgery.
- `CRON_SECRET` is the same value on staging and production, so whoever holds
  the staging one can also push to production.
