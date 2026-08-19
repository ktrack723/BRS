// game.js — 화면/입력 계층. 대화 오케스트레이션은 engine.js, 규칙은 scoring.js, API는 llm.js.
import { LlmClient, RefusalError } from './llm.js';
import * as P from './prompts.js';
import { Engine, prepReaction } from './engine.js';
import { DIFFICULTIES, diffOf } from './scoring.js';
import { COUPLES, flawReport, FLAW_LABELS } from './couples.js';
import { AvatarViewer, sanitizeSpec, renderThumb } from './avatar.js';
import { sfx, startBgm, toggleBgm, unlockAudio } from './audio.js';
import * as pace from './pacing.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const escapeHtml = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const llm = new LlmClient();

const state = {
  screen: 'boot',
  agent: { name: '', gender: '' },
  couple: null, clientSpec: null, targetSpec: null, diff: null,
  prep: { outfitDesc: '', coaching: '', speech: '' },
  prepReact: { styling: null, coaching: null, speech: null },
  engine: null, result: null,
  filter: '전체',
};
window.__game = { state, llm, DIFFICULTIES, COUPLES, pace }; // 자동 테스트 후크

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
  '참고 · 저 둘에게는 대화 규칙이 없다. 어디로 흐르든 심판이 알아서 해설한다.',
  '참고 · 분위기가 낮으면 상대가 무너져도 호감이 찔끔 오른다.',
  '참고 · 무전은 흐름에 끼어드는 유일한 손잡이다. 아끼면 그냥 소멸한다.',
  '참고 · 착장은 대면 첫 순간에 상대가 직접 보고 판정한다.',
  '참고 · 지침에 "무엇을 하지 마라"와 "무엇을 하라"를 같이 써라.',
  '참고 · 공기 옆 배지가 "전달 안 됨"이면 그 문장은 의뢰인에게 안 간다. 무전으로 직접 말해라.',
  '참고 · 가위손 박은 거절하지 않는다. 폭탄을 붙이라면 붙인다.',
  '참고 · 의뢰서의 「심리 감정」이 그 인간의 하자를 전부 적어둔다. 고르기 전에 읽어라.',
  '참고 · 요원 화면에 떴다고 의뢰인이 아는 게 아니다. 지뢰 목록도 마찬가지다.',
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

// 브리핑·편지처럼 '한 덩어리로 읽는 글'을 흘려 넣는다.
// 이건 재생 속도가 아니라 타자 연출이다 — 글이 화면에 그대로 남으니 읽는 속도는 사람이 정한다.
// 그래서 초당 글자 수는 넉넉히 잡고, 대신 재생 속도 설정과 '눌러서 건너뛰기'는 똑같이 먹힌다.
async function typeText(el, text, cps = 60) {
  const mult = pace.paceMult();
  let n = 0;
  await pace.typeInto(el, text, () => { if (n++ % 6 === 0) sfx.type(); },
    { typeMs: mult > 0 ? (text.length / cps) * 1000 * mult : 0, mult });
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
  const who = escapeHtml(P.agentLabel(state.agent));
  if (!runs.length) { el.innerHTML = `<b>요원 ${who}</b> · <span class="dim">첫 공작을 기다리는 중. 전적 없음.</span>`; return; }
  const wins = runs.filter(r => r.accepted).length;
  const best = runs.reduce((b, r) => GRADE_ORDER.indexOf(r.grade) > GRADE_ORDER.indexOf(b) ? r.grade : b, 'F');
  const cleared = clearedIds().size;
  el.innerHTML =
    `<b>요원 ${who}</b> · 공작 ${runs.length}회 · 성사 ${wins}회 (${Math.round(wins / runs.length * 100)}%) · 최고 등급 <b>${best}</b> · 정복한 조합 <b>${cleared}/${COUPLES.length}</b>` +
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
  $('#agent-name').value = sget('localStorage', 'cupid_agent_name') || '';
  $('#agent-gender').value = sget('localStorage', 'cupid_agent_gender') || '';

  $('#btn-boot').addEventListener('click', async () => {
    unlockAudio(); sfx.click();
    const name = $('#agent-name').value.trim();
    if (!name) return bootError('요원명 없이는 서류를 못 만든다. 아무거나 적어라.');
    const key = $('#key-input').value.trim();
    if (!key.startsWith('sk-ant-')) return bootError('그건 API 키가 아니라 그냥 문자열이다. sk-ant-... 형식의 키를 내놔라.');

    state.agent = { name, gender: $('#agent-gender').value.trim() };
    sset('localStorage', 'cupid_agent_name', state.agent.name);
    sset('localStorage', 'cupid_agent_gender', state.agent.gender || null);

    llm.apiKey = key;
    llm.model = $('#model-select').value;
    sset('localStorage', 'cupid_model', llm.model);
    sset('sessionStorage', 'cupid_key', key);
    sset('localStorage', 'cupid_key', $('#remember-key').checked ? key : null);
    try {
      await withLoading('본부 회선 연결 중... (키 인증)', () => llm.ping());
      startBgm();
      showIntro();
    } catch (e) {
      show('boot');
      bootError(errMsg(e));
    }
  });
  for (const sel of ['#key-input', '#agent-name', '#agent-gender']) {
    $(sel).addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-boot').click(); });
  }
}
function bootError(msg) {
  const el = $('#boot-error');
  el.textContent = msg; el.classList.remove('hidden');
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  sfx.bad();
}

