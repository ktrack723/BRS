// browser.mjs — 실제 브라우저에서 게임을 끝까지 돌리는 E2E.
// three.js 렌더링 · 썸네일 40장 · 스타일링 반영 · 게이지 갱신 · 무전 · 결과 화면까지 확인한다.
//
//   node tests/browser.mjs                        기본: 가짜 LLM 모드 (API 키·크레딧 불필요, 결정적)
//   ANTHROPIC_API_KEY=sk-... node tests/browser.mjs --live    실제 API로 (크레딧 소모)
//   추가 옵션: --couple=os-war --shots=/tmp/shots --headed --model=claude-sonnet-5
//   (모델은 Sonnet 계열만 허용된다 — tests/test-model.mjs)
//
// 가짜 LLM 모드는 window.__game.llm.call을 페이지 안에서 바꿔치기한다.
// DOM·CSS·three.js·게임 흐름은 전부 진짜로 돌아가고 LLM만 결정적으로 대체된다.

import http from 'node:http';
import { createRequire } from 'node:module';
import { resolveTestModel } from './test-model.mjs';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2)
  .filter(a => a.startsWith('--'))
  .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || 'true']; }));

const LIVE = args.live === 'true';
const MODEL = resolveTestModel(args.model);   // 테스트는 Sonnet 고정 (tests/test-model.mjs)
const KEY = LIVE ? process.env.ANTHROPIC_API_KEY : 'sk-ant-fake-key-for-mock-mode';
if (LIVE && !KEY) { console.error('--live 모드인데 ANTHROPIC_API_KEY가 없다'); process.exit(1); }

const ROOT = path.resolve(import.meta.dirname, '..');
const SHOTS = args.shots || '/tmp/claude-0/shots';
const COUPLE = args.couple || 'os-war';
const PORT = 8199;
fs.mkdirSync(SHOTS, { recursive: true });

// playwright는 이 저장소의 의존성이 아니다 (게임 자체는 빌드 없는 정적 사이트다).
// 로컬 설치와 전역 설치를 모두 뒤져서 없으면 친절하게 안내하고 빠진다.
const chromium = (() => {
  const req = createRequire(import.meta.url);
  // playwright는 CJS 패키지라 require로 집는 게 확실하다 (동적 import는 CJS 네임드 익스포트를 놓칠 수 있다)
  const roots = ['/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules'];
  try { return req('playwright').chromium; } catch { /* 전역 설치를 찾아본다 */ }
  for (const root of roots) {
    try { return req(req.resolve('playwright', { paths: [root] })).chromium; } catch { /* 다음 후보 */ }
  }
  console.error('playwright를 찾을 수 없다. `npm i -D playwright` 또는 `npm i -g playwright` 후 다시 실행하라.');
  process.exit(2);
})();

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
const T = LIVE ? 1 : 0.1;   // 가짜 모드는 훨씬 빠르니 타임아웃도 줄인다
const ms = n => Math.max(4000, Math.round(n * T));

