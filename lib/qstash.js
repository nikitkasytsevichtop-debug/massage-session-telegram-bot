const qstashPublishUrl = () =>
  `${process.env.QSTASH_URL || 'https://qstash.upstash.io'}/v2/publish/`;

/**
 * Публикация отложенного сообщения QStash на endpoint приложения.
 * @param {string} path — путь endpoint'а, например '/api/session/advance'
 * @param {object} body — тело сообщения (JSON)
 * @param {number} delaySec — задержка доставки в секундах
 * @param {string} dedupId — Deduplication-Id (защита от сетевых повторов)
 */
export async function publishDelayed(path, body, delaySec, dedupId) {
  const target = `${process.env.APP_URL}${path}`;
  try {
    const res = await fetch(qstashPublishUrl() + target, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.QSTASH_TOKEN}`,
        'Content-Type': 'application/json',
        'Upstash-Delay': `${Math.max(0, Math.round(delaySec))}s`,
        'Upstash-Deduplication-Id': dedupId,
        'Upstash-Retries': '3',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('QStash publish failed:', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('QStash publish network error:', err.message);
    return false;
  }
}
