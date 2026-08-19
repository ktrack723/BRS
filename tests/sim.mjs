// sim.mjs — 오프라인 밸런서. API 호출 0회.
//
// 두 가지 모드가 있다.
//
//   1) 리플레이 — tests/live.mjs가 남긴 실제 판정 스트림(tier/moodDelta)을 그대로 다시 흘리면서
//      난이도 상수와 TUNING만 바꿔 성사율이 어떻게 움직이는지 본다. 실측 기반이라 제일 믿을 만하다.
//
//        node tests/sim.mjs /tmp/live-results.json          현재 상수로 재현 + 프로필별 성사율
//        node tests/sim.mjs /tmp/live-results.json --grid   성공선 후보를 훑어 추천값을 뽑는다
//        node tests/sim.mjs /tmp/live-results.json --tune   밴드/감쇠 상수까지 탐색
//
//   2) 몬테카를로 — 라이브 로그가 없을 때 쓴다. 프로필별 등급 분포를 가정하고 표본을 돌린다.
//      실측이 아니라 추정이다. 판정기를 갈아엎어서 기존 로그를 못 쓰게 됐을 때의 임시방편이고,
//      지금 scoring.js의 성공선(46/52/56)이 이 모드에서 나왔다.
//
//        node tests/sim.mjs --montecarlo
//        node tests/sim.mjs --montecarlo --n=5000

import fs from 'node:fs';
import {
  DIFFICULTIES, TIER_BANDS, TUNING, diffOf,
  initialState, applyTurn, failureReason, verdict,
} from '../js/scoring.js';
import { COUPLE_BY_ID } from '../js/couples.js';

const argv = process.argv.slice(2);
const flag = n => argv.includes('--' + n);
const opt = (n, d) => {
  const hit = argv.find(a => a.startsWith(`--${n}=`));
  return hit ? hit.split('=')[1] : d;
};
const pad = (s, n) => String(s).padEnd(n);
const TORDER = ['breakthrough', 'warm', 'nudge', 'flat', 'chill', 'disaster'];

// ══════════ 몬테카를로 ══════════════════════════════════════════
// 프로필별 등급 분포. **가정치가 아니라 라이브 실측이다** —
// Sonnet으로 커플 3종(쉬움/보통/헬) × 프로필 4종 = 12판, 프로필당 판정 30건을 돌려 얻었다.
//
// 인물 하자 시스템을 넣은 뒤로 프로필이 실제로 갈린다. 갈리는 지점은 chill 꼬리다:
//   ace 0% · good 3.3% · lazy 6.7% · none 16.7%
// 준비 없는 의뢰인은 상대의 지뢰를 모르고, 공기도 못 읽고, 상대에게 관심도 없어서
// 자기 관심사로 대화를 끌고 가다 상대를 식힌다. breakthrough 쪽은 여전히 잘 안 갈린다.
const PROFILE_DIST = {
  ace:  { breakthrough: .133, warm: .433, nudge: .433, flat: .000, chill: .000, disaster: 0 },
  good: { breakthrough: .067, warm: .433, nudge: .467, flat: .000, chill: .033, disaster: 0 },
  lazy: { breakthrough: .133, warm: .367, nudge: .367, flat: .067, chill: .067, disaster: 0 },
  none: { breakthrough: .067, warm: .300, nudge: .467, flat: .000, chill: .167, disaster: 0 },
};
// 심판이 실제로 뱉은 moodDelta 평균을 등급별로 정리한 값
const TIER_MOOD = { breakthrough: 6, warm: 3, nudge: 1, flat: 0, chill: -2, disaster: -7 };

// 재현 가능해야 하므로 Math.random을 쓰지 않는다
function makeRng(seed) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

