// live.mjs — 실제 API로 게임을 끝까지 돌려보는 밸런싱 하네스.
// 브라우저 없이 engine.js를 그대로 구동한다 (engine은 DOM을 모른다).
//
//   ANTHROPIC_API_KEY=sk-... node tests/live.mjs [옵션]
//   (OPENAI_API_KEY / OPENROUTER_API_KEY 도 받는다 — 업자는 키 접두사로 갈린다)
//     --couples=politics,os-war   돌릴 커플 id (기본: 대표 3건)
//     --profiles=ace,good,none    플레이 수준 (기본: 셋 다)
//     --model=...                 업자별 하위 등급만 허용 (기본값 → tests/test-model.mjs)
//     --concurrency=4
//     --out=/tmp/live.json
//
// 플레이 수준 — 요원이 쓸 수 있는 곳은 셋뿐이다 (스타일링 · 동기부여 · 코칭).
//   ace  : 요원 역할을 LLM이 맡는다. 스크리닝 여덟 항목만 보고 셋을 짠다.
//   good : 사람이 성의 있게 쓴 수준의 고정 템플릿.
//   none : 아무것도 입력하지 않음. **이쪽이 러브 포인트가 안 올라야 게임이 성립한다.**
//
// 보는 것: 러브/무드 포인트의 분포, 판정이 same으로만 몰리지 않는지, 성사율.

import { LlmClient } from '../js/llm.js';
import { Engine, dressOf } from '../js/engine.js';
import { COUPLE_BY_ID } from '../js/couples.js';
import * as P from '../js/prompts.js';
import { POINTS, TOTAL_BEATS } from '../js/points.js';
import { resolveTestModel, requireTestKey } from './test-model.mjs';
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2)
  .filter(a => a.startsWith('--'))
  .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || 'true']; }));

const KEY = requireTestKey();
const MODEL = resolveTestModel(args.model, process.argv, KEY);
const CONCURRENCY = Number(args.concurrency || 4);
const PROFILES = (args.profiles || 'ace,good,none').split(',');
const DEFAULT_COUPLES = ['sauce-war', 'os-war', 'politics'];
const COUPLE_IDS = (args.couples ? args.couples.split(',') : DEFAULT_COUPLES)
  .filter(id => { if (!COUPLE_BY_ID[id]) { console.error('알 수 없는 커플 id:', id); return false; } return true; });
const OUT = args.out || '/tmp/claude-0/live-results.json';

// ── 요원 역할 LLM (ace 프로필) ───────────────────────────
// 진짜 플레이어와 **정확히 같은 정보**만 준다 — 스크리닝의 여덟 항목이 전부다.
const AGENT_SCHEMA = {
  type: 'object',
  properties: {
    styling: { type: 'string', description: '스타일링 주문. 고객 외모를 덮어쓴다' },
    motivation: { type: 'string', description: '동기부여 주문. 고객 성격을 덮어쓴다' },
    coaching: { type: 'string', description: '코칭. 고객 프롬프트에 명령으로 박힌다' },
  },
  required: ['styling', 'motivation', 'coaching'],
  additionalProperties: false,
};

function screeningText(c) {
  const rows = (who, person) => P.SCREEN_FIELDS[who]
    .map(f => `  · ${f.en}: ${Array.isArray(person[f.key]) ? person[f.key].join(' / ') : person[f.key]}`)
    .join('\n');
  return `[CLIENT] ${c.client.name} (${P.idOf(c.client)})
${rows('client', c.client)}
[TARGET] ${c.target.name} (${P.idOf(c.target)})
${rows('target', c.target)}`;
}

const AGENT_SYSTEM = `You are a veteran Bureau of Cupid field operative. You read the screening sheet
and write three things. None of them is scored — each is injected verbatim into the conversation
prompt and changes what the client actually does. So do not write to look good; write the sentence
that makes that person behave that way.

- styling: overwrites the client's **look** wholesale. Aim it at the target's taste. 3-5 items.
- motivation: overwrites the client's **personality** wholesale. It decides who sits down at that table.
- coaching: an order the client alone hears. The client does not know the target's taste, so it
  only reaches them if you **write it out here**. What to raise, what to avoid. Imperative, 8
  sentences at most. You can also fix where they meet.

Know how LOVE moves. A conversation going well is worth zero. An office worker has a dozen
conversations a day and falls in love with none of them. It only moves for what a colleague could
not have caused — a line that landed because it was this person, a guard dropped toward the person
instead of the topic, a move to keep the evening from ending.

Write all three in Korean.`;

async function aceOrders(llm, c) {
  return llm.call({
    label: `[요원AI] ${c.id}`, system: AGENT_SYSTEM,
    messages: [{ role: 'user', content: screeningText(c) + '\n\nWrite the three.' }],
    schema: AGENT_SCHEMA, effort: 'medium', maxTokens: 6000,
  });
}

function goodOrders(c) {
  const taste = c.target.taste.slice(0, 3).join(' / ');
  return {
    styling: `${c.target.name}이 좋아한다고 알려진 것(${taste})에 맞춘 차림. 과하지 않게, 한 군데만 확실히 눈에 띄게.`,
    motivation: `오늘 이 자리가 마지막 기회라는 걸 알고 있다. 초조하지만 그걸 숨기지 못한다. 자기 얘기보다 상대 얘기를 듣는 쪽으로 기울어 있다.`,
    coaching: `상대가 좋아하는 건 이거다: ${taste}. 그중 하나를 네가 먼저 꺼내라.\n`
      + `네 얘기를 세 문장 이상 이어서 하지 마라. 상대가 말을 아끼면 넘어가지 말고 한 번 더 물어라.\n`
      + `상대가 화제를 돌리면 따라가라. 오늘 이겨야 할 논쟁은 없다.`,
  };
}

