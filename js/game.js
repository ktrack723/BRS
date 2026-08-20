// game.js — 화면/입력 계층. 대화 오케스트레이션은 engine.js, 규칙은 scoring.js, API는 llm.js.
import { LlmClient, RefusalError } from './llm.js';
import * as P from './prompts.js';
import { Engine } from './engine.js';
import { DIFFICULTIES, diffOf, moodMultiplier } from './scoring.js';
import { COUPLES } from './couples.js';
import { AvatarViewer, sanitizeSpec, renderThumb } from './avatar.js';
import { sfx, startBgm, toggleBgm, unlockAudio } from './audio.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const escapeHtml = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const llm = new LlmClient();

const state = {
  screen: 'boot',
  couple: null, clientSpec: null, targetSpec: null, diff: null,
  prep: { outfitDesc: '', coaching: '', speech: '' },
  engine: null, result: null,
  filter: '전체',
};
window.__game = { state, llm, DIFFICULTIES, COUPLES }; // 자동 테스트 후크

// ── 뷰어 관리 (무대 캔버스는 WebGL 컨텍스트를 재사용한다) ─────
const stageViewers = new Map();
function getStageViewer(id) {
  let v = stageViewers.get(id);
  if (!v) { v = new AvatarViewer($('#' + id), {}); stageViewers.set(id, v); }
  v.reset();
  return v;
}

// ── 공용 UI ─────────────────────────────────────────────
function show(screen) {
  state.screen = screen;
  $$('.screen').forEach(s => s.classList.toggle('hidden', s.id !== `screen-${screen}`));
  window.scrollTo(0, 0);
}

