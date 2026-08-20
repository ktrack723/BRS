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

// 문자 페이즈의 판정이 대면 화면까지 따라오면 플레이어에게는 그냥 오작동으로 보인다.
// 예전에는 미결 판정이 runTalking 안에서 정산돼서, 장소·도입부·상대의 첫마디가 이미 뜬 뒤에
// "문자 8턴 판정"이 뒤늦게 찍혔다.
test('문자 페이즈 판정은 대면이 시작되기 전에 전부 끝난다', async () => {
  const llm = new FakeLlm();
  const events = [];
  const engine = new Engine(llm, {
    couple, agent: AGENT,
    prep: { outfitDesc: '테스트 착장', coaching: '', speech: '' },
    handlers: {
      judge: j => events.push({ kind: 'judge', turn: j.turn || '' }),
      bubble: (who, text) => events.push({ kind: 'bubble', who, text }),
    },
  });
  await engine.runTexting();
  // 문자 페이즈가 끝난 시점에 미결 판정이 남아 있으면 안 된다
  assert.equal(engine.pendingJudge, null, '문자 페이즈가 미결 판정을 대면으로 넘겼다');
  const afterText = events.length;

  const sit = await engine.situation();
  await engine.runTalking(sit);

  // 대면 시작 이후에 나온 판정 중 '문자'짜리가 있으면 안 된다
  const leaked = events.slice(afterText).filter(e => e.kind === 'judge' && /문자/.test(e.turn));
  assert.deepEqual(leaked, [], `대면 시작 후에 문자 판정이 ${leaked.length}건 새어나왔다`);

  // 정산 순서도 확인한다 — 문자 마지막 판정이 대면 장소 안내보다 먼저 나와야 한다
  const lastTextJudge = events.findLastIndex(e => e.kind === 'judge' && /문자/.test(e.turn));
  const placeBubble = events.findIndex(e => e.kind === 'bubble' && e.who === 'sys' && /테스트 광장/.test(e.text));
  assert.ok(lastTextJudge >= 0 && placeBubble >= 0, '테스트 전제: 둘 다 발생해야 한다');
  assert.ok(lastTextJudge < placeBubble,
    '문자 마지막 판정이 대면 장소 안내보다 뒤에 나온다');
});

// ── 심판이 '상대의 실제 반응'을 본다 ────────────────────
test('심판에게 타겟의 실제 반응이 함께 전달된다', async () => {
  const llm = new FakeLlm();
  await playFull(llm);
  const judges = llm.byLabel('판정');
  assert.ok(judges.length >= TOTAL_TURNS);
  for (const j of judges) {
    assert.match(j.judgeUser, /THE OTHER PERSON'S ACTUAL REACTION/, '반응 블록이 없으면 심판이 허공에 대고 채점한다');
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
    const reaction = j.judgeUser.match(/ACTUAL REACTION TO IT\]\n(타겟 응답 #\d+)/)?.[1];
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
  .filter(t => t.includes('[THE AIR AT THIS TABLE RIGHT NOW]'));

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
  const times = (last.match(/\[THE AIR AT THIS TABLE RIGHT NOW\]/g) || []).length;
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
    .some(t => t.includes('[THE AIR AT THIS TABLE RIGHT NOW]'));
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
  assert.ok(flat.includes('[SCENE CHANGE]'), '자리가 바뀐 사실이 명시되어야 한다');

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
    .filter(t => t.includes('[ORDER FROM HQ'));
  assert.ok(injected.length >= 1, '무전이 클라이언트 프롬프트에 주입되지 않았다');
  assert.ok(injected.some(t => t.includes('other person cannot hear it')));
  assert.ok(injected.some(t => t.includes('carry this out with your very next line')),
    '무전은 부탁이 아니라 명령으로 들어가야 한다');
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
      clientEmote: 'proud', targetEmote: 'laugh', barrierAddressed: true,
    }),
  });
  const { result } = await playFull(llm);
  assert.ok(result.verdict.accepted, `성사되지 않았다 (호감 ${result.verdict.love}/${result.difficulty.threshold})`);
});

