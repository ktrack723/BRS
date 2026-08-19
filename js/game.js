// game.js — 연애조작단 2077: 오퍼레이션 큐피드. 게임 상태 머신 + UI.
// 모든 콘텐츠는 harness(LLM)를 통해 생성된다. 키가 없으면 아무것도 안 나온다.
import { Harness, RefusalError } from './harness.js';
import * as P from './prompts.js';
import { AvatarViewer, sanitizeSpec } from './avatar.js';
import { sfx, startBgm, toggleBgm, unlockAudio } from './audio.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const params = new URLSearchParams(location.search);
const CONFIG = {
  textTurns: params.get('fast') ? 2 : 5,
  talkTurns: params.get('fast') ? 2 : 6,
  textInterventions: 1,
  talkInterventions: 2,
};

const harness = new Harness();

const state = {
  screen: 'boot',
  clients: [], clientSpecs: [], targetSpecs: [],
  chosen: -1, client: null,
  clientSpec: null, targetSpec: null,
  outfitDesc: '', styleScore: 0, courage: 2, coaching: '',
  mood: 50, love: 20, phase: 'text',
  interventionsLeft: 0, pendingRadio: null, radioOpen: false,
  transcript: [], clientHist: [], targetHist: [],
  intel: [], aborted: false, busy: false,
};
window.__game = { state, harness, CONFIG }; // 자동 테스트용 후크

// 미니 뷰어(스크리닝 카드)는 캔버스와 함께 버려지므로 매번 dispose,
// 무대 뷰어는 캔버스가 DOM에 상주하므로 WebGL 컨텍스트를 재사용한다 (컨텍스트 고갈 방지).
let miniViewers = [];
const stageViewers = new Map();
function clearMinis() { miniViewers.forEach(v => v.dispose()); miniViewers = []; }
function newMiniViewer(canvas, opts) { const v = new AvatarViewer(canvas, opts); miniViewers.push(v); return v; }
function getStageViewer(canvasId) {
  let v = stageViewers.get(canvasId);
  if (!v) { v = new AvatarViewer($('#' + canvasId), {}); stageViewers.set(canvasId, v); }
  v.reset();
  return v;
}

// ── 공용 UI 유틸 ────────────────────────────────────────
function show(screen) {
  state.screen = screen;
  $$('.screen').forEach(s => s.classList.toggle('hidden', s.id !== `screen-${screen}`));
}

const TIPS = [
  '팁: 도람푸 3세는 하루 3회 연애 성공 보고를 받는다.',
  '팁: 무전 개입은 아껴 쓰자. 클라이언트는 생각보다 말을 잘 안 듣는다.',
  '팁: 숨겨진 취향을 저격하면 러브 게이지가 폭발한다.',
  '팁: 무드가 바닥나면 상대는 그냥 집에 간다.',
  '팁: 격려 연설이 후지면 클라이언트 멘탈도 후져진다.',
  '팁: 2077년에도 삼겹살은 진리다.',
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
  if (e instanceof RefusalError) return '⚠ LLM이 이 내용은 못 다루겠다며 파업했다. 다시 시도하거나 내용을 바꿔보자.';
  return `⚠ 통신 사고: ${e.message}`;
}

async function typeText(el, text, cps = 40) {
  el.textContent = '';
  const step = Math.max(1, Math.round(text.length / 400)); // 너무 길면 뭉텅이로
  for (let i = 0; i < text.length; i += step) {
    el.textContent += text.slice(i, i + step);
    if (i % 4 === 0) sfx.type();
    await new Promise(r => setTimeout(r, 1000 / cps));
  }
  el.textContent = text;
}

