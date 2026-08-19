// node --test tests/  — 하네스(engine.js) 통합 테스트. 가짜 LLM으로 돌리므로 API 키가 필요 없다.
// 판정을 한 턴 늦춰 '타겟의 실제 반응'까지 보고 채점하는 구조가 깨지지 않았는지 검증한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/engine.js';
import { COUPLE_BY_ID } from '../js/couples.js';
import { diffOf } from '../js/scoring.js';

const couple = COUPLE_BY_ID['os-war'];
const D = diffOf(couple.difficulty);
const TOTAL_TURNS = D.textTurns + D.talkTurns;

// ── 가짜 LLM ─────────────────────────────────────────────
// label로 어떤 호출인지 구분해 결정적인 응답을 돌려준다. 동시성도 관측한다.
class FakeLlm {
  constructor({ judge } = {}) {
    this.calls = [];
    this.inFlight = 0;
    this.maxInFlight = 0;
    this.judgeFn = judge || (() => ({
      tier: 'ok', moodDelta: 2, loveDelta: 3,
      visiblePrefHit: '', hiddenPrefHit: '', redLineHit: false, reason: '무난',
    }));
  }

  async call({ label, system, messages, schema, cache }) {
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    const rec = { label, system, messages: structuredClone(messages), schema: !!schema, cache: !!cache };
    this.calls.push(rec);
    await new Promise(r => setTimeout(r, 5)); // 병렬성이 관측되도록 살짝 지연
    this.inFlight--;

    if (label.startsWith('판정')) {
      rec.judgeUser = messages[0].content;
      return this.judgeFn(rec, this.calls.filter(c => c.label.startsWith('판정')).length);
    }
    if (label.includes('상황 생성')) {
      return { place: '테스트 광장', intro: '만났다.', outfitReaction: '차림새가 그렇군요.' };
    }
    if (label === '결과 편지') return { letter: '편지', epilogue: '근황', mvp: '결정타' };
    if (label.includes('발언')) return `클라이언트 발언 #${this.count('발언')}`;
    if (label.includes('응답')) return `타겟 응답 #${this.count('응답')}`;
    return '기타';
  }

  count(kind) { return this.calls.filter(c => c.label.includes(kind)).length; }
  byLabel(prefix) { return this.calls.filter(c => c.label.startsWith(prefix)); }
  // 판정 계열 = 턴 판정('판정 …') + 대면 첫인상('첫인상 판정')
  allJudges() { return this.calls.filter(c => c.label.startsWith('판정') || c.label.startsWith('첫인상')); }
}

async function playFull(llm, opts = {}) {
  const events = { judge: [], bubbles: [] };
  const engine = new Engine(llm, {
    couple, prep: opts.prep || { outfitDesc: '테스트 착장', coaching: '테스트 지침', speech: '테스트 연설' },
    handlers: {
      judge: j => events.judge.push(j),
      bubble: (who, text) => events.bubbles.push({ who, text }),
      turn: opts.onTurn ? (t => opts.onTurn(engine, t)) : undefined,
    },
  });
  const alive = await engine.runTexting();
  if (alive) {
    const sit = await engine.situation();
    await engine.runTalking(sit);
  }
  const result = await engine.finish();
  return { engine, events, result };
}

// ── 판정 누락/중복이 없어야 한다 ─────────────────────────
test('클라이언트의 모든 발언이 정확히 한 번씩 채점된다', async () => {
  const llm = new FakeLlm();
  const { engine, result } = await playFull(llm);
  const clientMsgs = engine.transcript.filter(t => t.who === 'client').length;
  const judgeCalls = llm.allJudges().length;

  assert.equal(clientMsgs, TOTAL_TURNS, `발언 ${TOTAL_TURNS}회`);
  // 발언 9회 + 대면 첫인상 1회 = 판정 10회
  assert.equal(judgeCalls, TOTAL_TURNS + 1, '첫인상 포함 판정 횟수');
  assert.equal(llm.byLabel('판정').length, TOTAL_TURNS, '턴 판정은 발언 수와 정확히 일치');
  assert.equal(result.state.history.length, TOTAL_TURNS + 1, '히스토리에도 전부 남는다');
  assert.equal(result.state.turns, TOTAL_TURNS + 1);
});

