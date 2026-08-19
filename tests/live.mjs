// live.mjs — 실제 Claude API로 게임을 끝까지 돌려보는 밸런싱 하네스.
// 브라우저 없이 engine.js를 그대로 구동한다 (engine은 DOM을 모른다).
//
//   ANTHROPIC_API_KEY=sk-... node tests/live.mjs [옵션]
//     --couples=politics,os-war      돌릴 커플 id (기본: 난이도별 대표 3건)
//     --profiles=ace,good,lazy,none  플레이 수준 (기본: 전부)
//     --model=claude-opus-5
//     --concurrency=4
//     --out=/tmp/live.json
//
// 플레이 수준
//   ace  : 요원 역할을 LLM이 맡는다. 의뢰서를 읽고 스타일링/코칭/연설을 짜고, 매 무전 기회에 실황을 보고 지시한다.
//          (미확인 취향은 절대 보여주지 않는다 — 진짜 플레이어와 같은 정보만 준다)
//   good : 사람이 성의 있게 쓴 수준의 고정 템플릿 프롬프트. 무전은 일반적인 지시 1~2회.
//   lazy : 한 단어짜리 성의 없는 입력. 무전 없음.
//   none : 아무것도 입력하지 않음.

import { LlmClient } from '../js/llm.js';
import { Engine } from '../js/engine.js';
import { COUPLES, COUPLE_BY_ID } from '../js/couples.js';
import { diffOf } from '../js/scoring.js';
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2)
  .filter(a => a.startsWith('--'))
  .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || 'true']; }));

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY 없음'); process.exit(1); }

const MODEL = args.model || 'claude-opus-5';
const CONCURRENCY = Number(args.concurrency || 4);
const PROFILES = (args.profiles || 'ace,good,lazy,none').split(',');
const DEFAULT_COUPLES = ['sauce-war', 'os-war', 'politics']; // 쉬움/보통/헬 대표
const COUPLE_IDS = (args.couples ? args.couples.split(',') : DEFAULT_COUPLES)
  .filter(id => { if (!COUPLE_BY_ID[id]) { console.error('알 수 없는 커플 id:', id); return false; } return true; });
const OUT = args.out || '/tmp/claude-0/live-results.json';

// ── 요원 역할 LLM (ace 프로필) ───────────────────────────
const AGENT_PREP_SCHEMA = {
  type: 'object',
  properties: {
    styling: { type: 'string', description: '스타일링 태그 콤마 구분' },
    coaching: { type: 'string', description: '클라이언트 AI에 주입될 행동 지침. 구체적인 금지/실행 지시' },
    speech: { type: 'string', description: '출동 직전 격려 연설' },
  },
  required: ['styling', 'coaching', 'speech'],
  additionalProperties: false,
};

const AGENT_RADIO_SCHEMA = {
  type: 'object',
  properties: { order: { type: 'string', description: '한 문장짜리 무전 지시' } },
  required: ['order'], additionalProperties: false,
};

function dossierText(c) {
  // 진짜 플레이어가 보는 것과 똑같은 정보만. hiddenPrefs는 개수만.
  return `[클라이언트] ${c.client.name} (${c.client.age}, ${c.client.job})
사연: ${c.client.story}
성격: ${c.client.personality.join(', ')}
치명적 약점: ${c.client.weakness}
[타겟] ${c.target.name} (${c.target.age}, ${c.target.job})
성격: ${c.target.personality.join(', ')}
알려진 취향: ${c.target.visiblePrefs.join(' / ')}
미확인 취향: ${c.target.hiddenPrefs.length}건 (내용 비공개)
지뢰(밟으면 파탄): ${c.target.redLines.join(' / ')}
[이 매칭이 지옥인 이유] ${c.clash}
[결승선] ${c.endingKind}`;
}

const AGENT_SYSTEM = `너는 큐피드국의 베테랑 공작요원이다. 의뢰서를 읽고 작전 준비물을 짠다.
이 준비물은 채점되지 않는다. 그대로 클라이언트 AI의 시스템 프롬프트에 주입되어 실제 대화 행동을 바꾼다.
그러니 "잘 보이게 쓰는 글"이 아니라 "그 인간이 실제로 그렇게 행동하게 만드는 명령"을 써라.
- styling: 타겟의 알려진 취향을 저격하는 착장 태그 3~5개. 지뢰를 건드리는 착장은 금지.
- coaching: 반드시 (a) 클라이언트의 약점을 봉인하는 금지 조항, (b) 타겟 취향으로 화제를 끄는 실행 조항,
  (c) 지뢰 회피 조항을 모두 포함. 6문장 이내, 명령형.
- speech: 클라이언트 사연 속 구체적 장면을 짚어 자부심으로 뒤집는 연설. 4문장 이내.
한국어로 쓴다.`;