// ── 하네스 콘솔 ─────────────────────────────────────────
harness.onLog((entry, usage) => {
  const box = $('#console-log');
  let el = entry._el;
  if (!el) {
    el = document.createElement('details');
    entry._el = el;
    box.prepend(el);
    while (box.children.length > 60) box.lastChild.remove();
  }
  const st = { pending: '📡', ok: '✅', error: '💥', refusal: '🙅' }[entry.status] || '❓';
  const u = entry.response?.usage;
  el.innerHTML = `<summary>${st} <b>${escapeHtml(entry.label)}</b> · ${escapeHtml(entry.model)} · ${entry.ms ? Math.round(entry.ms) + 'ms' : '...'}${u ? ` · ${u.input_tokens}→${u.output_tokens}tok` : ''}${entry.error ? ` · ${escapeHtml(entry.error)}` : ''}</summary><pre>${escapeHtml(JSON.stringify({ request: entry.request, response: entry.response ?? null }, null, 1).slice(0, 8000))}</pre>`;
  $('#console-usage').textContent =
    `호출 ${usage.calls} · in ${usage.inputTokens.toLocaleString()} · out ${usage.outputTokens.toLocaleString()} · 약 $${usage.cost.toFixed(3)}`;
});
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

// 스토리지 차단 환경(쿠키 전면 차단 등)에서도 게임이 죽지 않게 감싼다
function sget(store, k) { try { return window[store].getItem(k); } catch { return null; } }
function sset(store, k, v) { try { v === null ? window[store].removeItem(k) : window[store].setItem(k, v); } catch { /* 저장 불가 환경 */ } }

// ── 부팅 ────────────────────────────────────────────────
function initBoot() {
  const saved = sget('localStorage', 'cupid_key') || sget('sessionStorage', 'cupid_key');
  if (saved) $('#key-input').value = saved;
  const savedModel = sget('localStorage', 'cupid_model');
  if (savedModel) $('#model-select').value = savedModel;

  $('#btn-boot').addEventListener('click', async () => {
    unlockAudio(); sfx.click();
    const key = $('#key-input').value.trim();
    if (!key.startsWith('sk-ant-')) { bootError('그건 API 키가 아니라 그냥 문자열이다. sk-ant-... 형식의 키를 내놔라.'); return; }
    harness.apiKey = key;
    harness.model = $('#model-select').value;
    sset('localStorage', 'cupid_model', harness.model);
    sset('sessionStorage', 'cupid_key', key);
    sset('localStorage', 'cupid_key', $('#remember-key').checked ? key : null);
    try {
      await withLoading('본부 회선 연결 중... (키 인증)', () => harness.ping());
      startBgm();
      await gotoBriefing();
    } catch (e) {
      show('boot'); // 브리핑 도중 실패해도 에러가 보이는 화면으로 복귀
      bootError(errMsg(e));
    }
  });
}
function bootError(msg) {
  const el = $('#boot-error');
  el.textContent = msg; el.classList.remove('hidden');
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  sfx.bad();
}

// ── 브리핑 ──────────────────────────────────────────────
async function gotoBriefing() {
  show('briefing');
  const text = await withLoading('국장님 등판 중...', () =>
    harness.call({ label: '국장 브리핑', system: P.BRIEFING_SYSTEM, messages: [{ role: 'user', content: P.BRIEFING_USER }], effort: 'low' }));
  await typeText($('#briefing-text'), text, 60);
  $('#btn-to-screening').classList.remove('hidden');
}

// ── 의뢰서 스크리닝 ─────────────────────────────────────
function screeningFail(e) {
  toast(errMsg(e));
  $('#screening-error').classList.remove('hidden'); // 재시도 버튼 노출 (데드엔드 방지)
}

