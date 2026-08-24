// responsive.mjs — 모든 화면을 아이패드·폰·데스크톱 해상도에서 훑어 레이아웃 사고를 잡아낸다.
// API 키 불필요 (가짜 LLM). 화면마다 다음을 검사한다:
//   · 페이지 가로 스크롤 발생 (제일 큰 죄)
//   · 요소가 뷰포트 오른쪽 밖으로 삐져나감
//   · 요소 안에서 내용이 잘림 (overflow:hidden + 내용이 더 큼)
//   · 터치 타깃이 44px 미만
//   · 캔버스가 0픽셀이거나 종횡비가 무너짐
//   · 텍스트 명암비 (WCAG AA)
//
//   node tests/responsive.mjs [--shots=/tmp/resp] [--only=768x1024]

import http from 'node:http';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2)
  .filter(a => a.startsWith('--'))
  .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || 'true']; }));

const ROOT = path.resolve(import.meta.dirname, '..');
const SHOTS = args.shots || '';
const PORT = 8203;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const chromium = (() => {
  const req = createRequire(import.meta.url);
  const roots = ['/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules'];
  try { return req('playwright').chromium; } catch { /* 전역 설치 탐색 */ }
  for (const r of roots) {
    try { return req(req.resolve('playwright', { paths: [r] })).chromium; } catch { /* 다음 */ }
  }
  console.error('playwright를 찾을 수 없다.'); process.exit(2);
})();

// 실기기 기준 CSS 픽셀 뷰포트
const VIEWPORTS = [
  { name: '아이폰 SE',            w: 375, h: 667 },
  { name: '아이패드 미니 세로',     w: 744, h: 1133 },
  { name: '아이패드 9.7" 세로',    w: 768, h: 1024 },
  { name: '아이패드 9.7" 가로',    w: 1024, h: 768 },
  { name: '아이패드 Air 11" 세로', w: 820, h: 1180 },
  { name: '아이패드 Air 11" 가로', w: 1180, h: 820 },
  { name: '아이패드 Pro 12.9 세로', w: 1024, h: 1366 },
  { name: '아이패드 Pro 12.9 가로', w: 1366, h: 1024 },
  { name: '데스크톱',              w: 1500, h: 1000 },
].filter(v => !args.only || `${v.w}x${v.h}` === args.only);

const SCREENS = ['boot', 'intro', 'briefing', 'roster', 'salon', 'interro', 'gate', 'chat', 'result'];

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((rq, rs) => {
  const rel = decodeURIComponent(rq.url.split('?')[0]);   // ?pace= 같은 질의는 파일 경로가 아니다
  const f = path.join(ROOT, rel === '/' ? 'index.html' : rel);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404); return rs.end(); }
  rs.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(rs);
});

// ── 페이지 안에서 실행: 가짜 LLM ─────────────────────────
function mockLlm() {
  window.__game.llm.call = async ({ label }) => {
    await new Promise(r => setTimeout(r, 1));
    if (label === '본부 인증') return '이상무';
    if (label === '스타일링 시공') {
      return {
        spec: {
          skin: '#e8d0c0', hair: '#ff8a2b', hairStyle: 'spiky', top: '#dd1122', bottom: '#2a3a4a',
          shoes: '#7a5a2a', heightScale: 1.02, widthScale: 0.9, accessory: 'sunglasses',
          accessoryColor: '#111111', expression: 'chad', aura: 'fire', species: 'human',
          props: [
            { shape: 'sphere', color: '#1a1a1a', size: 0.35, at: 'handR', motion: 'bob', label: '폭탄' },
            { shape: 'torus', color: '#ffdd55', size: 0.4, at: 'crown', motion: 'yaw', label: '후광' },
          ],
        },
        outfitDesc: '형광 주황으로 물들인 머리에 새빨간 턱시도, 카우보이 부츠, 선글라스. 오른손에 폭탄을 들었다.',
        comment: '시공 완료. 책임은 안 진다.',
        clientReaction: '아니 정말 이러라고요? …뭐, 따르겠습니다만. 근데 이 폭탄은 진짜 터지는 건 아니죠?',
        clientFace: 'cringe',
      };
    }
    if (label === '취조실 반응') {
      return {
        reaction: '알겠습니다. 근데 그거 하면 제가 좀 이상해 보이지 않나요? …아니 하겠습니다. 하겠다고요.',
        face: 'cringe', note: '피조사자 항의 1회. 수용함. 조명 아래 발한 관측됨.',
      };
    }
    if (label === '정문 반응') {
      return {
        reaction: '…그 얘기를 어떻게 아셨어요. (문고리를 잡은 채로 한참 서 있다) 다녀오겠습니다.',
        face: 'shy', note: '동공 흔들림 관측. 사기 상승으로 판단. 출동 승인.',
      };
    }
    return '기타';
  };
}

