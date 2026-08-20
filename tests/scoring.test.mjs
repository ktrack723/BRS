// node --test tests/  — 규칙 계층 회귀 테스트 (LLM 불필요)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIFFICULTIES, TIER_BANDS, TUNING, diffOf, bandLove, normalizeTier, moodMultiplier,
  initialState, applyTurn, noteRadio, failureReason, verdict, debrief, surfacedSecrets,
} from '../js/scoring.js';
import { COUPLES, COUPLE_BY_ID } from '../js/couples.js';
import { sanitizeSpec, DEFAULT_SPEC } from '../js/avatar.js';
import * as P from '../js/prompts.js';

const anyCouple = COUPLE_BY_ID['os-war'];

// 심판 판정 하나. 이제 취향 적중 필드가 없다 — 등급과 증감, 그리고 서술뿐이다.
const J = (tier, extra = {}) => ({
  tier, moodDelta: 0, loveDelta: TIER_BANDS[tier] ? TIER_BANDS[tier][1] : 0,
  reason: '', vibe: '', revealed: '', ...extra,
});
const AGENT = { name: '박큐피드', gender: '기밀' };

// ── 커플 데이터 ──────────────────────────────────────────
test('의뢰 대장의 id가 중복되지 않고 난이도가 고루 있다', () => {
  assert.ok(COUPLES.length >= 20, `의뢰가 ${COUPLES.length}건뿐이다`);
  assert.equal(new Set(COUPLES.map(c => c.id)).size, COUPLES.length, 'id가 중복된다');
  // 필터 탭이 빈 채로 남으면 안 된다
  for (const d of Object.keys(DIFFICULTIES)) {
    assert.ok(COUPLES.some(c => c.difficulty === d), `난이도 ${d}에 의뢰가 하나도 없다`);
  }
});

test('모든 커플이 필수 필드를 갖추고 있다', () => {
  for (const c of COUPLES) {
    assert.ok(DIFFICULTIES[c.difficulty], `${c.id}: 알 수 없는 난이도 ${c.difficulty}`);
    assert.equal(c.endingKind, '연애', `${c.id}: 결승선은 연애로 통일되어 있다`);
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
    assert.ok(c.target.hiddenPrefs.length >= 3, `${c.id}: 감춰둔 이야기 부족`);
    assert.ok(c.target.redLines.length >= 3, `${c.id}: 질색 목록 부족`);
  }
});

// 대화 규칙을 걷어낸 뒤로 에이전트가 기댈 것은 자기 자신에 대한 정보뿐이다.
// 내력이 얄팍하면 대화도 얄팍해진다 — 그래서 이건 필수 필드다.
test('40명 전원에게 살아온 내력이 있다', () => {
  for (const c of COUPLES) {
    for (const who of ['client', 'target']) {
      const b = c[who].background;
      assert.ok(Array.isArray(b) && b.length >= 4, `${c.id}.${who}: 내력이 ${b?.length ?? 0}줄뿐이다`);
      assert.ok(b.every(x => typeof x === 'string' && x.length > 6), `${c.id}.${who}: 내력이 너무 짧다`);
    }
  }
});

// ── 인물의 하자 ─────────────────────────────────────────
// 라이브에서 두 에이전트가 너무 말을 잘했다. 준비를 개판으로 해도 상대가 듣고 싶어할 말을 정확히 골랐다.
// 원인은 준 정보가 '자기 사연 + 상대가 좋아하는 것' 둘뿐이라, 상대 맞추기가 유일한 목적이 됐기 때문이다.
test('40명 전원에게 자기 욕구와 하자가 있다', () => {
  const READS = ['none', 'some', 'well'], ATT = ['self', 'mixed', 'other'], COMP = ['obeys', 'argues', 'drifts'];
  for (const c of COUPLES) {
    for (const who of ['client', 'target']) {
      const f = c[who].flaw;
      assert.ok(f, `${c.id}.${who}: 하자 블록이 없다`);
      assert.ok(f.want && f.want.length > 8, `${c.id}.${who}: want이 없거나 너무 짧다`);
      // 예전의 flaw.fixation은 weakness와 스무 건 넘게 같은 말이어서 한 필드로 합쳤다.
      assert.equal(f.fixation, undefined, `${c.id}.${who}: fixation이 아직 남아 있다`);
      assert.ok(c[who].weakness && c[who].weakness.length > 5, `${c.id}.${who}: 버릇이 없다`);
      assert.ok(ATT.includes(f.attention), `${c.id}.${who}: attention=${f.attention}`);
      // reads/compliance는 의뢰인 전용이다. 상대 쪽에 있으면 아무 데도 안 쓰이는 값이다.
      if (who === 'client') {
        assert.ok(READS.includes(f.reads), `${c.id}.client: reads=${f.reads}`);
        assert.ok(COMP.includes(f.compliance), `${c.id}.client: compliance=${f.compliance}`);
      } else {
        assert.equal(f.reads, undefined, `${c.id}.target: 안 쓰이는 reads가 적혀 있다`);
        assert.equal(f.compliance, undefined, `${c.id}.target: 안 쓰이는 compliance가 적혀 있다`);
      }
    }
  }
});

test('공기를 못 읽는 인물과 관심 없는 인물이 실제로 존재한다', () => {
  const all = COUPLES.flatMap(c => [c.client.flaw, c.target.flaw]);
  const clients = COUPLES.map(c => c.client.flaw);   // reads는 의뢰인에게만 있다
  const blind = clients.filter(f => f.reads === 'none').length;
  const selfish = all.filter(f => f.attention === 'self').length;
  // 전원이 눈치 빠르고 전원이 상대에게 관심이 많으면 그건 사람이 아니라 상담사 62명이다
  assert.ok(blind >= 8, `공기를 아예 못 읽는 의뢰인이 ${blind}명뿐이다`);
  assert.ok(selfish >= 8, `상대에게 관심 없는 인물이 ${selfish}명뿐이다`);
  assert.ok(clients.filter(f => f.reads === 'well').length >= 3, '반대로 눈치 빠른 인물도 있어야 한다');
});

test('난이도 세 종류가 모두 실제로 쓰인다', () => {
  const used = new Set(COUPLES.map(c => c.difficulty));
  assert.deepEqual([...used].sort(), ['보통', '쉬움', '헬'].sort());
});

// ── 준비 단계는 규칙 계층에 존재하지 않는다 ──────────────
test('규칙 계층에는 착장/지침/연설 점수라는 개념 자체가 없다', () => {
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
  // flat은 이제 정확히 0이다 — "대화는 있었고 마음은 안 움직였다"에 점수를 주면
  // 잡담 19턴이 성공선을 넘긴다. 회사 동료끼리 얘기한다고 사랑에 빠지지 않는다.
  assert.equal(bandLove('flat', 9), 0, 'flat인데 +9를 주면 0으로 깎인다');
  assert.equal(bandLove('flat', -9), 0, 'flat은 마이너스도 0이다 — 그냥 아무 일도 없었다는 뜻이다');
  assert.equal(bandLove('breakthrough', 2), 7, 'breakthrough인데 +2면 밴드 하한으로 올린다');
  assert.equal(bandLove('disaster', 5), -6);
  assert.equal(bandLove('chill', 0), -2);
  assert.equal(bandLove('nudge', 100), 0, 'nudge는 0점이다 — 반짝임은 끌림이 아니다');
  assert.equal(bandLove('없는tier', 5), 5, '모르는 tier면 원값을 -10~10으로만 자른다');
});

test('모르는 등급은 중립으로 떨어진다 — 이것이 유일하게 남은 등급 보정이다', () => {
  assert.equal(normalizeTier('breakthrough'), 'breakthrough');
  assert.equal(normalizeTier('critical'), 'flat', '구 등급명은 더 이상 통하지 않는다');
  assert.equal(normalizeTier(undefined), 'flat');
});

// nudge와 flat은 이제 둘 다 0점이다 — 두근두근이 아니면 증가량이 없다.
// 사다리는 warm 위에서만 의미가 있다.
test('tier가 높을수록 호감이 더 오른다 (동일 조건)', () => {
  const d = diffOf('보통');
  const base = initialState(d);
  const order = ['disaster', 'chill', 'flat', 'warm', 'breakthrough'];
  const gains = order.map(t => applyTurn(base, d, J(t)).lastDelta.love);
  for (let i = 1; i < gains.length; i++) {
    assert.ok(gains[i] > gains[i - 1], `${order[i]}(${gains[i]})가 ${order[i - 1]}(${gains[i - 1]})보다 커야 한다`);
  }
  // nudge와 flat은 같은 자리다 — 둘 다 0점이고, 차이는 해설과 분위기에만 남는다
  const nudge = applyTurn(base, d, J('nudge')).lastDelta.love;
  const flat = applyTurn(base, d, J('flat')).lastDelta.love;
  assert.equal(nudge, flat, 'nudge가 flat보다 호감을 더 준다 — 반짝임은 끌림이 아니다');
});

test('flat 판정만 반복하면 성공선에 절대 못 닿는다', () => {
  for (const name of ['쉬움', '보통', '헬']) {
    const d = diffOf(name);
    let s = initialState(d);
    for (let i = 0; i < d.textTurns + d.talkTurns; i++) {
      if (failureReason(s)) break;
      s = applyTurn(s, d, J('flat', { moodDelta: 0 }));
    }
    assert.ok(!verdict(s, d).accepted, `${name}: 알맹이 없는 대화로 성사되면 안 된다`);
  }
});

// ── 취향 목록 대조 계층이 사라졌다 ───────────────────────
// 이 테스트가 이번 개편의 핵심이다. 예전에는 심판이 뱉은 취향 문자열을 커플 데이터와 대조해
// 보너스를 주거나 등급을 눌렀다. 이제는 그 필드를 봐도 아무 일도 일어나지 않는다.
test('심판이 취향 목록을 맞췄다고 해서 추가 점수가 붙지 않는다', () => {
  const d = diffOf('보통');
  const base = initialState(d);
  const plain = applyTurn(base, d, J('warm'));
  const withPrefFields = applyTurn(base, d, J('warm', {
    hiddenPrefHit: anyCouple.target.hiddenPrefs[0],
    visiblePrefHit: anyCouple.target.visiblePrefs[0],
  }));
  assert.equal(withPrefFields.lastDelta.love, plain.lastDelta.love, '적중 필드가 점수를 바꾸면 안 된다');
  assert.equal(withPrefFields.lastDelta.mood, plain.lastDelta.mood);
  assert.equal(withPrefFields.revealed.length, 0, '옛 필드는 아예 읽지 않는다');
});

