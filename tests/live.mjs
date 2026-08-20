// live.mjs — 실제 Claude API로 게임을 끝까지 돌려보는 밸런싱 하네스.
// 브라우저 없이 engine.js를 그대로 구동한다 (engine은 DOM을 모른다).
//
//   ANTHROPIC_API_KEY=sk-... node tests/live.mjs [옵션]
//     --couples=politics,os-war      돌릴 커플 id (기본: 난이도별 대표 3건)
//     --profiles=ace,good,lazy,none  플레이 수준 (기본: 전부)
//     --model=...                    Sonnet 계열만 허용 (기본 {TEST_MODEL} → tests/test-model.mjs)
//     --concurrency=4
//     --out=/tmp/live.json
//
// 플레이 수준
//   ace  : 요원 역할을 LLM이 맡는다. 의뢰서를 읽고 착장/지침/연설을 짜고, 매 무전 기회에 실황을 보고 지시한다.
//          (상대가 감춰둔 이야기는 절대 보여주지 않는다 — 진짜 플레이어와 같은 정보만 준다)
//
// 주의: 취조실/정문의 '반응 확인'은 여기서 호출하지 않는다. 채점에 아무 영향이 없고 판당 2콜이 더 나간다.
//       그 경로는 tests/browser.mjs가 실제 화면에서 검증한다.
//   good : 사람이 성의 있게 쓴 수준의 고정 템플릿 프롬프트. 무전은 일반적인 지시 1~2회.
//   lazy : 한 단어짜리 성의 없는 입력. 무전 없음.
//   none : 아무것도 입력하지 않음.

import { LlmClient } from '../js/llm.js';
import { Engine } from '../js/engine.js';
import { COUPLES, COUPLE_BY_ID, flawReport } from '../js/couples.js';
import { diffOf } from '../js/scoring.js';
import { resolveTestModel, TEST_MODEL } from './test-model.mjs';
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2)
  .filter(a => a.startsWith('--'))
  .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || 'true']; }));

const MODEL = resolveTestModel(args.model);   // 테스트는 Sonnet 고정 (tests/test-model.mjs)

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY 없음'); process.exit(1); }
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
  // ※ 여기가 실제 의뢰서보다 얇으면 ace 프로필의 실측치가 사람보다 낮게 나온다.
  //    화면의 「심리 감정」 블록에 있는 것은 여기에도 있어야 한다.
  const rep = flawReport(c.client).map(r => `  · ${r.axis}: ${r.tag} — ${r.desc}`).join('\n');
  return `[클라이언트] ${c.client.name} (${c.client.age}, ${c.client.job})
사연: ${c.client.story}
성격: ${c.client.personality.join(', ')}
[심리 감정 — 의뢰서에 인쇄되어 나온다]
  · 이 자리에서 원하는 것: ${c.client.flaw.want}
  · 몸이 원하는 것: ${c.client.flaw.urge}
  · 이미 넘어본 선: ${c.client.flaw.nerve}
${rep}
  · 조건반사(가만두면 나온다): ${c.client.weakness}
■ 앞을 막고 있는 것 (호감만 채우면 차인다)
${c.barrier}
   대화에서 이걸 **실제로 다뤄야** 성사된다 — 길을 내거나, 감당하겠다고 하거나,
   정면으로 꺼내서 둘이 같이 곤란해져야 한다. 스치듯 언급하는 건 안 쳐준다.
⚠ 성향 충돌: 이 사람이 원하는 것을 그대로 좇으면 상대의 접촉 금지 항목 「${c.collision.redLine}」 쪽으로 간다.
   ${c.collision.why}
   버릇 때문이 아니라 성격 때문이라, 한 문장 금지로는 안 막힌다. 우회로를 깔아줘야 한다.
[타겟] ${c.target.name} (${c.target.age}, ${c.target.job})
성격: ${c.target.personality.join(', ')}
알려진 취향: ${c.target.visiblePrefs.join(' / ')}
아직 아무한테도 말 안 한 것: ${c.target.hiddenPrefs.length}건 (내용 비공개)
질색하는 것: ${c.target.redLines.join(' / ')}
[이 매칭이 지옥인 이유] ${c.clash}
[결승선] 연애`;
}