const RADIO_SYSTEM = `너는 큐피드국 공작요원이다. 진행 중인 대화를 보고 클라이언트에게만 들리는 무전을 한 문장 보낸다.
무전은 클라이언트의 다음 발언에 그대로 주입된다. 채점되지 않는다.
가장 가치 있는 무전은 아직 안 드러난 타겟의 숨은 면을 캘 화제를 지정하는 것이다.
막연한 응원("잘하고 있어")은 아무것도 바꾸지 못하니 금지.
반드시 "지금 이 흐름에서 다음 한 마디로 무엇을 말하라"는 구체적 지시여야 한다. 지뢰는 절대 건드리지 마라.`;

async function acePrep(llm, c) {
  const r = await llm.call({
    label: `[요원AI] 준비 ${c.id}`, system: AGENT_SYSTEM,
    messages: [{ role: 'user', content: dossierText(c) + '\n작전 준비물을 짜라.' }],
    schema: AGENT_PREP_SCHEMA, effort: 'medium', maxTokens: 6000,
  });
  return r;
}

async function aceRadio(llm, c, engine) {
  const r = await llm.call({
    label: `[요원AI] 무전 ${c.id}`, system: RADIO_SYSTEM,
    messages: [{
      role: 'user', content:
        `${dossierText(c)}\n[현재 게이지] 호감 ${Math.round(engine.state.love)} / 분위기 ${Math.round(engine.state.mood)}` +
        `\n[아직 못 캔 미확인 취향] ${c.target.hiddenPrefs.length - engine.state.hits.length}건` +
        `\n[지금까지의 대화]\n${engine.fullTranscript()}\n무전 지시 한 문장.`,
    }],
    schema: AGENT_RADIO_SCHEMA, effort: 'low', maxTokens: 3000,
  });
  return r.order;
}

// ── 고정 템플릿 프로필 ───────────────────────────────────
function goodPrep(c) {
  return {
    styling: `${c.target.visiblePrefs[0]}에 맞춘 단정한 정장, 깔끔한 구두, 은은한 향수`,
    coaching: `${c.client.weakness} — 이 습관은 절대 하지 마라. ` +
      `상대가 말하면 먼저 끝까지 듣고 되물어라. ${c.target.visiblePrefs.join('와 ')} 이야기로 화제를 끌어라. ` +
      `${c.target.redLines[0]}은(는) 무슨 일이 있어도 꺼내지 마라.`,
    speech: `당신 사연 다 읽었습니다. 그 순간을 견딘 사람이 오늘 못 할 게 뭐가 있습니까. ` +
      `당신이 이상한 게 아니라, 당신이 특이한 겁니다. 그게 무기입니다. 가서 그대로 보여주세요.`,
  };
}
const LAZY_PREP = { styling: '옷', coaching: '잘해라', speech: '화이팅' };
const NONE_PREP = { styling: '', coaching: '', speech: '' };

// 무전 타이밍: 문자 3턴째, 대면 2·4턴째
function shouldRadio(phase, turn) {
  return (phase === 'text' && turn === 3) || (phase === 'talk' && (turn === 2 || turn === 4));
}

