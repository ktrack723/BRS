// node --test — 규칙 계층(scoring.js) 단위 테스트. LLM 불필요.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIFFICULTIES, TIER_BANDS, TUNING, BOUT, EXTENSION, FLUTTER_TIERS,
  bandLove, normalizeTier, diffOf, loveSaturation, initialState, applyBout,
  noteRadio, verdict, failureReason, cutShort, extraTurn, surfacedSecrets, debrief,
  LEVERAGE_POINTS,
} from '../js/scoring.js';
import { COUPLE_BY_ID } from '../js/couples.js';

const J = (tier, over = {}) => ({
  carry: 0, tier, loveDelta: TIER_BANDS[tier] ? TIER_BANDS[tier][1] : 0,
  reason: 'r', vibe: 'v', revealed: '', clientEmote: 'talk', targetEmote: 'talk',
  casualty: 'none', casualtyNote: '', leverage: 'none', walkout: false, keepGoing: true,
  ...over,
});
const D = diffOf('보통');

// ── 게이지는 호감 하나다 ─────────────────────────────────
test('수치 분위기가 존재하지 않는다', () => {
  const s = initialState(D);
  assert.ok(!('mood' in s), '상태에 mood 수치가 남아 있다');
  assert.ok(typeof s.vibe === 'string', '분위기는 텍스트로만 존재한다');
  for (const d of Object.values(DIFFICULTIES)) {
    assert.ok(!('startMood' in d) && !('moodFloor' in d) && !('moodDrift' in d),
      '난이도 규격에 분위기 수치 잔재가 있다');
  }
});

test('등급 밴드 — 두근거린 합만 호감을 올린다', () => {
  assert.deepEqual(TIER_BANDS.nudge, [0, 0]);
  assert.deepEqual(TIER_BANDS.flat, [0, 0]);
  assert.ok(TIER_BANDS.warm[0] > 0 && TIER_BANDS.breakthrough[0] > TIER_BANDS.warm[1] - 1);
  assert.ok(TIER_BANDS.chill[1] < 0 && TIER_BANDS.disaster[1] < TIER_BANDS.chill[0]);
  assert.deepEqual([...FLUTTER_TIERS].sort(), ['breakthrough', 'warm']);
});

test('bandLove가 등급 밴드로 클램프한다', () => {
  assert.equal(bandLove('warm', 99), TIER_BANDS.warm[1]);
  assert.equal(bandLove('warm', -5), TIER_BANDS.warm[0]);
  assert.equal(bandLove('flat', 7), 0);
  assert.equal(bandLove('nudge', 7), 0, 'nudge는 0점이다 — 반짝임은 끌림이 아니다');
  assert.equal(bandLove('disaster', 0), TIER_BANDS.disaster[1]);
});

test('모르는 등급은 flat으로 떨어진다', () => {
  assert.equal(normalizeTier('excellent'), 'flat');
  assert.equal(normalizeTier('warm'), 'warm');
});

test('잘 굴러간 대화(flat/nudge 합)는 호감을 한 점도 못 올린다', () => {
  let s = initialState(D);
  for (const t of ['flat', 'nudge', 'flat', 'nudge']) s = applyBout(s, D, J(t), { exchanges: 5 });
  assert.equal(Math.round(s.love), D.startLove, '회사원 대화는 0점이어야 한다');
  assert.equal(s.hotSeen, 0);
});

test('반복 감쇠 — 두 번째 무너짐은 첫 번째만큼 크지 않다', () => {
  let s = initialState(D);
  s = applyBout(s, D, J('breakthrough'), { exchanges: 5 });
  const first = s.lastDelta.love;
  s = applyBout(s, D, J('breakthrough'), { exchanges: 5 });
  const second = s.lastDelta.love;
  assert.ok(second < first * 0.75, `반복이 안 접힌다 (${first} → ${second})`);
  // 깎이는 쪽에는 감쇠가 없다 — 실수는 몇 번째든 실수다
  let t = { ...initialState(D), love: 50, hotSeen: 3 };
  const drop = applyBout(t, D, J('chill'), {}).lastDelta.love;
  const t2 = { ...initialState(D), love: 50, hotSeen: 0 };
  assert.equal(drop, applyBout(t2, D, J('chill'), {}).lastDelta.love, '감쇠가 손실에까지 번졌다');
});

