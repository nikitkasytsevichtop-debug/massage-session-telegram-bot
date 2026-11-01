import { buildChainDelays, dedupId } from './chain.js';
import { getProtocol, scaleStages } from './protocols.js';
import { publishDelayed } from './qstash.js';
import {
  deleteSession,
  getSettings,
  pushHistory,
  saveSession,
} from './redis.js';
import {
  deleteMessage,
  editMessageText,
  sendMessage,
  shouldSilence,
} from './telegram.js';
import {
  renderFinish,
  renderPausedCard,
  renderScheduleWarning,
  renderStageCard,
} from './render.js';
import { kbFinish, kbSessionPaused, kbSessionRunning } from './keyboards.js';

const newSessionId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function getScaledStages(session) {
  const p = getProtocol(session.protocolId);
  return p ? scaleStages(p.stages, session.mode) : null;
}

/**
 * Планирует QStash-цепочку переходов от текущего этапа сеанса.
 * @param {number} [firstDelaySec] — остаток текущего этапа (после паузы);
 *   по умолчанию — полная длительность текущего этапа.
 */
export async function scheduleChain(chatId, session, firstDelaySec) {
  const plan = buildChainDelays(session.durations, session.stageIndex, firstDelaySec);
  const results = await Promise.all(
    plan.map(({ targetStageIndex, delaySec }) =>
      publishDelayed(
        '/api/session/advance',
        {
          chatId,
          sessionId: session.id,
          epoch: session.epoch,
          targetStageIndex,
          token: process.env.CRON_SECRET,
        },
        delaySec,
        dedupId(session.id, session.epoch, targetStageIndex)
      )
    )
  );
  const failed = results.filter((ok) => !ok).length;
  if (failed) {
    console.error(`Не запланировано переходов: ${failed} из ${results.length}`);
    await sendMessage(chatId, renderScheduleWarning());
  }
  return { total: results.length, failed };
}

/**
 * Запуск сеанса: карточка этапа 0 (редактируем сообщение, с которого нажали
 * «Начать») + планирование всей цепочки переходов.
 */
export async function startSession(chatId, protocolId, modeKey, cardMessageId) {
  const p = getProtocol(protocolId);
  if (!p) return null;
  const stages = scaleStages(p.stages, modeKey);
  const durations = stages.map((s) => s.durationSec);
  const now = Date.now();
  const session = {
    id: newSessionId(),
    protocolId,
    mode: modeKey,
    epoch: 0,
    stageIndex: 0,
    status: 'running',
    startedAt: now,
    stageEndsAt: now + durations[0] * 1000,
    cardMessageId,
    durations,
  };
  await saveSession(chatId, session);
  await editMessageText(
    chatId,
    cardMessageId,
    renderStageCard(p, stages, 0, session),
    kbSessionRunning()
  );
  await scheduleChain(chatId, session);
  return session;
}

/**
 * Переход на этап target (или завершение, если target === числу этапов).
 * @param {boolean} viaEdit — true для действий пользователя (редактируем карточку),
 *   false для таймерных переходов (новое сообщение со звуком + удаление старого).
 */
export async function advanceToStage(chatId, session, target, { viaEdit = false } = {}) {
  const p = getProtocol(session.protocolId);
  const stages = getScaledStages(session);
  if (!p || !stages) {
    await deleteSession(chatId);
    return;
  }
  if (target >= session.durations.length) {
    await finishSession(chatId, session, true, { viaEdit });
    return;
  }
  session.stageIndex = target;
  session.stageEndsAt = Date.now() + session.durations[target] * 1000;
  const text = renderStageCard(p, stages, target, session);

  if (viaEdit) {
    await saveSession(chatId, session);
    await editMessageText(chatId, session.cardMessageId, text, kbSessionRunning());
  } else {
    const settings = await getSettings(chatId);
    const oldCardId = session.cardMessageId;
    const msg = await sendMessage(chatId, text, {
      ...kbSessionRunning(),
      disable_notification: shouldSilence(settings.sound),
    });
    if (msg) session.cardMessageId = msg.message_id;
    await saveSession(chatId, session);
    if (msg && oldCardId) await deleteMessage(chatId, oldCardId);
  }
}

/** Завершение сеанса (по таймеру, пропуском последнего этапа или вручную). */
export async function finishSession(chatId, session, completed, { viaEdit = false } = {}) {
  const p = getProtocol(session.protocolId);
  await pushHistory(chatId, {
    protocolId: session.protocolId,
    mode: session.mode,
    startedAt: session.startedAt,
    finishedAt: Date.now(),
    completed,
  });
  await deleteSession(chatId);
  if (!p) return;
  const text = renderFinish(p, session, completed);
  const markup = kbFinish(p, session.mode);
  if (viaEdit) {
    await editMessageText(chatId, session.cardMessageId, text, markup);
  } else {
    const settings = await getSettings(chatId);
    const msg = await sendMessage(chatId, text, {
      ...markup,
      disable_notification: shouldSilence(settings.sound),
    });
    if (msg && session.cardMessageId) await deleteMessage(chatId, session.cardMessageId);
  }
}

/** Пауза: инвалидация цепочки (epoch++), фиксация остатка этапа. */
export async function pauseSession(chatId, session) {
  const p = getProtocol(session.protocolId);
  const stages = getScaledStages(session);
  session.status = 'paused';
  session.epoch += 1;
  session.remainingSec = Math.max(
    1,
    Math.round((session.stageEndsAt - Date.now()) / 1000)
  );
  await saveSession(chatId, session);
  if (p && stages) {
    await editMessageText(
      chatId,
      session.cardMessageId,
      renderPausedCard(p, stages, session.stageIndex, session.remainingSec),
      kbSessionPaused()
    );
  }
}

/** Возобновление: новая цепочка с пересчитанной задержкой первого перехода. */
export async function resumeSession(chatId, session) {
  const p = getProtocol(session.protocolId);
  const stages = getScaledStages(session);
  const remaining = session.remainingSec ?? session.durations[session.stageIndex];
  session.status = 'running';
  session.epoch += 1;
  session.stageEndsAt = Date.now() + remaining * 1000;
  delete session.remainingSec;
  await saveSession(chatId, session);
  if (p && stages) {
    await editMessageText(
      chatId,
      session.cardMessageId,
      renderStageCard(p, stages, session.stageIndex, session),
      kbSessionRunning()
    );
  }
  await scheduleChain(chatId, session, remaining);
}

/** Пропуск этапа: немедленный переход + перепланирование цепочки. */
export async function skipStage(chatId, session) {
  session.epoch += 1;
  session.status = 'running';
  delete session.remainingSec;
  const target = session.stageIndex + 1;
  await advanceToStage(chatId, session, target, { viaEdit: true });
  if (target < session.durations.length) {
    await scheduleChain(chatId, session);
  }
}

/** Досрочное завершение по кнопке. */
export async function stopSession(chatId, session) {
  session.epoch += 1;
  await finishSession(chatId, session, false, { viaEdit: true });
}