// ── 한 판 ────────────────────────────────────────────────
async function playOne(coupleId, profile) {
  const c = COUPLE_BY_ID[coupleId];
  const llm = new LlmClient();
  llm.apiKey = KEY; llm.model = MODEL;
  const t0 = Date.now();
  const events = [];

  // 1) 준비물
  let raw;
  if (profile === 'ace') raw = await acePrep(llm, c);
  else if (profile === 'good') raw = goodPrep(c);
  else if (profile === 'lazy') raw = LAZY_PREP;
  else raw = NONE_PREP;

  // 2) 스타일링은 실제 게임과 동일하게 LLM 시공을 거친다 (outfitDesc가 대면 판정에 쓰인다)
  let outfitDesc = '';
  if (raw.styling && raw.styling.trim()) {
    try {
      const P = await import('../js/prompts.js');
      const st = await llm.call({
        label: `스타일링 ${c.id}`, system: P.STYLING_SYSTEM,
        messages: [{ role: 'user', content: P.stylingUser(c, c.client.spec, raw.styling) }],
        schema: P.STYLING_SCHEMA, effort: 'low', maxTokens: 4000,
      });
      outfitDesc = st.outfitDesc || raw.styling;
    } catch { outfitDesc = raw.styling; }
  }

  const engine = new Engine(llm, {
    couple: c,
    prep: { outfitDesc, coaching: raw.coaching, speech: raw.speech },
    handlers: {
      bubble: (who, text) => events.push({ who, text }),
      judge: j => events.push({ who: 'judge', ...j }),
      turn: async ({ phase, turn }) => {
        if (profile === 'lazy' || profile === 'none') return;
        if (!shouldRadio(phase, turn) || engine.radioLeft <= 0) return;
        const order = profile === 'ace'
          ? await aceRadio(llm, c, engine).catch(() => null)
          : turn === 2
            ? '상대가 방금 뭔가 말하려다 삼킨 것 같다. 그거 뭐였냐고 물고 늘어져라.'
            : `지금 흐름 그대로 이어가면서 ${c.target.visiblePrefs[turn % c.target.visiblePrefs.length]} 이야기를 꺼내고, 상대에게 그 얘기를 더 해달라고 물어봐라.`;
        if (order) engine.submitRadio(order);
      },
    },
  });

  let alive = true;
  try {
    alive = await engine.runTexting();
    if (alive) {
      const sit = await engine.situation();
      await engine.runTalking(sit);
    }
  } catch (e) {
    events.push({ who: 'error', text: e.message });
    engine.aborted = true;
  }
  const res = await engine.finish();

  return {
    coupleId, profile, difficulty: c.difficulty, endingKind: c.endingKind,
    accepted: res.verdict.accepted, grade: res.verdict.grade,
    love: res.verdict.love, mood: res.verdict.mood, threshold: res.difficulty.threshold,
    moodFloor: res.difficulty.moodFloor, aborted: res.aborted,
    hits: res.state.hits.length, hiddenTotal: c.target.hiddenPrefs.length,
    redLines: res.state.redLines, radioUsed: res.state.radioUsed,
    tiers: res.state.history.map(h => h.tier),
    // 오프라인 리플레이(tests/sim.mjs)용 판정 스트림. 이걸로 API 없이 상수를 다시 맞춘다.
    judgments: res.state.history.map(h => ({
      tier: h.tier, judgeTier: h.judgeTier, moodDelta: h.rawMood,
      hit: h.hit || '', red: !!h.red, firstImpression: !!h.firstImpression,
    })),
    rawLove: res.state.history.map(h => h.rawLove),
    rawMood: res.state.history.map(h => h.rawMood),
    curve: res.state.history.map(h => [h.love, h.mood]),
    usage: { ...llm.usage },
    seconds: Math.round((Date.now() - t0) / 1000),
    prep: { styling: raw.styling, outfitDesc, coaching: raw.coaching, speech: raw.speech },
    transcript: res.transcript,
    letterMvp: res.letter.mvp,
  };
}

// ── 러너 ─────────────────────────────────────────────────
async function pool(jobs, n) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, async () => {
    while (i < jobs.length) {
      const idx = i++;
      try { out[idx] = await jobs[idx](); }
      catch (e) { out[idx] = { error: e.message, ...jobs[idx].meta }; console.error('💥', jobs[idx].meta, e.message); }
      const r = out[idx];
      if (!r.error) {
        console.log(`  ✔ ${pad(r.coupleId, 22)} ${pad(r.profile, 5)} ${r.difficulty} → ` +
          `${r.accepted ? '성사' : '결렬'} ${r.grade}  호감 ${pad(String(r.love), 3)}/${r.threshold}  분위기 ${pad(String(r.mood), 3)}/${r.moodFloor}  ` +
          `취향 ${r.hits}/${r.hiddenTotal}  지뢰 ${r.redLines}  ${r.seconds}s  $${r.usage.cost.toFixed(3)}  🧊${r.usage.cacheRead}`);
      }
    }
  }));
  return out;
}
const pad = (s, n) => String(s).padEnd(n);