test('판정은 한 턴 늦게 오지만 마지막 발언까지 반드시 정산된다', async () => {
  const llm = new FakeLlm();
  const { result } = await playFull(llm);
  const finalTags = llm.byLabel('판정').map(c => c.label);
  // 각 페이즈의 마지막 발언은 (최종) 태그로 뒤늦게 비워진다
  assert.equal(finalTags.filter(l => l.includes('(최종)')).length, 2, '문자·대면 페이즈 각각 1회 플러시');
  assert.ok(finalTags.some(l => l.includes(`문자 ${D.textTurns} (최종)`)), '문자 마지막 발언이 정산됐다');
  assert.ok(finalTags.some(l => l.includes(`대면 ${D.talkTurns} (최종)`)), '대면 마지막 발언이 정산됐다');
  assert.equal(result.state.history.length, TOTAL_TURNS + 1);
});

// ── 심판이 '상대의 실제 반응'을 본다 ────────────────────
test('심판에게 타겟의 실제 반응이 함께 전달된다', async () => {
  const llm = new FakeLlm();
  await playFull(llm);
  const judges = llm.byLabel('판정').filter(c => !c.label.includes('첫인상'));
  assert.ok(judges.length >= TOTAL_TURNS);
  for (const j of judges) {
    assert.match(j.judgeUser, /상대의 실제 반응/, '반응 블록이 없으면 실마리를 캤는지 알 수 없다');
    assert.match(j.judgeUser, /타겟 응답 #|차림새가 그렇군요/, '반응 본문이 실제로 들어가 있다');
  }
  // 첫인상 판정에는 착장에 대한 첫 반응이 들어간다
  const first = llm.byLabel('첫인상')[0];
  assert.match(first.messages[0].content, /차림새가 그렇군요/);
});

test('심판이 채점하는 발언과 그 반응이 실제로 짝이 맞는다', async () => {
  const llm = new FakeLlm();
  await playFull(llm);
  const judges = llm.byLabel('판정').filter(c => !c.label.includes('첫인상'));
  for (const j of judges) {
    const subject = j.judgeUser.match(/이번 발언\] (클라이언트 발언 #\d+)/)?.[1];
    const reaction = j.judgeUser.match(/실제 반응\] (타겟 응답 #\d+)/)?.[1];
    if (!subject || !reaction) continue; // 대면 첫 턴은 반응이 나레이션일 수 있다
    assert.equal(subject.match(/\d+/)[0], reaction.match(/\d+/)[0],
      `${subject}의 반응은 같은 번호의 타겟 응답이어야 한다 (실제: ${reaction})`);
  }
});

// ── 최적화가 살아 있는지 ────────────────────────────────
test('직전 턴 판정과 이번 턴 타겟 응답이 동시에 발사된다', async () => {
  const llm = new FakeLlm();
  await playFull(llm);
  assert.ok(llm.maxInFlight >= 2, `동시 요청이 관측되지 않았다 (max ${llm.maxInFlight})`);
});

test('턴당 순차 왕복은 2회다 (발언 → 판정∥응답)', async () => {
  const llm = new FakeLlm();
  await playFull(llm);
  // 총 호출: 발언 9 + 응답 9 + 판정 10 + 상황 1 + 편지 1 = 30
  const total = llm.calls.length;
  assert.equal(llm.count('발언'), TOTAL_TURNS);
  assert.equal(llm.count('응답'), TOTAL_TURNS);
  assert.equal(total, TOTAL_TURNS * 2 + (TOTAL_TURNS + 1) + 2, `총 호출 ${total}`);
});

test('대면 상황 생성은 문자 마지막 턴 배치에 미리 태워진다', async () => {
  const llm = new FakeLlm();
  const engine = new Engine(llm, { couple, prep: {}, handlers: {} });
  await engine.runTexting();
  assert.ok(engine.situationPromise, '문자 페이즈가 끝난 시점에 이미 상황 생성이 떠 있어야 한다');
  const before = llm.count('상황 생성');
  await engine.situation();
  assert.equal(llm.count('상황 생성'), before, '회수할 때 중복 호출하지 않는다');
});

test('에이전트·심판 시스템 프롬프트에는 캐시 breakpoint가 걸린다', async () => {
  const llm = new FakeLlm();
  await playFull(llm);
  for (const c of llm.calls) {
    if (/발언|응답|판정/.test(c.label)) {
      assert.ok(c.cache, `${c.label}: 턴마다 반복되는 호출인데 캐시가 꺼져 있다`);
    }
  }
  // 시스템 프롬프트가 턴마다 바이트 동일해야 캐시가 붙는다
  const sys = llm.byLabel('문자 발언').map(c => c.system);
  assert.equal(new Set(sys).size, 1, '문자 페이즈 클라이언트 시스템 프롬프트가 턴마다 달라지면 캐시가 깨진다');
  const jsys = llm.byLabel('판정').map(c => c.system);
  assert.equal(new Set(jsys).size, 1, '심판 시스템 프롬프트는 항상 동일해야 한다');
});

// ── 무전 ─────────────────────────────────────────────────
test('무전은 다음 발언 프롬프트에 주입되고 배급량을 넘지 못한다', async () => {
  const llm = new FakeLlm();
  const submitted = [];
  const { engine } = await playFull(llm, {
    onTurn: (e, t) => {
      const ok = e.submitRadio(`무전 ${t.phase}${t.turn}`);
      if (ok) submitted.push(`${t.phase}${t.turn}`);
    },
  });
  assert.equal(submitted.length, D.radioText + D.radioTalk, '페이즈별 배급량만큼만 송신된다');
  assert.equal(engine.state.radioUsed, D.radioText + D.radioTalk);

  // 주입 확인: 무전을 보낸 직후 발언 호출의 메시지에 그 문구가 들어 있다
  const injected = llm.byLabel('문자 발언')
    .flatMap(c => c.messages.map(m => String(m.content)))
    .filter(t => t.includes('본부 무전'));
  assert.ok(injected.length >= 1, '무전이 클라이언트 프롬프트에 주입되지 않았다');
  assert.ok(injected.some(t => t.includes('상대에게는 안 들림')));
});

test('무전은 그 자체로 게이지를 바꾸지 않는다 (채점 대상이 아니다)', async () => {
  const llm = new FakeLlm();
  const engine = new Engine(llm, { couple, prep: {}, handlers: {} });
  engine.radioLeft = 1;
  const before = { love: engine.state.love, mood: engine.state.mood };
  engine.submitRadio('아무 지시');
  assert.equal(engine.state.love, before.love);
  assert.equal(engine.state.mood, before.mood);
  assert.equal(engine.state.radioUsed, 1);
  assert.equal(llm.calls.length, 0, '무전 자체로는 LLM 호출이 발생하지 않는다 (채점 없음)');
});

test('페이즈가 바뀌면 미주입 무전은 폐기된다', async () => {
  const llm = new FakeLlm();
  const engine = new Engine(llm, { couple, prep: {}, handlers: {} });
  engine.radioLeft = 1;
  engine.submitRadio('문자 막판 지시');
  assert.ok(engine.pendingRadio);
  await engine.runTalking({ place: 'p', intro: 'i', outfitReaction: 'r' });
  const leaked = llm.byLabel('대면 발언')
    .flatMap(c => c.messages.map(m => String(m.content)))
    .some(t => t.includes('문자 막판 지시'));
  assert.equal(leaked, false, '문자 페이즈 지시가 대면 맥락으로 새어나가면 안 된다');
});

// ── 준비물 주입 ──────────────────────────────────────────
test('준비물은 채점되지 않고 프롬프트로만 들어간다', async () => {
  const llm = new FakeLlm();
  const prep = { outfitDesc: '형광 주황 턱시도', coaching: '절대 아치 얘기 하지 마라', speech: '412년을 기다렸다' };
  await playFull(llm, { prep });
  const clientSys = llm.byLabel('문자 발언')[0].system;
  assert.ok(clientSys.includes(prep.coaching));
  assert.ok(clientSys.includes(prep.speech));
  assert.ok(clientSys.includes(prep.outfitDesc));
  // 준비물을 채점하는 호출이 없어야 한다
  const scoring = llm.calls.filter(c => /스타일링 채점|코칭 채점|연설 채점|무전 정확도/.test(c.label));
  assert.equal(scoring.length, 0, '준비물 채점 호출이 남아 있다');
});

test('타겟 에이전트는 착장을 알고, 클라이언트는 미확인 취향을 모른다', async () => {
  const llm = new FakeLlm();
  await playFull(llm, { prep: { outfitDesc: '형광 주황 턱시도', coaching: '', speech: '' } });
  const targetSys = llm.byLabel('대면 응답')[0].system;
  assert.ok(targetSys.includes('형광 주황 턱시도'));
  const clientSys = llm.byLabel('대면 발언')[0].system;
  for (const h of couple.target.hiddenPrefs) {
    assert.ok(!clientSys.includes(h), `클라이언트 프롬프트에 미확인 취향이 새어 있다: ${h}`);
  }
});

// ── 판정 결과가 상태에 제대로 꽂히는지 ──────────────────
test('미확인 취향 적중이 누적되고 디브리핑에 반영된다', async () => {
  const hidden = couple.target.hiddenPrefs;
  let n = 0;
  const llm = new FakeLlm({
    judge: () => {
      const pick = hidden[n++ % (hidden.length + 2)]; // 목록을 한 바퀴 돌고 나면 빈 값
      return {
        tier: pick ? 'critical' : 'ok', moodDelta: 3, loveDelta: pick ? 9 : 3,
        visiblePrefHit: '', hiddenPrefHit: pick || '', redLineHit: false, reason: 'r',
      };
    },
  });
  const { result } = await playFull(llm);
  assert.equal(result.state.hits.length, hidden.length, '중복 없이 전부 집계된다');
  assert.equal(result.debrief.missed.length, 0);
  assert.ok(result.verdict.accepted, '미확인 취향을 전부 캐면 성사되어야 한다');
});

test('분위기가 0이면 즉시 파탄나고 남은 턴을 돌지 않는다', async () => {
  const llm = new FakeLlm({
    judge: () => ({
      tier: 'redline', moodDelta: -10, loveDelta: -9,
      visiblePrefHit: '', hiddenPrefHit: '', redLineHit: true, reason: '지뢰',
    }),
  });
  const { engine, result } = await playFull(llm);
  assert.ok(engine.aborted, '파탄 처리되지 않았다');
  assert.equal(engine.abortReason, 'mood');
  assert.equal(result.verdict.accepted, false);
  assert.equal(result.verdict.grade, 'F');
  assert.ok(llm.count('발언') < TOTAL_TURNS, '파탄 후에도 턴을 계속 돌았다');
  assert.ok(engine.transcript.some(t => t.who === 'sys' && /읽씹|화장실/.test(t.text)), '파탄 나레이션이 없다');
});

test('LLM이 죽어도 판정은 중립으로 흐르고 게임은 끝까지 간다', async () => {
  const llm = new FakeLlm();
  const orig = llm.call.bind(llm);
  llm.call = async (a) => {
    if (a.label.startsWith('판정')) throw new Error('심판 다운');
    return orig(a);
  };
  const { result } = await playFull(llm);
  assert.equal(result.state.history.length, TOTAL_TURNS + 1, '판정이 실패해도 턴은 전부 기록된다');
  assert.ok(result.state.history.every(h => h.tier === 'empty'), '실패 시 중립(empty) 처리');
});

test('대면 첫인상은 착장+반응으로 채점되며 firstImpression으로 표시된다', async () => {
  // 가중치 자체는 scoring.test.mjs가 검증한다. 여기서는 하네스의 계약만 본다:
  // 착장과 상대의 첫 반응을 심판에게 넘기고, firstImpression 플래그를 세워 적용하는지.
  const llm = new FakeLlm();
  const { result } = await playFull(llm, {
    prep: { outfitDesc: '형광 주황 턱시도', coaching: '', speech: '' },
  });
  const fi = result.state.history.filter(h => h.firstImpression);
  assert.equal(fi.length, 1, '첫인상 판정은 판당 정확히 한 번이다');
  assert.equal(fi[0].turn, D.textTurns + 1, '첫인상은 문자 페이즈 판정이 전부 비워진 뒤에 온다');

  const call = llm.byLabel('첫인상')[0];
  assert.ok(call, '첫인상 판정 호출이 없다');
  assert.match(call.messages[0].content, /형광 주황 턱시도/, '착장이 판정에 안 들어갔다');
  assert.match(call.messages[0].content, /차림새가 그렇군요/, '상대의 첫 반응이 판정에 안 들어갔다');
});

test('꾸미지 않으면 첫인상 판정에 그 사실이 명시된다', async () => {
  const llm = new FakeLlm();
  await playFull(llm, { prep: { outfitDesc: '', coaching: '', speech: '' } });
  assert.match(llm.byLabel('첫인상')[0].messages[0].content, /전혀 꾸미지 않았다/);
});

test('snapshot이 UI가 필요한 값을 모두 담는다', async () => {
  const llm = new FakeLlm();
  const engine = new Engine(llm, { couple, prep: {}, handlers: {} });
  const s = engine.snapshot();
  for (const k of ['love', 'mood', 'threshold', 'moodFloor', 'mult', 'radioLeft',
    'foundCount', 'hiddenTotal', 'visibleTotal', 'redLines']) {
    assert.equal(typeof s[k], 'number', `snapshot.${k} 누락`);
  }
  assert.equal(s.hiddenTotal, couple.target.hiddenPrefs.length);
  assert.equal(s.visibleTotal, couple.target.visiblePrefs.length);
});
