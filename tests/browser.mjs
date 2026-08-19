// browser.mjs — 실제 브라우저에서 게임을 끝까지 돌리는 E2E.
// three.js 렌더링 · 썸네일 40장 · 준비 3화면 · 자유 도형 · 게이지 · 무전 · 결과 화면까지 확인한다.
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
const AGENT_NAME = '박큐피드';
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
function installMockLlm() {
  const llm = window.__game.llm;
  let turn = 0, judged = 0;
  window.__mock = { calls: [], maxInFlight: 0, inFlight: 0 };
  window.__mockLatency = 240;   // 실제 LLM 왕복을 흉내내 UI 조작이 끼어들 틈을 만든다
  // 등급이 한 종류로 몰리지 않게 순환시킨다
  const TIERS = ['warm', 'nudge', 'flat', 'breakthrough', 'nudge', 'chill'];
  llm.call = async ({ label, system, messages, schema }) => {
    const m = window.__mock;
    m.inFlight++; m.maxInFlight = Math.max(m.maxInFlight, m.inFlight);
    m.calls.push({ label, hasSystem: !!system, schema: !!schema, system });
    await new Promise(r => setTimeout(r, window.__mockLatency ?? 240));
    m.inFlight--;
    if (label === '본부 인증') return '이상무';
    if (label === '스타일링 시공') {
      return {
        spec: {
          skin: '#e8d0c0', hair: '#ff8a2b', hairStyle: 'spiky', top: '#dd1122',
          bottom: '#2a3a4a', shoes: '#7a5a2a', heightScale: 1.02, widthScale: 0.9,
          accessory: 'sunglasses', accessoryColor: '#111111',
          expression: 'chad', aura: 'fire', species: 'human',
          props: [
            { shape: 'sphere', color: '#1a1a1a', size: 0.35, at: 'handR', motion: 'bob', label: '폭탄' },
            { shape: 'torus', color: '#ffdd55', size: 0.4, at: 'crown', motion: 'yaw', label: '후광' },
          ],
        },
        outfitDesc: '형광 주황으로 물들인 머리에 새빨간 턱시도, 카우보이 부츠, 선글라스. 오른손에 폭탄을 들었다.',
        comment: '시공 완료. 책임은 안 진다.',
        clientReaction: '아니 정말 이러라고요? …뭐, 따르겠습니다만.',
        clientFace: 'cringe',
      };
    }
    if (label === '취조실 반응') {
      return { reaction: '알겠습니다. 근데 그거 하면 제가 좀 이상해 보이지 않나요?', face: 'cringe', note: '피조사자 항의 1회. 수용함.' };
    }
    if (label === '정문 반응') {
      return { reaction: '…그 얘기를 어떻게 아셨어요. (문고리를 잡는다)', face: 'shy', note: '동공 흔들림 관측. 사기 상승으로 판단.' };
    }
    if (label.includes('상황 생성')) {
      return {
        place: '네오서울 무한스크롤 카페', intro: '오후 7시. 둘이 마주 앉았다.',
        outfitReaction: '…그 부츠, 진심입니까.', vibe: '앉자마자 상대가 부츠부터 봤다.',
      };
    }
    if (label === '결과 편지') {
      return {
        letter: '요원님. 저 해냈습니다. 아니, 저희가 해냈습니다.\n그 사람이 제 부츠를 보고 웃었을 때 저는 이미 이겼다고 생각했습니다.\n감사합니다. 정말로.',
        epilogue: '둘은 듀얼 부팅 커플이 되었다.', mvp: '3턴째 무전이 판을 갈랐다',
      };
    }
    if (label.startsWith('판정') || label.startsWith('첫인상')) {
      const tier = TIERS[judged++ % TIERS.length];
      const BAND = { breakthrough: [9, 7], warm: [5, 4], nudge: [2, 2], flat: [0, 0], chill: [-3, -4], disaster: [-8, -7] };
      const [love, mood] = BAND[tier];
      return {
        tier, loveDelta: love, moodDelta: mood,
        reason: `${tier} 판정. 상대가 실제로 그만큼 움직였다`,
        vibe: `공기 갱신 ${judged}: 둘 다 컵만 만지작거린다`,
        revealed: judged === 2 ? '사실 매일 밤 WSL로 우분투를 쓴다' : '',
        clientEmote: 'talk', targetEmote: judged % 2 ? 'nod' : 'laugh',
      };
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

// 프록시 뒤에서 --live를 돌리기 위한 다리.
// 게임은 브라우저에서 api.anthropic.com으로 직접 fetch한다. 컨테이너/CI처럼 나가는 길이
// 프록시로만 열려 있는 환경에서는 그 요청이 "Failed to fetch"로 죽는다.
// 그래서 그 요청만 가로채 Node가 대신 보낸다 — Node는 환경의 프록시·CA 설정을 그대로 쓰므로
// TLS 검증을 끌 필요가 없고, 게임 코드도 손대지 않는다.
if (LIVE) {
  const PASS = ['content-type', 'x-api-key', 'anthropic-version', 'anthropic-dangerous-direct-browser-access'];
  const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
  };
  await page.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    const src = req.headers();
    const headers = Object.fromEntries(PASS.filter(h => src[h]).map(h => [h, src[h]]));
    try {
      const res = await fetch(req.url(), { method: req.method(), headers, body: req.postData() ?? undefined });
      const body = await res.text();
      await route.fulfill({
        status: res.status,
        headers: { ...CORS, 'content-type': res.headers.get('content-type') || 'application/json' },
        body,
      });
    } catch (e) {
      await route.fulfill({
        status: 502, headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify({ error: { type: 'proxy_bridge_failed', message: String(e.message) } }),
      });
    }
  });
}

