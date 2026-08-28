// game.js — 화면/입력 계층. 대화 진행은 engine.js, 수치는 points.js, 프롬프트는 prompts.js, API는 llm.js.
//
// 화면은 구조도를 그대로 따른다:
//   S 스크리닝 → A-1 미용실(외모) → A-2 취조실(성격) → B 코칭 → B 텍스팅·토킹 → C 후일담
//
// A는 한 상자지만 호출은 둘이다. 미용실은 외모만, 취조실은 성격만 고친다 —
// 서로의 주문도, 서로의 결과도 보지 않는다.
//
// 준비 세 화면은 주문을 받을 때마다 고객의 반응을 한 줄 받아온다 (prompts.js의 R 블록).
// 그 문장은 **화면에만** 뜬다 — 어떤 프롬프트에도 실리지 않고 점수에도 닿지 않는다.
import { LlmClient, RefusalError, normalizeUsage } from './llm.js';
import * as P from './prompts.js';
import { Engine, dressOf } from './engine.js';
import { PHASES, POINTS, MARK, MARK_CLASS, gauge } from './points.js';
import { COUPLES } from './couples.js';
import { AvatarViewer, sanitizeSpec, renderThumb } from './avatar.js';
import { sfx, toggleBgm, unlockAudio } from './audio.js';
import * as pace from './pacing.js';
import { $, $$, escapeHtml, list, sget, sset, toast, loading, withLoading, typeText } from './ui.js';
import { initIntro, renderIntro } from './intro.js';
import { initBoot } from './boot.js';

const llm = new LlmClient();

const state = {
  screen: 'boot',
  agent: { name: '' },
  couple: null, clientSpec: null, targetSpec: null,
  orders: { styling: '', motivation: '', coaching: '' },
  styled: { look: null, personality: null },   // A-1 / A-2 의 출력. 각자 따로 채워진다
  styledFrom: { styling: '', motivation: '' },  // 그 칸이 어느 주문에서 나왔나 ('' = 손 안 댐)
  reactions: { styling: null, motivation: null, coaching: null },  // 화면 표시 전용
  engine: null, result: null,
};
window.__game = { state, llm, COUPLES, PHASES, POINTS, pace }; // 자동 테스트 후크

/** 지금 시점의 고객 시트 — 시공 전이면 테이블 값이 그대로 시트다. */
const dressed = () => dressOf(state.couple.client, state.styled);

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

function errMsg(e) {
  if (e instanceof RefusalError) return '연산 모형이 본 내용의 처리를 거부했다. 표현을 바꿔 재시도하라.';
  return `통신 사고 — ${e.message}`;
}

// ── 성사 기록 (이 정도가 전부다) ────────────────────────
function clearedIds() {
  try { return new Set(JSON.parse(sget('localStorage', 'cupid_cleared') || '[]')); }
  catch { return new Set(); }
}
function markCleared(id) {
  const s = clearedIds(); s.add(id);
  sset('localStorage', 'cupid_cleared', JSON.stringify([...s]));
}
function renderRecord() {
  const el = $('#agent-record');
  if (!el) return;
  const n = clearedIds().size;
  el.innerHTML = `<b>요원 ${escapeHtml(state.agent.name || '무명')}</b> · 성사시킨 조합 <b>${n}/${COUPLES.length}</b>`;
}

// ── LLM 콘솔 ────────────────────────────────────────────
llm.onLog((entry, usage) => {
  const box = $('#console-log');
  let el = entry._el;
  if (!el) { el = document.createElement('details'); entry._el = el; box.prepend(el); while (box.children.length > 60) box.lastChild.remove(); }
  const st = { pending: '···', ok: 'OK ', error: 'ERR', refusal: 'REF' }[entry.status] || '  ?';
  const u = entry.response ? normalizeUsage(entry.response) : null;
  const cacheTag = u?.cacheRead ? ` · 캐시 ${u.cacheRead}` : '';
  const via = entry.provider ? `${escapeHtml(entry.provider)}/` : '';
  el.innerHTML = `<summary>${st} <b>${escapeHtml(entry.label)}</b> · ${via}${escapeHtml(entry.model)} · ${entry.ms ? Math.round(entry.ms) + 'ms' : '...'}${u ? ` · ${u.input}→${u.output}tok${cacheTag}` : ''}${entry.note ? ` · ${escapeHtml(entry.note)}` : ''}${entry.error ? ` · ${escapeHtml(entry.error)}` : ''}</summary><pre>${escapeHtml(JSON.stringify({ request: entry.request, response: entry.response ?? null }, null, 1).slice(0, 8000))}</pre>`;
  $('#console-usage').textContent =
    `호출 ${usage.calls} · in ${usage.inputTokens.toLocaleString()} · out ${usage.outputTokens.toLocaleString()} · 캐시적중 ${usage.cacheRead.toLocaleString()} · 약 $${usage.cost.toFixed(3)}${usage.saved > 0 ? ` (캐시 절감 $${usage.saved.toFixed(3)})` : ''}`;
});

