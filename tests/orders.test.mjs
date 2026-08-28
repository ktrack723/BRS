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
  coach: 'COACH표식', style: 'STYLE표식', motiv: 'MOTIV표식', radio: 'RADIO표식', field: 'FIELD표식',
};

const couple = {
  id: 'probe', category: '감사',
  client: {
    name: '고객갑', gender: '여',
    look: [M.clook], personality: [M.cpers],
    upbringing: [`40세 · ${M.cup}`, `${M.cup}2`],
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
// B-1은 배우 둘이다. 각자 제 회선만 본다 — 이 두 문자열이 서로 섞이면 그게 사고다.
const B1C = P.clientSystem(couple, dressed, M.coach) + '\n'
  + P.sceneOpen(couple, dressed, 'text', 'client') + '\n'
  + P.actorUser(couple, { side: 'client', scene: P.sceneOpen(couple, dressed, 'talk', 'client'), first: true });
const B1T = P.targetSystem(couple) + '\n'
  + P.sceneOpen(couple, dressed, 'text', 'target') + '\n'
  + P.actorUser(couple, { side: 'target', scene: P.sceneOpen(couple, dressed, 'talk', 'target'), first: true });
const B1 = B1C + '\n' + B1T;
// 무전이 실린 판. 무전은 system이 아니라 고객 회선의 user 메시지에만 실린다.
const B1R = P.actorUser(couple, { side: 'client', radio: M.radio, heard: [{ who: 'target', text: 'x' }] });
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

test('B-1은 고객 성장환경은 받고, 반한 이유는 폐지돼 어디에도 없다', () => {
  assert.ok(has(B1, M.cup));
  for (const built of [A1, A2, B1, B2, C]) {
    assert.ok(!built.includes(M.cfell), '폐지된 반한 이유가 프롬프트에 되살아났다');
  }
});

test('코칭은 B-1에만 실린다', () => {
  assert.ok(has(B1, M.coach), 'B-1에 코칭이 안 실렸다');
  assert.ok(!has(B2, M.coach), '코칭이 판정에 새어 들어갔다 — 요원이 쓴 글은 채점되지 않는다');
  assert.ok(!has(C, M.coach), '코칭이 후일담에 새어 들어갔다');
});

test('코칭이 비면 그 사실이 그대로 전달된다 — 조용히 채워 넣지 않는다', () => {
  const empty = P.clientSystem(couple, dressed, '');
  assert.ok(!has(empty, M.coach));
  assert.ok(/\(none — nobody briefed you/.test(empty), '코칭 없음이 명시되지 않는다');
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
  const POINTS_WORD = /러브 포인트|무드 포인트|\blove\b|\bmood\b|love[- ]point|mood[- ]point/i;
  assert.ok(!POINTS_WORD.test(B1), 'B-1이 점수 축을 안다');
  assert.ok(!/\b77\b/.test(B1), 'B-1에 점수가 새어 들어갔다');
  assert.ok(POINTS_WORD.test(B2), 'B-2가 판정할 축의 이름을 모른다');
  assert.ok(!/\b77\b/.test(B2), '심판에 점수 값이 새어 들어갔다');
});

// ── 간직 항목: 시트가 감춰뒀다고 말하는 취향은 따로 갈라 싣는다 ──
test('표지 있는 취향은 「간직」 줄로 가고 Taste 줄에서는 빠진다', async () => {
  const { COUPLE_BY_ID } = await import('../js/couples.js');
  const d = { look: 'x', personality: 'y' };
  const cases = [
    ['os-war', 'WSL'],
    ['vtuber', '3년 전에 알아챘다'],
    ['sauce-war', '혼자 먹을 땐 부어 먹는다'],
  ];
  for (const [id, secret] of cases) {
    const sheet = P.targetSystem(COUPLE_BY_ID[id]);
    const tasteLine = sheet.match(/· Taste: [^\n]*/)[0];
    const keptLine = (sheet.match(/· Keeps to themselves[^\n]*/) || [''])[0];
    assert.ok(keptLine.includes(secret), `${id}의 비밀이 간직 줄에 없다`);
    assert.ok(!tasteLine.includes(secret), `${id}의 비밀이 Taste 줄에 그대로 있다`);
  }
  // 표지 없는 합성 커플은 간직 줄 자체가 안 생긴다
  // 지시문은 라벨을 항상 언급하므로 시트 줄(· 접두) 형태로만 본다
  assert.ok(!/· Keeps to themselves/.test(P.targetSystem(couple)),
    '표지가 없는데 간직 줄이 생겼다');
});

test('심판은 간직/공개 구분을 못 받는다 — 차이는 대화 생성 안에서만 존재한다', async () => {
  const { COUPLE_BY_ID } = await import('../js/couples.js');
  const c = COUPLE_BY_ID['os-war'];
  const j = P.judgeSystem(c, { look: 'x', personality: 'y' });
  assert.ok(!/· Keeps to themselves/.test(j), '심판 시트에 간직 줄이 생겼다 — 비밀 보너스 채널이다');
  const tasteLine = j.match(/· Taste: [^\n]*/)[0];
  assert.ok(tasteLine.includes('WSL'), '심판의 Taste 줄에 비밀 항목이 빠졌다 — 심판은 전부 평평하게 본다');
});

test('간직 항목도 어디까지나 재배치다 — 항목이 사라지지는 않는다', async () => {
  const { COUPLES } = await import('../js/couples.js');
  const d = { look: 'x', personality: 'y' };
  for (const c of COUPLES) {
    const sheet = P.targetSystem(c);
    for (const item of c.target.taste) {
      assert.ok(sheet.includes(item), `${c.id}의 취향 「${item.slice(0, 20)}…」이 시트에서 사라졌다`);
    }
  }
});

// ── 현장 무전: 물리 지원 — 그대로 실행되고, 심판은 못 본다 ──
test('현장 무전은 B-1의 user 메시지에만 실린다 — 그리고 양쪽 회선에 다 실린다', () => {
  const u = P.actorUser(couple, { side: 'client', field: M.field });
  const t = P.actorUser(couple, { side: 'target', field: M.field });
  assert.ok(u.includes(M.field), '현장 무전이 고객 회선에 안 실렸다');
  assert.ok(t.includes(M.field), '현장 무전이 타겟 회선에 안 실렸다 — 물리 사건은 둘 다 겪는다');
  assert.ok(u.includes('FIELD SUPPORT'), '현장 블록 머리가 없다');
  assert.ok(!P.clientSystem(couple, dressed, '').includes(M.field), 'system에 샜다');
  assert.ok(!P.targetSystem(couple).includes(M.field), 'system에 샜다');
  assert.ok(!P.judgeSystem(couple, dressed).includes(M.field), '심판이 봤다');
  assert.ok(!P.judgeUser(couple, 'p', 's').includes(M.field), '심판 user가 봤다');
  assert.ok(!P.epilogueUser(couple, 50, 'log').includes(M.field), '후일담이 봤다');
});

test('현장 무전은 그대로 실행되는 물리 사건이다 — 마음은 못 움직인다', () => {
  const f = P.fieldOrder(M.field);
  assert.ok(/exactly as ordered/.test(f), '그대로 실행 규칙이 없다');
  assert.ok(/things, not feelings/.test(f), '물건-만 규칙이 없다');
  assert.ok(/cannot make anyone attracted/.test(f), '호감 조작 금지가 없다');
  assert.equal(P.fieldOrder(''), '', '빈 현장 무전이 뭔가를 내보냈다');
});

test('고객 무전과 현장 무전은 한 메시지에 같이 실릴 수 있다', () => {
  const u = P.actorUser(couple, { side: 'client', radio: M.radio, field: M.field });
  assert.ok(u.includes(M.radio) && u.includes(M.field));
  assert.ok(u.indexOf(M.field) < u.indexOf(M.radio), '현장 사건이 무전 명령보다 뒤에 실렸다');
});

// ── 폐지된 축이 프롬프트로 되살아나지 않았는가 ──────────
test('폐지된 시스템 용어가 프롬프트에 없다 — 한글 이름도 영어 이름도', () => {
  // 스키마도 프롬프트다 (구조화 출력이 막히면 시스템 프롬프트에 통째로 붙는다).
  const all = [A, B1, B2, C, R, P.WORLD,
    ...['STYLING', 'MOTIVATION', 'TALK', 'JUDGE', 'EPILOGUE', 'REACT']
      .map(k => JSON.stringify(P[`${k}_SCHEMA`]))].join('\n');
  // 한글 이름만 막아두면 영어로 되살아나는 것을 못 잡는다. 둘 다 적는다.
  const DEAD = [
    // 무전은 이 목록에 없다 — 되살아났다. 아래 「무전」 절이 그 규칙을 대신 지킨다.
    /지뢰/, /\blandmines?\b/i, /미공개/, /\bundisclosed\b/i, /hidden pref/i,
    /강압/, /\bcoerc/i, /\bleverage\b/i,
    /어긋남/, /\bwreck\b/i, /공기 읽기/, /read the room/i, /sense the air/i,
    /성공선/, /success line/i, /난이도/, /\bdifficulty\b/i,
    /\bwalkout\b/i, /\bcasualt/i, /\bbreakthrough\b/i, /\bvibe\b/i,
    /carryMax/, /loveDelta/, /keepGoing/, /firstImpression/, /outfitDesc/,
  ];
  for (const re of DEAD) {
    assert.ok(!re.test(all), `폐지된 「${re.source}」가 프롬프트에 남아 있다`);
  }
});

// ── B-1. 무전 — 대화 도중의 개입 ─────────────────────────
// 코칭과 같은 자리(고객의 귀)로 가되, 자리가 굴러가는 도중에 꽂힌다.
// 규칙 ①이 무전에도 그대로 걸린다 — 요원이 쓴 글은 채점되지 않는다.
test('무전은 B-1의 user 메시지에만 실린다 — system도 판정도 후일담도 못 본다', () => {
  assert.ok(has(B1R, M.radio), '무전이 생성 프롬프트에 안 실렸다');
  assert.ok(!has(P.clientSystem(couple, dressed, M.coach), M.radio),
    '무전이 system으로 새어 들어갔다 — 캐시가 깨진다');
  assert.ok(!has(P.actorUser(couple, { side: 'target', radio: M.radio }), M.radio),
    '무전이 타겟 회선에 실렸다 — 타겟은 무전을 못 듣는다');
  assert.ok(!has(B2, M.radio), '무전이 판정에 새어 들어갔다 — 요원이 쓴 글은 채점되지 않는다');
  assert.ok(!has(C, M.radio), '무전이 후일담에 새어 들어갔다');
  assert.ok(!has(A, M.radio), '무전이 시공에 새어 들어갔다');
  assert.ok(!has(R, M.radio), '무전이 준비 단계 반응에 새어 들어갔다');
});

test('무전이 없으면 그 자리에 아무것도 안 붙는다', () => {
  const bare = P.actorUser(couple, { side: 'client' });
  assert.equal(bare, P.actorUser(couple, { side: 'client', radio: '' }));
  assert.equal(bare, P.actorUser(couple, { side: 'client', radio: '   ' }));
  assert.ok(!has(B1, 'RADIO —'), '무전을 안 때렸는데 무전 블록이 붙었다');
});

test('무전은 조언이 아니라 반드시 이행되는 명령이다', () => {
  const block = P.radioOrder(M.radio);
  assert.ok(/Not advice, not a suggestion, not an option/.test(block), '무전이 명령으로 안 박힌다');
  assert.ok(/starting with your very next line/.test(block), '언제 이행하는지가 안 박혔다');
  assert.ok(/Refusing, ignoring, postponing, or watering it down is not available/.test(block),
    '고객에게 거부·보류·희석의 여지가 열려 있다');
});

test('무전도 코칭과 같은 자리로 간다 — 타겟은 못 듣는다', () => {
  const block = P.radioOrder(M.radio);
  assert.ok(/your earpiece/.test(block), '무전이 고객에게 간다는 말이 없다');
  assert.ok(/They heard nothing/.test(block), '타겟이 못 듣는다는 못이 빠졌다');
});

test('명령받았다고 고객이 갑자기 유능해지지는 않는다', () => {
  assert.ok(/does not make you good at it/.test(P.radioOrder(M.radio)),
    '무전이 고객의 시트를 덮어써 버린다');
});

test('무전은 점수를 모른다 — 게이지도 판정도 실리지 않는다', () => {
  const block = P.radioOrder(M.radio);
  assert.ok(!/러브 포인트|무드 포인트|love point|mood point/i.test(block));
});

test('기관 이름은 한 가지 표기로만 나간다 — 사람들이 그렇게 부르게 하려면 그래야 한다', () => {
  const all = [A, B1, B2, C, R, P.radioOrder('x'), P.fieldOrder('x')].join('\n');
  assert.ok(/L 기관/.test(all), '기관 이름이 프롬프트에서 사라졌다');
  for (const dead of [/Bureau/i, /\bHQ\b/, /headquarters/i, /큐피드국/, /본부/, /Q 기관/]) {
    assert.ok(!dead.test(all), `옛 기관 표기 「${dead.source}」가 남아 있다`);
  }
  assert.ok(/says it exactly that way, out loud/.test(P.WORLD),
    '인물들이 그 이름을 입 밖으로 부른다는 못이 빠졌다');
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
  // 부정 단언만 두면 공허하다 — reactSystem 이 애초에 시공물을 받을 자리가 없어야 한다.
  assert.equal(P.reactSystem.length, 2, 'reactSystem이 인자를 더 받는다 — 시공된 시트가 들어올 자리가 생겼다');
  assert.equal(P.reactUser.length, 2, 'reactUser가 인자를 더 받는다');
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
    'B-1(고객 배우)': P.clientSystem(ascii, d, 'z')
      + P.sceneOpen(ascii, d, 'text', 'client') + P.sceneOpen(ascii, d, 'talk', 'client')
      + P.actorUser(ascii, { side: 'client', first: true }),
    'B-1(코칭없음)': P.clientSystem(ascii, d, ''),
    'B-1(타겟 배우)': P.targetSystem(ascii)
      + P.sceneOpen(ascii, d, 'text', 'target') + P.sceneOpen(ascii, d, 'talk', 'target')
      + P.actorUser(ascii, { side: 'target', heard: [{ who: 'client', text: 'x' }] }),
    'B-1(현장 무전)': P.fieldOrder('x', 'client') + P.fieldOrder('x', 'target'),
    'B-1(무전)': P.actorUser(ascii, { side: 'client', radio: 'go' }),
    'B-2': P.judgeSystem(ascii, d) + P.judgeUser(ascii, '', 'seg'),
    'B-2(앞대화 있음)': P.judgeUser(ascii, 'prior', 'seg'),
    C: P.epilogueSystem(ascii, d) + P.epilogueUser(ascii, 77, 'log'),
    R: Object.keys(P.REACT_ROOMS).map(k => P.reactSystem(ascii, k) + P.reactUser(k, 'q')).join(''),
    'R(주문없음)': Object.keys(P.REACT_ROOMS).map(k => P.reactUser(k, '')).join(''),
    // 스키마도 모형에게 간다 — 구조화 출력이 막히면 시스템 프롬프트에 통째로 붙는다.
    스키마: ['STYLING', 'MOTIVATION', 'TALK', 'JUDGE', 'EPILOGUE', 'REACT']
      .map(k => JSON.stringify(P[`${k}_SCHEMA`])).join(''),
  };
  for (const [name, text] of Object.entries(built)) {
    // 기관 이름 「L 기관」만 예외다. 인물들이 입 밖으로 그렇게 부르게 하려면 그 표기가
    // 프롬프트에 그대로 있어야 한다 — 번역해 버리면 지정한 것이 사라진다.
    const stripped = text.split('L 기관').join('Q');
    // 한글 전 영역 — 조합 자모 · 호환 자모 · 확장 A · 음절 · 반각까지 전부 본다.
    const HANGUL = /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7ff\uffa0-\uffdc]/g;
    const han = [...new Set(stripped.match(HANGUL) || [])];
    assert.deepEqual(han, [], `${name} 지시문에 한글이 남아 있다: ${han.join('')}`);
  }
});

test('그래도 출력 언어 고정은 다섯 블록 전부에 붙어 있다', () => {
  const KO = /Output is Korean|output in Korean/;
  for (const t of [A, B1, B2, C, R]) assert.ok(KO.test(t), '출력 언어 고정이 빠진 블록이 있다');
});