// ── 페이지 안에서 실행: 대화/결과 화면에 실제와 같은 분량의 내용을 채운다 ──
function poseScreens() {
  const g = window.__game;
  const c = g.state.couple;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  // 대화 화면
  document.querySelector('#chat-phase-label').textContent = `작전 2단계 · 대면 공작 — 네오서울 무한스크롤 카페 「플러그 앤 플레이」`;
  document.querySelector('#vibe-text').textContent = '상대가 처음으로 정면을 봤다. 규정 얘기는 아직 안 끝났다.';
  const win = document.querySelector('#chat-window');
  win.innerHTML = '';
  const lines = [
    ['sys', `[네오서울 무한스크롤 카페] 오후 7시 04분. 벽 한 면이 통째로 구형 프린터 4천 대를 박아넣은 전시장이고, 손님이 USB를 꽂을 때마다 천장 조명이 부드러운 감속 곡선으로 내려앉는다.`],
    ['client', '현장에서 3초 만에 절 고른 분. 리누스 정입니다. 총기 분해 순서, 어떻게 되십니까.'],
    ['target', '…누구십니까. 번호 어디서 났습니까. 분해 순서는 규정상 안 알려드립니다.'],
    ['radio', '지금 상대가 뭔가 말하려다 삼킨 것 같다. 그거 뭐였냐고 물고 늘어져라.'],
    ['client', '냄새가, 뭡니까. 삼키지 마십시오. 좋아하는 냄새, 싫은 냄새. 떠오르는 기억이 있으십니까.'],
    ['target', '…저 냄새에 예민합니다. 특히 사람 머리 냄새. 현장에서 3초, 그거 사실 거리 재기 아니었습니다.'],
  ];
  for (const [who, text] of lines) {
    const d = document.createElement('div');
    d.className = `bubble ${who}`;
    const name = who === 'client' ? c.client.name : who === 'target' ? c.target.name : who === 'radio' ? '본부 무전' : '상황';
    d.innerHTML = `<span class="who">${esc(name)}</span><span class="say">${esc(text)}</span>`;
    win.appendChild(d);
  }
  // 재생 대기 표시도 자리를 차지한다 — 켜 둔 상태로 레이아웃을 본다
  document.querySelector('#chat-advance').classList.add('on');
  const feed = document.querySelector('#judge-feed');
  feed.innerHTML = '';
  for (const [cls, html] of [
    ['big', '<b>호감 +13.6</b> 방어선이 실제로 내려갔다. 규정 뒤에 숨던 사람이 처음으로 자기 얘기를 했다<span class="tag tier breakthrough">방어선 붕괴</span><span class="tag hit">새로 드러남: 현장에서 3초 센 건 거리 재기가 아니었다</span><span class="tag first">2합</span><span class="tag calc">원판정 +9</span>'],
    ['good', '<b>호감 +0</b> 맥락은 받았다. 상대도 싫지는 않은 눈치다<span class="tag tier nudge">조금 통함</span><span class="tag first">3합</span><span class="tag calc">원판정 +0</span>'],
    ['bad', '<b>호감 -8.2</b> 정색했다. 이 자리에서 할 얘기가 아니었다<span class="tag tier disaster">정색</span><span class="tag first">4합</span><span class="tag calc">원판정 -8</span>'],
  ]) {
    const d = document.createElement('div'); d.className = `judge-line ${cls}`; d.innerHTML = html; feed.appendChild(d);
  }
  const openPrefs = c.target.prefs.filter(p => p.open && !p.neg).map(p => p.t);
  const negPrefs = c.target.prefs.filter(p => p.open && p.neg).map(p => p.t);
  const hiddenPrefs = c.target.prefs.filter(p => !p.open).map(p => p.t);
  document.querySelector('#turn-badge').textContent = '대면 4/8턴';
  document.querySelector('#meter-love-num').textContent = '51';
  document.querySelector('#meter-love-fill').style.width = '51%';
  document.querySelector('#meter-threshold').style.left = '64%';
  document.querySelector('#hud-sat').textContent = '호감 포화 ×0.6';
  document.querySelector('#hud-turns').textContent = '남은 교환 4/8';
  document.querySelector('#hud-bout').textContent = '2합 판정 · 다음 합 3/5교환';
  document.querySelector('#hud-diff').textContent = `난이도 ${c.difficulty} · 성공선 64`;
  document.querySelector('#btn-intervene').textContent = '무전 개입 (잔여 2)';
  document.querySelector('#intel-count').textContent = '대화 중 2건 · 미확인 1건 남음';
  document.querySelector('#intel-list').innerHTML =
    openPrefs.map(p => `<li class="known">${esc(p)} <span class="dim">(사전 통보)</span></li>`).join('')
    + `<li class="found">현장에서 3초 센 건 거리 재기가 아니었다</li>`
    + `<li class="found">사람 머리 냄새에 이상하게 예민하다</li>`;
  document.querySelector('#redline-list').innerHTML = negPrefs.map(p => `<li class="mine">${esc(p)}</li>`).join('');

  // 결과 화면
  document.querySelector('#result-stamp').textContent = c.winWord;
  document.querySelector('#result-stamp').className = 'result-stamp ok';
  document.querySelector('#result-grade').textContent = '공작 등급: B';
  document.querySelector('#result-score').textContent = '호감 62/52 · 난이도 보통 · 결승선 연애';
  document.querySelector('#result-letter').textContent =
    '요원님. 저 해냈습니다. 아니, 저희가 해냈습니다.\n그 사람이 제 부츠를 보고 웃었을 때 저는 이미 이겼다고 생각했습니다.\n'
    + '17프레임을 세는 사람 앞에서 손이 떨렸던 걸 들켰지만, 그게 오히려 좋았다고 합니다.\n감사합니다. 정말로.';
  document.querySelector('#result-mvp').textContent = '승패를 가른 순간 — 3턴째 무전이 판을 갈랐다';
  document.querySelector('#result-epilogue').textContent = '— 에필로그: 둘은 듀얼 부팅 커플이 되었다.';
  document.querySelector('#debrief-summary').textContent = '호감 62/52 — 성공선을 10점 넘겼다.';
  document.querySelector('#debrief-list').innerHTML = [
    ['상대에 대해 알아낸 것', '3건', '현장에서 3초 센 건 거리 재기가 아니었다 · 사람 머리 냄새에 예민하다 · 규정을 방패로 쓴다'],
    ['상대가 감춰둔 이야기', '2 / 3건 화제에 오름', '일부는 나왔고 일부는 끝내 안 나왔다.'],
    ['상대가 식은 턴', '1턴', '1턴에서 상대가 물러섰다. 판이 뒤집힌 순간은 1회.'],
    ['무전 개입', '1 / 3회', '개입권이 남은 채로 끝났다.'],
    ['발언 성적', '호재 8 / 악재 2턴', '최고의 한마디는 3턴(호감 +14.6), 최악은 6턴(-0.5).'],
  ].map(([n, v, t]) => `<li class="ok"><b>${n}</b> <span class="dscore">${v}</span><br><span class="dim">${t}</span></li>`).join('');
  document.querySelector('#debrief-prefs').innerHTML =
    openPrefs.map(p => `<li class="known">${esc(p)} <span class="dim">(사전 통보)</span></li>`).join('')
    + hiddenPrefs.slice(0, 2).map(p => `<li class="found">${esc(p)} <span class="dim">(대화에서 화제에 올랐다)</span></li>`).join('')
    + hiddenPrefs.slice(2).map(p => `<li class="missed">${esc(p)} <span class="dim">(끝내 안 나왔다)</span></li>`).join('');
  document.querySelector('#debrief-turns').innerHTML =
    '<div class="turn-table-wrap"><table class="turn-table"><tr><th>합</th><th>호감</th><th>누적</th><th>해설</th></tr>'
    + Array.from({ length: 5 }, (_, i) =>
      `<tr class="${i % 3 ? 'good' : ''}"><td>${i + 1}${i === 0 ? '·착장' : '·5교환'}${i === 1 ? '·발견' : ''}${i === 3 ? '<b class="tt-lev">·압박</b>' : ''}</td>`
      + `<td>+13.6 <span class="dim">[breakthrough] +9</span></td><td>51</td>`
      + `<td>방어선이 실제로 내려갔다. 규정 뒤에 숨던 사람이 처음으로 자기 얘기를 했다</td></tr>`).join('')
    + '</table></div>';
  document.querySelector('#btn-retry').classList.remove('hidden');
  document.querySelector('#btn-restart').classList.remove('hidden');
}

