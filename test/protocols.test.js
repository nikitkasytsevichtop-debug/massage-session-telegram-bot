import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CATEGORIES,
  loadProtocols,
  scaleStages,
  validateProtocol,
} from '../lib/protocols.js';

const raw = JSON.parse(
  readFileSync(new URL('../data/protocols.json', import.meta.url), 'utf8')
);

test('в каталоге 14 протоколов и все валидны', () => {
  assert.equal(raw.protocols.length, 14);
  for (const p of raw.protocols) {
    assert.deepEqual(validateProtocol(p), [], `протокол ${p.id} невалиден`);
  }
  assert.equal(loadProtocols(raw).length, 14);
});

test('id протоколов уникальны, категории допустимы', () => {
  const ids = raw.protocols.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of raw.protocols) {
    assert.ok(CATEGORIES[p.category], `неизвестная категория ${p.category}`);
  }
});

test('сумма длительностей этапов равна baseDurationSec', () => {
  for (const p of raw.protocols) {
    const sum = p.stages.reduce((a, s) => a + s.durationSec, 0);
    assert.equal(sum, p.baseDurationSec, p.id);
  }
});

test('каждый этап содержит хотя бы один приём', () => {
  for (const p of raw.protocols) {
    for (const s of p.stages) {
      assert.ok(s.techniques.length >= 1, `${p.id}/${s.key}`);
    }
  }
});

test('сеанс открывается поглаживанием и (кроме отмеченных) закрывается им', () => {
  for (const p of raw.protocols) {
    assert.match(p.stages[0].title.toLowerCase(), /поглажива/, p.id);
    if (p.finalEffleurage !== false) {
      assert.match(
        p.stages[p.stages.length - 1].title.toLowerCase(),
        /поглажива/,
        p.id
      );
    }
  }
});

test('невалидный протокол исключается из каталога (fail-safe)', () => {
  const broken = {
    protocols: [
      raw.protocols[0],
      { id: 'bad', title: 'X', category: 'classic_zones', baseDurationSec: 100, stages: [] },
    ],
  };
  const loaded = loadProtocols(broken);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, raw.protocols[0].id);
});

test('масштабирование: множители, округление до 30 с, минимум 60 с', () => {
  const stages = [{ durationSec: 180 }, { durationSec: 540 }, { durationSec: 60 }];
  const short = scaleStages(stages, 's');
  // 180*0.7=126 -> 120; 540*0.7=378 -> 390; 60*0.7=42 -> минимум 60
  assert.deepEqual(short.map((s) => s.durationSec), [120, 390, 60]);
  const normal = scaleStages(stages, 'n');
  assert.deepEqual(normal.map((s) => s.durationSec), [180, 540, 60]);
  const long = scaleStages(stages, 'l');
  // 180*1.4=252 -> 240; 540*1.4=756 -> 750; 60*1.4=84 -> 90
  assert.deepEqual(long.map((s) => s.durationSec), [240, 750, 90]);
});
