import {
  answerCallbackQuery,
  editMessageText,
  escapeHtml,
  sendTelegramMessage,
} from "@/lib/telegram/bot";
import { telegramWebhookSecret } from "@/lib/telegram/config";
import { boardUrl } from "@/lib/telegram/links";
import { toPersianDigits } from "@/lib/format/digits";
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

/**
 * Labels go in the message body, not on the buttons: a filter summary is
 * long enough that Telegram would truncate two different ones into the same
 * unreadable stub. The buttons carry the row number instead, and the body
 * says which number is which.
 */
function renderList(subscriptions: TelegramSubscription[]) {
  const lines = subscriptions.map(
    (subscription, index) =>
      `${toPersianDigits(String(index + 1))}. ${escapeHtml(subscription.label)}`,
  );

  const keyboard = subscriptions.map((subscription, index) => {
    const number = toPersianDigits(String(index + 1));
    const url = boardUrl(subscription.filters);

    return [
      ...(url ? [{ text: `🔍 مشاهده ${number}`, url }] : []),
      {
        text: `🗑 حذف ${number}`,
        callback_data: `${DELETE_PREFIX}${subscription.id}`,
      },
    ];
  });

  return {
    text: `<b>فیلترهای فعال شما (${toPersianDigits(String(subscriptions.length))}):</b>\n\n${lines.join("\n")}`,
    keyboard,
  };
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

  const { text, keyboard } = renderList(subscriptions);
  await sendTelegramMessage(chatId, text, { keyboard });
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

  const { text, keyboard } = renderList(remaining);
  await editMessageText(chatId, messageId, text, { keyboard });
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
  console.log("telegram update", {
    hasMessage: Boolean(update.message),
    text: update.message?.text,
    callbackData: update.callback_query?.data,
  });

  // Best-effort reply target for the catch block below — a thrown error
  // must not go silent from the user's side, only from ours.
  const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;

  try {
    if (update.message?.text) {
      const text = update.message.text.trim();

      if (text === "/list") {
        await handleList(update.message.chat.id);
      } else if (text === "/help") {
        await handleStart(update.message.chat.id, undefined);
      } else if (text.startsWith("/start")) {
        await handleStart(update.message.chat.id, text.split(/\s+/)[1]);
      } else {
        await sendTelegramMessage(
          update.message.chat.id,
          "دستور شناخته‌شده نیست.\n/help راهنما\n/list فیلترهای فعال شما",
        );
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
    if (chatId !== undefined) {
      // Never let a thrown error read as the bot ignoring the user — but
      // this send can itself fail (bad token, etc.), so it's fire-and-forget.
      await sendTelegramMessage(
        chatId,
        "خطایی رخ داد. لطفاً کمی بعد دوباره امتحان کنید.",
      ).catch(() => {});
    }
  }

  // Telegram only cares that this returns 200 — anything else triggers retries.
  return Response.json({ ok: true });
}
