// node --test tests/  — 규칙 계층 회귀 테스트 (LLM 불필요)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIFFICULTIES, TIER_BANDS, TUNING, diffOf, bandLove, gateTier, moodMultiplier,
  initialState, applyTurn, noteRadio, failureReason, verdict, debrief,
} from '../js/scoring.js';
import { COUPLES, COUPLE_BY_ID } from '../js/couples.js';
import * as P from '../js/prompts.js';

const anyCouple = COUPLE_BY_ID['os-war'];
const VIS = anyCouple.target.visiblePrefs;
const HID = anyCouple.target.hiddenPrefs;

// hit/critical은 게이트가 있으므로 취향 적중을 함께 넣어야 그 등급이 유지된다.
const J = (tier, extra = {}) => ({
  tier, moodDelta: 0, loveDelta: TIER_BANDS[tier][1],
  visiblePrefHit: tier === 'hit' ? VIS[0] : '',
  hiddenPrefHit: tier === 'critical' ? HID[0] : '',
  redLineHit: tier === 'redline', reason: '', ...extra,
});
const OPTS = { knownHidden: HID, knownVisible: VIS };

// ── 커플 데이터 ──────────────────────────────────────────
test('의뢰 대장은 정확히 20쌍이고 id가 중복되지 않는다', () => {
  assert.equal(COUPLES.length, 20);
  assert.equal(new Set(COUPLES.map(c => c.id)).size, 20);
});

test('모든 커플이 필수 필드를 갖추고 있다', () => {
  for (const c of COUPLES) {
    assert.ok(DIFFICULTIES[c.difficulty], `${c.id}: 알 수 없는 난이도 ${c.difficulty}`);
    assert.ok(P.ENDING_FRAME[c.endingKind], `${c.id}: 알 수 없는 결승선 ${c.endingKind}`);
    assert.ok(c.clash && c.winWord && c.category, `${c.id}: 메타 누락`);
    for (const who of ['client', 'target']) {
      const p = c[who];
      assert.ok(p.name && p.job && p.age > 0, `${c.id}.${who}: 신원 누락`);
      assert.ok(p.appearance.length >= 3, `${c.id}.${who}: 외모 태그 부족`);
      assert.ok(p.personality.length >= 3, `${c.id}.${who}: 성격 태그 부족`);
      assert.ok(p.spec && p.spec.hair && p.spec.species, `${c.id}.${who}: 아바타 스펙 누락`);
    }
    assert.ok(c.client.story.length > 40, `${c.id}: 사연이 너무 짧다`);
    assert.ok(c.client.weakness, `${c.id}: 약점 누락`);
    assert.ok(c.target.visiblePrefs.length >= 2, `${c.id}: 공개 취향 부족`);
    assert.ok(c.target.hiddenPrefs.length >= 3, `${c.id}: 미확인 취향 부족`);
    assert.ok(c.target.redLines.length >= 3, `${c.id}: 지뢰 부족`);
    // 미확인 취향이 공개 취향과 겹치면 게임이 성립하지 않는다
    for (const h of c.target.hiddenPrefs) {
      assert.ok(!c.target.visiblePrefs.includes(h), `${c.id}: 취향 중복 "${h}"`);
    }
  }
});

test('난이도 세 종류가 모두 실제로 쓰인다', () => {
  const used = new Set(COUPLES.map(c => c.difficulty));
  assert.deepEqual([...used].sort(), ['보통', '쉬움', '헬'].sort());
});

// ── 준비 단계는 규칙 계층에 존재하지 않는다 ──────────────
test('규칙 계층에는 스타일링/코칭/연설 점수라는 개념 자체가 없다', () => {
  const s = initialState(diffOf('보통'));
  for (const k of ['styleScore', 'coachScore', 'courageScore', 'courage']) {
    assert.equal(s[k], undefined, `${k}가 아직 남아 있다`);
  }
  // initialState는 인자를 하나만 받는다 — 준비 점수를 넣을 자리가 없다
  assert.equal(initialState.length, 1);
});