function monteCarlo(n = 2500, seed = 20770819) {
  console.log(`\n════════ 몬테카를로 (판당 ${n}회 표본) ════════`);
  console.log('등급 분포는 라이브 12판 실측값이다. 판정 스트림 자체를 다시 흘리려면 리플레이 모드를 쓸 것.\n');
  console.log(pad('난이도', 8) + pad('성공선', 8) + pad('프로필', 8) + pad('성사율', 9) +
    pad('호감 p10/중앙/p90', 22) + '파탄율');
  for (const dn of Object.keys(DIFFICULTIES)) {
    const d = diffOf(dn);
    for (const p of Object.keys(PROFILE_DIST)) {
      const rnd = makeRng(seed);
      const pick = () => {
        let r = rnd();
        for (const [k, w] of Object.entries(PROFILE_DIST[p])) if ((r -= w) <= 0) return k;
        return 'flat';
      };
      const runs = [];
      for (let i = 0; i < n; i++) {
        let s = initialState(d);
        let aborted = false;
        for (let turn = 0; turn < d.textTurns + d.talkTurns + 1; turn++) {
          const tier = pick();
          const [lo, hi] = TIER_BANDS[tier];
          const judge = {
            tier,
            loveDelta: lo + Math.round(rnd() * (hi - lo)),
            moodDelta: Math.max(-10, Math.min(10, TIER_MOOD[tier] + Math.round((rnd() - 0.5) * 4))),
          };
          s = applyTurn(s, d, judge, { firstImpression: turn === d.textTurns });
          if (failureReason(s)) { aborted = true; break; }
        }
        runs.push({ ...verdict(s, d, { aborted }), aborted });
      }
      const loves = runs.map(r => r.love).sort((a, b) => a - b);
      const q = f => loves[Math.floor(n * f)];
      console.log(pad(dn, 8) + pad(d.threshold, 8) + pad(p, 8) +
        pad(`${(runs.filter(r => r.accepted).length / n * 100).toFixed(0)}%`, 9) +
        pad(`${q(.1)} / ${q(.5)} / ${q(.9)}`, 22) +
        `${(runs.filter(r => r.aborted).length / n * 100).toFixed(0)}%`);
    }
    console.log('');
  }
  console.log('기준선: 난이도가 오를수록 성사율이 떨어지고, 같은 난이도 안에서 none이 ace보다 확실히 낮아야 한다.');
  console.log('(ace↔none 격차가 20%p 밑으로 내려가면 준비가 의미를 잃은 것이다 — scoring.js 밸런싱 주석 참조)');
}

if (flag('montecarlo')) {
  monteCarlo(Number(opt('n', 2500)), Number(opt('seed', 20770819)));
  process.exit(0);
}

// ══════════ 리플레이 ════════════════════════════════════════════
const file = argv.find(a => !a.startsWith('--'));
if (!file || !fs.existsSync(file)) {
  console.error('사용법: node tests/sim.mjs <live-results.json> [--grid] [--tune]');
  console.error('   또는: node tests/sim.mjs --montecarlo   (라이브 로그 없이 추정)');
  process.exit(1);
}
const GRID = flag('grid');
const runs = JSON.parse(fs.readFileSync(file)).filter(r => r && !r.error && r.judgments);
if (!runs.length) { console.error('judgments가 기록된 판이 없다. live.mjs를 다시 돌려라.'); process.exit(1); }

// 기록된 판정 스트림을 주어진 난이도 상수로 다시 흘린다.
// 목록 대조 계층이 사라져서 리플레이도 단순해졌다 — 등급과 두 증감값이 전부다.
function replay(run, overrides = {}) {
  const d = { ...diffOf(run.difficulty), ...overrides };
  let s = initialState(d);
  let aborted = false;
  for (const j of run.judgments) {
    s = applyTurn(s, d, {
      tier: j.tier, moodDelta: j.moodDelta, loveDelta: j.loveDelta,
      revealed: j.revealed || '', vibe: '',
    }, { firstImpression: j.firstImpression });
    if (failureReason(s)) { aborted = true; break; }
  }
  return { ...verdict(s, d, { aborted }), state: s, d };
}

const PROFILES = [...new Set(runs.map(r => r.profile))];
const DIFFS = [...new Set(runs.map(r => r.difficulty))];

