// game.js — 화면/입력 계층. 대화 오케스트레이션은 engine.js, 규칙은 scoring.js, API는 llm.js.
import { LlmClient, RefusalError } from './llm.js';
import * as P from './prompts.js';
import { Engine } from './engine.js';
import { DIFFICULTIES, diffOf } from './scoring.js';
import { AvatarViewer, sanitizeSpec } from './avatar.js';
import { sfx, startBgm, toggleBgm, unlockAudio } from './audio.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const llm = new LlmClient();

const state = {
  screen: 'boot',
  clients: [], clientSpecs: [], targetSpecs: [],
  client: null, clientSpec: null, targetSpec: null, diff: null,
  prep: { styleScore: null, coachScore: null, courageScore: null, outfitDesc: '', coaching: '' },
  engine: null, result: null,
};
window.__game = { state, llm, DIFFICULTIES }; // 자동 테스트 후크

// ── 뷰어 관리 (무대 캔버스는 컨텍스트 재사용) ───────────
let miniViewers = [];
const stageViewers = new Map();
const clearMinis = () => { miniViewers.forEach(v => v.dispose()); miniViewers = []; };
function newMiniViewer(canvas, opts) { const v = new AvatarViewer(canvas, opts); miniViewers.push(v); return v; }
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
  '팁: 무전은 미확인 취향을 캐낼 유일한 수단이다. 아끼다 못 쓰면 그냥 손해다.',
  '팁: 용기가 바닥나면 클라이언트는 패닉에 빠져 분위기를 스스로 깎아먹는다.',
  '팁: 분위기가 낮으면 아무리 취향을 저격해도 호감이 잘 안 오른다.',
  '팁: 착장은 대면 첫인상에서 한 번 더 크게 작용한다.',
  '팁: 헬 난이도는 준비 4종 중 하나만 부실해도 성공선에 못 닿는다.',
  '팁: 코칭은 응원이 아니라 행동 지시다. 구체적일수록 점수가 높다.',
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
  if (e instanceof RefusalError) return '⚠ LLM이 이 내용은 못 다루겠다며 파업했다. 내용을 바꿔 다시 시도하라.';
  return `⚠ 통신 사고: ${e.message}`;
}

