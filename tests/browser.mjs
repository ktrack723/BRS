// browser.mjs — 실제 브라우저에서 실제 API로 한 판 끝까지 돌리는 E2E.
// three.js 렌더링·썸네일·스타일링 반영·게이지 갱신·결과 화면까지 눈으로 확인한다.
//
//   ANTHROPIC_API_KEY=sk-... node tests/browser.mjs [--couple=os-war] [--shots=/tmp/shots] [--headed]

import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2)
  .filter(a => a.startsWith('--'))
  .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || 'true']; }));

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY 없음'); process.exit(1); }
const ROOT = path.resolve(import.meta.dirname, '..');
const SHOTS = args.shots || '/tmp/claude-0/shots';
const COUPLE = args.couple || 'os-war';
const PORT = 8199;
fs.mkdirSync(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('nope');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const fail = [];
function check(name, cond, detail = '') {
  console.log(`${cond ? '  ✅' : '  ❌'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!cond) fail.push(name);
}

await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({
  headless: args.headed !== 'true',
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });

const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });

try {
  console.log('\n🌐 부팅');
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  await page.fill('#key-input', KEY);
  await page.click('#btn-boot');
  await page.waitForSelector('#screen-intro:not(.hidden)', { timeout: 90000 });
  check('키 인증 후 신입 교육 진입', true);
  await page.screenshot({ path: `${SHOTS}/1-intro.png` });

  console.log('\n📠 브리핑');
  await page.click('#btn-intro-skip');
  await page.waitForSelector('#btn-to-roster:not(.hidden)', { timeout: 120000 });
  const briefing = await page.textContent('#briefing-text');
  check('국장 브리핑이 LLM에서 실제로 왔다', briefing.length > 60, `${briefing.length}자`);
  await page.screenshot({ path: `${SHOTS}/2-briefing.png` });

  console.log('\n📚 의뢰 대장');
  await page.click('#btn-to-roster');
  await page.waitForSelector('.couple-card', { timeout: 15000 });
  const cardCount = await page.locator('.couple-card').count();
  check('20쌍이 모두 렌더링됐다', cardCount === 20, `${cardCount}장`);

  // 썸네일이 진짜 three.js 렌더 결과인지 (빈 PNG가 아닌지) 검사
  const thumbInfo = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('.cc-pair img')];
    const sizes = imgs.map(i => i.src.length);
    // 첫 카드 이미지를 2D 캔버스에 그려서 투명하지 않은 픽셀이 있는지 본다
    const im = imgs[0];
    const cv = document.createElement('canvas');
    cv.width = 160; cv.height = 200;
    const ctx = cv.getContext('2d');
    await im.decode();
    ctx.drawImage(im, 0, 0, 160, 200);
    const data = ctx.getImageData(0, 0, 160, 200).data;
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 20) opaque++;
    return { count: imgs.length, minLen: Math.min(...sizes), uniq: new Set(sizes).size, opaque };
  });
  check('아바타 썸네일 40장 생성', thumbInfo.count === 40, `${thumbInfo.count}장`);
  check('썸네일이 빈 이미지가 아니다', thumbInfo.opaque > 500, `불투명 픽셀 ${thumbInfo.opaque}`);
  check('인물마다 썸네일이 다르다', thumbInfo.uniq > 30, `고유 ${thumbInfo.uniq}/${thumbInfo.count}`);
  check('WebGL 컨텍스트 고갈 없음 (오프스크린 1개 재사용)', !pageErrors.some(e => /context/i.test(e)));
  await page.screenshot({ path: `${SHOTS}/3-roster.png`, fullPage: true });

  console.log('\n👔 컨설팅 + 스타일링');
  await page.evaluate(id => {
    const cards = [...document.querySelectorAll('.couple-card')];
    const idx = window.__game.COUPLES.filter(c => true).findIndex(c => c.id === id);
    void idx;
    // 카드 순서는 난이도 정렬이므로 이름으로 찾는다
    const target = window.__game.COUPLES.find(c => c.id === id);
    const card = cards.find(el => el.textContent.includes(target.client.name));
    card.querySelector('.cc-take').click();
  }, COUPLE);
  await page.waitForSelector('#screen-consult:not(.hidden)', { timeout: 10000 });

  const specBefore = await page.evaluate(() => JSON.parse(JSON.stringify(window.__game.state.clientSpec)));
  await page.fill('#styling-input', '형광 주황색으로 염색, 새빨간 턱시도, 카우보이 부츠, 선글라스');
  await page.click('#btn-styling');
  await page.waitForFunction(() => (document.querySelector('#styling-result')?.textContent || '').length > 5, null, { timeout: 120000 });
  const specAfter = await page.evaluate(() => JSON.parse(JSON.stringify(window.__game.state.clientSpec)));
  const outfit = await page.evaluate(() => window.__game.state.prep.outfitDesc);

  const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [hr, hg, hb] = hex2rgb(specAfter.hair);
  check('스타일링이 3D 스펙을 실제로 바꿨다', JSON.stringify(specBefore) !== JSON.stringify(specAfter));
  check('"주황색으로 염색" → 머리 색이 주황 계열이 됐다',
    hr > 180 && hg > 60 && hg < 190 && hb < 110, `${specAfter.hair} (before ${specBefore.hair})`);
  check('"빨간 턱시도" → 상의가 빨강 계열이 됐다',
    hex2rgb(specAfter.top)[0] > 150 && hex2rgb(specAfter.top)[1] < 110, specAfter.top);
  check('종족은 스타일링으로 바뀌지 않는다', specAfter.species === specBefore.species, specAfter.species);
  check('착장 묘사가 생성됐다 (대면 판정 입력값)', outfit.length > 10, outfit.slice(0, 60));
  await page.screenshot({ path: `${SHOTS}/4-consult.png`, fullPage: true });

  console.log('\n🚨 작전 개시 (실제 대화 진행)');
  await page.fill('#coaching-input',
    '상대가 말하면 절대 끊지 말고 끝까지 듣고 되물어라. "I use Arch btw"는 무슨 일이 있어도 입 밖에 내지 마라. ' +
    '상대가 말끝을 흐리며 뭔가 감추면 반드시 그걸 물고 늘어져서 더 말해달라고 해라. "리눅스 깔아줄게"는 금지다.');
  await page.fill('#speech-input',
    '컨퍼런스에서 장내가 얼어붙었을 때, 너 혼자 심장이 얼어붙었다며. 그 온도차를 아는 사람은 너뿐이야. ' +
    'dotfiles를 보여주고 싶다는 게 무슨 뜻인지도 너만 알지. 오늘은 그걸 말로 해.');
  await page.click('#btn-start-op');
  await page.waitForSelector('#screen-chat:not(.hidden)', { timeout: 15000 });

  // 첫 발언이 나올 때까지
  await page.waitForFunction(() => document.querySelectorAll('#chat-window .bubble').length >= 2, null, { timeout: 180000 });
  const startLove = await page.evaluate(() => +document.querySelector('#meter-love-num').textContent);

  // 무전 개입 한 번 실제로 눌러본다
  await page.waitForFunction(() => !document.querySelector('#btn-intervene').disabled, null, { timeout: 60000 });
  await page.click('#btn-intervene');
  await page.waitForSelector('#modal-radio:not(.hidden)');
  await page.fill('#radio-input', '지금 상대가 뭔가 말하다 말았다. 그걸 정확히 짚어서 "방금 하려던 말이 뭐냐"고 물어봐라.');
  await page.click('#btn-radio-send');
  const radioBubble = await page.locator('.bubble.radio').count();
  check('무전 개입이 대화에 주입됐다', radioBubble >= 1);
  await page.screenshot({ path: `${SHOTS}/5-texting.png`, fullPage: true });

  console.log('   ...대면 페이즈 대기');
  await page.waitForFunction(() => document.body.classList.contains('phase-talk'), null, { timeout: 400000 });
  const judged = await page.locator('.judge-line').count();
  check('심판 판정이 UI에 흐른다', judged >= 1, `${judged}줄`);
  await page.screenshot({ path: `${SHOTS}/6-talking.png`, fullPage: true });

  console.log('   ...결과 대기');
  await page.waitForSelector('#screen-result:not(.hidden)', { timeout: 600000 });
  await page.waitForFunction(() => !document.querySelector('#btn-restart').classList.contains('hidden'), null, { timeout: 300000 });

  const result = await page.evaluate(() => {
    const r = window.__game.state.result;
    return {
      love: r.verdict.love, mood: r.verdict.mood, grade: r.verdict.grade, accepted: r.verdict.accepted,
      threshold: r.difficulty.threshold, turns: r.state.history.length,
      tiers: r.state.history.map(h => h.tier),
      hits: r.state.hits.length, red: r.state.redLines, radio: r.state.radioUsed,
      letter: r.letter.letter.length, mvp: r.letter.mvp,
      stamp: document.querySelector('#result-stamp').textContent,
      debriefRows: document.querySelectorAll('.turn-table tr').length,
      usage: window.__game.llm.usage,
    };
  });
  check('전 턴이 판정됐다 (첫인상 1 + 문자 4 + 대면 5)', result.turns === 10, `${result.turns}턴`);
  check('심판 tier가 한 종류로 몰리지 않았다', new Set(result.tiers).size >= 2, result.tiers.join(','));
  check('결과 편지가 도착했다', result.letter > 80, `${result.letter}자`);
  check('디브리핑 원장이 그려졌다', result.debriefRows === result.turns + 1, `${result.debriefRows}행`);
  check('프롬프트 캐시가 실제로 적중했다', result.usage.cacheRead > 5000, `${result.usage.cacheRead}tok 재사용`);
  check('페이지 런타임 에러 없음', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  console.log(`\n  📊 ${result.stamp} · 등급 ${result.grade} · 호감 ${result.love}/${result.threshold} · 분위기 ${result.mood}` +
    ` · 취향 ${result.hits} · 지뢰 ${result.red} · 무전 ${result.radio}`);
  console.log(`  🧾 tier: ${result.tiers.join(' ')}`);
  console.log(`  💰 ${result.usage.calls}콜 · $${result.usage.cost.toFixed(3)} · 캐시 ${result.usage.cacheRead.toLocaleString()}tok 재사용`);
  await page.screenshot({ path: `${SHOTS}/7-result.png`, fullPage: true });
} catch (e) {
  console.error('\n💥 E2E 실패:', e.message);
  await page.screenshot({ path: `${SHOTS}/crash.png`, fullPage: true }).catch(() => { });
  fail.push('E2E 예외: ' + e.message);
}

await browser.close();
server.close();
console.log(`\n${fail.length ? `❌ 실패 ${fail.length}건: ${fail.join(' | ')}` : '✅ 브라우저 E2E 전 항목 통과'}`);
console.log(`📸 스크린샷 → ${SHOTS}`);
process.exit(fail.length ? 1 : 0);