test('목록에 없는 이유로 상대가 무너져도 똑같이 유효하다', () => {
  const d = diffOf('보통');
  const s = applyTurn(initialState(d), d, J('breakthrough', { revealed: '아버지 얘기만 나오면 말이 없어진다' }));
  assert.equal(s.lastDelta.tier, 'breakthrough', '목록 대조로 강등되지 않는다');
  assert.deepEqual(s.revealed, ['아버지 얘기만 나오면 말이 없어진다']);
});

test('등급이 취향 목록 때문에 눌리는 게이트가 없다', () => {
  const d = diffOf('보통');
  const s = applyTurn(initialState(d), d, J('breakthrough'));
  assert.equal(s.history.at(-1).tier, 'breakthrough');
  assert.equal(s.history.at(-1).judgeTier, 'breakthrough', '심판 원등급도 그대로 남는다');
});

// ── 새로 드러난 것 / 공기 ────────────────────────────────
test('드러난 것은 중복 없이 쌓이고 점수와 무관하다', () => {
  const d = diffOf('보통');
  const base = initialState(d);
  // 같은 출발 상태에서 발견이 있는 턴과 없는 턴을 비교한다.
  // (연속 두 턴으로 비교하면 호감 포화분이 섞여 들어와 엉뚱한 걸 재게 된다)
  const withFind = applyTurn(base, d, J('nudge', { revealed: '밤에 별을 본다' }));
  const without = applyTurn(base, d, J('nudge'));
  assert.equal(withFind.lastDelta.love, without.lastDelta.love, '드러났다고 해서 보너스가 붙지 않는다');
  assert.equal(withFind.lastDelta.mood, without.lastDelta.mood);
  assert.deepEqual(withFind.revealed, ['밤에 별을 본다']);

  const again = applyTurn(withFind, d, J('nudge', { revealed: '밤에 별을 본다' }));
  assert.deepEqual(again.revealed, ['밤에 별을 본다'], '같은 서술을 두 번 세지 않는다');
  assert.equal(again.lastDelta.revealed, '', '중복은 이번 턴의 발견으로 치지 않는다');
});

test('호감도 포화한다 — 이미 높으면 같은 판정이 덜 오른다', () => {
  const d = diffOf('보통');
  const lo = applyTurn({ ...initialState(d), love: 5, mood: 60 }, d, J('warm'));
  const hi = applyTurn({ ...initialState(d), love: 85, mood: 60 }, d, J('warm'));
  assert.ok(lo.lastDelta.love > hi.lastDelta.love * 1.5, '천장 근처에서는 같은 warm이 훨씬 덜 오른다');
  // 하락에는 반대로 **완충**이 붙는다. 이미 좋아하게 된 사람은 한 번 삐끗한다고 처음으로 안 간다.
  // 이득에만 포화를 걸어두면 판이 길어질수록 (이득 ↓ / 손실 그대로)로 기울어서,
  // 밀어붙이는 쪽이 후반에 구조적으로 손해를 본다. 실측 원판정 합이 그랬다 —
  // ace +294/−154 · none +246/−94로 재료는 ace가 많은데 순합은 none이 앞섰다.
  const loDown = applyTurn({ ...initialState(d), love: 5, mood: 60 }, d, J('chill'));
  const hiDown = applyTurn({ ...initialState(d), love: 85, mood: 60 }, d, J('chill'));
  assert.ok(Math.abs(hiDown.lastDelta.love) < Math.abs(loDown.lastDelta.love),
    `쌓인 호감이 완충 노릇을 못 한다 (${loDown.lastDelta.love} vs ${hiDown.lastDelta.love})`);
  // 다만 완충이 손실을 지워버리면 안 된다. 천장 근처에서도 절반은 문다.
  assert.ok(Math.abs(hiDown.lastDelta.love) > Math.abs(loDown.lastDelta.love) * 0.4,
    `완충이 과해서 후반에는 실수가 공짜다 (${loDown.lastDelta.love} vs ${hiDown.lastDelta.love})`);
});

// ── 정체 감쇠 ────────────────────────────────────────────────────
// 실측(하이쿠 12판): 아무 일도 안 일어난 턴의 연속이 none 36턴 대 ace 14턴으로 갈렸다.
// 준비 안 한 판은 대화가 굴러는 가는데 아무 데도 안 닿는 구간이 길다. 거기에 값을 매긴다.
test('아무 일도 없는 턴이 연달아 쌓이면 공기가 식는다', () => {
  const d = diffOf('보통');
  let s = { ...initialState(d), mood: 70 };
  const drops = [];
  for (let i = 0; i < 6; i++) {
    const before = s.mood;
    s = applyTurn(s, d, J('flat', { moodDelta: 0 }));
    drops.push(before - s.mood);
  }
  assert.ok(drops[1] > drops[0], '두 번째 무의미한 턴이 첫 번째보다 더 아파야 한다');
  assert.ok(drops[3] > drops[2], '연속이 길어질수록 더 문다');
  // 다만 무한정 나빠지지는 않는다. 상한이 없으면 무의미한 턴만으로 반드시 자리가 깨진다.
  assert.ok(Math.abs(drops[5] - drops[4]) < 0.01, '상한 뒤로는 더 나빠지지 않는다');
});

test('정체만으로는 자리가 깨지지 않는다 — 파탄은 정색의 몫이다', () => {
  // 판 길이보다 훨씬 긴 무의미한 흐름을 넣어도 자리가 남아 있어야 한다.
  // (난이도 흐름 moodDrift는 별개의 규칙이라 헬처럼 흐름이 센 쪽은 그것만으로도 식는다.
  //  여기서 보는 건 정체분이 혼자 바닥을 뚫느냐다.)
  const d = diffOf('보통');
  let s = { ...initialState(d), mood: 46 };
  for (let i = 0; i < 20; i++) s = applyTurn(s, d, J('flat', { moodDelta: 0 }));
  assert.ok(s.mood > 0, `무의미한 턴만으로 자리가 깨졌다 (분위기 ${s.mood})`);
  assert.ok(!failureReason(s), '심심해서 파탄나면 그건 판정이 아니라 타이머다');
  // 반대로 정색은 자리를 깬다. 지루함과 적의를 같은 것으로 두면 안 된다.
  let hostile = { ...initialState(d), mood: 46 };
  for (let i = 0; i < 8; i++) hostile = applyTurn(hostile, d, J('disaster', { moodDelta: -9 }));
  assert.equal(failureReason(hostile), 'mood', '정색이 이어지는데도 자리가 유지된다');
});

test('두근거림 한 번이면 정체 계수가 처음으로 돌아간다', () => {
  const d = diffOf('보통');
  let s = { ...initialState(d), mood: 70 };
  for (let i = 0; i < 4; i++) s = applyTurn(s, d, J('flat', { moodDelta: 0 }));
  const deep = s.mood - applyTurn(s, d, J('flat', { moodDelta: 0 })).mood;
  s = applyTurn(s, d, J('warm', { moodDelta: 0 }));   // 한 번 닿았다
  const after = s.mood - applyTurn(s, d, J('flat', { moodDelta: 0 })).mood;
  assert.ok(after < deep, '한 번 닿고 나면 정체가 처음부터 다시 세어져야 한다');
});

test('nudge는 죽은 턴이 아니라 정체에 세지 않는다', () => {
  const d = diffOf('보통');
  const run = tier => {
    let s = { ...initialState(d), mood: 70 };
    for (let i = 0; i < 5; i++) s = applyTurn(s, d, J(tier, { moodDelta: 0 }));
    return s.mood;
  };
  assert.ok(run('nudge') > run('flat'),
    'nudge는 점수가 0이어도 사람 쪽으로 반짝은 한 것이다. 죽은 턴과 같이 취급하면 안 된다');
});

test('공기는 심판이 갱신하고, 안 주면 직전 값이 유지된다', () => {
  const d = diffOf('보통');
  let s = { ...initialState(d), vibe: '아직 아무 일도 없다' };
  s = applyTurn(s, d, J('nudge', { vibe: '상대가 처음으로 웃었다' }));
  assert.equal(s.vibe, '상대가 처음으로 웃었다');
  s = applyTurn(s, d, J('flat', { vibe: '' }));
  assert.equal(s.vibe, '상대가 처음으로 웃었다', '빈 값이 오면 덮어쓰지 않는다');
  assert.equal(s.history.at(-1).vibe, '상대가 처음으로 웃었다', '원장에도 그 시점 공기가 남는다');
});

// ── 분위기 ───────────────────────────────────────────────
// 분위기는 호감을 **막을 수만 있고 만들어낼 수는 없다.**
// 예전엔 0.30~1.60배였고, 그건 "분위기가 좋았다"를 "사랑에 빠졌다"로 환산하는 장치였다.
// 즐거운 잡담이 점수를 만들어내면 안 된다 — 회사 동료끼리도 즐겁게 얘기한다.
test('분위기는 호감을 억누르기만 하고 증폭하지는 않는다', () => {
  assert.ok(moodMultiplier(0) < moodMultiplier(50));
  assert.ok(moodMultiplier(50) < moodMultiplier(80));
  assert.equal(moodMultiplier(0), TUNING.moodMultFloor);
  assert.equal(moodMultiplier(100), TUNING.moodMultCap, '분위기가 최고여도 배율이 1을 넘지 않는다');
  assert.equal(moodMultiplier(80), TUNING.moodMultCap, '분위기 80이면 이미 상한이다');
  assert.ok(moodMultiplier(100) <= 1, '분위기로 호감이 증폭되면 안 된다');
});

