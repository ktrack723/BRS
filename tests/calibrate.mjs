// calibrate.mjs — 밸런싱 하네스. 값이 비싼 순서대로 아끼도록 짜여 있다.
//
//   ANTHROPIC_API_KEY=sk-... node tests/calibrate.mjs [옵션]
//     --couples=a,b,c   코퍼스에 쓸 커플 id (기본 6건)
//     --repeats=3       같은 구간을 몇 번 판정할지 (자기일관성 측정)
//     --budget=3        하드 상한($). 넘으면 그 자리에서 멈춘다
//     --stages=1,2,3,4  돌릴 단계
//     --corpus=path     코퍼스 캐시 (있으면 1단계를 건너뛴다)
//
// ── 왜 이렇게 나눴나 ─────────────────────────────────────
// 밸런싱에서 LLM이 실제로 필요한 것은 딱 둘이다.
//   ① 심판의 판정 분포   — ▲/▼/─ 가 어떤 비율로 나오는가
//   ② 후일담의 성사 곡선 — 러브 수치를 보고 성사를 언제 찍는가
// **산수 규칙(points.js) 자체는 LLM이 전혀 필요 없다.** ①만 있으면 무한히 돌릴 수 있다.
//
// 그리고 비용은 대화 생성 쪽에 몰려 있다 — 출력이 6줄(수백 토큰)이고 9구간을 돈다.
// 판정은 출력이 JSON 두 줄(30토큰)이라 거의 공짜다. 그래서:
//
//   1단계  대화 코퍼스를 **한 번만** 만든다 (비싼 쪽). 판정은 이때 호출하지 않고,
//          심판에게 갔을 (priorLog, segment)만 가로채 저장한다.
//   2단계  그 코퍼스 위에서 판정을 **여러 번** 돌린다 (싼 쪽). 같은 payload를
//          반복하므로 프롬프트 캐시가 그대로 먹는다.
//   3단계  같은 대화에 **러브 수치만 바꿔** 후일담을 부른다. 통제 실험이라
//          "C가 로그를 보고 정하는가 숫자를 보고 정하는가"가 그대로 드러난다.
//   4단계  ②의 분포로 오프라인 몬테카를로. 돈이 안 든다.

import { LlmClient } from '../js/llm.js';
import { Engine, dressOf } from '../js/engine.js';
import { COUPLES, COUPLE_BY_ID } from '../js/couples.js';
import * as P from '../js/prompts.js';
import { POINTS, PHASES, TOTAL_BEATS, applyVerdict, initialPoints, isBroken, loveOutOf100 } from '../js/points.js';
import { requireTestKey, resolveTestModel } from './test-model.mjs';
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--'))
  .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || 'true']; }));

const KEY = requireTestKey();
const MODEL = resolveTestModel(args.model, process.argv, KEY);
const REPEATS = Number(args.repeats || 3);
const BUDGET = Number(args.budget || 3);
const STAGES = new Set((args.stages || '1,2,3,4').split(','));
const CONC = Number(args.concurrency || 6);
const CURVE_N = Number(args['curve-n'] || 6);
const CORPUS = args.corpus || '/tmp/claude-0/calibrate-corpus.json';
const OUT = args.out || '/tmp/claude-0/calibrate-result.json';
const DEFAULT_COUPLES = ['sauce-war', 'os-war', 'politics'];
const COUPLE_IDS = (args.couples ? args.couples.split(',') : DEFAULT_COUPLES).filter(id => COUPLE_BY_ID[id]);

// 키를 먼저 넣어야 업자가 정해진다. 모델은 그 뒤에 얹는다 (setter가 안 맞는 모델을 갈아 끼운다).
const llm = new LlmClient();
llm.apiKey = KEY;
llm.model = MODEL;
const money = () => llm.usage.cost;
const fmt = n => '$' + n.toFixed(4);

/** 하드 상한. 예산은 지키라고 있는 것이지 참고하라고 있는 게 아니다. */
class BudgetOut extends Error {}
function checkBudget(where) {
  if (money() >= BUDGET) throw new BudgetOut(`예산 ${fmt(BUDGET)} 소진 (${where}, 현재 ${fmt(money())})`);
}

/** 동시 실행 풀. 순차로 돌리면 코퍼스 한 벌에 30분이 넘는다. */
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const goodOrders = c => {
  const taste = c.target.taste.slice(0, 3).join(' / ');
  return {
    styling: `${c.target.name}이 좋아한다고 알려진 것(${taste})에 맞춘 차림. 과하지 않게, 한 군데만 확실히 눈에 띄게.`,
    motivation: '오늘 이 자리가 마지막 기회라는 걸 알고 있다. 초조하지만 그걸 숨기지 못한다.',
    coaching: `상대가 좋아하는 건 이거다: ${taste}. 그중 하나를 네가 먼저 꺼내라.\n`
      + '네 얘기를 세 문장 이상 이어서 하지 마라. 상대가 말을 아끼면 한 번 더 물어라.',
  };
};
const EMPTY = { styling: '', motivation: '', coaching: '' };
const PROFILES = { none: () => EMPTY, good: goodOrders };

