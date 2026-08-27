// node --test tests/engine.test.mjs — 하네스. 가짜 LLM을 물려 한 판을 통째로 돌린다.
//
// 확인하는 것: 호출 순서와 횟수, 구간 판정 반영, 무드 바닥 시 조기 종료,
// 대화 내역 누적, 후일담 정산, 무전 개입. 프롬프트 내용 감사는 orders.test.mjs가 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, dressOf } from '../js/engine.js';
import { COUPLES } from '../js/couples.js';
import { PHASES, POINTS, RADIO, TOTAL_BEATS } from '../js/points.js';

const couple = COUPLES[0];
const DRESSED = dressOf(couple.client, null);

// 라벨로 분기하는 가짜 LLM. 판정 값은 대본(script)대로 순서대로 내준다.
class MockLlm {
  constructor({ verdicts = [], epilogue = null, lines = 6 } = {}) {
    this.calls = [];
    this.verdicts = verdicts;
    this.epilogue = epilogue;
    this.lines = lines;
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
    // 대화 생성
    const n = this.calls.filter(c => c.label.includes('대화 생성')).length;
    return {
      lines: Array.from({ length: this.lines }, (_, i) => ({
        who: i % 2 === 0 ? 'client' : 'target',
        text: `${n}-${i}번째 대사`,
      })),
    };
  }
  labels(re) { return this.calls.filter(c => re.test(c.label)); }
}

function makeEngine(llm, handlers = {}) {
  return new Engine(llm, { couple, dressed: DRESSED, coaching: '코칭원문', handlers });
}

