import { CATEGORIES, DURATION_MODES, getProtocolsByCategory } from './protocols.js';

const btn = (text, callback_data) => ({ text, callback_data });
export const kb = (rows) => ({ reply_markup: { inline_keyboard: rows } });

export function kbOnboarding() {
  return kb([[btn('🗂 Открыть каталог', 'cats')]]);
}

export function kbMenu() {
  return kb([
    [btn('🗂 Виды массажа', 'cats')],
    [btn('📖 Справочник приёмов', 'techs')],
    [btn('🕘 История сеансов', 'hist')],
    [btn('⚙️ Настройки', 'sett')],
  ]);
}

export function kbCategories() {
  const rows = Object.entries(CATEGORIES).map(([key, c]) => [
    btn(`${c.emoji} ${c.title}`, `cat:${key}`),
  ]);
  rows.push([btn('⬅️ Меню', 'menu')]);
  return kb(rows);
}

export function kbCategory(categoryKey) {
  const rows = getProtocolsByCategory(categoryKey).map((p) => [
    btn(`${p.emoji} ${p.shortTitle}`, `p:${p.id}`),
  ]);
  rows.push([btn('⬅️ Категории', 'cats')]);
  return kb(rows);
}

export function kbProtocolCard(p, modeKey) {
  const modeRow = Object.entries(DURATION_MODES).map(([key, m]) =>
    btn(`${key === modeKey ? '✅ ' : ''}${m.label} ${m.short}`, `p:${p.id}:${key}`)
  );
  return kb([
    modeRow,
    [btn('▶️ Начать сеанс', `go:${p.id}:${modeKey}`)],
    [btn('⛔ Общие противопоказания', `contra:p:${p.id}`)],
    [btn('⬅️ Назад', `cat:${p.category}`)],
  ]);
}

export function kbSessionRunning() {
  return kb([
    [btn('⏸ Пауза', 'c:pause'), btn('⏭ Пропустить этап', 'c:skip')],
    [btn('⏹ Завершить', 'c:stop')],
  ]);
}

export function kbSessionPaused() {
  return kb([
    [btn('▶️ Продолжить', 'c:resume')],
    [btn('⏹ Завершить', 'c:stop')],
  ]);
}

export function kbFinish(p, modeKey) {
  return kb([
    [btn('🔁 Повторить', `go:${p.id}:${modeKey}`), btn('🗂 В каталог', 'cats')],
  ]);
}

export function kbTechniques(techniques) {
  const rows = Object.entries(techniques).map(([key, t]) => [
    btn(`${t.emoji} ${t.title}`, `tech:${key}`),
  ]);
  rows.push([btn('⛔ Общие противопоказания', 'contra:techs')]);
  rows.push([btn('⬅️ Меню', 'menu')]);
  return kb(rows);
}

export function kbBack(target) {
  return kb([[btn('⬅️ Назад', target)]]);
}

export function kbHistory() {
  return kb([[btn('⬅️ Меню', 'menu')]]);
}

export function kbSettings(settings) {
  const nextMode = { s: 'n', n: 'l', l: 's' }[settings.mode] ?? 'n';
  const nextSound = { always: 'night', night: 'off', off: 'always' }[settings.sound] ?? 'night';
  const mode = DURATION_MODES[settings.mode] ?? DURATION_MODES.n;
  const soundLabel = { always: '🔔 всегда', night: '🌙 ночью тихо', off: '🔕 без звука' }[settings.sound] ?? settings.sound;
  return kb([
    [btn(`⏱ Длительность: ${mode.label}`, `sdur:${nextMode}`)],
    [btn(`Звук: ${soundLabel}`, `ssound:${nextSound}`)],
    [btn('🗑 Сбросить историю', 'histclear')],
    [btn('⬅️ Меню', 'menu')],
  ]);
}

export function kbConfirmClearHistory() {
  return kb([
    [btn('🗑 Да, удалить', 'histclear2'), btn('Отмена', 'sett')],
  ]);
}
