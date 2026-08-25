// node --test tests/engine.test.mjs — 하네스. 가짜 LLM을 물려 한 판을 통째로 돌린다.
//
// 확인하는 것: 호출 순서와 횟수, 구간 판정 반영, 무드 바닥 시 조기 종료,
// 대화 내역 누적, 후일담 정산. 프롬프트 내용 감사는 orders.test.mjs가 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, dressOf } from '../js/engine.js';
import { COUPLES } from '../js/couples.js';
import { PHASES, POINTS, TOTAL_BEATS } from '../js/points.js';

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
