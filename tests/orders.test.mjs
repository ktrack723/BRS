// node --test tests/orders.test.mjs — 하이어아키 감사.
//
// 구조도는 어느 데이터가 어느 프롬프트에 들어가는지를 못박아 놓은 그림이다.
// 한 칸이라도 새거나 빠지면 그건 구조도와 다른 게임이다. 필드마다 표식을 심어
// 네 프롬프트(A · B-1 · B-2 · C)에 그 표식이 나타나는지 전수로 확인한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../js/prompts.js';

const M = {
  clook: 'CLOOK표식', cpers: 'CPERS표식', cup: 'CUP표식', cfell: 'CFELL표식',
  tlook: 'TLOOK표식', tpers: 'TPERS표식', tup: 'TUP표식', ttaste: 'TTASTE표식',
  dlook: 'DLOOK표식', dpers: 'DPERS표식',
  coach: 'COACH표식', style: 'STYLE표식', motiv: 'MOTIV표식', radio: 'RADIO표식',
};

const couple = {
  id: 'probe', category: '감사',
  client: {
    name: '고객갑', gender: '여',
    look: [M.clook], personality: [M.cpers],
    upbringing: [`40세 · ${M.cup}`, `${M.cup}2`],
    fell: M.cfell,
    spec: { species: 'human' },
  },
  target: {
    name: '타겟을', gender: '남',
    look: [M.tlook], personality: [M.tpers],
    upbringing: [`41세 · ${M.tup}`, `${M.tup}2`],
    taste: [M.ttaste],
    spec: { species: 'human' },
  },
};
const dressed = { look: M.dlook, personality: M.dpers };
const orders = { styling: M.style, motivation: M.motiv };

// 네 프롬프트를 한 번씩 만들어 둔다. 이게 이 게임이 보내는 전부다.
const A = P.STYLING_SYSTEM + '\n' + P.stylingUser(couple, { species: 'human' }, orders);
const B1 = P.talkSystem(couple, dressed, M.coach) + '\n'
  + P.talkUser(couple, 'text', 1, 4) + '\n' + P.talkUser(couple, 'talk', 2, 5);
// 무전이 실린 판. 무전은 system이 아니라 이 user 메시지에만 실린다.
const B1R = P.talkUser(couple, 'talk', 3, 5, M.radio);
const B2 = P.judgeSystem(couple, dressed) + '\n' + P.judgeUser(couple, '이전대화', '이번대화');
const C = P.epilogueSystem(couple, dressed) + '\n' + P.epilogueUser(couple, 77, '대화전문표식');

const has = (hay, needle) => hay.includes(needle);

// ── A. 스타일링 / 동기부여 ───────────────────────────────
test('A는 유저의 두 주문과 고객의 테이블 외모·성격을 받는다', () => {
  for (const k of ['style', 'motiv', 'clook', 'cpers']) {
    assert.ok(has(A, M[k]), `A에 ${k}가 안 실렸다`);
  }
});

test('A는 타겟을 한 글자도 보지 않는다 — 시공은 고객 시트만 건드린다', () => {
  for (const k of ['tlook', 'tpers', 'tup', 'ttaste']) {
    assert.ok(!has(A, M[k]), `A에 타겟 ${k}가 새어 들어갔다`);
  }
  assert.ok(!has(A, M.coach), 'A에 코칭이 새어 들어갔다');
});

test('A의 출력은 수정된 외모와 성격 둘뿐이다 (+ 렌더링용 스펙)', () => {
  assert.deepEqual(Object.keys(P.STYLING_SCHEMA.properties).sort(), ['look', 'personality', 'spec']);
});

// ── B-1. 대화 생성 ───────────────────────────────────────
test('B-1은 타겟 네 항목을 전부 받는다', () => {
  for (const k of ['tlook', 'tpers', 'tup', 'ttaste']) {
    assert.ok(has(B1, M[k]), `B-1에 타겟 ${k}가 없다`);
  }
});

test('B-1의 고객 외모·성격은 **수정된 것**이다 — 테이블 원본이 아니다', () => {
  assert.ok(has(B1, M.dlook), 'B-1에 수정된 외모가 안 들어갔다');
  assert.ok(has(B1, M.dpers), 'B-1에 수정된 성격이 안 들어갔다');
  assert.ok(!has(B1, M.clook), 'B-1에 덮어써지기 전 외모가 남아 있다');
  assert.ok(!has(B1, M.cpers), 'B-1에 덮어써지기 전 성격이 남아 있다');
});

test('B-1은 고객 성장환경과 반한 이유를 받는다', () => {
  assert.ok(has(B1, M.cup));
  assert.ok(has(B1, M.cfell));
});

test('코칭은 B-1에만 실린다', () => {
  assert.ok(has(B1, M.coach), 'B-1에 코칭이 안 실렸다');
  assert.ok(!has(B2, M.coach), '코칭이 판정에 새어 들어갔다 — 요원이 쓴 글은 채점되지 않는다');
  assert.ok(!has(C, M.coach), '코칭이 후일담에 새어 들어갔다');
});

test('코칭이 비면 그 사실이 그대로 전달된다 — 조용히 채워 넣지 않는다', () => {
  const empty = P.talkSystem(couple, dressed, '');
  assert.ok(!has(empty, M.coach));
  assert.ok(/없음/.test(empty), '코칭 없음이 명시되지 않는다');
});

