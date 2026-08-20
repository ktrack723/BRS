// sim.mjs — 오프라인 밸런서. API 호출 0회.
//
// tests/live.mjs가 남긴 실제 합 판정 스트림을 그대로 다시 흘리면서
// 난이도 상수(threshold/gainScale)만 바꿔 성사율이 어떻게 움직이는지 본다.
//
//   node tests/sim.mjs /tmp/live.json          현재 상수로 재현 + 프로필별 표
//   node tests/sim.mjs /tmp/live.json --grid   성공선·배율 후보를 훑는다
import fs from 'node:fs';
import { DIFFICULTIES, diffOf, initialState, applyBout, verdict } from '../js/scoring.js';

const argv = process.argv.slice(2);
const file = argv.find(a => !a.startsWith('--'));
if (!file) { console.error('사용법: node tests/sim.mjs <live.json> [--grid]'); process.exit(1); }
const games = JSON.parse(fs.readFileSync(file, 'utf8')).filter(g => !g.error);

function replay(g, over = {}) {
  const d = { ...diffOf(g.difficulty), ...over };
  let s = initialState(d);
  for (const j of (g.judgments || [])) {
    s = applyBout(s, d, {
      tier: j.tier, loveDelta: j.loveDelta, vibe: 'v', revealed: j.revealed || '',
      leverage: j.leverage || 'none', walkout: !!j.walkout, casualty: 'none', casualtyNote: '',
    }, { firstImpression: !!j.firstImpression, exchanges: j.exchanges || 0 });
  }
  return { love: Math.round(s.love), v: verdict(s, d), d };
}

console.log('조합            프로필  난이도  호감/성공선  결과');
for (const g of [...games].sort((a, b) => a.coupleId.localeCompare(b.coupleId))) {
  const r = replay(g);
  console.log(g.coupleId.padEnd(15), g.profile.padEnd(6), g.difficulty.padEnd(3),
    `${String(r.love).padStart(4)}/${r.d.threshold}`, r.v.accepted ? ' 성사' : ' 결렬');
}

const profiles = [...new Set(games.map(g => g.profile))];
console.log('\n프로필별 (현재 상수)');
for (const p of profiles) {
  const mine = games.filter(g => g.profile === p).map(g => replay(g));
  const mean = (mine.reduce((s, r) => s + r.love, 0) / (mine.length || 1)).toFixed(1);
  console.log(` ${p.padEnd(5)} 평균 ${mean} · 성사 ${mine.filter(r => r.v.accepted).length}/${mine.length}`);
}

if (argv.includes('--grid')) {
  console.log('\n난이도별 성공선·배율 후보');
  for (const key of Object.keys(DIFFICULTIES)) {
    const mine = games.filter(g => g.difficulty === key);
    if (!mine.length) continue;
    const base = DIFFICULTIES[key];
    console.log(`\n${key} (현재 threshold ${base.threshold} · gain ${base.gainScale})`);
    for (const gs of [base.gainScale * 0.8, base.gainScale, base.gainScale * 1.2]) {
      const loves = p => mine.filter(g => g.profile === p)
        .map(g => replay(g, { gainScale: gs }).love).sort((a, b) => a - b);
      const a = loves('ace'), n = loves('none');
      console.log(`  gain ${gs.toFixed(1)}  ace[${a.join(',')}]  none[${n.join(',')}]`);
    }
  }
}
