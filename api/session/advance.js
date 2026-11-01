import { isValidAdvance } from '../../lib/chain.js';
import { getSession } from '../../lib/redis.js';
import { advanceToStage } from '../../lib/session.js';

/**
 * Endpoint для QStash: вызывается по истечении задержки каждого перехода.
 * Устаревшие сообщения (не тот сеанс / epoch / этап / статус) молча
 * отбрасываются с ответом 200, чтобы QStash не ретраил их.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const body = req.body || {};
  if (!process.env.CRON_SECRET || body.token !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false });
  }

  const { chatId, targetStageIndex } = body;
  const session = await getSession(chatId);
  if (!isValidAdvance(session, body)) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  await advanceToStage(chatId, session, targetStageIndex);
  return res.status(200).json({ ok: true });
}