// ── 1단계. 대화 코퍼스 ───────────────────────────────────
// 진짜 Engine을 그대로 돌린다. 판정만 가로채서 API를 안 태우고, 심판에게 갔을
// payload를 기록한다 — 대화 생성은 무드·러브를 전혀 안 보므로(talkSystem 참고)
// 판정을 굶겨도 나오는 대화는 실제 판과 같은 분포다.
async function buildCorpus() {
  const jobs = COUPLE_IDS.flatMap(id => Object.keys(PROFILES).map(p => ({ id, p })));
  let done = 0;
  const per = await pool(jobs, CONC, async ({ id, p }) => {
    checkBudget('코퍼스');
    const c = COUPLE_BY_ID[id];
    const beats = [];
    // 판정만 가로채는 대역. 대화 생성은 그대로 API로 나간다.
    const spy = {
      usage: llm.usage,
      async call(a) {
        if (a.label.includes('판정')) {
          beats.push({ couple: id, profile: p, label: a.label, user: a.messages[0].content });
          return { mood: 'same', love: 'same' };
        }
        return llm.call(a);
      },
    };
    const e = new Engine(spy, {
      couple: c, dressed: dressOf(c.client, null),
      coaching: PROFILES[p](c).coaching, handlers: {},
    });
    await e.run().catch(() => {});
    console.log(`  [${++done}/${jobs.length}] ${id.padEnd(16)} ${p.padEnd(5)} 구간 ${beats.length}  누적 ${fmt(money())}`);
    return beats;
  });
  return per.flat();
}

// ── 2단계. 판정 반복 ─────────────────────────────────────
async function judgeCorpus(beats) {
  let done = 0;
  const rows = await pool(beats, CONC, async (b) => {
    const c = COUPLE_BY_ID[b.couple];
    const sys = P.judgeSystem(c, dressOf(c.client, null));
    const votes = [];
    // 같은 payload를 REPEATS번 반복한다 — 2회차부터는 프롬프트 캐시가 그대로 먹는다.
    for (let r = 0; r < REPEATS; r++) {
      checkBudget('판정');
      const v = await llm.call({
        label: `판정 ${b.couple}/${b.profile} r${r}`, system: sys, cache: true,
        messages: [{ role: 'user', content: b.user }],
        schema: P.JUDGE_SCHEMA, effort: 'low', maxTokens: 2000,
      }).catch(() => null);
      if (v) votes.push(v);
    }
    if (++done % 12 === 0) console.log(`  판정 ${done}/${beats.length}  누적 ${fmt(money())}`);
    return votes.length ? { couple: b.couple, profile: b.profile, beat: b.label, votes } : null;
  });
  return rows.filter(Boolean);
}

// ── 3단계. 성사 곡선 (통제 실험) ─────────────────────────
// 같은 대화 전문에 러브 수치만 갈아 끼운다. C가 숫자를 보는지 로그를 보는지 갈린다.
const LOVE_GRID = [10, 30, 50, 70, 90];
async function successCurve(transcripts) {
  const jobs = transcripts.flatMap(t => LOVE_GRID.map(love => ({ t, love })));
  let done = 0;
  const out = await pool(jobs, CONC, async ({ t, love }) => {
    checkBudget('후일담');
    const c = COUPLE_BY_ID[t.couple];
    const r = await llm.call({
      label: `후일담 ${t.couple}/${t.profile} love=${love}`,
      system: P.epilogueSystem(c, dressOf(c.client, null)), cache: true,
      messages: [{ role: 'user', content: P.epilogueUser(c, love, t.transcript) }],
      schema: P.EPILOGUE_SCHEMA, effort: 'medium', maxTokens: 4000,
    }).catch(() => null);
    if (++done % 10 === 0) console.log(`  후일담 ${done}/${jobs.length}  누적 ${fmt(money())}`);
    return r ? { couple: t.couple, profile: t.profile, love, success: !!r.success } : null;
  });
  return out.filter(Boolean);
}

// ── 4단계. 오프라인 몬테카를로 (무료) ────────────────────
// 2단계에서 잰 실측 분포로 판을 몇만 번 리샘플링한다. 산수 규칙은 LLM이 필요 없다.
function offlineSweep(dist, n = 20000) {
  const pick = d => { const r = Math.random(); return r < d.up ? 'up' : r < d.up + d.down ? 'down' : 'same'; };
  const loves = [], moods = []; let broke = 0;
  for (let i = 0; i < n; i++) {
    let s = initialPoints();
    outer: for (const ph of PHASES) {
      for (let b = 0; b < ph.beats; b++) {
        if (isBroken(s)) break outer;
        s = applyVerdict(s, { mood: pick(dist.mood), love: pick(dist.love) }, { phase: ph.key });
      }
    }
    loves.push(s.love); moods.push(s.mood); if (s.broken) broke++;
  }
  const sorted = [...loves].sort((a, b) => a - b);
  const q = p => sorted[Math.floor(p * (sorted.length - 1))];
  return {
    n, loveMean: +(loves.reduce((a, b) => a + b, 0) / n).toFixed(2),
    loveP10: q(0.1), loveMedian: q(0.5), loveP90: q(0.9), loveMax: sorted.at(-1),
    readingMean: Math.round(loveOutOf100(loves.reduce((a, b) => a + b, 0) / n)),
    moodMean: +(moods.reduce((a, b) => a + b, 0) / n).toFixed(2),
    brokenPct: +(broke / n * 100).toFixed(1),
    capPct: +(loves.filter(v => v >= POINTS.loveMax).length / n * 100).toFixed(1),
  };
}