// ── 페이지 안에서 실행: 레이아웃 검사 ────────────────────
function audit() {
  const vw = window.innerWidth;
  const out = { overflowPage: 0, escaped: [], clipped: [], smallTargets: [], badCanvas: [], lowContrast: [] };

  const de = document.documentElement;
  out.overflowPage = Math.max(0, de.scrollWidth - de.clientWidth);

  const screen = [...document.querySelectorAll('.screen')].find(s => !s.classList.contains('hidden'));
  const scope = screen || document.body;
  const label = el => {
    const id = el.id ? '#' + el.id : '';
    const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return (el.tagName.toLowerCase() + id + cls).slice(0, 46);
  };

  for (const el of [document.querySelector('#topbar'), ...scope.querySelectorAll('*')]) {
    if (!el || !el.offsetParent && el.id !== 'topbar') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    // 뷰포트 오른쪽 이탈 (스크롤 컨테이너 내부는 제외)
    if (r.right > vw + 1) {
      let scrollable = false;
      for (let n = el.parentElement; n; n = n.parentElement) {
        const ov = getComputedStyle(n).overflowX;
        if (ov === 'auto' || ov === 'scroll') { scrollable = true; break; }
      }
      if (!scrollable) out.escaped.push({ el: label(el), right: Math.round(r.right), over: Math.round(r.right - vw) });
    }
    const st = getComputedStyle(el);
    // 내용 잘림: overflow가 숨김인데 내용이 더 크다
    if ((st.overflowY === 'hidden' || st.overflowX === 'hidden')
      && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)
      && el.textContent.trim().length > 4) {
      out.clipped.push({ el: label(el), need: `${el.scrollWidth}x${el.scrollHeight}`, has: `${el.clientWidth}x${el.clientHeight}` });
    }
    // 터치 타깃
    if ((el.tagName === 'BUTTON' || el.tagName === 'SELECT'
      || (el.tagName === 'INPUT' && el.type !== 'checkbox')) && r.height > 0 && r.height < 40) {
      out.smallTargets.push({ el: label(el), h: Math.round(r.height) });
    }
    // 인라인 요소가 자기 박스보다 넓게 그려지는 경우 (flex shrink로 눌린 배지 등)
    if (el.children.length === 0 && el.textContent.trim().length > 1
      && st.whiteSpace.startsWith('nowrap') && st.overflowX === 'visible'
      && el.scrollWidth > el.clientWidth + 1) {
      out.clipped.push({ el: label(el), need: `${el.scrollWidth}w`, has: `${el.clientWidth}w` });
    }
    if (el.tagName === 'CANVAS') {
      if (r.width < 40 || r.height < 40) out.badCanvas.push({ el: label(el), size: `${Math.round(r.width)}x${Math.round(r.height)}` });
    }
  }
  if (window.__contrast) out.lowContrast = window.__contrast();
  return out;
}

