import {
  CATEGORIES,
  DURATION_MODES,
  getGeneralContraindications,
  scaleStages,
  totalDurationSec,
} from './protocols.js';

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 540 → «9 мин», 390 → «6,5 мин» */
export function fmtMin(sec) {
  const min = sec / 60;
  const text = Number.isInteger(min) ? String(min) : min.toFixed(1).replace('.', ',');
  return `${text} мин`;
}

export function fmtClock(ts) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Minsk',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

export function fmtDate(ts) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Minsk',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

function progressBar(index, total) {
  return '▰'.repeat(index + 1) + '▱'.repeat(Math.max(0, total - index - 1));
}

export function renderOnboarding() {
  return [
    '🌿 <b>Здравствуйте!</b>',
    'Это ваш ассистент сеанса массажа. Выберите вид массажа — и я проведу вас по этапам: подскажу приёмы, засеку время и вовремя переключу на следующий этап.',
    '',
    'Вы работаете, я слежу за таймингом и методикой.',
    '',
    '⚠️ Бот — методический помощник для специалиста. Он не заменяет медицинские показания и консультацию врача. Перед сеансом убедитесь в отсутствии противопоказаний у клиента.',
    '',
    'Готовы? Откройте каталог.',
  ].join('\n');
}

export function renderMenu() {
  return '🌿 <b>Главное меню</b>\nВыберите раздел:';
}

export function renderCategories() {
  return '🗂 <b>Виды массажа</b>\nВыберите категорию:';
}

export function renderCategoryList(categoryKey) {
  const cat = CATEGORIES[categoryKey];
  return `${cat.emoji} <b>${esc(cat.title)}</b>\nВыберите вид массажа:`;
}

export function renderProtocolCard(p, modeKey) {
  const mode = DURATION_MODES[modeKey];
  const stages = scaleStages(p.stages, modeKey);
  const total = totalDurationSec(stages);
  const lines = [
    `${p.emoji} <b>${esc(p.title)}</b>`,
    `⏱ Длительность: ${fmtMin(total)} (${mode.label.toLowerCase()})`,
    '',
    '<b>Этапы:</b>',
  ];
  stages.forEach((s, i) => {
    lines.push(`${i + 1}. ${esc(s.title)} — ${fmtMin(s.durationSec)}`);
  });
  lines.push('');
  lines.push(`<b>Показания:</b> ${esc(p.indications)}.`);
  lines.push(`⛔ <b>Противопоказания:</b> ${esc(p.contraindications)}.`);
  if (p.note) lines.push(`💡 <i>${esc(p.note)}</i>`);
  lines.push('');
  lines.push('Выберите длительность и начните сеанс.');
  return lines.join('\n');
}

export function renderStageCard(p, stages, index, session) {
  const stage = stages[index];
  const next = stages[index + 1];
  const lines = [
    `${p.emoji} <b>${esc(p.shortTitle)}</b> · ${progressBar(index, stages.length)}`,
    `🔸 <b>Этап ${index + 1} из ${stages.length} · ${esc(stage.title)}</b> (${fmtMin(stage.durationSec)})`,
    'Приёмы:',
    ...stage.techniques.map((t) => `• ${esc(t)}`),
  ];
  if (stage.hint) lines.push(`💡 <i>${esc(stage.hint)}</i>`);
  lines.push('');
  if (next) {
    lines.push(
      `⏳ Следующий этап — ${esc(next.title.toLowerCase())} — через ${fmtMin(stage.durationSec)} (в ${fmtClock(session.stageEndsAt)}).`
    );
  } else {
    lines.push(`⏳ Завершение сеанса через ${fmtMin(stage.durationSec)} (в ${fmtClock(session.stageEndsAt)}).`);
  }
  return lines.join('\n');
}