// 장벽은 관문이 아니라 밀당의 대표 아젠다다. 호감으로 넘어간다 —
// 마음이 충분하면 사람은 이런 걸 감수하기로 하고, 이 게임도 그렇게 친다.
// (한동안 관문이었고 그게 준비 수준을 갈랐다. 지금 그 자리는 대화 불능이 맡는다.)
test('현안을 끝내 안 다뤄도 호감이 넘으면 성사된다', async () => {
  const llm = new FakeLlm({
    judge: () => ({
      tier: 'breakthrough', moodDelta: 6, loveDelta: 9, reason: 'r', vibe: 'v', revealed: '',
      clientEmote: 'proud', targetEmote: 'laugh', barrierAddressed: false,
    }),
  });
  const { engine, result } = await playFull(llm);
  assert.equal(engine.state.barrierCleared, false, '아무도 안 꺼냈는데 다뤄진 것으로 잡혔다');
  assert.ok(result.verdict.love >= result.difficulty.threshold, '테스트 전제: 호감은 넘어야 한다');
  assert.equal(result.verdict.accepted, true, '호감이 넘었는데 현안 때문에 막혔다');
  assert.equal(result.verdict.reason, 'ok', '차임 결말이 아직 살아 있다');
  // 그래도 기록에는 남아야 한다 — 참고 컨텍스트로서
  const note = result.debrief.notes.find(n => n.key === 'barrier');
  assert.ok(note && !note.ok, '현안이 사후 보고에서 사라졌다');
});

// 싫어하는데 사귄다. 협박으로 묶은 쪽.
test('호감이 모자라도 압박이 쌓이면 묶인다', async () => {
  const llm = new FakeLlm({
    judge: (rec, n) => ({
      tier: 'flat', moodDelta: 0, loveDelta: 0, reason: 'r', vibe: 'v', revealed: '',
      clientEmote: 'smug', targetEmote: 'freeze', barrierAddressed: false,
      leverage: n <= 3 ? 'hard' : 'none',
    }),
  });
  const { engine, result } = await playFull(llm);
  assert.ok(engine.state.leverage >= 5, `압박이 ${engine.state.leverage}점뿐이다`);
  assert.ok(result.verdict.love < result.difficulty.threshold, '테스트 전제: 호감은 모자라야 한다');
  assert.equal(result.verdict.accepted, true, '압박이 쌓였는데 안 묶였다');
  assert.equal(result.verdict.reason, 'coerced');
  assert.equal(result.verdict.grade, 'C', '강압 성사는 등급이 고정이다');
});