// ── 신입 교육 ──────────────────────────────────────────
// 슬라이드 자체는 intro.js에 산다. 여기서는 화면을 띄우고, 끝나면 어디로 갈지만 정한다.
function showIntro() { show('intro'); renderIntro(); }

// ── S. 스크리닝 ─────────────────────────────────────────
function gotoRoster() {
  show('roster');
  renderRecord();
  renderRosterCards();
}

function renderRosterCards() {
  const cleared = clearedIds();
  const box = $('#roster-cards');
  box.innerHTML = '';
  for (const c of COUPLES) {
    const card = document.createElement('div');
    card.className = `couple-card${cleared.has(c.id) ? ' cleared' : ''}`;
    card.innerHTML = `
      ${cleared.has(c.id) ? '<div class="cleared-stamp">성사 완료</div>' : ''}
      <div class="cc-head"><span class="cc-cat">${escapeHtml(c.category)}</span></div>
      <div class="cc-pair">
        <figure><img alt="${escapeHtml(c.client.name)}" src="${renderThumb(c.client.spec, c.id + ':c')}"><figcaption>${escapeHtml(c.client.name)}<span class="cc-sex">고객</span></figcaption></figure>
        <div class="cc-vs">✕</div>
        <figure><img alt="${escapeHtml(c.target.name)}" src="${renderThumb(c.target.spec, c.id + ':t')}"><figcaption>${escapeHtml(c.target.name)}<span class="cc-sex">타겟</span></figcaption></figure>
      </div>
      <ul class="cc-meta">
        <li>타겟 취향 <b>${c.target.taste.length}</b>항</li>
        <li>노출 항목 <b>8</b>/8</li>
      </ul>
      <div class="cc-btns">
        <button class="btn95 tiny cc-detail" type="button">스크리닝</button>
        <button class="btn95 cc-take" type="button">이 조합을 맡는다</button>
      </div>`;
    box.appendChild(card);
    card.querySelector('.cc-detail').addEventListener('click', () => { sfx.click(); openDossier(c); });
    card.querySelector('.cc-take').addEventListener('click', () => { sfx.stamp(); chooseCouple(c); });
  }
}

// 스크리닝 시 노출 정보 — 여덟 항목. 목록의 원본은 prompts.js의 SCREEN_FIELDS다.
function fieldRows(person, which) {
  return P.SCREEN_FIELDS[which].map(f =>
    `<p><b>${escapeHtml(f.label)}:</b> ${escapeHtml(list(person[f.key]))}</p>`).join('');
}

