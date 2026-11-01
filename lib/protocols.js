import { readFileSync } from 'node:fs';

const protocolsRaw = JSON.parse(
  readFileSync(new URL('../data/protocols.json', import.meta.url), 'utf8')
);
const techniquesRaw = JSON.parse(
  readFileSync(new URL('../data/techniques.json', import.meta.url), 'utf8')
);

export const CATEGORIES = {
  classic_zones: { title: 'Классический по зонам', emoji: '🗺' },
  general: { title: 'Общий и оздоровительный', emoji: '🧖' },
  cosmetic: { title: 'Косметологические / коррекция', emoji: '✨' },
  sport: { title: 'Спортивный', emoji: '🏅' },
};

export const DURATION_MODES = {
  s: { label: 'Сокращённый', short: '×0.7', mult: 0.7 },
  n: { label: 'Стандартный', short: '×1.0', mult: 1.0 },
  l: { label: 'Расширенный', short: '×1.4', mult: 1.4 },
};

const hasEffleurage = (stage) =>
  (stage?.title || '').toLowerCase().includes('поглажива');

/** Возвращает список ошибок валидации протокола (пустой — протокол валиден). */
export function validateProtocol(p) {
  const errors = [];
  if (!p.id || typeof p.id !== 'string') errors.push('нет id');
  if (!p.title) errors.push('нет title');
  if (!CATEGORIES[p.category]) errors.push(`недопустимая категория: ${p.category}`);
  if (!Array.isArray(p.stages) || p.stages.length === 0) {
    errors.push('нет этапов');
    return errors;
  }
  const sum = p.stages.reduce((acc, s) => acc + (s.durationSec || 0), 0);
  if (sum !== p.baseDurationSec) {
    errors.push(`сумма этапов ${sum}с ≠ baseDurationSec ${p.baseDurationSec}с`);
  }
  for (const s of p.stages) {
    if (!s.key || !s.title) errors.push(`этап без key/title`);
    if (!Number.isInteger(s.durationSec) || s.durationSec <= 0)
      errors.push(`этап «${s.title}»: некорректная длительность`);
    if (!Array.isArray(s.techniques) || s.techniques.length === 0)
      errors.push(`этап «${s.title}»: нет приёмов`);
  }
  if (!hasEffleurage(p.stages[0])) errors.push('первый этап — не поглаживание');
  if (p.finalEffleurage !== false && !hasEffleurage(p.stages[p.stages.length - 1]))
    errors.push('последний этап — не поглаживание');
  return errors;
}

/** Загрузка каталога: невалидные протоколы исключаются с логом (fail-safe). */
export function loadProtocols(raw = protocolsRaw) {
  const valid = [];
  for (const p of raw.protocols || []) {
    const errors = validateProtocol(p);
    if (errors.length) {
      console.error(`Протокол «${p.id}» исключён из каталога:`, errors.join('; '));
      continue;
    }
    valid.push(p);
  }
  return valid;
}

const protocols = loadProtocols();

export function getProtocols() {
  return protocols;
}

export function getProtocol(id) {
  return protocols.find((p) => p.id === id) || null;
}

export function getProtocolsByCategory(category) {
  return protocols.filter((p) => p.category === category);
}

export function getTechniques() {
  return techniquesRaw;
}

export function getGeneralContraindications() {
  return protocolsRaw.generalContraindications || '';
}

/**
 * Масштабирование этапов под режим длительности:
 * множитель ×0.7 / ×1.0 / ×1.4, округление до 30 с (0.5 мин), минимум 60 с на этап.
 */
export function scaleStages(stages, modeKey) {
  const { mult } = DURATION_MODES[modeKey] ?? DURATION_MODES.n;
  return stages.map((s) => ({
    ...s,
    durationSec: Math.max(60, Math.round((s.durationSec * mult) / 30) * 30),
  }));
}

export function totalDurationSec(stages) {
  return stages.reduce((acc, s) => acc + s.durationSec, 0);
}
