# Environments

There are two full stacks. Nothing is shared between them except `CRON_SECRET`.

| | Production | Staging (Vercel Preview) |
|---|---|---|
| URL | `the-setad-auctions.vercel.app` | `the-auctions-staging.vercel.app` |
| Blob | production store | `the-auctions-preview` |
| Redis | Upstash, provisioned and connected through Vercel | Upstash, created directly on upstash.com and signed in with GitHub |
| Bot | `@the_setad_auctions_bot` | `@the_staging_auctions_bot` |
| Webhook | `…/api/telegram/webhook` on the production domain | same path on the staging alias |
| Webhook secret | its own | its own |
| `SITE_URL` | unset (falls back to the production domain) | `https://the-auctions-staging.vercel.app` |

Why the split matters: a sync notifies every subscription in the Redis it can
see, through the bot it holds. Shared Redis means a staging sync messages
production subscribers, and the reverse. See [telegram.md](telegram.md).

**Why staging Redis is on upstash.com.** The Vercel Marketplace's Upstash free
plan allows one database per account, and production already uses it. A
database created directly on upstash.com has its own free tier, so staging
gets its own. Upstash names the credentials `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN`; the app reads the same values as
`KV_REST_API_URL` / `KV_REST_API_TOKEN`.

## Env files

| File | What it is |
|---|---|
| `.env.stage` | Staging values |
| `.env.prod` | Production values. **Live** write tokens: a sync run with these writes to the production Blob and can message the real subscriber |
| `.env` | What local dev loads. Currently a copy of the staging values |
| `.env.example` | Template with grouped, commented, empty variables |

All of them match `.env*` in `.gitignore`, including `.env.example`.

Next.js only auto-loads `.env`, `.env.local` and the `development` /
`production` variants, so `.env.stage` and `.env.prod` are **source files**:
copy the one you want over `.env` (or `.env.local`). `.env.local` wins over
`.env`, so don't keep both with different contents.

Refresh them from Vercel with `vercel env pull <file> --environment=preview`
(or `production`). Variables stored as secrets come back as `[SENSITIVE]`, so
the ones the app needs locally are stored readable.

## Variables

| Variable | Needed for |
|---|---|
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Redis — Telegram subscriptions |
| `BLOB_READ_WRITE_TOKEN` | Blob — the snapshot |
| `TELEGRAM_BOT_TOKEN` | Telegram — see [telegram.md](telegram.md) |
| `TELEGRAM_BOT_USERNAME` | Same, without the `@` |
| `TELEGRAM_WEBHOOK_SECRET` | Authenticates `/api/telegram/webhook` |
| `CRON_SECRET` | Authenticates `/api/ingest`, `/api/cron/auctions` and `/api/probe/eauc` |
| `SITE_URL` | Absolute origin in Telegram message links; falls back to Vercel's production URL |
| `EAUC_DIRECT_FETCH` | `true` only where setadiran is reachable — see [direct-fetch.md](direct-fetch.md) |

**Names must be exactly these**, with no `PROD_` / `PREVIEW_` prefix, in every
environment. `@vercel/blob` and the app read them by name.

Without a Blob token the snapshot falls back to `.cache/auctions-snapshot.json`
on disk. Without the Redis variables the Telegram feature switches off. Setting
either in `.env` sends local dev to that cloud store instead.