function dossierHtml(c, { full = false } = {}) {
  return `
    <div class="stamp">노출</div>
    <div class="screen-cols">
      <div class="screen-col">
        <h3>고객 · ${escapeHtml(c.client.name)} <small>(${escapeHtml(P.idOf(c.client))})</small></h3>
        ${fieldRows(c.client, 'client')}
      </div>
      <div class="screen-col">
        <h3>타겟 · ${escapeHtml(c.target.name)} <small>(${escapeHtml(P.idOf(c.target))})</small></h3>
        ${fieldRows(c.target, 'target')}
      </div>
    </div>
    <p class="handoff-warn">이 여덟 항목이 <b>노출 정보의 전부</b>다. 뒤에 숨겨둔 항목은 없다.
      다만 <b>타겟 취향은 고객이 모른다</b> — 노리게 하려면 코칭에 직접 적어야 한다.</p>
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
  state.orders = { styling: '', motivation: '', coaching: '' };
  state.styled = { look: null, personality: null };
  state.styledFrom = { styling: '', motivation: '' };
  state.reactions = { styling: null, motivation: null, coaching: null };
  state.engine = null; state.result = null;
  gotoStyling();
}

// ── R. 준비 단계 반응 ───────────────────────────────────
// 요원이 주문을 하나 내릴 때마다 고객이 그 자리에서 한마디 한다. 그게 전부다 —
// 이 문장은 대화 프롬프트에도, 판정에도, 후일담에도 실리지 않는다. 점수도 없다.
function renderReaction(kind, sel) {
  const el = $(sel);
  if (!el) return;
  const r = state.reactions[kind];
  if (!r) {
    el.innerHTML = `<span class="inject-empty">아직 아무 말도 안 했다 — 주문을 내려야 입을 연다</span>`;
    return;
  }
  el.innerHTML = `<div class="react-line"><span class="react-who">${escapeHtml(state.couple.client.name)}
    <small>· ${escapeHtml(P.REACT_ROOMS[kind].room)}</small></span>${escapeHtml(r.reaction)}</div>`
    + (r.text === state.orders[kind].trim() ? ''
      : `<p class="dim small">주문이 그 뒤로 바뀌었다 — 이건 <b>이전 주문</b>에 대한 대꾸다.</p>`);
}

async function reactTo(kind, { input, box, viewer }) {
  const text = $(input).value.trim();
  const had = state.reactions[kind];
  if (had && had.text === text) return renderReaction(kind, box);   // 같은 주문에 두 번 묻지 않는다
  const r = await withLoading(`${P.REACT_ROOMS[kind].room} — 고객 반응 대기`, () => llm.call({
    label: `R · ${P.REACT_ROOMS[kind].room} 반응`, system: P.reactSystem(state.couple, kind),
    messages: [{ role: 'user', content: P.reactUser(kind, text) }],
    schema: P.REACT_SCHEMA, effort: 'low', maxTokens: 3000,
  }));
  state.reactions[kind] = { text, reaction: r.reaction, face: r.face };
  renderReaction(kind, box);
  viewer?.emote('left', r.face);
  sfx.send();
}

// ── A. 시공 — 미용실과 취조실이 각자 제 칸만 고친다 ─────
// 두 호출은 서로를 모른다. 스타일링 프롬프트에 성격이 없고, 동기부여 프롬프트에 외모가 없다.
// 주문이 비어 있으면 부르지 않는다 — 그 칸은 테이블 값이 그대로 시트가 된다 (engine.js의 dressOf).
// 주문을 **지운** 것도 어긋난 것이다. 지운 걸 못 본 척하고 예전 시공물을
// 계속 대화 프롬프트에 실어 보내면 안 된다.
const stale = (kind) => state.styledFrom[kind] !== state.orders[kind].trim();

// 주문이 비면 부르지 않고 그 칸을 테이블 값으로 되돌린다.
function clearSheet(kind, viewer) {
  if (kind === 'styling') {
    state.styled.look = null;
    state.clientSpec = sanitizeSpec(state.couple.client.spec);
    viewer?.updateLeft(state.clientSpec);
  } else {
    state.styled.personality = null;
  }
  state.styledFrom[kind] = '';
}

// 그 칸을 지금 주문에 맞춘다 — 부르거나, 되돌리거나, 이미 맞으면 아무것도 안 한다.
function syncSheet(kind, viewer) {
  if (!stale(kind)) return Promise.resolve();
  if (!state.orders[kind].trim()) { clearSheet(kind, viewer); return Promise.resolve(); }
  return kind === 'styling' ? runStyling(viewer) : runMotivation();
}

async function runStyling(viewer) {
  const order = state.orders.styling.trim();
  const r = await withLoading('시공 중... (고객 외모 갱신)', () => llm.call({
    label: 'A-1 · 스타일링', system: P.STYLING_SYSTEM,
    messages: [{ role: 'user', content: P.stylingUser(state.couple, state.clientSpec, order) }],
    schema: P.STYLING_SCHEMA, effort: 'low', maxTokens: 6000,
  }));
  // 조형 보정 플래그는 스키마에 없다. 시공 후에도 유지해준다.
  state.clientSpec = sanitizeSpec({ ...r.spec, femme: state.couple.client.spec.femme });
  state.styled.look = r.look;
  state.styledFrom.styling = order;
  viewer?.updateLeft(state.clientSpec);
  viewer?.burst('sparkle', 'left');
  sfx.stamp();
}

async function runMotivation() {
  const order = state.orders.motivation.trim();
  const r = await withLoading('주입 중... (고객 성격 갱신)', () => llm.call({
    label: 'A-2 · 동기부여', system: P.MOTIVATION_SYSTEM,
    messages: [{ role: 'user', content: P.motivationUser(state.couple, order) }],
    schema: P.MOTIVATION_SCHEMA, effort: 'low', maxTokens: 6000,
  }));
  state.styled.personality = r.personality;
  state.styledFrom.motivation = order;
  sfx.stamp();
}

// 한 화면은 제 칸 하나만 보여준다. 미용실은 외모, 취조실은 성격.
function renderSheetOut(sel, kind) {
  const el = $(sel);
  if (!el) return;
  const c = state.couple.client;
  const [tag, out, table] = kind === 'styling'
    ? ['수정된 고객 외모', state.styled.look, list(c.look)]
    : ['수정된 고객 성격', state.styled.personality, list(c.personality)];
  if (!out) {
    el.innerHTML = `<span class="inject-empty">아직 손대지 않았다 — 이대로 나가면 <b>테이블 값이 그대로 시트</b>가 된다<br>
      <span class="dim">${escapeHtml(table)}</span></span>`;
    return;
  }
  el.innerHTML =
    `<div class="sheet-out"><span class="sheet-tag cached">${tag}</span>${escapeHtml(out)}</div>`
    + (stale(kind)
      ? `<p class="handoff-warn">주문이 바뀌었다. <b>다시 돌려야</b> 반영된다 — 넘어갈 때 자동으로 한 번 더 돈다.</p>`
      : `<p class="dim small">이 문단이 그대로 대화 프롬프트의 고객 시트에 들어간다. 캐시되어 판이 끝날 때까지 유지된다.</p>`);
}

// 준비 화면의 버튼은 한 번에 하나만 돈다. 대기막은 포인터를 막지 키보드를 막지 않는다 —
// 초점이 버튼에 있으면 엔터로 얼마든지 또 누를 수 있다.
let prepBusy = false;
const oncePerPress = fn => async () => {
  if (prepBusy) return;
  prepBusy = true;
  try { return await fn(); } finally { prepBusy = false; }
};

// 주문 하나 = 반응 하나 + 시공 하나. 둘은 서로를 안 보므로 같이 보내고,
// **둘 다 끝난 뒤에** 그린다. 하나가 엎어졌다고 성공한 쪽까지 안 그리면 안 된다.
function orderHandler(kind, { input, box, out, viewer }) {
  return oncePerPress(async () => {
    sfx.click();
    const done = await Promise.allSettled([
      reactTo(kind, { input, box, viewer: viewer() }),
      syncSheet(kind, viewer()),
    ]);
    renderReaction(kind, box);
    renderSheetOut(out, kind);
    const failed = done.find(r => r.status === 'rejected');
    if (failed) toast(errMsg(failed.reason));
  });
}

// 넘어갈 때 시공이 밀려 있으면 조용히 흘리지 않고 한 번 돌린다.
// 다만 회선이 죽었다고 화면에 가둬두지는 않는다 — 한 번 더 누르면 그대로 내보낸다.
function nextHandler(kind, { out, viewer, go }) {
  let forced = false;
  return oncePerPress(async () => {
    sfx.click();
    if (stale(kind) && !forced) {
      try { await syncSheet(kind, viewer()); }
      catch (e) {
        forced = true;
        renderSheetOut(out, kind);
        return toast(`${errMsg(e)} — 한 번 더 누르면 시공 없이 넘어간다.`);
      }
      renderSheetOut(out, kind);
    }
    forced = false;
    go();
  });
}

// ── A-1 미용실 · A-2 취조실 ────────────────────────────
// 두 화면은 같은 화면이다. 갈리는 것은 이 표뿐이다 — 어느 칸을 고치는가, 무대에 누가 서는가,
// 앞뒤가 어디인가. 화면 요소는 id 규약(kind-title / -dossier / -input / -react / -result)으로 찾는다.
const PREP = {
  styling: {
    stage: 'stage-styling', title: '미용실 · 스타일링', solo: false,
    back: () => gotoRoster(), next: () => gotoMotivation(),
  },
  motivation: {
    stage: 'stage-motivation', title: '취조실 · 동기부여', solo: true,
    back: () => gotoStyling(), next: () => gotoCoaching(),
  },
};
const prepViewers = {};

function gotoPrep(kind) {
  const p = PREP[kind], c = state.couple;
  const id = part => `#${kind}-${part}`;
  show(kind);

  const v = prepViewers[kind] = getStageViewer(p.stage);
  if (p.solo) v.setSolo(state.clientSpec);
  else v.setDuo(state.clientSpec, state.targetSpec, 'camera');
  const viewer = () => prepViewers[kind];

  $(id('title')).innerHTML = `${p.title} `
    + `<span class="diff-inline">${escapeHtml(c.client.name)} × ${escapeHtml(c.target.name)}</span>`;
  $(id('dossier')).innerHTML = dossierHtml(c);
  $(id('input')).value = state.orders[kind];

  const paint = () => { renderReaction(kind, id('react')); renderSheetOut(id('result'), kind); };
  paint();
  $(id('input')).oninput = e => { state.orders[kind] = e.target.value; paint(); };
  $(`#btn-${kind}`).onclick = orderHandler(kind, {
    input: id('input'), box: id('react'), out: id('result'), viewer,
  });
  $(`#btn-${kind}-back`).onclick = () => { sfx.click(); p.back(); };
  $(`#btn-${kind}-next`).onclick = nextHandler(kind, { out: id('result'), viewer, go: p.next });
}