async function gotoScreening() {
  clearMinis();
  show('screening');
  $('#screening-error').classList.add('hidden');
  $('#client-cards').innerHTML = '';
  const data = await withLoading('오늘자 의뢰서 수신 중... (병맛 인간 3명 생성)', () =>
    harness.call({ label: '의뢰서 3건 생성', system: P.CLIENTS_SYSTEM, messages: [{ role: 'user', content: P.CLIENTS_USER }], schema: P.CLIENTS_SCHEMA, effort: 'medium', maxTokens: 12000 }));
  state.clients = (data.clients || []).slice(0, 3);
  if (state.clients.length < 3) throw new Error('의뢰서 수신 불량 (3건 미만)');

  const specs = await withLoading('3D 몽타주 렌더링 중... (외모 태그 → 블록 캐릭터)', () =>
    harness.call({ label: '아바타 스펙 변환', system: P.AVATARS_SYSTEM, messages: [{ role: 'user', content: P.avatarsUser(state.clients) }], schema: P.AVATARS_SCHEMA, effort: 'low', maxTokens: 12000 }));
  state.clientSpecs = (specs.clientSpecs || []).map(sanitizeSpec);
  state.targetSpecs = (specs.targetSpecs || []).map(sanitizeSpec);
  while (state.clientSpecs.length < 3) state.clientSpecs.push(sanitizeSpec({}));
  while (state.targetSpecs.length < 3) state.targetSpecs.push(sanitizeSpec({}));

  state.clients.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'dossier';
    card.innerHTML = `
      <div class="stamp">극비</div>
      <canvas class="mini-canvas"></canvas>
      <h3>${escapeHtml(c.name)} <small>(${c.age}, ${escapeHtml(c.job)})</small></h3>
      <p class="story">${escapeHtml(c.story)}</p>
      <p><b>외모:</b> ${c.appearance.map(escapeHtml).join(', ')}</p>
      <p><b>성격:</b> ${c.personality.map(escapeHtml).join(', ')}</p>
      <p><b>타겟:</b> ${escapeHtml(c.target.name)} (${c.target.age}, ${escapeHtml(c.target.job)})</p>
      <p><b>확인된 타겟 취향:</b> ${c.target.visiblePrefs.map(escapeHtml).join(', ')} <span class="redacted">+ ██████(기밀 ${c.target.hiddenPrefs.length}건)</span></p>
      <p class="quote">“${escapeHtml(c.quote)}”</p>
      <div class="difficulty diff-${{ '쉬움': 'easy', '보통': 'normal', '헬': 'hell' }[c.difficulty] || 'normal'}">난이도: ${c.difficulty}</div>
      <button class="btn-select btn95">이 인간을 돕는다</button>`;
    $('#client-cards').appendChild(card);
    const v = newMiniViewer(card.querySelector('canvas'), { spin: true, cameraZ: 3.4 });
    v.setSolo(state.clientSpecs[i]);
    card.querySelector('.btn-select').addEventListener('click', () => { sfx.stamp(); chooseClient(i); });
  });
}

function chooseClient(i) {
  state.chosen = i;
  state.client = state.clients[i];
  state.clientSpec = state.clientSpecs[i];
  state.targetSpec = state.targetSpecs[i];
  state.outfitDesc = ''; state.styleScore = 0; state.courage = 2; state.coaching = '';
  state.intel = []; state.transcript = []; state.aborted = false;
  state.pendingRadio = null; state.radioOpen = false; // 이전 판의 무전 잔재 제거
  gotoConsult();
}

