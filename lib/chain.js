/**
 * Чистая логика цепочки переходов и валидации QStash-сообщений
 * (без внешних зависимостей — покрывается unit-тестами).
 */

/**
 * Строит план отложенных сообщений для переходов этапов.
 * @param {number[]} durations — длительности этапов в секундах (после масштабирования)
 * @param {number} fromIndex — индекс текущего этапа
 * @param {number} [firstDelaySec] — сколько осталось до конца текущего этапа
 *   (по умолчанию — полная длительность текущего этапа)
 * @returns {{targetStageIndex: number, delaySec: number}[]}
 *   targetStageIndex === durations.length означает завершение сеанса
 */
export function buildChainDelays(durations, fromIndex, firstDelaySec) {
  const out = [];
  let acc = firstDelaySec ?? durations[fromIndex];
  out.push({ targetStageIndex: fromIndex + 1, delaySec: acc });
  for (let i = fromIndex + 1; i < durations.length; i++) {
    acc += durations[i];
    out.push({ targetStageIndex: i + 1, delaySec: acc });
  }
  return out;
}

/**
 * Идентификатор дедупликации QStash-сообщения.
 * QStash отвергает Deduplication-Id с двоеточием, поэтому части разделяются дефисом.
 */
export function dedupId(sessionId, epoch, targetStageIndex) {
  return `${sessionId}-${epoch}-${targetStageIndex}`;
}

/**
 * Проверка QStash-сообщения перехода на актуальность (идемпотентность advance):
 * устаревшие сообщения (после паузы/пропуска/отмены/нового сеанса) отбрасываются.
 */
export function isValidAdvance(session, msg) {
  if (!session) return false;
  if (session.status !== 'running') return false;
  if (session.id !== msg.sessionId) return false;
  if (session.epoch !== msg.epoch) return false;
  if (msg.targetStageIndex !== session.stageIndex + 1) return false;
  return true;
}
