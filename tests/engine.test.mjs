// node --test tests/engine.test.mjs — 하네스. 가짜 LLM을 물려 한 판을 통째로 돌린다.
//
// 확인하는 것: 호출 순서와 횟수, 구간 판정 반영, 무드 바닥 시 조기 종료,
// 대화 내역 누적, 후일담 정산, 무전 개입. 프롬프트 내용 감사는 orders.test.mjs가 본다.
//
// 대사는 **줄마다 한 번씩** 부른다. 배우 둘이 각자의 회선에서 번갈아 한 줄씩 쓴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, dressOf } from '../js/engine.js';
import { COUPLES } from '../js/couples.js';
import { BEAT, PHASES, POINTS, RADIO, TOTAL_BEATS } from '../js/points.js';

const couple = COUPLES[0];
const DRESSED = dressOf(couple.client, null);

// 라벨로 분기하는 가짜 LLM. 판정 값은 대본(script)대로 순서대로 내준다.
class MockLlm {
  constructor({ verdicts = [], epilogue = null } = {}) {
    this.calls = [];
    this.verdicts = verdicts;
    this.epilogue = epilogue;
    this.vi = 0;
  }
  async call({ label, system, messages, schema }) {
    this.calls.push({ label, system, schema: !!schema, messages: structuredClone(messages) });
    if (label.includes('판정')) {
      return this.verdicts[this.vi++] || { mood: 'same', love: 'same' };
    }
    if (label.includes('후일담')) {
      return this.epilogue || { success: false, epilogue: '아무 일도 없었다.' };
    }
    // 대사 한 줄
    const n = this.calls.filter(c => /대사/.test(c.label)).length;
    return { text: `대사${n}` };
  }
  labels(re) { return this.calls.filter(c => re.test(c.label)); }
}

function makeEngine(llm, handlers = {}) {
  return new Engine(llm, { couple, dressed: DRESSED, coaching: '코칭원문', handlers });
}

test('한 판은 구간마다 대사 여섯 줄 + 판정 1회, 딱 그만큼만 부른다', async () => {
  const llm = new MockLlm();
  const e = makeEngine(llm);
  await e.run();
  assert.equal(llm.labels(/대사/).length, TOTAL_BEATS * BEAT.lines);
  assert.equal(llm.labels(/판정/).length, TOTAL_BEATS);
  assert.equal(llm.calls.length, TOTAL_BEATS * (BEAT.lines + 1), '구조도에 없는 호출이 섞였다');
});

test('배우 둘이 번갈아 쓰고, 서로의 회선을 못 본다', async () => {
  const llm = new MockLlm();
  const e = makeEngine(llm);
  await e.run();
  const said = llm.labels(/대사/);
  for (let i = 0; i < said.length; i++) {
    assert.ok(new RegExp(i % 2 === 0 ? '고객 대사' : '타겟 대사').test(said[i].label),
      `${i}번째 차례에 엉뚱한 배우가 불렸다: ${said[i].label}`);
  }
  const cSys = [...new Set(llm.labels(/고객 대사/).map(c => c.system))];
  const tSys = [...new Set(llm.labels(/타겟 대사/).map(c => c.system))];
  assert.equal(cSys.length, 1, '고객 배우의 system이 판 도중에 갈렸다');
  assert.equal(tSys.length, 1, '타겟 배우의 system이 판 도중에 갈렸다');
  assert.notEqual(cSys[0], tSys[0], '두 배우가 같은 프롬프트를 받고 있다');
  assert.ok(!cSys[0].includes(couple.target.taste[0]), '고객 배우가 타겟 취향을 보고 있다');
  assert.ok(!cSys[0].includes(couple.target.personality[0]), '고객 배우가 타겟 성격을 보고 있다');
  assert.ok(!tSys[0].includes(couple.client.personality[0]), '타겟 배우가 고객 성격을 보고 있다');
  assert.ok(!tSys[0].includes('코칭원문'), '타겟 배우가 코칭을 보고 있다');
});

test('후일담은 판이 끝난 뒤 한 번만 부른다', async () => {
  const llm = new MockLlm();
  const e = makeEngine(llm);
  await e.run();
  const before = llm.calls.length;
  const r = await e.finish();
  assert.equal(llm.labels(/후일담/).length, 1);
  assert.equal(llm.calls.length, before + 1);
  assert.equal(typeof r.success, 'boolean');
  assert.equal(typeof r.epilogue, 'string');
});