function table(overridesFor) {
  const rows = [];
  for (const diff of Object.keys(DIFFICULTIES).filter(d => DIFFS.includes(d))) {
    for (const p of PROFILES) {
      const sub = runs.filter(r => r.difficulty === diff && r.profile === p);
      if (!sub.length) continue;
      const res = sub.map(r => replay(r, overridesFor ? overridesFor(diff) : {}));
      rows.push({
        diff, profile: p, n: sub.length,
        win: res.filter(r => r.accepted).length,
        love: res.reduce((a, r) => a + r.love, 0) / res.length,
        mood: res.reduce((a, r) => a + r.mood, 0) / res.length,
        found: sub.reduce((a, r) => a + (r.revealedCount || 0), 0) / sub.length,
      });
    }
  }
  return rows;
}

function printTable(rows, title) {
  console.log(`\n──── ${title} ────`);
  console.log(pad('난이도', 8) + pad('프로필', 8) + pad('성사', 8) + pad('평균호감', 10) + pad('평균분위기', 12) + '발견');
  for (const r of rows) {
    console.log(pad(r.diff, 8) + pad(r.profile, 8) + pad(`${r.win}/${r.n}`, 8) +
      pad(r.love.toFixed(1), 10) + pad(r.mood.toFixed(1), 12) + r.found.toFixed(1));
  }
}

// 재현 검증: 리플레이가 라이브 결과와 일치하는가
let match = 0;
for (const r of runs) if (replay(r).accepted === r.accepted) match++;
console.log(`🔁 리플레이 재현율 ${match}/${runs.length} (현재 상수 기준)`);
printTable(table(null), '현재 상수');

// tier 분포
const tiers = runs.flatMap(r => r.judgments.map(j => j.tier));
const count = a => { const c = {}; for (const x of a) c[x] = (c[x] || 0) + 1; return c; };
const fmt = c => TORDER.map(t => `${t} ${c[t] || 0}(${((c[t] || 0) / tiers.length * 100).toFixed(0)}%)`).join(' · ');
console.log(`\n심판 등급 분포 : ${fmt(count(tiers))}`);
for (const p of PROFILES) {
  const t = runs.filter(r => r.profile === p).flatMap(r => r.judgments.map(j => j.tier));
  const c = count(t);
  console.log(`  ${pad(p, 5)} ` + TORDER.map(x => `${x.slice(0, 2)}${c[x] || 0}`).join(' ') + ` (n=${t.length})`);
}

if (GRID) {
  console.log('\n════════ 성공선 후보 탐색 ════════');
  console.log('목표: ace/good은 넘고 lazy/none은 못 넘는 성공선을 찾는다.\n');
  for (const diff of Object.keys(DIFFICULTIES).filter(d => DIFFS.includes(d))) {
    const sub = runs.filter(r => r.difficulty === diff);
    if (!sub.length) continue;
    const scored = sub.map(r => ({ profile: r.profile, ...replay(r, { threshold: 0 }) }));
    const skilled = scored.filter(s => s.profile === 'ace' || s.profile === 'good').map(s => s.love).sort((a, b) => a - b);
    const sloppy = scored.filter(s => s.profile === 'lazy' || s.profile === 'none').map(s => s.love).sort((a, b) => b - a);
    const lo = skilled[0] ?? 0, hi = sloppy[0] ?? 0;
    console.log(`[${diff}] 잘한 플레이 호감 ${skilled.join(', ')} · 대충한 플레이 호감 ${sloppy.join(', ')}`);
    if (lo > hi) console.log(`  → 분리 성공. 성공선 추천 ${Math.round((lo + hi) / 2)} (현재 ${diffOf(diff).threshold})`);
    else console.log(`  → 겹친다. 성공선만으로는 못 가른다 (잘한 최저 ${lo} ≤ 대충한 최고 ${hi})`);
    for (let t = 20; t <= 90; t += 5) {
      const rows = sub.map(r => ({ profile: r.profile, ...replay(r, { threshold: t }) }));
      const w = p => rows.filter(r => r.profile === p && r.accepted).length + '/' + rows.filter(r => r.profile === p).length;
      console.log(`   성공선 ${pad(t, 4)} ace ${pad(w('ace'), 6)} good ${pad(w('good'), 6)} lazy ${pad(w('lazy'), 6)} none ${w('none')}`);
    }
    console.log('');
  }
}