const gotoStyling = () => gotoPrep('styling');
const gotoMotivation = () => gotoPrep('motivation');

// ── B 준비. 코칭 ────────────────────────────────────────
let coachingViewer = null;
function gotoCoaching() {
  show('coaching');
  const c = state.couple;
  coachingViewer = getStageViewer('stage-coaching');
  coachingViewer.setSolo(state.clientSpec);
  $('#coaching-brief').innerHTML =
    `<h3>타겟 · ${escapeHtml(c.target.name)} <small>(${escapeHtml(P.idOf(c.target))})</small></h3>
     ${fieldRows(c.target, 'target')}
     <p class="handoff-warn"><b>이 네 항목은 고객에게 자동으로 넘어가지 않는다.</b>
       고객이 아는 것은 자기 시트뿐이다. 나머지는 <b>코칭에 직접 적어야</b> 그 인간 머릿속에 들어간다.</p>`;
  $('#coaching-input').value = state.orders.coaching;

  const sync = () => {
    state.orders.coaching = $('#coaching-input').value;
    const t = state.orders.coaching.trim();
    const el = $('#coaching-inject');
    el.innerHTML = t
      ? `<span class="inject-label">고객 프롬프트에 이렇게 박힌다 · ${t.length}자</span>`
        + `<code class="inject-code">[L 기관 코칭 — 고객의 귀에만 들어갔다]\n"""\n${escapeHtml(t)}\n"""</code>`
      : `<span class="inject-empty">코칭 없음 → 고객은 <b>아무 준비 없이</b> 제 시트대로만 움직인다</span>`;
    renderReaction('coaching', '#coaching-react');
  };
  $('#coaching-input').oninput = sync;
  sync();

  renderReaction('coaching', '#coaching-react');
  $('#btn-coaching').onclick = oncePerPress(async () => {
    sfx.click();
    state.orders.coaching = $('#coaching-input').value;
    try { await reactTo('coaching', { input: '#coaching-input', box: '#coaching-react', viewer: coachingViewer }); }
    catch (e) { toast(errMsg(e)); }
    renderReaction('coaching', '#coaching-react');
  });
  $('#btn-coaching-back').onclick = () => { sfx.click(); gotoMotivation(); };
  $('#btn-start-op').onclick = () => { sfx.stamp(); startOperation(); };
}