// ── 컨설팅 ──────────────────────────────────────────────
let consultViewer = null;
function gotoConsult() {
  clearMinis();
  show('consult');
  const c = state.client;
  consultViewer = getStageViewer('stage-consult');
  consultViewer.setDuo(state.clientSpec, state.targetSpec, 'camera');
  $('#consult-title').textContent = `작전명: ${c.name} 구출 작전`;
  $('#consult-dossier').innerHTML = `
    <p><b>클라이언트:</b> ${escapeHtml(c.name)} — ${c.personality.map(escapeHtml).join(', ')}</p>
    <p><b>타겟:</b> ${escapeHtml(c.target.name)} — 확인된 취향: ${c.target.visiblePrefs.map(escapeHtml).join(', ')}</p>
    <p class="redacted">숨겨진 취향 ${c.target.hiddenPrefs.length}건은 대화 중 직접 캐내야 한다.</p>`;
  $('#styling-result').textContent = '';
  $('#speech-result').textContent = '';
  $('#styling-input').value = '';
  $('#coaching-input').value = '';
  $('#speech-input').value = '';

  $('#btn-styling').onclick = async () => {
    sfx.click();
    const tags = $('#styling-input').value.trim();
    if (!tags) { toast('스타일링 태그를 입력하라. 예: 빨간 턱시도, 카우보이 부츠'); return; }
    try {
      const r = await withLoading('가위손 박 작업 중... (스타일링 반영)', () =>
        harness.call({ label: '스타일링', system: P.STYLING_SYSTEM, messages: [{ role: 'user', content: P.stylingUser(state.client, state.clientSpec, tags) }], schema: P.STYLING_SCHEMA, effort: 'low' }));
      state.clientSpec = sanitizeSpec(r.spec);
      state.styleScore = Math.max(0, Math.min(10, r.styleScore | 0));
      state.outfitDesc = r.outfitDesc || tags;
      consultViewer.updateLeft(state.clientSpec);
      consultViewer.burst('sparkle', 'left');
      sfx.love();
      $('#styling-result').innerHTML = `<b>스타일 점수 ${state.styleScore}/10</b> — ${escapeHtml(r.comment)}`;
    } catch (e) { toast(errMsg(e)); }
  };

  $('#btn-speech').onclick = async () => {
    sfx.click();
    const speech = $('#speech-input').value.trim();
    try {
      const r = await withLoading('클라이언트가 연설을 듣는 중...', () =>
        harness.call({ label: '격려 연설 평가', system: P.SPEECH_SYSTEM, messages: [{ role: 'user', content: P.speechUser(state.client, speech) }], schema: P.SPEECH_SCHEMA, effort: 'low' }));
      state.courage = Math.max(0, Math.min(10, r.courage | 0));
      if (state.courage >= 6) { consultViewer.burst('love', 'left'); sfx.fanfare(); } else if (state.courage <= 2) sfx.bad();
      $('#speech-result').innerHTML = `<b>용기 게이지 ${state.courage}/10</b> — ${escapeHtml(r.comment)}`;
    } catch (e) { toast(errMsg(e)); }
  };

  $('#btn-start-op').onclick = () => {
    state.coaching = $('#coaching-input').value.trim(); // 코칭은 여기서 확정되어 에이전트 시스템 프롬프트에 들어간다
    sfx.radio();
    startTexting();
  };
}

// ── 대화 엔진 공용 ──────────────────────────────────────
function meterUpdate() {
  $('#meter-mood-fill').style.width = state.mood + '%';
  $('#meter-love-fill').style.width = state.love + '%';
  $('#meter-mood-num').textContent = state.mood;
  $('#meter-love-num').textContent = state.love;
}

function addBubble(who, text) {
  const w = $('#chat-window');
  const div = document.createElement('div');
  div.className = `bubble ${who}`;
  const name = who === 'client' ? state.client.name : who === 'target' ? state.client.target.name : who === 'radio' ? '📻 본부 무전' : '나레이션';
  div.innerHTML = `<span class="who">${escapeHtml(name)}</span>${escapeHtml(text)}`;
  w.appendChild(div);
  w.scrollTop = w.scrollHeight;
}

function floatDelta(mood, love, reason) {
  const w = $('#judge-feed');
  const div = document.createElement('div');
  const cls = love > 0 ? 'good' : love < 0 ? 'bad' : 'meh';
  div.className = `judge-line ${cls}`;
  div.innerHTML = `<b>MOOD ${mood >= 0 ? '+' : ''}${mood} · LOVE ${love >= 0 ? '+' : ''}${love}</b> ${escapeHtml(reason)}`;
  w.prepend(div);
  while (w.children.length > 8) w.lastChild.remove();
}

function transcriptText(limit = 0) {
  const lines = state.transcript.map(t =>
    t.who === 'client' ? `클라이언트: ${t.text}` : t.who === 'target' ? `타겟: ${t.text}` : t.who === 'radio' ? `[본부 무전]: ${t.text}` : `[상황]: ${t.text}`);
  return (limit ? lines.slice(-limit) : lines).join('\n');
}

