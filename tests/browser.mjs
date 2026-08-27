// browser.mjs — 실제 브라우저에서 게임을 끝까지 돌리는 E2E.
// 구조도의 다섯 칸(S → A → B코칭 → B대화 → C)을 순서대로 밟으며,
// three.js 렌더링 · 썸네일 전량 · 두 게이지 · 판정 원장 · 후일담까지 확인한다.
//
//   node tests/browser.mjs                        기본: 가짜 LLM 모드 (API 키·크레딧 불필요, 결정적)
//   ANTHROPIC_API_KEY=sk-... node tests/browser.mjs --live    실제 API로 (크레딧 소모)
//   추가 옵션: --couple=os-war --shots=/tmp/shots --headed --model=claude-sonnet-5
//
// 가짜 LLM 모드는 window.__game.llm.call을 페이지 안에서 바꿔치기한다.
// DOM·CSS·three.js·게임 흐름은 전부 진짜로 돌아가고 LLM만 결정적으로 대체된다.

import http from 'node:http';
import { createRequire } from 'node:module';
import { resolveTestModel, resolveTestKey } from './test-model.mjs';
import { POINTS } from '../js/points.js';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2)
  .filter(a => a.startsWith('--'))
  .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || 'true']; }));

const LIVE = args.live === 'true';
const KEY = LIVE ? resolveTestKey() : 'sk-ant-fake-key-for-mock-mode';
const MODEL = resolveTestModel(args.model, process.argv, KEY);
if (LIVE && !KEY) { console.error('--live 모드인데 API 키가 없다'); process.exit(1); }

const ROOT = path.resolve(import.meta.dirname, '..');
const SHOTS = args.shots || '/tmp/claude-0/shots';
const COUPLE = args.couple || 'os-war';
const AGENT_NAME = '박큐피드';
const RADIO = '무전표식 — 하던 말 끊고 지금 당장 상대 신발부터 칭찬해라';
const PORT = 8199;
fs.mkdirSync(SHOTS, { recursive: true });