test('페이즈는 텍스팅 → 토킹 순으로 흐른다', async () => {
  const seen = [];
  const llm = new MockLlm();
  const e = makeEngine(llm, { phase: p => { seen.push(p.key); } });
  await e.run();
  assert.deepEqual(seen, PHASES.map(p => p.key));
});

test('판정 하나가 두 게이지를 각자 움직인다', async () => {
  const llm = new MockLlm({ verdicts: [{ mood: 'down', love: 'up' }] });
  const e = makeEngine(llm);
  const got = [];
  e.h.verdict = v => { got.push(v); };
  await e.run();
  assert.equal(got[0].dMood, -1);
  assert.equal(got[0].dLove, 1);
  assert.equal(got[0].mood, POINTS.moodStart - POINTS.moodStep);
  assert.equal(got[0].love, POINTS.loveStart + POINTS.loveStep);
});

test('무드가 바닥나면 남은 구간을 돌지 않는다', async () => {
  const down = Array.from({ length: 20 }, () => ({ mood: 'down', love: 'same' }));
  const llm = new MockLlm({ verdicts: down });
  const e = makeEngine(llm);
  await e.run();
  const beats = llm.labels(/판정/).length;
  assert.ok(beats < TOTAL_BEATS, `자리가 깨졌는데 ${beats}구간을 다 돌았다`);
  assert.equal(e.points.mood, 0);
  assert.equal(e.points.broken, true);
  assert.ok(e.transcript.some(l => l.who === 'sys'), '자리가 깨진 사실이 기록에 안 남았다');
});

test('대화가 누적되고 두 사람 몫이 모두 들어간다', async () => {
  const llm = new MockLlm();
  const e = makeEngine(llm);
  await e.run();
  const spoken = e.transcript.filter(l => l.who !== 'sys');
  assert.equal(spoken.length, TOTAL_BEATS * 6);
  assert.ok(spoken.some(l => l.who === 'client'));
  assert.ok(spoken.some(l => l.who === 'target'));
  const text = e.fullTranscript();
  assert.ok(text.includes(couple.client.name));
  assert.ok(text.includes(couple.target.name));
});

test('system 셋이 판 내내 바이트 동일하다 (캐시가 붙는 자리)', async () => {
  const llm = new MockLlm();
  const e = makeEngine(llm);
  await e.run();
  for (const re of [/고객 대사/, /타겟 대사/, /판정/]) {
    assert.equal(new Set(llm.labels(re).map(c => c.system)).size, 1,
      `${re} system이 호출마다 달라져 캐시가 깨진다`);
  }
});

test('회선마다 제 출력을 그대로 이어받는다 (접두사 캐시)', async () => {
  const llm = new MockLlm();
  const e = makeEngine(llm);
  await e.run();
  for (const re of [/고객 대사/, /타겟 대사/]) {
    const gen = llm.labels(re);
    assert.equal(gen[0].messages.length, 1);
    for (let i = 1; i < gen.length; i++) {
      assert.equal(gen[i].messages.length, gen[i - 1].messages.length + 2, '한 차례에 두 줄씩 안 쌓였다');
      assert.deepEqual(gen[i].messages.slice(0, gen[i - 1].messages.length), gen[i - 1].messages);
      assert.equal(gen[i].messages[gen[i - 1].messages.length].role, 'assistant', '제 대사가 회선에 안 남았다');
    }
  }
});

test('말풍선 핸들러가 순서대로, 한 줄씩 불린다', async () => {
  const seen = [];
  const llm = new MockLlm();
  const e = makeEngine(llm, { line: (who, text) => { seen.push(`${who}:${text}`); } });
  await e.run();
  assert.equal(seen.length, TOTAL_BEATS * 6);
  assert.ok(seen[0].startsWith('client:'));
  assert.ok(seen[1].startsWith('target:'));
});

test('생성이 실패해도 판은 계속 간다', async () => {
  class Flaky extends MockLlm {
    async call(args) {
      if (/대사/.test(args.label) && this.calls.filter(c => /대사/.test(c.label)).length === 0) {
        this.calls.push({ label: args.label, system: args.system, messages: [] });
        throw new Error('회선 불안정');
      }
      return super.call(args);
    }
  }
  const llm = new Flaky();
  const e = makeEngine(llm);
  await e.run();
  assert.ok(e.transcript.some(l => l.who === 'sys'), '끊긴 구간이 기록에 안 남았다');
  assert.ok(e.transcript.filter(l => l.who !== 'sys').length > 0, '판이 통째로 죽었다');
});

