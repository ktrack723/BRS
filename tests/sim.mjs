// sim.mjs — 오프라인 리플레이 밸런서.
// tests/live.mjs가 남긴 실제 판정 스트림(tier/moodDelta/취향적중/지뢰)을 그대로 다시 흘려보내면서
// 난이도 상수와 TUNING만 바꿔가며 성사율이 어떻게 움직이는지 본다. API 호출 0회.
//
//   node tests/sim.mjs /tmp/live-results.json            현재 상수로 재현 + 프로필별 성사율
//   node tests/sim.mjs /tmp/live-results.json --grid     성공선 후보를 훑어 추천값을 뽑는다

import fs from 'node:fs';
import { DIFFICULTIES, TIER_BANDS, TUNING, diffOf, initialState, applyTurn, failureReason, verdict } from '../js/scoring.js';
import { COUPLE_BY_ID } from '../js/couples.js';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('사용법: node tests/sim.mjs <live-results.json> [--grid]');
  process.exit(1);
}
const GRID = process.argv.includes('--grid');
const runs = JSON.parse(fs.readFileSync(file)).filter(r => r && !r.error && r.judgments);
if (!runs.length) { console.error('judgments가 기록된 판이 없다. live.mjs를 다시 돌려라.'); process.exit(1); }

// 기록된 판정 스트림을 주어진 난이도 상수로 다시 흘린다
function replay(run, overrides = {}) {
  const couple = COUPLE_BY_ID[run.coupleId];
  const d = { ...diffOf(run.difficulty), ...overrides };
  let s = initialState(d);
  let aborted = false;
  for (const j of run.judgments) {
    // tier는 이미 게이트를 통과한 값이므로 그대로 재사용한다.
    // 게이트 재적용을 피하려고 적중 필드를 tier에 맞춰 복원해 넣는다.
    const judge = {
      tier: j.tier, moodDelta: j.moodDelta, loveDelta: undefined,
      hiddenPrefHit: j.hit,
      visiblePrefHit: j.tier === 'hit' && !j.hit ? couple.target.visiblePrefs[0] : '',
      redLineHit: j.red,
    };
    const opts = {
      knownHidden: couple.target.hiddenPrefs,
      // 알려진 취향 재탕 강등을 리플레이에서 유발하지 않도록 매번 새 목록을 준다
      knownVisible: couple.target.visiblePrefs,
      firstImpression: j.firstImpression,
    };
    s = applyTurn({ ...s, seenVisible: [] }, d, judge, opts);
    if (failureReason(s)) { aborted = true; break; }
  }
  return { ...verdict(s, d, { aborted }), state: s, d };
}

const PROFILES = [...new Set(runs.map(r => r.profile))];
const DIFFS = [...new Set(runs.map(r => r.difficulty))];
const pad = (s, n) => String(s).padEnd(n);

function table(overridesFor) {
  const rows = [];
  for (const diff of ['쉬움', '보통', '헬'].filter(d => DIFFS.includes(d))) {
    for (const p of PROFILES) {
      const sub = runs.filter(r => r.difficulty === diff && r.profile === p);
      if (!sub.length) continue;
      const res = sub.map(r => replay(r, overridesFor ? overridesFor(diff) : {}));
      rows.push({
        diff, profile: p, n: sub.length,
        win: res.filter(r => r.accepted).length,
        love: res.reduce((a, r) => a + r.love, 0) / res.length,
        mood: res.reduce((a, r) => a + r.mood, 0) / res.length,
      });
    }
  }
  return rows;
}

function printTable(rows, title) {
  console.log(`\n──── ${title} ────`);
  console.log(pad('난이도', 8) + pad('프로필', 8) + pad('성사', 8) + pad('평균호감', 10) + '평균분위기');
  for (const r of rows) {
    console.log(pad(r.diff, 8) + pad(r.profile, 8) + pad(`${r.win}/${r.n}`, 8) +
      pad(r.love.toFixed(1), 10) + r.mood.toFixed(1));
  }
}

// 재현 검증: 리플레이가 라이브 결과와 일치하는가
let match = 0;
for (const r of runs) {
  const v = replay(r);
  if (v.accepted === r.accepted) match++;
}
console.log(`🔁 리플레이 재현율 ${match}/${runs.length} (현재 상수 기준)`);
printTable(table(null), '현재 상수');

