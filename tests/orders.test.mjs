// orders.test.mjs — 요원이 내리는 지시가 실제로 어디까지 가는가.
//
// 이 게임에서 플레이어가 손댈 수 있는 건 네 가지뿐이다:
//   착장(styling) · 대화 지침(coaching) · 출동 연설(speech) · 무전(radio).
// 넷 다 "채점되지 않는다". 효과는 오직 의뢰인이 실제로 어떻게 말하느냐로만 드러난다.
// 그러니 **지시가 프롬프트에 실리지 않으면 그 입력은 게임에 존재하지 않는 것과 같다.**
//
// 여기서는 가짜 LLM을 물려 판을 통째로 돌리고, 지시마다 심어둔 표식이
// 어느 호출의 system/messages에 나타났는지 전수로 확인한다.
// 도착해야 할 곳만 보는 게 아니라 **도착하면 안 되는 곳**도 같이 본다 —
// 상대가 무전을 듣거나 나레이터가 무전을 읽으면 게임의 전제가 깨진다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/engine.js';
import { COUPLE_BY_ID } from '../js/couples.js';
import * as P from '../js/prompts.js';

const MARK = {
  outfit: '표식착장ZQX',
  coaching: '표식지침ZQX',
  speech: '표식연설ZQX',
  radio1: '표식무전일ZQX',
  radio2: '표식무전이ZQX',
  radio3: '표식무전삼ZQX',
  radio4: '표식무전사ZQX',   // 규격을 넘는다 — 절대 나가면 안 된다
  radio5: '표식무전오ZQX',
};

// 판정·상황·결과는 구조화 출력이라 스키마에 맞는 객체를 돌려줘야 엔진이 안 죽는다.
function fakeReply(schema) {
  if (!schema) return '대충 한 마디.';
  const props = schema.properties || {};
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    if (k === 'tier') out[k] = 'nudge';
    else if (k === 'casualty') out[k] = 'none';
    else if (k === 'leverage') out[k] = 'none';
    else if (k === 'clientEmote' || k === 'targetEmote') out[k] = 'neutral';
    else if (v.type === 'integer' || v.type === 'number') out[k] = 1;
    else if (v.type === 'boolean') out[k] = false;
    else if (v.type === 'array') out[k] = [];
    else if (v.type === 'object') out[k] = {};
    else out[k] = '값';
  }
  return JSON.stringify(out);
}

// 판 하나를 통째로 돌리면서 모든 호출을 기록한다.
async function runRecorded({ prep, radios = [] }) {
  const calls = [];
  const llm = {
    async call({ label, system, messages, schema }) {
      calls.push({ label, system: system || '', body: JSON.stringify(messages || []) });
      return fakeReply(schema);
    },
  };
  const couple = COUPLE_BY_ID['gapjil'];
  let fired = 0;
  const engine = new Engine(llm, {
    couple, prep, agent: { name: '박큐피드', gender: '기밀' },
    handlers: {
      turn() { if (fired < radios.length) { if (engine.submitRadio(radios[fired])) fired++; } },
    },
  });
  // engine에는 run()이 없다 — 화면이 페이즈를 몰아준다. 여기서도 같은 순서로 몬다.
  await engine.runTexting();
  const sit = await engine.situation();
  await engine.runTalking(sit);
  await engine.finish();
  return { calls, engine };
}

// label로 호출을 고른다. 라벨은 '문자 발언 3' 같은 식이라 앞부분으로 무리를 잡는다.
const pick = (calls, re) => calls.filter(c => re.test(c.label));
const anySys = (list, mark) => list.some(c => c.system.includes(mark));
const anyBody = (list, mark) => list.some(c => c.body.includes(mark));
const anyWhere = (list, mark) => list.some(c => c.system.includes(mark) || c.body.includes(mark));

let RUN = null;
async function runOnce() {
  if (!RUN) {
    RUN = await runRecorded({
      prep: { outfitDesc: MARK.outfit, coaching: MARK.coaching, speech: MARK.speech },
      radios: [MARK.radio1, MARK.radio2, MARK.radio3, MARK.radio4, MARK.radio5],
    });
  }
  return RUN;
}

// ── 착장 ────────────────────────────────────────────────────────
test('착장은 의뢰인·상대·첫인상 판정까지 간다', async () => {
  const { calls } = await runOnce();
  assert.ok(anySys(pick(calls, /발언/), MARK.outfit), '의뢰인이 자기 차림을 모른다');
  assert.ok(anySys(pick(calls, /^대면 응답/), MARK.outfit), '대면에서 상대가 차림을 못 본다');
  assert.ok(anyWhere(pick(calls, /첫인상/), MARK.outfit), '첫인상 판정에 차림이 안 실렸다');
  assert.ok(anyWhere(pick(calls, /상황|장면/), MARK.outfit), '나레이터가 차림을 모른다');
});

