const api = (method) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

/**
 * Вызов метода Telegram Bot API с повтором при 429.
 * Ошибки не бросают исключение (мягкая деградация): возвращается null.
 */
export async function tg(method, payload, { retries = 2 } = {}) {
  for (let attempt = 0; ; attempt++) {
    let res, data;
    try {
      res = await fetch(api(method), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      data = await res.json();
    } catch (err) {
      console.error(`Telegram ${method} network error:`, err.message);
      return null;
    }
    if (data.ok) return data.result;
    if (res.status === 429 && attempt < retries) {
      const waitMs = Math.min((data.parameters?.retry_after ?? 1) * 1000, 4000);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    console.error(`Telegram ${method} failed:`, data.description || res.status);
    return null;
  }
}

export const sendMessage = (chatId, text, extra = {}) =>
  tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });

export const editMessageText = (chatId, messageId, text, extra = {}) =>
  tg('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    ...extra,
  });

export const deleteMessage = (chatId, messageId) =>
  tg('deleteMessage', { chat_id: chatId, message_id: messageId });

export const answerCallbackQuery = (callbackQueryId, extra = {}) =>
  tg('answerCallbackQuery', { callback_query_id: callbackQueryId, ...extra });

/** Тихий час по Минску: 22:00–08:00 */
export function isQuietNow(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Minsk',
      hour: 'numeric',
      hour12: false,
    }).format(now)
  );
  return hour >= 22 || hour < 8;
}

/** Отключать ли звук уведомления с учётом настройки пользователя */
export function shouldSilence(soundSetting, now = new Date()) {
  if (soundSetting === 'off') return true;
  if (soundSetting === 'always') return false;
  return isQuietNow(now); // 'night'
}