test('판정이 실패하면 그대로(same)로 정산한다', async () => {
  class NoJudge extends MockLlm {
    async call(args) {
      if (args.label.includes('판정')) { this.calls.push({ label: args.label, messages: [] }); throw new Error('심판 부재'); }
      return super.call(args);
    }
  }
  const llm = new NoJudge();
  const e = makeEngine(llm);
  await e.run();
  assert.equal(e.points.mood, POINTS.moodStart);
  assert.equal(e.points.love, POINTS.loveStart);
});

test('후일담이 실패해도 러브 포인트로 결과가 확정된다', async () => {
  class NoEpilogue extends MockLlm {
    async call(args) {
      if (args.label.includes('후일담')) { this.calls.push({ label: args.label, messages: [] }); throw new Error('기록관 부재'); }
      return super.call(args);
    }
  }
  const llm = new NoEpilogue({ verdicts: Array.from({ length: 20 }, () => ({ mood: 'same', love: 'up' })) });
  const e = makeEngine(llm);
  await e.run();
  const r = await e.finish();
  assert.equal(typeof r.success, 'boolean');
  assert.equal(r.love, Math.round(e.points.love));
});

test('시공을 안 하면 테이블 값이 그대로 시트가 된다', () => {
  const d = dressOf(couple.client, null);
  assert.equal(d.look, couple.client.look.join(', '));
  assert.equal(d.personality, couple.client.personality.join(', '));
  const s = dressOf(couple.client, { look: '주황 턱시도', personality: '지고는 못 산다' });
  assert.equal(s.look, '주황 턱시도');
  assert.equal(s.personality, '지고는 못 산다');
});

// ── 무전 — 페이즈마다 한 번, 대화를 세우고 명령을 꽂는다 ──
// 요원이 판 도중에 쓰는 유일한 레버다. 규칙 넷을 전수로 본다:
//   ① 배급은 페이즈당 한 번  ② 누르면 대화가 선다  ③ 명령은 다음 생성 프롬프트에 실린다
//   ④ 심판도 기록관도 그 문장을 못 본다

const RADIO_MARK = '무전표식 — 지금 당장 일어나라';

/** 지정한 줄 수가 흐른 뒤 무전을 때리는 판. 화면이 하는 일을 그대로 흉내낸다. */
async function runWithRadio(llm, { at = 3, order = RADIO_MARK, cancel = false, extra = {} } = {}) {
  let n = 0;
  const seen = { hold: [], resume: [] };
  const e = new Engine(llm, {
    couple, dressed: DRESSED, coaching: '코칭원문',
    handlers: {
      line: () => { if (++n === at) e.requestHold(); },
      hold: (h) => { seen.hold.push(h); cancel ? e.releaseHold() : e.sendRadio(order); },
      resume: (r) => { seen.resume.push(r); },
      ...extra,
    },
  });
  await e.run();
  return { e, seen };
}

test('무전 배급은 페이즈마다 한 번씩이다', () => {
  const e = makeEngine(new MockLlm());
  assert.equal(RADIO.perPhase, 1);
  for (const p of PHASES) assert.equal(e.radioFor(p.key), RADIO.perPhase, `${p.label} 배급이 다르다`);
});

test('무전을 때리면 그 명령이 다음 생성 프롬프트에 실린다', async () => {
  const llm = new MockLlm();
  const { e, seen } = await runWithRadio(llm);
  assert.equal(seen.hold.length, 1, '대화가 서지 않았다');
  assert.equal(seen.resume.at(-1).order, RADIO_MARK, '재개 신호가 명령을 안 들고 있다');

  const gen = llm.labels(/대사/);
  const first = gen.findIndex(c => JSON.stringify(c.messages).includes(RADIO_MARK));
  assert.ok(first > 0, '무전이 어느 대사 호출에도 안 실렸다');
  assert.equal(first, 3, '세 줄 뒤에 때린 무전이 바로 다음 차례에 안 실렸다');
  assert.ok(/고객 대사/.test(gen[first].label), '무전이 타겟 배우에게 갔다');
  assert.ok(!llm.labels(/타겟 대사/).some(c => JSON.stringify(c.messages).includes(RADIO_MARK)),
    '타겟 회선에 무전이 실렸다 — 타겟은 무전을 못 듣는다');
  assert.ok(!gen.some(c => c.system.includes(RADIO_MARK)), '무전이 system으로 새어 들어갔다');
});