const EMPTY = { styling: '', motivation: '', coaching: '' };

// ── 한 판 ────────────────────────────────────────────────
async function playOne(coupleId, profile) {
  const c = COUPLE_BY_ID[coupleId];
  const llm = new LlmClient();
  llm.apiKey = KEY;
  llm.model = MODEL;

  const orders = profile === 'ace' ? await aceOrders(llm, c)
    : profile === 'good' ? goodOrders(c)
      : EMPTY;

  // A. 스타일링 / 동기부여 — 칸마다 한 호출. 주문이 있을 때만 부른다 (화면과 같은 동작)
  const styled = { look: null, personality: null };
  const [look, persona] = await Promise.all([
    (orders.styling || '').trim()
      ? llm.call({
        label: `A-1 · ${c.id}`, system: P.STYLING_SYSTEM,
        messages: [{ role: 'user', content: P.stylingUser(c, c.client.spec, orders.styling) }],
        schema: P.STYLING_SCHEMA, effort: 'low', maxTokens: 6000,
      }).catch(() => null) : null,
    (orders.motivation || '').trim()
      ? llm.call({
        label: `A-2 · ${c.id}`, system: P.MOTIVATION_SYSTEM,
        messages: [{ role: 'user', content: P.motivationUser(c, orders.motivation) }],
        schema: P.MOTIVATION_SCHEMA, effort: 'low', maxTokens: 6000,
      }).catch(() => null) : null,
  ]);
  styled.look = look?.look || null;
  styled.personality = persona?.personality || null;
  const dressed = dressOf(c.client, styled);

  const engine = new Engine(llm, { couple: c, dressed, coaching: orders.coaching, handlers: {} });
  await engine.run();
  const result = await engine.finish();

  const marks = engine.points.history;
  return {
    couple: c.id, profile,
    love: result.love, mood: result.mood,
    success: result.success, broken: result.broken,
    beats: marks.length,
    loveUp: marks.filter(m => m.dLove > 0).length,
    loveDown: marks.filter(m => m.dLove < 0).length,
    moodUp: marks.filter(m => m.dMood > 0).length,
    moodDown: marks.filter(m => m.dMood < 0).length,
    orders, dressed,
    epilogue: result.epilogue,
    transcript: result.transcript,
    usage: llm.usage,
  };
}

// ── 실행 ─────────────────────────────────────────────────
const jobs = [];
for (const id of COUPLE_IDS) for (const p of PROFILES) jobs.push({ id, p });
console.log(`\n🎬 실제 API로 ${jobs.length}판 (모형 ${MODEL} · 동시 ${CONCURRENCY} · 판당 ${TOTAL_BEATS * 2 + 2}콜 내외)\n`);

const results = [];
let done = 0;
async function worker() {
  for (;;) {
    const job = jobs.shift();
    if (!job) return;
    try {
      const r = await playOne(job.id, job.p);
      results.push(r);
      console.log(`  ${r.success ? '💘' : r.broken ? '💥' : '💔'} ${String(++done).padStart(2)}/${results.length + jobs.length}`
        + ` ${job.id.padEnd(16)} ${job.p.padEnd(5)}`
        + ` 러브 ${String(r.love).padStart(2)}/${POINTS.loveMax} · 무드 ${String(r.mood).padStart(2)}/${POINTS.moodMax}`
        + ` · 러브 판정 ▲${r.loveUp} ▼${r.loveDown} / ${r.beats}구간`);
    } catch (e) {
      done++;
      console.log(`  ⚠️  ${job.id} ${job.p} — ${e.message}`);
      results.push({ couple: job.id, profile: job.p, error: e.message });
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// ── 집계 ─────────────────────────────────────────────────
const ok = results.filter(r => !r.error);
console.log(`\n${'═'.repeat(60)}\n플레이 수준별`);
for (const p of PROFILES) {
  const rs = ok.filter(r => r.profile === p);
  if (!rs.length) continue;
  const avg = k => (rs.reduce((n, r) => n + r[k], 0) / rs.length).toFixed(1);
  const wins = rs.filter(r => r.success).length;
  console.log(`  ${p.padEnd(5)} 러브 평균 ${avg('love').padStart(5)} (최소 ${Math.min(...rs.map(r => r.love))} · 최대 ${Math.max(...rs.map(r => r.love))})`
    + ` · 무드 평균 ${avg('mood').padStart(5)} · 성사 ${wins}/${rs.length}`
    + ` · 러브 ▲ 평균 ${avg('loveUp')}`);
}
const allMarks = ok.reduce((n, r) => n + r.beats, 0);
const allUp = ok.reduce((n, r) => n + r.loveUp, 0);
const allDown = ok.reduce((n, r) => n + r.loveDown, 0);
console.log(`\n러브 판정 분포 — ▲ ${allUp} · ▼ ${allDown} · ─ ${allMarks - allUp - allDown} (총 ${allMarks}구간)`);
console.log(`  ▲ 비율 ${(allUp / allMarks * 100).toFixed(0)}% — 20~35%면 건강하다. 60%를 넘으면 심판이 도장을 찍고 있는 것이다.`);
console.log(`눈금: 러브 ${POINTS.loveStart}→0..${POINTS.loveMax} · 무드 ${POINTS.moodStart}→0..${POINTS.moodMax}`
  + ` · 무드 ▲/▼ 한 칸 · 러브 ▼ 한 칸, ▲ 1~4칸 (달아오름 ≥${POINTS.moodHot} +1, 연속 +${POINTS.loveStreak.at(-1)}까지)`);

fs.mkdirSync(OUT.replace(/\/[^/]+$/, ''), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
console.log(`\n📄 전문 기록 → ${OUT}`);
