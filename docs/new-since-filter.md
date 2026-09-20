# "New since" filter

Shows only the lots that first appeared after a given moment. It exists so a
Telegram notification can link to **its own lots**: «۲۹ پارتی جدید» opens those
29, not the whole board narrowed by your saved filter.

## How "new" is recorded

Every record in the snapshot carries two stamps, set once and never changed:

| Field | Example | Used for |
|---|---|---|
| `firstSeenAt` | `2026-09-20T08:30:00.000Z` | Truth — ISO, UTC, full precision |
| `firstSeenAtJalali` | `1405/06/29 12:00` | Comparison and display — Tehran time |

It is when **this app** first saw the lot, not when upstream published it, and
it is not "last synced" (that is `snapshot.fetchedAt`, identical for every
record).

`buildSnapshot` copies each stamp forward from the previous snapshot by
`partyId`. Only a lot absent from the previous snapshot gets the current sync's
stamp. The Jalali stamp sits beside the ISO one — the same pairing as
`fetchedAt` / `fetchedAtJalali` — so the filter is a fixed-width string
comparison and needs no Jalali→Gregorian conversion.

- **Migration:** records from before the field existed are backfilled with the
  previous snapshot's own timestamp. That is in the past, so they read as old;
  stamping them "now" would make every lot look new on the first sync.
- **Limit:** only the immediately previous snapshot is consulted. A lot that
  drops out for one sync and comes back is stamped new again, and notifies
  again. `findNewRecords` in `notify.ts` behaves the same way.

## The `since` param

Lots first seen **on or after** the value, open-ended towards now.

| `?since=` | Means |
|---|---|
| `today` | since 00:00 today, Tehran |
| `yesterday` | since 00:00 yesterday |
| `3d` | since 00:00 three days ago |
| `7d` | since 00:00 seven days ago |
| `1405/06/29` | since the start of that day |
| `1405/06/29 14:34` | since that minute |

"Since", not "during": if you skip a day, yesterday's link still shows
yesterday's lots **plus** today's. That is the case it was built for.

- Keywords resolve on the server at request time (`buildFilterWindow`), so a
  bookmarked `since=yesterday` keeps meaning yesterday. A literal date stays
  fixed, which is why notifications use one.
- Persian digits are accepted.
- An unparseable value filters nothing (the whole board) rather than showing an
  empty list.
- While `since` is active, records with no stamp are excluded.

In the filter bar it is the «تازه‌ها» group, below the deadline filters: همه /
از امروز / از دیروز / از ۳ روز پیش / از یک هفته پیش / از تاریخ. «از تاریخ» reveals
two fields, a date and an optional time; with no time it reads from 00:00 of
that day, and says so under the fields. It counts as one active filter and
shows a «جدید از …» chip, which always includes the clock time.

## Notifications

`notify.ts` builds the link with `since = next.fetchedAtJalali`, the stamp
every new lot in that sync carries. Because it includes the time, two syncs on
the same day stay distinguishable: each message opens exactly its own lots,
plus anything newer.

The message opens with that date and time (📅 ۱۴۰۵/۰۶/۲۹ ۱۶:۴۴), and the link
reads «مشاهده همه موارد جدید از ۱۴۰۵/۰۶/۲۹ ۱۶:۴۴». It names the moment rather
than a count because the board it opens can hold more than the message listed.

A subscription never stores `since` (`createTelegramSubscriptionAction` drops
it). A subscription is about new lots by nature, and a stored window would
silently narrow every future notification. It belongs in the link, not in what
the subscription matches.

## Code

| | |
|---|---|
| `lib/eauc/types.ts` | `firstSeenAt`, `firstSeenAtJalali` on `AuctionRecord` |
| `lib/eauc/normalize.ts` | `buildSnapshot` carry-forward and backfill |
| `lib/eauc/sync.ts` | passes the previous snapshot to `buildSnapshot` |
| `lib/eauc/filters.ts` | `since` field, keywords, `buildFilterWindow`, matching |
| `lib/format/jalali.ts` | `jalaliInputToSortKey` accepts an optional time |
| `components/board/AuctionFilterBar.tsx` | the toggle, date field, chip |
| `lib/telegram/notify.ts` | pins each message's link to its sync |

`jalaliInputToSortKey` treats a bare date as the start of the day (or the end,
for a range's upper bound), so the deadline filters read exactly as before.