test('무전은 채점되지 않고 횟수만 센다', () => {
  const before = initialState(diffOf('보통'));
  const after = noteRadio(before);
  assert.equal(after.radioUsed, 1);
  assert.equal(after.love, before.love, '무전 자체로는 호감이 변하지 않는다');
  assert.equal(after.mood, before.mood, '무전 자체로는 분위기가 변하지 않는다');
});

// ── 난이도 ───────────────────────────────────────────────
test('난이도가 오를수록 성공선이 높고 출발선이 낮다', () => {
  const [e, n, h] = ['쉬움', '보통', '헬'].map(diffOf);
  assert.ok(e.threshold < n.threshold && n.threshold < h.threshold);
  assert.ok(e.startLove > n.startLove && n.startLove > h.startLove);
  assert.ok(e.startMood > n.startMood && n.startMood > h.startMood);
  assert.ok(e.moodDrift > n.moodDrift && n.moodDrift > h.moodDrift);
  assert.ok(e.loveDecay <= n.loveDecay && n.loveDecay < h.loveDecay);
});

test('무전 배분은 기획서대로 문자 1회 / 대면 2회로 고정', () => {
  for (const d of Object.values(DIFFICULTIES)) {
    assert.equal(d.radioText, 1);
    assert.equal(d.radioTalk, 2);
  }
});

// ── tier 밴드 ────────────────────────────────────────────
test('심판이 뭘 뱉든 tier 밴드 안으로 강제된다', () => {
  assert.equal(bandLove('empty', 9), 1, 'empty인데 +9를 주면 +1로 깎인다');
  assert.equal(bandLove('critical', 2), 8, 'critical인데 +2면 밴드 하한으로 올린다');
  assert.equal(bandLove('redline', 5), -6);
  assert.equal(bandLove('backfire', 0), -2);
  assert.equal(bandLove('ok', 100), 4);
  assert.equal(bandLove('없는tier', 5), 5, '모르는 tier면 원값을 -10~10으로만 자른다');
});

test('tier가 높을수록 호감이 더 오른다 (동일 조건)', () => {
  const d = diffOf('보통');
  const base = initialState(d);
  const order = ['redline', 'backfire', 'empty', 'ok', 'hit', 'critical'];
  const gains = order.map(t => applyTurn(base, d, J(t), OPTS).lastDelta.love);
  for (let i = 1; i < gains.length; i++) {
    assert.ok(gains[i] > gains[i - 1], `${order[i]}(${gains[i]})가 ${order[i - 1]}(${gains[i - 1]})보다 커야 한다`);
  }
});

test('empty 판정만 반복하면 성공선에 절대 못 닿는다', () => {
  for (const name of ['쉬움', '보통', '헬']) {
    const d = diffOf(name);
    let s = initialState(d);
    for (let i = 0; i < d.textTurns + d.talkTurns; i++) {
      if (failureReason(s)) break;
      s = applyTurn(s, d, J('empty', { moodDelta: 0 }), { knownHidden: [] });
    }
    assert.ok(!verdict(s, d).accepted, `${name}: 알맹이 없는 대화로 성사되면 안 된다`);
  }
});

// ── 분위기 ───────────────────────────────────────────────
test('분위기는 호감 획득 배율이다', () => {
  assert.ok(moodMultiplier(0) < moodMultiplier(50));
  assert.ok(moodMultiplier(50) < moodMultiplier(100));
  assert.equal(moodMultiplier(0), TUNING.moodMultFloor);
  assert.equal(moodMultiplier(100), TUNING.moodMultFloor + TUNING.moodMultSpan);
});

test('같은 판정이라도 분위기가 낮으면 호감이 덜 오른다', () => {
  const d = diffOf('보통');
  const hi = applyTurn({ ...initialState(d), mood: 95 }, d, J('hit'), OPTS);
  const lo = applyTurn({ ...initialState(d), mood: 5 }, d, J('hit'), OPTS);
  assert.ok(hi.lastDelta.love > lo.lastDelta.love * 2);
});