// ── B. 텍스팅 & 토킹 ────────────────────────────────────
let stageViewer = null;

function pointsUpdate(s) {
  // 눈금이 둘 다 다르므로 막대 길이는 각자의 최대치로 환산한다. 숫자는 눈금 그대로 띄운다.
  $('#meter-mood-fill').style.width = gauge(s.mood, POINTS.moodMax).pct + '%';
  $('#meter-mood-num').textContent = `${s.mood}/${POINTS.moodMax}`;
  $('#meter-love-fill').style.width = gauge(s.love, POINTS.loveMax).pct + '%';
  $('#meter-love-num').textContent = `${s.love}/${POINTS.loveMax}`;
  $('#meter-mood-fill').classList.toggle('danger', s.mood <= POINTS.moodDanger);
  $('#turn-badge').textContent = `${s.phaseLabel} ${Math.min(s.beat + 1, s.beats)}/${s.beats}구간`;
  paintRadio();
}

// 판정은 구간이 끝난 뒤에 온다. 말풍선이 뜨는 즉시 몸이 반응하도록 문장에서 표정을 유추한다.
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

async function addBubble(who, text) {
  const w = $('#chat-window');
  const div = document.createElement('div');
  div.className = `bubble ${who}`;
  const name = who === 'client' ? state.couple.client.name : who === 'target' ? state.couple.target.name : '상황';
  div.innerHTML = `<span class="who">${escapeHtml(name)}</span><span class="say"></span>`;
  const say = div.querySelector('.say');
  w.appendChild(div);
  const follow = () => { w.scrollTop = w.scrollHeight; };
  follow();
  if (who === 'client') { stageViewer?.emote('left', emoteFromText(text)); sfx.send(); }
  else if (who === 'target') { stageViewer?.emote('right', emoteFromText(text)); sfx.send(); }

  const plan = pace.bubblePlan(text);
  await pace.typeInto(say, text, follow, { typeMs: plan.typeMs });
  follow();
  await pace.beat(plan.beatMs);
}