// playwright는 이 저장소의 의존성이 아니다 (게임 자체는 빌드 없는 정적 사이트다).
const chromium = (() => {
  const req = createRequire(import.meta.url);
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
const T = LIVE ? 1 : 0.12;
const ms = n => Math.max(4000, Math.round(n * T));

// 페이지 안에서 실행될 가짜 LLM. 라벨로 분기해 결정적인 값을 돌려준다.
// 보내는 프롬프트는 전부 기록해서, 하이어아키가 실제 화면에서도 지켜지는지 확인한다.
function installMockLlm() {
  const llm = window.__game.llm;
  window.__mock = { calls: [] };
  window.__mockLatency = 120;
  // 판정을 한쪽으로 몰지 않게 순환시킨다 (무드/러브 각각)
  const MOOD = ['up', 'same', 'same', 'down', 'same', 'up', 'same', 'same', 'same'];
  const LOVE = ['same', 'up', 'same', 'same', 'up', 'same', 'same', 'up', 'same'];
  let judged = 0, beat = 0;
  llm.call = async ({ label, system, messages, schema }) => {
    window.__mock.calls.push({
      label, system: system || '', schema: !!schema,
      // system 만 보면 판정·후일담이 user 메시지로 나르는 대화 전문을 못 본다.
      body: (system || '') + JSON.stringify(messages || []),
      // 무전은 system이 아니라 messages에 실려야 한다. 그걸 가리려면 둘을 따로 들어야 한다.
      messages: JSON.parse(JSON.stringify(messages || [])),
    });
    await new Promise(r => setTimeout(r, window.__mockLatency ?? 120));
    if (label === '본부 인증') return '이상무';
    if (label.startsWith('A-1')) {
      return {
        look: '형광 주황으로 물들인 머리에 새빨간 턱시도, 카우보이 부츠, 선글라스. 오른손에 폭탄을 들고 머리 위에 금색 고리가 돈다.',
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
      };
    }
    if (label.startsWith('A-2')) {
      return { personality: '지고는 못 사는 성질이 끝까지 올라와 있다. 벌금 800만원이 머릿속에서 떠나지 않는다.' };
    }
    if (label.includes('판정')) {
      const i = judged++;
      return { mood: MOOD[i % MOOD.length], love: LOVE[i % LOVE.length] };
    }
    if (label.includes('대화 생성')) {
      const n = ++beat;
      return {
        lines: [
          { who: 'client', text: `${n}구간 · 고객이 먼저 말을 건다. 그 부츠 얘기부터.` },
          { who: 'target', text: '…그래서요? (컵을 고쳐 잡는다)' },
          { who: 'client', text: '아니 그게 아니라, 제 말은요.' },
          { who: 'target', text: 'ㅇㅇ' },
          { who: 'client', text: '지금 웃으셨죠. 봤습니다.' },
          { who: 'target', text: '안 웃었는데요.' },
        ],
      };
    }
    if (label.startsWith('R ·')) {
      return { reaction: '…진짜로 이걸 하라고요? (의자를 반 뼘 뒤로 민다) 합니다. 합니다만 이건 아니라고 봅니다.', face: 'cringe' };
    }
    if (label.includes('후일담')) {
      return {
        success: true,
        epilogue: '둘은 그날 밤 야적장에서 새벽까지 녹슨 것들 얘기만 했다. 3주 뒤 최분리는 신고 41건을 전부 취하했고, 주워담은 그 취하서를 액자에 넣어 전시했다. 관람객들은 그게 작품인 줄 알았다.',
      };
    }
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
  if (/Failed to load resource/.test(t)) return;   // 외부 폰트 차단은 망 상태지 버그가 아니다
  pageErrors.push('console: ' + t);
});
page.on('requestfailed', r => {
  const u = r.url();
  if (u.startsWith(`http://127.0.0.1:${PORT}`)) pageErrors.push(`요청 실패(로컬): ${u}`);
});

// 프록시 뒤에서 --live를 돌리기 위한 다리. 게임은 브라우저에서 업자에게 직접 fetch한다.
if (LIVE) {
  const PASS = ['content-type', 'x-api-key', 'authorization', 'anthropic-version', 'anthropic-dangerous-direct-browser-access'];
  const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
  };
  for (const host of ['https://api.anthropic.com/**', 'https://api.openai.com/**', 'https://openrouter.ai/**']) {
    await page.route(host, async (route) => {
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
}

const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });

try {
  console.log(`\n🌐 부팅 (${LIVE ? '실제 API' : '가짜 LLM'} 모드)`);
  await page.goto(`http://127.0.0.1:${PORT}/?pace=${args.pace || 'instant'}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game && window.__game.COUPLES);
  check('모듈이 로드되고 대장이 노출된다', true);

  const coupleCount = await page.evaluate(() => window.__game.COUPLES.length);
  check('상설 의뢰가 전부 실려 있다', coupleCount >= 40, `${coupleCount}건`);

  if (!LIVE) await page.evaluate(installMockLlm);
  await page.fill('#agent-name', AGENT_NAME);
  await page.fill('#key-input', KEY);
  if (LIVE) await page.evaluate(m => { window.__game.llm.model = m; }, MODEL);
  check('키 접두사로 업자가 판별된다', /회선 판별/.test(await page.textContent('#key-provider')));
  await shot('01-boot');

  await page.click('#btn-boot');
  await page.waitForSelector('#screen-intro:not(.hidden)', { timeout: ms(90000) });
  check('인증 통과 후 교육 화면으로 넘어간다', true);

  // ── 신입 교육 ──────────────────────────────────────────
  console.log('\n📚 신입 교육');
  const slideCount = await page.evaluate(() => document.querySelectorAll('#intro-dots .dot').length);
  check('슬라이드가 다섯 장이다', slideCount === 5, `${slideCount}장`);
  for (let i = 0; i < slideCount; i++) {
    const line = await page.textContent('.slide-line');
    check(`슬라이드 ${i + 1}에 문장이 있다`, (line || '').length > 12);
    const svg = await page.evaluate(() => !!document.querySelector('.slide-art svg'));
    check(`슬라이드 ${i + 1}에 삽화가 있다`, svg);
    if (i < slideCount - 1) await page.click('#btn-intro-next');
  }
  await shot('02-intro');
  await page.click('#btn-intro-next');

  // ── S. 스크리닝 ────────────────────────────────────────
  console.log('\n🗂  S · 스크리닝');
  await page.waitForSelector('#screen-roster:not(.hidden)', { timeout: ms(20000) });
  const cards = await page.evaluate(() => document.querySelectorAll('.couple-card').length);
  check('카드가 대장 건수만큼 그려진다', cards === coupleCount, `${cards}/${coupleCount}`);
  const thumbs = await page.evaluate(() =>
    [...document.querySelectorAll('.cc-pair img')].filter(i => (i.src || '').startsWith('data:image')).length);
  check('썸네일이 전부 실제로 렌더된다', thumbs === cards * 2, `${thumbs}/${cards * 2}`);
  await shot('03-roster');

  // 의뢰서(스크리닝 상세)에 여덟 항목이 전부 있는가
  await page.evaluate((id) => {
    const cards = [...document.querySelectorAll('.couple-card')];
    const t = window.__game.COUPLES.find(c => c.id === id);
    const card = cards.find(el => el.textContent.includes(t.client.name));
    card.querySelector('.cc-detail').click();
  }, COUPLE);
  await page.waitForSelector('#modal-dossier:not(.hidden)', { timeout: ms(8000) });
  const dossier = await page.textContent('#dossier-box');
  for (const label of ['고객 외모', '고객 성격', '고객 성장환경', '고객이 반한 이유',
    '타겟 외모', '타겟 성격', '타겟 성장환경', '타겟 취향']) {
    check(`스크리닝에 「${label}」이 노출된다`, dossier.includes(label));
  }
  check('감춰둔 항목이 없다고 못박는다', /노출 정보의 전부/.test(dossier));
  await shot('04-dossier');
  await page.click('#dossier-take');

  // ── A-1. 미용실 · 스타일링 ─────────────────────────────
  console.log('\n✂️  A-1 · 미용실 (스타일링)');
  await page.waitForSelector('#screen-styling:not(.hidden)', { timeout: ms(10000) });
  const specBefore = await page.evaluate(() => structuredClone(window.__game.state.clientSpec));
  const STYLE = '형광 주황 염색, 새빨간 턱시도, 등에 폭탄, 머리 위에 도는 금색 고리';
  await page.fill('#styling-input', STYLE);
  await page.click('#btn-styling');
  await page.waitForFunction(() => window.__game.state.styled.look !== null, null, { timeout: ms(120000) });
  await page.waitForSelector('#styling-react .react-line', { timeout: ms(120000) });
  const salonReact = await page.textContent('#styling-react');
  check('주문을 내리면 고객이 그 자리에서 대꾸한다', salonReact.trim().length > 8);
  const specAfter = await page.evaluate(() => structuredClone(window.__game.state.clientSpec));
  check('미용실에서 외모가 바뀐다', JSON.stringify(specBefore) !== JSON.stringify(specAfter));
  check('미용실은 성격을 건드리지 않는다',
    await page.evaluate(() => window.__game.state.styled.personality === null));
  check('수정된 고객 외모가 화면에 뜬다',
    (await page.textContent('#styling-result')).includes('수정된 고객 외모'));
  if (!LIVE) {
    const props = await page.evaluate(() => window.__game.state.clientSpec.props.length);
    check('자유 도형이 붙는다 (폭탄·후광)', props === 2, `${props}개`);
  }
  await shot('05-salon');

  // 주문을 **지우면** 그 칸은 테이블 값으로 돌아가야 한다 — 예전 시공물이 남으면
  // 지운 적 없는 외모가 대화 프롬프트로 실려 나간다.
  const a1n = () => page.evaluate(() => window.__mock.calls.filter(c => c.label.startsWith('A-1')).length);
  const a1Before = await a1n();
  await page.fill('#styling-input', '');
  await page.click('#btn-styling-next');
  await page.waitForSelector('#screen-motivation:not(.hidden)', { timeout: ms(10000) });
  check('주문을 지우면 외모가 테이블 값으로 돌아간다',
    await page.evaluate(() => window.__game.state.styled.look === null));
  check('되돌릴 때는 부르지 않는다', await a1n() === a1Before);
  check('아바타도 원래 꼴로 돌아온다',
    JSON.stringify(specBefore) === await page.evaluate(() => JSON.stringify(window.__game.state.clientSpec)));

  // 다시 넣고, 같은 주문으로 한 번 더 지나가 본다 — 두 번 부르면 안 된다.
  await page.click('#btn-motivation-back');
  await page.waitForSelector('#screen-styling:not(.hidden)', { timeout: ms(10000) });
  await page.fill('#styling-input', STYLE);
  await page.click('#btn-styling-next');
  await page.waitForFunction(() => window.__game.state.styled.look !== null, null, { timeout: ms(120000) });
  await page.waitForSelector('#screen-motivation:not(.hidden)', { timeout: ms(10000) });
  const a1Refit = await a1n();
  await page.click('#btn-motivation-back');
  await page.waitForSelector('#screen-styling:not(.hidden)', { timeout: ms(10000) });
  await page.click('#btn-styling-next');
  await page.waitForSelector('#screen-motivation:not(.hidden)', { timeout: ms(10000) });
  check('같은 주문에는 다시 부르지 않는다', await a1n() === a1Refit, `${await a1n()} / ${a1Refit}`);

  // ── A-2. 취조실 · 동기부여 ─────────────────────────────
  console.log('\n🔦 A-2 · 취조실 (동기부여)');
  await page.fill('#motivation-input', '오늘 안 되면 벌금 800만원이라고 못박아라. 지고는 못 사는 성질을 끝까지 끌어올려라');
  const specAtInterro = await page.evaluate(() => structuredClone(window.__game.state.clientSpec));
  await page.click('#btn-motivation');
  await page.waitForFunction(() => window.__game.state.styled.personality !== null, null, { timeout: ms(120000) });
  await page.waitForSelector('#motivation-react .react-line', { timeout: ms(120000) });
  check('취조실에서도 고객이 대꾸한다', (await page.textContent('#motivation-react')).trim().length > 8);
  check('취조실은 외모를 건드리지 않는다',
    JSON.stringify(specAtInterro) === await page.evaluate(() => JSON.stringify(window.__game.state.clientSpec)));
  const styled = await page.evaluate(() => window.__game.state.styled);
  check('수정된 고객 외모가 나온다', (styled.look || '').length > 10);
  check('수정된 고객 성격이 나온다', (styled.personality || '').length > 10);
  check('수정된 고객 성격이 화면에 뜬다',
    (await page.textContent('#motivation-result')).includes('수정된 고객 성격'));
  await shot('06-interro');
  await page.click('#btn-motivation-next');

  // ── B 준비. 코칭 ───────────────────────────────────────
  console.log('\n🎧 B · 코칭 하달');
  await page.waitForSelector('#screen-coaching:not(.hidden)', { timeout: ms(10000) });
  const brief = await page.textContent('#coaching-brief');
  check('타겟 네 항목이 곁에 붙어 있다',
    ['타겟 외모', '타겟 성격', '타겟 성장환경', '타겟 취향'].every(l => brief.includes(l)));
  check('고객에게 자동으로 안 넘어간다고 못박는다', /자동으로 넘어가지 않는다/.test(brief));
  const COACH = '상대 취향부터 노려라. 네 규정 얘기는 하지 마라. 만날 곳은 새벽 폐자재 야적장으로 잡아라';
  await page.fill('#coaching-input', COACH);
  await page.waitForTimeout(60);
  const inject = await page.textContent('#coaching-inject');
  check('코칭이 프롬프트에 어떻게 박히는지 그대로 보여준다', inject.includes(COACH) && inject.includes('본부 코칭'));
  await page.click('#btn-coaching');
  await page.waitForSelector('#coaching-react .react-line', { timeout: ms(120000) });
  check('코칭에도 고객이 대꾸한다', (await page.textContent('#coaching-react')).trim().length > 8);
  await shot('07-coaching');
  // 무전을 눌러 볼 틈이 있어야 한다 — 가짜 LLM을 잠깐 느리게 돌린다
  if (!LIVE) await page.evaluate(() => { window.__mockLatency = 500; });
  await page.click('#btn-start-op');

  // ── B. 텍스팅 & 토킹 ───────────────────────────────────
  console.log('\n💬 B · 텍스팅 & 토킹');
  await page.waitForSelector('#screen-chat:not(.hidden)', { timeout: ms(15000) });
  check('대화 화면으로 넘어간다', true);
  await page.waitForFunction(() => document.querySelectorAll('#chat-window .bubble').length >= 6,
    null, { timeout: ms(180000) });
  const title = await page.textContent('#chat-phase-label');
  check('텍스팅 페이즈로 시작한다', /텍스팅/.test(title), title);
  await page.waitForFunction(() => document.querySelectorAll('#verdict-log li').length >= 1,
    null, { timeout: ms(180000) });
  const firstVerdict = await page.textContent('#verdict-log li');
  check('판정 원장에 증감 여부만 뜬다', /무드 [▲▼─]/.test(firstVerdict) && /러브 [▲▼─]/.test(firstVerdict), firstVerdict);
  check('판정에 점수나 해설이 안 붙는다', !/[+-]\d/.test(firstVerdict), firstVerdict);
  await shot('07-texting');

  // ── 무전 개입 — 페이즈마다 한 번, 누르면 대화가 선다 ──
  console.log('\n📻 B · 무전 개입');
  // 구간 중간에서 눌러야 대화가 실제로 잘린다 — 그 순간만 사람 속도로 되돌린다.
  // 구간은 6줄이므로, 2줄까지 나온 자리에서 누르면 뒤가 남아 있는 게 확실하다.
  await page.evaluate(() => window.__game.pace.setPace('slow'));
  await page.waitForFunction(() => {
    const e = window.__game.state.engine;
    return e && e.transcript.length % 6 === 2 && e.canRadio();
  }, null, { timeout: ms(120000) });
  const radioLabel = await page.textContent('#btn-radio');
  check('무전 버튼에 이 페이즈의 배급이 뜬다', /텍스팅 1회/.test(radioLabel), radioLabel);
  await page.click('#btn-radio');
  await page.waitForSelector('#radio-panel:not(.hidden)', { timeout: ms(60000) });
  check('누르면 무전 회선이 열린다', true);

  // 회선이 열려 있는 동안 대화는 서 있어야 한다
  const heldAt = await page.evaluate(() => document.querySelectorAll('#chat-window .bubble').length);
  await page.waitForTimeout(ms(2500));
  const heldStill = await page.evaluate(() => document.querySelectorAll('#chat-window .bubble').length);
  check('회선이 열린 동안 대화가 멈춰 있다', heldAt === heldStill, `${heldAt} → ${heldStill}`);

  await page.fill('#radio-input', RADIO);
  await page.waitForTimeout(60);
  const radioInject = await page.textContent('#radio-inject');
  check('무전이 프롬프트에 어떻게 박히는지 그대로 보여준다',
    radioInject.includes(RADIO) && radioInject.includes('본부 무전'));
  await shot('07b-radio');
  await page.click('#btn-radio-send');
  await page.waitForSelector('#radio-panel', { state: 'hidden', timeout: ms(30000) });
  check('송출하면 회선이 닫히고 대화가 다시 굴러간다', true);
  check('무전이 나간 자리가 화면에 남는다',
    await page.evaluate(() => !!document.querySelector('#chat-window .bubble.radio-cut')));
  const spentLabel = await page.textContent('#btn-radio');
  check('배급을 쓰면 그 페이즈에서는 다시 못 쓴다',
    /소진/.test(spentLabel) && await page.evaluate(() => document.querySelector('#btn-radio').disabled),
    spentLabel);
  const cutBeat = await page.evaluate(() => {
    const h = window.__game.state.engine.radioLog[0];
    return { beat: h?.beat ?? 0, said: window.__game.state.engine.transcript.length };
  });
  check('구간 중간에서 대화가 잘렸다 — 뒤에 있던 대사는 없던 것이 된다',
    cutBeat.said % 6 !== 0, `${cutBeat.said}줄`);
  await page.evaluate(() => window.__game.pace.setPace('instant'));
  if (!LIVE) await page.evaluate(() => { window.__mockLatency = 60; });

  // 토킹 페이즈로 넘어가는가
  await page.waitForFunction(() => /토킹/.test(document.querySelector('#chat-phase-label').textContent),
    null, { timeout: ms(400000) });
  check('토킹 페이즈로 넘어간다', true);
  check('페이즈 경계가 기록에 남는다',
    await page.evaluate(() => !!document.querySelector('#chat-window .judge-sep')));
  const talkRadio = await page.evaluate(() => window.__game.state.engine.radioState());
  check('토킹에는 배급이 따로 한 번 더 있다', talkRadio.left === 1, `${talkRadio.left}회`);
  await shot('08-talking');

  // ── C. 후일담 ──────────────────────────────────────────
  console.log('\n📮 C · 후일담');
  await page.waitForSelector('#screen-result:not(.hidden)', { timeout: ms(900000) });
  await page.waitForFunction(() => !document.querySelector('#btn-restart').classList.contains('hidden'),
    null, { timeout: ms(300000) });
  const r = await page.evaluate(() => window.__game.state.result);
  check(`러브 포인트가 0~${POINTS.loveMax} 안에 있다`, r.love >= 0 && r.love <= POINTS.loveMax, `러브 ${r.love}`);
  check(`무드 포인트가 0~${POINTS.moodMax} 안에 있다`, r.mood >= 0 && r.mood <= POINTS.moodMax, `무드 ${r.mood}`);
  check('C에 넘어간 러브 눈금은 0~100이다', r.reading >= 0 && r.reading <= 100, `환산 ${r.reading}`);
  check('성사 여부가 불리언으로 확정된다', typeof r.success === 'boolean', String(r.success));
  check('후일담 텍스트가 왔다', (r.epilogue || '').length > 20);
  const epi = await page.textContent('#result-epilogue');
  check('후일담이 화면에 찍힌다', (epi || '').length > 20);
  const stampText = await page.textContent('#result-stamp');
  check('도장이 성사/결렬/파탄 중 하나다', ['성사', '결렬', '자리 파탄'].includes(stampText.trim()), stampText);
  const ledger = await page.evaluate(() => document.querySelectorAll('#debrief-turns tr').length);
  check('구간 원장이 판정 수만큼 있다', ledger === r.points.history.length + 1, `${ledger - 1}구간`);
  const transcript = await page.textContent('#debrief-transcript');
  check('대화 전문이 열람된다', (transcript || '').length > 50);
  check('무전은 대화 기록에 안 남는다 (심판도 기록관도 못 본 문장이다)', !transcript.includes(RADIO));
  const radioLedger = await page.textContent('#debrief-radio');
  check('무전 원장은 요원 몫으로 따로 남는다', radioLedger.includes(RADIO), radioLedger.slice(0, 40));
  await shot('09-result');

  // 호출 감사 — 화면을 통해 실제로 나간 프롬프트가 하이어아키를 지키는가
  if (!LIVE) {
    const calls = await page.evaluate(() => window.__mock.calls);
    const gen = calls.filter(c => c.label.includes('대화 생성'));
    const judge = calls.filter(c => c.label.includes('판정'));
    const epilogue = calls.filter(c => c.label.includes('후일담'));
    const rejudge = judge.filter(c => /재판정/.test(c.label)).length;
    check('생성과 판정이 구간마다 짝을 이룬다', gen.length === judge.length - rejudge,
      `${gen.length} / ${judge.length - rejudge} (+재판정 ${rejudge})`);
    check('후일담은 딱 한 번 불린다', epilogue.length === 1, `${epilogue.length}회`);
    // system 뿐 아니라 user 메시지까지 합쳐서 본다 — 대화 전문은 그쪽으로 간다.
    check('코칭은 생성 프롬프트에만 실린다',
      gen.every(c => c.system.includes(COACH)) && judge.every(c => !c.body.includes(COACH)));
    check('판정은 코칭도 고객 성격도 못 본다',
      judge.every(c => !c.body.includes(COACH) && !c.body.includes(styled.personality)));
    check('판정은 스타일링된 고객 외모를 본다', judge.every(c => c.system.includes(styled.look)));
    check('후일담은 동기부여된 고객 성격을 받는다', epilogue[0].system.includes(styled.personality));
    check('후일담은 취향도 외모도 안 받는다',
      !epilogue[0].body.includes(styled.look));
    const sysSet = new Set(gen.map(c => c.system));
    check('생성 system이 판 내내 동일하다 (캐시가 붙는 자리)', sysSet.size === 1, `${sysSet.size}종`);

    // 무전 — 코칭과 같은 자리로 가되, system이 아니라 messages에 실린다
    const inMsgs = c => JSON.stringify(c.messages || []).includes(RADIO);
    const carried = gen.filter(inMsgs);
    check('무전은 생성 프롬프트에만 실린다', carried.length > 0 && !gen.some(c => c.system.includes(RADIO)),
      `${carried.length}/${gen.length}회`);
    check('무전은 눌린 뒤의 호출부터 실린다', gen.indexOf(carried[0]) > 0, gen.indexOf(carried[0]) + '번째');
    check('무전은 판정에 안 실린다 — 요원이 쓴 글은 채점되지 않는다',
      !judge.some(c => inMsgs(c) || c.system.includes(RADIO)));
    check('무전은 후일담에도 안 실린다', !inMsgs(epilogue[0]) && !epilogue[0].system.includes(RADIO));
    check('무전으로 잘린 구간은 오간 데까지만 다시 판정된다', rejudge === 1, `${rejudge}회`);
    check('재판정도 무전을 못 본다', !judge.filter(c => /재판정/.test(c.label)).some(inMsgs));

    const labels = new Set(calls.map(c => c.label.replace(/\d+/g, 'N')));
    check('구조도에 없는 호출이 없다',
      [...labels].every(l => /본부 인증|A-N ·|R ·|대화 생성|판정|후일담/.test(l)), [...labels].join(' / '));
    const react = calls.filter(c => c.label.startsWith('R ·'));
    check('주문 셋마다 반응을 한 번씩 물어본다', react.length === 3, `${react.length}회`);
    const tgt = await page.evaluate(() => {
      const t = window.__game.state.couple.target;
      return [t.name, t.look[0], t.personality[0], t.upbringing[0], t.taste[0]];
    });
    check('반응 프롬프트는 타겟을 안 본다 (이름도 시트 네 항목도)',
      react.every(c => tgt.every(v => !c.body.includes(v))));
    const a1 = calls.filter(c => c.label.startsWith('A-1'));
    const a2 = calls.filter(c => c.label.startsWith('A-2'));
    // 미용실은 주문 두 벌(원본 · 지웠다 되넣은 것)에 두 번. 취조실은 한 벌에 한 번.
    check('시공은 주문이 바뀔 때만 돈다', a1.length === 2 && a2.length === 1, `${a1.length} / ${a2.length}`);
    const table = await page.evaluate(() => ({
      look: window.__game.state.couple.client.look[0],
      personality: window.__game.state.couple.client.personality[0],
    }));
    check('미용실 프롬프트에 성격이 없다', !a1[0].body.includes(table.personality));
    check('취조실 프롬프트에 외모도 조형도 없다',
      !a2[0].body.includes(table.look) && !/AVATAR SPEC/.test(a2[0].body));
    const reactLine = (await page.textContent('#coaching-react')).replace(/\s+/g, ' ').trim().slice(-24);
    check('고객의 대꾸는 어느 프롬프트에도 실리지 않는다 (system도 user도)',
      [...gen, ...judge, ...epilogue].every(c => !c.body.includes(reactLine)));
  }

  // 재착수
  await page.click('#btn-restart');
  await page.waitForSelector('#screen-roster:not(.hidden)', { timeout: ms(10000) });
  check('차기 의뢰로 돌아온다', true);
  check('성사한 조합에 도장이 찍힌다',
    !r.success || await page.evaluate(() => document.querySelectorAll('.cleared-stamp').length > 0));

  check('페이지 오류 없음', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} catch (e) {
  console.error('\n💥 진행 중 예외:', e.message);
  fail.push('예외: ' + e.message);
  await shot('99-crash').catch(() => {});
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${'─'.repeat(50)}`);
if (fail.length) {
  console.log(`❌ 실패 ${fail.length}건`);
  for (const f of fail) console.log(`   · ${f}`);
  process.exit(1);
}
console.log('✅ 전 항목 통과');
console.log(`   스크린샷: ${SHOTS}`);