test('분위기는 높을수록 올리기 어렵다 (포화)', () => {
  const d = diffOf('보통');
  const low = applyTurn({ ...initialState(d), mood: 20 }, d, J('ok', { moodDelta: 8 }), { knownHidden: [] });
  const high = applyTurn({ ...initialState(d), mood: 90 }, d, J('ok', { moodDelta: 8 }), { knownHidden: [] });
  assert.ok(low.lastDelta.mood > high.lastDelta.mood, '같은 +8이라도 이미 좋은 분위기는 덜 오른다');
});

test('분위기 하락에는 포화가 걸리지 않는다', () => {
  const d = diffOf('보통');
  const s = applyTurn({ ...initialState(d), mood: 95 }, d, J('backfire', { moodDelta: -8 }), { knownHidden: [] });
  assert.ok(s.lastDelta.mood <= -8, '나빠질 땐 그대로 나빠진다');
});

test('분위기가 0이면 공작이 파탄난다', () => {
  const d = diffOf('보통');
  let s = initialState(d);
  for (let i = 0; i < 20 && !failureReason(s); i++) {
    s = applyTurn(s, d, J('backfire', { moodDelta: -9 }), { knownHidden: [] });
  }
  assert.equal(failureReason(s), 'mood');
});

// ── 미확인 취향 / 지뢰 ───────────────────────────────────
test('미확인 취향은 처음 한 번만 보너스를 준다', () => {
  const d = diffOf('보통');
  const first = applyTurn(initialState(d), d, J('critical', { hiddenPrefHit: HID[0] }), OPTS);
  const second = applyTurn(first, d, J('critical', { hiddenPrefHit: HID[0] }), OPTS);
  assert.deepEqual(first.hits, [HID[0]]);
  assert.deepEqual(second.hits, [HID[0]], '같은 취향을 두 번 세지 않는다');
  assert.ok(first.lastDelta.love > second.lastDelta.love);
  assert.equal(second.history.at(-1).tier, 'ok', '재탕은 ok로 강등된다');
});

test('목록에 없는 문자열을 심판이 지어내도 적중으로 인정하지 않는다', () => {
  const d = diffOf('보통');
  const s = applyTurn(initialState(d), d, J('critical', { hiddenPrefHit: '없는취향' }), OPTS);
  assert.deepEqual(s.hits, []);
  assert.equal(s.history.at(-1).tier, 'ok', '근거 없는 critical은 ok로 내려간다');
});

// ── hit/critical 게이트 ──────────────────────────────────
test('취향을 건드리지 않았으면 아무리 대화가 좋아도 ok가 상한이다', () => {
  assert.equal(gateTier('hit', { visibleHit: false, hiddenHit: false }), 'ok');
  assert.equal(gateTier('critical', { visibleHit: false, hiddenHit: false }), 'ok');
  assert.equal(gateTier('hit', { visibleHit: true, hiddenHit: false }), 'hit');
  assert.equal(gateTier('critical', { visibleHit: true, hiddenHit: false }), 'hit',
    'critical은 미확인 취향을 관통했을 때만 남는다');
  assert.equal(gateTier('critical', { visibleHit: false, hiddenHit: true }), 'critical');
  assert.equal(gateTier('ok', { visibleHit: false, hiddenHit: false }), 'ok');
  assert.equal(gateTier('empty', {}), 'empty');
  assert.equal(gateTier('없는tier', {}), 'empty');
});

test('지뢰를 밟으면 심판이 뭐라 하든 redline이다', () => {
  assert.equal(gateTier('critical', { hiddenHit: true, redHit: true }), 'redline');
  const d = diffOf('보통');
  const s = applyTurn({ ...initialState(d), love: 60 }, d,
    J('critical', { hiddenPrefHit: HID[0], redLineHit: true }), OPTS);
  assert.equal(s.history.at(-1).tier, 'redline');
  assert.ok(s.lastDelta.love < 0);
});

test('심판의 원래 등급도 함께 기록된다 (밸런싱 추적용)', () => {
  const d = diffOf('보통');
  const s = applyTurn(initialState(d), d,
    J('critical', { hiddenPrefHit: '', visiblePrefHit: '' }), OPTS);
  assert.equal(s.history.at(-1).judgeTier, 'critical');
  assert.equal(s.history.at(-1).tier, 'ok');
});