function pushUser(hist, text) {
  const last = hist[hist.length - 1];
  if (last && last.role === 'user') last.content += '\n' + text;
  else hist.push({ role: 'user', content: text });
}

const waitWhile = cond => new Promise(res => {
  const iv = setInterval(() => { if (!cond()) { clearInterval(iv); res(); } }, 200);
});

async function runConversation(phase) {
  const c = state.client;
  const turns = phase === 'text' ? CONFIG.textTurns : CONFIG.talkTurns;
  const label = phase === 'text' ? '문자' : '대면';
  const clientSystem = P.clientAgentSystem(c, state.coaching, state.courage, state.outfitDesc, phase);
  const targetSystem = P.targetAgentSystem(c, phase, state.outfitDesc);
  const judgeSys = P.judgeSystem(c);

  for (let i = 0; i < turns; i++) {
    await waitWhile(() => state.radioOpen);
    if (state.pendingRadio) {
      const advice = state.pendingRadio; state.pendingRadio = null;
      pushUser(state.clientHist, `[본부 무전 - 상대에게는 안 들림] ${advice}`);
      state.transcript.push({ who: 'radio', text: advice });
      addBubble('radio', advice);
      sfx.radio();
    }

    // 1) 클라이언트 발언
    const clientMsg = await harness.call({ label: `${label} 발언 ${i + 1} (클라)`, system: clientSystem, messages: state.clientHist, effort: 'low', maxTokens: 4000 });
    const historyForJudge = transcriptText(14); // 판정 대상 발언이 이력에 중복되지 않도록 push 전에 캡처
    state.clientHist.push({ role: 'assistant', content: clientMsg });
    state.transcript.push({ who: 'client', text: clientMsg });
    addBubble('client', clientMsg);
    stageViewer.say('left'); sfx.send();

    // 2) 심판 판정
    let judge;
    try {
      judge = await harness.call({ label: `판정 ${i + 1}`, system: judgeSys, messages: [{ role: 'user', content: P.judgeUser(historyForJudge, clientMsg) }], schema: P.JUDGE_SCHEMA, effort: 'low', maxTokens: 4000 });
    } catch (e) {
      judge = { moodDelta: 0, loveDelta: 0, reason: '(심판이 잠시 졸았다)', hiddenPrefHit: '' };
    }
    const md = Math.max(-10, Math.min(10, judge.moodDelta | 0));
    state.mood = Math.max(0, Math.min(100, state.mood + md));
    const mult = 0.5 + state.mood / 100;
    const la = Math.round(Math.max(-10, Math.min(10, judge.loveDelta | 0)) * mult);
    state.love = Math.max(0, Math.min(100, state.love + la));
    meterUpdate();
    floatDelta(md, la, judge.reason || '');
    if (la > 0) { stageViewer.burst('love', 'right'); sfx.love(); }
    else if (la < 0) { stageViewer.burst('bad', 'right'); sfx.bad(); }
    if (judge.hiddenPrefHit && !state.intel.includes(judge.hiddenPrefHit)) {
      state.intel.push(judge.hiddenPrefHit);
      renderIntel();
      toast(`🕵 기밀 취향 입수: "${judge.hiddenPrefHit}"`, 6000);
    }

    if (state.mood <= 0 || state.love <= 0) {
      state.aborted = true;
      addBubble('sys', phase === 'text' ? '...읽씹당했다. 프로필 사진도 강아지로 바뀌었다.' : '...상대가 "화장실 좀"이라며 나가더니 돌아오지 않았다.');
      sfx.trombone();
      return;
    }

    // 3) 타겟 응답
    pushUser(state.targetHist, `[${c.name}의 ${phase === 'text' ? '문자' : '말'}] ${clientMsg}`);
    const targetMsg = await harness.call({ label: `${label} 응답 ${i + 1} (타겟)`, system: targetSystem, messages: state.targetHist, effort: 'low', maxTokens: 4000 });
    state.targetHist.push({ role: 'assistant', content: targetMsg });
    state.transcript.push({ who: 'target', text: targetMsg });
    addBubble('target', targetMsg);
    stageViewer.say('right'); sfx.send();
    pushUser(state.clientHist, `[${c.target.name}의 ${phase === 'text' ? '답장' : '말'}] ${targetMsg}`);
  }
}