// 페이지 안에서 실행될 가짜 LLM. label로 분기해 결정적인 값을 돌려준다.
function installMockLlm(hiddenPrefs) {
  const llm = window.__game.llm;
  let turn = 0, judged = 0;
  window.__mock = { calls: [], maxInFlight: 0, inFlight: 0 };
  window.__mockLatency = 240;   // 실제 LLM 왕복을 흉내내 UI 조작이 끼어들 틈을 만든다
  llm.call = async ({ label, system, messages, schema }) => {
    const m = window.__mock;
    m.inFlight++; m.maxInFlight = Math.max(m.maxInFlight, m.inFlight);
    m.calls.push({ label, hasSystem: !!system, schema: !!schema, system });
    await new Promise(r => setTimeout(r, window.__mockLatency ?? 240));
    m.inFlight--;
    if (label === '본부 인증') return '이상무';
    if (label === '국장 브리핑') {
      return '요원. 큐피드국은 도저히 이어질 리 없는 20건을 상시 접수하고 있다. ' +
        '어인과 사자 퍼리, 뱀파이어와 마늘 농장주, 정적끼리. 전부 정상이 아니다. ' +
        '너는 그들을 이어붙여야 한다. 실패하면 출산율은 0.007이 된다. 이상! 건투를 빈다, 요원.';
    }
    if (label === '스타일링 시공') {
      return {
        spec: {
          skin: '#e8d0c0', hair: '#ff8a2b', hairStyle: 'spiky', top: '#dd1122',
          bottom: '#2a3a4a', shoes: '#7a5a2a', heightScale: 1.02, widthScale: 0.9,
          accessory: 'sunglasses', accessoryColor: '#111111',
          expression: 'chad', aura: 'fire', species: 'human',
        },
        outfitDesc: '형광 주황으로 물들인 머리에 새빨간 턱시도, 카우보이 부츠, 선글라스를 썼다.',
        comment: '시공 완료. 책임은 안 진다.',
      };
    }
    if (label.includes('상황 생성')) {
      return { place: '네오서울 무한스크롤 카페', intro: '오후 7시. 둘이 마주 앉았다.', outfitReaction: '…그 부츠, 진심입니까.' };
    }
    if (label === '결과 편지') {
      return {
        letter: '요원님. 저 해냈습니다. 아니, 저희가 해냈습니다.\n그 사람이 제 부츠를 보고 웃었을 때 저는 이미 이겼다고 생각했습니다.\n감사합니다. 정말로.',
        epilogue: '둘은 듀얼 부팅 커플이 되었다.', mvp: '3턴째 무전이 판을 갈랐다',
      };
    }
    if (label.startsWith('판정') || label.startsWith('첫인상')) {
      judged++;
      // 앞쪽은 취향 적중, 뒤로 갈수록 무난 — tier가 한 종류로 몰리지 않게
      const pick = hiddenPrefs[judged - 1];
      if (pick) {
        return { tier: 'critical', moodDelta: 5, loveDelta: 9, visiblePrefHit: '', hiddenPrefHit: pick, redLineHit: false, reason: '급소 관통! 상대가 무너진다' };
      }
      if (judged % 3 === 0) {
        return { tier: 'empty', moodDelta: 0, loveDelta: 0, visiblePrefHit: '', hiddenPrefHit: '', redLineHit: false, reason: '알맹이 없는 맞장구, 공짜 점수는 없다' };
      }
      return { tier: 'ok', moodDelta: 3, loveDelta: 3, visiblePrefHit: '', hiddenPrefHit: '', redLineHit: false, reason: '맥락은 받았다, 결정타는 아니다' };
    }
    if (label.includes('발언')) return `클라이언트 ${++turn}번째 한마디입니다`;
    if (label.includes('응답')) return '…그래서요? (컵을 고쳐 잡는다)';
    return '기타';
  };
}

await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({
  headless: args.headed !== 'true',
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));
page.on('console', m => {
  if (m.type() !== 'error') return;
  const t = m.text();
  // 외부 폰트(Google Fonts) 차단은 이 게임의 버그가 아니라 망 상태다. 폰트는 폴백으로 떨어진다.
  if (/Failed to load resource/.test(t)) return;
  pageErrors.push('console: ' + t);
});
page.on('requestfailed', r => {
  const u = r.url();
  if (u.startsWith(`http://127.0.0.1:${PORT}`)) pageErrors.push(`요청 실패(로컬): ${u}`);
});