test('압박이 한두 번으로는 사람을 못 묶는다', async () => {
  const llm = new FakeLlm({
    judge: (rec, n) => ({
      tier: 'flat', moodDelta: 0, loveDelta: 0, reason: 'r', vibe: 'v', revealed: '',
      clientEmote: 'smug', targetEmote: 'freeze', barrierAddressed: false,
      leverage: n === 1 ? 'hard' : 'none',
    }),
  });
  const { engine, result } = await playFull(llm);
  assert.equal(engine.state.leverage, 2);
  assert.equal(result.verdict.accepted, false, '협박 한 번에 성사되면 무전 한 방짜리 게임이다');
  assert.notEqual(result.verdict.reason, 'coerced');
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

// ── UI가 대화를 붙잡아 둘 수 있어야 한다 ────────────────
// 말풍선이 도착하는 즉시 다음 턴이 시작되면, 읽는 사람은 스크롤이 지나간 뒤에야 뭔가 있었음을 안다.
// 하네스는 핸들러가 돌려준 약속을 기다려야 하고, 그동안 새 LLM 호출이 나가면 안 된다.
test('bubble·judge 핸들러가 끝날 때까지 다음 호출이 나가지 않는다', async () => {
  const llm = new FakeLlm();
  const timeline = [];
  const hold = ms => new Promise(r => setTimeout(r, ms));
  const engine = new Engine(llm, {
    couple, agent: AGENT, prep: { outfitDesc: '테스트 착장' },
    handlers: {
      bubble: async (who) => {
        timeline.push(`bubble:${who}:start`);
        await hold(20);
        timeline.push(`bubble:${who}:end`);
      },
      judge: async () => { timeline.push('judge:start'); await hold(20); timeline.push('judge:end'); },
    },
  });
  const seen = new Set();
  const origCall = llm.call.bind(llm);
  llm.call = args => { timeline.push(`call:${args.label}`); seen.add(args.label); return origCall(args); };

  await engine.runTexting();

  // 붙잡는 중에 호출이 끼어들었다면 start와 end 사이에 call이 들어온다
  for (let i = 0; i < timeline.length; i++) {
    if (!timeline[i].endsWith(':start')) continue;
    const end = timeline.indexOf(timeline[i].replace(':start', ':end'), i);
    const between = timeline.slice(i + 1, end).filter(e => e.startsWith('call:'));
    assert.deepEqual(between, [], `${timeline[i]} 도중에 호출이 나갔다: ${between.join(', ')}`);
  }
  assert.ok(timeline.filter(e => e === 'bubble:client:start').length >= D.textTurns, '발언마다 붙잡아야 한다');
  assert.ok(timeline.includes('judge:start'), '판정도 붙잡을 수 있어야 한다');
});

test('핸들러가 약속을 돌려주지 않아도 그냥 흘러간다', async () => {
  const llm = new FakeLlm();
  const { result } = await playFull(llm);   // 전부 동기 핸들러
  assert.ok(result.verdict, '동기 핸들러에서도 끝까지 돈다');
});

// ── 케미가 좋으면 자리가 길어진다 ──────────────────────────────────────
// 대화가 잘 풀리는데 예정된 턴에서 칼같이 끊기면, 잘 풀렸다는 사실 자체가 무의미해진다.

// 자리가 길어질지는 이제 **심판이 정한다** — 케미가 아니라 "더 갈 데 있나"를 답한다.
test('심판이 더 갈 데 있다고 하면 턴이 늘어난다', async () => {
  const S = await import('../js/scoring.js');
  const llm = new FakeLlm({
    judge: () => ({
      tier: 'warm', moodDelta: 9, loveDelta: 5, reason: '잘 풀린다', keepGoing: true,
      vibe: '둘 다 웃고 있다', revealed: '', clientEmote: 'laugh', targetEmote: 'laugh',
    }),
  });
  const couple = COUPLES.find(c => c.difficulty === '쉬움');
  const events = [];
  const engine = new Engine(llm, {
    couple, prep: {}, agent: AGENT, handlers: { extend: e => events.push(e) },
  });
  await engine.runTexting();
  const sit = await engine.situation();
  await engine.runTalking(sit);

  assert.ok(events.length >= 1, '심판이 계속 "더 갈 데 있다"고 했는데 한 턴도 안 늘어났다');
  for (const e of events) {
    assert.ok(e.extra <= S.EXTENSION.maxExtra[e.phase], `${e.phase} 연장 상한을 넘었다`);
    assert.ok(e.turns > (e.phase === 'text' ? engine.d.textTurns : engine.d.talkTurns),
      '연장됐다면서 예정 턴을 안 넘었다');
  }
});

test('대화가 미지근하면 턴이 늘어나지 않는다', async () => {
  const llm = new FakeLlm({
    judge: () => ({
      tier: 'flat', moodDelta: 0, loveDelta: 0, reason: '아무 일도 없다',
      vibe: '침묵', revealed: '', clientEmote: 'talk', targetEmote: 'talk',
    }),
  });
  const couple = COUPLES.find(c => c.difficulty === '쉬움');
  const events = [];
  const engine = new Engine(llm, {
    couple, prep: {}, agent: AGENT, handlers: { extend: e => events.push(e) },
  });
  await engine.runTexting();
  assert.equal(events.length, 0, '미지근한데 자리가 길어졌다');
  assert.equal(engine.phaseTurns, engine.d.textTurns);
});

// 분위기 조건은 폐지했다 — 자리 길이를 정하는 건 심판의 keepGoing 하나다.
// 대신 반대쪽을 본다: 심판이 연달아 "더 갈 데 없다"고 하면 자리가 일찍 끊긴다.
test('심판이 더 갈 데 없다고 하면 자리가 일찍 끊긴다', async () => {
  const llm = new FakeLlm({
    judge: () => ({
      tier: 'flat', moodDelta: 0, loveDelta: 0, reason: '할 말이 없다', keepGoing: false,
      vibe: '침묵', revealed: '', clientEmote: 'talk', targetEmote: 'talk',
    }),
  });
  const couple = COUPLES.find(c => c.difficulty === '쉬움');
  const engine = new Engine(llm, { couple, prep: {}, agent: AGENT, handlers: {} });
  await engine.runTexting();
  const textTurns = engine.state.turns;
  assert.ok(textTurns < engine.d.textTurns,
    `할 말이 없는데 문자 페이즈를 다 돌았다 (${textTurns}/${engine.d.textTurns})`);
  const sys = engine.transcript.filter(t => t.who === 'sys').map(t => t.text).join(' ');
  assert.match(sys, /답장이 끊겼다/, '왜 끊겼는지 화면에 안 나온다');
});

test('사망 판정이 나오면 공작이 그 자리에서 종료된다', async () => {
  // 3번째 판정에서 상대가 죽는다
  const llm = new FakeLlm({
    judge: (rec, n) => ({
      tier: n === 3 ? 'disaster' : 'nudge', moodDelta: n === 3 ? -5 : 2, loveDelta: n === 3 ? -8 : 2,
      reason: n === 3 ? '칼을 든 사람을 밀었다' : '무난', vibe: '공기', revealed: '',
      clientEmote: 'panic', targetEmote: 'dead',
      casualty: n === 3 ? 'target' : 'none',
      casualtyNote: n === 3 ? '뒷걸음질치다 분화구 쪽으로 넘어갔다' : '',
    }),
  });
  const { engine, events, result } = await playFull(llm);

  assert.equal(engine.state.casualty, 'target', '사망이 기록되지 않았다');
  assert.equal(engine.aborted, true, '사람이 죽었는데 공작이 계속됐다');
  assert.equal(engine.abortReason, 'death', `중단 사유가 ${engine.abortReason}다`);
  assert.equal(result.verdict.reason, 'death');
  assert.equal(result.verdict.grade, 'F');
  assert.equal(result.verdict.accepted, false);

  // 파탄 문구가 읽씹이 아니라 사망이어야 한다
  const sys = events.bubbles.filter(b => b.who === 'sys').map(b => b.text).join('\n');
  assert.match(sys, /사망했다/, '사망 안내가 안 나갔다');
  assert.match(sys, /분화구/, '사망 경위가 안 실렸다');
  assert.ok(!/읽씹/.test(sys), '사망인데 읽씹 문구가 나갔다');

  // 죽은 뒤로는 더 이상 발언이 없어야 한다
  const deadAt = events.bubbles.findIndex(b => b.who === 'sys' && /사망했다/.test(b.text));
  const after = events.bubbles.slice(deadAt + 1).filter(b => b.who === 'client' || b.who === 'target');
  assert.deepEqual(after, [], `사망 후에 대사가 ${after.length}줄 더 나왔다`);
});

test('사망이 없으면 사상자 칸은 계속 none이다', async () => {
  const llm = new FakeLlm();
  const { engine, result } = await playFull(llm);
  assert.equal(engine.state.casualty, 'none');
  assert.notEqual(result.verdict.reason, 'death');
});

// 나레이터는 '어디서 만났고 상대가 뭐라고 했나'만 만든다. 본부가 무엇을 시켰는지는 그 장면에 쓸 일이 없고,
// 알면 의뢰인을 '지시받는 사람'으로 그리기 시작한다. 심판과 기록관에게는 그대로 가야 한다.
test('무전 내용이 나레이터에게는 안 가고 심판·기록관에게는 간다', async () => {
  const llm = new FakeLlm();
  const RADIO = '무전전용문장XYZ';
  await playFull(llm, { onTurn: (engine) => { if (engine.radioLeft > 0) engine.submitRadio(RADIO); } });

  const sit = llm.calls.find(c => c.label.includes('상황 생성'));
  assert.ok(sit, '상황 생성 호출이 없다');
  assert.ok(!sit.messages[0].content.includes(RADIO), '나레이터에게 무전이 새어나갔다');
  assert.ok(!/HQ RADIO/.test(sit.messages[0].content), '나레이터 기록에 무전 라벨이 남아 있다');
  // 다만 실제 대사는 그대로 넘어가야 한다 — 안 그러면 장소를 정할 근거가 사라진다
  assert.match(sit.messages[0].content, /클라이언트 발언 #1/, '나레이터가 문자 내용을 못 받았다');

  const judged = llm.byLabel('판정').some(c => c.judgeUser.includes(RADIO));
  assert.ok(judged, '심판이 무전을 못 봤다 — 화제가 튄 이유를 모르게 된다');
  const letter = llm.calls.find(c => c.label === '결과 편지');
  assert.ok(letter.messages[0].content.includes(RADIO), '기록관이 무전을 못 봤다 — 편지의 재료가 사라진다');
});

test('사망 안내의 조사가 받침에 맞는다', async () => {
  // "트럼푸이(가) 사망했다"는 판에서 제일 크게 읽히는 문장에서 김을 뺀다
  const mk = (name) => new FakeLlm({
    judge: (rec, n) => ({
      tier: n === 2 ? 'disaster' : 'nudge', moodDelta: 0, loveDelta: n === 2 ? -8 : 1,
      reason: '', vibe: '', revealed: '', clientEmote: 'panic', targetEmote: 'dead',
      casualty: n === 2 ? 'target' : 'none', casualtyNote: '',
    }),
  });
  // 받침 없는 이름(도날두 트럼푸) → "가", 받침 있는 이름(윤도우 → 우, 받침 없음) 둘 다 확인
  for (const [id, expect] of [['politics', '트럼푸가 사망했다'], ['gamer-activist', '정화연이 사망했다']]) {
    const llm = mk();
    const { events } = await playFull(llm, { couple: COUPLE_BY_ID[id] });
    const sys = events.bubbles.filter(b => b.who === 'sys').map(b => b.text).join('\n');
    assert.match(sys, new RegExp(expect), `${id}: 조사가 안 맞는다`);
    assert.ok(!/이\(가\)/.test(sys), `${id}: 조사 괄호 표기가 남았다`);
  }
});
