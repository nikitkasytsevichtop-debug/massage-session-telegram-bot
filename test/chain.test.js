import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChainDelays, dedupId, isValidAdvance } from '../lib/chain.js';

test('Deduplication-Id не содержит символов, запрещённых QStash', () => {
  const id = dedupId('ms3bnj0cq1rsph', 2, 5);
  assert.ok(!id.includes(':'), 'QStash отвергает двоеточие в Deduplication-Id');
  assert.match(id, /^[A-Za-z0-9_-]+$/, 'допустимы только буквы, цифры, дефис и подчёркивание');
});

test('Deduplication-Id различается для этапов, поколений и сеансов', () => {
  const ids = new Set([
    dedupId('a', 0, 1),
    dedupId('a', 0, 2),
    dedupId('a', 1, 1),
    dedupId('b', 0, 1),
  ]);
  assert.equal(ids.size, 4);
});

test('цепочка со старта: накопительные задержки, финал = сумма всех этапов', () => {
  const durations = [180, 240, 540, 120, 120];
  const plan = buildChainDelays(durations, 0);
  assert.deepEqual(plan, [
    { targetStageIndex: 1, delaySec: 180 },
    { targetStageIndex: 2, delaySec: 420 },
    { targetStageIndex: 3, delaySec: 960 },
    { targetStageIndex: 4, delaySec: 1080 },
    { targetStageIndex: 5, delaySec: 1200 },
  ]);
  assert.equal(plan.at(-1).delaySec, durations.reduce((a, b) => a + b));
});

test('цепочка после возобновления: первый переход через остаток этапа', () => {
  const durations = [180, 240, 540];
  const plan = buildChainDelays(durations, 1, 100);
  assert.deepEqual(plan, [
    { targetStageIndex: 2, delaySec: 100 },
    { targetStageIndex: 3, delaySec: 640 },
  ]);
});

test('цепочка с последнего этапа содержит только завершение', () => {
  const plan = buildChainDelays([180, 240], 1);
  assert.deepEqual(plan, [{ targetStageIndex: 2, delaySec: 240 }]);
});

const baseSession = {
  id: 'abc',
  epoch: 2,
  stageIndex: 1,
  status: 'running',
};
const baseMsg = { sessionId: 'abc', epoch: 2, targetStageIndex: 2 };

test('валидное сообщение перехода принимается', () => {
  assert.equal(isValidAdvance(baseSession, baseMsg), true);
});

test('устаревшие/чужие сообщения отбрасываются', () => {
  assert.equal(isValidAdvance(null, baseMsg), false, 'нет сеанса');
  assert.equal(
    isValidAdvance({ ...baseSession, status: 'paused' }, baseMsg),
    false,
    'сеанс на паузе'
  );
  assert.equal(
    isValidAdvance({ ...baseSession, epoch: 3 }, baseMsg),
    false,
    'старый epoch после паузы/пропуска'
  );
  assert.equal(
    isValidAdvance({ ...baseSession, id: 'other' }, baseMsg),
    false,
    'сообщение от предыдущего сеанса'
  );
  assert.equal(
    isValidAdvance(baseSession, { ...baseMsg, targetStageIndex: 3 }),
    false,
    'переход не на следующий этап'
  );
  assert.equal(
    isValidAdvance({ ...baseSession, stageIndex: 2 }, baseMsg),
    false,
    'этап уже пройден (дубль)'
  );
});