test('두근거린 합만 호감을 민다', () => {
  let s = initialState(D);
  s = applyBout(s, D, J('warm'), { exchanges: 5 });
  assert.ok(s.love > D.startLove);
  assert.equal(s.hotSeen, 1);
  const before = s.love;
  s = applyBout(s, D, J('breakthrough'), { exchanges: 5 });
  assert.ok(s.love > before);
  assert.equal(s.hotSeen, 2);
});

test('chill·disaster는 깎고, 호감은 0에서 바닥을 친다', () => {
  let s = { ...initialState(D), love: 5 };
  s = applyBout(s, D, J('disaster'), { exchanges: 5 });
  s = applyBout(s, D, J('disaster'), { exchanges: 5 });
  assert.equal(s.love, 0, '0 밑으로 내려가면 안 된다');
});

test('호감도 포화한다 — 이미 높으면 같은 판정이 덜 오른다', () => {
  const lo = applyBout({ ...initialState(D), love: 5 }, D, J('warm'), {});
  const hi = applyBout({ ...initialState(D), love: 85 }, D, J('warm'), {});
  assert.ok(lo.lastDelta.love > hi.lastDelta.love * 1.5, '천장 근처에서는 덜 올라야 한다');
});

test('쌓인 호감이 손실 완충이 된다 — 그래도 절반은 문다', () => {
  const lo = applyBout({ ...initialState(D), love: 5 }, D, J('chill'), {});
  const hi = applyBout({ ...initialState(D), love: 85 }, D, J('chill'), {});
  assert.ok(Math.abs(hi.lastDelta.love) < Math.abs(lo.lastDelta.love), '완충이 없다');
  assert.ok(Math.abs(hi.lastDelta.love) > Math.abs(lo.lastDelta.love) * 0.4, '완충이 과하다');
});

test('첫인상 판정은 가중된다', () => {
  const plain = applyBout(initialState(D), D, J('warm'), {});
  const fi = applyBout(initialState(D), D, J('warm'), { firstImpression: true });
  assert.ok(fi.lastDelta.love > plain.lastDelta.love, '착장이 작용하는 유일한 지점이다');
});

// ── 합(bout) 회계 ────────────────────────────────────────
test('합 규격 — 서로 대여섯 마디, 경계는 심판이 자른다', () => {
  assert.ok(BOUT.size >= 4 && BOUT.size <= 6, '서로 대여섯 마디가 한 합이다');
  assert.ok(BOUT.carryMax >= 1 && BOUT.carryMax < BOUT.size);
});

test('합마다 교환 수가 기록되고 누적된다', () => {
  let s = initialState(D);
  s = applyBout(s, D, J('flat'), { exchanges: 5 });
  s = applyBout(s, D, J('warm'), { exchanges: 3 });
  assert.equal(s.exchanges, 8);
  assert.equal(s.bouts, 2);
  assert.deepEqual(s.history.map(h => h.exchanges), [5, 3]);
});

test('revealed는 중복 없이 쌓이고 vibe는 빈 값이면 유지된다', () => {
  let s = initialState(D);
  s = applyBout(s, D, J('flat', { revealed: '고양이를 무서워한다', vibe: '첫 공기' }), {});
  s = applyBout(s, D, J('flat', { revealed: '고양이를 무서워한다', vibe: '' }), {});
  assert.equal(s.revealed.length, 1);
  assert.equal(s.vibe, '첫 공기', '빈 vibe가 기존 공기를 지웠다');
});

// ── 자리의 끝 ────────────────────────────────────────────
test('walkout은 심판의 판단이고, 성사도 강압도 막는다', () => {
  let s = { ...initialState(D), love: 90, leverage: 9 };
  s = applyBout(s, D, J('disaster', { walkout: true }), { exchanges: 2 });
  assert.equal(failureReason(s), 'walkout');
  const v = verdict(s, D);
  assert.equal(v.accepted, false);
  assert.equal(v.reason, 'walkout', '상대가 떠났는데 성사가 되면 안 된다');
});

test('사망은 즉시 F고 뒤집히지 않는다', () => {
  let s = { ...initialState(D), love: 99 };
  s = applyBout(s, D, J('disaster', { casualty: 'target', casualtyNote: '분화구' }), {});
  s = applyBout(s, D, J('warm', { casualty: 'none' }), {});
  assert.equal(s.casualty, 'target');
  assert.equal(failureReason(s), 'death');
  const v = verdict(s, D);
  assert.equal(v.grade, 'F');
  assert.equal(v.reason, 'death');
});