test('문자 단계에서는 상대가 차림을 볼 수 없다', async () => {
  const { calls } = await runOnce();
  // 문자로 대화하는 중에 상대가 옷차림을 아는 건 정보 누수다.
  assert.ok(!anySys(pick(calls, /^문자 응답/), MARK.outfit), '문자에서 옷차림이 새어나갔다');
});

// ── 대화 지침 · 연설 ────────────────────────────────────────────
test('대화 지침과 연설은 의뢰인에게만 간다', async () => {
  const { calls } = await runOnce();
  assert.ok(anySys(pick(calls, /발언/), MARK.coaching), '지침이 의뢰인에게 안 갔다');
  assert.ok(anySys(pick(calls, /발언/), MARK.speech), '연설이 의뢰인에게 안 갔다');
  for (const m of [MARK.coaching, MARK.speech]) {
    assert.ok(!anyWhere(pick(calls, /응답/), m), `상대가 요원의 지시를 읽었다 (${m})`);
    assert.ok(!anyWhere(pick(calls, /판정|첫인상/), m), `심판이 준비물을 채점 자리에서 봤다 (${m})`);
    assert.ok(!anyWhere(pick(calls, /상황|장면/), m), `나레이터가 요원의 지시를 읽었다 (${m})`);
  }
});

// ── 무전 ────────────────────────────────────────────────────────
test('무전은 의뢰인의 다음 발언에만 꽂히고 상대에게는 안 들린다', async () => {
  const { calls } = await runOnce();
  assert.ok(anyBody(pick(calls, /발언/), MARK.radio1), '무전이 의뢰인에게 안 꽂혔다');
  assert.ok(anyBody(pick(calls, /발언/), MARK.radio2), '두 번째 무전이 안 꽂혔다');
  for (const m of [MARK.radio1, MARK.radio2]) {
    assert.ok(!anyWhere(pick(calls, /응답/), m), `상대가 무전을 들었다 (${m})`);
    assert.ok(!anyWhere(pick(calls, /상황|장면/), m), `나레이터가 무전을 읽었다 (${m})`);
  }
});

test('무전은 거부할 수 없는 명령으로 꽂힌다', async () => {
  const { calls } = await runOnce();
  const hit = pick(calls, /발언/).find(c => c.body.includes(MARK.radio1));
  assert.ok(hit, '무전이 실린 호출이 없다');
  assert.match(hit.body, /Refusal is not available/, '무전이 제안으로 들어갔다');
  assert.match(hit.body, /The other person cannot hear it/, '안 들린다는 사실이 안 박혔다');
});

test('무전 횟수는 난이도 규격을 넘지 못한다', async () => {
  // 기획서 규정: 문자 1회 + 대면 2회 = 판당 3회. 다섯 번 눌러도 셋만 나간다.
  const { calls, engine } = await runOnce();
  assert.equal(engine.state.radioUsed, 3, '무전 소비 집계가 어긋났다');
  for (const m of [MARK.radio4, MARK.radio5]) {
    assert.ok(!anyWhere(calls, m), `규격을 넘은 무전이 나갔다 (${m})`);
  }
  assert.equal(engine.submitRadio('남은 게 없는데 또 보냈다'), false, '무전이 무한이다');
});

// ── 아무것도 안 넣었을 때 ───────────────────────────────────────
test('빈 지시는 빈 채로 전달된다 — 조용히 채워 넣지 않는다', async () => {
  const c = COUPLE_BY_ID['gapjil'];
  const sys = P.clientAgentSystem(c, { outfitDesc: '', coaching: '', speech: '' }, 'talk', { name: '박큐피드' });
  assert.match(sys, /\[ORDERS FROM HEADQUARTERS\] None/, '지시 없음이 표시되지 않는다');
  assert.match(sys, /There is no plan in your head/, '준비 없이 나간 상태가 전달되지 않는다');
  assert.match(sys, /shoved out the door in silence/, '연설 없음이 표시되지 않는다');
});

test('지침이 있으면 이행 강제가 같이 붙는다', async () => {
  const c = COUPLE_BY_ID['gapjil'];
  const sys = P.clientAgentSystem(c, { outfitDesc: '', coaching: MARK.coaching, speech: '' }, 'talk', { name: '박큐피드' });
  assert.ok(sys.includes(MARK.coaching));
  assert.match(sys, /It is an order/, '지침이 조언으로 들어갔다');
  assert.match(sys, /Where the orders say nothing, you act on your own judgement/, '지침 밖 재량이 없다');
});

// ── 이행 결이 인물마다 다른가 ───────────────────────────────────
test('같은 지침도 인물의 이행 결에 따라 다르게 실린다', async () => {
  const seen = new Set();
  for (const id of Object.keys(COUPLE_BY_ID)) {
    const c = COUPLE_BY_ID[id];
    const sys = P.clientAgentSystem(c, { outfitDesc: '', coaching: MARK.coaching, speech: '' }, 'talk', { name: '박큐피드' });
    const line = sys.split('\n').find(l => l.startsWith('This is not advice'));
    seen.add(line);
  }
  assert.ok(seen.size >= 3, `이행 결이 ${seen.size}종뿐이다 — obeys/argues/drifts가 같은 말로 들어가고 있다`);
});

