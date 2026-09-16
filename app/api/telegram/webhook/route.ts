import {
  answerCallbackQuery,
  editMessageText,
  escapeHtml,
  sendTelegramMessage,
} from "@/lib/telegram/bot";
import { telegramWebhookSecret } from "@/lib/telegram/config";
import {
  deleteSubscription,
  linkSubscription,
  listSubscriptionsForChat,
} from "@/lib/telegram/store";
import type { TelegramSubscription } from "@/lib/telegram/types";
import { secretMatches } from "@/lib/secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Only the fields this route reads. Telegram's real Update object carries
 * much more, all of it ignored here.
 */
interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number };
  };
}

const DELETE_PREFIX = "delete:";

function subscriptionsKeyboard(subscriptions: TelegramSubscription[]) {
  return subscriptions.map((subscription) => [
    {
      text: `🗑 حذف «${subscription.label}»`,
      callback_data: `${DELETE_PREFIX}${subscription.id}`,
    },
  ]);
}

async function handleStart(chatId: number, payload: string | undefined) {
  if (!payload) {
    await sendTelegramMessage(
      chatId,
      "سلام 👋\nبرای دریافت اطلاع‌رسانی پارتی‌های جدید، ابتدا در سایت فیلتر موردنظرتان را بسازید و روی «اطلاع‌رسانی در تلگرام» بزنید.\n\nدستور /list فیلترهای فعال شما را نشان می‌دهد.",
    );
    return;
  }

  const result = await linkSubscription(payload, chatId);
  if (result.status === "not_found") {
    await sendTelegramMessage(
      chatId,
      "این لینک نامعتبر یا قبلاً استفاده‌شده است. از سایت دوباره تلاش کنید.",
    );
    return;
  }

  await sendTelegramMessage(
    chatId,
    `فعال شد ✅\nاز این پس با ثبت پارتی جدیدی که با «${escapeHtml(result.subscription.label)}» مطابقت داشته باشد، پیام می‌گیرید.\n\nدستور /list فیلترهای فعال شما را نشان می‌دهد.`,
  );
}

async function handleList(chatId: number) {
  const subscriptions = await listSubscriptionsForChat(chatId);
  if (subscriptions.length === 0) {
    await sendTelegramMessage(chatId, "هنوز فیلتری ثبت نکرده‌اید.");
    return;
  }

  await sendTelegramMessage(chatId, `فیلترهای فعال شما (${subscriptions.length}):`, {
    keyboard: subscriptionsKeyboard(subscriptions),
  });
}

async function handleDelete(
  callbackQueryId: string,
  chatId: number,
  messageId: number,
  id: string,
) {
  const deleted = await deleteSubscription(id, chatId);
  await answerCallbackQuery(callbackQueryId, deleted ? "حذف شد" : "یافت نشد");

  const remaining = await listSubscriptionsForChat(chatId);
  if (remaining.length === 0) {
    await editMessageText(chatId, messageId, "هیچ فیلتر فعالی ندارید.");
    return;
  }

  await editMessageText(chatId, messageId, `فیلترهای فعال شما (${remaining.length}):`, {
    keyboard: subscriptionsKeyboard(remaining),
  });
}

/**
 * Telegram's own auth: setWebhook registers a secret token, echoed back on
 * every delivery in this header — see README for the setWebhook call.
 */
export async function POST(request: Request) {
  const secret = telegramWebhookSecret();
  if (!secret) {
    return Response.json({ ok: false, reason: "not_configured" }, { status: 500 });
  }

  if (
    !secretMatches(
      request.headers.get("x-telegram-bot-api-secret-token"),
      secret,
    )
  ) {
    return new Response(null, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;

  try {
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();

      if (text === "/list") {
        await handleList(chatId);
      } else if (text.startsWith("/start")) {
        await handleStart(chatId, text.split(/\s+/)[1]);
      }
    } else if (update.callback_query?.data?.startsWith(DELETE_PREFIX)) {
      const { id, data, message } = update.callback_query;
      if (message) {
        await handleDelete(
          id,
          message.chat.id,
          message.message_id,
          data.slice(DELETE_PREFIX.length),
        );
      }
    }
  } catch (error) {
    console.error("Telegram webhook handling failed", error);
  }

  // Telegram only cares that this returns 200 — anything else triggers retries.
  return Response.json({ ok: true });
}
