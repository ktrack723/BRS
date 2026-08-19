// node --test tests/  — 하네스(engine.js) 통합 테스트. 가짜 LLM으로 돌리므로 API 키가 필요 없다.
// 판정을 한 턴 늦춰 '타겟의 실제 반응'까지 보고 채점하는 구조와,
// 대화 내역 이월 · 공기(vibe) 주입이 깨지지 않았는지 검증한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, prepReaction } from '../js/engine.js';
import { COUPLES, COUPLE_BY_ID } from '../js/couples.js';
import { diffOf } from '../js/scoring.js';

const couple = COUPLE_BY_ID['os-war'];
const D = diffOf(couple.difficulty);
const TOTAL_TURNS = D.textTurns + D.talkTurns;
const AGENT = { name: '박큐피드', gender: '기밀' };

// ── 가짜 LLM ─────────────────────────────────────────────
// label로 어떤 호출인지 구분해 결정적인 응답을 돌려준다. 동시성도 관측한다.
class FakeLlm {
  constructor({ judge } = {}) {
    this.calls = [];
    this.inFlight = 0;
    this.maxInFlight = 0;
    this.judgeFn = judge || (() => ({
      tier: 'nudge', moodDelta: 2, loveDelta: 2,
      reason: '무난', vibe: '대화는 굴러간다', revealed: '',
      clientEmote: 'talk', targetEmote: 'nod',
    }));
  }

