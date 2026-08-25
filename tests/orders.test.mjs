// node --test — 플레이어 지시 전달 감사. 착장·지침·연설·무전이 정확히 닿아야 할 곳에만 닿는가.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../js/prompts.js';
import { Engine } from '../js/engine.js';
import { COUPLE_BY_ID } from '../js/couples.js';
import { diffOf } from '../js/scoring.js';

const couple = COUPLE_BY_ID['politics'];
const D = diffOf(couple.difficulty);
const AGENT = { name: '요원', gender: '' };
const PREP = { outfitDesc: '주황 턱시도 차림', coaching: '지침원문X', speech: '연설원문Y' };

class MiniLlm {
  constructor() { this.calls = []; }
  async call({ label, system, messages }) {
    this.calls.push({ label, system, messages: structuredClone(messages) });
    if (label.startsWith('판정') || label.startsWith('첫인상')) {
      return {
        carry: 0, tier: 'flat', loveDelta: 0, reason: 'r', vibe: 'v', revealed: '',
        clientEmote: 'talk', targetEmote: 'talk', casualty: 'none', casualtyNote: '',
        leverage: 'none', walkout: false,
      };
    }
    if (label.includes('상황 생성')) return { place: 'P', intro: 'I', outfitReaction: 'R', vibe: 'V' };
    if (label === '결과 편지') return { letter: 'L', epilogue: 'E', mvp: 'M' };
    return `대사(${label})`;
  }
  find(pred) { return this.calls.filter(pred); }
}

async function run(opts = {}) {
  const llm = new MiniLlm();
  const engine = new Engine(llm, { couple, agent: AGENT, prep: opts.prep || PREP, handlers: {
    turn: opts.onTurn ? (t => opts.onTurn(engine, t)) : undefined,
  } });
  await engine.runTexting();
  const sit = await engine.situation();
  await engine.runTalking(sit);
  await engine.finish();
  return { llm, engine };
}

test('착장은 대면의 상대·첫인상 판정까지 간다', async () => {
  const { llm } = await run();
  const fi = llm.find(c => c.label.startsWith('첫인상'))[0];
  assert.ok(fi.messages[0].content.includes('주황 턱시도'));
  const talkTarget = llm.find(c => c.label.startsWith('대면 응답'))[0];
  assert.ok(talkTarget.system.includes('주황 턱시도'), '대면에서 상대가 차림을 본다');
});

test('문자 단계에서는 상대가 차림을 볼 수 없다', async () => {
  const { llm } = await run();
  const textTarget = llm.find(c => c.label.startsWith('문자 응답'))[0];
  assert.ok(!textTarget.system.includes('주황 턱시도'));
});

test('지침과 연설은 의뢰인에게만 간다', async () => {
  const { llm } = await run();
  for (const c of llm.find(c => c.label.includes('발언'))) {
    assert.ok(c.system.includes('지침원문X') && c.system.includes('연설원문Y'));
  }
  for (const c of llm.find(c => c.label.includes('응답'))) {
    assert.ok(!c.system.includes('지침원문X') && !c.system.includes('연설원문Y'));
  }
  const judge = llm.find(c => c.label.startsWith('판정'))[0];
  assert.ok(!judge.system.includes('지침원문X'), '심판이 준비물을 보면 채점이 오염된다');
});

test('빈 지시는 빈 채로 전달된다 — 조용히 채워 넣지 않는다', async () => {
  const { llm } = await run({ prep: { outfitDesc: '', coaching: '', speech: '' } });
  const cl = llm.find(c => c.label.includes('발언'))[0];
  assert.ok(cl.system.includes('[ORDERS FROM HEADQUARTERS] None'));
  assert.ok(!cl.system.includes('WHAT OPERATIVE'), '빈 연설이 블록으로 생겼다');
});

test('지침이 있으면 이행 강제(거부 불가)가 붙는다 — 흐름 지시는 없다', async () => {
  const { llm } = await run();
  const cl = llm.find(c => c.label.includes('발언'))[0];
  assert.ok(cl.system.includes('cannot refuse'));
  assert.ok(cl.system.includes('못 하겠습니다'));
  // 프롬프트 최소주의: "삼킨 충동이 옆으로 샌다", "막히면 지침으로 돌아간다" 같은
  // 흐름 연출 지시는 전부 폐지됐다. 되살아나면 여기서 잡는다.
  assert.ok(!cl.system.includes('the wanting does not go with'), '폐지된 충동 배출 지시가 부활했다');
  assert.ok(!cl.system.includes('not making up as you go'), '폐지된 지침 회귀 지시가 부활했다');
});

test('같은 지침도 인물의 이행 결(comply)에 따라 다르게 실린다', () => {
  const argues = { ...couple, client: { ...couple.client, keys: { ...couple.client.keys, comply: 'argues' } } };
  const drifts = { ...couple, client: { ...couple.client, keys: { ...couple.client.keys, comply: 'drifts' } } };
  const a = P.clientAgentSystem(argues, PREP, 'text', AGENT);
  const d = P.clientAgentSystem(drifts, PREP, 'text', AGENT);
  assert.ok(a.includes('object internally'));
  assert.ok(d.includes('drift back'));
});

test('무전은 원문 그대로, 의뢰인의 다음 발언에만 꽂힌다', async () => {
  let sent = false;
  const { llm } = await run({
    onTurn: (engine, t) => { if (!sent && t.phase === 'talk' && t.turn === 2) sent = engine.submitRadio('무전원문Z!'); },
  });
  const hit = llm.find(c => c.label.includes('발언') && JSON.stringify(c.messages).includes('무전원문Z!'));
  assert.ok(hit.length >= 1, '무전이 발언에 안 꽂혔다');
  assert.ok(JSON.stringify(hit[0].messages).includes('Refusal is not available'));
  const leak = llm.find(c => c.label.includes('응답') && JSON.stringify(c.messages).includes('무전원문Z!'));
  assert.equal(leak.length, 0, '무전이 상대에게 들렸다');
});

test('무전 횟수는 난이도 규격을 넘지 못한다', async () => {
  const oks = [];
  await run({ onTurn: (engine) => { oks.push(engine.submitRadio('남발')); } });
  assert.equal(oks.filter(Boolean).length, D.radioText + D.radioTalk);
});

test('착장 지시는 심사 없이 가위손에게 원문 그대로 간다', () => {
  const u = P.stylingUser(couple, couple.client.spec, '전신 타투를 그려줘', AGENT);
  assert.ok(u.includes('전신 타투를 그려줘'));
  assert.ok(P.STYLING_SYSTEM.includes('never refuse'));
});

test('나레이터에게 문자 기록이 실제로 넘어간다', async () => {
  const { llm } = await run();
  const sit = llm.find(c => c.label.includes('상황 생성'))[0];
  assert.ok(sit.messages[0].content.includes('TEXT LOG'));
  assert.ok(sit.messages[0].content.includes('대사(문자 발언 1)'), '문자 내용이 안 넘어갔다');
});

test('빈 지침은 한 줄짜리 데이터다 — "들이대라"류 연출 지시가 붙지 않는다', () => {
  const sys = P.clientAgentSystem(couple, { ...PREP, coaching: '' }, 'text', AGENT);
  assert.ok(sys.includes('None. Nobody told you anything.'));
  assert.ok(!sys.includes('push harder'), '폐지된 빈-지침 연출 지시가 부활했다');
});
