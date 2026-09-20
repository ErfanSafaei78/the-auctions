# Telegram notifications

A saved filter can notify you in Telegram when a lot matching it is newly
added — "new" meaning present in this sync's snapshot but not the previous
one, so a filter never re-fires on a lot it already told you about, and the
first sync of a fresh deployment notifies nobody (there is no previous
snapshot to diff against).

Each message says how many lots matched, lists the first five titles, and links
to the board pinned to exactly those lots — see
[new-since-filter.md](new-since-filter.md).

Any Telegram user can subscribe: the site never asks for an account, a
Telegram chat id **is** the identity. Build a filter on the board, click
**اطلاع‌رسانی در تلگرام**, and it opens the bot with that filter attached.
Multiple filters per chat are independent — a "group + reserve price" filter
and a "city + date range" filter each notify on their own. `/list` inside the
bot shows your active filters, each with a button that reopens the board on
exactly those filters and one that deletes it. Those links need an absolute
origin, so `SITE_URL` must be set on any deployment whose own domain isn't the
right target — without it the buttons are dropped rather than rendered broken.

## Storage

Subscriptions live in Redis, not in Blob like the snapshot does. They are small
records read back moments after they're written — the site creates one, the
bot's `/start` looks it up — and Blob is CDN-fronted object storage that can
answer such a read with an older copy, and whose `ifMatch` did not reliably
stop two overlapping writers from overwriting each other. Both failures showed
up in practice, as created subscriptions going missing and valid links
reporting "invalid". The snapshot stays in Blob: one large file, written once a
day by a single writer, read by everyone.

## One bot, one Redis, one webhook per environment

A sync notifies **every** subscription in the Redis it can see, using the bot
it holds, and a subscription records no environment. So an environment that
shared Redis with another would message the other's subscribers, and a bot can
only have one webhook. Staging and production therefore each have their own
bot, Redis and webhook secret — see [environments.md](environments.md).

## Setting up a bot

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

Without `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` **and** the Redis
variables, the subscribe button doesn't render and the notify step is skipped —
everything else on the board works exactly as before.

## Debugging a bot that doesn't reply

```sh
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

- `url` empty → `setWebhook` (step 3) was never run.
- `url` points at the other environment → the bot's webhook is registered
  against the wrong deployment.
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
- The deep link says the subscription is invalid → the site wrote it to one
  Redis and the bot's webhook is reading another. Check that the site and the
  bot are the same environment.
