// node --test tests/points.test.mjs — 코드가 들고 있는 수치 계층.
// 구조도에서 검은색으로 칠해진 것 전부가 여기 있고, 여기 밖에는 없어야 한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as PT from '../js/points.js';
import * as P from '../js/prompts.js';

test('게이지는 둘뿐이다 — 무드와 러브', () => {
  const s = PT.initialPoints();
  assert.deepEqual(
    Object.keys(s).sort(),
    ['beats', 'broken', 'history', 'love', 'mood'],
    '상태에 무드·러브·진행 외의 축이 생겼다',
  );
  assert.equal(s.mood, PT.POINTS.moodStart);
  assert.equal(s.love, PT.POINTS.loveStart);
});

test('심판은 증감 여부만 돌려주고, 폭은 코드가 정한다', () => {
  assert.deepEqual(
    P.JUDGE_SCHEMA.properties.mood.enum, ['up', 'down', 'same'],
    '무드 판정이 증감 여부가 아니다',
  );
  assert.deepEqual(P.JUDGE_SCHEMA.properties.love.enum, ['up', 'down', 'same']);
  assert.deepEqual(
    Object.keys(P.JUDGE_SCHEMA.properties).sort(), ['love', 'mood'],
    '판정 출력에 증감 여부 말고 다른 게 붙었다 (점수·해설·이유는 폐지됐다)',
  );
});

test('up/down/same이 정확히 한 걸음씩 움직인다', () => {
  const s0 = PT.initialPoints();
  const up = PT.applyVerdict(s0, { mood: 'up', love: 'up' });
  assert.equal(up.mood, s0.mood + PT.POINTS.moodStep);
  assert.equal(up.love, s0.love + PT.POINTS.loveStep);

  const down = PT.applyVerdict(s0, { mood: 'down', love: 'down' });
  assert.equal(down.mood, s0.mood - PT.POINTS.moodStep);
  assert.equal(down.love, s0.love - PT.POINTS.loveStep);

  const same = PT.applyVerdict(s0, { mood: 'same', love: 'same' });
  assert.equal(same.mood, s0.mood);
  assert.equal(same.love, s0.love);
});

test('모르는 값은 그대로(same)로 떨어진다', () => {
  const s0 = PT.initialPoints();
  const s = PT.applyVerdict(s0, { mood: '???', love: undefined });
  assert.equal(s.mood, s0.mood);
  assert.equal(s.love, s0.love);
});

test('두 게이지는 서로 독립이다 — 험악한데 끌리는 판이 성립한다', () => {
  const s = PT.applyVerdict(PT.initialPoints(), { mood: 'down', love: 'up' });
  assert.ok(s.mood < PT.POINTS.moodStart);
  assert.ok(s.love > PT.POINTS.loveStart);
});

test('0..100을 벗어나지 않는다', () => {
  let s = PT.initialPoints();
  for (let i = 0; i < 40; i++) s = PT.applyVerdict(s, { mood: 'up', love: 'up' });
  assert.equal(s.mood, 100);
  assert.equal(s.love, 100);
  for (let i = 0; i < 40; i++) s = PT.applyVerdict(s, { mood: 'down', love: 'down' });
  assert.equal(s.mood, 0);
  assert.equal(s.love, 0);
});

test('무드가 바닥나면 자리가 깨진 것으로 표시된다', () => {
  let s = PT.initialPoints();
  assert.equal(PT.isBroken(s), false);
  while (s.mood > 0) s = PT.applyVerdict(s, { mood: 'down', love: 'same' });
  assert.equal(PT.isBroken(s), true);
  assert.equal(s.broken, true);
});

test('applyVerdict는 순수 함수다 — 원본을 건드리지 않는다', () => {
  const s0 = PT.initialPoints();
  const snapshot = JSON.stringify(s0);
  PT.applyVerdict(s0, { mood: 'up', love: 'down' });
  assert.equal(JSON.stringify(s0), snapshot);
});

test('구간 기록이 쌓인다 — 사후 원장의 원본', () => {
  let s = PT.initialPoints();
  s = PT.applyVerdict(s, { mood: 'up', love: 'same' }, { phase: 'text' });
  s = PT.applyVerdict(s, { mood: 'same', love: 'up' }, { phase: 'talk' });
  assert.equal(s.history.length, 2);
  assert.deepEqual(s.history.map(h => h.phase), ['text', 'talk']);
  assert.deepEqual(s.history.map(h => h.beat), [1, 2]);
  assert.deepEqual(s.history.map(h => h.dLove), [0, 1]);
});

test('페이즈는 텍스팅과 토킹 둘뿐이다', () => {
  assert.deepEqual(PT.PHASES.map(p => p.key), ['text', 'talk']);
  assert.deepEqual(PT.PHASES.map(p => p.label), ['텍스팅', '토킹']);
  assert.equal(PT.TOTAL_BEATS, PT.PHASES.reduce((n, p) => n + p.beats, 0));
});

test('난이도·성공선·등급은 이 계층에 존재하지 않는다', () => {
  const names = Object.keys(PT);
  for (const dead of ['DIFFICULTIES', 'diffOf', 'verdict', 'debrief', 'TIER_BANDS', 'loveSaturation', 'LEVERAGE_POINTS']) {
    assert.ok(!names.includes(dead), `폐지된 ${dead}가 되살아났다`);
  }
});

test('성사 여부는 코드가 아니라 C(후일담)가 정한다', () => {
  assert.equal(P.EPILOGUE_SCHEMA.properties.success.type, 'boolean');
  assert.ok(!Object.keys(PT).some(k => /threshold|success|accept/i.test(k)),
    '성사 문턱이 코드로 되돌아왔다');
});