// 판정 표시. 심판이 내보내는 건 증감 여부뿐이므로, 화면에 뜨는 것도 그것뿐이다.
function addVerdict(v) {
  const w = $('#verdict-log');
  const li = document.createElement('li');
  li.className = `verdict-row ${MARK_CLASS[v.dLove] || 'same'}`;
  li.innerHTML =
    `<span class="vr-when">${escapeHtml(v.phaseLabel)} ${v.beat}/${v.beats}</span>` +
    `<span class="vr-mark mood ${MARK_CLASS[v.dMood]}">무드 ${MARK[v.dMood]}</span>` +
    `<span class="vr-mark love ${MARK_CLASS[v.dLove]}">러브 ${MARK[v.dLove]}${v.step > 1 ? v.step : ''}</span>`;
  w.prepend(li);
  while (w.children.length > 24) w.lastChild.remove();

  if (v.dLove > 0) { stageViewer?.burst('love', 'right'); sfx.love(); }
  else if (v.dLove < 0) { stageViewer?.burst('rain', 'right'); sfx.bad(); }
  else if (v.dMood < 0) sfx.bad();
  return pace.beat(pace.judgeMs('무드 러브 판정'));
}

// ── 무전 · 현장 무전 — 판 도중의 레버 둘 ────────────────
// 개입 버튼을 누르면 engine이 다음 줄 경계에서 대화를 세우고 hold 핸들러로 회선을 연다.
// 어느 쪽을 송출하든 그 명령이 다음 생성 프롬프트에 박힌다 (prompts.js의 radioOrder·fieldOrder).
// 엔진과 같은 두 이름(radio·field)을 쓴다. 화면에서 갈리는 것은 이 표뿐이다.
const LEVER_UI = {
  radio: {
    input: '#radio-input', send: '#btn-radio-send', who: '무전',
    empty: '무전 내용이 비었다. 적어서 보내거나 취소하라.',
    label: left => (left ? '무전 송출 — 회선 재개' : `📻 무전 소진 · 이 페이즈 배급 없음`),
    cut: order => `📻 L 기관 무전 · 고객 이어폰 직결 — "${order}" <b>(반드시 이행)</b>. 타겟은 듣지 못했다.`,
  },
  field: {
    input: '#field-input', send: '#btn-field-send', who: '현장',
    empty: '현장 지시가 비었다. 무엇을 실행할지 적어라.',
    label: left => (left ? '🚚 현장 투입 — 회선 재개' : '🚚 현장 배급 소진 (판 전체 1회)'),
    cut: order => `🚚 현장팀 투입 — "${order}" <b>(이미 벌어진 일)</b>. 거부권도, 되돌릴 길도 없다.`,
  },
};

// 개입 버튼 하나. 어느 쪽 배급이든 남아 있으면 열린다.
function paintRadio() {
  const btn = $('#btn-radio');
  const e = state.engine;
  if (!e) { btn.disabled = true; btn.textContent = '📻 무전 개입'; btn.classList.remove('armed'); return; }
  const s = e.radioState(), f = e.fieldState();
  btn.disabled = !s.can && !f.can;
  btn.classList.toggle('armed', s.armed);
  btn.textContent = s.armed ? '📻 대기 — 곧 회선이 열린다'
    : s.left > 0 ? `📻 무전 개입 · ${s.phaseLabel} ${s.left}회`
      : f.left > 0 ? '🚚 현장 개입 · 판 전체 1회'
        : `📻 배급 소진 · ${s.phaseLabel}`;
  btn.title = s.left > 0 ? '대화를 세우고 고객 이어폰에 명령을 꽂는다. 페이즈마다 한 번뿐이다.'
    : f.left > 0 ? '고객 무전은 소진됐다. 현장팀 물리 지원은 아직 한 번 남았다.'
      : '이 페이즈에 남은 개입이 없다.';
}

// 송출 버튼 둘. 배급이 없으면 그 칸만 잠긴다.
function paintPanel() {
  const e = state.engine;
  for (const [kind, u] of Object.entries(LEVER_UI)) {
    const left = e ? e.leverLeft(kind) : 0;
    $(u.send).disabled = !left;
    $(u.input).disabled = !left;
    $(u.send).textContent = u.label(left);
  }
  syncRadioInject();
  paintRadio();
}

function syncRadioInject() {
  const t = $('#radio-input').value.trim();
  $('#radio-inject').innerHTML = t
    ? `<span class="inject-label">고객 프롬프트에 이렇게 박힌다 · ${t.length}자</span>`
      + `<code class="inject-code">[L 기관 무전 — 방금 고객의 이어폰에 꽂혔다. 타겟은 듣지 못했다]\n"""\n${escapeHtml(t)}\n"""\n→ 반드시 이행. 거부·보류·희석 없음.</code>`
    : `<span class="inject-empty">비워서 보내면 무전은 나가지 않고 배급도 그대로다</span>`;
}