test('같은 판정이라도 분위기가 낮으면 호감이 덜 오른다', () => {
  const d = diffOf('보통');
  const hi = applyTurn({ ...initialState(d), mood: 95 }, d, J('warm'));
  const lo = applyTurn({ ...initialState(d), mood: 5 }, d, J('warm'));
  // 폭은 좁혔지만 방향은 유지된다 — 험악한 방에서는 같은 판정이 덜 남는다
  assert.ok(hi.lastDelta.love > lo.lastDelta.love,
    `분위기가 높은 쪽이 더 남아야 한다 (hi ${hi.lastDelta.love} / lo ${lo.lastDelta.love})`);
  assert.ok(hi.lastDelta.love < lo.lastDelta.love * 2,
    '분위기 하나로 두 배 이상 갈리면 그건 호감이 아니라 분위기를 재는 것이다');
});

test('분위기는 높을수록 올리기 어렵다 (포화)', () => {
  const d = diffOf('보통');
  const low = applyTurn({ ...initialState(d), mood: 20 }, d, J('nudge', { moodDelta: 8 }));
  const high = applyTurn({ ...initialState(d), mood: 90 }, d, J('nudge', { moodDelta: 8 }));
  assert.ok(low.lastDelta.mood > high.lastDelta.mood, '같은 +8이라도 이미 좋은 분위기는 덜 오른다');
});

test('분위기 하락에는 포화가 걸리지 않는다', () => {
  const d = diffOf('보통');
  const s = applyTurn({ ...initialState(d), mood: 95 }, d, J('chill', { moodDelta: -8 }));
  assert.ok(s.lastDelta.mood <= -8, '나빠질 땐 그대로 나빠진다');
});

test('분위기가 0이면 공작이 파탄난다', () => {
  const d = diffOf('보통');
  let s = initialState(d);
  for (let i = 0; i < 20 && !failureReason(s); i++) {
    s = applyTurn(s, d, J('chill', { moodDelta: -9 }));
  }
  assert.equal(failureReason(s), 'mood');
});

test('상대가 정색하면 자리가 추가로 식는다', () => {
  const d = diffOf('보통');
  const base = { ...initialState(d), love: 50, mood: 70 };
  const dis = applyTurn(base, d, J('disaster', { moodDelta: -6 }));
  const chill = applyTurn(base, d, J('chill', { moodDelta: -6 }));
  assert.ok(dis.lastDelta.mood < chill.lastDelta.mood, 'disaster는 같은 moodDelta라도 더 깎인다');
  assert.ok(dis.lastDelta.love < -5);
});

// ── 첫인상 ───────────────────────────────────────────────
test('대면 첫인상은 가중된다 — 착장은 준비가 아니라 만남에서 평가된다', () => {
  const d = diffOf('보통');
  const base = initialState(d);
  const normal = applyTurn(base, d, J('warm'));
  const first = applyTurn(base, d, J('warm'), { firstImpression: true });
  assert.ok(first.lastDelta.love > normal.lastDelta.love);
  assert.ok(first.history.at(-1).firstImpression);
});

// ── 판정 ─────────────────────────────────────────────────
test('성공선과 분위기 하한과 현실 장벽을 모두 넘어야 성사', () => {
  const d = diffOf('보통');
  // 장벽을 다뤘다고 놓고 나머지를 본다. 장벽 자체는 아래 4갈래 테스트에서 따로 본다.
  const st = (love, mood) => ({ ...initialState(d), love, mood, barrierCleared: true });
  assert.equal(verdict(st(d.threshold + 20, 80), d).accepted, true);
  assert.equal(verdict(st(d.threshold - 1, 80), d).accepted, false);
  const moodFail = verdict(st(d.threshold + 20, d.moodFloor - 1), d);
  assert.equal(moodFail.accepted, false, '분위기가 낮으면 호감이 높아도 실패');
  assert.equal(moodFail.reason, 'mood');
  assert.equal(verdict(st(99, 99), d, { aborted: true }).grade, 'F');
});

test('등급은 마진 순으로 단조롭다', () => {
  const d = diffOf('보통');
  const g = m => verdict({ ...initialState(d), love: d.threshold + m, mood: 90, barrierCleared: true }, d).grade;
  assert.equal(g(25), 'S'); assert.equal(g(14), 'A');
  assert.equal(g(6), 'B'); assert.equal(g(1), 'C');
  assert.equal(g(-5), 'D'); assert.equal(g(-15), 'E'); assert.equal(g(-40), 'F');
});

// ── 밸런싱: 잘한 플레이와 대충한 플레이가 실제로 갈리는가 ─
// 성공선은 오프라인 몬테카를로로 뽑았다(scoring.js 주석 참조). 그 분리가 유지되는지 여기서 지킨다.
test('세 난이도 모두, 좋은 판정 흐름은 넘고 밋밋한 흐름은 못 넘는다', () => {
  // 판 길이는 난이도 규격에서 가져온다. 10턴으로 박아두면 판이 길어졌을 때
  // "좋은 흐름도 성공선을 못 넘는다"가 규칙이 아니라 테스트 전제 탓으로 나온다.
  const cycle = (pat, n) => Array.from({ length: n }, (_, i) => pat[i % pat.length]);
  const STRONG = ['warm', 'nudge', 'breakthrough', 'warm', 'nudge'];
  const WEAK = ['flat', 'flat', 'nudge', 'flat', 'chill'];
  const MOOD = { breakthrough: 6, warm: 4, nudge: 2, flat: 0, chill: -4, disaster: -7 };
  const run = (name, pattern) => {
    const d = diffOf(name);
    const tiers = cycle(pattern, d.textTurns + d.talkTurns);
    let s = initialState(d);
    tiers.forEach((t, i) => {
      if (failureReason(s)) return;
      // 장벽은 이 테스트의 관심사가 아니다 — 첫 턴에 다뤘다고 놓고 호감 흐름만 본다
      s = applyTurn(s, d, J(t, { moodDelta: MOOD[t], barrierAddressed: i === 0 }),
        { firstImpression: i === d.textTurns });
    });
    return verdict(s, d);
  };
  for (const name of ['쉬움', '보통', '헬']) {
    assert.ok(run(name, STRONG).accepted, `${name}: 좋은 흐름이 성공선을 못 넘으면 도달 불가능한 게임이다`);
    assert.ok(!run(name, WEAK).accepted, `${name}: 밋밋한 흐름이 성사되면 안 된다`);
  }
});

// ── 비밀 표시 (점수와 무관) ──────────────────────────────
test('감춰둔 이야기 표시는 대화록 대조일 뿐 점수와 무관하다', () => {
  const c = COUPLE_BY_ID['vampire-garlic'];
  const secret = c.target.hiddenPrefs.find(h => h.includes('별')); // '밤에 별 보는 걸 좋아한다'
  assert.ok(secret, '테스트 전제: 별 관련 비밀이 있다');
  const hit = surfacedSecrets(c, `김마늘: 저는 밤에 별 보는 걸 좋아해요`, []);
  assert.ok(hit.surfaced.includes(secret), '대화록에 나온 비밀은 화제에 오른 것으로 표시된다');
  const miss = surfacedSecrets(c, '오늘 날씨가 좋네요', []);
  assert.ok(miss.missed.includes(secret));
  assert.equal(miss.surfaced.length + miss.missed.length, c.target.hiddenPrefs.length);
});

// ── 디브리핑 ─────────────────────────────────────────────
test('디브리핑은 채점이 아니라 사실 요약이다', () => {
  const d = diffOf('헬');
  const pol = COUPLE_BY_ID['politics'];
  let s = initialState(d);
  s = applyTurn(s, d, J('breakthrough', { revealed: '골프 핸디캡을 진지하게 물어보면 무너진다' }));
  s = applyTurn(s, d, J('disaster', { moodDelta: -7 }));
  const v = verdict(s, d);
  const db = debrief(s, d, v, pol, '힐라리 클링턴: 핸디캡이 몇이신가요');
  const byKey = Object.fromEntries(db.notes.map(n => [n.key, n]));
  assert.equal(byKey.revealed.value, '1건');
  assert.equal(byKey.cold.ok, false, '정색한 턴이 있으면 지적한다');
  assert.equal(byKey.radio.ok, false, '무전을 안 쓰면 지적한다');
  assert.equal(db.surfaced.length + db.missed.length, pol.target.hiddenPrefs.length);
  // 준비 점수 항목이 남아 있으면 안 된다
  for (const n of db.notes) {
    assert.ok(!/스타일링|코칭|연설/.test(n.label), `디브리핑에 준비 채점 항목이 남아 있다: ${n.label}`);
  }
});

test('히스토리는 증감과 누적을 둘 다 남긴다', () => {
  const d = diffOf('보통');
  const s = applyTurn(initialState(d), d, J('warm', { moodDelta: 5 }));
  const h = s.history.at(-1);
  assert.equal(h.turn, 1);
  assert.equal(typeof h.dLove, 'number');
  assert.equal(typeof h.dMood, 'number');
  assert.equal(h.love, Math.round(s.love));
  assert.equal(h.mood, Math.round(s.mood));
  assert.equal(h.tier, 'warm');
});

// ── 프롬프트: 주입은 되고, 규칙은 안 된다 ────────────────
// ── 자기 성향이 먼저다 ───────────────────────────────────
test('대화 프롬프트가 상대 맞추기가 아니라 자기 욕구에서 출발한다', () => {
  const c = COUPLE_BY_ID['os-war'];
  const client = P.clientAgentSystem(c, { coaching: '', speech: '' }, 'text', AGENT);
  const target = P.targetAgentSystem(c, 'text', '');
  for (const [name, sys, person] of [['client', client, c.client], ['target', target, c.target]]) {
    assert.ok(sys.includes(person.flaw.want), `${name}: 자기 욕구가 프롬프트에 없다`);
    assert.ok(sys.includes(person.weakness), `${name}: 버릇이 프롬프트에 없다`);
    assert.ok(sys.includes('Not for their sake — for yours'), `${name}: 욕구의 방향이 명시되지 않았다`);
    // 자기 욕구가 상대 정보보다 먼저 나와야 한다
    assert.ok(sys.indexOf('[WHAT YOU WANT OUT OF THIS SEAT]') < sys.indexOf('[WHAT YOU KNOW ABOUT THEM]'),
      `${name}: 상대 정보가 자기 욕구보다 먼저 나온다`);
  }
});