test('무전은 페이즈당 한 번뿐이다 — 배급이 끝나면 송출해도 나가지 않는다', async () => {
  // 회선(정지) 자체는 현장 배급 몫으로 또 열릴 수 있다. 계약은 「고객 무전이 두 번
  // 나가지 않는다」이지 「정지가 안 걸린다」가 아니다.
  const llm = new MockLlm();
  let n = 0;
  const e = new Engine(llm, {
    couple, dressed: DRESSED, coaching: '',
    handlers: {
      line: () => { n++; if (n === 3 || n === 9) e.requestHold(); },   // 둘 다 텍스팅 구간이다
      hold: () => { e.sendRadio(RADIO_MARK); },
    },
  });
  await e.run();
  assert.equal(e.radioLog.length, 1, '고객 무전이 두 번 나갔다');
  assert.equal(e.radioFor('text'), 0);
  assert.equal(e.radioFor('talk'), RADIO.perPhase, '안 쓴 페이즈의 배급까지 깎였다');
  // 회선은 계속 쌓이므로 뒤 호출에도 그 문장이 남아 있다. 계약은 「한 번만 실렸다」이다.
  const thread = llm.labels(/고객 대사/).at(-1).messages;
  const hits = thread.filter(m => m.role === 'user' && m.content.includes(RADIO_MARK));
  assert.equal(hits.length, 1, '무전이 두 번 실렸다');
});

const FIELD_MARK = '현장표식 — 창밖에 롤스로이스를 대라';

test('현장 무전은 판 전체에 한 번뿐이다 — 배급이 끝나면 송출해도 안 나간다', async () => {
  const llm = new MockLlm();
  let n = 0;
  const opened = [], left = [];
  const e = new Engine(llm, {
    couple, dressed: DRESSED, coaching: '',
    handlers: {
      line: () => { n++; if (n === 27 || n === 33) e.requestHold(); },   // 둘 다 토킹이다
      hold: (h) => { opened.push(h.phase); left.push(e.leverLeft('field')); e.sendField(FIELD_MARK); },
    },
  });
  await e.run();
  assert.equal(e.fieldLeft, 0, '배급이 안 깎였다');
  assert.equal(e.fieldLog.length, 1, '판 전체 1회 제한이 안 걸렸다');
  assert.equal(opened.length, 2, '두 번 다 자리는 섰어야 한다 — 회선은 고객 무전 몫으로도 열린다');
  assert.deepEqual(left, [1, 0], '두 번째 회선에서도 현장 배급이 남아 있었다');
  assert.equal(e.radioLog.length, 0, '현장 송출이 고객 무전으로 새어 나갔다');
});

test('현장 무전은 다음 생성 프롬프트에 실리고 system은 안 건드린다', async () => {
  const llm = new MockLlm();
  let n = 0;
  const e = new Engine(llm, {
    couple, dressed: DRESSED, coaching: '',
    handlers: {
      line: () => { n++; if (n === 27) e.requestHold(); },   // 토킹에서만 열린다
      hold: () => { e.sendField(FIELD_MARK); },
    },
  });
  await e.run();
  const gen = llm.labels(/대사/);
  const first = gen.findIndex(c => JSON.stringify(c.messages).includes(FIELD_MARK));
  assert.ok(first > 0, '현장 무전이 어느 대사 호출에도 안 실렸다');
  assert.ok(!JSON.stringify(gen[first - 1].messages).includes(FIELD_MARK),
    '누르기도 전의 호출에 실렸다');
  // 물리 사건이다 — 두 사람 다 겪는다. 양쪽 회선에 각자의 문장으로 실린다.
  for (const re of [/고객 대사/, /타겟 대사/]) {
    assert.ok(llm.labels(re).some(c => JSON.stringify(c.messages).includes(FIELD_MARK)),
      `${re} 회선이 현장 사건을 못 봤다`);
  }
  assert.ok(!gen.some(c => c.system.includes(FIELD_MARK)), '현장 무전이 system으로 새어 들어갔다');
  // 판정·후일담은 이 문장을 못 본다
  for (const c of llm.labels(/판정|후일담/)) {
    assert.ok(!JSON.stringify(c.messages).includes(FIELD_MARK), `${c.label}이 현장 무전을 봤다`);
  }
});