const TIPS = [
  '참고 · 준비 3종은 채점되지 않는다. 점수는 실제 대화에서만 나온다.',
  '참고 · 무전이 없는 턴에 클라이언트는 새 화제를 열지 못한다. 아끼면 그냥 소멸한다.',
  '참고 · 분위기가 낮으면 취향을 저격해도 호감이 찔끔 오른다.',
  '참고 · 금지 항목 접촉 한 번이 잘한 두 턴을 통째로 지운다.',
  '참고 · 착장은 대면 첫 순간에 타겟이 직접 보고 판정한다.',
  '참고 · 코칭에 "무엇을 하지 마라"와 "무엇을 하라"를 같이 써라.',
  '참고 · 미확인 취향은 무전으로 화제를 끌어야만 드러난다.',
];
function loading(on, label = '') {
  $('#loading-overlay').classList.toggle('hidden', !on);
  if (on) {
    $('#loading-text').textContent = label;
    $('#loading-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  }
}
async function withLoading(label, fn) {
  loading(true, label);
  try { return await fn(); } finally { loading(false); }
}

let toastTimer = null;
function toast(msg, ms = 5000) {
  const t = $('#toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

function errMsg(e) {
  if (e instanceof RefusalError) return '판정 연산 모형이 본 내용의 처리를 거부했다. 표현을 바꿔 재시도하라.';
  return `통신 사고 — ${e.message}`;
}

async function typeText(el, text, cps = 60) {
  el.textContent = '';
  const step = Math.max(1, Math.round(text.length / 400));
  for (let i = 0; i < text.length; i += step) {
    el.textContent += text.slice(i, i + step);
    if (i % 4 === 0) sfx.type();
    await new Promise(r => setTimeout(r, 1000 / cps));
  }
  el.textContent = text;
}

// 스토리지 차단 환경에서도 죽지 않게
const sget = (store, k) => { try { return window[store].getItem(k); } catch { return null; } };
const sset = (store, k, v) => { try { v === null ? window[store].removeItem(k) : window[store].setItem(k, v); } catch { } };

// ── 요원 전적 ───────────────────────────────────────────
function loadRecord() {
  try { return JSON.parse(sget('localStorage', 'cupid_record') || '{"runs":[]}'); }
  catch { return { runs: [] }; }
}
function saveRun(entry) {
  const rec = loadRecord();
  rec.runs.unshift(entry);
  rec.runs = rec.runs.slice(0, 60);
  sset('localStorage', 'cupid_record', JSON.stringify(rec));
}
const GRADE_ORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
function clearedIds() { return new Set(loadRecord().runs.filter(r => r.accepted).map(r => r.id)); }

function renderRecord() {
  const runs = loadRecord().runs;
  const el = $('#agent-record');
  if (!el) return;
  if (!runs.length) { el.innerHTML = '<span class="dim">첫 공작을 기다리는 중. 전적 없음.</span>'; return; }
  const wins = runs.filter(r => r.accepted).length;
  const best = runs.reduce((b, r) => GRADE_ORDER.indexOf(r.grade) > GRADE_ORDER.indexOf(b) ? r.grade : b, 'F');
  const cleared = clearedIds().size;
  el.innerHTML =
    `<b>요원 전적</b> · 공작 ${runs.length}회 · 성사 ${wins}회 (${Math.round(wins / runs.length * 100)}%) · 최고 등급 <b>${best}</b> · 정복한 조합 <b>${cleared}/${COUPLES.length}</b>` +
    `<div class="record-chips">${runs.slice(0, 12).map(r =>
      `<span class="record-chip ${r.accepted ? 'win' : 'lose'} diff-${r.diffKey}" title="${escapeHtml(r.client)} × ${escapeHtml(r.target)} (${escapeHtml(r.difficulty)}) 호감 ${r.love}/${r.threshold}">${escapeHtml(r.grade)}</span>`).join('')}</div>`;
}

// ── LLM 콘솔 ────────────────────────────────────────────
llm.onLog((entry, usage) => {
  const box = $('#console-log');
  let el = entry._el;
  if (!el) { el = document.createElement('details'); entry._el = el; box.prepend(el); while (box.children.length > 60) box.lastChild.remove(); }
  const st = { pending: '···', ok: 'OK ', error: 'ERR', refusal: 'REF' }[entry.status] || '  ?';
  const u = entry.response?.usage;
  const cacheTag = u?.cache_read_input_tokens ? ` · 캐시 ${u.cache_read_input_tokens}` : '';
  el.innerHTML = `<summary>${st} <b>${escapeHtml(entry.label)}</b> · ${escapeHtml(entry.model)} · ${entry.ms ? Math.round(entry.ms) + 'ms' : '...'}${u ? ` · ${u.input_tokens}→${u.output_tokens}tok${cacheTag}` : ''}${entry.error ? ` · ${escapeHtml(entry.error)}` : ''}</summary><pre>${escapeHtml(JSON.stringify({ request: entry.request, response: entry.response ?? null }, null, 1).slice(0, 8000))}</pre>`;
  $('#console-usage').textContent =
    `호출 ${usage.calls} · in ${usage.inputTokens.toLocaleString()} · out ${usage.outputTokens.toLocaleString()} · 캐시적중 ${usage.cacheRead.toLocaleString()} · 약 $${usage.cost.toFixed(3)}${usage.saved > 0 ? ` (캐시 절감 $${usage.saved.toFixed(3)})` : ''}`;
});

// ── 부팅 ────────────────────────────────────────────────
function initBoot() {
  const saved = sget('localStorage', 'cupid_key') || sget('sessionStorage', 'cupid_key');
  if (saved) $('#key-input').value = saved;
  const savedModel = sget('localStorage', 'cupid_model');
  if (savedModel) $('#model-select').value = savedModel;

  $('#btn-boot').addEventListener('click', async () => {
    unlockAudio(); sfx.click();
    const key = $('#key-input').value.trim();
    if (!key.startsWith('sk-ant-')) return bootError('그건 API 키가 아니라 그냥 문자열이다. sk-ant-... 형식의 키를 내놔라.');
    llm.apiKey = key;
    llm.model = $('#model-select').value;
    sset('localStorage', 'cupid_model', llm.model);
    sset('sessionStorage', 'cupid_key', key);
    sset('localStorage', 'cupid_key', $('#remember-key').checked ? key : null);
    try {
      await withLoading('본부 회선 연결 중... (키 인증)', () => llm.ping());
      startBgm();
      prefetchBriefing();
      showIntro();
    } catch (e) {
      show('boot');
      bootError(errMsg(e));
    }
  });
  $('#key-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-boot').click(); });
}
function bootError(msg) {
  const el = $('#boot-error');
  el.textContent = msg; el.classList.remove('hidden');
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  sfx.bad();
}

// ── 프리페치 ────────────────────────────────────────────
const pending = { briefing: null };
function prefetchBriefing() {
  pending.briefing = llm.call({
    label: '국장 브리핑', system: P.BRIEFING_SYSTEM,
    messages: [{ role: 'user', content: P.BRIEFING_USER }], effort: 'low', maxTokens: 3000,
  }).catch(e => ({ __error: e }));
  pending.briefing.then(r => {
    const el = $('#intro-prefetch');
    if (!el) return;
    if (r?.__error) { el.textContent = '국장 회선 잡음 — 교육 종료 후 재시도한다.'; el.classList.add('bad'); }
    else { el.textContent = '국장 브리핑 수신 완료 — 교육 종료 후 재생된다.'; el.classList.add('ok'); }
  });
}

// ── 신입 교육 슬라이드 ──────────────────────────────────
// 여섯 장. 한 장은 삽화 한 컷과 문장 한 줄이 전부다.
// 삽화는 원·사각형·다각형만 붙여서 그린다. 색은 전부 CSS 클래스(=토큰)에서 온다.
const ART_VB = '0 0 340 128';
const aSvg = (label, body, dy = 0, dx = 0) =>
  `<svg class="art" viewBox="${ART_VB}" role="img" aria-label="${label}">`
  + `<g transform="translate(${dx} ${dy})">${body}</g></svg>`;
// 블록 인형 한 명 = 머리(원 또는 사각) + 어깨 사다리꼴
const aTorso = (x, y, c) => `<path class="${c}" d="M${x - 18} ${y + 20}L${x - 13} ${y - 5}h26L${x + 18} ${y + 20}Z"/>`;
const aPerson = (x, y, c) => `<circle class="${c}" cx="${x}" cy="${y - 22}" r="13"/>` + aTorso(x, y, c);
const aBlockPerson = (x, y, c) =>
  `<rect class="${c}" x="${x - 12}" y="${y - 34}" width="24" height="24" rx="3"/>` + aTorso(x, y, c);
const aCap = (x, y, t, a = '') => `<text class="a-cap ${a}" x="${x}" y="${y}">${t}</text>`;
const aArrow = (x1, x2, y) =>
  `<path class="a-dash" d="M${x1} ${y}H${x2}"/>`
  + `<polygon class="a-soft" points="${x2},${y - 6} ${x2 + 13},${y} ${x2},${y + 6}"/>`;
const aBar = (y, w, c) =>
  `<rect class="a-track" x="60" y="${y}" width="248" height="24"/>`
  + `<rect class="${c}" x="62" y="${y + 2}" width="${w}" height="20"/>`;

const SLIDES = [
  {
    art: aSvg('요원이 무전으로 클라이언트를 조종하고, 클라이언트가 타겟과 마주 선 그림',
      // 헤드셋 낀 요원
      '<path class="a-line" d="M26 40a16 16 0 0 1 32 0"/>'
      + '<rect class="a-ink" x="21" y="38" width="7" height="12" rx="2"/>'
      + '<rect class="a-ink" x="56" y="38" width="7" height="12" rx="2"/>'
      + '<path class="a-line" d="M60 48q-5 8-12 8"/><circle class="a-ink" cx="47" cy="56" r="3"/>'
      + aPerson(42, 62, 'a-ink')
      + aArrow(70, 112, 40)
      + aPerson(150, 62, 'a-file')
      // 하트 = 정사각형 하나를 45도 돌리고 원 두 개를 윗변에 얹은 것
      + '<g class="a-stamp"><rect x="208" y="34" width="20" height="20" transform="rotate(45 218 44)"/>'
      + '<circle cx="210.9" cy="36.9" r="10"/><circle cx="225.1" cy="36.9" r="10"/></g>'
      + aPerson(286, 62, 'a-stamp')
      + aCap(42, 104, '요원') + aCap(150, 104, '클라이언트') + aCap(286, 104, '타겟'), 6, 10),
    line: '너는 직접 연애하지 않는다. 연애 경험 0인 <b>클라이언트</b>를 뒤에서 조작해 <b>타겟</b>에게 고백시키는 게 임무다.',
  },
  {
    art: aSvg('둥근 머리와 각진 머리가 붉은 균열을 사이에 두고 마주 섰고, 아래에 결승선 세 종류가 놓인 그림',
      aPerson(72, 44, 'a-file')
      + aBlockPerson(268, 44, 'a-stamp')
      + '<polyline class="a-crack" points="170,6 160,22 172,38 160,54 170,70"/>'
      + aCap(40, 101, '결승선')
      + [['연애', 76], ['동맹', 160], ['휴전', 244]].map(([t, x]) =>
        `<rect class="a-tag" x="${x}" y="84" width="58" height="24"/>`
        + `<text class="a-tag-t" x="${x + 29}" y="101">${t}</text>`).join(''), 8),
    line: '상설 의뢰 <b>20건</b>은 전부 이어질 리 없는 조합이라, 쌍에 따라 결승선이 <b>연애</b>가 아니라 <b>동맹</b>이나 <b>휴전</b>이다.',
  },
  {
    art: aSvg('0점 도장이 찍힌 요원의 서류가 점선 화살표를 타고 클라이언트 AI의 머리로 들어가는 그림',
      '<path class="a-paper" d="M24 10h64l16 16v66H24Z"/>'
      + '<path class="a-fold" d="M88 10v16h16Z"/>'
      + '<path class="a-rule" d="M36 42h56M36 56h56M36 70h38"/>'
      + '<circle class="a-seal" cx="70" cy="70" r="17"/>'
      + '<text class="a-seal-t" x="70" y="76" transform="rotate(-14 70 70)">0점</text>'
      + aArrow(120, 176, 52)
      + '<path class="a-line" d="M250 18V9"/><circle class="a-ink" cx="250" cy="6" r="4"/>'
      + '<rect class="a-box" x="204" y="18" width="92" height="68" rx="6"/>'
      + '<circle class="a-file" cx="228" cy="48" r="7"/><circle class="a-file" cx="272" cy="48" r="7"/>'
      + '<rect class="a-ink" x="224" y="66" width="52" height="7" rx="3"/>'
      + aCap(64, 110, '요원이 쓴 문장') + aCap(250, 110, '클라이언트 AI'), 5, 10),
    line: '스타일링·코칭·연설·무전은 <b>채점하지 않는다</b>. 네가 쓴 문장은 클라이언트 AI의 프롬프트로 <b>그대로 주입</b>될 뿐이다.',
  },
  {
    art: aSvg('두 사람의 말풍선이 점선 화살표를 타고 판정표의 가감점으로 이어지는 그림',
      '<path class="a-bub-c" d="M16 6h120a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H52L34 58V44H16a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4Z"/>'
      + '<rect class="a-soft" x="24" y="17" width="100" height="7" rx="3.5"/>'
      + '<rect class="a-soft" x="24" y="29" width="70" height="7" rx="3.5"/>'
      + '<path class="a-bub-t" d="M48 62h114a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4h-22l-18 14V98H48a4 4 0 0 1-4-4V66a4 4 0 0 1 4-4Z"/>'
      + '<rect class="a-soft" x="56" y="72" width="100" height="7" rx="3.5"/>'
      + '<rect class="a-soft" x="56" y="84" width="64" height="7" rx="3.5"/>'
      + aArrow(182, 214, 58)
      + '<rect class="a-paper" x="238" y="15" width="88" height="88"/>'
      + '<rect class="a-file" x="239" y="16" width="86" height="24"/>'
      + '<text class="a-hdr" x="282" y="33">판정</text>'
      + '<text class="a-good" x="282" y="66">+13.6</text>'
      + '<text class="a-bad" x="282" y="92">−8.2</text>', 5),
    line: '점수는 오직 <b>그 인간이 실제로 뭐라고 말했는가</b>로만 매겨진다. 준비를 대충 하면 그 인간이 대화에서 알아서 망한다.',
  },
  {
    art: aSvg('호감 막대와 분위기 막대, 성공선 표시와 배율 범위를 나타낸 계기판',
      '<text class="a-key e" x="48" y="37">호감</text>'
      + aBar(20, 156, 'a-stamp')
      + '<path class="a-thr" d="M226 14V50"/>'
      + aCap(226, 9, '성공선')
      + '<text class="a-mul" x="184" y="63">×</text>'
      + '<text class="a-key e" x="48" y="87">분위기</text>'
      + aBar(70, 118, 'a-file')
      + '<rect class="a-stamp" x="56" y="66" width="5" height="32"/>'
      + aCap(60, 112, '0 = 이탈', 's')
      + aCap(308, 112, '×0.3 ~ ×1.6', 'e'), 4),
    line: '<b>호감</b>이 성공선을 넘겨야 이긴다. <b>분위기</b>는 그 호감에 곱해지는 배율이고, 0이 되면 상대가 자리를 뜬다.',
  },
  {
    art: aSvg('확인된 취향 카드 두 장과 물음표 카드 두 장, 그 옆에 접촉 금지 경고 삼각형',
      [14, 54].map(x => `<rect class="a-file" x="${x}" y="22" width="34" height="46" rx="3"/>`
        + `<path class="a-chk" d="M${x + 9} 45l6 7 11-14"/>`).join('')
      + [94, 134].map(x => `<rect class="a-unk" x="${x}" y="22" width="34" height="46" rx="3"/>`
        + `<text class="a-q" x="${x + 17}" y="54">?</text>`).join('')
      + '<path class="a-div" d="M186 14V94"/>'
      + '<polygon class="a-stamp" points="256,18 296,86 216,86"/>'
      + '<rect class="a-lit" x="252" y="42" width="8" height="24" rx="3"/>'
      + '<circle class="a-lit" cx="256" cy="76" r="4.5"/>'
      + aCap(91, 108, '취향 절반은 미확인') + aCap(256, 108, '금지 항목 전부 통보'), 2),
    line: '취향은 절반이 <b>미확인</b>이라 무전으로 화제를 열어야 드러나고, <b>접촉 금지 항목</b>은 전부 통보되니 밟으면 요원 책임이다.',
  },
];

let slideIdx = 0;
function showIntro() {
  show('intro');
  slideIdx = 0;
  $('#intro-dots').innerHTML = SLIDES.map((_, i) => `<span class="dot" data-i="${i}"></span>`).join('');
  $$('#intro-dots .dot').forEach(d => d.addEventListener('click', () => { slideIdx = +d.dataset.i; renderSlide(); }));
  renderSlide();
}
function renderSlide() {
  const s = SLIDES[slideIdx];
  $('#intro-slides').innerHTML =
    `<div class="slide"><div class="slide-art">${s.art}</div><p class="slide-line">${s.line}</p></div>`;
  $('#intro-step').textContent = `신입 교육 ${slideIdx + 1} / ${SLIDES.length}`;
  $('#btn-intro-prev').disabled = slideIdx === 0;
  $('#btn-intro-next').textContent = slideIdx === SLIDES.length - 1 ? '교육 수료 ▶' : '다음 ▶';
  $$('#intro-dots .dot').forEach((d, i) => d.classList.toggle('on', i === slideIdx));
}
function initIntro() {
  $('#btn-intro-next').addEventListener('click', () => {
    sfx.click();
    if (slideIdx < SLIDES.length - 1) { slideIdx++; renderSlide(); }
    else gotoBriefing();
  });
  $('#btn-intro-prev').addEventListener('click', () => { sfx.click(); if (slideIdx > 0) { slideIdx--; renderSlide(); } });
  $('#btn-intro-skip').addEventListener('click', () => { sfx.click(); gotoBriefing(); });
  document.addEventListener('keydown', e => {
    if (state.screen !== 'intro') return;
    if (e.key === 'ArrowRight' || e.key === 'Enter') $('#btn-intro-next').click();
    if (e.key === 'ArrowLeft') $('#btn-intro-prev').click();
  });
}

// ── 브리핑 ──────────────────────────────────────────────
async function gotoBriefing() {
  show('briefing');
  $('#btn-to-roster').classList.add('hidden');
  let text;
  try {
    text = await withLoading('국장님 등판 중...', () => pending.briefing);
    if (text?.__error) throw text.__error;
  } catch (e) {
    text = '(국장이 회선 저편에서 뭐라고 소리쳤지만 잡음뿐이었다. 아무튼 가라는 뜻이다.)';
    toast(errMsg(e));
  }
  await typeText($('#briefing-text'), text);
  $('#btn-to-roster').classList.remove('hidden');
}

// ── 의뢰 대장 (20쌍) ────────────────────────────────────
const DIFF_ORDER = { '쉬움': 0, '보통': 1, '헬': 2 };

function gotoRoster() {
  show('roster');
  renderRecord();
  renderFilters();
  renderRosterCards();
}

function renderFilters() {
  const counts = { 전체: COUPLES.length };
  for (const c of COUPLES) counts[c.difficulty] = (counts[c.difficulty] || 0) + 1;
  const tabs = ['전체', '쉬움', '보통', '헬'];
  $('#roster-filters').innerHTML = tabs.map(t =>
    `<button class="btn95 filter-tab ${state.filter === t ? 'on' : ''} ${t !== '전체' ? 'diff-' + diffOf(t).key : ''}" data-f="${t}">${t} (${counts[t] || 0})</button>`).join('');
  $$('#roster-filters .filter-tab').forEach(b => b.addEventListener('click', () => {
    sfx.click(); state.filter = b.dataset.f; renderFilters(); renderRosterCards();
  }));
}

function renderRosterCards() {
  const cleared = clearedIds();
  const list = COUPLES
    .filter(c => state.filter === '전체' || c.difficulty === state.filter)
    .sort((a, b) => DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty]);
  const box = $('#roster-cards');
  box.innerHTML = '';
  for (const c of list) {
    const d = diffOf(c.difficulty);
    const card = document.createElement('div');
    card.className = `couple-card diff-${d.key}${cleared.has(c.id) ? ' cleared' : ''}`;
    card.innerHTML = `
      ${cleared.has(c.id) ? '<div class="cleared-stamp">성사 완료</div>' : ''}
      <div class="cc-head">
        <span class="cc-cat">${escapeHtml(c.category)}</span>
        <span class="cc-diff diff-${d.key}">${escapeHtml(c.difficulty)}</span>
      </div>
      <div class="cc-pair">
        <figure><img alt="${escapeHtml(c.client.name)}" src="${renderThumb(c.client.spec, c.id + ':c')}"><figcaption>${escapeHtml(c.client.name)}</figcaption></figure>
        <div class="cc-vs">✕</div>
        <figure><img alt="${escapeHtml(c.target.name)}" src="${renderThumb(c.target.spec, c.id + ':t')}"><figcaption>${escapeHtml(c.target.name)}</figcaption></figure>
      </div>
      <p class="cc-clash">${escapeHtml(c.clash)}</p>
      <ul class="cc-meta">
        <li>성공선 <b>${d.threshold}</b></li>
        <li>미확인 <b>${c.target.hiddenPrefs.length}</b></li>
        <li>금지 <b>${c.target.redLines.length}</b></li>
        <li>결승선 <b>${escapeHtml(c.endingKind)}</b></li>
      </ul>
      <div class="cc-btns">
        <button class="btn95 tiny cc-detail" type="button">의뢰서</button>
        <button class="btn95 cc-take" type="button">이 조합을 맡는다</button>
      </div>`;
    box.appendChild(card);
    card.querySelector('.cc-detail').addEventListener('click', () => { sfx.click(); openDossier(c); });
    card.querySelector('.cc-take').addEventListener('click', () => { sfx.stamp(); chooseCouple(c); });
  }
}

function dossierHtml(c, { full = false } = {}) {
  const d = diffOf(c.difficulty);
  return `
    <div class="stamp">극비</div>
    <h3>${escapeHtml(c.client.name)} <small>(${c.client.age}, ${escapeHtml(c.client.job)})</small></h3>
    <p class="story">${escapeHtml(c.client.story)}</p>
    <p><b>외모:</b> ${c.client.appearance.map(escapeHtml).join(', ')}</p>
    <p><b>성격:</b> ${c.client.personality.map(escapeHtml).join(', ')}</p>
    <p class="weakness"><b>취약점:</b> ${escapeHtml(c.client.weakness)} <span class="dim">— 코칭으로 봉인해야 한다</span></p>
    <p class="quote">“${escapeHtml(c.client.quote)}”</p>
    <hr>
    <h3>타겟 · ${escapeHtml(c.target.name)} <small>(${c.target.age}, ${escapeHtml(c.target.job)})</small></h3>
    <p><b>외모:</b> ${c.target.appearance.map(escapeHtml).join(', ')}</p>
    <p><b>성격:</b> ${c.target.personality.map(escapeHtml).join(', ')}</p>
    <p><b>알려진 취향:</b> ${c.target.visiblePrefs.map(escapeHtml).join(', ')}</p>
    <p class="unknown-prefs"><b>미확인 취향 ${c.target.hiddenPrefs.length}건</b> — 내용 비공개. 대화 중 무전으로 화제를 끌어야만 드러난다</p>
    <p class="redline-box"><b>접촉 금지 항목:</b> ${c.target.redLines.map(escapeHtml).join(' / ')}</p>
    <hr>
    <p class="clash-line"><b>이 매칭이 지옥인 이유:</b> ${escapeHtml(c.clash)}</p>
    <div class="diff-box diff-${d.key}">
      <span class="diff-name">난이도 ${escapeHtml(c.difficulty)} · 결승선 ${escapeHtml(c.endingKind)}</span>
      <span class="diff-detail">성공선 호감 ${d.threshold} (분위기 ${d.moodFloor} 이상) · 무전 ${d.radioText}+${d.radioTalk}회 · 총 ${d.textTurns + d.talkTurns}턴</span>
    </div>
    ${full ? `<div class="modal-btns"><button class="btn95 big" id="dossier-take">이 조합을 맡는다</button><button class="btn95" id="dossier-close">닫기</button></div>` : ''}`;
}

function openDossier(c) {
  $('#dossier-box').innerHTML = dossierHtml(c, { full: true });
  $('#modal-dossier').classList.remove('hidden');
  $('#dossier-take').addEventListener('click', () => { sfx.stamp(); $('#modal-dossier').classList.add('hidden'); chooseCouple(c); });
  $('#dossier-close').addEventListener('click', () => { sfx.click(); $('#modal-dossier').classList.add('hidden'); });
}

function chooseCouple(c) {
  state.couple = c;
  state.clientSpec = sanitizeSpec(c.client.spec);
  state.targetSpec = sanitizeSpec(c.target.spec);
  state.diff = diffOf(c.difficulty);
  state.prep = { outfitDesc: '', coaching: '', speech: '' };
  state.engine = null; state.result = null;
  gotoConsult();
}

// ── 컨설팅 ──────────────────────────────────────────────
let consultViewer = null;
function gotoConsult() {
  show('consult');
  const c = state.couple, d = state.diff;
  consultViewer = getStageViewer('stage-consult');
  consultViewer.setDuo(state.clientSpec, state.targetSpec, 'camera');

  $('#consult-title').innerHTML =
    `작전명: ${escapeHtml(c.client.name)} × ${escapeHtml(c.target.name)} <span class="diff-inline diff-${d.key}">난이도 ${escapeHtml(c.difficulty)}</span>`;
  $('#consult-sub').textContent = c.clash;
  $('#consult-dossier').innerHTML = dossierHtml(c);
  $('#radio-budget').textContent = `문자 ${d.radioText}회 / 대면 ${d.radioTalk}회`;

  ['#styling-result', '#coaching-result', '#speech-result'].forEach(s => { $(s).textContent = ''; });
  $('#styling-input').value = '';
  $('#coaching-input').value = '';
  $('#speech-input').value = '';
  updatePrepStatus();

  $('#btn-styling').onclick = runStyling;
  $('#coaching-input').oninput = () => {
    state.prep.coaching = $('#coaching-input').value;
    injectionPreview('#coaching-result', state.prep.coaching,
      '클라이언트 시스템 프롬프트의 [본부 요원의 대화 지침] 블록에 이렇게 들어간다',
      '지침 없음 \u2192 클라이언트가 <b>약점대로 행동</b>하고 화제를 스스로 열지 못한다');
    updatePrepStatus();
  };
  $('#speech-input').oninput = () => {
    state.prep.speech = $('#speech-input').value;
    injectionPreview('#speech-result', state.prep.speech,
      '출동 직전 [요원이 너에게 해준 말] 블록에 이렇게 들어간다',
      '연설 없음 \u2192 클라이언트가 <b>겁에 질린 채로</b> 나가 말끝을 흐린다');
    updatePrepStatus();
  };
  $('#coaching-input').oninput();
  $('#speech-input').oninput();
  $('#btn-start-op').onclick = () => { sfx.radio(); startOperation(); };
  $('#btn-back-roster').onclick = () => { sfx.click(); gotoRoster(); };
}

// 준비 단계는 채점이 아니라 주입이다 — 그러니 무엇이 주입되는지 그대로 보여준다.
function injectionPreview(sel, text, label, emptyNote) {
  const el = $(sel);
  const t = (text || '').trim();
  if (!t) { el.innerHTML = `<span class="inject-empty">미기재 — ${emptyNote}</span>`; return; }
  el.innerHTML = `<span class="inject-label">${escapeHtml(label)} · ${t.length}자</span>`
    + `<code class="inject-code">"""\n${escapeHtml(t)}\n"""</code>`;
}

async function runStyling() {
  sfx.click();
  const tags = $('#styling-input').value.trim();
  if (!tags) return toast('스타일링 태그를 입력하라. 예: 빨간 턱시도, 카우보이 부츠');
  try {
    const r = await withLoading('가위손 박 시공 중...', () => llm.call({
      label: '스타일링 시공', system: P.STYLING_SYSTEM,
      messages: [{ role: 'user', content: P.stylingUser(state.couple, state.clientSpec, tags) }],
      schema: P.STYLING_SCHEMA, effort: 'low', maxTokens: 4000,
    }));
    state.clientSpec = sanitizeSpec(r.spec);
    state.prep.outfitDesc = r.outfitDesc || tags;
    consultViewer.updateLeft(state.clientSpec);
    consultViewer.burst('sparkle', 'left');
    $('#styling-result').innerHTML =
      `<span class="outfit">착장: ${escapeHtml(state.prep.outfitDesc)}</span><br><span class="dim">시공 소견 — ${escapeHtml(r.comment)}</span>`;
    sfx.stamp();
  } catch (e) { toast(errMsg(e)); }
  updatePrepStatus();
}

function updatePrepStatus() {
  const p = state.prep;
  const missing = [];
  if (!p.outfitDesc) missing.push('스타일링');
  if (!p.coaching.trim()) missing.push('코칭');
  if (!p.speech.trim()) missing.push('격려 연설');
  const el = $('#prep-status');
  if (!missing.length) {
    el.className = 'prep-warning ok';
    el.innerHTML = '세 항목 모두 기재됨. 이것이 좋은 프롬프트인지는 <b>대화가 판정한다.</b>';
    return;
  }
  el.className = 'prep-warning warn';
  el.innerHTML = `<b>비어 있음:</b> ${missing.join(', ')}<br>` +
    `비워도 작전은 개시된다. 대신 그 인간은 ${missing.includes('코칭') ? '<b>약점대로 행동하고</b> ' : ''}` +
    `${missing.includes('격려 연설') ? '<b>겁에 질린 채로</b> ' : ''}${missing.includes('스타일링') ? '<b>평상복 차림으로</b> ' : ''}나간다.`;
}

// ── 대화 화면 ───────────────────────────────────────────
let stageViewer = null;

function meterUpdate(s) {
  const f = P.frameOf(state.couple.endingKind);
  $('#meter-love-name').textContent = f.meterName;
  $('#meter-love-fill').style.width = s.love + '%';
  $('#meter-mood-fill').style.width = s.mood + '%';
  $('#meter-love-num').textContent = s.love;
  $('#meter-mood-num').textContent = s.mood;
  $('#meter-threshold').style.left = s.threshold + '%';
  $('#meter-moodfloor').style.left = s.moodFloor + '%';
  $('#hud-mult').textContent = `분위기 배율 ×${s.mult}`;
  $('#hud-mult').className = 'hud-chip ' + (s.mult >= 1.2 ? 'good' : s.mult >= 0.8 ? '' : 'bad');
  $('#meter-mood-fill').classList.toggle('danger', s.mood < s.moodFloor);
  $('#btn-intervene').textContent = `무전 개입 (잔여 ${s.radioLeft})`;
  $('#btn-intervene').disabled = s.radioLeft <= 0;

  const t = state.couple.target;
  $('#intel-count').textContent = `${s.visibleTotal + s.foundCount} / ${s.visibleTotal + s.hiddenTotal}건 파악`;
  $('#intel-list').innerHTML =
    t.visiblePrefs.map(p => `<li class="known">${escapeHtml(p)}</li>`).join('') +
    Array.from({ length: s.hiddenTotal }, (_, i) => i < s.foundCount
      ? '<li class="found">미확인 취향 — 적중 (종료 후 기밀 해제)</li>'
      : '<li class="unknown">미확인 취향 — 미파악</li>').join('');
  $('#redline-count').textContent = s.redLines ? `위반 ${s.redLines}회` : '위반 없음';
  $('#redline-list').innerHTML = t.redLines.map(p => `<li class="mine">${escapeHtml(p)}</li>`).join('');
}

function addBubble(who, text) {
  const w = $('#chat-window');
  const div = document.createElement('div');
  div.className = `bubble ${who}`;
  const name = who === 'client' ? state.couple.client.name : who === 'target' ? state.couple.target.name
    : who === 'radio' ? '본부 무전' : '상황';
  div.innerHTML = `<span class="who">${escapeHtml(name)}</span>${escapeHtml(text)}`;
  w.appendChild(div);
  w.scrollTop = w.scrollHeight;
  if (who === 'client') { stageViewer?.say('left'); sfx.send(); }
  else if (who === 'target') { stageViewer?.say('right'); sfx.send(); }
  else if (who === 'radio') sfx.radio();
}

function addJudge(j) {
  const w = $('#judge-feed');
  const div = document.createElement('div');
  const cls = j.love > 0 ? 'good' : j.love < 0 ? 'bad' : 'meh';
  const tags = [
    j.hit ? '<span class="tag hit">미확인 취향 적중</span>' : '',
    j.red ? '<span class="tag red">금지항목 접촉</span>' : '',
    j.firstImpression ? '<span class="tag first">대면 첫인상</span>' : '',
    `<span class="tag calc">판정 ${j.rawLove >= 0 ? '+' : ''}${j.rawLove} × 분위기 ${j.mult}</span>`,
  ].join('');
  div.className = `judge-line ${cls}`;
  div.innerHTML = `<b>분위기 ${j.mood >= 0 ? '+' : ''}${j.mood} · 호감 ${j.love >= 0 ? '+' : ''}${j.love}</b> ${escapeHtml(j.reason)}${tags}`;
  w.prepend(div);
  while (w.children.length > 10) w.lastChild.remove();
  if (j.red) { stageViewer?.burst('bad', 'right'); sfx.trombone(); }
  else if (j.love > 0) { stageViewer?.burst('love', 'right'); sfx.love(); }
  else if (j.love < 0) { stageViewer?.burst('bad', 'right'); sfx.bad(); }
}

function setupChatScreen(title) {
  show('chat');
  $('#chat-window').innerHTML = '';
  $('#judge-feed').innerHTML = '';
  $('#chat-phase-label').textContent = title;
  $('#hud-diff').textContent = `난이도 ${state.couple.difficulty} · 성공선 ${state.diff.threshold}`;
  $('#hud-diff').className = `hud-chip diff-${state.diff.key}`;
}

async function startOperation() {
  state.prep.coaching = $('#coaching-input').value.trim();
  state.prep.speech = $('#speech-input').value.trim();

  const handlers = {
    bubble: addBubble,
    judge: addJudge,
    meters: meterUpdate,
    turn: t => { $('#turn-badge').textContent = `${t.phase === 'text' ? '문자' : '대면'} ${t.turn}/${t.turns}턴`; },
    phase: p => { $('#turn-badge').textContent = `${p.phase === 'text' ? '문자' : '대면'} 0/${p.turns}턴`; },
    intel: i => { toast(`미확인 취향 적중 (${i.found}/${i.total}건) — 내용은 작전 종료 후 기밀 해제`, 6000); sfx.fanfare(); },
    redline: r => { toast(`접촉 금지 항목 위반 ${r.count}회 — 분위기·호감 동시 하락`, 6000); },
  };

  const engine = new Engine(llm, { couple: state.couple, prep: state.prep, handlers });
  state.engine = engine;

  setupChatScreen('작전 1단계 · 문자 공작');
  stageViewer = getStageViewer('stage-chat');
  stageViewer.setDuo(state.clientSpec, state.targetSpec, 'camera');
  document.body.classList.add('phase-text');
  document.body.classList.remove('phase-talk');
  meterUpdate(engine.snapshot());

  try {
    const alive = await engine.runTexting();
    if (alive) {
      const sit = await withLoading('데이트 장소 섭외 중...', () => engine.situation());
      setupChatScreen(`작전 2단계 · 대면 공작 — ${sit.place}`);
      stageViewer = getStageViewer('stage-chat');
      stageViewer.setDuo(state.clientSpec, state.targetSpec, 'each');
      stageViewer.setParty(true);
      document.body.classList.remove('phase-text');
      document.body.classList.add('phase-talk');
      meterUpdate(engine.snapshot());
      await engine.runTalking(sit);
    }
  } catch (e) {
    toast(errMsg(e));
    addBubble('sys', '(전파 방해로 공작이 중단되었다...)');
    engine.aborted = true;
  }
  await gotoResult();
}

// ── 결과 ────────────────────────────────────────────────
function closeRadioModal() {
  state.engine?.setPaused(false);
  $('#modal-radio').classList.add('hidden');
}

async function gotoResult() {
  closeRadioModal();
  document.body.classList.remove('phase-text', 'phase-talk');
  const r = await withLoading('며칠 뒤... 결과 정산 중...', () => state.engine.finish());
  state.result = r;
  const c = state.couple;

  show('result');
  $('#btn-restart').classList.add('hidden');
  $('#btn-retry').classList.add('hidden');
  $('#result-epilogue').textContent = '';
  $('#result-mvp').textContent = '';

  const v = getStageViewer('stage-result');
  v.setDuo(state.clientSpec, state.targetSpec, r.verdict.accepted ? 'each' : 'camera');
  v.setParty(r.verdict.accepted);

  const stamp = $('#result-stamp');
  stamp.textContent = r.verdict.accepted ? c.winWord : r.aborted ? '작전 파탄' : '고백 반려';
  stamp.className = `result-stamp ${r.verdict.accepted ? 'ok' : 'fail'}`;
  $('#result-grade').textContent = `공작 등급: ${r.verdict.grade}`;
  $('#result-score').textContent =
    `호감 ${r.verdict.love}/${r.difficulty.threshold} · 분위기 ${r.verdict.mood}/${r.difficulty.moodFloor} · 난이도 ${r.difficulty.badge} · 결승선 ${c.endingKind}`;

  $('#debrief-summary').textContent = r.debrief.summary;
  $('#debrief-list').innerHTML = r.debrief.notes.map(n =>
    `<li class="${n.ok ? 'ok' : 'weak'}"><b>${escapeHtml(n.label)}</b> <span class="dscore">${escapeHtml(n.value)}</span><br><span class="dim">${escapeHtml(n.text)}</span></li>`).join('');
  $('#debrief-prefs').innerHTML =
    c.target.visiblePrefs.map(p => `<li class="known">${escapeHtml(p)} <span class="dim">(사전 통보)</span></li>`).join('') +
    r.debrief.found.map(p => `<li class="found">${escapeHtml(p)} <span class="dim">(작전 중 확보)</span></li>`).join('') +
    r.debrief.missed.map(p => `<li class="missed">${escapeHtml(p)} <span class="dim">(미확보)</span></li>`).join('');
  $('#debrief-turns').innerHTML =
    '<div class="turn-table-wrap"><table class="turn-table"><tr><th>턴</th><th>분위기</th><th>호감</th><th>누적 호감/분위기</th><th>판정</th></tr>' +
    r.state.history.map(h =>
      `<tr class="${h.dLove > 0 ? 'good' : h.dLove < 0 ? 'bad' : ''}">` +
      `<td>${h.turn}${h.firstImpression ? '·착장' : ''}${h.hit ? '·적중' : ''}${h.red ? '·위반' : ''}</td>` +
      `<td>${h.dMood >= 0 ? '+' : ''}${h.dMood}</td>` +
      `<td>${h.dLove >= 0 ? '+' : ''}${h.dLove} <span class="dim">[${escapeHtml(h.tier)}] ${h.rawLove >= 0 ? '+' : ''}${h.rawLove}×${h.mult}</span></td>` +
      `<td>${h.love} / ${h.mood}</td>` +
      `<td>${escapeHtml(h.reason)}</td></tr>`).join('') +
    '</table></div>';

  saveRun({
    id: c.id, client: c.client.name, target: c.target.name,
    difficulty: c.difficulty, diffKey: r.difficulty.key,
    grade: r.verdict.grade, accepted: r.verdict.accepted,
    love: r.verdict.love, threshold: r.difficulty.threshold,
  });

  sfx.stamp();
  setTimeout(() => {
    if (r.verdict.accepted) {
      sfx.fanfare(); v.burst('love');
      const iv = setInterval(() => { if (state.screen !== 'result') return clearInterval(iv); v.burst('love'); }, 2500);
    } else { sfx.trombone(); v.burst('rain'); }
  }, 600);

  await typeText($('#result-letter'), r.letter.letter, 60);
  $('#result-mvp').textContent = `승패를 가른 순간 — ${r.letter.mvp}`;
  $('#result-epilogue').textContent = `— 에필로그: ${r.letter.epilogue}`;
  $('#btn-retry').classList.remove('hidden');
  $('#btn-restart').classList.remove('hidden');
}

// ── 무전 모달 ───────────────────────────────────────────
function initRadio() {
  $('#btn-intervene').addEventListener('click', () => {
    const e = state.engine;
    if (!e || e.radioLeft <= 0) return;
    sfx.radio();
    e.setPaused(true);
    const t = state.couple.target;
    $('#radio-context').innerHTML =
      `<b>미확인 취향 잔여 ${t.hiddenPrefs.length - e.state.hits.length}건.</b> 화제를 지정하지 않으면 클라이언트는 스스로 캐내지 못한다.<br>` +
      `<span class="dim">접촉 금지: ${t.redLines.map(escapeHtml).join(' / ')}</span>`;
    $('#modal-radio').classList.remove('hidden');
    $('#radio-input').value = '';
    $('#radio-input').focus();
  });
  const send = () => {
    const text = $('#radio-input').value.trim();
    if (!text) return;
    const ok = state.engine?.submitRadio(text);
    if (!ok) toast('무전 개입권이 남아 있지 않다.');
    closeRadioModal();
  };
  $('#btn-radio-send').addEventListener('click', send);
  $('#radio-input').addEventListener('keydown', ev => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) send(); });
  $('#btn-radio-cancel').addEventListener('click', () => { sfx.click(); closeRadioModal(); });
}

// ── 초기화 ──────────────────────────────────────────────
function init() {
  initBoot();
  initIntro();
  initRadio();
  $('#btn-to-roster').addEventListener('click', () => { sfx.click(); gotoRoster(); });
  $('#btn-restart').addEventListener('click', () => { sfx.click(); gotoRoster(); });
  $('#btn-retry').addEventListener('click', () => { sfx.click(); chooseCouple(state.couple); });
  const toggleConsole = () => $('#console-panel').classList.toggle('hidden');
  $('#console-toggle').addEventListener('click', toggleConsole);
  $('#btn-console').addEventListener('click', toggleConsole);
  $('#btn-bgm').addEventListener('click', () => { $('#btn-bgm').textContent = toggleBgm() ? '음향 ON' : '음향 OFF'; });
  document.addEventListener('click', () => unlockAudio(), { once: true });
}
init();