// 사용자 요구: 프롬프트 어디에도 "상대에게 맞춰라"라고 쓰지 않는다.
// 배려·이상적 응답이 기본값이 되는 순간 40명이 전부 같은 사람이 된다.
test('어느 프롬프트에도 상대에게 맞추라는 지시가 없다', () => {
  const BANNED = ['맞춰', '맞추라', '맞추어', '배려하', '상대가 원하는 것을', '상대가 듣고 싶',
    '호감을 사', '잘 보이려', '마음에 들도록', '기분을 맞'];
  for (const c of COUPLES) {
    const prompts = {
      client: P.clientAgentSystem(c, { coaching: '', speech: '' }, 'text', AGENT),
      target: P.targetAgentSystem(c, 'talk', '평상복'),
    };
    for (const [who, sys] of Object.entries(prompts)) {
      for (const w of BANNED) {
        assert.ok(!sys.includes(w), `${c.id}.${who} 프롬프트에 "${w}"가 있다`);
      }
    }
  }
});

// 관심 없는 사람에게 상대 정보를 주면, "관심 없는 사람"이 아니라 "정보를 가진 사람"이 된다.
test('상대에 대한 정보가 관심도에 따라 차등 지급된다', () => {
  const selfish = COUPLES.find(c => c.client.flaw.attention === 'self');
  const caring = COUPLES.find(c => c.client.flaw.attention === 'other');
  assert.ok(selfish && caring, '테스트 전제: 두 종류 인물이 다 있어야 한다');

  const s1 = P.clientAgentSystem(selfish, { coaching: '', speech: '' }, 'text', AGENT);
  assert.ok(s1.includes(selfish.target.appearance[0]), '겉모습은 누구나 본다');
  assert.ok(!s1.includes(selfish.target.personality.join(', ')), 'attention=self인데 상대 성격을 안다');
  for (const v of selfish.target.visiblePrefs) {
    assert.ok(!s1.includes(v), `attention=self인데 상대 취향을 안다: ${v}`);
  }
  assert.ok(s1.includes('never got around to finding out'));

  const s2 = P.clientAgentSystem(caring, { coaching: '', speech: '' }, 'text', AGENT);
  assert.ok(s2.includes(caring.target.personality.join(', ')), 'attention=other면 성격은 안다');
  assert.ok(s2.includes(caring.target.visiblePrefs[0]), 'attention=other면 알려진 취향도 안다');
});

// 'other'가 상대 쪽에서 아무것도 안 늘리던 시절이 있었다 — 의뢰인에게는 visiblePrefs가 없어서
// 조건문이 통째로 헛돌았고, 상대의 'other'는 'mixed'와 완전히 같은 프롬프트를 냈다.
// 지금은 의뢰인의 버릇이 넘어간다. 축이 죽어 있으면 그건 데이터가 아니라 장식이다.
test("상대 쪽 attention='other'도 실제로 한 겹을 더 준다", () => {
  const caring = COUPLES.find(c => c.target.flaw.attention === 'other');
  const mid = COUPLES.find(c => c.target.flaw.attention === 'mixed');
  assert.ok(caring && mid, '테스트 전제: 두 종류 상대가 다 있어야 한다');

  const s = P.targetAgentSystem(caring, 'text', '');
  assert.ok(s.includes(caring.client.weakness), "attention='other'인데 의뢰인 버릇을 모른다");

  const m = P.targetAgentSystem(mid, 'text', '');
  assert.ok(!m.includes(mid.client.weakness), "attention='mixed'인데 의뢰인 버릇을 안다");
});

test('요원이 쓴 지침/연설이 클라이언트 시스템 프롬프트에 그대로 들어간다', () => {
  const coaching = '절대로 마늘 얘기를 먼저 꺼내지 마라';
  const speech = '412년을 기다렸으면 오늘 하루는 아무것도 아니다';
  const sys = P.clientAgentSystem(COUPLE_BY_ID['vampire-garlic'],
    { coaching, speech, outfitDesc: '검정 망토' }, 'text', AGENT);
  assert.ok(sys.includes(coaching));
  assert.ok(sys.includes(speech));
  assert.ok(sys.includes('검정 망토'));
  assert.ok(sys.includes('박큐피드'), '요원 이름이 지침의 출처로 명시된다');
});

// 지시가 잘 안 먹었다. 부탁이 아니라 명령으로 바꾸되, 명령 밖의 판단은 남겨둔다.
test('요원의 지침은 참고사항이 아니라 명령으로 주입된다', () => {
  const c = COUPLE_BY_ID['politics'];
  const sys = P.clientAgentSystem(c, { coaching: '선거 얘기는 꺼내지 마라', speech: '' }, 'text', AGENT);
  assert.ok(sys.includes('[ORDERS FROM HEADQUARTERS'), '명령으로 표시되지 않는다');
  assert.ok(sys.includes('not advice and not a suggestion'), '구속력이 명시되지 않는다');
  assert.ok(sys.includes('carry this order out'), '이행 의무가 없다');
  // 자율 판단을 통째로 뺏지는 않는다
  assert.ok(sys.includes('Where the orders say nothing, you act on your own judgement'),
    '자율 판단이 남아 있어야 한다');
});

test('명령의 결이 인물마다 다르다 — 다만 셋 다 이행한다', () => {
  const seen = new Set();
  for (const c of COUPLES) {
    const sys = P.clientAgentSystem(c, { coaching: '아무 지시', speech: '' }, 'text', AGENT);
    assert.ok(sys.includes('carry this order out'), `${c.id}: 이행 의무가 빠졌다`);
    seen.add(c.client.flaw.compliance);
  }
  assert.ok(seen.size >= 2, '전원이 같은 결이면 인물 차이가 없는 것이다');
});

test('준비를 비우면 그 사실이 프롬프트에 사실로 적힌다', () => {
  const c = COUPLE_BY_ID['vampire-garlic'];
  const empty = P.clientAgentSystem(c, { coaching: '', speech: '', outfitDesc: '' }, 'text', AGENT);
  assert.ok(empty.includes('Nobody told you how to handle this'));
  assert.ok(empty.includes('shoved out the door in silence'));
  assert.ok(empty.includes('평소 입던 옷'), '착장은 한글 데이터 그대로 들어간다');
});

// 이번 개편의 본체. 대화 에이전트에게 연출 지시를 주면 그 인물은 대화가 아니라 공략을 시작한다.
test('대화 에이전트 프롬프트에 대화 규칙·연출 지시가 없다', () => {
  const c = COUPLE_BY_ID['os-war'];
  const banned = [
    '실마리', '물고 늘어', '캐물', '흘려라', '세 번 연속', '두 번째 발언부터',
    '쉽게 넘어가지', '방어선', '눈치채지 못하고', '자 이내',
  ];
  const prompts = {
    client: P.clientAgentSystem(c, { coaching: '', speech: '', outfitDesc: '' }, 'text', AGENT),
    target: P.targetAgentSystem(c, 'talk', '평상복'),
  };
  for (const [who, sys] of Object.entries(prompts)) {
    for (const word of banned) {
      assert.ok(!sys.includes(word), `${who} 프롬프트에 대화 규칙이 남아 있다: "${word}"`);
    }
  }
});

// 이 게임에 남은 유일한 게임성은 정보 비대칭이다.
// 접촉 금지 항목은 요원의 의뢰서에만 인쇄되어 있고, 지침으로 넘겨줘야 의뢰인에게 도달한다.
// 이걸 의뢰인 프롬프트에 직접 넣었더니 준비를 안 해도 알아서 다 피해서
// 준비 유무가 점수를 전혀 못 갈랐다(라이브 실측 lazy 65~69 vs ace 61~76).
test('클라이언트는 상대의 접촉 금지 항목을 모른다 — 요원이 알려줘야 안다', () => {
  const c = COUPLE_BY_ID['politics'];
  const bare = P.clientAgentSystem(c, { coaching: '', speech: '' }, 'text', AGENT);
  for (const r of c.target.redLines) {
    assert.ok(!bare.includes(r), `지침 없이도 지뢰를 알고 있다: ${r}`);
  }
  // 요원이 지침에 적어 넘기면 그때 도달한다
  const told = P.clientAgentSystem(c, { coaching: `${c.target.redLines[0]}은 절대 꺼내지 마라`, speech: '' }, 'text', AGENT);
  assert.ok(told.includes(c.target.redLines[0]));
  // 심판과 상대 본인은 당연히 안다
  assert.ok(P.judgeSystem(c).includes(c.target.redLines[0]));
  assert.ok(P.targetAgentSystem(c, 'text', '').includes(c.target.redLines[0]));
});

test('클라이언트는 상대의 감춰둔 이야기를 모른다', () => {
  const c = COUPLE_BY_ID['os-war'];
  const sys = P.clientAgentSystem(c, { coaching: '', speech: '' }, 'text', AGENT);
  for (const h of c.target.hiddenPrefs) {
    assert.ok(!sys.includes(h), `클라이언트 프롬프트에 상대의 비밀이 새어 있다: ${h}`);
  }
  assert.ok(P.targetAgentSystem(c, 'text', '').includes(c.target.hiddenPrefs[0]), '상대 본인은 당연히 안다');
  assert.ok(P.judgeSystem(c).includes(c.target.hiddenPrefs[0]), '심판은 반응을 읽으려면 알아야 한다');
});

test('두 에이전트 모두 자기 내력을 프롬프트로 받는다', () => {
  const c = COUPLE_BY_ID['circadian'];
  const client = P.clientAgentSystem(c, { coaching: '', speech: '' }, 'text', AGENT);
  const target = P.targetAgentSystem(c, 'text', '');
  assert.ok(client.includes(c.client.background[0]));
  assert.ok(target.includes(c.target.background[0]));
  assert.ok(!client.includes(c.target.background[0]), '상대 내력까지 알면 초면이 아니다');
});