function renderIntel() {
  $('#intel-list').innerHTML = state.intel.length
    ? state.intel.map(x => `<li>🔓 ${escapeHtml(x)}</li>`).join('')
    : '<li class="dim">아직 입수한 기밀 없음</li>';
}

function setupChatScreen(phaseTitle, interventions) {
  show('chat');
  $('#chat-window').innerHTML = '';
  $('#judge-feed').innerHTML = '';
  $('#chat-phase-label').textContent = phaseTitle;
  state.interventionsLeft = interventions;
  $('#btn-intervene').textContent = `📻 무전 개입 (${state.interventionsLeft})`;
  $('#btn-intervene').disabled = false;
  renderIntel();
  meterUpdate();
}

// ── 페이즈 1: 문자 ──────────────────────────────────────
let stageViewer = null;
async function startTexting() {
  state.phase = 'text';
  state.mood = Math.min(100, 40 + state.courage * 2);
  state.love = Math.min(100, 15 + state.styleScore);
  state.clientHist = [{ role: 'user', content: `[상황] 드디어 용기를 냈다. ${state.client.target.name}에게 먼저 보낼 첫 문자를 지금 작성해서 전송하라.` }];
  state.targetHist = [];
  setupChatScreen('📱 작전 1단계: 문자 공작', CONFIG.textInterventions);
  stageViewer = getStageViewer('stage-chat');
  stageViewer.setDuo(state.clientSpec, state.targetSpec, 'camera');
  document.body.classList.add('phase-text');
  document.body.classList.remove('phase-talk');

  try {
    await runConversation('text');
  } catch (e) {
    toast(errMsg(e)); state.aborted = true;
    addBubble('sys', '(전파 방해로 공작이 중단되었다...)');
  }
  if (state.aborted) return gotoResult();
  await startTalking();
}

// ── 페이즈 2: 대면 ──────────────────────────────────────
async function startTalking() {
  state.phase = 'talk';
  let situation = { place: '2077 만남의 광장', intro: '어찌저찌 만나기로 했다.' };
  try {
    situation = await withLoading('데이트 장소 섭외 중...', () =>
      harness.call({ label: '대면 상황 생성', system: P.situationSystem(), messages: [{ role: 'user', content: P.situationUser(state.client, transcriptText(20)) }], schema: P.SITUATION_SCHEMA, effort: 'low' }));
  } catch (e) { /* 상황 생성 실패해도 대면은 진행 */ }

  state.clientHist = [{ role: 'user', content: `[상황] 문자 작전 끝에 드디어 만났다. 장소: ${situation.place}. ${situation.intro}\n먼저 첫 마디를 건네라.` }];
  state.targetHist = [{ role: 'user', content: `[상황] ${situation.place}에서 ${state.client.name}을(를) 만나기로 해서 나왔다. 곧 상대가 말을 걸 것이다.` }];
  setupChatScreen(`💬 작전 2단계: 대면 공작 @ ${situation.place}`, CONFIG.talkInterventions);
  stageViewer = getStageViewer('stage-chat');
  stageViewer.setDuo(state.clientSpec, state.targetSpec, 'each');
  stageViewer.setParty(true);
  document.body.classList.remove('phase-text');
  document.body.classList.add('phase-talk');
  addBubble('sys', `[${situation.place}] ${situation.intro}`);

  try {
    await runConversation('talk');
  } catch (e) {
    toast(errMsg(e)); state.aborted = true;
    addBubble('sys', '(요원의 이어폰에서 지직 소리만 났다...)');
  }
  gotoResult();
}

// ── 결과 ────────────────────────────────────────────────
function closeRadioModal() {
  state.radioOpen = false;
  state.pendingRadio = null;
  $('#modal-radio').classList.add('hidden');
}