test('현장 사건은 두 회선에 똑같이, 한 번씩만 들어간다 — 의지와 무관한 기록이다', async () => {
  const llm = new MockLlm();
  let n = 0;
  const e = new Engine(llm, {
    couple, dressed: DRESSED, coaching: '',
    handlers: {
      line: () => { n++; if (n === 27) e.requestHold(); },   // 토킹에서만 열린다
      hold: () => { e.sendField(FIELD_MARK); },
    },
  });
  await e.run();
  for (const re of [/고객 대사/, /타겟 대사/]) {
    const thread = llm.labels(re).at(-1).messages;
    const hits = thread.filter(m => m.role === 'user' && m.content.includes(FIELD_MARK));
    assert.equal(hits.length, 1, `${re} 회선에 사건이 ${hits.length}번 실렸다`);
    assert.ok(/already in the past/.test(hits[0].content), `${re} 회선이 사건을 「앞으로 할 일」로 받았다`);
    // 사건은 그 뒤에 오간 대사보다 앞에 실린다
    const said = hits[0].content.match(/^(표한나|지대건): /m);
    if (said) {
      assert.ok(hits[0].content.indexOf(FIELD_MARK) < hits[0].content.indexOf(said[0]),
        `${re} 회선에서 사건이 대사보다 뒤에 실렸다`);
    }
  }
  // 두 회선이 같은 사건을 받는다 (문장은 시점에 따라 다르되, 명령 원문은 같다)
  assert.equal(e.fieldLog.length, 1);
});

test('텍스팅에는 물리 개입이 없다 — 배급이 남아 있어도 그 자리에서는 못 쓴다', async () => {
  const llm = new MockLlm();
  let n = 0;
  const tried = [];
  const e = new Engine(llm, {
    couple, dressed: DRESSED, coaching: '',
    handlers: {
      line: () => {
        n++;
        if (n <= 24) tried.push(e.canField());      // 텍스팅 4구간 = 24줄
        if (n === 3) e.requestHold();
      },
      hold: () => { e.sendField(FIELD_MARK); },     // 텍스팅에서 때려본다
    },
  });
  await e.run();
  assert.ok(tried.length > 0 && tried.every(v => v === false),
    '텍스팅인데 현장 투입이 열려 있다');
  assert.equal(e.fieldLog.length, 0, '텍스팅에서 현장 사건이 나갔다');
  assert.equal(e.fieldLeft, 1, '못 쓴 자리에서 배급이 깎였다');
  assert.ok(!llm.labels(/대사/).some(c => JSON.stringify(c.messages).includes(FIELD_MARK)),
    '텍스팅 회선에 현장 사건이 실렸다');
  // 토킹에 들어가면 그 자리에서 열린다
  assert.equal(e.leverHere('field', 'talk'), true);
  assert.equal(e.leverHere('field', 'text'), false);
  assert.equal(e.leverHere('radio', 'text'), true, '고객 무전까지 같이 막혔다');
});

test('고객 무전과 현장 무전은 배급이 따로 간다 — 한 판에 둘 다 쓸 수 있다', async () => {
  const llm = new MockLlm();
  let n = 0;
  const sent = [];
  const e = new Engine(llm, {
    couple, dressed: DRESSED, coaching: '',
    handlers: {
      line: () => { n++; if (n === 3 || n === 27) e.requestHold(); },
      hold: () => { sent.length ? e.sendField(FIELD_MARK) : e.sendRadio(RADIO_MARK); sent.push(1); },
    },
  });
  await e.run();
  assert.equal(e.fieldLog.length, 1);
  assert.equal(e.radioFor('text'), 0, '고객 무전 배급이 그대로다');
  const all = JSON.stringify(llm.labels(/고객 대사/).map(c => c.messages));
  assert.ok(all.includes(FIELD_MARK) && all.includes(RADIO_MARK), '둘 중 하나가 안 실렸다');
});

test('두 페이즈에서 한 번씩, 각각 그 페이즈에 먹는다', async () => {
  const llm = new MockLlm();
  const sent = [];
  const e = new Engine(llm, {
    couple, dressed: DRESSED, coaching: '',
    handlers: {
      line: () => { e.requestHold(); },     // 매 줄 요청 — 배급이 남은 곳에서만 열린다
      hold: () => { e.sendRadio(`${RADIO_MARK}/${e.phase}`); },
      resume: (r) => { if (r.order) sent.push(r.phase); },
    },
  });
  await e.run();
  assert.deepEqual(sent, ['text', 'talk'], '페이즈마다 한 번씩이 아니다');
  assert.equal(e.radioLog.length, 2);
  assert.deepEqual(e.radioLog.map(x => x.phase), ['text', 'talk']);
});

