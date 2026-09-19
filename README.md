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

## If you're in Iran

The public deployment only gets fresh data once a day, at noon Tehran time,
because `eauc.setadiran.ir` answers Iranian IPs only and the hosting can't
reach it. Run the app on your own machine instead, and you can pull fresh
data whenever you want:

```sh
git clone https://github.com/ErfanSafaei78/the-auctions.git
cd the-auctions
pnpm install
echo "EAUC_DIRECT_FETCH=true" > .env.local
pnpm dev
```

`EAUC_DIRECT_FETCH` is the one variable that matters here — set it to the
literal string `true`. With it set, open `http://localhost:3000` and use the
**همگام‌سازی** (sync) button on the board: it fetches straight from
setadiran and refreshes your local snapshot, no `CRON_SECRET` required for
that button (it's rate-limited to once every 4 hours per running instance).
Full details, including the other env vars and the direct-fetch route, are
in [Setup](#setup) and [Hosting where setadiran is
reachable](#hosting-where-setadiran-is-reachable) below.

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

The board loads that snapshot once (~58 KB gzipped) and filters it in the
browser. Detail pages read the same snapshot. The lot item grid and deposit
amount exist only on upstream's per-lot endpoints, so those pages link out for
them rather than showing them.

## Hosting where setadiran is reachable

Everything above is the **default**, which assumes the host cannot reach
setadiran. Set one variable to invert that:

```sh
EAUC_DIRECT_FETCH=true
```

It is read in exactly one place, `lib/eauc/direct-fetch.ts`, and changes four
behaviours at once:

| | Default (Vercel) | `EAUC_DIRECT_FETCH=true` |
|---|---|---|
| `/api/cron/auctions` | `503 direct_fetch_disabled`, immediately | Fetches upstream and writes the snapshot |
| همگام‌سازی button | Disabled, tooltip, «به‌زودی» | Live, with its polling progress UI |
| `syncAuctionsAction` | Returns `unavailable` | Runs the sync |
| Detail pages | Snapshot row; items and deposit link out | Full upstream detail, item grid and deposit |

The cron fires at **08:30 UTC** (12:00 Tehran — Iran has no DST, so the offset
is a constant +03:30). Set this late rather than at 07:00: the organizations
that list auctions add that day's records between roughly 07:00 and 10:00
Tehran, so a morning sync still mirrors yesterday's board. `vercel.json`
schedules it on Vercel; on your own server use a system cron hitting the same
route with the same Bearer token.

Detail pages degrade rather than break: with the flag on, a failed upstream
fetch falls back to the snapshot row instead of an error panel. The panel is
reserved for a lot that neither source can produce.

`/api/ingest` stays available either way, so a push still works on a host that
could also fetch for itself.

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
| `CRON_SECRET` | Authenticates `/api/ingest`, `/api/cron/auctions` and `/api/probe/eauc` |
| `BLOB_READ_WRITE_TOKEN` | Injected by a linked Vercel Blob store — holds the snapshot |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Injected by the linked Upstash Redis store — holds Telegram subscriptions |
| `EAUC_DIRECT_FETCH` | `true` only where setadiran is reachable — see above |
| `TELEGRAM_BOT_TOKEN` | Telegram notifications — see [below](#telegram-notifications) |
| `TELEGRAM_BOT_USERNAME` | Same, without the `@` (e.g. `the_auctions_bot`) |
| `TELEGRAM_WEBHOOK_SECRET` | Same — authenticates `/api/telegram/webhook` |
| `SITE_URL` | Absolute origin used in Telegram message links; falls back to Vercel's own production URL |

Without a Blob token the snapshot falls back to `.cache/auctions-snapshot.json`
on disk, which is what makes local development work with no cloud setup.

Seed a local snapshot by hand. This one fetches directly, so it only works from
a machine setadiran answers:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/auctions
```

Without `EAUC_DIRECT_FETCH` the in-page **همگام‌سازی** button is disabled and
labelled به‌زودی, and this route answers `503` — both trigger a server-side
fetch, which cannot work anywhere setadiran refuses.

## Telegram notifications

A saved filter can notify you in Telegram when a lot matching it is newly
added — "new" meaning present in today's snapshot but not yesterday's, so a
filter never re-fires on a lot it already told you about, and the first sync
of a fresh deployment notifies nobody (there is no previous snapshot to diff
against).

Subscriptions live in Redis, not in Blob like the snapshot does. They are
small records read back moments after they're written — the site creates one,
the bot's `/start` looks it up — and Blob is CDN-fronted object storage that
can answer such a read with an older copy, and whose `ifMatch` did not
reliably stop two overlapping writers from overwriting each other. Both
failures showed up in practice, as created subscriptions going missing and
valid links reporting "invalid". The snapshot stays in Blob: one large file,
written once a day by a single writer, read by everyone.

Any Telegram user can subscribe: the site never asks for an account, a
Telegram chat id **is** the identity. Build a filter on the board, click
**اطلاع‌رسانی در تلگرام**, and it opens the bot with that filter attached.
Multiple filters per chat are independent — a "group + reserve price" filter
and a "city + date range" filter each notify on their own. `/list` inside
the bot shows your active filters, each with a button that reopens the board
on exactly those filters and one that deletes it. Those links need an
absolute origin, so `SITE_URL` must be set on any deployment whose own domain
isn't the right target — without it the buttons are dropped rather than
rendered broken.

Set up your own bot:

1. Message [@BotFather](https://t.me/BotFather), `/newbot`, and copy the
   token it gives you into `TELEGRAM_BOT_TOKEN`. Put the bot's `@username`
   (without the `@`) into `TELEGRAM_BOT_USERNAME`.
2. Pick any random string for `TELEGRAM_WEBHOOK_SECRET` — Telegram echoes it
   back on every webhook delivery, and the route rejects anything that
   doesn't match.
3. Point Telegram at the deployed webhook (once, after deploying):

   ```sh
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -d "url=https://your-deployment.vercel.app/api/telegram/webhook" \
     -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
   ```

   Must be run again after every value change of `TELEGRAM_WEBHOOK_SECRET`,
   and only after that env var is live on the deployment — a stale or
   mismatched secret is the most common cause of a bot that never replies.
4. Optional, cosmetic: register the command menu Telegram shows when typing
   `/` in the chat.

   ```sh
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setMyCommands" \
     -H "content-type: application/json" \
     -d '{"commands":[{"command":"list","description":"فیلترهای فعال من"},{"command":"help","description":"راهنما"}]}'
   ```

Without `TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME` set, the subscribe
button doesn't render and the notify step is skipped — everything else on
the board works exactly as before.

### Debugging a bot that doesn't reply

```sh
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

- `url` empty → `setWebhook` (step 3) was never run.
- `last_error_message` mentions `401` → `TELEGRAM_WEBHOOK_SECRET` on the
  deployment doesn't match what `setWebhook` was called with. Redeploy after
  changing the env var, then re-run `setWebhook`.
- `last_error_message` mentions `500` → the route threw; check the
  deployment's function logs for `/api/telegram/webhook`.
- No error, `pending_update_count: 0` → Telegram delivered the update and
  got a 200 back. The route itself replies to every message it receives,
  including unrecognized ones, so this shouldn't happen — if it does, the
  function logs (the route logs every update it receives, and any outbound
  Telegram API call it made) will show why.

## Pushing a snapshot

The raw list payload is past Vercel's 4.5 MB request-body ceiling, so a push
must be **gzipped** — the route sniffs the magic number, so the
`Content-Encoding` header is optional. From anywhere with an Iranian IP:

```sh
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
WELCOME="https://eauc.setadiran.ir/eauc/welcome.action?gateway=setad"

# welcome.action first: the list endpoint answers a session-less request with
# a Struts error page, not JSON.
curl -s -c /tmp/jar -A "$UA" "$WELCOME" -o /dev/null

curl -s -b /tmp/jar -A "$UA" -H "Referer: $WELCOME" \
  -H "X-Requested-With: XMLHttpRequest" \
  "https://eauc.setadiran.ir/eauc/mainEstate-Load.action?rows=5000&page=1" \
  | gzip -c \
  | curl -s -X POST https://the-setad-auctions.vercel.app/api/ingest \
      -H "Authorization: Bearer $CRON_SECRET" \
      -H "Content-Type: application/json" \
      -H "Content-Encoding: gzip" --data-binary @-
```

A success answers `{"ok":true,"records":1051,...}`. The daily driver is an iOS
Shortcut doing the same two requests on a 07:00 automation, with a
**Make Archive** step in between to gzip the payload.

As a bookmarklet, run from a tab already on `eauc.setadiran.ir` (same-origin, so
no CORS and the session cookie comes along):

```js
javascript:(async()=>{const d=await(await fetch('/eauc/mainEstate-Load.action?rows=5000&page=1',{headers:{'x-requested-with':'XMLHttpRequest'}})).blob();const b=await new Response(d.stream().pipeThrough(new CompressionStream('gzip'))).blob();const r=await fetch('https://the-setad-auctions.vercel.app/api/ingest',{method:'POST',headers:{'authorization':'Bearer YOUR_CRON_SECRET','content-encoding':'gzip'},body:b});alert(await r.text())})()
```

## Open items

- Vercel's egress to `setadiran.ir` is confirmed **blocked**, which is why
  `/api/ingest` exists. `/api/probe/eauc` has served its purpose and can go.
- `/api/ingest` is only as trustworthy as whoever holds `CRON_SECRET`. The four
  gates catch shape damage and truncation, not a plausible forgery.
