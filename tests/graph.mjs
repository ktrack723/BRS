// graph.mjs — 정보 흐름 그래프를 코드에서 직접 뽑는다.  node tests/graph.mjs
//
// 누가 무엇을 알고 무엇을 모르는가는 이 게임의 규칙 그 자체다. 그런데 그걸 문서로 적어두면
// 코드가 바뀌는 순간 조용히 거짓말이 된다. 그래서 손으로 안 그린다.
//
// 방법: 실제 커플로 프롬프트를 전부 렌더한 뒤, 각 필드의 '값'이 그 안에 문자 그대로 있는지 본다.
// 손으로 그린 그래프는 코드가 바뀌면 조용히 거짓이 된다.
import * as P from '../js/prompts.js';
import { COUPLES, COUPLE_BY_ID } from '../js/couples.js';
import fs from 'node:fs';

const c = COUPLE_BY_ID['os-war'];
const AG = { name: '박큐피드', gender: '기밀' };
const prep = { outfitDesc: '형광 주황 정장', coaching: '지침본문', speech: '연설본문' };

// ── 추적할 정보 조각 ─────────────────────────────────────
const val = (x) => Array.isArray(x) ? x.join(' / ') : String(x ?? '');
const F = [];
for (const [who, p] of [['의뢰인', c.client], ['상대', c.target]]) {
  for (const k of ['name', 'gender', 'look', 'history', 'personality']) {
    if (p[k] === undefined) continue;
    // 성별은 한 글자라 그대로 찾으면 아무 데나 걸린다. 프롬프트에 실제로 실리는 표기로 찾는다.
    if (k === 'gender') { F.push({ id: `${who}.gender`, probe: [P.idOf(p)] }); continue; }
    F.push({ id: `${who}.${k}`, probe: Array.isArray(p[k]) ? p[k].map(String) : [String(p[k])] });
  }
  F.push({ id: `${who}.keys.wreck`, probe: [p.keys.wreck.line] });
  F.push({ id: `${who}.성향.공개`, probe: p.prefs.filter(x => x.open && !x.neg).map(x => x.t) });
  F.push({ id: `${who}.성향.미공개`, probe: p.prefs.filter(x => !x.open).map(x => x.t) });
  F.push({ id: `${who}.성향.지뢰`, probe: p.prefs.filter(x => x.open && x.neg).map(x => x.t) });
}
F.push({ id: '커플.relation', probe: [c.relation] });
F.push({ id: '커플.winWord', probe: [c.winWord] });
F.push({ id: '요원.이름', probe: [AG.name] });
F.push({ id: '요원.성별', probe: [AG.gender] });
F.push({ id: '준비.착장', probe: [prep.outfitDesc] });
F.push({ id: '준비.지침', probe: [prep.coaching] });
F.push({ id: '준비.연설', probe: [prep.speech] });
F.push({ id: '무전 본문', probe: ['무전본문'] });

// ── 소비처 ───────────────────────────────────────────────
const HIST = [
  `${c.client.name}: 첫 문자입니다`,
  `${c.target.name}: 답장입니다`,
  '[HQ RADIO — the other person cannot hear this]: 무전본문',
  '[SCENE]: 장면전환',
].join('\n');
// 엔진이 심판·나레이터에게 넘기는 형태 (engine.#history({ noRadio: true }))
const NO_RADIO = HIST.split('\n').filter(l => !l.includes('HQ RADIO')).join('\n');

const ctx = {
  accepted: false, grade: 'E', love: 30, threshold: 60,
  aborted: false, abortReason: '', casualty: 'none', casualtyNote: '',
  vibe: '공기', revealed: ['드러난것'], missed: ['안드러난것'], radioUsed: 1, transcript: HIST,
};
const NODES = {
  '가위손 박 (착장)':      P.STYLING_SYSTEM + '\n' + P.stylingUser(c, c.client.spec, '태그', AG),
  '취조실 반응':           P.prepReactSystem(c, 'coaching') + '\n' + P.prepReactUser('coaching', prep.coaching, AG),
  '정문 반응':             P.prepReactSystem(c, 'speech') + '\n' + P.prepReactUser('speech', prep.speech, AG),
  '의뢰인 에이전트':        P.clientAgentSystem(c, prep, 'talk', AG),
  '상대 에이전트':          P.targetAgentSystem(c, 'talk', prep.outfitDesc),
  // 심판과 나레이터는 무전을 못 본다 — 엔진이 noRadio로 걸러서 넘긴다.
  '심판':                  P.judgeSystem(c) + '\n' + P.judgeUser(NO_RADIO, '발언\n반응', ['nudge']),
  '나레이터 (대면 장면)':   P.situationSystem(c) + '\n' + P.situationUser(c, NO_RADIO, prep.outfitDesc),
  '결과 기록관':            P.resultSystem(c, AG) + '\n' + P.resultUser(c, ctx),
};