function openRadio() {
  const p = $('#radio-panel');
  p.classList.remove('hidden');
  for (const u of Object.values(LEVER_UI)) $(u.input).value = '';
  paintPanel();
  sfx.click();
  $('#radio-input').focus();
  p.scrollIntoView({ block: 'end' });   // 송출 버튼까지 보이게. focus 뒤에 와야 이게 이긴다
}

function closeRadio() {
  $('#radio-panel').classList.add('hidden');
  paintRadio();
}

// 명령이 나간 자리 표시. 화면에만 뜬다 — engine의 대화 기록에는 두 사람의 반응만 남는다.
function markCut(kind, order) {
  const w = $('#chat-window');
  const div = document.createElement('div');
  div.className = 'bubble sys radio-cut';
  div.innerHTML = `<span class="who">${LEVER_UI[kind].who}</span>`
    + `<span class="say">${LEVER_UI[kind].cut(escapeHtml(order))}</span>`;
  w.appendChild(div);
  w.scrollTop = w.scrollHeight;
  sfx.send();
}

function initRadio() {
  $('#btn-radio').addEventListener('click', () => {
    const e = state.engine;
    if (!e || !e.requestHold()) return;
    sfx.click();
    paintRadio();
    toast('개입 대기 — 지금 오가는 대사가 끝나는 대로 대화가 선다.', 3000);
  });
  $('#radio-input').addEventListener('input', syncRadioInject);
  for (const [kind, u] of Object.entries(LEVER_UI)) {
    $(u.send).addEventListener('click', () => {
      const t = $(u.input).value.trim();
      if (!t) { toast(u.empty, 3000); return; }
      state.engine?.send(kind, t);
    });
  }
  $('#btn-radio-cancel').addEventListener('click', () => { sfx.click(); state.engine?.releaseHold(); });
  paintRadio();
}

function setChatTitle(label) {
  $('#chat-phase-label').textContent = `B · ${label} 페이즈 — ${state.couple.client.name} × ${state.couple.target.name}`;
}

async function startOperation() {
  state.orders.coaching = $('#coaching-input').value.trim();

  const handlers = {
    line: async (who, text) => { await addBubble(who, text); paintRadio(); },
    verdict: addVerdict,
    points: pointsUpdate,
    // 무전 — 버튼이 눌리면 engine이 여기서 대화를 세운다. 송출/취소가 다시 굴린다.
    hold: () => { openRadio(); },
    resume: ({ order, field }) => { closeRadio(); if (field) markCut('field', field); if (order) markCut('radio', order); },
    phase: async p => {
      setChatTitle(p.label);
      paintRadio();
      if (p.key === 'talk') {
        const sep = document.createElement('div');
        sep.className = 'judge-sep';
        sep.textContent = '── 여기서부터 토킹 페이즈 ──';
        $('#chat-window').appendChild(sep);
        stageViewer = getStageViewer('stage-chat');
        stageViewer.setDuo(state.clientSpec, state.targetSpec, 'each');
        stageViewer.setParty(true);
        document.body.classList.remove('phase-text');
        document.body.classList.add('phase-talk');
      }
    },
  };

  show('chat');
  $('#chat-window').innerHTML = '';
  $('#verdict-log').innerHTML = '';
  $('#radio-panel').classList.add('hidden');
  stageViewer = getStageViewer('stage-chat');
  stageViewer.setDuo(state.clientSpec, state.targetSpec, 'camera');
  document.body.classList.add('phase-text');
  document.body.classList.remove('phase-talk');
  setChatTitle(PHASES[0].label);

  const engine = new Engine(llm, {
    couple: state.couple, dressed: dressed(), coaching: state.orders.coaching, handlers,
  });
  state.engine = engine;
  pointsUpdate(engine.snapshot());
  paintRadio();

  try {
    await engine.run();
  } catch (e) {
    toast(errMsg(e));
    await addBubble('sys', '(전파 방해로 공작이 중단되었다...)');
    engine.aborted = true;
    engine.releaseHold();
  }
  closeRadio();
  await gotoResult();
}