test('같은 알려진 취향을 재탕하면 hit 자격을 잃는다', () => {
  const d = diffOf('보통');
  let s = applyTurn(initialState(d), d, J('hit', { visiblePrefHit: VIS[0] }), OPTS);
  assert.equal(s.history.at(-1).tier, 'hit');
  s = applyTurn(s, d, J('hit', { visiblePrefHit: VIS[0] }), OPTS);
  assert.equal(s.history.at(-1).tier, 'ok', '이미 캔 광맥은 ok');
});

test('지뢰는 분위기와 호감을 동시에 깎는다', () => {
  const d = diffOf('보통');
  const base = { ...initialState(d), love: 50, mood: 70 };
  const red = applyTurn(base, d, J('redline', { redLineHit: true }), OPTS);
  assert.ok(red.lastDelta.love < -5 && red.lastDelta.mood < -10);
  assert.equal(red.redLines, 1);
});

test('지뢰 한 번이 잘한 두 턴을 지운다', () => {
  const d = diffOf('보통');
  let good = initialState(d);
  good = applyTurn(good, d, J('hit', { moodDelta: 4, visiblePrefHit: VIS[0] }), OPTS);
  good = applyTurn(good, d, J('hit', { moodDelta: 4, visiblePrefHit: VIS[1] }), OPTS);
  const after = applyTurn(good, d, J('redline', { redLineHit: true, moodDelta: -6 }), OPTS);
  assert.ok(after.love <= initialState(d).love + 1, '두 턴치 이득이 날아간다');
});

// ── 첫인상 ───────────────────────────────────────────────
test('대면 첫인상은 가중된다 — 착장은 준비가 아니라 만남에서 평가된다', () => {
  const d = diffOf('보통');
  const base = initialState(d);
  const normal = applyTurn(base, d, J('hit'), OPTS);
  const first = applyTurn(base, d, J('hit'), { ...OPTS, firstImpression: true });
  assert.ok(first.lastDelta.love > normal.lastDelta.love);
  assert.ok(first.history.at(-1).firstImpression);
});

// ── 판정 ─────────────────────────────────────────────────
test('성공선과 분위기 하한을 모두 넘어야 성사', () => {
  const d = diffOf('보통');
  const st = (love, mood) => ({ ...initialState(d), love, mood });
  assert.equal(verdict(st(d.threshold + 20, 80), d).accepted, true);
  assert.equal(verdict(st(d.threshold - 1, 80), d).accepted, false);
  const moodFail = verdict(st(d.threshold + 20, d.moodFloor - 1), d);
  assert.equal(moodFail.accepted, false, '분위기가 낮으면 호감이 높아도 실패');
  assert.equal(moodFail.reason, 'mood');
  assert.equal(verdict(st(99, 99), d, { aborted: true }).grade, 'F');
});

test('등급은 마진 순으로 단조롭다', () => {
  const d = diffOf('보통');
  const g = m => verdict({ ...initialState(d), love: d.threshold + m, mood: 90 }, d).grade;
  assert.equal(g(25), 'S'); assert.equal(g(14), 'A');
  assert.equal(g(6), 'B'); assert.equal(g(1), 'C');
  assert.equal(g(-5), 'D'); assert.equal(g(-15), 'E'); assert.equal(g(-40), 'F');
});

