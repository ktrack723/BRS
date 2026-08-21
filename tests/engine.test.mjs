// node --test — 하네스(engine.js) 통합 테스트. 가짜 LLM으로 돌리므로 API 키가 필요 없다.
// 합(bout) 단위 판정: 교환이 BOUT.size만큼 쌓이면 심판이 한 번 돌고, 경계는 심판이 carry로 자른다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, prepReaction } from '../js/engine.js';
import { COUPLE_BY_ID } from '../js/couples.js';
import { diffOf, BOUT } from '../js/scoring.js';

const couple = COUPLE_BY_ID['os-war'];
const D = diffOf(couple.difficulty);
const TOTAL = D.textTurns + D.talkTurns;   // 기본 교환 수 (연장 없을 때)
const AGENT = { name: '박큐피드', gender: '기밀' };

// 기본 합 개수: 페이즈마다 ⌈교환/합⌉ — 문자 6→2합, 대면 8→2합. + 첫인상 1.
const BOUTS_TEXT = Math.ceil(D.textTurns / BOUT.size);
const BOUTS_TALK = Math.ceil(D.talkTurns / BOUT.size);

class FakeLlm {
  constructor({ judge } = {}) {
    this.calls = [];
    this.inFlight = 0;
    this.maxInFlight = 0;
    // keepGoing을 일부러 뺀다 — 명시적 답이 없으면 자리 길이가 안 움직여서 판이 결정적이 된다.
    this.judgeFn = judge || (() => ({
      carry: 0, tier: 'nudge', loveDelta: 0, reason: '무난', vibe: '대화는 굴러간다',
      revealed: '', clientEmote: 'talk', targetEmote: 'nod',
      casualty: 'none', casualtyNote: '', leverage: 'none', walkout: false,
    }));
  }
  async call({ label, system, messages, schema, cache }) {
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    const rec = { label, system, messages: structuredClone(messages), schema: !!schema, cache: !!cache };
    this.calls.push(rec);
    await new Promise(r => setTimeout(r, 5));
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

// ── 합 회계: 누락도 중복도 없어야 한다 ───────────────────
test('모든 교환이 정확히 한 번씩 어떤 합에 채점된다', async () => {
  const llm = new FakeLlm();
  const { engine, result } = await playFull(llm);
  const clientMsgs = engine.transcript.filter(t => t.who === 'client').length;
  assert.equal(clientMsgs, TOTAL, `교환 ${TOTAL}회`);
  const judged = result.state.history.filter(h => !h.firstImpression);
  assert.equal(judged.reduce((a, h) => a + h.exchanges, 0), TOTAL,
    '합에 실린 교환 수의 합이 실제 교환 수와 다르다 — 누락이나 중복이 있다');
  assert.equal(result.state.history.length, BOUTS_TEXT + BOUTS_TALK + 1, '첫인상 포함 합 수');
});

test('심판 호출이 교환당 1회가 아니라 합당 1회다', async () => {
  const llm = new FakeLlm();
  await playFull(llm);
  const judges = llm.byLabel('판정').length;
  assert.equal(judges, BOUTS_TEXT + BOUTS_TALK, `심판 ${judges}회 — 합보다 많으면 토큰 최적화가 깨진 것`);
  assert.ok(judges < TOTAL / 2, '교환 수의 절반보다 적어야 한다');
});

test('심판에게 합 전체와 직전 맥락이 같이 간다', async () => {
  const llm = new FakeLlm();
  await playFull(llm);
  const first = llm.byLabel('판정')[0];
  assert.ok(first.judgeUser.includes('THE BOUT UNDER JUDGEMENT'));
  assert.ok(first.judgeUser.includes('클라이언트 발언 #1'));
  assert.ok(first.judgeUser.includes(`클라이언트 발언 #${BOUT.size}`), '합에 마지막 교환이 빠졌다');
  assert.ok(first.judgeUser.includes('타겟 응답 #1'), '상대의 실제 반응 없이 채점하고 있다');
});

test('문자 페이즈 판정은 대면이 시작되기 전에 전부 끝난다', async () => {
  const llm = new FakeLlm();
  const engine = new Engine(llm, {
    couple, agent: AGENT, prep: { outfitDesc: '', coaching: '', speech: '' }, handlers: {},
  });
  await engine.runTexting();
  assert.equal(engine.pendingJudge, null, '문자 페이즈가 미결 판정을 대면으로 넘겼다');
  assert.equal(engine.boutBuf.length, 0, '문자 페이즈가 미채점 교환을 남겼다');
});

test('carry — 심판이 자른 꼬리는 다음 합으로 넘어간다', async () => {
  let n = 0;
  const llm = new FakeLlm({
    judge: () => ({
      carry: ++n === 1 ? 1 : 0,   // 첫 합에서 마지막 1교환을 다음 합으로
      tier: 'flat', loveDelta: 0, reason: 'r', vibe: 'v', revealed: '',
      clientEmote: 'talk', targetEmote: 'talk', casualty: 'none', casualtyNote: '',
      leverage: 'none', walkout: false,
    }),
  });
  const { result } = await playFull(llm);
  const judged = result.state.history.filter(h => !h.firstImpression);
  assert.equal(judged.reduce((a, h) => a + h.exchanges, 0), TOTAL,
    'carry가 있어도 교환은 정확히 한 번씩 채점된다');
  assert.equal(judged[0].exchanges, BOUT.size - 1, '첫 합에서 꼬리 1교환이 빠졌다');
  // 넘어간 교환이 다음 합의 판정문에 실제로 들어 있다
  const second = llm.byLabel('판정')[1];
  assert.ok(second.judgeUser.includes(`클라이언트 발언 #${BOUT.size}`), 'carry된 교환이 다음 합에 없다');
});

test('페이즈 정산에서는 carry가 무시된다 — 자를 다음 합이 없다', async () => {
  const llm = new FakeLlm({
    judge: () => ({
      carry: 2, tier: 'flat', loveDelta: 0, reason: 'r', vibe: 'v', revealed: '',
      clientEmote: 'talk', targetEmote: 'talk', casualty: 'none', casualtyNote: '',
      leverage: 'none', walkout: false,
    }),
  });
  const { result } = await playFull(llm);
  const judged = result.state.history.filter(h => !h.firstImpression);
  assert.equal(judged.reduce((a, h) => a + h.exchanges, 0), TOTAL, 'carry 무한 미룸으로 교환이 증발했다');
});

// ── 자리 길이는 심판의 keepGoing이 움직인다 ──────────────
test('심판이 더 갈 데 없다고 하면 자리가 일찍 접힌다', async () => {
  const llm = new FakeLlm({
    judge: () => ({
      carry: 0, tier: 'flat', loveDelta: 0, reason: 'r', vibe: 'v', revealed: '',
      clientEmote: 'talk', targetEmote: 'talk', casualty: 'none', casualtyNote: '',
      leverage: 'none', walkout: false, keepGoing: false,
    }),
  });
  const { engine, events } = await playFull(llm);
  const clientMsgs = engine.transcript.filter(t => t.who === 'client').length;
  assert.ok(clientMsgs < TOTAL, `전부 소화했다 (${clientMsgs}/${TOTAL}) — 조기 종료가 안 걸렸다`);
  assert.ok(events.bubbles.some(b => b.who === 'sys' && /답장이 끊겼|할 말이 떨어졌/.test(b.text)),
    '조기 종료 나레이션이 없다');
});

test('심판이 열려 있다고 하면 자리가 한 번 길어진다', async () => {
  const llm = new FakeLlm({
    judge: () => ({
      carry: 0, tier: 'flat', loveDelta: 0, reason: 'r', vibe: 'v', revealed: '',
      clientEmote: 'talk', targetEmote: 'talk', casualty: 'none', casualtyNote: '',
      leverage: 'none', walkout: false, keepGoing: true,
    }),
  });
  const { engine, events } = await playFull(llm);
  const clientMsgs = engine.transcript.filter(t => t.who === 'client').length;
  assert.ok(clientMsgs > TOTAL, `연장이 안 걸렸다 (${clientMsgs}/${TOTAL})`);
  assert.ok(events.bubbles.some(b => b.who === 'sys' && /할 말이 남았|일어나지 않는다/.test(b.text)));
});

// ── 자리의 끝 ────────────────────────────────────────────
test('walkout이면 즉시 파탄하고 남은 교환을 돌지 않는다', async () => {
  const llm = new FakeLlm({
    // n===1(첫 합)은 즉사 가드가 막으므로 둘째 합부터 자리를 뜬다.
    judge: (rec, n) => ({
      carry: 0, tier: 'disaster', loveDelta: -10, reason: '정색', vibe: '얼어붙었다', revealed: '',
      clientEmote: 'panic', targetEmote: 'angry', casualty: 'none', casualtyNote: '',
      leverage: 'none', walkout: n >= 2, keepGoing: false,
    }),
  });
  const { engine, result } = await playFull(llm);
  assert.ok(engine.aborted);
  assert.equal(engine.abortReason, 'walkout');
  assert.equal(result.verdict.accepted, false);
  assert.ok(llm.count('발언') < TOTAL, '파탄 후에도 교환을 계속 돌았다');
  assert.ok(engine.transcript.some(t => t.who === 'sys' && /읽씹|화장실/.test(t.text)), '파탄 나레이션이 없다');
});

test('사망이면 문구가 다르고 등급은 F다', async () => {
  const llm = new FakeLlm({
    judge: () => ({
      carry: 0, tier: 'disaster', loveDelta: -10, reason: '밀었다', vibe: '비명', revealed: '',
      clientEmote: 'panic', targetEmote: 'dead', casualty: 'target', casualtyNote: '분화구로 떨어졌다',
      leverage: 'none', walkout: false, keepGoing: false,
    }),
  });
  const { engine, result } = await playFull(llm);
  assert.equal(engine.abortReason, 'death');
  assert.equal(result.verdict.grade, 'F');
  assert.ok(engine.transcript.some(t => t.who === 'sys' && /사망/.test(t.text)));
  assert.ok(!engine.transcript.some(t => t.who === 'sys' && /읽씹|화장실/.test(t.text)),
    '사람이 죽었는데 읽씹 문구가 나왔다');
});

test('호감이 모자라도 강압 합이 쌓이면 묶인다', async () => {
  const llm = new FakeLlm({
    judge: () => ({
      carry: 0, tier: 'nudge', loveDelta: 0, reason: '몰아붙였다', vibe: 'v', revealed: '',
      clientEmote: 'smug', targetEmote: 'freeze', casualty: 'none', casualtyNote: '',
      leverage: 'hard', walkout: false,
    }),
  });
  const { engine, result } = await playFull(llm);
  assert.ok(engine.state.leverage >= 4, `압박이 ${engine.state.leverage}점뿐이다`);
  assert.ok(result.verdict.love < result.difficulty.threshold, '테스트 전제: 호감은 모자라야 한다');
  assert.equal(result.verdict.accepted, true, '압박이 쌓였는데 안 묶였다');
  assert.equal(result.verdict.reason, 'coerced');
});

test('심판이 죽어도 판정은 중립으로 흐르고 게임은 끝까지 간다', async () => {
  const llm = new FakeLlm();
  const orig = llm.call.bind(llm);
  llm.call = async (a) => {
    if (a.label.startsWith('판정') || a.label.startsWith('첫인상')) throw new Error('심판 다운');
    return orig(a);
  };
  const { result } = await playFull(llm);
  const judged = result.state.history.filter(h => !h.firstImpression);
  assert.equal(judged.reduce((a, h) => a + h.exchanges, 0), TOTAL, '판정이 실패해도 교환은 전부 채점된다');
  // 중립은 nudge다 — 점수 0이면서 어떤 규칙에도 안 세는 자리.
  assert.ok(result.state.history.every(h => h.tier === 'nudge'), '실패 시 중립(nudge) 처리');
});

// ── 병렬성: 판정은 다음 교환과 겹쳐 돈다 ─────────────────
test('합 판정이 다음 교환의 응답과 병렬로 돈다', async () => {
  const llm = new FakeLlm();
  await playFull(llm);
  assert.ok(llm.maxInFlight >= 2, '판정이 대화를 세워두고 있다');
});

test('대면 첫인상은 착장+반응으로 채점되며 표시가 남는다', async () => {
  const llm = new FakeLlm();
  const { result } = await playFull(llm, { prep: { outfitDesc: '형광 주황 턱시도', coaching: '', speech: '' } });
  const fi = llm.byLabel('첫인상')[0];
  assert.ok(fi.judgeUser.includes('형광 주황 턱시도'));
  assert.equal(result.state.history.filter(h => h.firstImpression).length, 1);
});

// ── 무전 ─────────────────────────────────────────────────
test('무전은 다음 발언에 꽂히고 상대에게는 안 들린다', async () => {
  const llm = new FakeLlm();
  let sent = false;
  await playFull(llm, {
    onTurn: (engine, t) => {
      if (!sent && t.phase === 'talk' && t.turn === 2) { sent = engine.submitRadio('지금 고백해'); }
    },
  });
  const after = llm.calls.find(c => c.label.includes('발언') && JSON.stringify(c.messages).includes('지금 고백해'));
  assert.ok(after, '무전이 클라이언트 발언에 주입되지 않았다');
  assert.ok(JSON.stringify(after.messages).includes('ORDER FROM HQ'));
  const targetLeak = llm.calls.filter(c => c.label.includes('응답'))
    .some(c => JSON.stringify(c.messages).includes('지금 고백해'));
  assert.ok(!targetLeak, '무전이 상대에게 들렸다');
});

test('무전 횟수는 난이도 규격에서 나온다', async () => {
  const llm = new FakeLlm();
  const tried = [];
  await playFull(llm, {
    onTurn: (engine, t) => { tried.push(engine.submitRadio(`남발 ${tried.length}`)); },
  });
  assert.equal(tried.filter(Boolean).length, D.radioText + D.radioTalk, '배급량을 넘겨 쐈다');
});

// ── 공기(텍스트 분위기)의 대칭 전달 ──────────────────────
test('공기는 양쪽 모두에게 각자의 공기읽기만큼 전달된다', async () => {
  // 공기가 매 합 갱신되도록 vibe를 바꿔가며 준다
  let n = 0;
  const llm = new FakeLlm({
    judge: () => ({
      carry: 0, tier: 'flat', loveDelta: 0, reason: 'r', vibe: `공기 ${++n}호`, revealed: '',
      clientEmote: 'talk', targetEmote: 'talk', casualty: 'none', casualtyNote: '',
      leverage: 'none', walkout: false,
    }),
  });
  await playFull(llm);
  const cAir = couple.client.keys.air, tAir = couple.target.keys.air;
  const cGot = llm.calls.filter(c => c.label.includes('발언'))
    .some(c => JSON.stringify(c.messages).includes('THE AIR AT THIS TABLE'));
  const tGot = llm.calls.filter(c => c.label.includes('응답'))
    .some(c => JSON.stringify(c.messages).includes('THE AIR AT THIS TABLE'));
  assert.equal(cGot, cAir !== 'none', `의뢰인 공기 전달이 air=${cAir}와 어긋난다`);
  assert.equal(tGot, tAir !== 'none', `상대 공기 전달이 air=${tAir}와 어긋난다`);
});

test('공기를 못 읽는 인물에게는 공기가 한 글자도 안 간다', async () => {
  // circadian 의뢰인은 air none이다
  const noneCouple = COUPLE_BY_ID['circadian'];
  assert.equal(noneCouple.client.keys.air, 'none', '테스트 전제');
  let n = 0;
  const llm = new FakeLlm({
    judge: () => ({
      carry: 0, tier: 'flat', loveDelta: 0, reason: 'r', vibe: `공기 ${++n}호`, revealed: '',
      clientEmote: 'talk', targetEmote: 'talk', casualty: 'none', casualtyNote: '',
      leverage: 'none', walkout: false,
    }),
  });
  await playFull(llm, { couple: noneCouple });
  const leaked = llm.calls.filter(c => c.label.includes('발언'))
    .some(c => JSON.stringify(c.messages).includes('THE AIR AT THIS TABLE'));
  assert.ok(!leaked, '눈치 없는 인물에게 공기가 전달됐다');
});

// ── 대화 이월 ────────────────────────────────────────────
test('대면은 문자 대화를 이어받는다', async () => {
  const llm = new FakeLlm();
  await playFull(llm);
  const talkClient = llm.calls.find(c => c.label === '대면 발언 1');
  const joined = JSON.stringify(talkClient.messages);
  assert.ok(joined.includes('SCENE CHANGE'), '장면 전환 안내가 없다');
  assert.ok(joined.includes('클라이언트 발언 #1'), '문자 내역이 이월되지 않았다');
});

test('결과 정산에 편지·디브리핑·전문이 실린다', async () => {
  const llm = new FakeLlm();
  const { result } = await playFull(llm);
  assert.ok(result.letter.letter);
  assert.ok(result.debrief.notes.length >= 5);
  assert.ok(result.transcript.includes('클라이언트 발언 #1'));
  assert.equal(typeof result.verdict.accepted, 'boolean');
});

test('준비 단계 반응이 취조실·정문 프롬프트로 나간다', async () => {
  const llm = new FakeLlm();
  const r = await prepReaction(llm, { couple, agent: AGENT, scene: 'coaching', text: '테스트 지침' });
  assert.ok(r.reaction);
  const call = llm.calls[0];
  assert.ok(call.system.includes('취조실'));
  assert.ok(call.messages[0].content.includes('테스트 지침'));
});