test('강압은 쌓이고, 문턱을 넘으면 호감이 모자라도 묶인다', () => {
  assert.equal(LEVERAGE_POINTS.hard, 2);
  let s = initialState(D);
  s = applyBout(s, D, J('chill', { leverage: 'hard' }), { exchanges: 5 });
  assert.equal(verdict(s, D).accepted, false, '협박 한 합으로 묶이면 무전 한 방짜리 게임이다');
  s = applyBout(s, D, J('flat', { leverage: 'hard' }), { exchanges: 5 });
  // hard 두 합(=4)으로는 아직 못 묶는다 — 실측(r3)에서 방치판이 hard 두 합을
  // 공짜로 받아 강압 성사한 뒤 문턱을 6으로 올렸다. 강압은 캠페인이어야 한다.
  assert.equal(verdict(s, D).accepted, false, 'hard 두 합으로 묶이면 방치판이 굴러들어와 성사된다');
  s = applyBout(s, D, J('flat', { leverage: 'hard' }), { exchanges: 5 });
  assert.ok(s.leverage >= TUNING.coerceMin);
  const v = verdict(s, D);
  assert.equal(v.accepted, true);
  assert.equal(v.reason, 'coerced');
  assert.equal(v.grade, 'C', '강압 성사는 등급이 고정이다');
});

test('무전은 채점되지 않고 횟수만 센다', () => {
  const before = initialState(D);
  const after = noteRadio(before);
  assert.equal(after.love, before.love);
  assert.equal(after.radioUsed, 1);
});

// ── 자리 연장/조기 종료 — 심판의 keepGoing만 본다 ─────────
test('심판이 더 갈 데 없다고 하면 자리를 접는다', () => {
  assert.equal(cutShort([true, false]), true);
  assert.equal(cutShort([false, true]), false, '마지막 답만 본다');
  assert.equal(cutShort([null, null]), false, '명시적 답이 없으면 아무것도 안 한다');
  assert.equal(cutShort([]), false);
});

test('심판이 아직 열려 있다고 하면 자리가 한 번 길어진다', () => {
  assert.ok(extraTurn('text', [true], false) > 0);
  assert.equal(extraTurn('text', [true], true), 0, '연장은 1회 한정이다');
  assert.equal(extraTurn('text', [false], false), 0);
  assert.equal(extraTurn('text', [null], false), 0);
  assert.ok(extraTurn('talk', [true], false) >= extraTurn('text', [true], false),
    '대면이 문자보다 길게 늘어난다');
});

// ── 난이도와 도달 가능성 ────────────────────────────────
test('난이도 사다리 — 성공선은 오르고 시작 호감은 내린다', () => {
  const ds = ['쉬움', '보통', '헬'].map(diffOf);
  for (let i = 1; i < ds.length; i++) {
    assert.ok(ds[i].threshold > ds[i - 1].threshold);
    assert.ok(ds[i].startLove < ds[i - 1].startLove);
  }
});