// tier 분포
const tiers = runs.flatMap(r => r.judgments.map(j => j.tier));
const jTiers = runs.flatMap(r => r.judgments.map(j => j.judgeTier));
const count = a => { const c = {}; for (const x of a) c[x] = (c[x] || 0) + 1; return c; };
const TORDER = ['critical', 'hit', 'ok', 'empty', 'backfire', 'redline'];
const fmt = c => TORDER.map(t => `${t} ${c[t] || 0}(${((c[t] || 0) / tiers.length * 100).toFixed(0)}%)`).join(' · ');
console.log(`\n심판 원등급 : ${fmt(count(jTiers))}`);
console.log(`게이트 통과 : ${fmt(count(tiers))}`);
for (const p of PROFILES) {
  const t = runs.filter(r => r.profile === p).flatMap(r => r.judgments.map(j => j.tier));
  const c = count(t);
  console.log(`  ${pad(p, 5)} ` + TORDER.map(x => `${x.slice(0, 1).toUpperCase()}${c[x] || 0}`).join(' ') + ` (n=${t.length})`);
}

if (GRID) {
  console.log('\n════════ 성공선 후보 탐색 ════════');
  console.log('목표: ace/good은 넘고 lazy/none은 못 넘는 성공선을 찾는다.\n');
  for (const diff of ['쉬움', '보통', '헬'].filter(d => DIFFS.includes(d))) {
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
if (process.argv.includes('--tune')) {
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
    TIER_BANDS.ok = cfg.ok;
    TIER_BANDS.empty = cfg.empty;
    Object.assign(TUNING, cfg.tuning || {});
    const rows = byDiff[diff].map(r => ({
      profile: r.profile,
      love: replay(r, { threshold: 0, loveDecay: cfg.decay }).love,
    }));
    const sk = rows.filter(r => SKILLED.has(r.profile)).map(r => r.love);
    const sl = rows.filter(r => !SKILLED.has(r.profile)).map(r => r.love);
    if (!sk.length || !sl.length) return null;
    const lo = Math.min(...sk), hi = Math.max(...sl);
    return { gap: lo - hi, lo, hi, mid: Math.round((lo + hi) / 2), sk: sk.sort((a, b) => a - b), sl: sl.sort((a, b) => b - a) };
  }

  const OK_CANDS = [[2, 4], [1, 3], [1, 2], [0, 2]];
  const EMPTY_CANDS = [[-1, 1], [-1, 0], [-2, 0]];
  const DECAYS = { '쉬움': [0, 0.8, 1.6, 2.4], '보통': [0.5, 1.2, 2.0, 2.8], '헬': [1.0, 1.8, 2.6, 3.4] };

  console.log('\n════════ 상수 탐색 (분리도 = 잘한 최저 − 대충한 최고) ════════');
  const best = {};
  for (const diff of Object.keys(byDiff)) {
    const cands = [];
    for (const ok of OK_CANDS) for (const empty of EMPTY_CANDS) for (const decay of DECAYS[diff] || [1]) {
      const sep = separation(diff, { ok, empty, decay });
      if (sep) cands.push({ ok, empty, decay, ...sep });
    }
    cands.sort((a, b) => b.gap - a.gap);
    console.log(`\n[${diff}] 상위 5개 (n=${byDiff[diff].length}판)`);
    for (const c of cands.slice(0, 5)) {
      console.log(`  ok[${c.ok}] empty[${c.empty}] decay ${c.decay}  →  분리도 ${String(c.gap).padStart(4)}` +
        `  성공선 후보 ${String(c.mid).padStart(3)}  잘한 ${c.sk.join(',')} | 대충한 ${c.sl.join(',')}`);
    }
    best[diff] = cands[0];
  }
  restore();
  console.log('\n권장값:');
  for (const [d, c] of Object.entries(best)) {
    if (c) console.log(`  ${d}: threshold ${c.mid}, loveDecay ${c.decay}  (공통 ok[${c.ok}] empty[${c.empty}])`);
  }
}
