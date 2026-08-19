// node --test tests/  — 규칙 계층 회귀 테스트 (LLM 불필요)
import test from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, diffOf, initialState, applyTurn, firstImpression, applyRadio, failureReason, verdict, debrief } from '../js/scoring.js';

const perfect = { styleScore: 10, coachScore: 10, courageScore: 10 };
const zero = { styleScore: 0, coachScore: 0, courageScore: 0 };

test('난이도가 오를수록 성공선이 높고 취향 공개가 줄어든다', () => {
  const [e, n, h] = ['쉬움', '보통', '헬'].map(diffOf);
  assert.ok(e.threshold < n.threshold && n.threshold < h.threshold);
  assert.ok(e.visiblePrefs > n.visiblePrefs && n.visiblePrefs > h.visiblePrefs);
  assert.ok(e.hiddenPrefs < n.hiddenPrefs && n.hiddenPrefs < h.hiddenPrefs);
  assert.ok(e.loveDecay <= n.loveDecay && n.loveDecay < h.loveDecay);
});

test('준비 점수가 초기 상태와 배율에 반영된다', () => {
  const d = diffOf('보통');
  const hi = initialState(d, perfect), lo = initialState(d, zero);
  assert.ok(hi.love > lo.love, '스타일링이 호감 출발선을 올린다');
  assert.ok(hi.mood > lo.mood, '코칭이 분위기 출발선을 올린다');
  assert.ok(hi.courage > lo.courage, '연설이 용기 총량을 올린다');
  assert.ok(hi.styleMult > lo.styleMult);
  assert.ok(hi.moodGainMult > lo.moodGainMult);
  assert.ok(hi.moodLossMult < lo.moodLossMult, '코칭이 나쁠수록 분위기가 잘 깎인다');
});

test('같은 심판 판정이라도 스타일링이 낮으면 호감이 덜 오른다', () => {
  const d = diffOf('보통');
  const j = { moodDelta: 4, loveDelta: 6 };
  const a = applyTurn(initialState(d, perfect), d, j);
  const b = applyTurn(initialState(d, { ...perfect, styleScore: 0 }), d, j);
  assert.ok(a.lastDelta.love > b.lastDelta.love);
});

test('용기가 바닥나면 패닉: 즉시 실패가 아니라 분위기를 갉아먹는다', () => {
  const d = diffOf('헬');
  let s = initialState(d, { ...perfect, courageScore: 0 });
  let sawPanic = false;
  for (let i = 0; i < 12 && !failureReason(s); i++) {
    s = applyTurn(s, d, { moodDelta: 2, loveDelta: 4 });
    if (s.panic) sawPanic = true;
  }
  assert.ok(sawPanic, '연설을 안 하면 헬에서 반드시 패닉에 빠진다');
  assert.equal(s.courage, 0);
});

test('분위기가 0이면 공작이 파탄난다', () => {
  const d = diffOf('보통');
  let s = initialState(d, zero);
  for (let i = 0; i < 20 && !failureReason(s); i++) s = applyTurn(s, d, { moodDelta: -8, loveDelta: -2 });
  assert.equal(failureReason(s), 'mood');
});

test('무전: 정확하면 호감까지 오르고, 겉돌면 분위기가 깎인다', () => {
  const d = diffOf('보통');
  const base = initialState(d, { ...perfect, courageScore: 3 }); // 상한에 걸리지 않게
  const good = applyRadio(base, d, 9);
  const bad = applyRadio(base, d, 1);
  assert.ok(good.lastDelta.love > 0 && good.lastDelta.mood > 0);
  assert.ok(bad.lastDelta.mood < 0, '막연한 지시는 분위기를 깎는다');
  assert.ok(good.courage > bad.courage);
  // 용기가 이미 가득이면 회복분은 버려진다(무전을 아껴야 할 이유)
  const full = applyRadio(initialState(d, perfect), d, 9);
  assert.equal(full.courage, 100);
});

test('첫인상은 스타일링 점수에 따라 부호가 갈린다', () => {
  const d = diffOf('보통');
  assert.ok(firstImpression(initialState(d, perfect), d).lastDelta.love > 0);
  assert.ok(firstImpression(initialState(d, zero), d).lastDelta.love < 0);
});

test('판정: 성공선과 분위기 하한을 모두 넘어야 성공', () => {
  const d = diffOf('보통');
  assert.equal(verdict({ love: d.threshold + 20, mood: 80 }, d).accepted, true);
  assert.equal(verdict({ love: d.threshold - 1, mood: 80 }, d).accepted, false);
  assert.equal(verdict({ love: d.threshold + 20, mood: d.moodFloor - 1 }, d).accepted, false, '분위기가 낮으면 호감이 높아도 실패');
  assert.equal(verdict({ love: 99, mood: 99 }, d, { aborted: true }).grade, 'F');
});

test('디브리핑이 부실한 레버를 정확히 짚는다', () => {
  const d = diffOf('헬');
  const s = { ...initialState(d, { styleScore: 9, coachScore: 2, courageScore: 8 }), radioCount: 0, radioAimSum: 0 };
  const v = verdict({ love: 30, mood: 50 }, d);
  const db = debrief(s, d, v);
  const weak = db.items.filter(i => i.weak).map(i => i.name);
  assert.ok(weak.includes('대화 코칭'));
  assert.ok(weak.includes('무전 개입'), '한 번도 개입 안 하면 약점으로 잡힌다');
  assert.ok(!weak.includes('스타일링'));
});