try {
  console.log(`\n🌐 부팅 (${LIVE ? '실제 API' : '가짜 LLM'} 모드)`);
  // 재생 속도는 기본적으로 꺼 둔다(?pace=instant). 사람 읽는 속도로 돌리면 E2E가 몇 분씩 걸린다.
  // 실제 체감을 보고 싶으면 --pace=normal 처럼 넘긴다. 페이싱 자체는 아래 '재생 속도' 항목에서 검사한다.
  await page.goto(`http://127.0.0.1:${PORT}/?pace=${args.pace || 'instant'}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game && window.__game.COUPLES);
  check('모듈이 로드되고 의뢰 대장이 노출된다', true);

  // ── 재생 속도 ────────────────────────────────────────
  // 대화가 눈보다 빨리 지나가서 넣은 층이다. 대기가 실제로 걸리는지, 눌러서 건너뛸 수 있는지 본다.
  const paceProbe = await page.evaluate(async () => {
    const pace = window.__game.pace;
    const plan = pace.bubblePlan('가'.repeat(40), 1);       // '보통' 기준
    const instant = pace.bubblePlan('가'.repeat(40));       // 지금 설정(?pace=instant)
    const t0 = performance.now();
    const waited = pace.beat(1200);
    await new Promise(r => setTimeout(r, 60));
    const wasWaiting = pace.isWaiting();
    document.querySelector('#chat-window').dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true }));
    await waited;
    const skipMs = performance.now() - t0;
    const t1 = performance.now();
    await pace.beat(300);
    return {
      steps: pace.PACE_STEPS.map(s => s.key),
      buttons: [...document.querySelectorAll('#pace-buttons .pace-btn')].map(b => b.textContent),
      planTotal: plan.total, planType: plan.typeMs, instantTotal: instant.total,
      wasWaiting, skipMs, fullMs: performance.now() - t1,
    };
  });
  check('재생 속도 단계가 화면에 나온다', paceProbe.buttons.length === paceProbe.steps.length,
    paceProbe.buttons.join('/'));
  check('말풍선 하나에 읽을 시간이 배정된다',
    paceProbe.planTotal >= 3000 && paceProbe.planType > 0, `${paceProbe.planTotal}ms`);
  if (!args.pace || args.pace === 'instant') {
    check("'즉시'로 두면 대기가 사라진다", paceProbe.instantTotal === 0);
  }
  check('대기 중에는 "눌러서 다음" 신호가 선다', paceProbe.wasWaiting === true);
  check('기록창을 누르면 대기가 즉시 끝난다', paceProbe.skipMs < 700, `${Math.round(paceProbe.skipMs)}ms`);
  check('누르지 않으면 정해진 시간만큼 기다린다', paceProbe.fullMs >= 280, `${Math.round(paceProbe.fullMs)}ms`);

  // 대비 가드: 팔레트를 손볼 때마다 어두운 배경 위에 어두운 글자가 남는 사고가 난다.
  // 보이는 텍스트마다 실제 배경을 거슬러 찾아 명암비를 계산한다 (WCAG AA 본문 4.5:1 / 큰 글자 3:1).
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
      // 비활성 컨트롤은 WCAG 1.4.3 명암비 요건에서 면제된다
      if (el.disabled || el.closest('[disabled]')) continue;
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

  if (!LIVE) await page.evaluate(installMockLlm);

  // 요원 등록 — 이름/성별은 주관식이다
  await page.fill('#agent-name', AGENT_NAME);
  await page.fill('#agent-gender', '기밀');
  await page.fill('#key-input', KEY);
  // 실제 API 모드에서도 테스트는 Sonnet만 쓴다
  await page.selectOption('#model-select', MODEL);
  check(`모델이 테스트용으로 고정됐다 (${MODEL})`,
    await page.inputValue('#model-select') === MODEL);
  await page.click('#btn-boot');
  await page.waitForSelector('#screen-intro:not(.hidden)', { timeout: ms(90000) });
  check('요원 등록 + 키 인증 후 신입 교육 진입', true);
  check('요원 정보가 상태에 남는다',
    await page.evaluate(() => window.__game.state.agent.name) === AGENT_NAME);
  await page.screenshot({ path: `${SHOTS}/1-intro.png` });

  // 교육 슬라이드가 전부 그려지는지
  const slideCount = await page.evaluate(() => document.querySelectorAll('#intro-dots .dot').length);
  const slideTexts = [];
  for (let i = 0; i < slideCount; i++) {
    slideTexts.push(await page.textContent('#intro-slides'));
    if (i < slideCount - 1) await page.click('#btn-intro-next');
  }
  check(`신입 교육 ${slideCount}장이 모두 다른 내용으로 그려진다`, new Set(slideTexts).size === slideCount, `${slideCount}장`);
  check('교육에 준비 단계가 채점되지 않음이 명시된다',
    slideTexts.some(t => /채점(하지 않는다|되지 않는다|\s*대상이 아니다)/.test(t)));
  check('교육에 대화 규칙이 폐지됐음이 명시된다',
    slideTexts.some(t => /대화 규칙이 없다|전부 폐지/.test(t)));
  check('교육이 준비 3장소를 안내한다',
    slideTexts.some(t => /미용실/.test(t) && /취조실/.test(t) && /정문/.test(t)));
  // 교육이 거짓말을 하면 그 뒤의 모든 판단이 틀어진다
  check('교육이 지뢰 목록은 의뢰인에게 안 넘어간다고 가르친다',
    slideTexts.some(t => /넘어가지 않는다|전달되지 않/.test(t)));
  check('교육에 "의뢰인도 그 정도는 안다"는 거짓말이 없다',
    !slideTexts.some(t => /의뢰인도 그 정도는 안다/.test(t)));
  check('교육이 심리 감정 열람처를 알려준다',
    slideTexts.some(t => /심리 감정/.test(t) && /의뢰서/.test(t)));
  await page.screenshot({ path: `${SHOTS}/2-slides.png` });

  console.log('\n📠 브리핑 (LLM 호출 없음)');
  const callsBeforeBriefing = LIVE ? 0 : await page.evaluate(() => window.__mock.calls.length);
  await page.click('#btn-intro-next');
  await page.waitForSelector('#btn-to-roster:not(.hidden)', { timeout: ms(120000) });
  const briefing = await page.textContent('#briefing-text');
  check('국장 브리핑이 타이핑 연출까지 끝났다', briefing.length > 60, `${briefing.length}자`);
  check('브리핑에 요원명이 인쇄된다', briefing.includes(AGENT_NAME));
  if (!LIVE) {
    const after = await page.evaluate(() => window.__mock.calls.length);
    check('브리핑은 LLM을 호출하지 않는다 (하드코딩)', after === callsBeforeBriefing, `${after - callsBeforeBriefing}콜 발생`);
  }
  await checkContrast('브리핑 화면');

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
  check('전적 줄에 요원명이 표시된다', (await page.textContent('#agent-record')).includes(AGENT_NAME));
  await checkContrast('의뢰 대장');
  check('WebGL 컨텍스트 고갈 없음 (오프스크린 1개 재사용)',
    !pageErrors.some(e => /context|WebGL/i.test(e)), pageErrors.filter(e => /context|WebGL/i.test(e))[0] || '');

  // 난이도 필터
  await page.click('.filter-tab[data-f="헬"]');
  const hellCards = await page.locator('.couple-card').count();
  check('난이도 필터가 동작한다', hellCards > 0 && hellCards < 20, `헬 ${hellCards}장`);
  await page.click('.filter-tab[data-f="전체"]');
  await page.screenshot({ path: `${SHOTS}/3-roster.png`, fullPage: true });

  // 의뢰서 상세 모달
  await page.locator('.couple-card .cc-detail').first().click();
  await page.waitForSelector('#modal-dossier:not(.hidden)');
  const dossier = await page.textContent('#dossier-box');
  const shown = await page.evaluate(() => {
    const name = document.querySelector('#dossier-box h3').textContent;
    const c = window.__game.COUPLES.find(x => name.includes(x.client.name));
    return { red: c.target.redLines, hidden: c.target.hiddenPrefs, visible: c.target.visiblePrefs, bg: c.client.background };
  });
  check('의뢰서 상세에 접촉 금지 항목이 전부 공개된다',
    shown.red.every(r => dossier.includes(r)), `${shown.red.length}건`);
  check('의뢰서 상세에 알려진 취향이 노출된다', shown.visible.every(v => dossier.includes(v)));
  check('의뢰서 상세에 인물 내력이 노출된다', shown.bg.every(b => dossier.includes(b)));
  check('의뢰서 상세에 감춰둔 이야기는 노출되지 않는다 (개수만)',
    shown.hidden.every(h => !dossier.includes(h)) && dossier.includes(String(shown.hidden.length)));

  // 결함이 화면에 안 나가면 플레이어에게는 그냥 불공정한 랜덤이다
  const psych = await page.evaluate(() => {
    const name = document.querySelector('#dossier-box h3').textContent;
    const c = window.__game.COUPLES.find(x => name.includes(x.client.name));
    const box = document.querySelector('#dossier-box .flaw-box');
    return {
      exists: !!box, text: box?.textContent || '',
      tags: [...(box?.querySelectorAll('.flaw-tag') || [])].length,
      want: c.client.flaw.want, fixation: c.client.flaw.fixation,
      targetWant: c.target.flaw.want,
    };
  });
  check('의뢰서에 의뢰인 심리 감정이 공개된다', psych.exists && psych.tags >= 4, `배지 ${psych.tags}개`);
  check('의뢰인이 원하는 것과 화제 회귀가 명시된다',
    psych.text.includes(psych.want) && psych.text.includes(psych.fixation));
  check('상대 쪽 심리 감정은 작전 전에 공개되지 않는다', !dossier.includes(psych.targetWant));
  check('지뢰 목록이 의뢰인에게 자동 전달되지 않음을 경고한다',
    /전달되지 않았다|넘어가지 않는다/.test(dossier), dossier.match(/전달되지 않았다[^.]{0,20}/)?.[0] || '없음');
  // 의뢰서는 이제 게임에서 정보가 가장 빽빽한 화면이다. 눈으로도 확인할 수 있게 남긴다.
  await page.locator('#dossier-box').screenshot({ path: `${SHOTS}/3b-dossier.png` });
  await page.click('#dossier-close');

  console.log('\n💇 준비 ① 미용실');
  await page.evaluate(id => {
    const target = window.__game.COUPLES.find(c => c.id === id);
    const card = [...document.querySelectorAll('.couple-card')]
      .find(el => el.textContent.includes(target.client.name));
    card.querySelector('.cc-take').click();
  }, COUPLE);
  await page.waitForSelector('#screen-salon:not(.hidden)', { timeout: ms(10000) });
  check('조합 선택 시 미용실로 들어간다', true);

  const salonText = await page.textContent('#screen-salon');
  check('준비 단계에 점수 UI가 없다', !/\/10/.test(salonText), salonText.match(/\S{0,12}\/10/)?.[0] || '');

  const specBefore = await page.evaluate(() => structuredClone(window.__game.state.clientSpec));
  await page.fill('#styling-input', '형광 주황색으로 염색, 새빨간 턱시도, 카우보이 부츠, 선글라스, 오른손에 폭탄, 머리 위에 도는 금색 고리');
  await page.click('#btn-styling');
  await page.waitForSelector('#styling-result .react-outfit', { timeout: ms(120000) });
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
  check('자유 도형(폭탄·후광)이 스펙에 붙는다',
    Array.isArray(specAfter.props) && specAfter.props.length >= 2,
    (specAfter.props || []).map(p => `${p.label}:${p.shape}@${p.at}`).join(' '));
  check('착장 묘사가 생성됐다 (대면 첫인상 판정의 입력값)', outfit.length > 10, outfit.slice(0, 50));

  const salonReact = await page.textContent('#styling-result');
  const salonSpeakers = await page.evaluate(() =>
    [...document.querySelectorAll('#styling-result .react-line')].map(el => ({
      who: el.querySelector('.react-who')?.textContent || '',
      body: (el.textContent || '').replace(el.querySelector('.react-who')?.textContent || '', '').trim(),
    })));
  const clientName = await page.evaluate(() => window.__game.state.couple.client.name);
  check('가위손 박의 소감이 표시된다',
    salonSpeakers.some(x => x.who.includes('가위손 박') && x.body.length > 4),
    salonSpeakers.map(x => x.who).join(' / '));
  check('거울 본 의뢰인 본인의 반응이 표시된다',
    salonSpeakers.some(x => x.who.includes(clientName) && x.body.length > 4),
    salonSpeakers.find(x => x.who.includes(clientName))?.body.slice(0, 40) || '(없음)');

  // 무대 캔버스가 실제로 픽셀을 뱉는지
  const stageOpaque = await page.evaluate(() => {
    const cv = document.querySelector('#stage-salon');
    const gl = cv.getContext('webgl2') || cv.getContext('webgl');
    return { w: cv.width, h: cv.height, hasGl: !!gl };
  });
  check('미용실 3D 무대가 WebGL 컨텍스트를 잡고 그려진다',
    stageOpaque.hasGl && stageOpaque.w > 0, JSON.stringify(stageOpaque));
  await checkContrast('미용실 화면');
  await page.screenshot({ path: `${SHOTS}/4-salon.png`, fullPage: true });

  console.log('\n🔦 준비 ② 취조실');
  await page.click('#btn-salon-next');
  await page.waitForSelector('#screen-interro:not(.hidden)', { timeout: ms(10000) });
  await page.fill('#coaching-input', '상대가 말을 아끼면 그냥 넘어가지 말고 한 번 더 물어라. 아치 얘기는 금지.');
  const previewText = await page.textContent('#coaching-inject');
  check('지침이 주입될 원문 그대로 미리보기된다', previewText.includes('한 번 더 물어라'), previewText.slice(0, 50));
  await page.click('#btn-coaching');
  // 빈 상태 안내문도 길이가 있으므로 글자 수로 기다리면 즉시 통과해버린다. 실제 반응 줄이 생길 때까지 기다린다.
  await page.waitForSelector('#coaching-result .react-line', { timeout: ms(120000) });
  const interroReact = await page.textContent('#coaching-result');
  const interroLine = await page.evaluate(() => {
    const el = document.querySelector('#coaching-result .react-line');
    return { who: el?.querySelector('.react-who')?.textContent || '', len: (el?.textContent || '').length };
  });
  check('취조실에서 의뢰인의 개인적 반응이 표시된다',
    interroLine.who.includes(clientName) && interroLine.len > 12, JSON.stringify(interroLine));
  check('기록관 관찰 기록이 함께 표시된다',
    (await page.locator('#coaching-result .react-note').count()) === 1, interroReact.slice(0, 40));
  await checkContrast('취조실 화면');
  await page.screenshot({ path: `${SHOTS}/5-interro.png`, fullPage: true });

  console.log('\n🚪 준비 ③ 정문');
  await page.click('#btn-interro-next');
  await page.waitForSelector('#screen-gate:not(.hidden)', { timeout: ms(10000) });
  await page.fill('#speech-input', '컨퍼런스에서 장내가 얼어붙었을 때 너 혼자 심장이 얼어붙었다며. 오늘은 그걸 말로 해.');
  await page.click('#btn-speech');
  await page.waitForSelector('#speech-result .react-line', { timeout: ms(120000) });
  const gateReact = await page.textContent('#speech-result');
  const gateLine = await page.evaluate(() => {
    const el = document.querySelector('#speech-result .react-line');
    return { who: el?.querySelector('.react-who')?.textContent || '', len: (el?.textContent || '').length };
  });
  check('정문에서 의뢰인의 개인적 반응이 표시된다',
    gateLine.who.includes(clientName) && gateLine.len > 12, gateReact.slice(0, 50));
  check('정문에도 기록관 기록이 남는다',
    (await page.locator('#speech-result .react-note').count()) === 1);
  check('준비 상태 요약이 세 항목을 모두 기재됨으로 본다',
    /세 항목 모두 기재/.test(await page.textContent('#prep-status')));
  await checkContrast('정문 화면');
  await page.screenshot({ path: `${SHOTS}/6-gate.png`, fullPage: true });

  console.log('\n🚨 작전 개시');
  await page.click('#btn-start-op');
  await page.waitForSelector('#screen-chat:not(.hidden)', { timeout: ms(15000) });
  await page.waitForFunction(() => document.querySelectorAll('#chat-window .bubble').length >= 2, null, { timeout: ms(180000) });
  check('문자 페이즈에서 두 에이전트가 대화한다', true);
  check('시작 시점부터 공기 한 줄이 떠 있다',
    (await page.textContent('#vibe-text')).length > 3, await page.textContent('#vibe-text'));

  // 무전 개입
  await page.waitForFunction(() => !document.querySelector('#btn-intervene').disabled, null, { timeout: ms(60000) });
  await page.click('#btn-intervene');
  await page.waitForSelector('#modal-radio:not(.hidden)');
  const radioCtx = await page.textContent('#radio-context');
  const redOf = await page.evaluate(() => window.__game.state.couple.target.redLines);
  check('무전 모달이 지금 공기를 보여준다', /지금 공기/.test(radioCtx), radioCtx.slice(0, 40));
  check('무전 모달이 상대의 질색 항목을 다시 보여준다', redOf.every(r => radioCtx.includes(r)));
  check('무전 모달이 대화를 멈춰둔다', await page.evaluate(() => window.__game.state.engine.paused === true));
  await page.fill('#radio-input', '지금 상대가 말하다 말았다. 그게 뭐였냐고 물어봐라.');
  await page.click('#btn-radio-send');
  await page.waitForFunction(() => document.querySelectorAll('.bubble.radio').length >= 1, null, { timeout: ms(20000) });
  check('무전이 대화에 주입됐다', true);
  check('송신 후 대화가 다시 흐른다', await page.evaluate(() => window.__game.state.engine.paused === false));

  // 판정은 한 턴 늦게 오므로 문자 페이즈 중에 최소 한 줄은 흘러야 한다
  await page.waitForFunction(() => document.querySelectorAll('.judge-line').length >= 1, null, { timeout: ms(120000) });
  const textJudge = await page.evaluate(() => document.querySelector('.judge-line').textContent);
  check('문자 페이즈에 심판 해설이 흐른다', textJudge.includes('호감'), textJudge.slice(0, 60));
  check('판정 줄에 계산 근거가 노출된다', /판정 [+-]?\d+ × 분위기/.test(textJudge), textJudge.slice(-40));
  check('판정 줄에 등급 이름이 표시된다',
    await page.locator('.judge-line .tag.tier').count() >= 1);
  await page.screenshot({ path: `${SHOTS}/7-texting.png`, fullPage: true });

  console.log('   ...대면 페이즈 대기');
  // 빠른 모드에서는 이미 대면(또는 결과)까지 지나가 있을 수 있다. 어느 쪽이든 통과시킨다.
  await page.waitForFunction(() =>
    document.body.classList.contains('phase-talk')
    || !document.querySelector('#screen-result').classList.contains('hidden'),
  null, { timeout: ms(400000) });
  await page.waitForFunction(() =>
    document.querySelectorAll('.judge-line').length >= 1
    || !document.querySelector('#screen-result').classList.contains('hidden'),
  null, { timeout: ms(200000) });
  const judged = await page.locator('.judge-line').count();
  check('대면 페이즈에도 심판 해설이 새로 쌓인다', judged >= 1, `${judged}줄`);
  const meters = await page.evaluate(() => ({
    love: +document.querySelector('#meter-love-num').textContent,
    mood: +document.querySelector('#meter-mood-num').textContent,
    loveW: document.querySelector('#meter-love-fill').style.width,
    thrLeft: document.querySelector('#meter-threshold').style.left,
    vibe: document.querySelector('#vibe-text').textContent,
    intel: document.querySelector('#intel-list').textContent,
  }));
  check('게이지 바가 수치와 함께 갱신된다',
    meters.loveW === meters.love + '%' && meters.thrLeft !== '', JSON.stringify({ ...meters, vibe: undefined, intel: undefined }));
  check('공기가 판정에 따라 갱신된다', /공기 갱신|앉자마자|커피|컵/.test(meters.vibe) || LIVE, meters.vibe.slice(0, 40));

  // 계기판이 숨기고 있던 것들
  const gauges = await page.evaluate(() => ({
    sat: document.querySelector('#hud-sat').textContent,
    turns: document.querySelector('#hud-turns').textContent,
    reach: document.querySelector('#vibe-reach').textContent,
    reachCls: document.querySelector('#vibe-bar').className,
    reads: window.__game.state.engine.snapshot().reads,
    intelCount: document.querySelector('#intel-count').textContent,
    secretTotal: window.__game.state.engine.snapshot().secretTotal,
    secretLeft: window.__game.state.engine.snapshot().secretLeft,
  }));
  check('호감 포화 계수가 계기판에 뜬다', /×[0-9.]+/.test(gauges.sat), gauges.sat);
  check('남은 턴이 계기판에 뜬다', /\d+\/\d+/.test(gauges.turns), gauges.turns);
  check('미확인 잔여 건수가 뜬다', /미확인 \d+건/.test(gauges.intelCount), gauges.intelCount);
  // 라이브에서 잡힌 버그: 계기판이 "미확인 0건"인데 사후 보고는 "비밀 1/3"이었다.
  check('계기판의 미확인 건수가 실제 감춘 취향 수를 넘지 않는다',
    +gauges.intelCount.match(/미확인 (\d+)건/)[1] <= gauges.secretTotal,
    `${gauges.intelCount} / 전체 ${gauges.secretTotal}`);
  check('공기가 의뢰인에게 닿는지가 표시된다',
    gauges.reach.length > 0 && gauges.reachCls.includes('reach-'),
    `${gauges.reads} → "${gauges.reach}"`);
  check('공기를 못 읽는 의뢰인이면 전달 안 됨으로 표시된다',
    gauges.reads !== 'none' || gauges.reach.includes('안 됨'), `${gauges.reads}/${gauges.reach}`);

  // 문자 페이즈 판정이 대면 중에도 남아 있어야 뭘 잘못했는지 되짚을 수 있다
  const feedKept = await page.locator('.judge-sep').count();
  check('페이즈가 바뀌어도 판정 기록이 구분선과 함께 남는다', feedKept >= 1, `${feedKept}개`);
  await checkContrast('대면 공작 화면');
  await page.screenshot({ path: `${SHOTS}/8-talking.png`, fullPage: true });

  console.log('   ...결과 대기');
  await page.waitForSelector('#screen-result:not(.hidden)', { timeout: ms(600000) });
  await page.waitForFunction(() => !document.querySelector('#btn-restart').classList.contains('hidden'), null, { timeout: ms(300000) });

  const result = await page.evaluate(() => {
    const r = window.__game.state.result;
    return {
      love: r.verdict.love, mood: r.verdict.mood, grade: r.verdict.grade, accepted: r.verdict.accepted,
      threshold: r.difficulty.threshold, turns: r.state.history.length,
      tiers: r.state.history.map(h => h.tier),
      revealed: r.state.revealed.length, secretTotal: r.couple.target.hiddenPrefs.length,
      surfaced: r.debrief.surfaced.length, missed: r.debrief.missed.length, radio: r.state.radioUsed,
      agent: r.agent?.name,
      letter: (document.querySelector('#result-letter').textContent || '').length,
      stamp: document.querySelector('#result-stamp').textContent,
      mvp: document.querySelector('#result-mvp').textContent,
      debriefRows: document.querySelectorAll('.turn-table tr').length,
      prefRows: document.querySelectorAll('#debrief-prefs li').length,
      targetWant: r.couple.target.flaw.want,
      flawReveal: document.querySelector('#debrief-flaw')?.textContent || '',
      usage: window.__game.llm.usage,
      mock: window.__mock ? { calls: window.__mock.calls.length, maxInFlight: window.__mock.maxInFlight } : null,
    };
  });

  check('전 턴이 판정됐다 (첫인상 1 + 문자 4 + 대면 5 = 10)', result.turns === 10, `${result.turns}턴`);
  check('심판 등급이 한 종류로 몰리지 않았다', new Set(result.tiers).size >= 2, result.tiers.join(','));
  check('구 등급명이 남아 있지 않다',
    !result.tiers.some(t => ['critical', 'hit', 'ok', 'empty', 'backfire', 'redline'].includes(t)), result.tiers.join(','));
  check('결과 편지가 타이핑까지 끝났다', result.letter > 60, `${result.letter}자`);
  check('결정적 순간(MVP)이 표시된다', result.mvp.length > 10);
  check('디브리핑 원장이 턴 수와 일치한다', result.debriefRows === result.turns + 1, `${result.debriefRows}행`);
  check('상대의 실제 속마음이 종료 후 전면 공개된다',
    result.prefRows >= result.secretTotal, `${result.prefRows}줄`);
  check('계기판의 미확인 건수와 사후 보고의 비밀 집계가 일치한다',
    result.missed === result.secretTotal - result.surfaced,
    `계기판 미확인 ${result.missed} · 보고 ${result.surfaced}/${result.secretTotal}`);
  // 작전 중엔 감췄던 상대 결함을 사후에 깐다. 안 그러면 재착수가 그냥 재시도다.
  check('종료 후 상대 심리 감정이 기밀 해제된다',
    result.flawReveal.includes(result.targetWant), result.flawReveal.slice(0, 50));
  check('요원 정보가 결과까지 따라간다', result.agent === AGENT_NAME || LIVE, result.agent);
  if (result.mock) {
    check('판정과 타겟 응답이 동시에 발사됐다 (턴당 왕복 2회)', result.mock.maxInFlight >= 2, `동시 최대 ${result.mock.maxInFlight}`);
    // 인증1 + 스타일링1 + 취조실1 + 정문1 + 발언9 + 응답9 + 판정10 + 상황1 + 편지1 = 34 (브리핑 호출은 없다)
    check('총 LLM 호출이 예상 범위다', result.mock.calls >= 31 && result.mock.calls <= 37, `${result.mock.calls}콜`);
  } else {
    check('프롬프트 캐시가 실제로 적중했다', result.usage.cacheRead > 5000, `${result.usage.cacheRead}tok 재사용`);
  }
  check('페이지 런타임 에러 없음', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  console.log(`\n  📊 ${result.stamp} · 등급 ${result.grade} · 호감 ${result.love}/${result.threshold} · 분위기 ${result.mood}` +
    ` · 발견 ${result.revealed} · 비밀 ${result.surfaced}/${result.secretTotal} · 무전 ${result.radio}`);
  console.log(`  🧾 등급: ${result.tiers.join(' ')}`);
  if (LIVE) console.log(`  💰 ${result.usage.calls}콜 · $${result.usage.cost.toFixed(3)} · 캐시 ${result.usage.cacheRead.toLocaleString()}tok`);
  await checkContrast('결과 화면');
  await page.screenshot({ path: `${SHOTS}/9-result.png`, fullPage: true });

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