// ── 신입 교육 슬라이드 ──────────────────────────────────
// 전부 큐피드국 교관이 신입 요원에게 하는 말이다.
// 개정 이력("예전엔 이랬다")이나 내부 구현 용어는 여기 들어오지 않는다 — 요원이 알 바 아니다.
const SLIDES = [
  {
    art: '큐피드局 / 공작요원 배속 통지',
    title: '큐피드국에 온 걸 환영한다',
    body: `2077년. 출산율 0.008. 국가비상사태.<br>
    자네는 <b>연애 공작 요원</b>이다. 자네가 연애하는 게 아니라, 연애 경험 0인 국민(<b>의뢰인</b>)이
    짝사랑 상대에게 고백하도록 <b>뒤에서 조작</b>하는 일이다.<br>
    <b>자네는 그 자리에 없다.</b> 말은 의뢰인이 한다. 자네는 그를 꾸미고, 겁을 주고,
    등을 떠밀고, 결정적일 때 무전을 넣는다. 그게 전부다.`,
  },
  {
    art: '어인 × 사자퍼리 &nbsp;│&nbsp; 뱀파이어 × 마늘농장 &nbsp;│&nbsp; 남혐 × 여혐',
    title: '우리 대장에는 정상적인 조합이 없다',
    body: `상설 의뢰 <b>${COUPLES.length}건</b>. 전부 이어질 리 없는 조합이다.<br>
    어인과 사자 퍼리, 뱀파이어와 마늘 농장주, 서로의 성별을 공개적으로 혐오해온 둘,
    30년 정적끼리, 그리고 전산 오류로 3년째 부부인 남남까지.<br>
    <b>결승선은 전부 같다 — 저 둘이 연인이 되는 것.</b> 예외는 없다.
    성립할 리 없는 조합이라는 걸 본국도 안다. 그래서 자네를 붙이는 것이다.`,
  },
  {
    art: '미용실 &nbsp;→&nbsp; 취조실 &nbsp;→&nbsp; 정문',
    title: '준비는 세 곳에서 한다',
    body: `<b>① 부속 미용실</b> — 가위손 박이 시키는 대로 시공한다. 거절하지 않는다.<br>
    <b>② 지하 3층 취조실</b> — 조명 아래 앉혀놓고 대화 지침을 하달한다.<br>
    <b>③ 청사 정문</b> — 등 떠밀기 직전 마지막 한마디를 던진다.<br>
    <span class="slide-warn">세 곳 전부 점수가 없다. 대신 그 인간이 그 자리에서 어떤 표정을 짓는지는 보여준다. 잘 봐둬라.</span>`,
  },
  {
    art: '자네가 쓴 문장 &nbsp;→&nbsp; 그 인간의 입 &nbsp;→&nbsp; 상대의 반응',
    title: '자네가 쓰는 문장은 채점되지 않는다',
    body: `<b>착장·지침·마지막 한마디·무전 — 본국은 이 중 무엇도 평가하지 않는다.</b><br>
    자네가 써넣은 문장은 <b>그대로 그 인간의 머릿속에 들어갈</b> 뿐이다.
    잘 쓴 글에 가산점을 주는 제도는 없다.<br>
    점수가 붙는 건 오직 <b>그래서 그 인간이 실제로 뭐라고 말했고, 상대가 어떻게 반응했는가</b>다.<br>
    <span class="slide-warn">그러니 준비를 대충 하면 감점되는 게 아니다 — 그 인간이 현장에서 알아서 망한다.</span>`,
  },
  {
    art: '대화 내용 통제 &nbsp;·&nbsp; 본국 권한 없음',
    title: '저 둘의 대화에는 규칙이 없다',
    body: `본국은 <b>저 둘이 무슨 얘기를 할지 정하지 않는다.</b> 대사를 정해주는 조항도,
    무슨 화제를 꺼내라는 지침도 없다.<br>
    저 둘에게 넘기는 건 <b>자기가 누구인지에 대한 기록뿐</b>이다. 고향, 통장 잔고,
    잠버릇, 흑역사까지. 그리고 마주 앉힌다.<br>
    그래서 대화는 아무 데로나 흘러간다. 세무 상담이 되기도 하고, 고성이 오가기도 한다.<br>
    <span class="slide-warn">심판은 그걸 "판정 불가"로 처리하지 않는다. 무슨 일이 벌어졌든 진지한 얼굴로 해설하고 등급을 매긴다.</span>`,
  },
  {
    art: '전원 하자 있음 &nbsp;·&nbsp; 예외 없음',
    title: '저 사람들은 상대에게 맞춰줄 생각이 없다',
    body: `<b>둘 다 그 자리에서 원하는 게 따로 있다.</b> 상대를 기쁘게 하는 게 아니라 —
    논쟁에서 이기고 싶거나, 자기 수집품 얘기를 끝까지 하고 싶거나, 그냥 빠져나가고 싶다.<br>
    그리고 <b>전원이 어딘가 고장나 있다.</b> 사람이 원래 그렇다.<br>
    · 눈치가 없는 사람에게는 <b>그 자리의 공기가 전달되지 않는다.</b> 상대가 시계를 봐도 모른다.<br>
    · 상대에게 관심이 없는 사람은 <b>상대의 성격도 취향도 모른다.</b> 알아볼 생각을 해본 적이 없다.<br>
    · 놔두면 각자 자기 관심사로 대화를 끌고 간다.<br>
    <span class="slide-warn">그러니 "알아서 잘하겠지"는 없다. 자네가 명령하지 않으면 그 인간은 제 성향대로만 군다.</span>`,
  },
  {
    art: '취향 ？／？ &nbsp;&nbsp; 접촉금지 전면공개',
    title: '상대의 속은 모른다. 대화로만 나온다',
    body: `상대의 취향 중 일부만 의뢰서에 인쇄되어 있다. 나머지는 <b>미확인</b>이며 <b>건수만</b> 통보된다.<br>
    이건 캐내라고 준 <b>수집 과제가 아니다.</b> 화제가 거기까지 흘러가면 나오고, 아니면 안 나온다.
    나왔다고 가산점이 붙지도 않는다 — 다만 그런 얘기가 나올 만큼 대화가 열렸다는 뜻이고, 그건 대체로 좋은 신호다.<br>
    반대로 <b>상대가 질색하는 것</b>은 자네에게 전부 공개된다. 의뢰서에도, 취조실에도, 계기판에도 떠 있다.<br>
    <span class="slide-warn">그런데 그 목록은 <b>의뢰인에게 넘어가지 않는다.</b> 취조실에서 직접 불러주지 않으면 그 인간은 모르는 채로 나가서 밟는다.</span>`,
  },
  {
    art: '의뢰서 &nbsp;·&nbsp; 심리 감정 &nbsp;·&nbsp; 작전 계기판',
    title: '자네가 아는 것과 의뢰인이 아는 것은 다르다',
    body: `정보는 두 겹이다. <b>자네가 보는 것</b>과 <b>그 인간 머릿속에 실제로 든 것</b>.<br>
    <b>의뢰서</b>에 「심리 감정」이 붙어 있다. 그 인간이 그 자리에서 뭘 원하는지, 눈치가 있는지,
    상대를 어디까지 아는지, 명령을 어떻게 받아들이는지 — 넷 다 인쇄되어 있다. <b>맡기 전에 읽어라.</b><br>
    현장에서는 계기판이 나머지를 말해준다. 공기 옆의 표식이 <b>「전달 안 됨」</b>이면
    그 문장은 의뢰인에게 한 글자도 안 간다 — 그때는 무전으로 직접 말해야 한다.<br>
    <span class="slide-warn">자네 화면에 떴다고 의뢰인이 아는 게 아니다. 이 경계를 놓치면 작전이 통째로 헛돈다.</span>`,
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
    `<div class="slide"><div class="slide-art">${s.art}</div><h3>${s.title}</h3><p>${s.body}</p></div>`;
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

// ── 브리핑 (하드코딩) ───────────────────────────────────
// 매 판 똑같은 소리를 하는 데 LLM 호출을 태울 이유가 없다.
// 고정 대사가 되면서 프리페치·실패 폴백·"국장 회선 잡음" 처리가 통째로 사라졌다.
async function gotoBriefing() {
  show('briefing');
  $('#btn-to-roster').classList.add('hidden');
  await typeText($('#briefing-text'), P.briefingText(state.agent), 90);
  $('#btn-to-roster').classList.remove('hidden');
}

// ── 의뢰 대장 ───────────────────────────────────────────
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
        <figure><img alt="${escapeHtml(c.client.name)}" src="${renderThumb(c.client.spec, c.id + ':c')}"><figcaption>${escapeHtml(c.client.name)}<span class="cc-sex">${escapeHtml(c.client.gender)}</span></figcaption></figure>
        <div class="cc-vs">✕</div>
        <figure><img alt="${escapeHtml(c.target.name)}" src="${renderThumb(c.target.spec, c.id + ':t')}"><figcaption>${escapeHtml(c.target.name)}<span class="cc-sex">${escapeHtml(c.target.gender)}</span></figcaption></figure>
      </div>
      <p class="cc-clash">${escapeHtml(c.clash)}</p>
      <ul class="cc-meta">
        <li>성공선 <b>${d.threshold}</b></li>
        <li>미확인 <b>${c.target.hiddenPrefs.length}</b></li>
        <li>금지 <b>${c.target.redLines.length}</b></li>
      </ul>
      <div class="cc-flaws" title="의뢰인 심리 감정">${flawReport(c.client)
        .map(r => `<span class="flaw-tag lv-${r.level}">${escapeHtml(r.tag)}</span>`).join('')}</div>
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
    <h3>${escapeHtml(c.client.name)} <small>(${escapeHtml(P.idOf(c.client))}, ${escapeHtml(c.client.job)})</small></h3>
    <p class="story">${escapeHtml(c.client.story)}</p>
    <p><b>외모:</b> ${c.client.appearance.map(escapeHtml).join(', ')}</p>
    <p><b>성격:</b> ${c.client.personality.map(escapeHtml).join(', ')}</p>
    <p><b>내력:</b> ${c.client.background.map(escapeHtml).join(' · ')}</p>
    <p class="weakness"><b>취약점:</b> ${escapeHtml(c.client.weakness)} <span class="dim">— 지침으로 봉인해야 한다</span></p>
    <p class="quote">“${escapeHtml(c.client.quote)}”</p>
    ${flawHtml(c.client)}
    <hr>
    <h3>상대 · ${escapeHtml(c.target.name)} <small>(${escapeHtml(P.idOf(c.target))}, ${escapeHtml(c.target.job)})</small></h3>
    <p><b>외모:</b> ${c.target.appearance.map(escapeHtml).join(', ')}</p>
    <p><b>성격:</b> ${c.target.personality.map(escapeHtml).join(', ')}</p>
    <p><b>내력:</b> ${c.target.background.map(escapeHtml).join(' · ')}</p>
    <p><b>알려진 취향:</b> ${c.target.visiblePrefs.map(escapeHtml).join(', ')}</p>
    <p class="unknown-prefs"><b>미확인 취향 ${c.target.hiddenPrefs.length}건</b> — 내용 비공개. 대화가 거기까지 흘러가야만 나온다</p>
    <p class="redline-box"><b>접촉 금지 항목:</b> ${c.target.redLines.map(escapeHtml).join(' / ')}
      <br><span class="handoff-warn">이 목록은 <b>의뢰인에게 전달되지 않았다.</b> 취조실에서 직접 불러주지 않으면 그 인간은 모르는 채로 나간다.</span></p>
    <p class="unknown-prefs"><b>상대 심리 감정:</b> 미실시 — 상대는 우리 국민이 아니다. 저 사람이 뭘 원하고 뭘 못 읽는지는 대화로만 드러난다</p>
    <hr>
    <p class="clash-line"><b>이 매칭이 지옥인 이유:</b> ${escapeHtml(c.clash)}</p>
    <div class="diff-box diff-${d.key}">
      <span class="diff-name">난이도 ${escapeHtml(c.difficulty)}</span>
      <span class="diff-detail">성공선 호감 ${d.threshold} (분위기 ${d.moodFloor} 이상) · 무전 ${d.radioText}+${d.radioTalk}회 · 총 ${d.textTurns + d.talkTurns}턴</span>
    </div>
    ${full ? `<div class="modal-btns"><button class="btn95 big" id="dossier-take">이 조합을 맡는다</button><button class="btn95" id="dossier-close">닫기</button></div>` : ''}`;
}

// 의뢰인 심리 감정. flaw 데이터를 그대로 요원에게 보여준다.
// 이걸 숨겨두면 지침이 왜 씹히는지, 공기를 왜 못 읽는지 플레이어가 영영 알 수 없다.
function flawHtml(person) {
  const rows = flawReport(person);
  if (!rows.length) return '';
  return `<div class="flaw-box">
    <h4>심리 감정 <span class="dim">— 사전 면담 기록</span></h4>
    <p class="flaw-want"><b>이 자리에서 원하는 것:</b> ${escapeHtml(person.flaw.want)}
      <br><span class="dim">상대를 위해서가 아니다. 이 사람 입에서 나오는 말은 전부 여기서 출발한다.</span></p>
    <p class="flaw-want"><b>몸이 원하는 것:</b> ${escapeHtml(person.flaw.urge)}
      <br><span class="dim">본인은 입 밖에 낼 생각이 없다. 술이 들어가면 모른다.</span></p>
    <p class="flaw-want dirty"><b>이미 넘어본 선:</b> ${escapeHtml(person.flaw.nerve)}
      <br><span class="dim">착한 사람이 아니다. 시키면 한다는 뜻이기도 하다.</span></p>
    <ul class="flaw-list">
      ${rows.map(r => `<li class="lv-${r.level}"><span class="flaw-axis">${escapeHtml(r.axis)}</span>
        <span class="flaw-tag lv-${r.level}">${escapeHtml(r.tag)}</span>
        <span class="flaw-desc">${escapeHtml(r.desc)}</span></li>`).join('')}
      <li class="lv-mid"><span class="flaw-axis">화제 회귀</span>
        <span class="flaw-tag lv-mid">고정</span>
        <span class="flaw-desc">${escapeHtml(person.flaw.fixation)}</span></li>
    </ul>
  </div>`;
}

// 취조실·정문에서 곁눈질할 상대 요약. 의뢰서 전문을 다시 깔면 화면이 무거워진다.
function targetBriefHtml(c) {
  const f = c.client.flaw || {};
  const rows = flawReport(c.client);
  const comply = rows.find(r => r.key === 'compliance');
  // 의뢰인이 상대에 대해 실제로 아는 범위. 요원이 아는 것과 다르다 — 이걸 안 알려주면 지침이 헛돈다.
  const knows = f.attention === 'self'
    ? '겉모습뿐. <b>성격도 취향도 모른다.</b>'
    : f.attention === 'mixed'
      ? '겉모습과 성격. <b>뭘 좋아하는지는 모른다.</b>'
      : '겉모습·성격·알려진 취향까지.';
  return `<h3>상대 · ${escapeHtml(c.target.name)} <small>(${escapeHtml(P.idOf(c.target))})</small></h3>
    <p><b>성격:</b> ${c.target.personality.map(escapeHtml).join(', ')}</p>
    <p><b>알려진 취향:</b> ${c.target.visiblePrefs.map(escapeHtml).join(' / ')}</p>
    <p class="redline-box"><b>질색:</b> ${c.target.redLines.map(escapeHtml).join(' / ')}</p>
    <p class="handoff-warn"><b>이 화면의 정보는 의뢰인에게 자동으로 넘어가지 않는다.</b>
      의뢰인이 아는 것: ${knows} 나머지는 <b>지침에 직접 적어야</b> 그 인간 머릿속에 들어간다.</p>
    <p class="weakness"><b>의뢰인 취약점:</b> ${escapeHtml(c.client.weakness)}</p>
    ${comply ? `<p class="brief-flaw lv-${comply.level}"><b>의뢰인 지침 수용:</b>
      ${escapeHtml(comply.tag)} — ${escapeHtml(comply.desc)}</p>` : ''}`;
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
  state.prepReact = { styling: null, coaching: null, speech: null };
  state.engine = null; state.result = null;
  gotoSalon();
}

// ── 준비 단계는 채점이 아니라 주입이다 — 무엇이 주입되는지 그대로 보여준다 ──
function injectionPreview(sel, text, label, emptyNote) {
  const el = $(sel);
  const t = (text || '').trim();
  if (!t) { el.innerHTML = `<span class="inject-empty">미기재 — ${emptyNote}</span>`; return; }
  el.innerHTML = `<span class="inject-label">${escapeHtml(label)} · ${t.length}자</span>`
    + `<code class="inject-code">"""\n${escapeHtml(t)}\n"""</code>`;
}

// 반응 카드 하나. "몇 점입니다"가 아니라 "그 인간이 그 말을 듣고 이랬습니다".
function reactionHtml(who, reaction, note) {
  return `<div class="react-line"><span class="react-who">${escapeHtml(who)}</span>${escapeHtml(reaction)}</div>` +
    (note ? `<div class="react-note">기록관 — ${escapeHtml(note)}</div>` : '');
}

// ── ① 미용실 ────────────────────────────────────────────
let salonViewer = null;
function gotoSalon() {
  show('salon');
  const c = state.couple;
  salonViewer = getStageViewer('stage-salon');
  salonViewer.setDuo(state.clientSpec, state.targetSpec, 'camera');

  $('#salon-title').innerHTML =
    `큐피드국 부속 미용실 「가위손 박」 <span class="diff-inline diff-${state.diff.key}">${escapeHtml(c.client.name)} × ${escapeHtml(c.target.name)} · ${escapeHtml(c.difficulty)}</span>`;
  $('#salon-dossier').innerHTML = dossierHtml(c);
  $('#styling-input').value = state.prepReact.styling?.tags || '';
  renderStylingResult();

  $('#btn-styling').onclick = runStyling;
  $('#btn-salon-back').onclick = () => { sfx.click(); gotoRoster(); };
  $('#btn-salon-next').onclick = () => { sfx.click(); gotoInterro(); };
}

function renderStylingResult() {
  const r = state.prepReact.styling;
  const el = $('#styling-result');
  if (!r) {
    el.innerHTML = '<span class="inject-empty">아직 시공하지 않았다 — 이대로 나가면 <b>평상복 차림</b>이다</span>';
    return;
  }
  el.innerHTML =
    `<div class="react-outfit">완성: ${escapeHtml(r.outfitDesc)}</div>` +
    reactionHtml('가위손 박', r.comment, '') +
    reactionHtml(state.couple.client.name + ' (거울을 보고)', r.clientReaction, '');
}

async function runStyling() {
  sfx.click();
  const tags = $('#styling-input').value.trim();
  if (!tags) return toast('시공 지시를 적어라. 예: 빨간 턱시도, 카우보이 부츠, 등에 폭탄');
  try {
    const r = await withLoading('가위손 박 시공 중...', () => llm.call({
      label: '스타일링 시공', system: P.STYLING_SYSTEM,
      messages: [{ role: 'user', content: P.stylingUser(state.couple, state.clientSpec, tags, state.agent) }],
      schema: P.STYLING_SCHEMA, effort: 'low', maxTokens: 5000,
    }));
    state.clientSpec = sanitizeSpec(r.spec);
    state.prep.outfitDesc = r.outfitDesc || tags;
    state.prepReact.styling = { ...r, tags };
    salonViewer.updateLeft(state.clientSpec);
    salonViewer.burst('sparkle', 'left');
    salonViewer.emote('left', r.clientFace || 'talk');
    renderStylingResult();
    sfx.stamp();
  } catch (e) { toast(errMsg(e)); }
}

// ── ② 취조실 ────────────────────────────────────────────
let interroViewer = null;
function gotoInterro() {
  show('interro');
  const c = state.couple;
  interroViewer = getStageViewer('stage-interro');
  interroViewer.setSolo(state.clientSpec);
  $('#interro-brief').innerHTML = targetBriefHtml(c);
  $('#coaching-input').value = state.prep.coaching;

  const sync = () => {
    state.prep.coaching = $('#coaching-input').value;
    injectionPreview('#coaching-inject', state.prep.coaching,
      '그 인간의 머릿속에 이 문장이 이렇게 박힌다',
      '지침 없음 → 그 인간은 <b>준비 없이</b> 나가고, 약점이 그대로 나온다');
  };
  $('#coaching-input').oninput = sync;
  sync();
  renderPrepReact('#coaching-result', 'coaching');

  $('#btn-coaching').onclick = () => runPrepReact('coaching', '취조실 반응 대기 중...', interroViewer);
  $('#btn-interro-back').onclick = () => { sfx.click(); gotoSalon(); };
  $('#btn-interro-next').onclick = () => { sfx.click(); gotoGate(); };
}

// ── ③ 정문 ──────────────────────────────────────────────
let gateViewer = null;
function gotoGate() {
  show('gate');
  const c = state.couple, d = state.diff;
  gateViewer = getStageViewer('stage-gate');
  gateViewer.setSolo(state.clientSpec);
  $('#gate-brief').innerHTML = targetBriefHtml(c);
  $('#radio-budget').textContent = `문자 ${d.radioText}회 / 대면 ${d.radioTalk}회`;
  $('#speech-input').value = state.prep.speech;

  const sync = () => {
    state.prep.speech = $('#speech-input').value;
    injectionPreview('#speech-inject', state.prep.speech,
      '출동 직전 [요원이 너에게 해준 말] 블록에 이렇게 들어간다',
      '한마디 없음 → 그 인간은 <b>아무 말도 못 듣고</b> 등 떠밀려 나간다');
    updatePrepStatus();
  };
  $('#speech-input').oninput = sync;
  sync();
  renderPrepReact('#speech-result', 'speech');

  $('#btn-speech').onclick = () => runPrepReact('speech', '정문 반응 대기 중...', gateViewer);
  $('#btn-gate-back').onclick = () => { sfx.click(); gotoInterro(); };
  $('#btn-start-op').onclick = () => { sfx.radio(); startOperation(); };
}

function renderPrepReact(sel, scene) {
  const r = state.prepReact[scene];
  const el = $(sel);
  if (!r) {
    el.innerHTML = '<span class="inject-empty">아직 확인하지 않았다 — 반응을 안 보고 그냥 보내도 된다</span>';
    return;
  }
  el.innerHTML = reactionHtml(state.couple.client.name, r.reaction, r.note);
}

async function runPrepReact(scene, label, viewer) {
  sfx.click();
  const text = scene === 'coaching' ? state.prep.coaching : state.prep.speech;
  try {
    const r = await withLoading(label, () => prepReaction(llm, {
      couple: state.couple, agent: state.agent, scene, text,
    }));
    state.prepReact[scene] = r;
    viewer?.emote('left', r.face || 'talk');
    renderPrepReact(scene === 'coaching' ? '#coaching-result' : '#speech-result', scene);
    sfx.stamp();
  } catch (e) { toast(errMsg(e)); }
}

function updatePrepStatus() {
  const p = state.prep;
  const missing = [];
  if (!p.outfitDesc) missing.push('착장');
  if (!p.coaching.trim()) missing.push('대화 지침');
  if (!p.speech.trim()) missing.push('마지막 한마디');
  const el = $('#prep-status');
  if (!el) return;
  if (!missing.length) {
    el.className = 'prep-warning ok';
    el.innerHTML = '세 항목 모두 기재됨. 이게 잘 쓴 것인지는 <b>현장이 판정한다.</b>';
    return;
  }
  el.className = 'prep-warning warn';
  el.innerHTML = `<b>비어 있음:</b> ${missing.join(', ')}<br>` +
    `비워도 작전은 개시된다. 대신 그 인간은 ${missing.includes('대화 지침') ? '<b>준비 없이</b> ' : ''}` +
    `${missing.includes('마지막 한마디') ? '<b>아무 말도 못 듣고</b> ' : ''}${missing.includes('착장') ? '<b>평상복 차림으로</b> ' : ''}나간다.`;
}

// ── 대화 화면 ───────────────────────────────────────────
let stageViewer = null;

function meterUpdate(s) {
  $('#meter-love-name').textContent = P.ENDING.meterName;
  $('#meter-love-fill').style.width = s.love + '%';
  $('#meter-mood-fill').style.width = s.mood + '%';
  $('#meter-love-num').textContent = s.love;
  $('#meter-mood-num').textContent = s.mood;
  $('#meter-threshold').style.left = s.threshold + '%';
  $('#meter-moodfloor').style.left = s.moodFloor + '%';
  $('#hud-mult').textContent = `분위기 배율 ×${s.mult}`;
  $('#hud-mult').className = 'hud-chip ' + (s.mult >= 1.2 ? 'good' : s.mult >= 0.8 ? '' : 'bad');
  // 후반에 같은 판정인데 호감이 덜 오르는 이유. 여태 화면 어디에도 없었다.
  $('#hud-sat').textContent = `호감 포화 ×${s.loveSat}`;
  $('#hud-sat').className = 'hud-chip ' + (s.loveSat >= 0.8 ? '' : s.loveSat >= 0.5 ? 'warn' : 'bad');
  $('#hud-sat').title = `이미 호감 ${s.love}. 여기서부터는 같은 판정이라도 ${Math.round(s.loveSat * 100)}%만 오른다.`;
  $('#hud-turns').textContent = `남은 턴 ${s.turnsLeft}/${s.turnsTotal}`;
  // 페이즈 길이에 비례해서 경고한다. 절대값으로 재면 4턴짜리 문자 페이즈는 내내 빨갛다.
  const left = s.turnsTotal ? s.turnsLeft / s.turnsTotal : 1;
  $('#hud-turns').className = 'hud-chip ' + (left <= 0.25 ? 'bad' : left <= 0.5 ? 'warn' : '');
  $('#meter-mood-fill').classList.toggle('danger', s.mood < s.moodFloor);
  $('#btn-intervene').textContent = `무전 개입 (잔여 ${s.radioLeft})`;
  $('#btn-intervene').disabled = s.radioLeft <= 0;
  markVibeReach(s.reads);

  const t = state.couple.target;
  $('#intel-count').textContent = `대화 중 ${s.revealedCount}건 · 미확인 ${s.secretLeft}건 남음`;
  $('#intel-list').innerHTML =
    t.visiblePrefs.map(p => `<li class="known">${escapeHtml(p)} <span class="dim">(사전 통보)</span></li>`).join('') +
    s.revealed.map(p => `<li class="found">${escapeHtml(p)}</li>`).join('') +
    (s.revealedCount === 0 ? '<li class="unknown">아직 새로 드러난 것 없음</li>' : '') +
    (s.secretLeft > 0 ? `<li class="unknown">감춰둔 취향 ${s.secretLeft}건 미확인 — 대화가 거기까지 흘러가야 나온다</li>` : '');
  $('#redline-list').innerHTML = t.redLines.map(p => `<li class="mine">${escapeHtml(p)}</li>`).join('');
}

// 화면 위의 공기가 의뢰인에게 실제로 닿는지. 안 닿는 사람에게 공기 바를 그냥 띄워두면
// 플레이어는 "분위기만 잡으면 알아서 맞춰가겠지"라고 믿는다. 그건 거짓말이다.
const VIBE_REACH = {
  well: { cls: 'reach-ok', tag: '전달됨', note: '이 공기가 매번 의뢰인에게 그대로 넘어간다' },
  some: { cls: 'reach-half', tag: '절반만 전달', note: '공기가 바뀌어도 두 번에 한 번만 넘어간다' },
  none: { cls: 'reach-none', tag: '전달 안 됨', note: '이 사람은 공기를 못 읽는다. 이 문장은 의뢰인에게 한 글자도 안 간다 — 무전으로 직접 말해야 한다' },
};
function markVibeReach(reads) {
  const r = VIBE_REACH[reads] || VIBE_REACH.well;
  const bar = $('#vibe-bar');
  bar.classList.remove('reach-ok', 'reach-half', 'reach-none');
  bar.classList.add(r.cls);
  const el = $('#vibe-reach');
  if (el) { el.textContent = r.tag; el.title = r.note; }
}

function setVibe(text) {
  if (!text) return;
  const el = $('#vibe-text');
  el.textContent = text;
  const bar = $('#vibe-bar');
  bar.classList.remove('pulse'); void bar.offsetWidth; bar.classList.add('pulse');
}

// 판정은 한 턴 늦게 온다. 말풍선이 뜨는 즉시 몸이 반응하도록 문장에서 표정을 유추한다.
// 심판이 보내주는 emote는 그 다음 박자에 덧씌워진다 — 즉각 반사 + 뒤늦은 감정, 두 겹이다.
function emoteFromText(text) {
  const t = String(text || '');
  if (/ㅋㅋ|ㅎㅎ|하하|푸하|웃음/.test(t)) return 'laugh';
  if (/[?？]\s*$/.test(t) && t.length < 24) return 'nod';
  if (/(\.\.\.|…)\s*$/.test(t)) return 'freeze';
  if (/(헉|뭐라고|미쳤|말도 안|어떻게 이런)/.test(t)) return 'panic';
  if (/(죄송|미안|부끄|민망|아니 그게)/.test(t)) return 'shy';
  if (/(닥쳐|꺼져|시끄|그만|짜증|화가|어이없)/.test(t)) return 'angry';
  if (/(아닙니다|아니에요|됐어요|괜찮아요)/.test(t)) return 'cringe';
  if (/[!]{2,}|최고|완벽|당연하죠/.test(t)) return 'proud';
  return 'talk';
}

// 말풍선 하나. 표정·효과음은 즉시 붙고, 글자는 읽는 속도로 흐른다.
// engine이 이 함수를 await 하므로 여기서 붙잡는 동안 다음 턴이 시작되지 않는다 —
// 그래야 무전 개입이 '지금 이 장면'에 끼어드는 게 된다.
async function addBubble(who, text) {
  const w = $('#chat-window');
  const div = document.createElement('div');
  div.className = `bubble ${who}`;
  const name = who === 'client' ? state.couple.client.name : who === 'target' ? state.couple.target.name
    : who === 'radio' ? '본부 무전' : '상황';
  div.innerHTML = `<span class="who">${escapeHtml(name)}</span><span class="say"></span>`;
  const say = div.querySelector('.say');
  w.appendChild(div);
  const follow = () => { w.scrollTop = w.scrollHeight; };
  follow();
  if (who === 'client') { stageViewer?.emote('left', emoteFromText(text)); sfx.send(); }
  else if (who === 'target') { stageViewer?.emote('right', emoteFromText(text)); sfx.send(); }
  else if (who === 'radio') sfx.radio();

  // 무전은 요원이 방금 자기 손으로 쓴 문장이다. 읽어줄 이유가 없다.
  if (who === 'radio') { say.textContent = text; follow(); return; }

  const plan = pace.bubblePlan(text);
  await pace.typeInto(say, text, follow, { typeMs: plan.typeMs });
  follow();
  await pace.beat(plan.beatMs);
}

// 등급 → 무대 연출. 이제 '취향 적중'이 아니라 '상대가 얼마나 움직였는가'가 기준이다.
const TIER_FX = {
  breakthrough: { burst: 'love', label: '방어선 붕괴', cls: 'big' },
  warm: { burst: 'ok', label: '통했다', cls: 'good' },
  nudge: { burst: 'sparkle', label: '조금 통함', cls: 'good' },
  flat: { burst: null, label: '아무 일도 없음', cls: 'meh' },
  chill: { burst: 'rain', label: '상대가 식음', cls: 'bad' },
  disaster: { burst: 'bad', label: '정색', cls: 'bad' },
};

function addJudge(j) {
  const w = $('#judge-feed');
  const fx = TIER_FX[j.tier] || TIER_FX.flat;
  const div = document.createElement('div');
  const tags = [
    `<span class="tag tier ${j.tier}">${escapeHtml(fx.label)}</span>`,
    j.revealed ? `<span class="tag hit">새로 드러남: ${escapeHtml(j.revealed)}</span>` : '',
    j.firstImpression ? '<span class="tag first">대면 첫인상</span>' : '',
    `<span class="tag calc">판정 ${j.rawLove >= 0 ? '+' : ''}${j.rawLove} × 분위기 ${j.mult}</span>`,
  ].join('');
  div.className = `judge-line ${fx.cls}`;
  div.innerHTML = `<b>분위기 ${j.mood >= 0 ? '+' : ''}${j.mood} · 호감 ${j.love >= 0 ? '+' : ''}${j.love}</b> ${escapeHtml(j.reason)}${tags}`;
  w.prepend(div);
  while (w.children.length > 24) w.lastChild.remove();
  if (fx.burst) stageViewer?.burst(fx.burst, 'right');
  if (j.tier === 'breakthrough') sfx.fanfare();
  else if (j.love > 0) sfx.love();
  else if (j.tier === 'disaster') sfx.trombone();
  else if (j.love < 0) sfx.bad();
  // 판정은 이 게임에서 유일한 피드백이다. 게이지가 움직이는 걸 볼 시간은 줘야 한다.
  return pace.beat(pace.judgeMs(j.reason));
}

function setupChatScreen(title, { keepFeed = false } = {}) {
  show('chat');
  $('#chat-window').innerHTML = '';
  // 문자 페이즈의 판정을 대면 중에 되짚어볼 수 없으면, 뭘 잘못했는지 알 길이 없다.
  // 화면은 갈아엎되 판정 기록은 구분선만 긋고 이어간다.
  if (keepFeed) {
    const sep = document.createElement('div');
    sep.className = 'judge-sep';
    sep.textContent = `── 여기까지 ${$('#chat-phase-label').textContent || '이전 단계'} ──`;
    $('#judge-feed').prepend(sep);
  } else {
    $('#judge-feed').innerHTML = '';
  }
  $('#turn-badge').textContent = '';   // 페이즈가 바뀌는 순간 직전 페이즈의 턴 수가 남아 있으면 안 된다
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
    vibe: setVibe,
    emote: (slot, kind) => stageViewer?.emote(slot === 'client' ? 'left' : 'right', kind),
    turn: t => { $('#turn-badge').textContent = `${t.phase === 'text' ? '문자' : '대면'} ${t.turn}/${t.turns}턴`; },
    phase: p => { $('#turn-badge').textContent = `${p.phase === 'text' ? '문자' : '대면'} 0/${p.turns}턴`; },
    intel: i => { toast(`상대에 대해 새로 파악: ${i.text}`, 6000); },
    // 케미가 좋으면 자리가 길어진다. 턴 수가 조용히 바뀌면 플레이어가 눈치채지 못한다.
    extend: e => {
      toast(`대화가 길어진다 — ${e.phase === 'text' ? '문자' : '대면'} ${e.turns}턴으로 (+${e.extra})`, 5000);
      sfx.love();
    },
  };

  const engine = new Engine(llm, { couple: state.couple, prep: state.prep, agent: state.agent, handlers });
  state.engine = engine;

  setupChatScreen('작전 1단계 · 문자 공작');
  stageViewer = getStageViewer('stage-chat');
  stageViewer.setDuo(state.clientSpec, state.targetSpec, 'camera');
  document.body.classList.add('phase-text');
  document.body.classList.remove('phase-talk');
  setVibe(engine.state.vibe);
  meterUpdate(engine.snapshot());

  try {
    const alive = await engine.runTexting();
    if (alive) {
      const sit = await withLoading('만날 장소 섭외 중...', () => engine.situation());
      setupChatScreen(`작전 2단계 · 대면 공작 — ${sit.place}`, { keepFeed: true });
      stageViewer = getStageViewer('stage-chat');
      stageViewer.setDuo(state.clientSpec, state.targetSpec, 'each');
      stageViewer.setParty(true);
      document.body.classList.remove('phase-text');
      document.body.classList.add('phase-talk');
      setVibe(sit.vibe || engine.state.vibe);
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
  v.emote('left', r.verdict.accepted ? 'proud' : 'sad');
  v.emote('right', r.verdict.accepted ? 'laugh' : 'freeze');

  const stamp = $('#result-stamp');
  stamp.textContent = r.verdict.accepted ? c.winWord : r.aborted ? '작전 파탄' : '고백 반려';
  stamp.className = `result-stamp ${r.verdict.accepted ? 'ok' : 'fail'}`;
  $('#result-grade').textContent = `공작 등급: ${r.verdict.grade}`;
  $('#result-score').textContent =
    `호감 ${r.verdict.love}/${r.difficulty.threshold} · 분위기 ${r.verdict.mood}/${r.difficulty.moodFloor} · 난이도 ${r.difficulty.badge}`;

  $('#debrief-summary').textContent = r.debrief.summary;
  $('#debrief-list').innerHTML = r.debrief.notes.map(n =>
    `<li class="${n.ok ? 'ok' : 'weak'}"><b>${escapeHtml(n.label)}</b> <span class="dscore">${escapeHtml(n.value)}</span><br><span class="dim">${escapeHtml(n.text)}</span></li>`).join('');
  $('#debrief-prefs').innerHTML =
    c.target.visiblePrefs.map(p => `<li class="known">${escapeHtml(p)} <span class="dim">(사전 통보)</span></li>`).join('') +
    r.debrief.surfaced.map(p => `<li class="found">${escapeHtml(p)} <span class="dim">(대화에서 화제에 올랐다)</span></li>`).join('') +
    r.debrief.missed.map(p => `<li class="missed">${escapeHtml(p)} <span class="dim">(끝내 안 나왔다)</span></li>`).join('');
  // 상대 쪽 심리 감정은 작전 중엔 못 본다. 끝났으니 이제 깐다 —
  // 왜 그 지침이 안 먹혔는지 알아야 재착수가 의미를 가진다.
  $('#debrief-flaw').innerHTML = `
    <h4>상대는 이런 사람이었다 <span class="dim small">(작전 중 비공개였던 항목)</span></h4>
    ${flawHtml(c.target)}
    <p class="dim">의뢰인 쪽 감정 결과는 의뢰서에 처음부터 나와 있었다. 재착수 전에 다시 읽어라.</p>`;

  $('#debrief-turns').innerHTML =
    '<div class="turn-table-wrap"><table class="turn-table"><tr><th>턴</th><th>분위기</th><th>호감</th><th>누적 호감/분위기</th><th>해설</th></tr>' +
    r.state.history.map(h =>
      `<tr class="${h.dLove > 0 ? 'good' : h.dLove < 0 ? 'bad' : ''}">` +
      `<td>${h.turn}${h.firstImpression ? '·착장' : ''}${h.revealed ? '·발견' : ''}</td>` +
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

  await typeText($('#result-letter'), r.letter.letter, 40);
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
    const snap = e.snapshot();
    const reach = VIBE_REACH[snap.reads] || VIBE_REACH.well;
    const f = state.couple.client.flaw || {};
    const comply = FLAW_LABELS.compliance[f.compliance] || FLAW_LABELS.compliance.obeys;
    $('#radio-context').innerHTML =
      `<div class="radio-stat">` +
      `<span class="hud-chip">남은 턴 ${snap.turnsLeft}/${snap.turnsTotal}</span>` +
      `<span class="hud-chip">잔여 무전 ${snap.radioLeft}</span>` +
      `<span class="hud-chip">호감 ${snap.love}/${snap.threshold}</span>` +
      `<span class="hud-chip">분위기 ${snap.mood}</span>` +
      `</div>` +
      `<b>지금 공기:</b> ${escapeHtml(e.state.vibe || '(아직 아무 일도 없다)')} ` +
      `<span class="reach-chip ${reach.cls}">의뢰인에게 ${escapeHtml(reach.tag)}</span><br>` +
      `<span class="dim">${escapeHtml(reach.note)}.</span><br>` +
      `<span class="dim"><b>이 명령은 ${escapeHtml(comply.tag)}:</b> ${escapeHtml(comply.desc)}</span><br>` +
      `<span class="dim">저 둘은 각자 원하는 게 따로 있다. 흐름을 바꾸고 싶으면 여기서 바꿔야 한다.</span><br>` +
      `<span class="dim">상대가 질색: ${t.redLines.map(escapeHtml).join(' / ')} — 의뢰인은 지침으로 들은 것만 안다.</span>`;
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

// ── 재생 속도 ───────────────────────────────────────────
// 대화가 눈보다 빨리 지나가던 문제의 조종간. 실제 대기 시간은 pacing.js가 계산한다.
function initPacing() {
  const box = $('#pace-buttons');
  const btns = pace.PACE_STEPS.map(step => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn95 tiny pace-btn';
    b.dataset.pace = step.key;
    b.textContent = step.label;
    b.addEventListener('click', () => { sfx.click(); pace.setPace(step.key); });
    box.appendChild(b);
    return b;
  });
  const paint = key => btns.forEach(b => b.classList.toggle('on', b.dataset.pace === key));
  paint(pace.getPace());
  pace.onPaceChange(paint);

  // 기록창 아무 데나 눌러도 다음으로. 버튼·입력칸 위는 제외된다 (pacing.js).
  pace.attachSkip($('#screen-chat'));
  const advance = $('#chat-advance');
  pace.onWaitChange(on => advance.classList.toggle('on', on && pace.paceMult() > 0));
}

// ── 초기화 ──────────────────────────────────────────────
function init() {
  // 대장 건수를 화면 곳곳에 박아두면 커플을 추가할 때마다 숫자가 어긋난다. 실제로 어긋났었다.
  for (const el of $$('.n-couples')) el.textContent = COUPLES.length;
  initBoot();
  initIntro();
  initRadio();
  initPacing();
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
