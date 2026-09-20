# تابلوی مزایده‌ها — the-auctions

A personal, single-user mirror of the **منقول** (movable goods) auction board on
`eauc.setadiran.ir`, with the three things the original cannot do: filters that
are actually applied, URLs that survive a refresh, and a Back button that works.

Persian-only, RTL, light/dark. Three pages and nothing else.

## Quick start

```sh
pnpm install
cp .env.example .env   # then fill it in, or copy .env.stage over it
pnpm dev
```

With no env at all it still runs: the snapshot falls back to
`.cache/auctions-snapshot.json` and the Telegram feature switches off. If you're
in Iran, set `EAUC_DIRECT_FETCH=true` to pull live data — see
[docs/direct-fetch.md](docs/direct-fetch.md).

## Docs

| Doc | What's in it |
|---|---|
| [overview](docs/overview.md) | Why it exists, routes, open items |
| [data-flow](docs/data-flow.md) | How data gets in, the snapshot, caching, dates |
| [direct-fetch](docs/direct-fetch.md) | Running or hosting where setadiran is reachable |
| [ingest](docs/ingest.md) | Pushing a snapshot from a machine with an Iranian IP |
| [new-since-filter](docs/new-since-filter.md) | The `since` filter and notification links |
| [telegram](docs/telegram.md) | Notifications, bot setup, debugging |
| [environments](docs/environments.md) | Staging and production stacks, env files, variables |
| [staging](docs/staging.md) | Deploying and testing on staging, Vercel gotchas |
