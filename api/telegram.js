import {
  getProtocol,
  getTechniques,
} from '../lib/protocols.js';
import {
  clearHistory,
  getHistory,
  getSession,
  getSettings,
  saveSettings,
} from '../lib/redis.js';
import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
  tg,
} from '../lib/telegram.js';
import {
  renderCategories,
  renderCategoryList,
  renderConfirmClearHistory,
  renderGeneralContraindications,
  renderHistory,
  renderMenu,
  renderOnboarding,
  renderProtocolCard,
  renderSettings,
  renderTechnique,
  renderTechniquesIndex,
} from '../lib/render.js';
import {
  kbBack,
  kbCategories,
  kbCategory,
  kbConfirmClearHistory,
  kbHistory,
  kbMenu,
  kbOnboarding,
  kbProtocolCard,
  kbSettings,
  kbTechniques,
} from '../lib/keyboards.js';
import {
  pauseSession,
  resumeSession,
  skipStage,
  startSession,
  stopSession,
} from '../lib/session.js';

export default async function handler(req, res) {
  // Разовая регистрация webhook: GET /api/telegram?setup=<TELEGRAM_WEBHOOK_SECRET>
  if (req.method === 'GET') {
    if (req.query?.setup !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return res.status(401).json({ ok: false });
    }
    const result = await tg('setWebhook', {
      url: `${process.env.APP_URL}/api/telegram`,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    });
    return res.status(200).json({ ok: true, result });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (
    req.headers['x-telegram-bot-api-secret-token'] !==
    process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return res.status(401).json({ ok: false });
  }

  const update = req.body || {};
  try {
    if (update.message) await handleMessage(update.message);
    else if (update.callback_query) await handleCallback(update.callback_query);
  } catch (err) {
    // Мягкая деградация: Telegram всегда получает 200, чтобы не копились повторы
    console.error('Update handling error:', err);
  }
  return res.status(200).json({ ok: true });
}

async function handleMessage(message) {
  const chatId = message.chat?.id;
  if (!chatId || !message.text) return;
  const cmd = message.text.trim().split(/[\s@]/)[0];
  switch (cmd) {
    case '/start':
      await sendMessage(chatId, renderOnboarding(), kbOnboarding());
      break;
    case '/menu':
    case '/help':
      await sendMessage(chatId, renderMenu(), kbMenu());
      break;
    default:
      await sendMessage(
        chatId,
        'Я управляюсь кнопками. Откройте меню: /menu',
        kbMenu()
      );
  }
}

async function handleCallback(cb) {
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  const data = cb.data || '';
  if (!chatId || !messageId) {
    await answerCallbackQuery(cb.id);
    return;
  }
  const [cmd, ...args] = data.split(':');

  const show = (text, markup) =>
    editMessageText(chatId, messageId, text, markup);

  switch (cmd) {
    case 'menu':
      await show(renderMenu(), kbMenu());
      break;

    case 'cats':
      await show(renderCategories(), kbCategories());
      break;

    case 'cat':
      await show(renderCategoryList(args[0]), kbCategory(args[0]));
      break;

    case 'p': {
      const p = getProtocol(args[0]);
      if (!p) break;
      const mode = args[1] ?? (await getSettings(chatId)).mode;
      await show(renderProtocolCard(p, mode), kbProtocolCard(p, mode));
      break;
    }

    case 'go': {
      const p = getProtocol(args[0]);
      if (!p) break;
      const mode = args[1] ?? 'n';
      // Активный сеанс (если был) просто замещается: старые QStash-сообщения
      // отбрасываются по несовпадению sessionId
      await startSession(chatId, p.id, mode, messageId);
      break;
    }

    case 'c': {
      const session = await getSession(chatId);
      if (!session) {
        await answerCallbackQuery(cb.id, {
          text: 'Активный сеанс не найден.',
          show_alert: true,
        });
        return;
      }
      session.cardMessageId = messageId;
      const action = args[0];
      if (action === 'pause' && session.status === 'running') {
        await pauseSession(chatId, session);
      } else if (action === 'resume' && session.status === 'paused') {
        await resumeSession(chatId, session);
      } else if (action === 'skip') {
        await skipStage(chatId, session);
      } else if (action === 'stop') {
        await stopSession(chatId, session);
      }
      break;
    }

    case 'techs':
      await show(renderTechniquesIndex(), kbTechniques(getTechniques()));
      break;

    case 'tech': {
      const t = getTechniques()[args[0]];
      if (t) await show(renderTechnique(t), kbBack('techs'));
      break;
    }

    case 'contra': {
      // возврат туда, откуда открыли: 'contra:techs' или 'contra:p:<id>'
      const backTarget = args[0] === 'p' ? `p:${args[1]}` : 'techs';
      await show(renderGeneralContraindications(), kbBack(backTarget));
      break;
    }

    case 'hist': {
      const items = await getHistory(chatId, 10);
      await show(renderHistory(items, getProtocol), kbHistory());
      break;
    }

    case 'histclear':
      await show(renderConfirmClearHistory(), kbConfirmClearHistory());
      break;

    case 'histclear2': {
      await clearHistory(chatId);
      const settings = await getSettings(chatId);
      await show(renderSettings(settings), kbSettings(settings));
      await answerCallbackQuery(cb.id, { text: 'История удалена.' });
      return;
    }

    case 'sett': {
      const settings = await getSettings(chatId);
      await show(renderSettings(settings), kbSettings(settings));
      break;
    }

    case 'sdur': {
      const settings = await getSettings(chatId);
      settings.mode = args[0];
      await saveSettings(chatId, settings);
      await show(renderSettings(settings), kbSettings(settings));
      break;
    }

    case 'ssound': {
      const settings = await getSettings(chatId);
      settings.sound = args[0];
      await saveSettings(chatId, settings);
      await show(renderSettings(settings), kbSettings(settings));
      break;
    }

    default:
      break;
  }
  await answerCallbackQuery(cb.id);
}