// ── 상수 탐색 ────────────────────────────────────────────
// TIER_BANDS / TUNING은 모듈 상수 객체라 속성을 갈아끼우면 리플레이에 그대로 반영된다.
if (flag('tune')) {
  const snapshot = { bands: structuredClone(TIER_BANDS), tuning: { ...TUNING } };
  const restore = () => {
    for (const [k, v] of Object.entries(snapshot.bands)) TIER_BANDS[k] = [...v];
    Object.assign(TUNING, snapshot.tuning);
  };

  const SKILLED = new Set(['ace', 'good']);
  const byDiff = {};
  for (const r of runs) (byDiff[r.difficulty] ||= []).push(r);

  // 분리도: 잘한 플레이의 최저 호감 - 대충한 플레이의 최고 호감. 클수록 성공선을 놓을 자리가 넓다.
  function separation(diff, cfg) {
    restore();
    TIER_BANDS.nudge = cfg.nudge;
    TIER_BANDS.flat = cfg.flat;
    Object.assign(TUNING, cfg.tuning || {});
    const rows = byDiff[diff].map(r => ({
      profile: r.profile,
      love: replay(r, { threshold: 0, loveDecay: cfg.decay, gainScale: cfg.gain }).love,
    }));
    const sk = rows.filter(r => SKILLED.has(r.profile)).map(r => r.love);
    const sl = rows.filter(r => !SKILLED.has(r.profile)).map(r => r.love);
    if (!sk.length || !sl.length) return null;
    const lo = Math.min(...sk), hi = Math.max(...sl);
    return { gap: lo - hi, lo, hi, mid: Math.round((lo + hi) / 2), sk: sk.sort((a, b) => a - b), sl: sl.sort((a, b) => b - a) };
  }

  const NUDGE_CANDS = [[1, 3], [1, 2], [0, 2], [2, 4]];
  const FLAT_CANDS = [[-1, 1], [-1, 0], [-2, 0]];
  const DECAYS = { '쉬움': [0, 0.4, 0.8], '보통': [0.3, 0.7, 1.2], '헬': [0.6, 1.1, 1.6] };
  const GAINS = { '쉬움': [1.4, 1.7, 2.0], '보통': [1.7, 2.0, 2.3], '헬': [1.8, 2.1, 2.4] };

  console.log('\n════════ 상수 탐색 (분리도 = 잘한 최저 − 대충한 최고) ════════');
  const best = {};
  for (const diff of Object.keys(byDiff)) {
    const cands = [];
    for (const nudge of NUDGE_CANDS) for (const flat of FLAT_CANDS)
      for (const decay of DECAYS[diff] || [1]) for (const gain of GAINS[diff] || [2]) {
        const sep = separation(diff, { nudge, flat, decay, gain });
        if (sep) cands.push({ nudge, flat, decay, gain, ...sep });
      }
    cands.sort((a, b) => b.gap - a.gap);
    console.log(`\n[${diff}] 상위 5개 (n=${byDiff[diff].length}판)`);
    for (const c of cands.slice(0, 5)) {
      console.log(`  nudge[${c.nudge}] flat[${c.flat}] decay ${c.decay} gain ${c.gain}  →  분리도 ${String(c.gap).padStart(4)}` +
        `  성공선 후보 ${String(c.mid).padStart(3)}  잘한 ${c.sk.join(',')} | 대충한 ${c.sl.join(',')}`);
    }
    best[diff] = cands[0];
  }
  restore();
  console.log('\n권장값:');
  for (const [d, c] of Object.entries(best)) {
    if (c) console.log(`  ${d}: threshold ${c.mid}, loveDecay ${c.decay}, gainScale ${c.gain}  (공통 nudge[${c.nudge}] flat[${c.flat}])`);
  }
}