  async call({ label, system, messages, schema, cache }) {
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    const rec = { label, system, messages: structuredClone(messages), schema: !!schema, cache: !!cache };
    this.calls.push(rec);
    await new Promise(r => setTimeout(r, 5)); // 병렬성이 관측되도록 살짝 지연
    this.inFlight--;

    if (label.startsWith('판정') || label.startsWith('첫인상')) {
      rec.judgeUser = messages[0].content;
      return this.judgeFn(rec, this.calls.filter(c => c.label.startsWith('판정')).length);
    }
    if (label.includes('상황 생성')) {
      return { place: '테스트 광장', intro: '만났다.', outfitReaction: '차림새가 그렇군요.', vibe: '자리에 앉았다' };
    }
    if (label === '결과 편지') return { letter: '편지', epilogue: '근황', mvp: '결정타' };
    if (label.includes('반응')) return { reaction: '알겠습니다만', face: 'cringe', note: '피조사자 동요 없음' };
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
  const events = { judge: [], bubbles: [], vibes: [], emotes: [] };
  const engine = new Engine(llm, {
    couple: opts.couple || couple, agent: AGENT,
    prep: opts.prep || { outfitDesc: '테스트 착장', coaching: '테스트 지침', speech: '테스트 연설' },
    handlers: {
      judge: j => events.judge.push(j),
      bubble: (who, text) => events.bubbles.push({ who, text }),
      vibe: v => events.vibes.push(v),
      emote: (slot, kind) => events.emotes.push({ slot, kind }),
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
  const judges = llm.byLabel('판정');
  assert.ok(judges.length >= TOTAL_TURNS);
  for (const j of judges) {
    assert.match(j.judgeUser, /상대의 실제 반응/, '반응 블록이 없으면 심판이 허공에 대고 채점한다');
    assert.match(j.judgeUser, /타겟 응답 #|차림새가 그렇군요/, '반응 본문이 실제로 들어가 있다');
  }
  // 첫인상 판정에는 착장에 대한 첫 반응이 들어간다
  const first = llm.byLabel('첫인상')[0];
  assert.match(first.messages[0].content, /차림새가 그렇군요/);
});

test('심판이 채점하는 발언과 그 반응이 실제로 짝이 맞는다', async () => {
  const llm = new FakeLlm();
  await playFull(llm);
  for (const j of llm.byLabel('판정')) {
    const subject = j.judgeUser.match(/이번 발언\]\n(클라이언트 발언 #\d+)/)?.[1];
    const reaction = j.judgeUser.match(/실제 반응\]\n(타겟 응답 #\d+)/)?.[1];
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

test('국장 브리핑은 LLM을 쓰지 않는다', async () => {
  const llm = new FakeLlm();
  await playFull(llm);
  assert.equal(llm.calls.filter(c => /브리핑/.test(c.label)).length, 0, '브리핑 호출이 남아 있다');
});

test('대면 상황 생성은 문자 마지막 턴 배치에 미리 태워진다', async () => {
  const llm = new FakeLlm();
  const engine = new Engine(llm, { couple, prep: {}, agent: AGENT, handlers: {} });
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
  // 시스템 프롬프트가 턴마다 바이트 동일해야 캐시가 붙는다.
  // 공기(vibe)를 시스템이 아니라 메시지로 흘려보내는 이유가 이것이다.
  const sys = llm.byLabel('문자 발언').map(c => c.system);
  assert.equal(new Set(sys).size, 1, '문자 페이즈 클라이언트 시스템 프롬프트가 턴마다 달라지면 캐시가 깨진다');
  const jsys = llm.byLabel('판정').map(c => c.system);
  assert.equal(new Set(jsys).size, 1, '심판 시스템 프롬프트는 항상 동일해야 한다');
});

// ── 공기(텍스트 분위기) ─────────────────────────────────
// 공기는 읽을 줄 아는 인물에게만 간다. 못 읽는 인물에게 알려주면 그 인물이 아니게 된다.
const VIBE_JUDGE = () => {
  let n = 0;
  return () => ({
    tier: 'nudge', moodDelta: 1, loveDelta: 2, reason: 'r',
    vibe: `공기 상태 ${++n}`, revealed: '', clientEmote: 'talk', targetEmote: 'talk',
  });
};
const injectedVibes = (llm) => llm.byLabel('대면 발언')
  .flatMap(c => c.messages.map(m => String(m.content)))
  .filter(t => t.includes('[지금 이 자리의 공기]'));

test('눈치 빠른 의뢰인에게는 갱신된 공기가 그대로 전달된다', async () => {
  const sharp = COUPLES.find(c => c.client.flaw.reads === 'well');
  assert.ok(sharp, '테스트 전제: 공기를 잘 읽는 의뢰인이 있어야 한다');
  const llm = new FakeLlm({ judge: VIBE_JUDGE() });
  const { events, engine } = await playFull(llm, { couple: sharp });
  assert.ok(events.vibes.length >= 3, '공기가 UI로는 항상 흘러야 한다 (요원은 본다)');
  assert.match(engine.state.vibe, /공기 상태 \d+/);
  const injected = injectedVibes(llm);
  assert.ok(injected.length >= 1, '공기가 클라이언트 프롬프트에 주입되지 않았다');
  assert.ok(injected.some(t => /공기 상태 \d+/.test(t)));
});

test('공기를 못 읽는 의뢰인에게는 한 번도 전달되지 않는다', async () => {
  const blind = COUPLES.find(c => c.client.flaw.reads === 'none');
  assert.ok(blind, '테스트 전제: 공기를 못 읽는 의뢰인이 있어야 한다');
  const llm = new FakeLlm({ judge: VIBE_JUDGE() });
  const { events } = await playFull(llm, { couple: blind });
  assert.equal(injectedVibes(llm).length, 0, '눈치 없는 인물이 분위기를 알고 있으면 안 된다');
  // 요원(UI)에게는 여전히 보인다 — 못 읽는 건 의뢰인이지 요원이 아니다
  assert.ok(events.vibes.length >= 3, '요원 화면에는 공기가 떠야 한다');
});

test('눈치가 반쯤인 의뢰인은 갱신을 띄엄띄엄 받는다', async () => {
  const half = COUPLES.find(c => c.client.flaw.reads === 'some');
  const sharp = COUPLES.find(c => c.client.flaw.reads === 'well');
  const runOne = async (couple) => {
    const llm = new FakeLlm({ judge: VIBE_JUDGE() });
    await playFull(llm, { couple });
    return injectedVibes(llm).length;
  };
  const [halfN, sharpN] = [await runOne(half), await runOne(sharp)];
  assert.ok(halfN < sharpN, `반쯤(${halfN})이 잘 읽는 쪽(${sharpN})보다 적게 받아야 한다`);
});

test('같은 공기를 매 턴 반복해서 주입하지 않는다', async () => {
  const sharp = COUPLES.find(c => c.client.flaw.reads === 'well');
  const llm = new FakeLlm();   // 항상 같은 vibe를 돌려준다
  await playFull(llm, { couple: sharp });
  const last = llm.byLabel('대면 발언').at(-1).messages
    .map(m => String(m.content)).join('\n');
  const times = (last.match(/\[지금 이 자리의 공기\]/g) || []).length;
  // 9턴을 도는 동안 3회면 충분하다: 시작 공기 1회, 심판이 처음 갱신했을 때 1회,
  // 그리고 자리가 문자→대면으로 바뀌었을 때 1회. 값이 안 바뀌면 다시 말하지 않는다.
  assert.ok(times <= 3, `공기가 ${times}번 반복 주입됐다`);
  assert.ok(times < TOTAL_TURNS, '턴마다 같은 문장을 다시 밀어넣고 있다');
});

test('타겟에게는 공기를 주입하지 않는다 (공기는 심판이 타겟 반응을 보고 쓴 것이다)', async () => {
  const llm = new FakeLlm();
  await playFull(llm);
  const leaked = llm.byLabel('대면 응답')
    .flatMap(c => c.messages.map(m => String(m.content)))
    .some(t => t.includes('[지금 이 자리의 공기]'));
  assert.equal(leaked, false);
});

// ── 대화 내역 이월 ───────────────────────────────────────
test('대면에서 문자 대화 내역을 이어받는다', async () => {
  const llm = new FakeLlm();
  await playFull(llm);
  const firstTalk = llm.byLabel('대면 발언')[0].messages;
  const flat = firstTalk.map(m => String(m.content)).join('\n');
  assert.ok(firstTalk.length > 2, '대면 첫 발언이 빈 컨텍스트에서 시작하면 초면처럼 군다');
  assert.ok(flat.includes('클라이언트 발언 #1'), '자기가 보낸 첫 문자를 기억해야 한다');
  assert.ok(flat.includes('타겟 응답 #1'), '상대의 답장도 기억해야 한다');
  assert.ok(flat.includes('[상황 전환]'), '자리가 바뀐 사실이 명시되어야 한다');

  const firstTalkTarget = llm.byLabel('대면 응답')[0].messages.map(m => String(m.content)).join('\n');
  assert.ok(firstTalkTarget.includes('클라이언트 발언 #1'), '상대도 주고받은 문자를 기억한다');
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
    .filter(t => t.includes('[본부 명령'));
  assert.ok(injected.length >= 1, '무전이 클라이언트 프롬프트에 주입되지 않았다');
  assert.ok(injected.some(t => t.includes('상대에게는 안 들린다')));
  assert.ok(injected.some(t => t.includes('즉시 이행하라')), '무전은 부탁이 아니라 명령으로 들어가야 한다');
});

test('무전은 그 자체로 게이지를 바꾸지 않는다 (채점 대상이 아니다)', async () => {
  const llm = new FakeLlm();
  const engine = new Engine(llm, { couple, prep: {}, agent: AGENT, handlers: {} });
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
  const engine = new Engine(llm, { couple, prep: {}, agent: AGENT, handlers: {} });
  engine.radioLeft = 1;
  engine.submitRadio('문자 막판 지시');
  assert.ok(engine.pendingRadio);
  await engine.runTalking({ place: 'p', intro: 'i', outfitReaction: 'r', vibe: 'v' });
  const leaked = llm.byLabel('대면 발언')
    .flatMap(c => c.messages.map(m => String(m.content)))
    .some(t => t.includes('문자 막판 지시'));
  assert.equal(leaked, false, '문자 페이즈에서 못 쓴 지시가 대면 맥락으로 새어나가면 안 된다');
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
  assert.ok(clientSys.includes('박큐피드'), '요원 이름이 지침의 출처로 들어간다');
  // 준비물을 채점하는 호출이 없어야 한다
  const scoring = llm.calls.filter(c => /스타일링 채점|코칭 채점|연설 채점|무전 정확도/.test(c.label));
  assert.equal(scoring.length, 0, '준비물 채점 호출이 남아 있다');
});

test('타겟 에이전트는 착장을 알고, 클라이언트는 상대의 비밀을 모른다', async () => {
  const llm = new FakeLlm();
  await playFull(llm, { prep: { outfitDesc: '형광 주황 턱시도', coaching: '', speech: '' } });
  const targetSys = llm.byLabel('대면 응답')[0].system;
  assert.ok(targetSys.includes('형광 주황 턱시도'));
  const clientSys = llm.byLabel('대면 발언')[0].system;
  for (const h of couple.target.hiddenPrefs) {
    assert.ok(!clientSys.includes(h), `클라이언트 프롬프트에 상대의 비밀이 새어 있다: ${h}`);
  }
});

// ── 준비 단계 반응 ───────────────────────────────────────
test('취조실·정문 반응은 별도 호출이고 게이지를 건드리지 않는다', async () => {
  const llm = new FakeLlm();
  const r1 = await prepReaction(llm, { couple, agent: AGENT, scene: 'coaching', text: '말 짧게 해라' });
  const r2 = await prepReaction(llm, { couple, agent: AGENT, scene: 'speech', text: '' });
  assert.equal(r1.reaction, '알겠습니다만');
  assert.equal(r2.face, 'cringe');
  assert.deepEqual(llm.calls.map(c => c.label), ['취조실 반응', '정문 반응']);
  // 지침 원문과 요원 이름이 실제로 전달됐는지
  assert.ok(llm.calls[0].messages[0].content.includes('말 짧게 해라'));
  assert.ok(llm.calls[0].messages[0].content.includes('박큐피드'));
});

// ── 판정 결과가 상태에 제대로 꽂히는지 ──────────────────
test('새로 드러난 것이 중복 없이 누적되고 디브리핑에 반영된다', async () => {
  const facts = ['밤에 별을 본다', '형 얘기를 못 한다', '사실 밴드를 하고 싶었다'];
  let n = 0;
  const llm = new FakeLlm({
    judge: () => ({
      tier: 'warm', moodDelta: 3, loveDelta: 5, reason: 'r', vibe: 'v',
      revealed: facts[n++ % (facts.length + 2)] || '',   // 목록을 한 바퀴 돌면 빈 값
      clientEmote: 'talk', targetEmote: 'talk',
    }),
  });
  const { result } = await playFull(llm);
  assert.deepEqual(result.state.revealed, facts, '중복 없이 순서대로 쌓인다');
  assert.equal(result.debrief.revealed.length, facts.length);
  const note = result.debrief.notes.find(n2 => n2.key === 'revealed');
  assert.equal(note.value, `${facts.length}건`);
});

test('좋은 판정이 계속 나오면 성사된다', async () => {
  const llm = new FakeLlm({
    judge: () => ({
      tier: 'breakthrough', moodDelta: 6, loveDelta: 9, reason: 'r', vibe: 'v', revealed: '',
      clientEmote: 'proud', targetEmote: 'laugh',
    }),
  });
  const { result } = await playFull(llm);
  assert.ok(result.verdict.accepted, `성사되지 않았다 (호감 ${result.verdict.love}/${result.difficulty.threshold})`);
});

test('분위기가 0이면 즉시 파탄나고 남은 턴을 돌지 않는다', async () => {
  const llm = new FakeLlm({
    judge: () => ({
      tier: 'disaster', moodDelta: -10, loveDelta: -9, reason: '정색', vibe: '얼어붙었다', revealed: '',
      clientEmote: 'panic', targetEmote: 'angry',
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
    if (a.label.startsWith('판정') || a.label.startsWith('첫인상')) throw new Error('심판 다운');
    return orig(a);
  };
  const { result } = await playFull(llm);
  assert.equal(result.state.history.length, TOTAL_TURNS + 1, '판정이 실패해도 턴은 전부 기록된다');
  assert.ok(result.state.history.every(h => h.tier === 'flat'), '실패 시 중립(flat) 처리');
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

test('감정 신호가 UI로 전달된다', async () => {
  const llm = new FakeLlm();
  const { events } = await playFull(llm);
  assert.ok(events.emotes.length >= TOTAL_TURNS, '판정마다 두 사람의 표정이 나와야 한다');
  assert.ok(events.emotes.some(e => e.slot === 'client'));
  assert.ok(events.emotes.some(e => e.slot === 'target' && e.kind === 'nod'));
});

test('snapshot이 UI가 필요한 값을 모두 담는다', async () => {
  const llm = new FakeLlm();
  const engine = new Engine(llm, { couple, prep: {}, agent: AGENT, handlers: {} });
  const s = engine.snapshot();
  for (const k of ['love', 'mood', 'threshold', 'moodFloor', 'mult', 'radioLeft',
    'revealedCount', 'secretTotal', 'visibleTotal']) {
    assert.equal(typeof s[k], 'number', `snapshot.${k} 누락`);
  }
  assert.ok(Array.isArray(s.revealed));
  assert.equal(typeof s.vibe, 'string');
  assert.ok(s.vibe.length > 0, '판정 전에도 보여줄 공기가 있어야 한다');
  assert.equal(s.secretTotal, couple.target.hiddenPrefs.length);
  assert.equal(s.visibleTotal, couple.target.visiblePrefs.length);
});

// ── 계기판이 받는 정보 ────────────────────────────────────────────────
// 화면에 띄우려면 snapshot이 먼저 알아야 한다.

test('snapshot은 계기판이 필요한 것을 전부 담는다', async () => {
  const llm = new FakeLlm();
  const couple = COUPLES.find(c => c.client.flaw.reads === 'none');
  const engine = new Engine(llm, { couple, prep: {}, agent: AGENT, handlers: {} });
  await engine.runTexting();
  const s = engine.snapshot();

  for (const k of ['loveSat', 'turnsLeft', 'turnsTotal', 'reads', 'secretLeft']) {
    assert.ok(k in s, `snapshot에 ${k}가 없다 — 계기판이 이걸 못 띄운다`);
  }
  assert.equal(s.reads, 'none', '공기를 못 읽는 의뢰인이면 계기판도 그렇게 알아야 한다');
  assert.ok(s.loveSat > 0 && s.loveSat <= 1, `포화 계수가 범위 밖: ${s.loveSat}`);
  assert.equal(s.turnsTotal, engine.d.textTurns);
  // 계기판의 '미확인 n건'은 디브리핑의 '비밀 n/3'과 같은 함수에서 나와야 한다.
  // 뺄셈으로 때우면 심판의 자유 문장 개수가 그대로 새서 두 화면이 다른 말을 한다.
  const S = await import('../js/scoring.js');
  const expected = S.surfacedSecrets(couple, engine.fullTranscript(), [...engine.state.revealed]).missed.length;
  assert.equal(s.secretLeft, expected, '계기판과 사후 보고의 비밀 집계가 어긋난다');
  assert.ok(s.secretLeft <= couple.target.hiddenPrefs.length);
});

test('남은 턴이 실제로 줄어든다', async () => {
  const llm = new FakeLlm();
  const seen = [];
  const couple = COUPLES.find(c => c.client.flaw.reads === 'well');
  const engine = new Engine(llm, {
    couple, prep: {}, agent: AGENT,
    handlers: { turn: () => seen.push(engine.snapshot().turnsLeft) },
  });
  await engine.runTexting();
  assert.ok(seen.length >= 2, '턴 핸들러가 안 불렸다');
  assert.ok(seen[0] > seen[seen.length - 1], `남은 턴이 안 줄었다: ${seen.join(',')}`);
  assert.equal(seen[0], engine.d.textTurns, '첫 턴에는 전부 남아 있어야 한다');
});

test('페이즈가 바뀌는 즉시 잔여 턴이 새 페이즈 기준으로 갱신된다', async () => {
  const llm = new FakeLlm();
  const couple = COUPLES.find(c => c.client.flaw.reads === 'well');
  const snaps = [];
  const engine = new Engine(llm, {
    couple, prep: {}, agent: AGENT,
    handlers: { meters: s => snaps.push({ phase: s.phase, left: s.turnsLeft, total: s.turnsTotal }) },
  });
  await engine.runTexting();
  const sit = await engine.situation();
  snaps.length = 0;
  await engine.runTalking(sit);
  const first = snaps[0];
  assert.equal(first.phase, 'talk', '대면 첫 계기판 갱신이 아직 문자 페이즈로 표시된다');
  assert.equal(first.total, engine.d.talkTurns, `대면 총 턴이 ${first.total}로 잘못 나온다`);
  assert.equal(first.left, engine.d.talkTurns, '대면 시작인데 남은 턴이 0으로 보인다');
});