test('누르면 대화가 그 줄에서 선다', async () => {
  const llm = new MockLlm();
  const { e, seen } = await runWithRadio(llm, { at: 3 });
  assert.equal(seen.hold.length, 1, '대화가 서지 않았다');
  assert.equal(seen.hold[0].at, 'line', '줄 경계가 아닌 데서 섰다');
  assert.ok(e.transcript.filter(l => l.who !== 'sys').length > 3, '선 뒤로 판이 안 굴러갔다');
});

test('버릴 대사도, 다시 볼 판정도 없다 — 아직 쓰지 않은 말이기 때문이다', async () => {
  const llm = new MockLlm();
  const { e } = await runWithRadio(llm, { at: 3 });
  assert.equal(llm.labels(/재판정/).length, 0, '다시 판정할 것이 남아 있다');
  assert.equal(llm.labels(/판정/).length, e.points.history.length, '구간마다 판정이 한 번이 아니다');
  // 구간은 그대로 여섯 줄을 채운다
  assert.equal(e.transcript.filter(l => l.who !== 'sys').length % BEAT.lines, 0);
  assert.ok(!llm.labels(/판정/).some(c => JSON.stringify(c.messages).includes(RADIO_MARK)),
    '무전이 판정으로 새어 들어갔다');
});

test('무전은 대화 기록에 남지 않는다 — 심판도 기록관도 못 본다', async () => {
  const llm = new MockLlm();
  const { e } = await runWithRadio(llm);
  assert.ok(!e.fullTranscript().includes(RADIO_MARK), '무전이 대화 기록에 섞였다');
  assert.ok(!llm.labels(/판정/).some(c => JSON.stringify(c.messages).includes(RADIO_MARK)),
    '무전이 판정 프롬프트에 실렸다');
  await e.finish();
  assert.ok(!llm.labels(/후일담/).some(c => JSON.stringify(c.messages).includes(RADIO_MARK)),
    '무전이 후일담 프롬프트에 실렸다');
  // 대신 요원 몫의 원장에는 남는다 (화면용)
  assert.equal(e.radioLog[0].text, RADIO_MARK);
});

test('취소하면 배급이 안 깎이고 대화가 그대로 이어진다', async () => {
  const llm = new MockLlm();
  const { e, seen } = await runWithRadio(llm, { at: 3, cancel: true });
  assert.equal(seen.hold.length, 1, '대화가 서지 않았다');
  assert.equal(seen.resume.at(-1).order, null);
  assert.equal(e.radioFor('text'), RADIO.perPhase, '취소했는데 배급이 깎였다');
  assert.equal(e.radioLog.length, 0);
  assert.equal(e.transcript.filter(l => l.who !== 'sys').length, TOTAL_BEATS * BEAT.lines,
    '취소했는데 대사가 모자란다');
});

test('빈 무전은 나가지 않는다 — 배급도 그대로다', async () => {
  const llm = new MockLlm();
  const { e } = await runWithRadio(llm, { at: 3, order: '   ' });
  assert.equal(e.radioFor('text'), RADIO.perPhase);
  assert.equal(e.radioLog.length, 0);
  assert.ok(!llm.labels(/대사/).some(c => JSON.stringify(c.messages).includes('L 기관 RADIO')));
});

test('무전이 먹힐 대사가 안 남았으면 버튼이 잠긴다', async () => {
  const llm = new MockLlm();
  const locked = [];
  const e = new Engine(llm, {
    couple, dressed: DRESSED, coaching: '',
    handlers: {
      line: () => {
        // 페이즈의 마지막 구간이 흐르는 동안엔 이 페이즈에 더 쓰일 대사가 없다
        if (e.writesLeft === 0) locked.push(e.canRadio());
      },
    },
  });
  await e.run();
  assert.ok(locked.length > 0, '마지막 구간을 안 지나갔다');
  assert.ok(locked.every(v => v === false), '먹힐 데가 없는데 무전을 부를 수 있다');
  assert.equal(e.radioFor('text'), RADIO.perPhase, '아무도 안 썼는데 배급이 깎였다');
});

test('무전을 안 쓰면 호출 수도 대화도 예전 그대로다', async () => {
  const llm = new MockLlm();
  const e = makeEngine(llm);
  await e.run();
  assert.equal(llm.calls.length, TOTAL_BEATS * (BEAT.lines + 1), '무전을 안 썼는데 호출이 늘었다');
  assert.equal(e.radioLog.length, 0);
  assert.ok(!llm.calls.some(c => JSON.stringify(c.messages || []).includes('L 기관 RADIO')));
});