test('한 판은 구간마다 생성 1회 + 판정 1회, 딱 그만큼만 부른다', async () => {
  const llm = new MockLlm();
  const e = makeEngine(llm);
  await e.run();
  assert.equal(llm.labels(/대화 생성/).length, TOTAL_BEATS);
  assert.equal(llm.labels(/판정/).length, TOTAL_BEATS);
  assert.equal(llm.calls.length, TOTAL_BEATS * 2, '구조도에 없는 호출이 섞였다');
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
  const beats = llm.labels(/대화 생성/).length;
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

test('생성 호출의 system은 판 내내 바이트 동일하다 (캐시가 붙는 자리)', async () => {
  const llm = new MockLlm();
  const e = makeEngine(llm);
  await e.run();
  const sys = new Set(llm.labels(/대화 생성/).map(c => c.system));
  assert.equal(sys.size, 1, '생성 system이 호출마다 달라져 캐시가 깨진다');
  const jsys = new Set(llm.labels(/판정/).map(c => c.system));
  assert.equal(jsys.size, 1, '판정 system이 호출마다 달라져 캐시가 깨진다');
});

test('생성 호출은 직전 출력을 그대로 이어받는다 (접두사 캐시)', async () => {
  const llm = new MockLlm();
  const e = makeEngine(llm);
  await e.run();
  const gen = llm.labels(/대화 생성/);
  assert.equal(gen[0].messages.length, 1);
  for (let i = 1; i < gen.length; i++) {
    assert.ok(gen[i].messages.length > gen[i - 1].messages.length, '대화 내역이 안 쌓였다');
    // 앞선 호출의 메시지가 접두사로 그대로 남아 있어야 한다
    assert.deepEqual(gen[i].messages.slice(0, gen[i - 1].messages.length), gen[i - 1].messages);
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
      if (args.label.includes('대화 생성') && this.calls.filter(c => c.label.includes('대화 생성')).length === 1) {
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

  const gen = llm.labels(/대화 생성/);
  const first = gen.findIndex(c => JSON.stringify(c.messages).includes(RADIO_MARK));
  assert.ok(first > 0, '무전이 어느 생성 호출에도 안 실렸다');
  assert.ok(!JSON.stringify(gen[first - 1].messages).includes(RADIO_MARK),
    '무전이 눌리기도 전의 호출에 실렸다');
  // system은 판 내내 바이트 동일해야 한다 — 무전이 캐시를 깨면 안 된다
  assert.equal(new Set(gen.map(c => c.system)).size, 1, '무전이 system을 갈아 캐시를 깼다');
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
  const hits = llm.labels(/대화 생성/).filter(c => JSON.stringify(c.messages).includes(RADIO_MARK));
  assert.equal(hits.length >= 1, true);
});

const FIELD_MARK = '현장표식 — 창밖에 롤스로이스를 대라';

test('현장 무전은 판 전체에 한 번뿐이다 — 두 번째는 회선이 안 열린다', async () => {
  const llm = new MockLlm();
  let n = 0;
  const opened = [];
  const e = new Engine(llm, {
    couple, dressed: DRESSED, coaching: '',
    handlers: {
      line: () => { n++; if (n === 3 || n === 21) e.requestHold(); },   // 텍스팅에서 한 번, 토킹에서 한 번
      hold: (h) => { opened.push(h.phase); e.sendField(FIELD_MARK); },
    },
  });
  await e.run();
  assert.equal(e.fieldLeft, 0, '배급이 안 깎였다');
  assert.equal(e.fieldLog.length, 1, '판 전체 1회 제한이 안 걸렸다');
  assert.equal(opened.length, 1, '배급이 소진됐는데 회선이 또 열렸다 (고객 무전 배급은 안 씀)');
});

test('현장 무전은 다음 생성 프롬프트에 실리고 system은 안 건드린다', async () => {
  const llm = new MockLlm();
  let n = 0;
  const e = new Engine(llm, {
    couple, dressed: DRESSED, coaching: '',
    handlers: {
      line: () => { n++; if (n === 3) e.requestHold(); },
      hold: () => { e.sendField(FIELD_MARK); },
    },
  });
  await e.run();
  const gen = llm.labels(/대화 생성/);
  const first = gen.findIndex(c => JSON.stringify(c.messages).includes(FIELD_MARK));
  assert.ok(first > 0, '현장 무전이 어느 생성 호출에도 안 실렸다');
  assert.ok(!JSON.stringify(gen[first - 1].messages).includes(FIELD_MARK),
    '누르기도 전의 호출에 실렸다');
  assert.equal(new Set(gen.map(c => c.system)).size, 1, '현장 무전이 system을 갈아 캐시를 깼다');
  // 판정·후일담은 이 문장을 못 본다
  for (const c of llm.labels(/판정|후일담/)) {
    assert.ok(!JSON.stringify(c.messages).includes(FIELD_MARK), `${c.label}이 현장 무전을 봤다`);
  }
});

test('고객 무전과 현장 무전은 배급이 따로 간다 — 한 판에 둘 다 쓸 수 있다', async () => {
  const llm = new MockLlm();
  let n = 0;
  const sent = [];
  const e = new Engine(llm, {
    couple, dressed: DRESSED, coaching: '',
    handlers: {
      line: () => { n++; if (n === 3 || n === 9) e.requestHold(); },
      hold: () => { sent.length ? e.sendRadio(RADIO_MARK) : e.sendField(FIELD_MARK); sent.push(1); },
    },
  });
  await e.run();
  assert.equal(e.fieldLog.length, 1);
  assert.equal(e.radioFor('text'), 0, '고객 무전 배급이 그대로다');
  const all = JSON.stringify(llm.labels(/대화 생성/).map(c => c.messages));
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

test('대화가 실제로 선다 — 잘린 구간의 남은 대사는 없던 것이 된다', async () => {
  const llm = new MockLlm();
  const { e } = await runWithRadio(llm, { at: 3 });
  const firstBeat = e.transcript.filter(l => l.text.startsWith('1-'));
  assert.equal(firstBeat.length, 3, '무전을 때렸는데 구간이 그대로 다 흘렀다');
  // 잘린 뒤로도 판은 계속 굴러간다
  assert.ok(e.transcript.filter(l => l.who !== 'sys').length > 3);
});

test('잘린 구간은 실제로 오간 데까지만 다시 판정한다 — 하지 않은 말은 채점되지 않는다', async () => {
  const llm = new MockLlm();
  const { e } = await runWithRadio(llm, { at: 3 });
  const re = llm.labels(/재판정/);
  assert.equal(re.length, 1, '잘린 구간을 다시 안 봤다');
  const body = JSON.stringify(re[0].messages);
  assert.ok(body.includes('1-2') && !body.includes('1-3'),
    '재판정이 하지 않은 말까지 들고 있다');
  assert.ok(!body.includes(RADIO_MARK), '무전이 판정으로 새어 들어갔다');
  // 잘린 구간도 판정은 한 번만 반영된다
  assert.equal(e.points.history.length, llm.labels(/대화 생성/).length);
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
  assert.equal(e.transcript.filter(l => l.text.startsWith('1-')).length, 6, '취소했는데 구간이 잘렸다');
  assert.equal(llm.labels(/재판정/).length, 0, '취소했는데 다시 판정했다');
});

test('빈 무전은 나가지 않는다 — 배급도 그대로다', async () => {
  const llm = new MockLlm();
  const { e } = await runWithRadio(llm, { at: 3, order: '   ' });
  assert.equal(e.radioFor('text'), RADIO.perPhase);
  assert.equal(e.radioLog.length, 0);
  assert.ok(!llm.labels(/대화 생성/).some(c => JSON.stringify(c.messages).includes('본부 무전')));
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
  assert.equal(llm.calls.length, TOTAL_BEATS * 2, '무전을 안 썼는데 호출이 늘었다');
  assert.equal(e.radioLog.length, 0);
  assert.ok(!llm.calls.some(c => JSON.stringify(c.messages || []).includes('본부 무전')));
});