// ── C. 후일담 ───────────────────────────────────────────
async function gotoResult() {
  document.body.classList.remove('phase-text', 'phase-talk');
  const r = await withLoading('며칠 뒤... 후일담 수집 중...', () => state.engine.finish());
  state.result = r;
  const c = state.couple;

  show('result');
  $('#btn-restart').classList.add('hidden');
  $('#btn-retry').classList.add('hidden');
  $('#result-epilogue').textContent = '';

  const v = getStageViewer('stage-result');
  v.setDuo(state.clientSpec, state.targetSpec, r.success ? 'each' : 'camera');
  v.setParty(r.success);
  v.emote('left', r.success ? 'proud' : 'sad');
  v.emote('right', r.success ? 'laugh' : 'freeze');

  const stamp = $('#result-stamp');
  stamp.textContent = r.success ? '성사' : r.broken ? '자리 파탄' : '결렬';
  stamp.className = `result-stamp ${r.success ? 'ok' : 'fail'}`;
  $('#result-score').textContent =
    `러브 포인트 ${r.love} / ${POINTS.loveMax} · 무드 포인트 ${r.mood} / ${POINTS.moodMax}`;
  $('#result-note').textContent = r.broken
    ? '무드 포인트가 바닥나 자리가 중간에 깨졌다. 남은 구간은 돌지 않았다.'
    : '성사 여부는 러브 포인트를 보고 기록관이 정했다.';

  $('#debrief-turns').innerHTML =
    '<div class="turn-table-wrap"><table class="turn-table"><tr><th>구간</th><th>무드</th><th>러브</th></tr>' +
    r.points.history.map(h =>
      `<tr class="${h.dLove > 0 ? 'good' : h.dLove < 0 ? 'bad' : ''}">` +
      `<td>${escapeHtml(phaseLabel(h.phase))} ${h.beat}</td>` +
      `<td class="${MARK_CLASS[h.dMood]}">${MARK[h.dMood]} ${h.mood}</td>` +
      `<td class="${MARK_CLASS[h.dLove]}">${MARK[h.dLove]} ${h.love}</td></tr>`).join('') +
    '</table></div>';
  // 무전·현장 무전은 대화 기록에 없다 (심판도 기록관도 못 본 문장이다). 요원 몫으로 따로 붙인다.
  const cuts = [
    ...state.engine.radioLog.map(x => ({ ...x, tag: '📻' })),
    ...state.engine.fieldLog.map(x => ({ ...x, tag: '🚚' })),
  ].sort((a, b) => a.beat - b.beat);
  $('#debrief-radio').innerHTML = cuts.length
    ? `<h4 class="hud-h">개입 원장 <span class="dim">— 요원이 직접 꽂은 명령. 대화 기록에는 없다</span></h4>`
      + `<ul class="radio-ledger">` + cuts.map(x =>
        `<li><span class="vr-when">${x.tag} ${escapeHtml(x.phaseLabel)} ${x.beat}구간</span> ${escapeHtml(x.text)}</li>`).join('')
      + `</ul>`
    : '';
  $('#debrief-transcript').textContent = r.transcript;

  if (r.success) markCleared(c.id);

  sfx.stamp();
  setTimeout(() => {
    if (r.success) {
      sfx.fanfare(); v.burst('love');
      const iv = setInterval(() => { if (state.screen !== 'result') return clearInterval(iv); v.burst('love'); }, 2500);
    } else { sfx.trombone(); v.burst('rain'); }
  }, 600);

  await typeText($('#result-epilogue'), r.epilogue, 40);
  $('#btn-retry').classList.remove('hidden');
  $('#btn-restart').classList.remove('hidden');
}
const phaseLabel = key => (PHASES.find(p => p.key === key) || PHASES[0]).label;

// ── 재생 속도 ───────────────────────────────────────────
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

  pace.attachSkip($('#screen-chat'));
  const advance = $('#chat-advance');
  pace.onWaitChange(on => advance.classList.toggle('on', on && pace.paceMult() > 0));
}

// ── 초기화 ──────────────────────────────────────────────
function init() {
  for (const el of $$('.n-couples')) el.textContent = COUPLES.length;
  initBoot({
    llm,
    errMsg,
    onBooted: name => { state.agent = { name }; showIntro(); },
    onFailed: () => show('boot'),
  });
  initIntro({ onDone: gotoRoster, isOpen: () => state.screen === 'intro' });
  initPacing();
  initRadio();
  $('#btn-restart').addEventListener('click', () => { sfx.click(); gotoRoster(); });
  $('#btn-retry').addEventListener('click', () => { sfx.click(); chooseCouple(state.couple); });
  const toggleConsole = () => $('#console-panel').classList.toggle('hidden');
  $('#console-toggle').addEventListener('click', toggleConsole);
  $('#btn-console').addEventListener('click', toggleConsole);
  $('#btn-bgm').addEventListener('click', () => { $('#btn-bgm').textContent = toggleBgm() ? '음향 ON' : '음향 OFF'; });
  document.addEventListener('click', () => unlockAudio(), { once: true });
}
init();