// ── 착장 지시 원문이 가위손에게 그대로 가는가 ───────────────────
// 미용실 호출은 engine이 아니라 화면(game.js)이 건다. 그 경로는 여기서 따로 본다.
test('착장 지시는 심사 없이 가위손에게 원문 그대로 간다', async () => {
  const c = COUPLE_BY_ID['gapjil'];
  const wild = '베수비오 화산 방열복, 목에 생닭, 형광 초록 정장';
  const u = P.stylingUser(c, c.client.spec, wild, { name: '박큐피드', gender: '기밀' });
  assert.ok(u.includes(wild), '요원의 착장 지시가 잘려서 갔다');
  // 가위손은 심사도 거절도 하지 않는다 — 이상한 지시일수록 그대로 만들어야 자유도가 산다
  assert.match(P.STYLING_SYSTEM, /You are not a judge/, '가위손이 심사관이 됐다');
  assert.match(P.STYLING_SYSTEM, /There is nothing you cannot build/, '가위손이 못 만든다고 할 수 있다');
  assert.match(P.STYLING_SYSTEM, /Never say it is unavailable/, '거절 금지가 없다');
});

test('무전 원문도 잘리지 않는다', async () => {
  const { calls } = await runOnce();
  const hit = pick(calls, /발언/).find(c => c.body.includes(MARK.radio1));
  const body = JSON.parse(hit.body);
  const line = body.map(m => String(m.content)).find(t => t.includes(MARK.radio1));
  assert.ok(line.includes(MARK.radio1), '무전이 잘렸다');
});

// ── 반대 방향: 게임이 요원에게 알려주는 것 ──────────────────────
// 지시가 잘 가는 것만큼 중요한 게, 무엇을 지시해야 하는지를 요원이 아는가다.
// 장벽은 지금 이 게임에서 판을 제일 자주 끝내는 조건인데 여태 의뢰서 모달 안에만 있었다.
test('계기판이 매 턴 장벽 상태를 들고 있다', async () => {
  const { engine } = await runOnce();
  const snap = engine.snapshot();
  assert.equal(snap.barrier, COUPLE_BY_ID['gapjil'].barrier, '계기판에 장벽 원문이 없다');
  assert.equal(typeof snap.barrierCleared, 'boolean', '처리 여부가 계기판에 안 나간다');
});

test('44건 전부 계기판에 띄울 장벽을 갖고 있다', () => {
  for (const [id, c] of Object.entries(COUPLE_BY_ID)) {
    assert.ok(c.barrier && c.barrier.length >= 10, `${id}: 장벽이 비었거나 너무 짧다`);
  }
});

// ── 지침이 물릴 자리가 있는가 ────────────────────────────────────
// 사회성 결여를 기본 전제로 깔았더니 숙련 요원의 지침도 같이 죽었다 (실측 ace 0/3).
// 아무것도 못하는 사람에게 지시를 줘도 아무것도 안 되면 준비 단계가 사문화된다.
// 지침은 이 사람이 유일하게 붙잡을 수 있는 것이어야 한다.
test('지침은 이 사람이 유일하게 즉흥이 아닌 부분이다', async () => {
  const c = COUPLE_BY_ID['gapjil'];
  const withOrders = P.clientAgentSystem(c, { outfitDesc: '', coaching: '이렇게 해라', speech: '' }, 'talk', { name: '요원' });
  assert.match(withOrders, /the only part of tonight you are not making up/, '지침이 물릴 자리가 없다');
  assert.match(withOrders, /you fall back on them, out loud, clumsily/, '지침을 어떻게 쓰는지가 없다');
  assert.match(withOrders, /Everywhere the orders run out, you are back to being yourself/,
    '지침이 안 닿는 데서 원래대로 돌아간다는 게 없다');
  // 지침이 없으면 그 안전망 자체가 없어야 한다
  const without = P.clientAgentSystem(c, { outfitDesc: '', coaching: '', speech: '' }, 'talk', { name: '요원' });
  assert.ok(!/the only part of tonight you are not making up/.test(without),
    '지침이 없는데 지침 안전망 문구가 남아 있다');
});

test('나레이터도 상대가 뭘 들고 앉는지 안다', () => {
  // 대면 첫 장면이 판의 나머지 톤을 정한다. 여기서 두 사람이 화기애애하게 시작하면
  // 그 뒤 여덟 턴이 전부 그 톤을 이어받는다.
  for (const c of Object.values(COUPLE_BY_ID).slice(0, 6)) {
    const sys = P.situationSystem(c);
    assert.ok(sys.includes(c.target.regard), `${c.id}: 나레이터가 상대의 원한을 모른다`);
    assert.match(sys, /They did not ask for this meeting/, `${c.id}: 자리에 오고 싶지 않았다는 게 없다`);
  }
});
