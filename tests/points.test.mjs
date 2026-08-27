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

test('무드는 언제나 한 칸이다 — 사정을 안 탄다', () => {
  const s0 = PT.initialPoints();
  assert.equal(PT.applyVerdict(s0, { mood: 'up', love: 'same' }).mood, s0.mood + PT.POINTS.moodStep);
  assert.equal(PT.applyVerdict(s0, { mood: 'down', love: 'same' }).mood, s0.mood - PT.POINTS.moodStep);
  assert.equal(PT.applyVerdict(s0, { mood: 'same', love: 'same' }).mood, s0.mood);

  // 자리가 달아올라 있든 얼어 있든 무드 자신의 폭은 같다
  let hot = PT.initialPoints();
  while (hot.mood < PT.POINTS.moodHot) hot = PT.applyVerdict(hot, { mood: 'up', love: 'same' });
  assert.equal(PT.applyVerdict(hot, { mood: 'up', love: 'same' }).mood, hot.mood + PT.POINTS.moodStep);
});

test('러브 ▼는 언제나 한 칸이다 — 밟힌 건 자리 온도와 무관하다', () => {
  const s0 = PT.initialPoints();
  assert.equal(PT.applyVerdict(s0, { mood: 'same', love: 'down' }).love, s0.love - PT.POINTS.loveStep);

  let hot = PT.initialPoints();
  while (hot.mood < PT.POINTS.moodHot) hot = PT.applyVerdict(hot, { mood: 'up', love: 'same' });
  assert.equal(PT.applyVerdict(hot, { mood: 'same', love: 'down' }).love, hot.love - PT.POINTS.loveStep);
});

test('same은 두 게이지 다 그대로 둔다', () => {
  const s0 = PT.initialPoints();
  const same = PT.applyVerdict(s0, { mood: 'same', love: 'same' });
  assert.equal(same.mood, s0.mood);
  assert.equal(same.love, s0.love);
});

// ── 러브 ▲의 폭을 정하는 규칙은 둘뿐이다 ────────────────
test('규칙 ① 자리가 달아올라 있으면 러브 ▲가 한 칸 더 붙는다', () => {
  const cold = PT.POINTS.moodHot - 1;
  assert.equal(PT.loveGain(cold, 1), PT.POINTS.loveStep);
  assert.equal(PT.loveGain(PT.POINTS.moodHot, 1), PT.POINTS.loveStep + 1);
  assert.equal(PT.loveGain(PT.POINTS.moodMax, 1), PT.POINTS.loveStep + 1,
    '달아오름은 밴드 하나다 — 무드가 더 높다고 더 붙지 않는다');
});

test('규칙 ② 러브 ▲가 연달아 나오면 커진다 (1 → 2 → 3연속 이상)', () => {
  const cold = PT.POINTS.moodHot - 1;
  assert.deepEqual(
    [1, 2, 3, 4, 9].map(run => PT.loveGain(cold, run)),
    [1, 2, 3, 3, 3],
    '연속 보너스가 3연속에서 멈추지 않는다',
  );
});

test('러브 ▲ 한 번의 폭은 1~4칸 사이다', () => {
  const all = [];
  for (let mood = 0; mood <= PT.POINTS.moodMax; mood++) {
    for (let run = 1; run <= 9; run++) all.push(PT.loveGain(mood, run));
  }
  assert.equal(Math.min(...all), 1);
  assert.equal(Math.max(...all), 4);
});

test('연속은 ▼나 ─ 하나로 끊긴다', () => {
  let s = PT.initialPoints();
  s = PT.applyVerdict(s, { mood: 'same', love: 'up' });    // 1연속 → +1
  s = PT.applyVerdict(s, { mood: 'same', love: 'up' });    // 2연속 → +2
  assert.equal(s.history.at(-1).step, 2);
  s = PT.applyVerdict(s, { mood: 'same', love: 'same' });  // 끊김
  s = PT.applyVerdict(s, { mood: 'same', love: 'up' });    // 다시 1연속 → +1
  assert.equal(s.history.at(-1).step, 1);
});

test('같은 ▲ 개수라도 언제 어디서 났는지에 따라 갈린다', () => {
  const play = seq => seq.reduce((s, v) => PT.applyVerdict(s, v), PT.initialPoints());
  const M = n => Array.from({ length: n }, () => ({ mood: 'up', love: 'same' }));
  const L = n => Array.from({ length: n }, () => ({ mood: 'same', love: 'up' }));
  const gap = { mood: 'same', love: 'same' };

  const scattered = play([L(1), [gap], L(1), [gap], L(1)].flat());        // ▲3 산발 · 미지근
  const streak = play([L(3)].flat());                                     // ▲3 연속 · 미지근
  const hotStreak = play([M(3), L(3)].flat());                            // ▲3 연속 · 달아오름

  assert.ok(scattered.love < streak.love, '연속이 산발보다 크지 않다');
  assert.ok(streak.love < hotStreak.love, '뜨거운 자리가 미지근한 자리보다 크지 않다');
  assert.deepEqual([scattered.love, streak.love, hotStreak.love], [5, 8, 11]);
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

test('각자의 눈금을 벗어나지 않는다 — 무드 0..10, 러브 0..20', () => {
  let s = PT.initialPoints();
  for (let i = 0; i < 40; i++) s = PT.applyVerdict(s, { mood: 'up', love: 'up' });
  assert.equal(s.mood, PT.POINTS.moodMax);
  assert.equal(s.love, PT.POINTS.loveMax);
  for (let i = 0; i < 40; i++) s = PT.applyVerdict(s, { mood: 'down', love: 'down' });
  assert.equal(s.mood, 0);
  assert.equal(s.love, 0);
});

test('눈금은 셀 수 있는 크기다 — 한 걸음이 1이고 최대치가 두 자리다', () => {
  assert.equal(PT.POINTS.moodStep, 1);
  assert.equal(PT.POINTS.loveStep, 1);
  assert.ok(PT.POINTS.moodMax <= 20 && PT.POINTS.loveMax <= 20,
    '0..100으로 되돌아갔다 — 한 걸음이 1인데 최대치가 100이면 눈금이 거짓말을 한다');
  assert.equal(PT.POINTS.moodStart * 2, PT.POINTS.moodMax, '무드는 한가운데서 시작한다');
});

test('무드는 다섯 걸음이면 바닥난다', () => {
  let s = PT.initialPoints();
  let n = 0;
  while (!PT.isBroken(s)) { s = PT.applyVerdict(s, { mood: 'down', love: 'same' }); n++; }
  assert.equal(n, 5);
});

test('C에 넘길 때만 0..100으로 되돌린다 — 프롬프트의 눈금은 그대로다', () => {
  assert.equal(PT.loveOutOf100(0), 0);
  assert.equal(PT.loveOutOf100(PT.POINTS.loveMax), 100);
  assert.equal(PT.loveOutOf100(PT.POINTS.loveMax / 2), 50);
  assert.equal(PT.loveOutOf100(PT.POINTS.loveStart), 10);
  assert.equal(PT.loveOutOf100(PT.POINTS.loveMax * 5), 100, '눈금 밖의 값도 잘린다');
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
