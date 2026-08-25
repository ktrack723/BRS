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

const SCREENS = ['boot', 'intro', 'roster', 'styling', 'coaching', 'chat', 'result'];

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
    if (label.startsWith('A ·')) {
      return {
        look: '형광 주황으로 물들인 머리에 새빨간 턱시도, 카우보이 부츠, 선글라스. 오른손에 폭탄을 들었고 머리 위에 금색 고리가 천천히 돈다.',
        personality: '지고는 못 사는 성질이 끝까지 올라와 있다. 벌금 800만원이 머릿속에서 떠나지 않아서, 말이 평소보다 반 박자 빠르다.',
        spec: {
          skin: '#e8d0c0', hair: '#ff8a2b', hairStyle: 'spiky', top: '#dd1122', bottom: '#2a3a4a',
          shoes: '#7a5a2a', heightScale: 1.02, widthScale: 0.9, accessory: 'sunglasses',
          accessoryColor: '#111111', expression: 'chad', aura: 'fire', species: 'human',
          props: [
            { shape: 'sphere', color: '#1a1a1a', size: 0.35, at: 'handR', motion: 'bob', label: '폭탄' },
            { shape: 'torus', color: '#ffdd55', size: 0.4, at: 'crown', motion: 'yaw', label: '후광' },
          ],
        },
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

  // B · 대화 화면
  document.querySelector('#chat-phase-label').textContent =
    `B · 토킹 페이즈 — ${c.client.name} × ${c.target.name}`;
  const win = document.querySelector('#chat-window');
  win.innerHTML = '';
  const lines = [
    ['sys', '── 여기서부터 토킹 페이즈 ──'],
    ['client', '현장에서 3초 만에 절 고른 분. 총기 분해 순서, 어떻게 되십니까. 아니 이건 인사입니다.'],
    ['target', '…누구십니까. 번호 어디서 났습니까. 분해 순서는 규정상 안 알려드립니다.'],
    ['client', '냄새가, 뭡니까. 삼키지 마십시오. 좋아하는 냄새, 싫은 냄새. 떠오르는 기억이 있으십니까.'],
    ['target', 'ㅇㅇ'],
    ['target', '…저 냄새에 예민합니다. 특히 사람 머리 냄새. 현장에서 3초, 그거 사실 거리 재기 아니었습니다.'],
  ];
  for (const [who, text] of lines) {
    if (who === 'sys') {
      const sep = document.createElement('div');
      sep.className = 'judge-sep'; sep.textContent = text; win.appendChild(sep); continue;
    }
    const d = document.createElement('div');
    d.className = `bubble ${who}`;
    const name = who === 'client' ? c.client.name : c.target.name;
    d.innerHTML = `<span class="who">${esc(name)}</span><span class="say">${esc(text)}</span>`;
    win.appendChild(d);
  }
  document.querySelector('#chat-advance').classList.add('on');

  document.querySelector('#turn-badge').textContent = '토킹 3/5구간';
  document.querySelector('#meter-mood-num').textContent = '62';
  document.querySelector('#meter-mood-fill').style.width = '62%';
  document.querySelector('#meter-love-num').textContent = '44';
  document.querySelector('#meter-love-fill').style.width = '44%';
  const MARKS = [['텍스팅 1/4', 1, 0], ['텍스팅 2/4', 0, 1], ['텍스팅 3/4', -1, 0],
    ['텍스팅 4/4', 0, 0], ['토킹 1/5', 1, 1], ['토킹 2/5', 0, 0], ['토킹 3/5', -1, 1]];
  const M = { 1: '▲', '-1': '▼', 0: '─' }, K = { 1: 'up', '-1': 'down', 0: 'same' };
  document.querySelector('#verdict-log').innerHTML = MARKS.map(([w, dm, dl]) =>
    `<li class="verdict-row ${K[dl]}"><span class="vr-when">${w}</span>`
    + `<span class="vr-mark mood ${K[dm]}">무드 ${M[dm]}</span>`
    + `<span class="vr-mark love ${K[dl]}">러브 ${M[dl]}</span></li>`).reverse().join('');

  // C · 후일담
  document.querySelector('#result-stamp').textContent = '성사';
  document.querySelector('#result-stamp').className = 'result-stamp ok';
  document.querySelector('#result-score').textContent = '러브 포인트 68 / 100 · 무드 포인트 62 / 100';
  document.querySelector('#result-note').textContent = '성사 여부는 러브 포인트를 보고 기록관이 정했다.';
  document.querySelector('#result-epilogue').textContent =
    '둘은 그날 밤 야적장에서 새벽까지 녹슨 것들 얘기만 했다.\n'
    + '3주 뒤 한쪽이 신고 41건을 전부 취하했고, 다른 쪽은 그 취하서를 액자에 넣어 전시했다.\n'
    + '관람객들은 그게 작품인 줄 알았고, 아무도 정정해주지 않았다.\n'
    + '큐피드국은 이 건을 성사로 처리하고 회계에 야적장 대여료 12만원을 올렸다.';
  document.querySelector('#debrief-turns').innerHTML =
    '<div class="turn-table-wrap"><table class="turn-table"><tr><th>구간</th><th>무드</th><th>러브</th></tr>'
    + MARKS.map(([w, dm, dl], i) =>
      `<tr class="${dl > 0 ? 'good' : dl < 0 ? 'bad' : ''}"><td>${w}</td>`
      + `<td class="${K[dm]}">${M[dm]} ${50 + dm * 12}</td>`
      + `<td class="${K[dl]}">${M[dl]} ${12 + i * 8}</td></tr>`).join('')
    + '</table></div>';
  document.querySelector('#debrief-transcript').textContent =
    lines.filter(l => l[0] !== 'sys').map(l => `${l[0] === 'client' ? c.client.name : c.target.name}: ${l[1]}`).join('\n');
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
await page.fill('#key-input', 'sk-ant-fake');
await page.click('#btn-boot');
await page.waitForSelector('#screen-intro:not(.hidden)', { timeout: 20000 });
await page.click('#btn-intro-skip');
await page.waitForSelector('#screen-roster:not(.hidden)', { timeout: 30000 });
await page.waitForSelector('.couple-card', { timeout: 15000 });
await page.evaluate(() => {
  const t = window.__game.COUPLES.find(c => c.id === 'os-war');
  [...document.querySelectorAll('.couple-card')].find(el => el.textContent.includes(t.client.name))
    .querySelector('.cc-take').click();
});
// A · 스타일링 / 동기부여
await page.waitForSelector('#screen-styling:not(.hidden)', { timeout: 15000 });
await page.fill('#styling-input', '형광 주황색으로 염색, 새빨간 턱시도, 카우보이 부츠, 선글라스, 오른손에 폭탄');
await page.fill('#motivation-input', '오늘 안 되면 벌금 800만원이라고 못박아라. 지고는 못 사는 성질을 끝까지 끌어올려라.');
await page.click('#btn-styling');
await page.waitForSelector('#styling-result .sheet-out', { timeout: 30000 });
// B · 코칭
await page.click('#btn-styling-next');
await page.waitForSelector('#screen-coaching:not(.hidden)', { timeout: 15000 });
await page.fill('#coaching-input', '상대가 말을 아끼면 그냥 넘어가지 말고 한 번 더 물어라. "I use Arch btw"는 절대 입 밖에 내지 마라. 리눅스 설치 권유는 금지다. 만날 곳은 새벽 폐자재 야적장으로 잡아라.');
await page.waitForTimeout(80);
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
