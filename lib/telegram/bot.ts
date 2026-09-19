import "server-only";

import { telegramBotToken } from "./config";

const API_BASE = "https://api.telegram.org";

/** Telegram requires exactly one action per button — a callback or a link. */
type InlineKeyboardButton =
  | { text: string; callback_data: string }
  | { text: string; url: string };

async function callTelegramApi(method: string, payload: Record<string, unknown>) {
  const token = telegramBotToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  const response = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Telegram ${method} failed: ${response.status} ${detail}`);
  }

  return response.json();
}

export function sendTelegramMessage(
  chatId: number,
  text: string,
  options?: { keyboard?: InlineKeyboardButton[][] },
) {
  return callTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
    reply_markup: options?.keyboard
      ? { inline_keyboard: options.keyboard }
      : undefined,
  });
}

export function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  options?: { keyboard?: InlineKeyboardButton[][] },
) {
  return callTelegramApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    reply_markup: options?.keyboard
      ? { inline_keyboard: options.keyboard }
      : undefined,
  });
}

export function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return callTelegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

/** Telegram's HTML parse mode only requires escaping these three. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
