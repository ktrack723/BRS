// game.js — 화면/입력 계층. 대화 진행은 engine.js, 수치는 points.js, 프롬프트는 prompts.js, API는 llm.js.
//
// 화면은 구조도를 그대로 따른다:
//   S 스크리닝 → A 스타일링/동기부여 → B 코칭 → B 텍스팅·토킹 → C 후일담
import { LlmClient, RefusalError, detectProvider, providerOf, defaultModelOf, modelFitsProvider, normalizeUsage, DEFAULT_PROVIDER } from './llm.js';
import * as P from './prompts.js';
import { Engine, dressOf } from './engine.js';
import { PHASES, POINTS, MARK, MARK_CLASS, gauge } from './points.js';
import { COUPLES } from './couples.js';
import { AvatarViewer, sanitizeSpec, renderThumb } from './avatar.js';
import { sfx, startBgm, toggleBgm, unlockAudio } from './audio.js';
import * as pace from './pacing.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const escapeHtml = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const list = v => (Array.isArray(v) ? v.join(' / ') : String(v ?? ''));

const llm = new LlmClient();

const state = {
  screen: 'boot',
  agent: { name: '' },
  couple: null, clientSpec: null, targetSpec: null,
  orders: { styling: '', motivation: '', coaching: '' },
  styled: null,          // A의 출력 { look, personality, spec }
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

const TIPS = [
  '참고 · 요원이 쓰는 곳은 셋뿐이다. 스타일링 · 동기부여 · 코칭. 셋 다 채점되지 않는다.',
  '참고 · 스타일링은 고객 외모를, 동기부여는 고객 성격을 통째로 덮어쓴다.',
  '참고 · 코칭은 고객에게만 간다. 타겟도 심판도 그 문장을 못 본다.',
  '참고 · 심판이 내보내는 것은 증감 여부뿐이다 — 무드 ▲▼─, 러브 ▲▼─. 점수도 해설도 없다.',
  '참고 · 무드 포인트가 0이 되면 그 자리는 거기서 끝난다. 남은 구간은 돌지 않는다.',
  '참고 · 러브 포인트만이 성사 여부를 가른다. 무드는 자리가 유지되는지만 본다.',
  '참고 · 잘 굴러간 대화는 러브가 안 오른다. 회사원끼리도 할 수 있는 대화이기 때문이다.',
  '참고 · 스크리닝에 뜬 여덟 항목이 전부다. 감춰둔 항목은 없다.',
  '참고 · 타겟 취향은 요원 화면에만 떠 있다. 고객은 코칭으로 들은 것만 안다.',
  '참고 · 만날 장소는 텍스팅에서 정해진다. 코칭에 적으면 화산 분화구도 예약된다.',
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
  if (e instanceof RefusalError) return '연산 모형이 본 내용의 처리를 거부했다. 표현을 바꿔 재시도하라.';
  return `통신 사고 — ${e.message}`;
}

// 한 덩어리로 읽는 글(후일담)을 흘려 넣는다. 재생 속도 설정과 '눌러서 건너뛰기'가 똑같이 먹힌다.
async function typeText(el, text, cps = 60) {
  const mult = pace.paceMult();
  let n = 0;
  await pace.typeInto(el, text, () => { if (n++ % 6 === 0) sfx.type(); },
    { typeMs: mult > 0 ? (text.length / cps) * 1000 * mult : 0, mult });
}

// 스토리지 차단 환경에서도 죽지 않게
const sget = (store, k) => { try { return window[store].getItem(k); } catch { return null; } };
const sset = (store, k, v) => { try { v === null ? window[store].removeItem(k) : window[store].setItem(k, v); } catch { } };

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

// ── 부팅 ────────────────────────────────────────────────
// 업자 선택란은 없다. 키 접두사가 곧 업자고(llm.js의 detectProvider),
// 판별되는 순간 회선 표시와 모형 목록이 그 업자 것으로 갈린다.
const CUSTOM_MODEL = '__custom';
let bootProvider = null;

const modelKey = id => `cupid_model_${id}`;
function savedModelFor(id) {
  const mine = sget('localStorage', modelKey(id));
  if (mine) return mine;
  const legacy = sget('localStorage', 'cupid_model');
  return legacy && modelFitsProvider(legacy, id) ? legacy : null;
}

function fillModels(id) {
  const p = providerOf(id);
  const sel = $('#model-select');
  sel.innerHTML = p.models.map(([m, note]) => `<option value="${escapeHtml(m)}">${escapeHtml(m)} (${escapeHtml(note)})</option>`).join('')
    + (p.freeModel ? `<option value="${CUSTOM_MODEL}">직접 입력…</option>` : '');
  const want = savedModelFor(id) || defaultModelOf(id);
  if (p.models.some(([m]) => m === want)) {
    sel.value = want;
  } else if (p.freeModel) {
    sel.value = CUSTOM_MODEL;
    $('#model-custom').value = want;
  }
  syncCustomModel();
}

function renderProvider(key, { force = false } = {}) {
  const id = detectProvider(key);
  const badge = $('#key-provider');
  if (!id) {
    bootProvider = null;
    badge.textContent = key
      ? '판별 실패 — sk-ant- / sk- / sk-or- 로 시작하는 키가 아니다'
      : '회선 미지정 — 키를 붙여넣으면 발급 업자를 판별한다';
    badge.className = `key-provider ${key ? 'bad' : 'dim'}`;
    if (!$('#model-select').options.length) fillModels(DEFAULT_PROVIDER);
    return null;
  }
  const p = providerOf(id);
  badge.textContent = `회선 판별: ${p.label} — ${p.host} 로 직접 송신`;
  badge.className = 'key-provider ok';
  if (id === bootProvider && !force) return id;
  bootProvider = id;
  fillModels(id);
  return id;
}
function syncCustomModel() {
  $('#model-custom-row').classList.toggle('hidden', $('#model-select').value !== CUSTOM_MODEL);
}
function chosenModel() {
  const v = $('#model-select').value;
  return v === CUSTOM_MODEL ? $('#model-custom').value.trim() : v;
}

function initBoot() {
  const saved = sget('localStorage', 'cupid_key') || sget('sessionStorage', 'cupid_key');
  if (saved) $('#key-input').value = saved;
  $('#agent-name').value = sget('localStorage', 'cupid_agent_name') || '';
  renderProvider($('#key-input').value.trim());

  $('#key-input').addEventListener('input', e => renderProvider(e.target.value.trim()));
  $('#model-select').addEventListener('change', syncCustomModel);

  $('#btn-boot').addEventListener('click', async () => {
    unlockAudio(); sfx.click();
    const name = $('#agent-name').value.trim();
    if (!name) return bootError('요원명 없이는 서류를 못 만든다. 아무거나 적어라.');
    const key = $('#key-input').value.trim();
    const provider = renderProvider(key);
    if (!provider) return bootError('그건 API 키가 아니라 그냥 문자열이다. Anthropic(sk-ant-...) · OpenAI(sk-...) · OpenRouter(sk-or-v1-...) 중 하나를 내놔라.');
    const model = chosenModel();
    if (!model) return bootError('모형 id를 비워 두면 아무 데도 못 보낸다. 업자 문서에 적힌 id를 적어라.');

    state.agent = { name };
    sset('localStorage', 'cupid_agent_name', name);

    llm.apiKey = key;        // 업자는 이 한 줄에서 정해진다
    llm.model = model;
    sset('localStorage', modelKey(provider), model);
    sset('sessionStorage', 'cupid_key', key);
    sset('localStorage', 'cupid_key', $('#remember-key').checked ? key : null);
    try {
      await withLoading(`본부 회선 연결 중... (${providerOf(provider).label} 키 인증)`, () => llm.ping());
      startBgm();
      showIntro();
    } catch (e) {
      show('boot');
      bootError(errMsg(e));
    }
  });
  for (const sel of ['#key-input', '#agent-name', '#model-custom']) {
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
// 다섯 장. 구조도 한 칸씩이다. 삽화는 원·사각형·다각형만 붙여서 그린다.
const ART_VB = '0 0 340 128';
const aSvg = (label, body, dy = 0, dx = 0) =>
  `<svg class="art" viewBox="${ART_VB}" role="img" aria-label="${label}">`
  + `<g transform="translate(${dx} ${dy})">${body}</g></svg>`;
const aTorso = (x, y, c) => `<path class="${c}" d="M${x - 18} ${y + 20}L${x - 13} ${y - 5}h26L${x + 18} ${y + 20}Z"/>`;
const aPerson = (x, y, c) => `<circle class="${c}" cx="${x}" cy="${y - 22}" r="13"/>` + aTorso(x, y, c);
const aCap = (x, y, t, a = '') => `<text class="a-cap ${a}" x="${x}" y="${y}">${t}</text>`;
const aArrow = (x1, x2, y) =>
  `<path class="a-dash" d="M${x1} ${y}H${x2}"/>`
  + `<polygon class="a-soft" points="${x2},${y - 6} ${x2 + 13},${y} ${x2},${y + 6}"/>`;
const aTag = (x, y, w, t, cls = 'a-tag') =>
  `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="26"/>`
  + `<text class="a-tag-t" x="${x + w / 2}" y="${y + 18}">${t}</text>`;

const SLIDES = [
  {
    art: aSvg('요원이 서류 두 장을 고객에게 밀어 넣고, 고객이 타겟과 마주 앉은 그림',
      aPerson(38, 64, 'a-ink')
      + aTag(66, 26, 84, '스타일링', 'a-user') + aTag(66, 62, 84, '동기부여', 'a-user')
      + aArrow(158, 196, 52)
      + aPerson(232, 64, 'a-file')
      + '<path class="a-line" d="M262 44h16"/>'
      + aPerson(302, 64, 'a-stamp')
      + aCap(38, 106, '요원') + aCap(232, 106, '고객') + aCap(302, 106, '타겟'), 2, 4),
    line: '자네는 그 자리에 없다. 말은 <b>고객</b>이 한다. 자네가 하는 건 그 인간의 <b>시트를 고쳐 쓰는 것</b>뿐이다.',
  },
  {
    art: aSvg('여덟 칸짜리 서류 두 장이 나란히 펼쳐진 그림',
      '<rect class="a-paper" x="10" y="8" width="150" height="112"/>'
      + '<rect class="a-file" x="11" y="9" width="148" height="20"/>'
      + '<text class="a-hdr" x="85" y="24">타겟</text>'
      + ['외모', '성격', '성장환경', '취향'].map((t, i) => aCap(85, 48 + i * 18, t)).join('')
      + '<rect class="a-paper" x="180" y="8" width="150" height="112"/>'
      + '<rect class="a-file" x="181" y="9" width="148" height="20"/>'
      + '<text class="a-hdr" x="255" y="24">고객</text>'
      + ['외모', '성격', '성장환경', '반한 이유'].map((t, i) => aCap(255, 48 + i * 18, t)).join(''), 0),
    line: '스크리닝에서 <b>여덟 항목</b>이 전부 열린다. 미공개도, 함정도, 나중에 드러나는 것도 <b>없다</b>.',
  },
  {
    art: aSvg('사람 형상 위에 두 개의 문장이 덮어씌워지는 그림',
      aTag(8, 14, 108, '스타일링 내용', 'a-user') + aTag(8, 76, 108, '동기부여 내용', 'a-user')
      + aArrow(124, 158, 30) + aArrow(124, 158, 92)
      + '<circle class="a-box" cx="238" cy="60" r="52"/>'
      + '<rect class="a-cachebox" x="196" y="34" width="84" height="20" rx="3"/>'
      + '<text class="a-tag-t" x="238" y="48">고객 외모</text>'
      + '<rect class="a-cachebox" x="196" y="66" width="84" height="20" rx="3"/>'
      + '<text class="a-tag-t" x="238" y="80">고객 성격</text>'
      + aCap(238, 122, '덮어써진 시트'), 0, 4),
    line: '<b>A</b> — 자네가 쓴 두 문장이 고객의 <b>외모</b>와 <b>성격</b>을 통째로 덮어쓴다. 채점은 없다. 시트가 바뀔 뿐이다.',
  },
  {
    art: aSvg('대화 구간 넷과 그 옆에 오르내리는 두 개의 게이지',
      [0, 1, 2, 3].map(i => {
        const y = 8 + i * 28;
        return `<rect class="a-bub-c" x="8" y="${y}" width="96" height="20" rx="4"/>`
          + `<rect class="a-bub-t" x="112" y="${y}" width="72" height="20" rx="4"/>`;
      }).join('')
      + aArrow(194, 224, 60)
      + '<text class="a-key e" x="266" y="26">무드</text>'
      + '<rect class="a-track" x="236" y="34" width="96" height="18"/>'
      + '<rect class="a-stamp" x="238" y="36" width="52" height="14"/>'
      + '<text class="a-key e" x="266" y="80">러브</text>'
      + '<rect class="a-track" x="236" y="88" width="96" height="18"/>'
      + '<rect class="a-stamp" x="238" y="90" width="26" height="14"/>', 2),
    line: '<b>B</b> — 대화가 구간 단위로 굴러가고, 매 구간 심판은 <b>증감 여부만</b> 답한다. 점수도, 해설도 없다.',
  },
  {
    art: aSvg('러브 게이지 하나가 도장 하나로 이어지는 그림',
      '<text class="a-key e" x="42" y="34">러브</text>'
      + '<rect class="a-track" x="12" y="44" width="120" height="24"/>'
      + '<rect class="a-stamp" x="14" y="46" width="82" height="20"/>'
      + aArrow(146, 190, 56)
      + '<circle class="a-seal" cx="256" cy="56" r="32"/><circle class="a-seal" cx="256" cy="56" r="26"/>'
      + '<text class="a-seal-t big" x="256" y="64" transform="rotate(-12 256 56)">성사</text>'
      + aCap(256, 116, '후일담'), 0),
    line: '<b>C</b> — 성사 여부를 가르는 숫자는 <b>러브 포인트 하나</b>다. 무드는 자리가 유지되는지만 본다.',
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
  $('#btn-intro-next').textContent = slideIdx === SLIDES.length - 1 ? '스크리닝 개시 ▶' : '다음 ▶';
  $$('#intro-dots .dot').forEach((d, i) => d.classList.toggle('on', i === slideIdx));
}
function initIntro() {
  $('#btn-intro-next').addEventListener('click', () => {
    sfx.click();
    if (slideIdx < SLIDES.length - 1) { slideIdx++; renderSlide(); }
    else gotoRoster();
  });
  $('#btn-intro-prev').addEventListener('click', () => { sfx.click(); if (slideIdx > 0) { slideIdx--; renderSlide(); } });
  $('#btn-intro-skip').addEventListener('click', () => { sfx.click(); gotoRoster(); });
  document.addEventListener('keydown', e => {
    if (state.screen !== 'intro') return;
    if (e.key === 'ArrowRight' || e.key === 'Enter') $('#btn-intro-next').click();
    if (e.key === 'ArrowLeft') $('#btn-intro-prev').click();
  });
}

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
      <p class="cc-clash">${escapeHtml(c.client.fell.split('. ')[0])}.</p>
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
  state.styled = null;
  state.engine = null; state.result = null;
  gotoStyling();
}

// ── A. 스타일링 / 동기부여 ──────────────────────────────
let stylingViewer = null;
function gotoStyling() {
  show('styling');
  const c = state.couple;
  stylingViewer = getStageViewer('stage-styling');
  stylingViewer.setDuo(state.clientSpec, state.targetSpec, 'camera');

  $('#styling-title').innerHTML =
    `A · 스타일링 / 동기부여 <span class="diff-inline">${escapeHtml(c.client.name)} × ${escapeHtml(c.target.name)}</span>`;
  $('#styling-dossier').innerHTML = dossierHtml(c);
  $('#styling-input').value = state.orders.styling;
  $('#motivation-input').value = state.orders.motivation;
  renderStylingResult();

  $('#styling-input').oninput = e => { state.orders.styling = e.target.value; };
  $('#motivation-input').oninput = e => { state.orders.motivation = e.target.value; };
  $('#btn-styling').onclick = runStyling;
  $('#btn-styling-back').onclick = () => { sfx.click(); gotoRoster(); };
  $('#btn-styling-next').onclick = () => { sfx.click(); gotoCoaching(); };
}

function renderStylingResult() {
  const el = $('#styling-result');
  const c = state.couple;
  if (!state.styled) {
    el.innerHTML = `<span class="inject-empty">아직 시공하지 않았다 — 이대로 나가면 <b>테이블 값이 그대로 시트</b>가 된다<br>
      <span class="dim">외모: ${escapeHtml(list(c.client.look))}</span><br>
      <span class="dim">성격: ${escapeHtml(list(c.client.personality))}</span></span>`;
    return;
  }
  el.innerHTML =
    `<div class="sheet-out"><span class="sheet-tag cached">수정된 고객 외모</span>${escapeHtml(state.styled.look)}</div>` +
    `<div class="sheet-out"><span class="sheet-tag cached">수정된 고객 성격</span>${escapeHtml(state.styled.personality)}</div>` +
    `<p class="dim small">이 두 문단이 그대로 대화 프롬프트의 고객 시트가 된다. 캐시되어 판이 끝날 때까지 유지된다.</p>`;
}

async function runStyling() {
  sfx.click();
  const styling = $('#styling-input').value.trim();
  const motivation = $('#motivation-input').value.trim();
  if (!styling && !motivation) return toast('둘 중 하나는 적어라. 둘 다 비우면 시공할 게 없다.');
  state.orders.styling = styling;
  state.orders.motivation = motivation;
  try {
    const r = await withLoading('시공 중... (고객 외모 · 성격 갱신)', () => llm.call({
      label: 'A · 스타일링/동기부여', system: P.STYLING_SYSTEM,
      messages: [{ role: 'user', content: P.stylingUser(state.couple, state.clientSpec, state.orders) }],
      schema: P.STYLING_SCHEMA, effort: 'low', maxTokens: 6000,
    }));
    // 조형 보정 플래그는 스키마에 없다. 시공 후에도 유지해준다.
    state.clientSpec = sanitizeSpec({ ...r.spec, femme: state.couple.client.spec.femme });
    state.styled = { look: r.look, personality: r.personality, spec: state.clientSpec };
    stylingViewer.updateLeft(state.clientSpec);
    stylingViewer.burst('sparkle', 'left');
    renderStylingResult();
    sfx.stamp();
  } catch (e) { toast(errMsg(e)); }
}

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
        + `<code class="inject-code">[본부 코칭 — 고객의 귀에만 들어갔다]\n"""\n${escapeHtml(t)}\n"""</code>`
      : `<span class="inject-empty">코칭 없음 → 고객은 <b>아무 준비 없이</b> 제 시트대로만 움직인다</span>`;
  };
  $('#coaching-input').oninput = sync;
  sync();

  $('#btn-coaching-back').onclick = () => { sfx.click(); gotoStyling(); };
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

function setChatTitle(label) {
  $('#chat-phase-label').textContent = `B · ${label} 페이즈 — ${state.couple.client.name} × ${state.couple.target.name}`;
}

async function startOperation() {
  state.orders.coaching = $('#coaching-input').value.trim();

  const handlers = {
    line: addBubble,
    verdict: addVerdict,
    points: pointsUpdate,
    phase: async p => {
      setChatTitle(p.label);
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

  try {
    await engine.run();
  } catch (e) {
    toast(errMsg(e));
    await addBubble('sys', '(전파 방해로 공작이 중단되었다...)');
    engine.aborted = true;
  }
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
  initBoot();
  initIntro();
  initPacing();
  $('#btn-restart').addEventListener('click', () => { sfx.click(); gotoRoster(); });
  $('#btn-retry').addEventListener('click', () => { sfx.click(); chooseCouple(state.couple); });
  const toggleConsole = () => $('#console-panel').classList.toggle('hidden');
  $('#console-toggle').addEventListener('click', toggleConsole);
  $('#btn-console').addEventListener('click', toggleConsole);
  $('#btn-bgm').addEventListener('click', () => { $('#btn-bgm').textContent = toggleBgm() ? '음향 ON' : '음향 OFF'; });
  document.addEventListener('click', () => unlockAudio(), { once: true });
}
init();