test('심판 스키마는 tier·해설·공기를 필수로 요구한다', () => {
  for (const k of ['tier', 'reason', 'vibe', 'revealed', 'loveDelta', 'moodDelta']) {
    assert.ok(P.JUDGE_SCHEMA.required.includes(k), `심판 스키마에 ${k}가 없다`);
  }
  assert.deepEqual(
    [...P.JUDGE_SCHEMA.properties.tier.enum].sort(),
    Object.keys(TIER_BANDS).sort(),
    '스키마 enum과 밴드 표가 어긋나면 판정이 클램프되지 않는다');
});

test('심판은 판정보다 해설이 먼저라고 지시받는다', () => {
  const sys = P.judgeSystem(COUPLE_BY_ID['politics']);
  assert.ok(/FIRST —/.test(sys), '우선순위가 명시되어야 한다');
  assert.ok(/cannot adjudicate/.test(sys), '"판정 불가" 금지가 명시되어야 한다');
  assert.ok(sys.includes('forcing it to make sense'), '부조리한 장면도 납득시키라는 지시가 있어야 한다');
});

test('결승선은 전부 연애로 통일되어 있다', () => {
  // 조합마다 '성공'의 뜻이 달라지면 심판도 플레이어도 같은 게이지를 다르게 읽는다.
  for (const c of COUPLES) {
    assert.equal(c.endingKind, '연애', `${c.id}: 결승선이 연애가 아니다`);
  }
  assert.equal(typeof P.ENDING_FRAME, 'undefined', '결승선 갈래 표가 남아 있다');
  assert.equal(typeof P.frameOf, 'undefined', '결승선 분기 함수가 남아 있다');
  assert.equal(P.ENDING.meterName, '호감');
  // 갈래별 문구가 프롬프트에 남아 있으면 안 된다
  const sys = P.judgeSystem(COUPLE_BY_ID['orientation']);
  assert.ok(!/전우애|휴전 의지|물리적으로 불가능/.test(sys), '심판에게 옛 결승선 문구가 간다');
});

test('결승선을 대화 에이전트에게 지시하지 않는다', () => {
  // 목표를 주면 그 인물은 대화가 아니라 공략을 시작한다. 사연에만 녹인다.
  for (const c of COUPLES) {
    const client = P.clientAgentSystem(c, { coaching: '', speech: '' }, 'text', AGENT);
    assert.ok(!client.includes('[네 목표]'), `${c.id}: 에이전트에게 결승선을 지시하고 있다`);
    assert.ok(!client.includes('결승선'), `${c.id}: '결승선'이라는 말이 에이전트에게 간다`);
  }
});

// ── 표현 수위 ────────────────────────────────────────────
test('세계관이 창작 인물 대상 수위를 명시적으로 열어둔다', () => {
  assert.ok(P.WORLD.includes('adults-only lines'));
  assert.ok(P.WORLD.includes('slander'));
  assert.ok(/Do not sanitize them/.test(P.WORLD));
  // 실존 인물·현실 집단 혐오만 좁게 제외한다. 이건 취향이 아니라 운영 문제다 —
  // 모형이 응답을 거부하면 공작이 그 자리에서 끊긴다.
  assert.ok(P.WORLD.includes('real people or real organizations'));
  assert.ok(P.WORLD.includes('hate speech'));
});

// ── 브리핑은 LLM을 안 쓴다 ───────────────────────────────
test('국장 브리핑은 하드코딩이고 요원 정보가 박힌다', () => {
  const text = P.briefingText({ name: '김철수', gender: '남' });
  assert.ok(text.includes('김철수'));
  assert.ok(text.includes('남'), '성별을 적었으면 서식에 인쇄된다');
  assert.ok(text.includes(`${COUPLES.length}건`), '브리핑이 실제 접수 건수를 안 말한다');
  assert.ok(text.trim().endsWith('이상! 건투를 빈다, 요원.'));
  // 성별을 비워도 문장이 깨지지 않아야 한다
  const noGender = P.briefingText({ name: '007', gender: '' });
  assert.ok(noGender.includes('007') && !noGender.includes('등록 성별란'));
  assert.equal(typeof P.BRIEFING_SYSTEM, 'undefined', '브리핑 프롬프트가 남아 있으면 호출도 남아 있다');
});

// ── 아바타 스키마와 렌더러가 어긋나지 않는다 ─────────────
test('스타일링 스키마의 모든 값을 아바타가 받아들인다', () => {
  const props = P.AVATAR_SPEC_SCHEMA.properties;
  const cases = [
    ['hairStyle', props.hairStyle.enum],
    ['accessory', props.accessory.enum],
    ['expression', props.expression.enum],
    ['aura', props.aura.enum],
    ['species', props.species.enum],
  ];
  for (const [key, values] of cases) {
    assert.ok(values.length > 0, `${key} enum이 비어 있다`);
    for (const v of values) {
      const s = sanitizeSpec({ ...DEFAULT_SPEC, [key]: v });
      assert.equal(s[key], v, `아바타가 ${key}="${v}"를 모른다 — LLM이 만든 걸 못 그린다`);
    }
  }
});

test('자유 도형은 살아남고 쓰레기는 걸러진다', () => {
  const good = { shape: 'sphere', color: '#112233', size: 0.4, at: 'handR', motion: 'bob', label: '폭탄' };
  const s = sanitizeSpec({
    props: [
      good,
      { shape: '없는도형', color: '#fff', size: 1, at: 'handR', motion: 'none', label: 'x' },
      { shape: 'box', color: 'zzz', size: 999, at: '없는자리', motion: 'none', label: 'y' },
      { shape: 'box', color: 'not-hex', size: 99, at: 'chest', motion: '없는동작', label: 'z' },
    ],
  });
  assert.equal(s.props.length, 2, '알 수 없는 도형/자리는 버린다');
  assert.deepEqual(s.props[0], good);
  assert.equal(s.props[1].color, '#cccccc', '색이 이상하면 기본색');
  assert.equal(s.props[1].size, 1.2, '크기는 상한으로 잘린다');
  assert.equal(s.props[1].motion, 'none', '모르는 동작은 정지');
  // 6개 상한
  const many = sanitizeSpec({ props: Array.from({ length: 20 }, () => good) });
  assert.equal(many.props.length, 6);
  assert.deepEqual(sanitizeSpec({ props: 'nope' }).props, []);
});

test('스타일링은 종족을 바꿀 수 없다고 프롬프트에 못박혀 있다', () => {
  assert.ok(P.STYLING_SYSTEM.includes('Never change species'));
  assert.ok(P.STYLING_SYSTEM.includes('There is nothing you cannot build'), '거절하지 않는 시공업자여야 한다');
  assert.ok(P.STYLING_SCHEMA.required.includes('clientReaction'), '거울 본 본인 반응이 필수다');
});

test('준비 단계 반응 프롬프트가 두 장소를 구분한다', () => {
  const c = COUPLE_BY_ID['sauce-war'];
  const interro = P.prepReactSystem(c, 'coaching');
  const gate = P.prepReactSystem(c, 'speech');
  assert.ok(interro.includes('취조실'));
  assert.ok(gate.includes('정문'));
  assert.ok(interro.includes(c.client.background[0]), '반응하려면 자기가 누군지 알아야 한다');
  assert.deepEqual(P.PREP_REACT_SCHEMA.required.sort(), ['face', 'note', 'reaction']);
  assert.ok(P.prepReactUser('speech', '', AGENT).includes('Nothing was said'), '빈 입력도 장면이 된다');
});