// ── B-2. 판정 ────────────────────────────────────────────
test('B-2는 타겟 네 항목과 **고객 외모(스타일링됨)** 만 받는다', () => {
  for (const k of ['tlook', 'tpers', 'tup', 'ttaste']) {
    assert.ok(has(B2, M[k]), `B-2에 타겟 ${k}가 없다`);
  }
  assert.ok(has(B2, M.dlook), 'B-2에 고객 외모가 없다 — 타겟이 보고 있는 것이다');
});

test('B-2는 고객 성격·성장환경·반한 이유를 보지 않는다', () => {
  for (const k of ['dpers', 'cpers', 'cup', 'cfell']) {
    assert.ok(!has(B2, M[k]), `B-2에 ${k}가 새어 들어갔다`);
  }
});

test('B-2에는 대화가 들어간다', () => {
  assert.ok(has(B2, '이번대화'));
  assert.ok(has(B2, '이전대화'));
});

// ── C. 후일담 ────────────────────────────────────────────
test('C는 러브 포인트 · 대화 · 고객 성격(동기부여됨) · 타겟 성격, 넷만 받는다', () => {
  assert.ok(has(C, '77'), 'C에 러브 포인트가 없다');
  assert.ok(has(C, '대화전문표식'), 'C에 대화가 없다');
  assert.ok(has(C, M.dpers), 'C에 동기부여된 고객 성격이 없다');
  assert.ok(has(C, M.tpers), 'C에 타겟 성격이 없다');
});

test('C는 외모도 취향도 성장환경도 보지 않는다', () => {
  for (const k of ['dlook', 'clook', 'tlook', 'ttaste', 'tup', 'cup', 'cfell']) {
    assert.ok(!has(C, M[k]), `C에 ${k}가 새어 들어갔다`);
  }
});

test('러브 포인트는 C에만 간다 — 대화하는 쪽도 심판도 점수를 모른다', () => {
  assert.ok(!/러브 포인트/.test(B1), 'B-1이 러브 포인트를 안다');
  assert.ok(!/\b77\b/.test(B1), 'B-1에 점수가 새어 들어갔다');
});

// ── 폐지된 축이 프롬프트로 되살아나지 않았는가 ──────────
test('폐지된 시스템 용어가 프롬프트에 없다', () => {
  const all = A + B1 + B2 + C + P.WORLD;
  const DEAD = [
    '지뢰', '강압', '어긋남', '공기 읽기', '미공개', '성공선', '난이도',
    'leverage', 'walkout', 'casualty', 'breakthrough', 'carryMax', 'loveDelta', 'keepGoing',
    'firstImpression', 'outfitDesc',
  ];
  for (const w of DEAD) {
    assert.ok(!all.includes(w), `폐지된 「${w}」가 프롬프트에 남아 있다`);
  }
});

// ── B-1. 무전 — 대화 도중의 개입 ─────────────────────────
// 코칭과 같은 자리(고객의 귀)로 가되, 자리가 굴러가는 도중에 꽂힌다.
// 규칙 ①이 무전에도 그대로 걸린다 — 요원이 쓴 글은 채점되지 않는다.
test('무전은 B-1의 user 메시지에만 실린다 — system도 판정도 후일담도 못 본다', () => {
  assert.ok(has(B1R, M.radio), '무전이 생성 프롬프트에 안 실렸다');
  const sys = P.talkSystem(couple, dressed, M.coach);
  assert.ok(!has(sys, M.radio), '무전이 system으로 새어 들어갔다 — 캐시가 깨진다');
  assert.ok(!has(B2, M.radio), '무전이 판정에 새어 들어갔다 — 요원이 쓴 글은 채점되지 않는다');
  assert.ok(!has(C, M.radio), '무전이 후일담에 새어 들어갔다');
  assert.ok(!has(A, M.radio), '무전이 시공에 새어 들어갔다');
});

test('무전이 없으면 그 자리에 아무것도 안 붙는다', () => {
  assert.equal(P.talkUser(couple, 'talk', 3, 5), P.talkUser(couple, 'talk', 3, 5, ''));
  assert.equal(P.talkUser(couple, 'talk', 3, 5), P.talkUser(couple, 'talk', 3, 5, '   '));
  assert.ok(!has(B1, '본부 무전'), '무전을 안 때렸는데 무전 블록이 붙었다');
});

test('무전은 조언이 아니라 반드시 이행되는 명령이다', () => {
  const block = P.radioOrder(M.radio);
  assert.ok(/Not advice, not a suggestion, not an option/.test(block), '무전이 명령으로 안 박힌다');
  assert.ok(/starting with their very next line/.test(block), '언제 이행하는지가 안 박혔다');
  assert.ok(/Refusing, ignoring, postponing, or watering it down is not available/.test(block),
    '고객에게 거부·보류·희석의 여지가 열려 있다');
});

test('무전도 코칭과 같은 자리로 간다 — 타겟은 못 듣는다', () => {
  const block = P.radioOrder(M.radio);
  assert.ok(/고객의 이어폰/.test(block), '무전이 고객에게 간다는 말이 없다');
  assert.ok(/타겟 heard nothing/.test(block), '타겟이 못 듣는다는 못이 빠졌다');
});

test('무전은 점수를 모른다 — 게이지도 판정도 실리지 않는다', () => {
  const block = P.radioOrder(M.radio);
  assert.ok(!/러브 포인트|무드 포인트|love point|mood point/i.test(block));
});

test('보내는 스키마는 넷뿐이다', () => {
  const schemas = Object.keys(P).filter(k => k.endsWith('_SCHEMA'));
  assert.deepEqual(schemas.sort(), ['EPILOGUE_SCHEMA', 'JUDGE_SCHEMA', 'STYLING_SCHEMA', 'TALK_SCHEMA']);
});