async function gotoResult() {
  closeRadioModal(); // 대화 종료 시점에 모달이 열려 있으면 결과 화면을 덮어버린다
  let r;
  try {
    r = await withLoading('며칠 뒤... 결과 정산 중...', () =>
      harness.call({ label: '최종 정산', system: P.resultSystem(), messages: [{ role: 'user', content: P.resultUser(state.client, state.mood, state.love, transcriptText(), state.aborted) }], schema: P.RESULT_SCHEMA, effort: 'medium', maxTokens: 8000 }));
  } catch (e) {
    r = { accepted: false, grade: 'F', letter: '(편지가 오지 않았다. 본부와의 통신도 끊겼다. 그것이 2077년의 인터넷이다.)', epilogue: '통신 두절.' };
  }
  document.body.classList.remove('phase-text', 'phase-talk');
  show('result');
  $('#btn-restart').classList.add('hidden');
  $('#result-epilogue').textContent = '';
  const v = getStageViewer('stage-result');
  v.setDuo(state.clientSpec, state.targetSpec, r.accepted ? 'each' : 'camera');
  v.setParty(r.accepted);
  const stamp = $('#result-stamp');
  stamp.textContent = r.accepted ? '커플 성사' : '고백 반려';
  stamp.className = `result-stamp ${r.accepted ? 'ok' : 'fail'}`;
  $('#result-grade').textContent = `공작 등급: ${r.grade}`;
  $('#result-score').textContent = `최종 수치 — MOOD ${state.mood} / LOVE ${state.love}`;
  sfx.stamp();
  setTimeout(() => {
    if (r.accepted) {
      sfx.fanfare(); v.burst('love');
      const iv = setInterval(() => {
        if (state.screen !== 'result') { clearInterval(iv); return; }
        v.burst('love');
      }, 2500);
    } else { sfx.trombone(); v.burst('rain'); }
  }, 600);
  await typeText($('#result-letter'), r.letter, 50);
  $('#result-epilogue').textContent = `— 에필로그: ${r.epilogue}`;
  $('#btn-restart').classList.remove('hidden');
}

// ── 무전 개입 모달 ──────────────────────────────────────
function initRadio() {
  $('#btn-intervene').addEventListener('click', () => {
    if (state.interventionsLeft <= 0) return;
    sfx.radio();
    state.radioOpen = true;
    $('#modal-radio').classList.remove('hidden');
    $('#radio-input').value = '';
    $('#radio-input').focus();
  });
  $('#btn-radio-send').addEventListener('click', () => {
    const text = $('#radio-input').value.trim();
    if (!text) return;
    state.pendingRadio = text;
    state.interventionsLeft--;
    $('#btn-intervene').textContent = `📻 무전 개입 (${state.interventionsLeft})`;
    $('#btn-intervene').disabled = state.interventionsLeft <= 0;
    state.radioOpen = false;
    $('#modal-radio').classList.add('hidden');
  });
  $('#btn-radio-cancel').addEventListener('click', () => {
    state.radioOpen = false;
    $('#modal-radio').classList.add('hidden');
  });
}

// ── 전역 초기화 ─────────────────────────────────────────
function init() {
  initBoot();
  initRadio();
  $('#btn-to-screening').addEventListener('click', () => { sfx.click(); gotoScreening().catch(screeningFail); });
  $('#btn-restart').addEventListener('click', () => { sfx.click(); gotoScreening().catch(screeningFail); });
  $('#btn-retry-screening').addEventListener('click', () => { sfx.click(); gotoScreening().catch(screeningFail); });
  $('#console-toggle').addEventListener('click', () => $('#console-panel').classList.toggle('collapsed'));
  $('#btn-bgm').addEventListener('click', () => {
    const on = toggleBgm();
    $('#btn-bgm').textContent = on ? '🔊 BGM' : '🔇 BGM';
  });
  document.addEventListener('click', () => unlockAudio(), { once: true });
}
init();