// ── 디브리핑 ─────────────────────────────────────────────
test('디브리핑은 채점이 아니라 사실 요약이다', () => {
  const d = diffOf('헬');
  let s = initialState(d);
  const pol = COUPLE_BY_ID['politics'];
  const polOpts = { knownHidden: pol.target.hiddenPrefs, knownVisible: pol.target.visiblePrefs };
  s = applyTurn(s, d, J('critical', { hiddenPrefHit: pol.target.hiddenPrefs[0] }), polOpts);
  s = applyTurn(s, d, J('redline', { redLineHit: true }), polOpts);
  const v = verdict(s, d);
  const db = debrief(s, d, v, COUPLE_BY_ID['politics']);
  const byKey = Object.fromEntries(db.notes.map(n => [n.key, n]));
  assert.equal(byKey.hidden.value, `1 / ${COUPLE_BY_ID['politics'].target.hiddenPrefs.length}건`);
  assert.equal(byKey.redline.ok, false);
  assert.equal(byKey.radio.ok, false, '무전을 안 쓰면 지적한다');
  assert.equal(db.missed.length, COUPLE_BY_ID['politics'].target.hiddenPrefs.length - 1);
  // 준비 점수 항목이 남아 있으면 안 된다
  for (const n of db.notes) {
    assert.ok(!/스타일링|코칭|연설/.test(n.label), `디브리핑에 준비 채점 항목이 남아 있다: ${n.label}`);
  }
});

test('히스토리는 증감과 누적을 둘 다 남긴다', () => {
  const d = diffOf('보통');
  const s = applyTurn(initialState(d), d, J('hit', { moodDelta: 5 }), OPTS);
  const h = s.history.at(-1);
  assert.equal(h.turn, 1);
  assert.equal(typeof h.dLove, 'number');
  assert.equal(typeof h.dMood, 'number');
  assert.equal(h.love, Math.round(s.love));
  assert.equal(h.mood, Math.round(s.mood));
  assert.equal(h.tier, 'hit');
});

// ── 프롬프트가 실제로 주입을 담고 있는지 ─────────────────
test('요원이 쓴 코칭/연설이 클라이언트 시스템 프롬프트에 그대로 들어간다', () => {
  const coaching = '절대로 마늘 얘기를 먼저 꺼내지 마라';
  const speech = '412년을 기다렸으면 오늘 하루는 아무것도 아니다';
  const sys = P.clientAgentSystem(COUPLE_BY_ID['vampire-garlic'], { coaching, speech, outfitDesc: '검정 망토' }, 'text');
  assert.ok(sys.includes(coaching));
  assert.ok(sys.includes(speech));
  assert.ok(sys.includes('검정 망토'));
});

test('준비를 비우면 클라이언트가 망가지도록 프롬프트가 바뀐다', () => {
  const c = COUPLE_BY_ID['vampire-garlic'];
  const empty = P.clientAgentSystem(c, { coaching: '', speech: '', outfitDesc: '' }, 'text');
  assert.ok(empty.includes('약점이 계속 튀어나온다'));
  assert.ok(empty.includes('겁에 질려 있다'));
  assert.ok(empty.includes('평소 입던 옷'));
});

test('심판만 타겟의 미확인 취향을 알고, 클라이언트는 모른다', () => {
  const c = COUPLE_BY_ID['os-war'];
  const hidden = c.target.hiddenPrefs[0];
  assert.ok(P.judgeSystem(c).includes(hidden), '심판은 알아야 판정한다');
  assert.ok(P.targetAgentSystem(c, 'text', '').includes(hidden), '타겟 본인은 당연히 안다');
  assert.ok(!P.clientAgentSystem(c, { coaching: '', speech: '' }, 'text').includes(hidden),
    '클라이언트가 미확인 취향을 알면 게임이 성립하지 않는다');
});

test('심판 스키마는 tier를 필수로 요구한다', () => {
  assert.ok(P.JUDGE_SCHEMA.required.includes('tier'));
  assert.ok(P.JUDGE_SCHEMA.required.includes('visiblePrefHit'), 'hit 게이트에 필요한 필드');
  assert.deepEqual(
    [...P.JUDGE_SCHEMA.properties.tier.enum].sort(),
    Object.keys(TIER_BANDS).sort(),
    '스키마 enum과 밴드 표가 어긋나면 판정이 클램프되지 않는다');
});

test('결승선 종류마다 호감의 의미가 다르게 주입된다', () => {
  const ally = COUPLE_BY_ID['orientation'];
  assert.equal(ally.endingKind, '동맹');
  const sys = P.judgeSystem(ally);
  assert.ok(sys.includes('연애가 물리적으로 불가능'));
  assert.ok(P.frameOf('동맹').meterName.includes('전우애'));
});