export function renderPausedCard(p, stages, index, remainingSec) {
  const stage = stages[index];
  return [
    `${p.emoji} <b>${esc(p.shortTitle)}</b> · ${progressBar(index, stages.length)}`,
    `⏸ <b>Пауза</b> · этап ${index + 1} из ${stages.length} · ${esc(stage.title)}`,
    `До конца этапа осталось ${fmtMin(remainingSec)}.`,
    '',
    'Нажмите «Продолжить», когда будете готовы — таймер пойдёт дальше.',
  ].join('\n');
}

export function renderFinish(p, session, completed) {
  const factSec = Math.max(0, Math.round((Date.now() - session.startedAt) / 1000));
  const stagesDone = completed ? session.durations.length : session.stageIndex;
  const lines = [
    completed ? '🎉 <b>Сеанс завершён.</b>' : '⏹ <b>Сеанс остановлен досрочно.</b>',
    `${p.emoji} ${esc(p.shortTitle)} · факт. длительность ${fmtMin(Math.round(factSec / 30) * 30)} · этапов пройдено: ${stagesDone} из ${session.durations.length}.`,
  ];
  if (completed) lines.push('Дайте клиенту 5–10 минут полежать в покое.');
  return lines.join('\n');
}

export function renderScheduleWarning() {
  return [
    '⚠️ <b>Автопереходы не запланированы.</b>',
    'Сеанс идёт, но сам этапы переключать не буду — пользуйтесь кнопкой «⏭ Пропустить этап».',
    'Причина в планировщике QStash: проверьте переменные <code>QSTASH_URL</code> и <code>QSTASH_TOKEN</code>.',
  ].join('\n');
}

export function renderTechniquesIndex() {
  return '📖 <b>Справочник приёмов</b>\nКлассическая школа: сеанс открывается и закрывается поглаживанием, растирание готовит ткани к разминанию, разминание — основной приём (≈50–60% времени), вибрация завершает проработку.\n\nВыберите приём:';
}

export function renderTechnique(t) {
  return [
    `${t.emoji} <b>${esc(t.title)}</b>`,
    `<i>${esc(t.share)}</i>`,
    '',
    esc(t.description),
    '',
    '<b>Вариации:</b>',
    ...t.kinds.map((k) => `• ${esc(k)}`),
  ].join('\n');
}

export function renderGeneralContraindications() {
  return `⛔ <b>Общие противопоказания к массажу</b>\n\n${esc(getGeneralContraindications())}\n\n⚠️ <i>Памятка специалисту, не замена консультации врача.</i>`;
}

export function renderHistory(items, protocolById) {
  if (!items.length) {
    return '🕘 <b>История сеансов</b>\n\nПока пусто. Проведите первый сеанс — он появится здесь.';
  }
  const lines = ['🕘 <b>История сеансов</b> (последние записи):', ''];
  for (const it of items) {
    const p = protocolById(it.protocolId);
    const title = p ? p.shortTitle : it.protocolId;
    const durMin = Math.round((it.finishedAt - it.startedAt) / 60000);
    const mark = it.completed ? '✅' : '⏹';
    const mode = DURATION_MODES[it.mode]?.short ?? '';
    lines.push(`${mark} ${fmtDate(it.startedAt)} · ${esc(title)} ${mode} · ${durMin} мин`);
  }
  return lines.join('\n');
}

export function renderSettings(settings) {
  const mode = DURATION_MODES[settings.mode] ?? DURATION_MODES.n;
  const soundLabel = { always: 'всегда со звуком', night: 'ночью без звука (22:00–08:00)', off: 'всегда без звука' }[settings.sound] ?? settings.sound;
  return [
    '⚙️ <b>Настройки</b>',
    '',
    `⏱ Длительность по умолчанию: <b>${mode.label} ${mode.short}</b>`,
    `🔔 Звук уведомлений: <b>${soundLabel}</b>`,
    '',
    'Нажмите на параметр, чтобы изменить его.',
  ].join('\n');
}

export function renderConfirmClearHistory() {
  return '🗑 Удалить всю историю сеансов? Это действие необратимо.';
}
