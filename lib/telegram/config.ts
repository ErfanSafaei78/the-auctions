import "server-only";

export function telegramBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN ?? null;
}

export function telegramBotUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME ?? null;
}

export function telegramWebhookSecret(): string | null {
  return process.env.TELEGRAM_WEBHOOK_SECRET ?? null;
}

export function isTelegramConfigured() {
  return Boolean(telegramBotToken() && telegramBotUsername());
}

/**
 * Absolute origin for links inside a Telegram message — those render outside
 * any browser tab, so a relative URL has nothing to resolve against.
 * Prefers an explicit SITE_URL, falls back to Vercel's own production domain.
 */
export function siteOrigin(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "";
}