// ── 명암비 검사기 (browser.mjs와 동일 로직) ──────────────
function installContrast() {
  window.__contrast = () => {
    const lum = (r, g, b) => {
      const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const parse = c => (c.match(/[\d.]+/g) || []).map(Number);
    const bgOf = el => {
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const st = getComputedStyle(n);
        if (st.backgroundImage !== 'none') return null;
        const c = parse(st.backgroundColor);
        if (c.length >= 3 && (c[3] === undefined || c[3] > 0.5)) return c;
      }
      return parse(getComputedStyle(document.body).backgroundColor).slice(0, 3);
    };
    const bad = [];
    for (const el of document.querySelectorAll('p, span, li, td, th, h1, h2, h3, h4, label, summary, button, figcaption, b, code, option')) {
      if (!el.offsetParent) continue;
      const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
      if (txt.length < 2) continue;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || +st.opacity < 0.5) continue;
      // 비활성 컨트롤은 WCAG 1.4.3 명암비 요건에서 면제된다
      if (el.disabled || el.closest('[disabled]')) continue;
      const bg = bgOf(el); if (!bg) continue;
      const fg = parse(st.color);
      const l1 = lum(...fg.slice(0, 3)), l2 = lum(...bg.slice(0, 3));
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const big = parseFloat(st.fontSize) >= 24 || (parseFloat(st.fontSize) >= 18.66 && +st.fontWeight >= 600);
      if (ratio < (big ? 3 : 4.5)) bad.push({ txt: txt.slice(0, 22), ratio: +ratio.toFixed(2), color: st.color });
    }
    return bad;
  };
}