test('세 난이도 모두, 좋은 합 흐름은 넘고 밋밋한 흐름은 못 넘는다', () => {
  // 판은 대략 3~4합이다 (14교환 / 합 5).
  const run = (name, tiers) => {
    const d = diffOf(name);
    let s = initialState(d);
    for (const t of tiers) s = applyBout(s, d, J(t), { exchanges: 4 });
    return verdict(s, d);
  };
  // 반복 감쇠 아래에서 '좋은 흐름'은 무너짐이 두 번 있는 저녁이다.
  const STRONG = ['breakthrough', 'warm', 'breakthrough', 'warm'];
  const WEAK = ['flat', 'nudge', 'flat', 'chill'];
  for (const name of ['쉬움', '보통']) {
    assert.ok(run(name, STRONG).accepted, `${name}: 좋은 흐름이 못 넘으면 도달 불가능한 게임이다`);
  }
  for (const name of ['쉬움', '보통', '헬']) {
    assert.ok(!run(name, WEAK).accepted, `${name}: 밋밋한 흐름이 성사되면 안 된다`);
  }
  // 헬은 **착장 승부다** — 좋은 저녁만으로는 못 넘고(실측 r3에서 방치판이 br 셋을 받고도
  // 66에 그친 그 구간), 첫인상 breakthrough(가중 1.2)가 얹혀야 넘는다.
  // 첫인상은 착장 없는 판이 만들 수 없는 유일한 점수원이다.
  assert.ok(!run('헬', STRONG).accepted, '헬: 대화만 좋은 저녁으로 넘으면 방치판도 넘는다');
  const fiRun = (name) => {
    const d = diffOf(name);
    let s = applyBout(initialState(d), d, J('breakthrough'), { exchanges: 0, firstImpression: true });
    for (const t of STRONG) s = applyBout(s, d, J(t), { exchanges: 4 });
    return verdict(s, d);
  };
  assert.ok(fiRun('헬').accepted, '헬: 착장이 꽂히고 좋은 저녁이면 넘는다');
  // 무너짐 하나 + 두근 하나면 쉬움은 넘고 헬은 못 넘는다 — 난이도가 실제로 갈라야 한다
  const MID = ['breakthrough', 'warm', 'flat', 'flat'];
  assert.ok(run('쉬움', MID).accepted, '쉬움: 무너짐+두근이면 넘는다');
  assert.ok(!run('헬', MID).accepted, '헬: 그걸로는 부족하다');
});

test('성적 등급이 여유 폭으로 갈린다', () => {
  const v = m => verdict({ ...initialState(D), love: D.threshold + m }, D);
  assert.equal(v(25).grade, 'S');
  assert.equal(v(14).grade, 'A');
  assert.equal(v(7).grade, 'B');
  assert.equal(v(0).grade, 'C');
  assert.equal(verdict({ ...initialState(D), love: D.threshold - 5 }, D).grade, 'D');
  assert.equal(verdict({ ...initialState(D), love: D.threshold - 20 }, D).grade, 'E');
  assert.equal(verdict({ ...initialState(D), love: 0 }, D).grade, 'F');
});

// ── 표시 계층 ────────────────────────────────────────────
test('감춰둔 성향 표시는 대화록 대조일 뿐 점수와 무관하다', () => {
  const c = COUPLE_BY_ID['vampire-garlic'];
  const hidden = c.target.prefs.filter(p => !p.open).map(p => p.t);
  assert.ok(hidden.length >= 1, '테스트 전제: 미공개 성향이 있다');
  const probe = hidden[0];
  const hit = surfacedSecrets(c, `김마늘: ${probe}`, []);
  assert.ok(hit.surfaced.includes(probe));
  const miss = surfacedSecrets(c, '아무 상관 없는 짧은 대화', []);
  assert.equal(miss.surfaced.length, 0);
});

test('디브리핑이 합 단위로 요약한다', () => {
  const c = COUPLE_BY_ID['os-war'];
  let s = initialState(D);
  s = applyBout(s, D, J('warm', { revealed: '뭔가 드러남' }), { exchanges: 5 });
  s = applyBout(s, D, J('chill'), { exchanges: 5 });
  const v = verdict(s, D);
  const db = debrief(s, D, v, c, '대화록');
  const keys = db.notes.map(n => n.key);
  for (const k of ['revealed', 'flutter', 'secrets', 'cold', 'radio', 'flow']) {
    assert.ok(keys.includes(k), `디브리핑에 ${k}가 없다`);
  }
  assert.ok(!keys.includes('barrier'), '장벽 축은 relation으로 접혔다 — 디브리핑에 남으면 안 된다');
  assert.ok(db.summary.includes('호감'));
});

// ── 규칙 계층의 금지 사항 ────────────────────────────────
test('규칙 계층에는 준비물 점수라는 개념 자체가 없다', async () => {
  const src = await (await import('node:fs/promises')).readFile('js/scoring.js', 'utf8');
  assert.ok(!/coaching|speech|styling|outfit/i.test(src), '플레이어 입력이 규칙 계층에 스며들었다');
  assert.ok(!/prepScore|prep_score/.test(src));
});

test('규칙 계층에 분위기 수치·정체·무전 창 잔재가 없다', async () => {
  const src = await (await import('node:fs/promises')).readFile('js/scoring.js', 'utf8');
  assert.ok(!/moodMultiplier|moodFloor|stallMood|RADIO_WINDOW|sinceRadio|dullRun/.test(src));
});
