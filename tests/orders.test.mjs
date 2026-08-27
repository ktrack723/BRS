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
  coach: 'COACH표식', style: 'STYLE표식', motiv: 'MOTIV표식',
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
const A1 = P.STYLING_SYSTEM + '\n' + P.stylingUser(couple, { species: 'human' }, M.style);
const A2 = P.MOTIVATION_SYSTEM + '\n' + P.motivationUser(couple, M.motiv);
const A = A1 + '\n' + A2;
const B1 = P.talkSystem(couple, dressed, M.coach) + '\n'
  + P.talkUser(couple, 'text', 1, 4) + '\n' + P.talkUser(couple, 'talk', 2, 5);
const B2 = P.judgeSystem(couple, dressed) + '\n' + P.judgeUser(couple, '이전대화', '이번대화');
const C = P.epilogueSystem(couple, dressed) + '\n' + P.epilogueUser(couple, 77, '대화전문표식');
// R은 구조도 밖이다. 주문 하나와 고객 테이블 시트만 받고, 출력은 어디로도 안 간다.
const R = Object.keys(P.REACT_ROOMS).map(k =>
  P.reactSystem(couple, k) + '\n' + P.reactUser(k, M.coach)).join('\n');

const has = (hay, needle) => hay.includes(needle);

// ── A. 스타일링 / 동기부여 — 한 상자, 두 호출 ────────────
test('A-1 미용실은 스타일링 주문과 테이블 외모를 받는다', () => {
  assert.ok(has(A1, M.style), 'A-1에 스타일링 주문이 안 실렸다');
  assert.ok(has(A1, M.clook), 'A-1에 테이블 외모가 안 실렸다');
});

test('A-1은 성격을 보지 않는다 — 미용실은 사람을 안 고친다', () => {
  assert.ok(!has(A1, M.cpers), 'A-1에 고객 성격이 새어 들어갔다');
  assert.ok(!has(A1, M.motiv), 'A-1에 동기부여 주문이 새어 들어갔다');
});

test('A-2 취조실은 동기부여 주문과 테이블 성격을 받는다', () => {
  assert.ok(has(A2, M.motiv), 'A-2에 동기부여 주문이 안 실렸다');
  assert.ok(has(A2, M.cpers), 'A-2에 테이블 성격이 안 실렸다');
});

test('A-2는 외모를 보지 않는다 — 취조실은 옷을 안 고친다', () => {
  assert.ok(!has(A2, M.clook), 'A-2에 고객 외모가 새어 들어갔다');
  assert.ok(!has(A2, M.style), 'A-2에 스타일링 주문이 새어 들어갔다');
  assert.ok(!/AVATAR SPEC/.test(A2), 'A-2에 조형 스펙이 새어 들어갔다');
});

test('A는 어느 쪽도 타겟을 한 글자도 보지 않는다', () => {
  for (const k of ['tlook', 'tpers', 'tup', 'ttaste']) {
    assert.ok(!has(A, M[k]), `A에 타겟 ${k}가 새어 들어갔다`);
  }
  assert.ok(!has(A, M.coach), 'A에 코칭이 새어 들어갔다');
});