// ── 간선 ─────────────────────────────────────────────────
const edges = [];
for (const f of F) {
  for (const [node, text] of Object.entries(NODES)) {
    const hits = f.probe.filter(v => v.length >= 2 && text.includes(v)).length;
    if (hits) edges.push({ from: f.id, to: node, part: hits, of: f.probe.length });
  }
}

// ── UI 소비처 (정적 분석) ────────────────────────────────
const gameSrc = fs.readFileSync(new URL('../js/game.js', import.meta.url), 'utf8');
const uiHit = (k) => new RegExp(`\\.${k}\\b`).test(gameSrc);

// ── 출력 ─────────────────────────────────────────────────
console.log('# 정보 흐름 그래프  (프롬프트 소비처 8종 · 추적 조각 ' + F.length + '개)\n');
const hdr = ['정보', ...Object.keys(NODES)];
console.log('| ' + hdr.join(' | ') + ' | 화면 |');
console.log('|' + hdr.map(() => '---').join('|') + '|---|');
for (const f of F) {
  const row = Object.keys(NODES).map(n => {
    const e = edges.find(x => x.from === f.id && x.to === n);
    if (!e) return '';
    return e.part === e.of ? '●' : `◐${e.part}/${e.of}`;
  });
  const key = f.id.split('.').pop();
  console.log(`| ${f.id} | ${row.join(' | ')} | ${uiHit(key) ? '●' : ''} |`);
}

console.log('\n# 감사\n');
const dead = F.filter(f => !edges.some(e => e.from === f.id));
console.log('## 아무 프롬프트에도 안 가는 조각');
for (const f of dead) {
  const key = f.id.split('.').pop();
  console.log(`- ${f.id} ${uiHit(key) ? '(화면 전용)' : '⚠ 화면에도 없음 — 완전 사문화'}`);
}
console.log('\n## 부분 전달 (일부만 넘어간다 — 의도적 차등인지 확인 필요)');
for (const e of edges.filter(x => x.part !== x.of)) console.log(`- ${e.from} → ${e.to} (${e.part}/${e.of})`);
console.log('\n## 정보 비대칭 점검');
const asym = [
  ['상대.성향.미공개', '의뢰인 에이전트', false, '의뢰인이 상대의 비밀을 알면 안 된다'],
  ['의뢰인.성향.미공개', '상대 에이전트', false, '반대 방향도 같다 — 완전 대칭'],
  ['의뢰인.성향.미공개', '심판', false, '심판은 철저히 상대 시점만 본다'],
  ['준비.지침', '심판', false, '요원이 쓴 것은 채점 대상이 아니다'],
  ['무전 본문', '심판', false, '무전도 요원이 쓴 것이다 — 상대가 못 듣는 건 상대 시점에도 없다'],
  ['상대.성향.지뢰', '심판', true, '반응을 해석할 배경으로 필요하다'],
  ['상대.성향.미공개', '심판', true, '무엇이 드러났는지 판단할 배경'],
];
let bad = 0;
for (const [from, to, want, why] of asym) {
  const has = edges.some(e => e.from === from && e.to === to);
  const ok = has === want;
  if (!ok) bad++;
  console.log(`${ok ? '✅' : '❌'} ${from} → ${to} : ${has ? '전달됨' : '차단됨'} (기대 ${want ? '전달' : '차단'}) — ${why}`);
}
// ── attention에 따라 켜졌다 꺼지는 간선 ──────────────────
// 한 커플만 보면 이게 '없는 간선'으로 보인다. 34건 전부 돌려 조건부인지 확인한다.
console.log('\n## 조건부 간선 (attention 축이 여닫는다)');
const cond = {};
for (const cc of COUPLES) {
  const cs = P.clientAgentSystem(cc, prep, 'talk', AG);
  const ts = P.targetAgentSystem(cc, 'talk', prep.outfitDesc);
  const rec = (name, on) => { (cond[name] ||= { on: 0, off: 0 })[on ? 'on' : 'off']++; };
  const tOpen = cc.target.prefs.filter(x => x.open && !x.neg).map(x => x.t);
  const cOpen = cc.client.prefs.filter(x => x.open && !x.neg).map(x => x.t);
  rec('상대.personality → 의뢰인 에이전트', cs.includes(cc.target.personality.join(', ')));
  rec('상대.공개성향 → 의뢰인 에이전트', tOpen.some(v => cs.includes(v)));
  rec('의뢰인.personality → 상대 에이전트', ts.includes(cc.client.personality.join(', ')));
  rec('의뢰인.공개성향 → 상대 에이전트', cOpen.some(v => ts.includes(v)));
}
const N = COUPLES.length;
for (const [k, v] of Object.entries(cond)) {
  const tag = v.on === N ? '항상 열림' : v.on === 0 ? '⚠ 항상 닫힘 — 죽은 간선' : `조건부 ${v.on}/${N}`;
  console.log(`- ${k} : ${tag}`);
}

console.log(`\n총 간선 ${edges.length}개 · 비대칭 위반 ${bad}건`);
