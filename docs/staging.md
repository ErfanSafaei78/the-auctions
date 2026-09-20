# Staging

## Deploying

Pushing a branch makes Vercel build a preview. To deploy from your machine:

```sh
vercel deploy                      # prints the deployment URL
vercel alias set <that-url> the-auctions-staging.vercel.app
```

The bot, its webhook and the env vars are set up once. Only the alias moves per
deploy, so the webhook URL never changes.

Preview-scoped env vars (own Blob, Redis, bot, webhook secret, `SITE_URL`) are
picked up automatically. Use `vercel deploy`, not `vercel redeploy`, after
changing env vars: a redeploy reuses the source deployment's env.

Deployment Protection (Vercel SSO) is **off** for the project. With it on,
preview URLs redirect to a Vercel login, and Telegram can neither reach the
webhook nor open board links in its in-app browser.

## Registering the staging webhook

Once, and again whenever `TELEGRAM_WEBHOOK_SECRET` changes:

```sh
set -a; . ./.env.stage; set +a
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://the-auctions-staging.vercel.app/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

## Testing a notification

1. Open the staging board, set filters, click **اطلاع‌رسانی در تلگرام** and tap
   the deep link. It should open `@the_staging_auctions_bot`.
2. POST a payload to `https://the-auctions-staging.vercel.app/api/ingest` that
   contains **every lot already in the snapshot plus a few new ones** (gzipped,
   `Authorization: Bearer $CRON_SECRET` — see [ingest.md](ingest.md)). A payload
   of only the new rows fails the record-count gate (under half of the
   previous snapshot is refused).
3. The new lots must match your filters. You should get «N پارتی جدید …» from
   the staging bot, with a link whose `since` is that sync's stamp. It opens the
   staging board showing exactly those N.

The payload is the raw upstream shape, `{ "gridModel": [...], "records": N }`.
A minimal row (see `normalizeListRow` for every field read):

```json
{
  "partyGroups": "وسایط نقلیه",
  "auctionParty": {
    "id": 900001,
    "partyNo": "8800001",
    "title": "[تست] پارتی آزمایشی",
    "baseTotalPrice": 1000000000,
    "visitCity": { "name": "تهران", "province": { "name": "تهران" } },
    "auction": {
      "id": 900001,
      "auctionNo": "9900001",
      "auctioneer": { "name": "آزمایشی", "city": { "province": { "name": "تهران" } } }
    }
  }
}
```

A push with **no** new lots sends nothing, so it is also the safe way to
refresh the board's cached snapshot after editing the staging Blob by hand.

## Seeding staging Blob from production

Read production's snapshot, write it to the staging store. Production is only
ever read. `PROD_TOKEN` and `STAGING_TOKEN` are the `BLOB_READ_WRITE_TOKEN`
values from `.env.prod` and `.env.stage`:

```js
const { head, put } = require("@vercel/blob");
const meta = await head("auctions/estate-snapshot.json", { token: PROD_TOKEN });
const snap = await (await fetch(`${meta.url}?v=${meta.uploadedAt.getTime()}`, { cache: "no-store" })).json();
// stamp or edit records here, e.g. set firstSeenAt / firstSeenAtJalali
await put("auctions/estate-snapshot.json", JSON.stringify(snap), {
  access: "public", addRandomSuffix: false, allowOverwrite: true,
  contentType: "application/json", cacheControlMaxAge: 60, token: STAGING_TOKEN,
});
```

Then push a no-new-lots ingest (above) to refresh the cached copy.

## Gotchas

- **`vercel env rm NAME <env>` removed the variable from every environment**,
  not just the one named. Read production's values first
  (`vercel env pull --environment=production`), then re-add per environment
  with `vercel env add NAME <env> --force`. Secrets pull as `[SENSITIVE]` and
  cannot be recovered that way.
- **Connecting a store can rename its variables.** The Blob integration
  prefixed the token as `PROD_BLOB_READ_WRITE_TOKEN` / `PREVIEW_…`, which left
  nothing under the plain name the app reads. Production only kept working
  because its running deployment had the old value baked in; the next deploy
  would have shown an empty board. Leave the prefix empty when connecting.
- **A Blob read-write token can only be minted by connecting the store to a
  project.** There is no API for it.
- **The board's snapshot cache survives deploys** — see
  [data-flow.md](data-flow.md#caching).