const AGENT_SYSTEM = `너는 큐피드국의 베테랑 공작요원이다. 의뢰서를 읽고 작전 준비물을 짠다.
이 준비물은 채점되지 않는다. 그대로 의뢰인 AI의 시스템 프롬프트에 주입되어 실제 대화 행동을 바꾼다.
그러니 "잘 보이게 쓰는 글"이 아니라 "그 인간이 실제로 그렇게 행동하게 만드는 명령"을 써라.

중요: 저 둘의 대화에는 **아무 규칙도 없다.** 상대는 정해진 신호를 흘리지 않고, 의뢰인도 정해진 반응을 하지 않는다.
그러니 "상대가 실마리를 흘리면 물어라" 같은 지시는 아무 의미가 없다. 그런 장치가 없기 때문이다.
대신 그 인간이 어떤 사람으로 그 자리에 앉을지를 정해줘라.

- styling: 상대의 알려진 취향에 맞춘 착장 태그 3~5개. 질색 항목을 건드리는 착장은 금지.
- coaching: 반드시 (a) **앞을 막고 있는 것을 대화에서 꺼내라는 조항** — 이걸 안 다루면
  호감이 아무리 높아도 차인다. 어떻게 꺼낼지까지 지정해라. (b) 의뢰인의 **조건반사를 이름으로 지목해서 금지**하는 조항 — 이게 제일 중요하다.
  그 버릇은 상대의 지뢰를 밟고, 한 번 막아도 다시 나온다. 되풀이해서 못 박아라. (b) 무슨 태도로 대화할지의 실행 조항,
  (c) 질색 항목 회피 조항, (d) 상대가 말을 아끼거나 화제를 돌릴 때 어떻게 할지의 판단 기준을 모두 포함.
  10문장 이내, 명령형.
- speech: 의뢰인 사연 속 구체적 장면을 짚어 자부심으로 뒤집는 연설. 4문장 이내.
한국어로 쓴다.`;