async function typeText(el, text, cps = 55) {
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

// ── 요원 전적 (로컬 저장) ───────────────────────────────
function loadRecord() {
  try { return JSON.parse(sget('localStorage', 'cupid_record') || '{"runs":[]}'); }
  catch { return { runs: [] }; }
}
function saveRun(entry) {
  const rec = loadRecord();
  rec.runs.unshift(entry);
  rec.runs = rec.runs.slice(0, 30);
  sset('localStorage', 'cupid_record', JSON.stringify(rec));
}
const GRADE_ORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
function renderRecord() {
  const runs = loadRecord().runs;
  const el = $('#agent-record');
  if (!el) return;
  if (!runs.length) { el.innerHTML = '<span class="dim">첫 공작을 기다리는 중. 전적 없음.</span>'; return; }
  const wins = runs.filter(r => r.accepted).length;
  const best = runs.reduce((b, r) => GRADE_ORDER.indexOf(r.grade) > GRADE_ORDER.indexOf(b) ? r.grade : b, 'F');
  const hell = runs.filter(r => r.difficulty === '헬' && r.accepted).length;
  el.innerHTML =
    `<b>요원 전적</b> · 공작 ${runs.length}회 · 성사 ${wins}회 (${Math.round(wins / runs.length * 100)}%) · 최고 등급 <b>${best}</b>${hell ? ` · 헬 클리어 ${hell}회` : ''}` +
    `<div class="record-chips">${runs.slice(0, 8).map(r =>
      `<span class="record-chip ${r.accepted ? 'win' : 'lose'} diff-${r.diffKey}" title="${escapeHtml(r.client)} (${escapeHtml(r.difficulty)}) 호감 ${r.love}/${r.threshold}">${escapeHtml(r.grade)}</span>`).join('')}</div>`;
}

// ── LLM 콘솔 ────────────────────────────────────────────
llm.onLog((entry, usage) => {
  const box = $('#console-log');
  let el = entry._el;
  if (!el) { el = document.createElement('details'); entry._el = el; box.prepend(el); while (box.children.length > 60) box.lastChild.remove(); }
  const st = { pending: '📡', ok: '✅', error: '💥', refusal: '🙅' }[entry.status] || '❓';
  const u = entry.response?.usage;
  el.innerHTML = `<summary>${st} <b>${escapeHtml(entry.label)}</b> · ${escapeHtml(entry.model)} · ${entry.ms ? Math.round(entry.ms) + 'ms' : '...'}${u ? ` · ${u.input_tokens}→${u.output_tokens}tok` : ''}${entry.error ? ` · ${escapeHtml(entry.error)}` : ''}</summary><pre>${escapeHtml(JSON.stringify({ request: entry.request, response: entry.response ?? null }, null, 1).slice(0, 8000))}</pre>`;
  $('#console-usage').textContent = `호출 ${usage.calls} · in ${usage.inputTokens.toLocaleString()} · out ${usage.outputTokens.toLocaleString()} · 약 $${usage.cost.toFixed(3)}`;
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
      startPrefetch();          // 의뢰서 생성을 백그라운드로 던지고
      showIntro();              // 그 사이 교육 슬라이드를 본다
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

// ── 프리페치: 슬라이드를 보는 동안 본부 데이터를 만든다 ──
const pending = { briefing: null, roster: null };

function difficultySpec() {
  return Object.entries(DIFFICULTIES)
    .map(([name, d]) => `  · ${name}: visiblePrefs ${d.visiblePrefs}개, hiddenPrefs ${d.hiddenPrefs}개`)
    .join('\n');
}

function startPrefetch() {
  pending.briefing = llm.call({
    label: '국장 브리핑', system: P.BRIEFING_SYSTEM,
    messages: [{ role: 'user', content: P.BRIEFING_USER }], effort: 'low',
  }).catch(e => ({ __error: e }));

  pending.roster = (async () => {
    const data = await llm.call({
      label: '의뢰서 3건 생성', system: P.clientsSystem(difficultySpec()),
      messages: [{ role: 'user', content: P.CLIENTS_USER }],
      schema: P.CLIENTS_SCHEMA, effort: 'medium', maxTokens: 14000,
    });
    const clients = (data.clients || []).slice(0, 3);
    if (clients.length < 3) throw new Error('의뢰서 수신 불량 (3건 미만)');
    const specs = await llm.call({
      label: '아바타 스펙 변환', system: P.AVATARS_SYSTEM,
      messages: [{ role: 'user', content: P.avatarsUser(clients) }],
      schema: P.AVATARS_SCHEMA, effort: 'low', maxTokens: 12000,
    });
    const cs = (specs.clientSpecs || []).map(sanitizeSpec);
    const ts = (specs.targetSpecs || []).map(sanitizeSpec);
    while (cs.length < 3) cs.push(sanitizeSpec({}));
    while (ts.length < 3) ts.push(sanitizeSpec({}));
    return { clients, clientSpecs: cs, targetSpecs: ts };
  })().catch(e => ({ __error: e }));

  pending.roster.then(r => {
    const el = $('#intro-prefetch');
    if (!el) return;
    if (r?.__error) { el.textContent = '⚠ 의뢰서 수신 실패 — 교육을 마치면 재시도한다.'; el.classList.add('bad'); }
    else { el.textContent = '✅ 오늘자 의뢰서 3건 수신 완료. 교육을 마치면 열람 가능.'; el.classList.add('ok'); }
  });
}

// ── 신입 교육 슬라이드 ──────────────────────────────────
const SLIDES = [
  {
    art: '🏛️💘🏛️',
    title: '큐피드국에 온 걸 환영한다',
    body: `2077년. 출산율 0.008. 국가비상사태.<br>
    너는 <b>연애 공작 요원</b>이다. 직접 연애하는 게 아니라, 연애 경험 0인 국민(<b>클라이언트</b>)이
    짝사랑 상대(<b>타겟</b>)에게 고백하도록 <b>뒤에서 조작</b>하는 일이다.<br>
    대화는 클라이언트가 한다. 너는 준비시키고, 결정적일 때 무전을 넣는다.`,
  },
  {
    art: '📚 → 👔🎧🔥 → 📱 → 💬 → 💌',
    title: '작전은 이렇게 흘러간다',
    body: `<b>①의뢰서 선택</b> → <b>②작전 준비</b>(스타일링·코칭·격려) → <b>③문자 공작</b> → <b>④대면 공작</b> → <b>⑤결과 편지</b><br>
    문자와 대면에서 두 사람은 <b>알아서 대화한다</b>. 너는 지켜보다가 <b>무전 개입</b>으로만 끼어들 수 있다.<br>
    그래서 <b>②준비 단계에서 승부의 8할이 결정된다.</b>`,
  },
  {
    art: '💗 호감 &nbsp; 😊 분위기 &nbsp; 🔥 용기',
    title: '게이지 3개만 이해하면 된다',
    body: `<b>💗 호감</b> — 승리 조건. 성공선을 넘겨야 고백이 받아들여진다.<br>
    <b>😊 분위기</b> — 호감 획득 <b>배율</b>. 분위기가 낮으면 취향을 저격해도 호감이 찔끔 오른다.<br>
    <b>🔥 용기</b> — 스태미나. <b>턴마다 닳는다.</b> 바닥나면 클라이언트가 패닉에 빠져 분위기를 스스로 깎는다.`,
  },
  {
    art: '👔 ×배율 &nbsp; 🎧 비대칭 &nbsp; 🔥 스태미나 &nbsp; 📻 구조',
    title: '네 가지 레버, 하나라도 빠지면 진다',
    body: `<b>👔 스타일링</b> → 호감 출발선 + <b>획득 배율</b>. 대면 첫인상에서 한 번 더 크게 작용.<br>
    <b>🎧 코칭</b> → 분위기 출발선 + 증감 비대칭. 클라이언트의 <b>약점</b>을 봉인하는 구체적 행동 지시여야 한다.<br>
    <b>🔥 격려 연설</b> → 용기 스태미나. 사연의 디테일을 짚을수록 높다.<br>
    <b>📻 무전 개입</b> → 용기 회복 + 흐름 전환. 정확하면 크게 먹고, 막연한 응원이면 분위기를 깎는다.`,
  },
  {
    art: '🎯 ？？？',
    title: '취향은 절반만 알려준다',
    body: `타겟의 취향 중 일부만 의뢰서에 적혀 있다. 나머지는 <b>미확인</b>이며 <b>개수만</b> 통보된다.<br>
    미확인 취향은 대화 중에만 드러나고, 적중하면 호감이 크게 뛴다. 무전으로 화제를 끌어 캐내라.<br>
    <b>난이도가 오를수록 알려주는 취향이 줄고, 성공선은 높아진다.</b><br>
    <span class="slide-warn">헬 난이도는 준비 4종 중 하나만 부실해도 성공선에 닿지 못한다.</span>`,
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

// ── 브리핑 ──────────────────────────────────────────────
async function gotoBriefing() {
  show('briefing');
  $('#btn-to-screening').classList.add('hidden');
  let text;
  try {
    text = await withLoading('국장님 등판 중...', () => pending.briefing);
    if (text?.__error) throw text.__error;
  } catch (e) {
    text = '(국장이 회선 저편에서 뭐라고 소리쳤지만 잡음뿐이었다. 아무튼 가라는 뜻이다.)';
    toast(errMsg(e));
  }
  await typeText($('#briefing-text'), text);
  $('#btn-to-screening').classList.remove('hidden');
}

// ── 의뢰서 ──────────────────────────────────────────────
function screeningFail(e) {
  toast(errMsg(e));
  $('#screening-error').classList.remove('hidden');
}

async function gotoScreening(forceRefetch = false) {
  clearMinis();
  show('screening');
  $('#screening-error').classList.add('hidden');
  $('#client-cards').innerHTML = '';
  renderRecord();

  if (forceRefetch || !pending.roster) {
    pending.roster = (async () => {
      const data = await llm.call({
        label: '의뢰서 3건 생성', system: P.clientsSystem(difficultySpec()),
        messages: [{ role: 'user', content: P.CLIENTS_USER }],
        schema: P.CLIENTS_SCHEMA, effort: 'medium', maxTokens: 14000,
      });
      const clients = (data.clients || []).slice(0, 3);
      if (clients.length < 3) throw new Error('의뢰서 수신 불량 (3건 미만)');
      const specs = await llm.call({
        label: '아바타 스펙 변환', system: P.AVATARS_SYSTEM,
        messages: [{ role: 'user', content: P.avatarsUser(clients) }],
        schema: P.AVATARS_SCHEMA, effort: 'low', maxTokens: 12000,
      });
      const cs = (specs.clientSpecs || []).map(sanitizeSpec);
      const ts = (specs.targetSpecs || []).map(sanitizeSpec);
      while (cs.length < 3) cs.push(sanitizeSpec({}));
      while (ts.length < 3) ts.push(sanitizeSpec({}));
      return { clients, clientSpecs: cs, targetSpecs: ts };
    })();
  }

  const roster = await withLoading('의뢰서 열람 중...', () => pending.roster);
  pending.roster = null; // 소비했으니 다음 판은 새로 뽑는다
  if (roster?.__error) throw roster.__error;

  state.clients = roster.clients;
  state.clientSpecs = roster.clientSpecs;
  state.targetSpecs = roster.targetSpecs;

  state.clients.forEach((c, i) => {
    const d = diffOf(c.difficulty);
    const card = document.createElement('div');
    card.className = 'dossier';
    card.innerHTML = `
      <div class="stamp">극비</div>
      <canvas class="mini-canvas"></canvas>
      <h3>${escapeHtml(c.name)} <small>(${c.age}, ${escapeHtml(c.job)})</small></h3>
      <p class="story">${escapeHtml(c.story)}</p>
      <p><b>외모:</b> ${c.appearance.map(escapeHtml).join(', ')}</p>
      <p><b>성격:</b> ${c.personality.map(escapeHtml).join(', ')}</p>
      <p class="weakness"><b>⚠ 약점:</b> ${escapeHtml(c.weakness)}</p>
      <p><b>타겟:</b> ${escapeHtml(c.target.name)} (${c.target.age}, ${escapeHtml(c.target.job)})</p>
      <p><b>알려진 취향:</b> ${c.target.visiblePrefs.map(escapeHtml).join(', ')}</p>
      <p class="unknown-prefs">🎯 미확인 취향 <b>${c.target.hiddenPrefs.length}건</b> — 내용은 대화로 직접 캐내야 한다</p>
      <p class="quote">“${escapeHtml(c.quote)}”</p>
      <div class="diff-box diff-${d.key}">
        <span class="diff-name">난이도 ${escapeHtml(c.difficulty)}</span>
        <span class="diff-detail">성공선 호감 ${d.threshold} · 무전 ${d.radioText}+${d.radioTalk}회 · 턴 ${d.textTurns + d.talkTurns}</span>
      </div>
      <button class="btn-select btn95">이 인간을 돕는다</button>`;
    $('#client-cards').appendChild(card);
    const v = newMiniViewer(card.querySelector('canvas'), { spin: true, cameraZ: 3.4 });
    v.setSolo(state.clientSpecs[i]);
    card.querySelector('.btn-select').addEventListener('click', () => { sfx.stamp(); chooseClient(i); });
  });
}

function chooseClient(i) {
  state.client = state.clients[i];
  state.clientSpec = state.clientSpecs[i];
  state.targetSpec = state.targetSpecs[i];
  state.diff = diffOf(state.client.difficulty);
  state.prep = { styleScore: null, coachScore: null, courageScore: null, outfitDesc: '', coaching: '' };
  state.engine = null; state.result = null;
  gotoConsult();
}

// ── 컨설팅 ──────────────────────────────────────────────
let consultViewer = null;
function gotoConsult() {
  clearMinis();
  show('consult');
  const c = state.client, d = state.diff;
  consultViewer = getStageViewer('stage-consult');
  consultViewer.setDuo(state.clientSpec, state.targetSpec, 'camera');

  $('#consult-title').innerHTML = `작전명: ${escapeHtml(c.name)} 구출 작전 <span class="diff-inline diff-${d.key}">난이도 ${escapeHtml(c.difficulty)}</span>`;
  $('#consult-dossier').innerHTML = `
    <h3>📄 의뢰 요약</h3>
    <p class="story">${escapeHtml(c.story)}</p>
    <p><b>성격:</b> ${c.personality.map(escapeHtml).join(', ')}</p>
    <p class="weakness"><b>⚠ 약점:</b> ${escapeHtml(c.weakness)} <span class="dim">— 코칭으로 봉인하라</span></p>
    <hr>
    <p><b>타겟:</b> ${escapeHtml(c.target.name)} (${c.target.age}, ${escapeHtml(c.target.job)}) — ${c.target.personality.map(escapeHtml).join(', ')}</p>
    <p><b>알려진 취향:</b> ${c.target.visiblePrefs.map(escapeHtml).join(', ')}</p>
    <p class="unknown-prefs">🎯 <b>취향 총 ${c.target.visiblePrefs.length + c.target.hiddenPrefs.length}건</b> 중 알려진 것 ${c.target.visiblePrefs.length}건 · <b>미확인 ${c.target.hiddenPrefs.length}건</b> (내용 비공개)</p>
    <p class="dim small">성공선: 호감 <b>${d.threshold}</b> 이상 · 분위기 <b>${d.moodFloor}</b> 이상 · 총 ${d.textTurns + d.talkTurns}턴</p>`;

  $('#radio-budget').textContent = `문자 ${d.radioText}회 / 대면 ${d.radioTalk}회`;
  for (const [id, txt] of [['#score-styling', '미실시'], ['#score-coaching', '미실시'], ['#score-speech', '미실시']]) {
    $(id).textContent = txt; $(id).className = 'prep-score';
  }
  ['#styling-result', '#coaching-result', '#speech-result'].forEach(s => { $(s).textContent = ''; });
  ['#styling-input', '#coaching-input', '#speech-input'].forEach(s => { $(s).value = ''; });
  updatePrepWarning();

  $('#btn-styling').onclick = () => runPrep('styling');
  $('#btn-coaching').onclick = () => runPrep('coaching');
  $('#btn-speech').onclick = () => runPrep('speech');
  $('#btn-start-op').onclick = () => { sfx.radio(); startOperation(); };
}

function setScore(id, score) {
  const el = $(id);
  el.textContent = `${score}/10`;
  el.className = 'prep-score ' + (score >= 7 ? 'good' : score >= 4 ? 'mid' : 'bad');
}

async function runPrep(kind) {
  sfx.click();
  const c = state.client;
  try {
    if (kind === 'styling') {
      const tags = $('#styling-input').value.trim();
      if (!tags) return toast('스타일링 태그를 입력하라. 예: 빨간 턱시도, 카우보이 부츠');
      const r = await withLoading('가위손 박 작업 중...', () => llm.call({
        label: '스타일링', system: P.STYLING_SYSTEM,
        messages: [{ role: 'user', content: P.stylingUser(c, state.clientSpec, tags) }],
        schema: P.STYLING_SCHEMA, effort: 'low',
      }));
      state.clientSpec = sanitizeSpec(r.spec);
      state.prep.styleScore = Math.max(0, Math.min(10, r.styleScore | 0));
      state.prep.outfitDesc = r.outfitDesc || tags;
      consultViewer.updateLeft(state.clientSpec);
      consultViewer.burst('sparkle', 'left');
      setScore('#score-styling', state.prep.styleScore);
      $('#styling-result').textContent = r.comment;
      state.prep.styleScore >= 7 ? sfx.love() : state.prep.styleScore <= 2 ? sfx.bad() : sfx.stamp();
    } else if (kind === 'coaching') {
      const text = $('#coaching-input').value.trim();
      if (!text) return toast('대화 지침을 입력하라. 약점을 막고 취향으로 화제를 끄는 구체적 지시가 좋다.');
      const r = await withLoading('말빨 소령 검토 중...', () => llm.call({
        label: '코칭 채점', system: P.COACHING_SYSTEM,
        messages: [{ role: 'user', content: P.coachingUser(c, text) }],
        schema: P.COACHING_SCHEMA, effort: 'low',
      }));
      state.prep.coachScore = Math.max(0, Math.min(10, r.coachScore | 0));
      state.prep.coaching = text;
      setScore('#score-coaching', state.prep.coachScore);
      $('#coaching-result').textContent = r.comment;
      state.prep.coachScore >= 7 ? sfx.love() : state.prep.coachScore <= 2 ? sfx.bad() : sfx.stamp();
    } else {
      const text = $('#speech-input').value.trim();
      if (!text) return toast('연설을 입력하라. 사연의 디테일을 짚을수록 용기가 오른다.');
      const r = await withLoading('클라이언트가 연설을 듣는 중...', () => llm.call({
        label: '격려 연설 채점', system: P.SPEECH_SYSTEM,
        messages: [{ role: 'user', content: P.speechUser(c, text) }],
        schema: P.SPEECH_SCHEMA, effort: 'low',
      }));
      state.prep.courageScore = Math.max(0, Math.min(10, r.courageScore | 0));
      setScore('#score-speech', state.prep.courageScore);
      $('#speech-result').textContent = r.comment;
      if (state.prep.courageScore >= 7) { consultViewer.burst('love', 'left'); sfx.fanfare(); }
      else if (state.prep.courageScore <= 2) sfx.bad(); else sfx.stamp();
    }
  } catch (e) { toast(errMsg(e)); }
  updatePrepWarning();
}

function updatePrepWarning() {
  const p = state.prep, d = state.diff;
  const missing = [];
  if (p.styleScore === null) missing.push('스타일링');
  if (p.coachScore === null) missing.push('코칭');
  if (p.courageScore === null) missing.push('격려 연설');
  const weak = [];
  if (p.styleScore !== null && p.styleScore < 4) weak.push('스타일링');
  if (p.coachScore !== null && p.coachScore < 4) weak.push('코칭');
  if (p.courageScore !== null && p.courageScore < 4) weak.push('격려 연설');

  const el = $('#prep-warning');
  if (!missing.length && !weak.length) {
    el.className = 'prep-warning ok';
    el.textContent = '✅ 준비 완료. 네 레버 모두 살아 있다.';
    return;
  }
  const parts = [];
  if (missing.length) parts.push(`<b>미실시:</b> ${missing.join(', ')}`);
  if (weak.length) parts.push(`<b>부실(4점 미만):</b> ${weak.join(', ')}`);
  const fatal = d.key === 'hell' || (d.key === 'normal' && (missing.length + weak.length) >= 2);
  el.className = 'prep-warning ' + (fatal ? 'fatal' : 'warn');
  el.innerHTML = `${parts.join(' · ')}<br>${fatal
    ? `⛔ 난이도 <b>${state.client.difficulty}</b>에서는 이 상태로 성공선(호감 ${d.threshold})에 도달할 수 없다.`
    : `⚠ 난이도 ${state.client.difficulty}라 버틸 수는 있지만 확실히 불리하다.`}`;
}

// ── 대화 ────────────────────────────────────────────────
let stageViewer = null;
let currentTurn = { turn: 0, turns: 0, phase: '' };

function meterUpdate(s) {
  $('#meter-love-fill').style.width = s.love + '%';
  $('#meter-mood-fill').style.width = s.mood + '%';
  $('#meter-courage-fill').style.width = s.courage + '%';
  $('#meter-love-num').textContent = s.love;
  $('#meter-mood-num').textContent = s.mood;
  $('#meter-courage-num').textContent = s.courage;
  $('#meter-threshold').style.left = s.threshold + '%';
  $('#hud-style').textContent = `👔 매력 ×${s.styleMult}`;
  $('#meter-courage-fill').classList.toggle('danger', s.courage < 25);
  $('#btn-intervene').textContent = `📻 무전 개입 (${s.radioLeft})`;
  $('#btn-intervene').disabled = s.radioLeft <= 0;
  $('#intel-count').textContent = `${s.visibleTotal + s.foundCount} / ${s.visibleTotal + s.hiddenTotal}건 파악`;
  $('#intel-list').innerHTML =
    state.client.target.visiblePrefs.map(p => `<li class="known">✔ ${escapeHtml(p)}</li>`).join('') +
    Array.from({ length: s.hiddenTotal }, (_, i) => i < s.foundCount
      ? `<li class="found">🔓 미확인 취향 적중 (내용은 종료 후 공개)</li>`
      : `<li class="unknown">🔒 미확인 취향</li>`).join('');
  document.body.classList.toggle('panic', !!s.panic);
}

function addBubble(who, text) {
  const w = $('#chat-window');
  const div = document.createElement('div');
  div.className = `bubble ${who}`;
  const name = who === 'client' ? state.client.name : who === 'target' ? state.client.target.name
    : who === 'radio' ? '📻 본부 무전' : '나레이션';
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
    j.hiddenHit ? '<span class="tag hit">🔓 미확인 적중</span>' : '',
    j.choke ? '<span class="tag choke">🥶 용기 부족으로 감쇠</span>' : '',
    j.firstImpression ? '<span class="tag first">👔 첫인상</span>' : '',
  ].join('');
  div.className = `judge-line ${cls}`;
  div.innerHTML = `<b>분위기 ${j.mood >= 0 ? '+' : ''}${j.mood} · 호감 ${j.love >= 0 ? '+' : ''}${j.love}</b> ${escapeHtml(j.reason)}${tags}`;
  w.prepend(div);
  while (w.children.length > 8) w.lastChild.remove();
  if (j.love > 0) { stageViewer?.burst('love', 'right'); sfx.love(); }
  else if (j.love < 0) { stageViewer?.burst('bad', 'right'); sfx.bad(); }
}

function setupChatScreen(title) {
  show('chat');
  $('#chat-window').innerHTML = '';
  $('#judge-feed').innerHTML = '';
  $('#chat-phase-label').textContent = title;
  $('#hud-diff').textContent = `난이도 ${state.client.difficulty} · 성공선 ${state.diff.threshold}`;
  $('#hud-diff').className = `hud-chip diff-${state.diff.key}`;
}

async function startOperation() {
  const handlers = {
    bubble: addBubble,
    judge: addJudge,
    meters: meterUpdate,
    turn: t => {
      currentTurn = t;
      $('#turn-badge').textContent = `${t.phase === 'text' ? '📱 문자' : '💬 대면'} ${t.turn}/${t.turns}턴`;
    },
    phase: p => { $('#turn-badge').textContent = `${p.phase === 'text' ? '📱 문자' : '💬 대면'} 0/${p.turns}턴`; },
    intel: i => { toast(`🔓 미확인 취향 적중! (${i.found}/${i.total}건) — 내용은 작전 종료 후 공개된다`, 6000); sfx.fanfare(); },
    panic: () => { toast('🥶 용기 소진! 클라이언트가 패닉에 빠졌다 — 무전으로 기를 살려라', 7000); sfx.trombone(); },
    radioResult: r => {
      const cls = r.aim >= 7 ? 'good' : r.aim >= 4 ? 'meh' : 'bad';
      const w = $('#judge-feed');
      const div = document.createElement('div');
      div.className = `judge-line ${cls}`;
      div.innerHTML = `<b>📻 무전 정확도 ${r.aim}/10</b> ${escapeHtml(r.comment)}<span class="tag radio">용기 ${r.delta.courage >= 0 ? '+' : ''}${r.delta.courage} · 분위기 ${r.delta.mood >= 0 ? '+' : ''}${r.delta.mood}${r.delta.love ? ` · 호감 ${r.delta.love >= 0 ? '+' : ''}${r.delta.love}` : ''}</span>`;
      w.prepend(div);
      r.aim >= 7 ? sfx.fanfare() : r.aim <= 2 ? sfx.bad() : sfx.stamp();
    },
  };

  const engine = new Engine(llm, {
    client: state.client, difficulty: state.client.difficulty,
    prep: {
      styleScore: state.prep.styleScore ?? 0,
      coachScore: state.prep.coachScore ?? 0,
      courageScore: state.prep.courageScore ?? 0,
      outfitDesc: state.prep.outfitDesc, coaching: state.prep.coaching,
    },
    handlers,
  });
  state.engine = engine;

  setupChatScreen('📱 작전 1단계: 문자 공작');
  stageViewer = getStageViewer('stage-chat');
  stageViewer.setDuo(state.clientSpec, state.targetSpec, 'camera');
  document.body.classList.add('phase-text');
  document.body.classList.remove('phase-talk');
  meterUpdate(engine.snapshot());

  try {
    const alive = await engine.runTexting();
    if (alive) {
      const sit = await withLoading('데이트 장소 섭외 중...', () => engine.situation());
      setupChatScreen(`💬 작전 2단계: 대면 공작 @ ${sit.place}`);
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
  document.body.classList.remove('phase-text', 'phase-talk', 'panic');
  const r = await withLoading('며칠 뒤... 결과 정산 중...', () => state.engine.finish());
  state.result = r;

  show('result');
  $('#btn-restart').classList.add('hidden');
  $('#result-epilogue').textContent = '';
  $('#result-mvp').textContent = '';

  const v = getStageViewer('stage-result');
  v.setDuo(state.clientSpec, state.targetSpec, r.verdict.accepted ? 'each' : 'camera');
  v.setParty(r.verdict.accepted);

  const stamp = $('#result-stamp');
  stamp.textContent = r.verdict.accepted ? '커플 성사' : r.aborted ? '작전 파탄' : '고백 반려';
  stamp.className = `result-stamp ${r.verdict.accepted ? 'ok' : 'fail'}`;
  $('#result-grade').textContent = `공작 등급: ${r.verdict.grade}`;
  $('#result-score').textContent =
    `호감 ${r.verdict.love}/${r.difficulty.threshold} · 분위기 ${r.verdict.mood}/${r.difficulty.moodFloor} · 난이도 ${r.difficulty.badge}`;

  $('#debrief-summary').textContent = r.debrief.summary;
  $('#debrief-list').innerHTML = r.debrief.items.map(it =>
    `<li class="${it.ok ? 'ok' : it.weak ? 'weak' : 'mid'}"><b>${escapeHtml(it.name)}</b> <span class="dscore">${it.score}/10</span> — ${escapeHtml(it.verdictText)}</li>`).join('');
  $('#debrief-prefs').innerHTML =
    r.visiblePrefs.map(p => `<li class="known">✔ ${escapeHtml(p)} <span class="dim">(알려진 취향)</span></li>`).join('') +
    r.foundPrefs.map(p => `<li class="found">🔓 ${escapeHtml(p)} <span class="dim">(작전 중 적중)</span></li>`).join('') +
    r.missedPrefs.map(p => `<li class="missed">❌ ${escapeHtml(p)} <span class="dim">(끝내 못 건드림)</span></li>`).join('');

  saveRun({
    client: state.client.name, difficulty: state.client.difficulty, diffKey: r.difficulty.key,
    grade: r.verdict.grade, accepted: r.verdict.accepted, love: r.verdict.love, threshold: r.difficulty.threshold,
    style: state.prep.styleScore ?? 0, coach: state.prep.coachScore ?? 0, courage: state.prep.courageScore ?? 0,
  });

  sfx.stamp();
  setTimeout(() => {
    if (r.verdict.accepted) {
      sfx.fanfare(); v.burst('love');
      const iv = setInterval(() => { if (state.screen !== 'result') return clearInterval(iv); v.burst('love'); }, 2500);
    } else { sfx.trombone(); v.burst('rain'); }
  }, 600);

  await typeText($('#result-letter'), r.letter.letter, 55);
  $('#result-mvp').textContent = `📌 승패를 가른 것: ${r.letter.mvp}`;
  $('#result-epilogue').textContent = `— 에필로그: ${r.letter.epilogue}`;
  $('#btn-restart').classList.remove('hidden');
}

// ── 무전 모달 ───────────────────────────────────────────
function initRadio() {
  $('#btn-intervene').addEventListener('click', () => {
    const e = state.engine;
    if (!e || e.radioLeft <= 0) return;
    sfx.radio();
    e.setPaused(true);                       // 대화를 멈춰두고 천천히 쓰게 한다
    $('#modal-radio').classList.remove('hidden');
    $('#radio-input').value = '';
    $('#radio-input').focus();
  });
  const send = async () => {
    const text = $('#radio-input').value.trim();
    if (!text) return;
    $('#modal-radio').classList.add('hidden');
    const e = state.engine;
    try { await withLoading('무전 송신 중...', () => e.submitRadio(text)); }
    catch (err) { toast(errMsg(err)); }
    e.setPaused(false);
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
  $('#btn-to-screening').addEventListener('click', () => { sfx.click(); gotoScreening().catch(screeningFail); });
  $('#btn-restart').addEventListener('click', () => { sfx.click(); gotoScreening(true).catch(screeningFail); });
  $('#btn-retry-screening').addEventListener('click', () => { sfx.click(); gotoScreening(true).catch(screeningFail); });
  const toggleConsole = () => $('#console-panel').classList.toggle('hidden');
  $('#console-toggle').addEventListener('click', toggleConsole);
  $('#btn-console').addEventListener('click', toggleConsole);
  $('#btn-bgm').addEventListener('click', () => { $('#btn-bgm').textContent = toggleBgm() ? '🔊 BGM' : '🔇 BGM'; });
  document.addEventListener('click', () => unlockAudio(), { once: true });
}
init();
