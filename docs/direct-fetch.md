# Direct fetch (`EAUC_DIRECT_FETCH`)

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

Set it to the literal string `true`. Then open `http://localhost:3000` and use
the **همگام‌سازی** (sync) button on the board: it fetches straight from
setadiran and refreshes your local snapshot, no `CRON_SECRET` required for that
button (it's rate-limited to once every 4 hours per running instance).

To seed a local snapshot by hand instead:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/auctions
```

This fetches directly, so it only works from a machine setadiran answers.

## Hosting where setadiran is reachable

The default assumes the host cannot reach setadiran. Setting
`EAUC_DIRECT_FETCH=true` inverts that. It is read in exactly one place,
`lib/eauc/direct-fetch.ts`, and changes four behaviours at once:

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

Leave the flag **unset** in any env file that points at Vercel-hosted stores
from outside Iran: the fetch cannot succeed there and the button would only
fail.