// ── 본체 ─────────────────────────────────────────────────
const result = { model: MODEL, couples: COUPLE_IDS, repeats: REPEATS };
try {
  let corpus = null;
  if (STAGES.has('1')) {
    console.log(`\n① 대화 코퍼스 — ${COUPLE_IDS.length}커플 × ${Object.keys(PROFILES).length}프로필 (판정은 API를 안 탄다)`);
    corpus = await buildCorpus();
    fs.writeFileSync(CORPUS, JSON.stringify(corpus));
    console.log(`  구간 ${corpus.length}개 저장 → ${CORPUS}   여기까지 ${fmt(money())}`);
  } else if (fs.existsSync(CORPUS)) {
    corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
    console.log(`\n① 코퍼스 재사용 — 구간 ${corpus.length}개`);
  }

  if (STAGES.has('2') && corpus) {
    console.log(`\n② 판정 — 구간 ${corpus.length}개 × ${REPEATS}회`);
    const spent = money();
    result.judged = await judgeCorpus(corpus);
    result.judgeCost = +(money() - spent).toFixed(4);
  }

  if (STAGES.has('3') && corpus) {
    // 코퍼스 구간 중 각 판의 마지막 것 = 대화 전문이 가장 긴 것 (priorLog + segment)
    const last = new Map();
    for (const b of corpus) last.set(`${b.couple}/${b.profile}`, b);
    // judgeUser는 [지금까지] + [이번에 새로] 두 토막이다. 마지막 구간까지 실으려면 둘을 붙여야 한다.
    const ts = [...last.values()].slice(0, CURVE_N).map(b => {
      const [head, tail = ''] = b.user.split('[이번에 새로 오간 부분 — 이것만 판정한다]');
      const prior = head.replace(/^\[지금까지의 대화[^\]]*\]\n/, '').trim();
      const seg = tail.split('Read the new stretch')[0].trim();
      return { couple: b.couple, profile: b.profile, transcript: `${prior}\n${seg}`.trim() };
    });
    console.log(`\n③ 성사 곡선 — 대화 ${ts.length}건 × 러브 ${LOVE_GRID.join('/')}`);
    const spent = money();
    result.curve = await successCurve(ts);
    result.curveCost = +(money() - spent).toFixed(4);
  }
} catch (e) {
  if (e instanceof BudgetOut) console.log(`\n⛔ ${e.message}`);
  else throw e;
}

// ── 집계 ─────────────────────────────────────────────────
if (result.judged?.length) {
  const flat = result.judged.flatMap(r => r.votes);
  const rate = (arr, k, v) => +(arr.filter(x => x[k] === v).length / arr.length).toFixed(3);
  result.dist = {
    love: { up: rate(flat, 'love', 'up'), down: rate(flat, 'love', 'down'), same: rate(flat, 'love', 'same') },
    mood: { up: rate(flat, 'mood', 'up'), down: rate(flat, 'mood', 'down'), same: rate(flat, 'mood', 'same') },
  };
  // 프로필별 러브 ▲ 비율 — none이 good보다 낮아야 게임이 성립한다
  result.byProfile = {};
  for (const p of Object.keys(PROFILES)) {
    const v = result.judged.filter(r => r.profile === p).flatMap(r => r.votes);
    if (v.length) result.byProfile[p] = { n: v.length, loveUp: rate(v, 'love', 'up'), moodUp: rate(v, 'mood', 'up') };
  }
  // 자기일관성 — 같은 구간을 몇 %나 같게 보는가 (최빈값 비율)
  const agree = key => {
    const rs = result.judged.filter(r => r.votes.length > 1);
    if (!rs.length) return null;
    return +(rs.reduce((acc, r) => {
      const cnt = {}; for (const v of r.votes) cnt[v[key]] = (cnt[v[key]] || 0) + 1;
      return acc + Math.max(...Object.values(cnt)) / r.votes.length;
    }, 0) / rs.length).toFixed(3);
  };
  result.selfAgreement = { love: agree('love'), mood: agree('mood') };
  result.offline = offlineSweep(result.dist);
}
result.usage = { ...llm.usage, cost: +llm.usage.cost.toFixed(4) };
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`\n💰 총 ${fmt(money())}  (호출 ${llm.usage.calls} · 입력 ${llm.usage.inputTokens} · 출력 ${llm.usage.outputTokens} · 캐시읽기 ${llm.usage.cacheRead})`);
console.log(`   결과 → ${OUT}`);