// ── 러너 ─────────────────────────────────────────────────
await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({
  headless: true, executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

const problems = [];
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
page.on('pageerror', e => problems.push({ vp: '-', screen: '-', kind: 'JS 오류', detail: String(e).slice(0, 120) }));

await page.goto(`http://127.0.0.1:${PORT}/?pace=instant`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__game && window.__game.COUPLES);
await page.evaluate(mockLlm);
await page.evaluate(installContrast);

// 게임을 대화/결과 화면 상태까지 끌어올린다 (실제 흐름으로 진입해야 내용이 진짜다)
await page.fill('#agent-name', '박큐피드');
await page.fill('#agent-gender', '기밀');
await page.fill('#key-input', 'sk-ant-fake');
await page.click('#btn-boot');
await page.waitForSelector('#screen-intro:not(.hidden)', { timeout: 20000 });
await page.click('#btn-intro-skip');
await page.waitForSelector('#btn-to-roster:not(.hidden)', { timeout: 30000 });
await page.click('#btn-to-roster');
await page.waitForSelector('.couple-card', { timeout: 15000 });
await page.evaluate(() => {
  const t = window.__game.COUPLES.find(c => c.id === 'os-war');
  [...document.querySelectorAll('.couple-card')].find(el => el.textContent.includes(t.client.name))
    .querySelector('.cc-take').click();
});
// ① 미용실
await page.waitForSelector('#screen-salon:not(.hidden)', { timeout: 15000 });
await page.fill('#styling-input', '형광 주황색으로 염색, 새빨간 턱시도, 카우보이 부츠, 선글라스, 오른손에 폭탄');
await page.click('#btn-styling');
await page.waitForSelector('#styling-result .react-outfit', { timeout: 30000 });
// ② 취조실
await page.click('#btn-salon-next');
await page.waitForSelector('#screen-interro:not(.hidden)', { timeout: 15000 });
await page.fill('#coaching-input', '상대가 말을 아끼면 그냥 넘어가지 말고 한 번 더 물어라. "I use Arch btw"는 절대 입 밖에 내지 마라. 리눅스 설치 권유는 금지다.');
await page.click('#btn-coaching');
await page.waitForSelector('#coaching-result .react-line', { timeout: 30000 });
// ③ 정문
await page.click('#btn-interro-next');
await page.waitForSelector('#screen-gate:not(.hidden)', { timeout: 15000 });
await page.fill('#speech-input', '컨퍼런스에서 장내가 얼어붙었을 때 너 혼자 심장이 얼어붙었다며. 그 온도차를 아는 사람은 너뿐이야. 오늘은 그걸 말로 해.');
await page.click('#btn-speech');
await page.waitForSelector('#speech-result .react-line', { timeout: 30000 });
await page.evaluate(poseScreens);

console.log(`\n📐 반응형 감사 — ${VIEWPORTS.length}개 뷰포트 × ${SCREENS.length}개 화면\n`);
const show = async (name) => {
  await page.evaluate(n => {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('hidden', s.id !== 'screen-' + n));
    document.body.classList.toggle('phase-talk', n === 'chat');
    window.scrollTo(0, 0);
  }, name);
  await page.waitForTimeout(90);   // 리사이즈/리렌더 안정화
};

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.w, height: vp.h });
  await page.waitForTimeout(120);
  const rows = [];
  for (const sc of SCREENS) {
    await show(sc);
    const a = await page.evaluate(audit);
    const issues = [];
    if (a.overflowPage > 1) { issues.push(`가로스크롤 +${a.overflowPage}px`); problems.push({ vp: vp.name, screen: sc, kind: '가로 스크롤', detail: `+${a.overflowPage}px` }); }
    for (const e of a.escaped.slice(0, 4)) { issues.push(`이탈 ${e.el}(+${e.over})`); problems.push({ vp: vp.name, screen: sc, kind: '뷰포트 이탈', detail: `${e.el} +${e.over}px` }); }
    for (const e of a.clipped.slice(0, 4)) { issues.push(`잘림 ${e.el}`); problems.push({ vp: vp.name, screen: sc, kind: '내용 잘림', detail: `${e.el} ${e.need}⊂${e.has}` }); }
    for (const e of a.smallTargets.slice(0, 4)) { issues.push(`터치 ${e.el}(${e.h}px)`); problems.push({ vp: vp.name, screen: sc, kind: '터치 타깃 <40px', detail: `${e.el} ${e.h}px` }); }
    for (const e of a.badCanvas) { issues.push(`캔버스 ${e.size}`); problems.push({ vp: vp.name, screen: sc, kind: '캔버스 이상', detail: `${e.el} ${e.size}` }); }
    for (const e of a.lowContrast.slice(0, 3)) { issues.push(`명암 ${e.ratio}:1`); problems.push({ vp: vp.name, screen: sc, kind: '명암비 미달', detail: `"${e.txt}" ${e.ratio}:1 ${e.color}` }); }
    rows.push(`${issues.length ? '❌' : '✅'} ${sc.padEnd(9)}${issues.slice(0, 3).join(' · ')}`);
    if (SHOTS && issues.length) {
      await page.screenshot({ path: `${SHOTS}/${vp.w}x${vp.h}-${sc}.png`, fullPage: true });
    }
  }
  const bad = rows.filter(r => r.startsWith('❌')).length;
  console.log(`${bad ? '❌' : '✅'} ${vp.name} (${vp.w}×${vp.h})${bad ? ` — ${bad}개 화면 문제` : ''}`);
  for (const r of rows) if (r.startsWith('❌')) console.log('     ' + r);
}

await browser.close(); server.close();

// ── 집계 ─────────────────────────────────────────────────
console.log('\n════════ 문제 유형별 집계 ════════');
if (!problems.length) console.log('없음 ✔ 모든 뷰포트에서 레이아웃 문제 없음');
const byKind = {};
for (const p of problems) (byKind[p.kind] ||= []).push(p);
for (const [kind, list] of Object.entries(byKind).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n▸ ${kind} — ${list.length}건`);
  const seen = new Set();
  for (const p of list) {
    if (seen.has(p.detail)) continue;
    seen.add(p.detail);
    if (seen.size > 8) { console.log(`    … 외 ${list.length - 8}건`); break; }
    console.log(`    ${p.detail}   [${p.screen} @ ${p.vp}]`);
  }
}
if (SHOTS) console.log(`\n📸 문제 화면 스크린샷 → ${SHOTS}`);
process.exit(problems.length ? 1 : 0);