(async () => {
  const jobs = [];
  for (const id of COUPLE_IDS) for (const p of PROFILES) {
    const f = () => playOne(id, p);
    f.meta = { coupleId: id, profile: p };
    jobs.push(f);
  }
  console.log(`\n🎬 라이브 ${jobs.length}판 (커플 ${COUPLE_IDS.length} × 프로필 ${PROFILES.length}) · 모델 ${MODEL} · 동시 ${CONCURRENCY}\n`);
  const started = Date.now();
  const results = await pool(jobs, CONCURRENCY);
  const ok = results.filter(r => !r.error);

  console.log('\n════════ 프로필 × 난이도 성사율 ════════');
  const grid = {};
  for (const r of ok) {
    const k = `${r.profile}|${r.difficulty}`;
    (grid[k] ||= { n: 0, win: 0, love: 0, mood: 0, hits: 0, red: 0 });
    grid[k].n++; grid[k].win += r.accepted ? 1 : 0;
    grid[k].love += r.love; grid[k].mood += r.mood; grid[k].hits += r.hits; grid[k].red += r.redLines;
  }
  console.log(pad('프로필|난이도', 18) + pad('판수', 6) + pad('성사', 8) + pad('평균호감', 10) + pad('평균분위기', 12) + pad('취향', 6) + '지뢰');
  for (const [k, g] of Object.entries(grid).sort()) {
    console.log(pad(k, 18) + pad(g.n, 6) + pad(`${g.win}/${g.n}`, 8) +
      pad((g.love / g.n).toFixed(1), 10) + pad((g.mood / g.n).toFixed(1), 12) +
      pad((g.hits / g.n).toFixed(1), 6) + (g.red / g.n).toFixed(1));
  }

  const allTiers = ok.flatMap(r => r.tiers);
  const tierCount = {};
  for (const t of allTiers) tierCount[t] = (tierCount[t] || 0) + 1;
  const TORDER = ['critical', 'hit', 'ok', 'empty', 'backfire', 'redline'];
  console.log('\n심판 tier 분포: ' + TORDER.map(t => `${t} ${tierCount[t] || 0}(${((tierCount[t] || 0) / allTiers.length * 100).toFixed(0)}%)`).join(' · '));

  // 프로필별 tier 분포 — 잘한 플레이와 못한 플레이가 실제로 갈리는지 본다
  for (const p of PROFILES) {
    const t = ok.filter(r => r.profile === p).flatMap(r => r.tiers);
    if (!t.length) continue;
    const cnt = {}; for (const x of t) cnt[x] = (cnt[x] || 0) + 1;
    console.log(`  ${pad(p, 5)} ` + TORDER.map(x => `${x[0].toUpperCase()}${cnt[x] || 0}`).join(' ') + `  (n=${t.length})`);
  }

  const allRaw = ok.flatMap(r => r.rawLove);
  const allRawM = ok.flatMap(r => r.rawMood);
  const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : '-';
  const hist = a => { const h = {}; for (const v of a) h[v] = (h[v] || 0) + 1; return Object.entries(h).sort((x, y) => x[0] - y[0]).map(([k, v]) => `${k}:${v}`).join(' '); };
  console.log(`\n심판 원판정 loveDelta 평균 ${avg(allRaw)} · 분포 ${hist(allRaw)}`);
  console.log(`심판 원판정 moodDelta 평균 ${avg(allRawM)} · 분포 ${hist(allRawM)}`);

  const cost = ok.reduce((s, r) => s + r.usage.cost, 0);
  const calls = ok.reduce((s, r) => s + r.usage.calls, 0);
  const cacheRead = ok.reduce((s, r) => s + r.usage.cacheRead, 0);
  const inTok = ok.reduce((s, r) => s + r.usage.inputTokens, 0);
  const saved = ok.reduce((s, r) => s + r.usage.saved, 0);
  console.log(`\n총 ${ok.length}판 · ${calls}콜 · $${cost.toFixed(2)} · 캐시적중 ${cacheRead.toLocaleString()}tok (비캐시 입력 ${inTok.toLocaleString()}tok, 절감 $${saved.toFixed(3)})`);
  console.log(`벽시계 ${Math.round((Date.now() - started) / 1000)}s · 판당 평균 ${Math.round(ok.reduce((s, r) => s + r.seconds, 0) / Math.max(1, ok.length))}s`);

  fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  console.log(`\n📄 상세 결과 → ${OUT}`);
})();