// ── 구조화 출력 스키마 가드 ─────────────────────────────
// 지원되지 않는 키워드 검사는 tests/schema.test.mjs가 전담한다 (스키마를 자동으로 훑는다).
// 여기서는 그쪽이 안 보는 것만 본다 — 구조화 출력은 객체마다
// additionalProperties:false와 '모든 속성이 required'를 요구한다. 빠지면 응답이 조용히 새거나 400이 난다.
test('스키마의 모든 객체가 구조화 출력 요건을 지킨다', () => {
  const schemas = Object.entries(P).filter(([k, v]) => k.endsWith('_SCHEMA') && v && typeof v === 'object');
  assert.ok(schemas.length >= 6, `스키마가 ${schemas.length}개뿐이다 — 목록이 어긋났다`);
  const walk = (node, where) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${where}[${i}]`));
    if (node.type === 'object') {
      assert.equal(node.additionalProperties, false, `${where}: additionalProperties:false가 없다`);
      assert.deepEqual([...(node.required || [])].sort(), Object.keys(node.properties || {}).sort(),
        `${where}: required가 properties와 일치하지 않는다`);
      for (const [k, v] of Object.entries(node.properties || {})) walk(v, `${where}.${k}`);
    }
    if (node.items) walk(node.items, `${where}.items`);
  };
  for (const [name, sch] of schemas) walk(sch, name);
});

// ── 테스트 예산 가드 ────────────────────────────────────
// Opus로 밸런싱 한 라운드가 $6.6다. 실수로 비싼 모델이 기본값이 되는 걸 막는다.
test('라이브 테스트는 Haiku/Sonnet만 쓴다', async () => {
  const { resolveTestModel, TEST_MODEL, OVERRIDE_FLAG } = await import('./test-model.mjs');
  assert.match(TEST_MODEL, /^claude-haiku-/, '기본 테스트 모델은 하이쿠여야 한다');
  assert.equal(resolveTestModel('claude-haiku-4-5-20251001', []), 'claude-haiku-4-5-20251001', '하이쿠는 통과');
  assert.equal(resolveTestModel(undefined, []), TEST_MODEL, '미지정이면 소넷');
  assert.equal(resolveTestModel('claude-sonnet-5', []), 'claude-sonnet-5', '소넷은 통과');

  // 비싼 모델은 명시적 승인 없이는 통과하지 못한다 (process.exit 호출을 잡아낸다)
  const realExit = process.exit, realErr = console.error;
  let exited = null;
  process.exit = c => { exited = c; throw new Error('__exit__'); };
  console.error = () => { };
  try { resolveTestModel('claude-opus-5', []); } catch (e) { if (e.message !== '__exit__') throw e; }
  process.exit = realExit; console.error = realErr;
  assert.equal(exited, 1, 'Opus 요청은 종료코드 1로 막혀야 한다');

  // 탈출구를 명시하면 통과한다
  const realWarn = console.warn;
  console.warn = () => { };
  assert.equal(resolveTestModel('claude-opus-5', [OVERRIDE_FLAG]), 'claude-opus-5');
  console.warn = realWarn;
});

test('라이브 하네스 두 개가 모두 모델 게이트를 통과한다', async () => {
  const fs = await import('node:fs');
  for (const f of ['tests/live.mjs', 'tests/browser.mjs']) {
    const src = fs.readFileSync(f, 'utf8');
    assert.match(src, /resolveTestModel\(/, `${f}: 모델 게이트를 우회하고 있다`);
    assert.ok(!/['"]claude-opus-5['"]/.test(src), `${f}: Opus가 하드코딩되어 있다`);
  }
});

// ── 정보 공개층 ───────────────────────────────────────────────────────
// flaw는 게임을 지배하는 데이터다. 화면에 안 나가면 그건 개성이 아니라 불공정한 랜덤이다.

test('모든 의뢰인의 결함이 사람이 읽을 수 있는 형태로 나온다', async () => {
  const { COUPLES, flawReport, FLAW_LABELS } = await import('../js/couples.js');
  for (const c of COUPLES) {
    const rows = flawReport(c.client);
    assert.deepEqual(rows.map(r => r.key), ['reads', 'attention', 'compliance'],
      `${c.id}: 의뢰인은 세 축이 전부 살아 있다`);
    // 상대에게는 attention만 실효가 있다. 안 쓰이는 축을 디브리핑에 띄우면 화면이 거짓말을 한다.
    const tRows = flawReport(c.target);
    assert.deepEqual(tRows.map(r => r.key), ['attention'], `${c.id}: 상대는 관심 축만 나간다`);
    for (const r of [...rows, ...tRows]) {
      assert.ok(r.axis && r.tag && r.desc, `${c.id}/${r.key}: 라벨이 비었다`);
      assert.ok(['ok', 'mid', 'bad'].includes(r.level), `${c.id}/${r.key}: 심각도가 이상하다`);
      assert.ok(r.desc.length > 10, `${c.id}/${r.key}: 설명이 너무 짧다`);
    }
    // 축마다 모든 값에 라벨이 있어야 한다 — 하나라도 비면 화면이 빈칸으로 나간다
    for (const axis of ['reads', 'attention', 'compliance']) {
      assert.ok(FLAW_LABELS[axis][c.client.flaw[axis]], `${c.id}: ${axis}=${c.client.flaw[axis]} 라벨 없음`);
    }
    assert.ok(FLAW_LABELS.attention[c.target.flaw.attention], `${c.id}: 상대 관심 라벨 없음`);
  }
});

test('공기를 못 읽는 의뢰인은 그 사실이 라벨에 박혀 있다', async () => {
  const { FLAW_LABELS } = await import('../js/couples.js');
  // reads=none 라벨은 "전달되지 않는다"는 사실을 말해야 한다. 안 그러면 분위기 바가 거짓말이 된다.
  assert.match(FLAW_LABELS.reads.none.desc, /전달되지 않는|안 간다|한 글자도/);
  assert.match(FLAW_LABELS.reads.some.desc, /두 번에 한 번|절반/);
  // compliance=drifts는 "다시 써야 한다"는 실전 정보를 담아야 한다
  assert.match(FLAW_LABELS.compliance.drifts.desc, /돌아간다|다시/);
});

test('호감 포화 계수는 계기판이 쓸 수 있게 함수로 노출된다', async () => {
  const S = await import('../js/scoring.js');
  assert.equal(typeof S.loveSaturation, 'function');
  assert.equal(S.loveSaturation(0), 1, '호감 0이면 감쇠 없음');
  assert.ok(S.loveSaturation(60) < S.loveSaturation(20), '호감이 높을수록 덜 오른다');
  assert.ok(S.loveSaturation(100) >= 0.2, '바닥 아래로는 안 내려간다');
  // 계기판에 뜨는 값과 실제 적용값이 같은 함수에서 나와야 한다
  const src = (await import('node:fs')).readFileSync('js/scoring.js', 'utf8');
  assert.ok(!/1 - before\.love \/ TUNING\.loveSaturation/.test(src), '포화식이 두 군데로 갈라졌다');
});

test('요원이 아는 것과 의뢰인이 아는 것의 경계가 화면에 명시된다', async () => {
  const fs = await import('node:fs');
  const game = fs.readFileSync('js/game.js', 'utf8');
  const html = fs.readFileSync('index.html', 'utf8');
  // 지뢰 목록은 요원에게만 공개된다. 이 사실을 안 알려주면 플레이어는 의뢰인도 안다고 착각한다.
  assert.match(game, /의뢰인에게 전달되지 않았다|자동으로 넘어가지 않는다/, '지뢰 인계 경고가 없다');
  assert.match(html, /질색」 목록은 의뢰인이 모른다|의뢰인은 지침으로 들은 것만 안다/, '취조실/계기판 안내가 없다');
  // 계기판에 포화·잔여 턴이 있어야 한다
  assert.match(html, /id="hud-sat"/, '호감 포화 칩이 없다');
  assert.match(html, /id="hud-turns"/, '잔여 턴 칩이 없다');
  assert.match(html, /id="vibe-reach"/, '공기 도달 배지가 없다');
});

test('화면 문구가 엔진과 모순되지 않는다', async () => {
  const fs = await import('node:fs');
  // 공기는 reads에 따라 안 갈 수도 있다. "그대로 전달된다"는 단정은 거짓말이 된다.
  // README는 옛 문구를 "이게 거짓말이었다"고 인용하므로 화면에 실제로 나가는 텍스트만 본다.
  for (const f of ['js/game.js', 'index.html']) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!/공기[^.\n]{0,20}그대로 의뢰인에게 전달된다/.test(src),
      `${f}: 공기가 항상 전달된다고 단정하고 있다 (reads에 따라 안 간다)`);
    assert.ok(!/의뢰인도 그 정도는 안다/.test(src),
      `${f}: 지뢰를 의뢰인이 안다고 단정하고 있다 (프롬프트에 안 들어간다)`);
  }
  // README는 단정하지 않고 조건을 밝혀야 한다
  const readme = fs.readFileSync('README.md', 'utf8');
  assert.match(readme, /reads: none.{0,40}한 글자도 안 가고|전달 안 됨/,
    'README가 공기 전달의 조건을 설명하지 않는다');
  // 지뢰가 실제로 의뢰인 프롬프트에 없는지 — 문구의 근거를 코드에서 확인한다
  const P = await import('../js/prompts.js');
  const { COUPLE_BY_ID } = await import('../js/couples.js');
  const c = COUPLE_BY_ID['politics'];
  const sys = P.clientAgentSystem(c, { outfitDesc: '', coaching: '', speech: '' }, 'text', { name: '요원', gender: '기밀' });
  for (const r of c.target.redLines) {
    assert.ok(!sys.includes(r), `의뢰인 프롬프트에 상대의 지뢰가 새고 있다: ${r}`);
  }
});

test("대면('each')일 때 두 아바타가 서로를 본다", async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync('js/avatar.js', 'utf8');
  const m = src.match(/static FACE_EACH = ([^;]+);/);
  assert.ok(m, 'FACE_EACH 상수가 없다');
  const F = eval(m[1]);                       // Math.PI / 2 - 0.4

  // 얼굴은 +Z. Y축 θ 회전 → 시선 (sinθ, 0, cosθ).
  const gaze = th => ({ x: Math.sin(th), z: Math.cos(th) });
  const left = gaze(F), right = gaze(-F);

  // 왼쪽은 x=-0.9에 있으니 상대(+X) 쪽을 봐야 하고, 오른쪽은 그 반대.
  assert.ok(left.x > 0.5, `왼쪽이 상대를 안 본다 (시선x=${left.x.toFixed(2)})`);
  assert.ok(right.x < -0.5, `오른쪽이 상대를 안 본다 (시선x=${right.x.toFixed(2)})`);
  // 완전 측면이면 얼굴이 안 보인다. 카메라 쪽으로 조금은 틀어져 있어야 한다.
  assert.ok(left.z > 0.2 && right.z > 0.2, '옆모습만 보여서 표정이 안 보인다');

  // 'camera' 모드는 둘 다 카메라를 봐야 한다
  const C = eval(src.match(/static FACE_CAM = ([^;]+);/)[1]);
  assert.ok(gaze(C).z > 0.9 && gaze(-C).z > 0.9, 'camera 모드인데 카메라를 안 본다');
});

test('제2차 강제배정은 기존 헬보다 하자가 나쁘다', async () => {
  const { COUPLES, FLAW_SEVERITY } = await import('../js/couples.js');
  const NEW = ['gender-war', 'birth-strike', 'death-row', 'body-war', 'noise-vow',
    'carbon', 'class-war', 'scalpel', 'tobacco', 'spoiler'];
  assert.equal(NEW.length, 10);

  // 하자 점수: bad 2 / mid 1 / ok 0. 두 사람 몫을 합친다.
  const score = c => ['client', 'target'].reduce((sum, who) =>
    sum + ['reads', 'attention', 'compliance'].reduce((s2, ax) => {
      const v = c[who].flaw[ax];
      if (v === undefined) return s2;   // 상대에게는 attention만 있다
      const lv = FLAW_SEVERITY[ax][v];
      return s2 + (lv === 'bad' ? 2 : lv === 'mid' ? 1 : 0);
    }, 0), 0);

  const oldHell = COUPLES.filter(c => c.difficulty === '헬' && !NEW.includes(c.id));
  const newHell = COUPLES.filter(c => NEW.includes(c.id));
  assert.equal(newHell.length, 10, '새 배정분이 대장에 다 안 들어갔다');
  for (const c of newHell) assert.equal(c.difficulty, '헬', `${c.id}: 헬이 아니다`);

  const avg = arr => arr.reduce((a, c) => a + score(c), 0) / arr.length;
  const oldAvg = avg(oldHell), newAvg = avg(newHell);
  assert.ok(newAvg > oldAvg,
    `새 배정분이 더 안 어렵다 (기존 헬 ${oldAvg.toFixed(1)} vs 신규 ${newAvg.toFixed(1)})`);

  // 양쪽 다 상대를 꺾거나 교화하거나 인정받으려 나온다 — 저절로 풀릴 구석이 없어야 한다
  for (const c of newHell) {
    for (const who of ['client', 'target']) {
      assert.ok(c[who].flaw.want.length > 12, `${c.id}.${who}: want가 너무 짧다`);
      assert.ok(c[who].weakness.length > 5, `${c.id}.${who}: 버릇이 너무 짧다`);
    }
  }
});

// ── 사람이 죽을 수 있다 ─────────────────────────────────
// 화산 분화구, 고래 뱃속, 칼을 든 상대. 장소와 인물이 실제로 치명적이면 죽음도 결과여야 한다.
test('사망이 분위기 파탄보다 먼저 판을 끝낸다', async () => {
  const { failureReason, initialState, diffOf } = await import('../js/scoring.js');
  const d = diffOf('보통');
  const alive = initialState(d);
  assert.equal(failureReason(alive), null);
  assert.equal(failureReason({ ...alive, mood: 0 }), 'mood');
  assert.equal(failureReason({ ...alive, casualty: 'target' }), 'death');
  // 분위기가 만점이어도 죽으면 끝이다
  assert.equal(failureReason({ ...alive, mood: 100, casualty: 'client' }), 'death');
  // 둘 다면 죽음이 먼저 잡힌다
  assert.equal(failureReason({ ...alive, mood: 0, casualty: 'both' }), 'death');
});

test('사망은 호감이 성공선을 넘었어도 무조건 F다', async () => {
  const { verdict, initialState, diffOf } = await import('../js/scoring.js');
  const d = diffOf('보통');
  const s = { ...initialState(d), love: 95, mood: 90, casualty: 'target' };
  const v = verdict(s, d);
  assert.equal(v.accepted, false, '성사시킬 사람이 없는데 성사됐다');
  assert.equal(v.grade, 'F');
  assert.equal(v.reason, 'death');
  assert.equal(v.casualty, 'target');
});

test('사망은 한 번 정해지면 뒤집히지 않는다', async () => {
  const { applyTurn, initialState, diffOf } = await import('../js/scoring.js');
  const d = diffOf('보통');
  let s = initialState(d);
  assert.equal(s.casualty, 'none');
  s = applyTurn(s, d, J('disaster', { casualty: 'client', casualtyNote: '용암에 빠졌다' }));
  assert.equal(s.casualty, 'client');
  assert.equal(s.casualtyNote, '용암에 빠졌다');
  // 다음 판정이 none을 뱉어도 되살아나지 않는다
  s = applyTurn(s, d, J('warm', { casualty: 'none' }));
  assert.equal(s.casualty, 'client', '죽은 사람이 되살아났다');
  // 다른 사람으로 덮어쓰지도 않는다
  s = applyTurn(s, d, J('disaster', { casualty: 'both' }));
  assert.equal(s.casualty, 'client', '첫 사망 기록이 덮였다');
});

test('심판이 아무 값이나 뱉어도 사상자 칸은 네 값만 받는다', async () => {
  const { applyTurn, initialState, diffOf } = await import('../js/scoring.js');
  const d = diffOf('보통');
  for (const junk of ['dead', '사망', true, 1, null, undefined, 'CLIENT']) {
    const s = applyTurn(initialState(d), d, J('flat', { casualty: junk }));
    assert.equal(s.casualty, 'none', `casualty=${String(junk)}가 통과했다`);
  }
});

test('사망 경위가 판정 스키마와 프롬프트 양쪽에 있다', () => {
  assert.ok(P.JUDGE_SCHEMA.properties.casualty, '판정 스키마에 사상자 칸이 없다');
  assert.deepEqual(P.JUDGE_SCHEMA.properties.casualty.enum, ['none', 'client', 'target', 'both']);
  // 구조화 출력은 모든 속성이 required여야 한다
  for (const k of ['casualty', 'casualtyNote']) {
    assert.ok(P.JUDGE_SCHEMA.required.includes(k), `${k}가 required에 없다`);
  }
  const sys = P.judgeSystem(COUPLE_BY_ID['os-war']);
  assert.match(sys, /Someone can actually die here/, '사망 규칙이 없다');
  assert.match(sys, /You never invent one/, '없던 위험을 지어내는 걸 안 막고 있다');
  assert.match(sys, /\*\*If both are true you must call it\.\*\*/, '조건이 맞아도 안 부를 여지가 있다');
  assert.match(sys, /probably did not connect/, '판정 회피 경로가 안 막혀 있다');
  assert.match(sys, /Words alone never do it/, '말싸움만으로 죽을 수 있다');
  assert.match(sys, /that is every single turn/, '사망이 흔해질 수 있다');
  assert.match(sys, /it is final\. Nobody is revived/, '되살아날 여지가 있다');
});

test('죽은 사람은 결과 편지를 쓰지 않는다', () => {
  const sys = P.resultSystem(COUPLE_BY_ID['os-war'], AGENT);
  assert.match(sys, /the client died → the letter is the other person's statement/, '의뢰인 사망 처리가 없다');
  assert.match(sys, /both died → the Bureau's own duty clerk files it/, '전멸 처리가 없다');
  const user = P.resultUser(COUPLE_BY_ID['os-war'], {
    accepted: false, grade: 'F', love: 20, mood: 0, threshold: 47, moodFloor: 33,
    aborted: true, abortReason: 'death', casualty: 'both', casualtyNote: '둘 다 분화구로 떨어졌다',
    transcript: '(기록)', radioUsed: 0,
  });
  assert.match(user, /\[CASUALTY\] both — 둘 다 분화구로 떨어졌다/, '사상자가 기록관에게 안 넘어간다');
  // 사망일 때 분위기 파탄 문구가 같이 나가면 기록관이 헷갈린다
  assert.ok(!/The air hit zero/.test(user), '사망인데 분위기 파탄 메모가 같이 갔다');
});

// ── 한 판이 충분히 길어야 장벽까지 간다 ─────────────────
// 9턴짜리 판에서는 호감 쌓기만 하다 끝났다. 장벽을 꺼낼 자리가 없었다.
test('한 판이 14턴이고 케미가 좋으면 19턴까지 간다', async () => {
  const { DIFFICULTIES, EXTENSION } = await import('../js/scoring.js');
  for (const [name, d] of Object.entries(DIFFICULTIES)) {
    const base = d.textTurns + d.talkTurns;
    assert.equal(base, 14, `${name}: 기본 턴이 ${base}다`);
    assert.ok(d.textTurns >= 5 && d.talkTurns >= 7, `${name}: 두 페이즈 다 충분해야 한다`);
    const max = base + EXTENSION.maxExtra.text + EXTENSION.maxExtra.talk;
    assert.equal(max, 19, `${name}: 연장 포함 최대가 ${max}다`);
  }
  // 연장 메카닉 자체는 그대로다 — 늘어난 턴 수가 연장을 대체한 게 아니다
  assert.equal(EXTENSION.maxExtra.text, 2);
  assert.equal(EXTENSION.maxExtra.talk, 3);
});

// 자리 길이는 이제 **모델이 정한다.** 예전엔 케미(최근 warm 개수 + 분위기)로 판단했는데
// 그건 "잘 굴러가면 더 한다"라서 잡담이 길어지는 쪽으로만 작동했다.
test('연장과 조기 종료는 심판의 keepGoing이 정한다', async () => {
  const S = await import('../js/scoring.js');
  // 명시적 true가 마지막이면 늘어난다
  assert.equal(S.extraTurn('talk', [true, true], 0), true);
  assert.equal(S.extraTurn('talk', [true, false], 0), false, '마지막이 false면 안 늘어난다');
  assert.equal(S.extraTurn('talk', [true], 0), false, '한 건만으로는 판단하지 않는다');
  assert.equal(S.extraTurn('talk', [true, true], 3), false, '연장 상한을 넘지 않는다');
  // 답이 없으면 아무것도 안 한다 — 없는 답 때문에 자리가 움직이면 사고다
  assert.equal(S.extraTurn('talk', [null, null, null], 0), false);
  assert.equal(S.cutShort('talk', [null, null, null]), false);
});

test('할 말이 떨어지면 자리를 접는다 — 문자가 더 빨리 끊긴다', async () => {
  const S = await import('../js/scoring.js');
  assert.equal(S.cutShort('text', [false, false]), true, '문자는 두 번이면 끊긴다');
  assert.equal(S.cutShort('talk', [false, false]), false, '대면은 두 번으로는 안 끊긴다');
  assert.equal(S.cutShort('talk', [false, false, false]), true, '대면은 세 번이면 끊긴다');
  assert.equal(S.cutShort('text', [false, true, false]), false, '중간에 살아났으면 안 끊긴다');
  assert.ok(S.EXTENSION.deadFor.text < S.EXTENSION.deadFor.talk,
    '문자가 대면보다 빨리 끊겨야 한다 — 답장이 끊기면서 끝나는 게 자연스럽다');
});

// ── 장벽은 이긴 판에도 사후 보고에 남는다 ──────────────────────
// 진 판에만 알려주면 플레이어는 그런 조건이 있다는 걸 지고 나서야 배운다.
test('사후 보고에 장벽 항목이 항상 있다', async () => {
  const S = await import('../js/scoring.js');
  const { COUPLE_BY_ID } = await import('../js/couples.js');
  const c = COUPLE_BY_ID['gapjil'];
  const d = S.diffOf(c.difficulty);
  for (const cleared of [true, false]) {
    const st = { ...S.initialState(d), barrierCleared: cleared, history: [], revealed: [] };
    const v = S.verdict(st, d);
    const db = S.debrief(st, d, v, c, '');
    const note = db.notes.find(n => n.key === 'barrier');
    assert.ok(note, '장벽 항목이 없다');
    assert.equal(note.ok, cleared);
    assert.ok(note.text.includes(c.barrier), '장벽 원문이 안 들어갔다');
  }
});

// ── 두근두근이 아니면 증가량이 0이다 ─────────────────────────
// 한동안 「관문 40」을 뒀다 — 대화만으로는 40에서 막히는 구조. 그건 우회로였다.
// 규칙을 직접 쓴다: nudge도 flat도 0점이고, 오르는 건 warm 이상뿐이다.
test('잘 굴러간 대화는 호감을 한 점도 못 올린다', async () => {
  const S = await import('../js/scoring.js');
  const d = S.diffOf('쉬움');
  let s = S.initialState(d);
  const start = s.love;
  for (let i = 0; i < 30; i++) {
    s = S.applyTurn(s, d, { tier: 'nudge', loveDelta: 2, moodDelta: 3, vibe: 'v', revealed: '' });
  }
  assert.ok(s.mood > 80, '테스트 전제: 분위기는 최고여야 한다');
  assert.ok(s.love <= start,
    `nudge를 30턴 쌓고 분위기가 최고여도 호감이 오르면 안 된다 (${start} → ${Math.round(s.love)})`);
});

test('호감을 올리는 건 warm 이상뿐이다', async () => {
  const S = await import('../js/scoring.js');
  const d = S.diffOf('쉬움');
  const base = S.initialState(d);
  for (const tier of ['flat', 'nudge']) {
    const r = S.applyTurn(base, d, { tier, loveDelta: 9, moodDelta: 4, vibe: 'v', revealed: '' });
    assert.ok(r.love <= base.love, `${tier}이 호감을 올렸다 — 심판이 뭘 뱉든 0이어야 한다`);
  }
  for (const tier of ['warm', 'breakthrough']) {
    const r = S.applyTurn(base, d, { tier, loveDelta: 5, moodDelta: 3, vibe: 'v', revealed: '' });
    assert.ok(r.love > base.love, `${tier}이 호감을 못 올렸다`);
    assert.ok(S.FLUTTER_TIERS.has(tier), `${tier}이 두근거린 등급 집합에 없다`);
  }
  assert.ok(!S.FLUTTER_TIERS.has('nudge'), 'nudge가 두근거린 등급에 들어가 있다');
});

test('관문 상수가 남아 있지 않다', async () => {
  const S = await import('../js/scoring.js');
  assert.equal(S.TUNING.likingCeiling, undefined, '관문 상수가 아직 살아 있다');
});

test('사이가 나쁘면 깎이고, 호감은 0에서 바닥을 친다', async () => {
  const S = await import('../js/scoring.js');
  const d = S.diffOf('헬');
  let s = S.initialState(d);
  for (let i = 0; i < 8; i++) {
    s = S.applyTurn(s, d, { tier: 'disaster', loveDelta: -9, moodDelta: -5, vibe: 'v', revealed: '' });
  }
  assert.equal(s.love, 0, '호감이 0 아래로 내려갔거나 안 깎였다');
});

test('평범하게 굴러가다 무미건조하게 끝나면 호감은 0 근처다', async () => {
  const S = await import('../js/scoring.js');
  for (const key of ['쉬움', '보통', '헬']) {
    const d = S.diffOf(key);
    let s = S.initialState(d);
    const turns = d.textTurns + d.talkTurns;
    for (let i = 0; i < turns; i++) {
      s = S.applyTurn(s, d, { tier: 'flat', loveDelta: 0, moodDelta: 1, vibe: 'v', revealed: '' });
    }
    assert.ok(s.love <= d.startLove,
      `${key}: 아무 일도 없었는데 호감이 올랐다 (${Math.round(s.love)} / 시작 ${d.startLove})`);
    assert.ok(s.love < d.threshold / 3, `${key}: 무미건조한 판이 성공선의 1/3을 넘었다`);
  }
});

// 두근거림을 다섯 종류로 가르고 종류마다 곡선을 달리 주는 구조를 한동안 뒀다.
// 이론 근거는 탄탄했지만 판정이 복잡해져서 걷어냈다 — 기준은 하나여야 한다.
test('두근거림 종류 구조가 남아 있지 않다', async () => {
  const S = await import('../js/scoring.js');
  assert.equal(S.FLUTTER_KINDS, undefined, '종류 표가 아직 export돼 있다');
  const d = S.diffOf('보통');
  const base = S.initialState(d);
  assert.equal(base.flutters, undefined, '종류별 집계가 상태에 남아 있다');
  // 종류를 뭘 넣든 결과가 같아야 한다 — 더 이상 안 본다
  const a = S.applyTurn(base, d, { tier: 'warm', loveDelta: 5, moodDelta: 3, vibe: 'v', revealed: '', flutterKind: '전환' });
  const b = S.applyTurn(base, d, { tier: 'warm', loveDelta: 5, moodDelta: 3, vibe: 'v', revealed: '' });
  assert.equal(a.love, b.love, '종류가 아직 점수를 바꾼다');
  assert.equal(a.history.at(-1).flutterKind, undefined, '종류가 아직 기록된다');
});

// ── 무전은 채점 대상이 아니다 ────────────────────────────────────
// 한동안 "무전 창" — 지시가 꽂힌 직후 두근거림만 제값 — 을 뒀다가 걷어냈다.
// 측정 하네스가 none 프로필에서 무전을 아예 안 쓰도록 박아둬서, 그 축이 잰 건
// 플레이 품질이 아니라 프로필 플래그였다(scoring.js의 「무전 창을 뺐다」 참조).
test('무전은 호감 계산에 손대지 않는다', async () => {
  const S = await import('../js/scoring.js');
  const d = S.diffOf('보통');
  const J = { tier: 'warm', loveDelta: 5, moodDelta: 3, vibe: 'v', revealed: '' };
  const withRadio = S.applyTurn(S.initialState(d), d, J, { radioInjected: true });
  const without = S.applyTurn(S.initialState(d), d, J, {});
  assert.equal(withRadio.lastDelta.love, without.lastDelta.love,
    '무전을 쳤다는 사실만으로 호감이 달라지면, 규칙이 대화가 아니라 버튼을 채점하는 것이다');
  assert.ok(!('inRadioWindow' in withRadio.history.at(-1)), '무전 창 잔재가 턴 기록에 남아 있다');
});

test('규칙 계층에 개선안 스위치가 남아 있지 않다', async () => {
  const S = await import('../js/scoring.js');
  assert.equal(S.VARIANT, undefined, 'A/B 스위치가 아직 export돼 있다');
  const src = await (await import('node:fs/promises')).readFile('js/scoring.js', 'utf8');
  assert.ok(!/BRS_VARIANT/.test(src), '환경변수 스위치가 코드에 남아 있다');
});

// ── 분위기는 성사를 막지 않는다 ──────────────────────────────────
// 실측: 호감 79/70·86/66인 판이 분위기 24/40·0/33으로 결렬됐다.
// 욕망에 충실하고 법도 어기는 두 사람이 밀어붙이면 방은 험악해지는데,
// 그중 상대 취향에 닿는 말이 있으면 호감은 오른다 — 싫어하면서 끌리는 상태다.
// 그게 이 게임이 재려던 것이므로 분위기가 그걸 막으면 안 된다.
test('분위기가 낮아도 호감이 넘으면 성사된다', async () => {
  const S = await import('../js/scoring.js');
  for (const key of ['쉬움', '보통', '헬']) {
    const d = S.diffOf(key);
    assert.equal(d.moodFloor, 0, `${key}: 분위기 하한이 아직 살아 있다`);
    const st = { ...S.initialState(d), love: d.threshold + 5, mood: 3 };
    const v = S.verdict(st, d);
    assert.ok(v.accepted, `${key}: 호감이 넘었는데 분위기 때문에 막혔다`);
  }
});

test('분위기는 여전히 두 가지 일을 한다 — 배율과 파탄', async () => {
  const S = await import('../js/scoring.js');
  // 배율: 험악한 방에서는 같은 판정이 덜 남는다 (다만 증폭은 없다)
  assert.ok(S.moodMultiplier(0) < S.moodMultiplier(60), '분위기 배율이 죽었다');
  assert.ok(S.moodMultiplier(100) <= 1, '분위기가 호감을 증폭한다');
  // 파탄: 0에 닿으면 자리가 깨진다
  const d = S.diffOf('보통');
  assert.ok(S.failureReason({ ...S.initialState(d), mood: 0 }), '분위기 0인데 파탄이 안 난다');
});

// 성공선은 실측에서 뽑았다. 판정 시퀀스를 고정하고 성공선만 움직여 갈리는 지점을 찾았다.
test('성공선이 실측 분포 위에 있다', async () => {
  const S = await import('../js/scoring.js');
  // 라이브 16판(하이쿠, 커플 8 × 프로필 2)의 판정 시퀀스를 재생해 맞춘 값이다.
  assert.equal(S.diffOf('쉬움').threshold, 66);
  assert.equal(S.diffOf('보통').threshold, 72);
  assert.equal(S.diffOf('헬').threshold, 78);
  // 난이도가 올라갈수록 성공선도 올라간다
  const th = ['쉬움', '보통', '헬'].map(k => S.diffOf(k).threshold);
  for (let i = 1; i < th.length; i++) assert.ok(th[i] > th[i - 1], '난이도 사다리가 깨졌다');
});

// 배율은 난이도 순서를 안 따른다. 소재 밀도가 그렇기 때문이다 —
// 보통 조합(gapjil·vtuber·os-war)은 판당 두근거림이 5.3회로 쉬움·헬의 절반이다.
// 이건 실수가 아니라 실측이라, 누가 "사다리가 뒤집혔다"며 되돌리지 못하게 못을 박아둔다.
test('보통의 배율이 가장 높다 — 그 조합들만 소재가 마르기 때문이다', async () => {
  const S = await import('../js/scoring.js');
  const g = k => S.diffOf(k).gainScale;
  assert.ok(g('보통') > g('쉬움') && g('보통') > g('헬'),
    '보통 배율을 내리면 그 난이도만 도달 불가능해진다 (실측 판당 두근 5.3회 대 10.2·10.3회)');
});