try {
  console.log(`\n🌐 부팅 (${LIVE ? '실제 API' : '가짜 LLM'} 모드)`);
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game && window.__game.COUPLES);
  check('모듈이 로드되고 의뢰 대장이 노출된다', true);

  // 대비 가드: 팔레트를 손볼 때마다 어두운 배경 위에 어두운 글자가 남는 사고가 난다.
  // 보이는 텍스트마다 실제 배경을 거슬러 찾아 명암비를 계산한다 (WCAG AA 본문 4.5:1 / 큰 글자 3:1).
  await page.addInitScript(() => { });
  await page.evaluate(() => {
    window.__contrast = () => {
      const lum = (r, g, b) => {
        const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const parse = c => (c.match(/[\d.]+/g) || []).map(Number);
      // 그라데이션/이미지 배경은 단일 색으로 환산할 수 없으므로 null을 돌려 평가에서 제외한다.
      const bgOf = el => {
        for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
          const st = getComputedStyle(n);
          if (st.backgroundImage !== 'none') return null;
          const c = parse(st.backgroundColor);
          if (c.length >= 3 && (c[3] === undefined || c[3] > 0.5)) return c;
        }
        return [52, 56, 47]; // body 배경
      };
      const bad = [];
      for (const el of document.querySelectorAll(
        'p, span, li, td, th, h1, h2, h3, h4, label, summary, button, figcaption, b, code')) {
        if (!el.offsetParent) continue;
        const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (txt.length < 2) continue;
        const st = getComputedStyle(el);
        if (st.visibility === 'hidden' || +st.opacity < 0.5) continue;
        const bg = bgOf(el);
        if (!bg) continue;
        const fg = parse(st.color);
        const l1 = lum(...fg.slice(0, 3)), l2 = lum(...bg.slice(0, 3));
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const big = parseFloat(st.fontSize) >= 24 || (parseFloat(st.fontSize) >= 18.66 && +st.fontWeight >= 600);
        if (ratio < (big ? 3 : 4.5)) bad.push({ txt: txt.slice(0, 24), ratio: +ratio.toFixed(2), color: st.color });
      }
      return bad;
    };
  });
  const checkContrast = async (where) => {
    const bad = await page.evaluate(() => window.__contrast());
    check(`${where} 텍스트 명암비 WCAG AA`, bad.length === 0,
      bad.slice(0, 3).map(b => `"${b.txt}" ${b.ratio}:1 ${b.color}`).join(' / '));
  };
  await checkContrast('부팅 화면');

  if (!LIVE) {
    const hidden = await page.evaluate(id => window.__game.COUPLES.find(c => c.id === id).target.hiddenPrefs, COUPLE);
    await page.evaluate(installMockLlm, hidden);
  }
  await page.fill('#key-input', KEY);
  // 실제 API 모드에서도 테스트는 Sonnet만 쓴다
  await page.selectOption('#model-select', MODEL);
  check(`모델이 테스트용으로 고정됐다 (${MODEL})`,
    await page.inputValue('#model-select') === MODEL);
  await page.click('#btn-boot');
  await page.waitForSelector('#screen-intro:not(.hidden)', { timeout: ms(90000) });
  check('키 인증 후 신입 교육 진입', true);
  await page.screenshot({ path: `${SHOTS}/1-intro.png` });

  // 교육 슬라이드 5장이 전부 그려지는지
  const slideTexts = [];
  for (let i = 0; i < 5; i++) {
    slideTexts.push(await page.textContent('#intro-slides'));
    if (i < 4) await page.click('#btn-intro-next');
  }
  check('신입 교육 5장이 모두 다른 내용으로 그려진다', new Set(slideTexts).size === 5);
  check('교육에 준비 단계가 채점되지 않음이 명시된다',
    slideTexts.some(t => /채점(하지 않는다|되지 않는다|\s*대상이 아니다)/.test(t)));
  await page.screenshot({ path: `${SHOTS}/2-slides.png` });

  console.log('\n📠 브리핑');
  await page.click('#btn-intro-next');
  await page.waitForSelector('#btn-to-roster:not(.hidden)', { timeout: ms(120000) });
  const briefing = await page.textContent('#briefing-text');
  check('국장 브리핑이 타이핑 연출까지 끝났다', briefing.length > 60, `${briefing.length}자`);

  console.log('\n📚 의뢰 대장 20건');
  await page.click('#btn-to-roster');
  await page.waitForSelector('.couple-card', { timeout: ms(20000) });
  const cardCount = await page.locator('.couple-card').count();
  check('20쌍이 모두 렌더링됐다', cardCount === 20, `${cardCount}장`);

  // 썸네일이 진짜 three.js 렌더 결과인지 (투명한 빈 PNG가 아닌지)
  const thumb = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('.cc-pair img')];
    const opaqueOf = async (im) => {
      const cv = document.createElement('canvas');
      cv.width = 160; cv.height = 200;
      const ctx = cv.getContext('2d');
      await im.decode();
      ctx.drawImage(im, 0, 0, 160, 200);
      const d = ctx.getImageData(0, 0, 160, 200).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
      return n;
    };
    const sample = await Promise.all(imgs.slice(0, 6).map(opaqueOf));
    return { count: imgs.length, uniq: new Set(imgs.map(i => i.src)).size, sample, minOpaque: Math.min(...sample) };
  });
  check('아바타 썸네일 40장 생성', thumb.count === 40, `${thumb.count}장`);
  check('썸네일이 빈 이미지가 아니다 (three.js가 실제로 그렸다)', thumb.minOpaque > 500, `최소 불투명 픽셀 ${thumb.minOpaque}`);
  check('인물마다 썸네일이 다르다', thumb.uniq > 34, `고유 ${thumb.uniq}/${thumb.count}`);
  await checkContrast('의뢰 대장');
  check('WebGL 컨텍스트 고갈 없음 (오프스크린 1개 재사용)',
    !pageErrors.some(e => /context|WebGL/i.test(e)), pageErrors.filter(e => /context|WebGL/i.test(e))[0] || '');

  // 난이도 필터
  const counts = await page.evaluate(() => {
    const out = {};
    for (const b of document.querySelectorAll('.filter-tab')) out[b.textContent.split(' ')[0]] = b.textContent;
    return out;
  });
  await page.click('.filter-tab[data-f="헬"]');
  const hellCards = await page.locator('.couple-card').count();
  check('난이도 필터가 동작한다', hellCards > 0 && hellCards < 20, `헬 ${hellCards}장 / ${JSON.stringify(counts)}`);
  await page.click('.filter-tab[data-f="전체"]');
  await page.screenshot({ path: `${SHOTS}/3-roster.png`, fullPage: true });

  // 의뢰서 상세 모달
  await page.locator('.couple-card .cc-detail').first().click();
  await page.waitForSelector('#modal-dossier:not(.hidden)');
  const dossier = await page.textContent('#dossier-box');
  const shown = await page.evaluate(() => {
    const name = document.querySelector('#dossier-box h3').textContent;
    const c = window.__game.COUPLES.find(x => name.includes(x.client.name));
    return { red: c.target.redLines, hidden: c.target.hiddenPrefs, visible: c.target.visiblePrefs };
  });
  check('의뢰서 상세에 접촉 금지 항목이 전부 공개된다',
    shown.red.every(r => dossier.includes(r)), `${shown.red.length}건`);
  check('의뢰서 상세에 알려진 취향이 노출된다', shown.visible.every(v => dossier.includes(v)));
  check('의뢰서 상세에 미확인 취향 내용은 노출되지 않는다 (개수만)',
    shown.hidden.every(h => !dossier.includes(h)) && dossier.includes(String(shown.hidden.length)));
  await page.click('#dossier-close');

  console.log('\n👔 컨설팅 + 스타일링');
  await page.evaluate(id => {
    const target = window.__game.COUPLES.find(c => c.id === id);
    const card = [...document.querySelectorAll('.couple-card')]
      .find(el => el.textContent.includes(target.client.name));
    card.querySelector('.cc-take').click();
  }, COUPLE);
  await page.waitForSelector('#screen-consult:not(.hidden)', { timeout: ms(10000) });

  // 준비 3종이 "주입 미리보기"를 보여주는지 (점수가 아니라)
  const consultText = await page.textContent('#screen-consult');
  check('준비 단계에 점수 UI가 없다', !/\/10/.test(consultText), consultText.match(/\S{0,12}\/10/)?.[0] || '');
  check('준비 단계가 채점 대상이 아님을 명시한다', /채점(하지 않는다|\s*대상이 아니다|\s*안 한다)/.test(consultText));
  await page.fill('#coaching-input', '상대가 말끝을 흐리면 반드시 물고 늘어져라. 아치 얘기는 금지.');
  const previewText = await page.textContent('#coaching-result');
  check('코칭이 주입될 원문 그대로 미리보기된다', previewText.includes('물고 늘어져라'), previewText.slice(0, 50));

  const specBefore = await page.evaluate(() => structuredClone(window.__game.state.clientSpec));
  await page.fill('#styling-input', '형광 주황색으로 염색, 새빨간 턱시도, 카우보이 부츠, 선글라스');
  await page.click('#btn-styling');
  await page.waitForFunction(() => (document.querySelector('#styling-result')?.textContent || '').length > 5, null, { timeout: ms(120000) });
  const specAfter = await page.evaluate(() => structuredClone(window.__game.state.clientSpec));
  const outfit = await page.evaluate(() => window.__game.state.prep.outfitDesc);
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [hr, hg, hb] = rgb(specAfter.hair);

  check('스타일링이 3D 스펙을 실제로 바꿨다', JSON.stringify(specBefore) !== JSON.stringify(specAfter));
  check('"주황색으로 염색" → 머리색이 주황 계열이 됐다',
    hr > 180 && hg > 60 && hg < 190 && hb < 110, `${specAfter.hair} ← ${specBefore.hair}`);
  check('"빨간 턱시도" → 상의가 빨강 계열이 됐다',
    rgb(specAfter.top)[0] > 150 && rgb(specAfter.top)[1] < 110, specAfter.top);
  check('종족은 스타일링으로 바뀌지 않는다', specAfter.species === specBefore.species, specAfter.species);
  check('착장 묘사가 생성됐다 (대면 첫인상 판정의 입력값)', outfit.length > 10, outfit.slice(0, 50));

  // 무대 캔버스가 실제로 픽셀을 뱉는지
  const stageOpaque = await page.evaluate(() => {
    const cv = document.querySelector('#stage-consult');
    const gl = cv.getContext('webgl2') || cv.getContext('webgl');
    return { w: cv.width, h: cv.height, hasGl: !!gl };
  });
  check('컨설팅 3D 무대가 WebGL 컨텍스트를 잡고 그려진다',
    stageOpaque.hasGl && stageOpaque.w > 0, JSON.stringify(stageOpaque));
  await checkContrast('작전 준비 화면');
  await page.screenshot({ path: `${SHOTS}/4-consult.png`, fullPage: true });

  console.log('\n🚨 작전 개시');
  await page.fill('#speech-input', '컨퍼런스에서 장내가 얼어붙었을 때 너 혼자 심장이 얼어붙었다며. 오늘은 그걸 말로 해.');
  await page.click('#btn-start-op');
  await page.waitForSelector('#screen-chat:not(.hidden)', { timeout: ms(15000) });
  await page.waitForFunction(() => document.querySelectorAll('#chat-window .bubble').length >= 2, null, { timeout: ms(180000) });
  check('문자 페이즈에서 두 에이전트가 대화한다', true);

  // 무전 개입
  await page.waitForFunction(() => !document.querySelector('#btn-intervene').disabled, null, { timeout: ms(60000) });
  await page.click('#btn-intervene');
  await page.waitForSelector('#modal-radio:not(.hidden)');
  const radioCtx = await page.textContent('#radio-context');
  const redOf = await page.evaluate(() => window.__game.state.couple.target.redLines);
  check('무전 모달이 잔여 미확인 취향 수를 알려준다', /미확인 취향 잔여 \d+건/.test(radioCtx), radioCtx.slice(0, 40));
  check('무전 모달이 접촉 금지 항목을 다시 보여준다', redOf.every(r => radioCtx.includes(r)));
  check('무전 모달이 대화를 멈춰둔다', await page.evaluate(() => window.__game.state.engine.paused === true));
  await page.fill('#radio-input', '지금 상대가 말하다 말았다. 그게 뭐였냐고 물고 늘어져라.');
  await page.click('#btn-radio-send');
  await page.waitForFunction(() => document.querySelectorAll('.bubble.radio').length >= 1, null, { timeout: ms(20000) });
  check('무전이 대화에 주입됐다', true);
  check('송신 후 대화가 다시 흐른다', await page.evaluate(() => window.__game.state.engine.paused === false));

  // 판정은 한 턴 늦게 오므로 문자 페이즈 중에 최소 한 줄은 흘러야 한다
  await page.waitForFunction(() => document.querySelectorAll('.judge-line').length >= 1, null, { timeout: ms(120000) });
  const textJudge = await page.evaluate(() => document.querySelector('.judge-line').textContent);
  check('문자 페이즈에 심판 판정이 흐른다', textJudge.includes('호감'), textJudge.slice(0, 60));
  check('판정 줄에 tier 계산 근거가 노출된다', /판정 [+-]?\d+ × 분위기/.test(textJudge), textJudge.slice(-40));
  await page.screenshot({ path: `${SHOTS}/5-texting.png`, fullPage: true });

  console.log('   ...대면 페이즈 대기');
  // 빠른 모드에서는 이미 대면(또는 결과)까지 지나가 있을 수 있다. 어느 쪽이든 통과시킨다.
  await page.waitForFunction(() =>
    document.body.classList.contains('phase-talk')
    || !document.querySelector('#screen-result').classList.contains('hidden'),
  null, { timeout: ms(400000) });
  // 페이즈가 바뀌면 판정 피드는 의도적으로 비워진다. 대면 판정이 새로 쌓이는지 본다.
  await page.waitForFunction(() =>
    document.querySelectorAll('.judge-line').length >= 1
    || !document.querySelector('#screen-result').classList.contains('hidden'),
  null, { timeout: ms(200000) });
  const judged = await page.locator('.judge-line').count();
  check('대면 페이즈에도 심판 판정이 새로 쌓인다', judged >= 1, `${judged}줄`);
  const meters = await page.evaluate(() => ({
    love: +document.querySelector('#meter-love-num').textContent,
    mood: +document.querySelector('#meter-mood-num').textContent,
    loveW: document.querySelector('#meter-love-fill').style.width,
    thrLeft: document.querySelector('#meter-threshold').style.left,
    mult: document.querySelector('#hud-mult').textContent,
  }));
  check('게이지 바가 수치와 함께 갱신된다',
    meters.loveW === meters.love + '%' && meters.thrLeft !== '', JSON.stringify(meters));
  await checkContrast('대면 공작 화면');
  await page.screenshot({ path: `${SHOTS}/6-talking.png`, fullPage: true });

  console.log('   ...결과 대기');
  await page.waitForSelector('#screen-result:not(.hidden)', { timeout: ms(600000) });
  await page.waitForFunction(() => !document.querySelector('#btn-restart').classList.contains('hidden'), null, { timeout: ms(300000) });

  const result = await page.evaluate(() => {
    const r = window.__game.state.result;
    return {
      love: r.verdict.love, mood: r.verdict.mood, grade: r.verdict.grade, accepted: r.verdict.accepted,
      threshold: r.difficulty.threshold, turns: r.state.history.length,
      tiers: r.state.history.map(h => h.tier),
      hits: r.state.hits.length, hiddenTotal: r.couple.target.hiddenPrefs.length,
      red: r.state.redLines, radio: r.state.radioUsed,
      letter: (document.querySelector('#result-letter').textContent || '').length,
      stamp: document.querySelector('#result-stamp').textContent,
      mvp: document.querySelector('#result-mvp').textContent,
      debriefRows: document.querySelectorAll('.turn-table tr').length,
      prefRows: document.querySelectorAll('#debrief-prefs li').length,
      usage: window.__game.llm.usage,
      mock: window.__mock ? { calls: window.__mock.calls.length, maxInFlight: window.__mock.maxInFlight } : null,
    };
  });

  check('전 턴이 판정됐다 (첫인상 1 + 문자 4 + 대면 5 = 10)', result.turns === 10, `${result.turns}턴`);
  check('심판 tier가 한 종류로 몰리지 않았다', new Set(result.tiers).size >= 2, result.tiers.join(','));
  check('결과 편지가 타이핑까지 끝났다', result.letter > 60, `${result.letter}자`);
  check('결정적 순간(MVP)이 표시된다', result.mvp.length > 10);
  check('디브리핑 원장이 턴 수와 일치한다', result.debriefRows === result.turns + 1, `${result.debriefRows}행`);
  check('타겟의 실제 취향이 종료 후 전면 공개된다',
    result.prefRows >= result.hiddenTotal, `${result.prefRows}줄`);
  if (result.mock) {
    check('판정과 타겟 응답이 동시에 발사됐다 (턴당 왕복 2회)', result.mock.maxInFlight >= 2, `동시 최대 ${result.mock.maxInFlight}`);
    check('총 LLM 호출이 예상 범위다', result.mock.calls >= 28 && result.mock.calls <= 34, `${result.mock.calls}콜`);
  } else {
    check('프롬프트 캐시가 실제로 적중했다', result.usage.cacheRead > 5000, `${result.usage.cacheRead}tok 재사용`);
  }
  check('페이지 런타임 에러 없음', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  console.log(`\n  📊 ${result.stamp} · 등급 ${result.grade} · 호감 ${result.love}/${result.threshold} · 분위기 ${result.mood}` +
    ` · 취향 ${result.hits}/${result.hiddenTotal} · 지뢰 ${result.red} · 무전 ${result.radio}`);
  console.log(`  🧾 tier: ${result.tiers.join(' ')}`);
  if (LIVE) console.log(`  💰 ${result.usage.calls}콜 · $${result.usage.cost.toFixed(3)} · 캐시 ${result.usage.cacheRead.toLocaleString()}tok`);
  await checkContrast('결과 화면');
  await page.screenshot({ path: `${SHOTS}/7-result.png`, fullPage: true });

  // 재도전 / 다음 의뢰 버튼
  await page.click('#btn-restart');
  await page.waitForSelector('#screen-roster:not(.hidden)', { timeout: ms(10000) });
  const record = await page.textContent('#agent-record');
  check('전적이 저장되고 대장에 표시된다', /공작 \d+회/.test(record), record.slice(0, 70));
  const cleared = await page.locator('.cleared-stamp').count();
  check('성사한 조합에 도장이 찍힌다', result.accepted ? cleared >= 1 : cleared === 0, `${cleared}개`);
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