test('A의 출력은 칸마다 하나씩이다 — 외모(+조형) / 성격', () => {
  assert.deepEqual(Object.keys(P.STYLING_SCHEMA.properties).sort(), ['look', 'spec']);
  assert.deepEqual(Object.keys(P.MOTIVATION_SCHEMA.properties).sort(), ['personality']);
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
  assert.ok(/\(none — nobody briefed the client/.test(empty), '코칭 없음이 명시되지 않는다');
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
  // 라벨을 영어로 옮겼으므로 두 표기를 다 막는다. 한쪽만 보면 통과가 공허해진다.
  const POINTS_WORD = /러브 포인트|무드 포인트|\bLOVE\b|\bMOOD\b/;
  assert.ok(!POINTS_WORD.test(B1), 'B-1이 점수 축을 안다');
  assert.ok(!/\b77\b/.test(B1), 'B-1에 점수가 새어 들어갔다');
  assert.ok(POINTS_WORD.test(B2), 'B-2가 판정할 축의 이름을 모른다');
  assert.ok(!/\b77\b/.test(B2), '심판에 점수 값이 새어 들어갔다');
});

// ── 폐지된 축이 프롬프트로 되살아나지 않았는가 ──────────
test('폐지된 시스템 용어가 프롬프트에 없다', () => {
  const all = A + B1 + B2 + C + P.WORLD;
  const DEAD = [
    '지뢰', '무전', '강압', '어긋남', '공기 읽기', '미공개', '성공선', '난이도',
    'leverage', 'walkout', 'casualty', 'breakthrough', 'carryMax', 'loveDelta', 'keepGoing',
    'firstImpression', 'outfitDesc',
  ];
  for (const w of DEAD) {
    assert.ok(!all.includes(w), `폐지된 「${w}」가 프롬프트에 남아 있다`);
  }
});

test('보내는 스키마는 하이어아키 넷 + 반응 하나뿐이다', () => {
  const schemas = Object.keys(P).filter(k => k.endsWith('_SCHEMA'));
  assert.deepEqual(schemas.sort(),
    ['EPILOGUE_SCHEMA', 'JUDGE_SCHEMA', 'MOTIVATION_SCHEMA', 'REACT_SCHEMA', 'STYLING_SCHEMA', 'TALK_SCHEMA']);
});

// ── R. 준비 단계 반응 — 구조도 밖이므로 아무것도 물어오면 안 된다 ──
test('R은 방 셋뿐이다 — 스타일링 · 동기부여 · 코칭', () => {
  assert.deepEqual(Object.keys(P.REACT_ROOMS).sort(), ['coaching', 'motivation', 'styling']);
});

test('R은 고객의 **테이블** 시트만 받는다 — 시공된 시트가 아니다', () => {
  for (const k of ['clook', 'cpers', 'cup']) {
    assert.ok(has(R, M[k]), `R에 고객 ${k}가 없다`);
  }
  assert.ok(!has(R, M.dlook), 'R에 시공된 외모가 새어 들어갔다 — 반응은 시공 전에 나온다');
  assert.ok(!has(R, M.dpers), 'R에 동기부여된 성격이 새어 들어갔다');
});

test('R은 타겟을 한 글자도 보지 않는다', () => {
  for (const k of ['tlook', 'tpers', 'tup', 'ttaste']) {
    assert.ok(!has(R, M[k]), `R에 타겟 ${k}가 새어 들어갔다`);
  }
});

test('R의 출력은 대사와 표정 둘뿐이다 — 점수도 판정도 없다', () => {
  assert.deepEqual(Object.keys(P.REACT_SCHEMA.properties).sort(), ['face', 'reaction']);
});

test('R은 방마다 주문을 하나씩만 본다', () => {
  const only = P.reactSystem(couple, 'styling') + '\n' + P.reactUser('styling', M.style);
  assert.ok(has(only, M.style), 'R에 스타일링 주문이 안 실렸다');
  assert.ok(!has(only, M.motiv), 'R에 다른 방의 주문이 새어 들어갔다');
  assert.ok(!has(only, M.coach), 'R에 코칭이 새어 들어갔다');
});

// ── 지시는 영어다 ──────────────────────────────────────
// 데이터가 전부 ASCII인 인물로 프롬프트를 만들면, 남는 한글은 전부 **지시문**이다.
test('다섯 프롬프트의 지시문에 한글이 한 글자도 없다', () => {
  const ascii = {
    id: 'ascii', category: 'audit',
    client: {
      name: 'Kay', gender: 'F', look: ['tall'], personality: ['loud'],
      upbringing: ['40 / clerk', 'grew up in a mall'], fell: 'the hat',
      spec: { species: 'human' },
    },
    target: {
      name: 'Ro', gender: 'M', look: ['thin'], personality: ['dry'],
      upbringing: ['41 / welder', 'raised by a crane'], taste: ['rust'],
      spec: { species: 'human' },
    },
  };
  const d = { look: 'a red suit', personality: 'a coward' };
  const built = {
    'A-1': P.STYLING_SYSTEM + P.stylingUser(ascii, { species: 'human' }, 'x'),
    'A-2': P.MOTIVATION_SYSTEM + P.motivationUser(ascii, 'y'),
    'A-1(주문없음)': P.stylingUser(ascii, { species: 'human' }, ''),
    'A-2(주문없음)': P.motivationUser(ascii, ''),
    'B-1': P.talkSystem(ascii, d, 'z') + P.talkUser(ascii, 'text', 1, 4) + P.talkUser(ascii, 'talk', 2, 5),
    'B-1(코칭없음)': P.talkSystem(ascii, d, ''),
    'B-2': P.judgeSystem(ascii, d) + P.judgeUser(ascii, '', 'seg'),
    C: P.epilogueSystem(ascii, d) + P.epilogueUser(ascii, 77, 'log'),
    R: Object.keys(P.REACT_ROOMS).map(k => P.reactSystem(ascii, k) + P.reactUser(k, 'q')).join(''),
  };
  for (const [name, text] of Object.entries(built)) {
    // 한글 전 영역 — 조합 자모 · 호환 자모 · 확장 A · 음절 · 반각까지 전부 본다.
    const HANGUL = /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7ff\uffa0-\uffdc]/g;
    const han = [...new Set(text.match(HANGUL) || [])];
    assert.deepEqual(han, [], `${name} 지시문에 한글이 남아 있다: ${han.join('')}`);
  }
});

test('그래도 출력 언어 고정은 다섯 블록 전부에 붙어 있다', () => {
  const KO = /Output is Korean|output in Korean/;
  for (const t of [A, B1, B2, C, R]) assert.ok(KO.test(t), '출력 언어 고정이 빠진 블록이 있다');
});
