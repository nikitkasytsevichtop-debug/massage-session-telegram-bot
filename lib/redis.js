import { Redis } from '@upstash/redis';

let client = null;

/**
 * Upstash Redis. Поддерживаются оба варианта именования переменных:
 * собственные Upstash (UPSTASH_REDIS_REST_*) и те, что подставляет
 * Vercel Marketplace для Upstash for Redis (KV_REST_API_*).
 */
export function getRedis() {
  if (!client) {
    client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
    });
  }
  return client;
}

const SESSION_TTL_SEC = 6 * 60 * 60;

export const sessionKey = (chatId) => `session:${chatId}`;
export const historyKey = (chatId) => `history:${chatId}`;
export const settingsKey = (chatId) => `settings:${chatId}`;

export async function getSession(chatId) {
  return await getRedis().get(sessionKey(chatId));
}

export async function saveSession(chatId, session) {
  await getRedis().set(sessionKey(chatId), session, { ex: SESSION_TTL_SEC });
}

export async function deleteSession(chatId) {
  await getRedis().del(sessionKey(chatId));
}

export async function pushHistory(chatId, entry) {
  const r = getRedis();
  await r.lpush(historyKey(chatId), JSON.stringify(entry));
  await r.ltrim(historyKey(chatId), 0, 49);
}

export async function getHistory(chatId, count = 10) {
  const items = await getRedis().lrange(historyKey(chatId), 0, count - 1);
  return items.map((it) => (typeof it === 'string' ? JSON.parse(it) : it));
}

export async function clearHistory(chatId) {
  await getRedis().del(historyKey(chatId));
}

const DEFAULT_SETTINGS = { mode: 'n', sound: 'night' };

export async function getSettings(chatId) {
  const s = await getRedis().get(settingsKey(chatId));
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}

export async function saveSettings(chatId, settings) {
  await getRedis().set(settingsKey(chatId), settings);
}