const RADIO_SYSTEM = `너는 큐피드국 공작요원이다. 진행 중인 대화를 보고 의뢰인에게만 들리는 무전을 한 문장 보낸다.
무전은 의뢰인의 다음 발언에 그대로 주입된다. 채점되지 않는다.
저 둘의 대화에는 규칙이 없어서 아무 데로나 흘러간다. 무전은 그 흐름에 끼어드는 유일한 손잡이다.
막연한 응원("잘하고 있어")은 아무것도 바꾸지 못하니 금지.
반드시 "지금 이 흐름에서 다음 한 마디로 무엇을 말하라"는 구체적 지시여야 한다. 질색 항목은 절대 건드리지 마라.`;

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
        `\n[지금 이 자리의 공기] ${engine.state.vibe || '(아직 없음)'}` +
        `\n[대화 중 상대에 대해 드러난 것] ${engine.state.revealed.join(' / ') || '없음'}` +
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
  const agent = { name: `자동요원-${profile}`, gender: '미기재' };
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
        messages: [{ role: 'user', content: P.stylingUser(c, c.client.spec, raw.styling, agent) }],
        schema: P.STYLING_SCHEMA, effort: 'low', maxTokens: 4000,
      });
      outfitDesc = st.outfitDesc || raw.styling;
    } catch (e) {
      // 조용히 삼키면 안 된다. 예전에 스키마 오류로 스타일링이 매 판 실패했는데
      // 이 catch가 그걸 덮어서, 착장 없이 돈 판들을 정상 판으로 착각하고 밸런싱을 맞췄다.
      console.error(`  ⚠ 스타일링 실패 (${c.id}/${profile}): ${e.message} — 태그 원문으로 대체한다`);
      outfitDesc = raw.styling;
    }
  }

  const engine = new Engine(llm, {
    couple: c,
    agent,
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
            ? '지금 상대가 방금 한 말을 한 번 더 짚어주고, 왜 그렇게 생각하는지 되물어라. 네 얘기는 하지 마라.'
            : `지금 흐름 그대로 이어가면서 ${c.target.visiblePrefs[turn % c.target.visiblePrefs.length]} 이야기를 꺼내고, 상대에게 그 얘기를 더 해달라고 물어봐라.`;
        // LLM이 드물게 반복 붕괴한 문자열을 뱉는다. 그걸 무전으로 주입하면 판이 통째로 망가진다.
        if (order && !/(.{2,8})\1{4,}/.test(order) && order.length > 10) engine.submitRadio(order);
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

  // 온전한 판인지 검증한다. LLM이 죽으면 판정이 전부 중립(empty)으로 흘러 그럴듯한 숫자가 나오므로
  // 이걸 걸러내지 않으면 밸런싱 데이터가 조용히 오염된다.
  const expected = res.difficulty.textTurns + res.difficulty.talkTurns + 1;
  const neutral = res.state.history.filter(h => h.tier === 'flat' && h.rawMood === 0 && h.rawLove === 0).length;
  const degenerate = llm.usage.calls < 10
    || (!res.aborted && res.state.history.length < expected)
    || neutral > expected / 2;
  if (degenerate) {
    return {
      coupleId, profile, difficulty: c.difficulty,
      error: `불완전한 판 (호출 ${llm.usage.calls}회, 판정 ${res.state.history.length}/${expected}, 중립 ${neutral})`,
      usage: { ...llm.usage },
    };
  }

  return {
    coupleId, profile, difficulty: c.difficulty,
    accepted: res.verdict.accepted, grade: res.verdict.grade,
    love: res.verdict.love, mood: res.verdict.mood, threshold: res.difficulty.threshold,
    moodFloor: res.difficulty.moodFloor, aborted: res.aborted,
    revealedCount: res.state.revealed.length, secretTotal: c.target.hiddenPrefs.length,
    surfaced: res.debrief.surfaced.length, radioUsed: res.state.radioUsed,
    vibe: res.state.vibe, revealed: res.state.revealed,
    tiers: res.state.history.map(h => h.tier),
    // 오프라인 리플레이(tests/sim.mjs)용 판정 스트림. 이걸로 API 없이 상수를 다시 맞춘다.
    judgments: res.state.history.map(h => ({
      tier: h.tier, moodDelta: h.rawMood, loveDelta: h.rawLove,
      revealed: h.revealed || '', firstImpression: !!h.firstImpression,
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
          `발견 ${r.revealedCount}  비밀 ${r.surfaced}/${r.secretTotal}  ${r.seconds}s  $${r.usage.cost.toFixed(3)}  🧊${r.usage.cacheRead}`);
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
    (grid[k] ||= { n: 0, win: 0, love: 0, mood: 0, found: 0, secret: 0 });
    grid[k].n++; grid[k].win += r.accepted ? 1 : 0;
    grid[k].love += r.love; grid[k].mood += r.mood;
    grid[k].found += r.revealedCount; grid[k].secret += r.surfaced;
  }
  console.log(pad('프로필|난이도', 18) + pad('판수', 6) + pad('성사', 8) + pad('평균호감', 10) + pad('평균분위기', 12) + pad('발견', 6) + '비밀');
  for (const [k, g] of Object.entries(grid).sort()) {
    console.log(pad(k, 18) + pad(g.n, 6) + pad(`${g.win}/${g.n}`, 8) +
      pad((g.love / g.n).toFixed(1), 10) + pad((g.mood / g.n).toFixed(1), 12) +
      pad((g.found / g.n).toFixed(1), 6) + (g.secret / g.n).toFixed(1));
  }

  const allTiers = ok.flatMap(r => r.tiers);
  const tierCount = {};
  for (const t of allTiers) tierCount[t] = (tierCount[t] || 0) + 1;
  const TORDER = ['breakthrough', 'warm', 'nudge', 'flat', 'chill', 'disaster'];
  console.log('\n심판 등급 분포: ' + TORDER.map(t => `${t} ${tierCount[t] || 0}(${((tierCount[t] || 0) / allTiers.length * 100).toFixed(0)}%)`).join(' · '));

  // 프로필별 tier 분포 — 잘한 플레이와 못한 플레이가 실제로 갈리는지 본다
  for (const p of PROFILES) {
    const t = ok.filter(r => r.profile === p).flatMap(r => r.tiers);
    if (!t.length) continue;
    const cnt = {}; for (const x of t) cnt[x] = (cnt[x] || 0) + 1;
    console.log(`  ${pad(p, 5)} ` + TORDER.map(x => `${x.slice(0, 2)}${cnt[x] || 0}`).join(' ') + `  (n=${t.length})`);
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
