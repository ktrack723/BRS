// game.js — 화면/입력 계층. 대화 오케스트레이션은 engine.js, 규칙은 scoring.js, API는 llm.js.
import { LlmClient, RefusalError, detectProvider, providerOf, defaultModelOf, modelFitsProvider, normalizeUsage, DEFAULT_PROVIDER } from './llm.js';
import * as P from './prompts.js';
import { Engine, prepReaction } from './engine.js';
import { DIFFICULTIES, diffOf } from './scoring.js';
import { COUPLES, keyReport, KEY_LABELS, WRECK_LABELS, dossierPrefs } from './couples.js';
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
  '참고 · 판정은 티키타카 한 번이 아니라 합 단위다. 서로 대여섯 마디가 오가야 심판이 움직인다.',
  '참고 · 무전은 흐름에 끼어드는 유일한 손잡이다. 아끼면 그냥 소멸한다.',
  '참고 · 착장은 대면 첫 순간에 상대가 직접 보고 판정한다.',
  '참고 · 지침에 "무엇을 하지 마라"와 "무엇을 하라"를 같이 써라.',
  '참고 · 금지만 적으면 지뢰만 꺼지는 게 아니다. 그 사람이 매력적이던 이유도 같이 꺼진다.',
  '참고 · 회사원끼리도 할 수 있는 대화는 0점이다. 상대라서 생기는 순간만 점수가 된다.',
  '참고 · 공기 옆 배지가 "전달 안 됨"이면 그 문장은 의뢰인에게 안 간다. 무전으로 직접 말해라.',
  '참고 · 가위손 박은 거절하지 않는다. 폭탄을 붙이라면 붙인다.',
  '참고 · 의뢰서에는 의뢰인의 성향이 미공개분까지 전부 적혀 있다. 고르기 전에 읽어라.',
  '참고 · 요원 화면에 떴다고 의뢰인이 아는 게 아니다. 지뢰 목록도 마찬가지다.',
  '참고 · 만날 장소는 문자에서 정해진다. 지침에 적으면 화산 분화구도 예약된다.',
  '참고 · 장소가 사람을 죽이지는 않는다. 대화를 망칠 뿐이다.',
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
  // 사용량 필드 이름은 업자마다 다르다. llm.js가 눕혀 준 형태로 읽는다.
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
let bootProvider = null;   // 지금 화면에 그려져 있는 업자 (null = 미판별)

// 그 업자에서 마지막으로 고른 모형. 키를 바꿔 껴도 서로 덮어쓰지 않게 업자별로 따로 둔다.
const modelKey = id => `cupid_model_${id}`;
function savedModelFor(id) {
  const mine = sget('localStorage', modelKey(id));
  if (mine) return mine;
  const legacy = sget('localStorage', 'cupid_model');   // 업자가 하나뿐이던 시절의 저장값
  return legacy && modelFitsProvider(legacy, id) ? legacy : null;
}

// 그 업자의 모형 목록으로 드롭다운을 다시 세운다. 목록에 없는 모형을 쓰던 중이면 '직접 입력'으로 살려 둔다.
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

// 키에서 업자를 읽어 회선 표시와 모형 목록을 맞춘다. 같은 업자면 목록은 손대지 않는다.
function renderProvider(key, { force = false } = {}) {
  const id = detectProvider(key);
  const badge = $('#key-provider');
  if (!id) {
    bootProvider = null;
    badge.textContent = key
      ? '판별 실패 — sk-ant- / sk- / sk-or- 로 시작하는 키가 아니다'
      : '회선 미지정 — 키를 붙여넣으면 발급 업자를 판별한다';
    badge.className = `key-provider ${key ? 'bad' : 'dim'}`;
    // 아직 키가 없는 첫 방문에 빈 드롭다운을 보여주지 않는다. 판별되면 그때 갈린다.
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
// 실제로 쓸 모형 id — 드롭다운 값, 단 '직접 입력'이면 옆 칸의 문자열.
function chosenModel() {
  const v = $('#model-select').value;
  return v === CUSTOM_MODEL ? $('#model-custom').value.trim() : v;
}

function initBoot() {
  const saved = sget('localStorage', 'cupid_key') || sget('sessionStorage', 'cupid_key');
  if (saved) $('#key-input').value = saved;
  $('#agent-name').value = sget('localStorage', 'cupid_agent_name') || '';
  $('#agent-gender').value = sget('localStorage', 'cupid_agent_gender') || '';
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

    state.agent = { name, gender: $('#agent-gender').value.trim() };
    sset('localStorage', 'cupid_agent_name', state.agent.name);
    sset('localStorage', 'cupid_agent_gender', state.agent.gender || null);

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
  for (const sel of ['#key-input', '#agent-name', '#agent-gender', '#model-custom']) {
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
// 여섯 장. 한 장은 삽화 한 컷과 문장 한 줄이 전부다.
// 전부 큐피드국 교관이 신입 요원에게 하는 말이다.
// 개정 이력("예전엔 이랬다")이나 내부 구현 용어는 여기 들어오지 않는다 — 요원이 알 바 아니다.
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

const SLIDES = [
  {
    art: aSvg('요원이 무전으로 의뢰인을 조종하고, 의뢰인이 상대와 마주 선 그림',
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
      + aCap(42, 104, '요원') + aCap(150, 104, '의뢰인') + aCap(286, 104, '상대'), 6, 10),
    line: '자네는 그 자리에 없다. 말은 <b>의뢰인</b>이 하고, 자네는 뒤에서 꾸미고 겁주고 등을 떠민다.',
  },
  {
    art: aSvg('둥근 머리와 각진 머리가 붉은 균열을 사이에 두고 마주 섰고, 아래에 결승선 하나가 놓인 그림',
      aPerson(72, 44, 'a-file')
      + aBlockPerson(268, 44, 'a-stamp')
      + '<polyline class="a-crack" points="170,6 160,22 172,38 160,54 170,70"/>'
      + aCap(150, 101, '결승선', 'e')
      + '<rect class="a-tag" x="162" y="84" width="58" height="24"/>'
      + '<text class="a-tag-t" x="191" y="101">연인</text>', 8),
    line: `<b>상설 의뢰 ${COUPLES.length}건</b>은 전부 이어질 리 없는 조합이고, 결승선은 전부 같다 — 저 둘이 <b>연인</b>이 되는 것.`,
  },
  {
    art: aSvg('미용실·취조실·정문 세 곳에 0점 도장이 찍히고, 거기서 나온 문장이 의뢰인의 머릿속으로 들어가는 그림',
      ['미용실', '취조실', '정문'].map((t, i) =>
        `<rect class="a-tag" x="8" y="${8 + 40 * i}" width="84" height="30"/>`
        + `<text class="a-tag-t" x="50" y="${28 + 40 * i}">${t}</text>`).join('')
      + '<path class="a-line" d="M96 8h8v110h-8"/>'
      + '<circle class="a-seal" cx="128" cy="63" r="19"/>'
      + '<text class="a-seal-t" x="128" y="69" transform="rotate(-14 128 63)">0점</text>'
      + aArrow(154, 192, 63)
      + '<circle class="a-box" cx="264" cy="63" r="44"/>'
      + '<rect class="a-soft" x="240" y="44" width="48" height="7" rx="3.5"/>'
      + '<rect class="a-soft" x="236" y="59" width="56" height="7" rx="3.5"/>'
      + '<rect class="a-soft" x="244" y="74" width="40" height="7" rx="3.5"/>'
      + aCap(264, 118, '그 인간 머릿속'), 0, 8),
    line: '준비는 <b>미용실·취조실·정문</b> 세 곳에서 하지만 어느 곳도 <b>채점하지 않는다</b> — 자네가 쓴 문장은 그대로 그 인간 머릿속에 들어갈 뿐이다.',
  },
  {
    art: aSvg('반듯한 말풍선과 아무렇게나 흘러간 말풍선이 나란히 놓이고 그 옆에 판정 도장이 찍힌 그림',
      '<path class="a-bub-c" d="M16 6h120a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H52L34 58V44H16a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4Z"/>'
      + '<rect class="a-soft" x="24" y="17" width="100" height="7" rx="3.5"/>'
      + '<rect class="a-soft" x="24" y="29" width="70" height="7" rx="3.5"/>'
      + '<path class="a-bub-t" d="M48 62h114a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4h-22l-18 14V98H48a4 4 0 0 1-4-4V66a4 4 0 0 1 4-4Z"/>'
      + '<polyline class="a-scribble" points="58,88 74,74 86,94 102,72 118,92 134,76 152,88"/>'
      + aArrow(180, 214, 58)
      + '<circle class="a-seal" cx="284" cy="58" r="30"/><circle class="a-seal" cx="284" cy="58" r="24"/>'
      + '<text class="a-seal-t big" x="284" y="66" transform="rotate(-12 284 58)">판정</text>', 5),
    line: '저 둘의 <b>대화에는 규칙이 없다</b>. 아무 데로나 흘러가고, 무슨 일이 벌어지든 심판은 진지한 얼굴로 채점한다.',
  },
  {
    // 턴 여섯 칸 중 넷은 0점 도장, 둘만 하트. 오른 호감은 전부 그 둘이 민 것이다.
    art: aSvg('턴 여섯 칸 중 넷에 0점이 찍히고 두 칸에만 하트가 얹혀 호감 막대를 미는 그림',
      [0, 1, 2, 3, 4, 5].map((i) => {
        const x = 14 + i * 52;
        const heart = i === 2 || i === 4;
        return `<rect class="a-track" x="${x}" y="10" width="40" height="40" rx="4"/>`
          + (heart
            ? `<g class="a-stamp"><rect x="${x + 12}" y="${20}" width="13" height="13" transform="rotate(45 ${x + 18.5} 26.5)"/>`
              + `<circle cx="${x + 13.6}" cy="${21.6}" r="6.5"/><circle cx="${x + 23.4}" cy="${21.6}" r="6.5"/></g>`
            : `<text class="a-seal-t" x="${x + 20}" y="${37}">0</text>`);
      }).join('')
      + '<text class="a-key e" x="34" y="88">호감</text>'
      + '<rect class="a-track" x="60" y="70" width="248" height="24"/>'
      + '<rect class="a-stamp" x="62" y="72" width="86" height="20"/>'
      + aCap(150, 116, '오른 건 전부 두 칸이 민 것이다'), 4),
    line: '대화가 잘 굴러가는 것에는 <b>한 점도</b> 주지 않는다. 호감은 <b>실제로 두근거린 턴</b>에서만 오르고, 나머지는 전부 <b>0점</b>이다.',
  },
  {
    art: aSvg('심리 감정과 지뢰와 현안이 적힌 의뢰서에서 의뢰인 쪽으로 가는 길이 붉은 가위표로 막힌 그림',
      '<rect class="a-paper" x="10" y="10" width="100" height="94"/>'
      + '<rect class="a-file" x="11" y="11" width="98" height="22"/>'
      + '<text class="a-hdr" x="60" y="27">의뢰서</text>'
      + aCap(60, 54, '심리 감정') + aCap(60, 74, '지뢰') + aCap(60, 94, '현안')
      + aArrow(122, 176, 52)
      + '<path class="a-block" d="M140 40l20 24M160 40l-20 24"/>'
      + '<circle class="a-box" cx="262" cy="52" r="36"/>'
      + '<text class="a-q" x="262" y="66">?</text>'
      + aCap(60, 120, '자네 화면') + aCap(262, 120, '의뢰인'), 0),
    line: '상대의 지뢰도 둘 사이의 현안도 <b>의뢰인에게는 넘어가지 않는다</b> — <b>의뢰서</b>의 「심리 감정」을 읽고 자네가 직접 불러줘야 한다.',
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
      <p class="cc-clash">${escapeHtml(c.relation.split('. ')[0])}</p>
      <ul class="cc-meta">
        <li>성공선 <b>${d.threshold}</b></li>
        <li>미공개 성향 <b>${dossierPrefs(c).hiddenCount}</b></li>
        <li>지뢰 <b>${dossierPrefs(c).neg.length}</b></li>
      </ul>
      <div class="cc-flaws" title="의뢰인 특별 키워드">${keyReport(c.client)
        .map(r => `<span class="flaw-tag lv-${r.level}">${escapeHtml(r.tag)}</span>`).join('')}<span
        class="flaw-tag wreck" title="어긋남">${escapeHtml(WRECK_LABELS[c.client.keys.wreck.kind].tag)}</span></div>
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
  const dp = dossierPrefs(c);
  return `
    <div class="stamp">극비</div>
    <h3>${escapeHtml(c.client.name)} <small>(${escapeHtml(P.idOf(c.client))})</small></h3>
    <p><b>외모:</b> ${c.client.look.map(escapeHtml).join(', ')}</p>
    <p><b>성격:</b> ${c.client.personality.map(escapeHtml).join(', ')}</p>
    <p><b>내력:</b> ${c.client.history.slice(1).map(escapeHtml).join(' · ')}</p>
    ${sheetHtml(c.client, { mine: true })}
    <hr>
    <h3>상대 · ${escapeHtml(c.target.name)} <small>(${escapeHtml(P.idOf(c.target))})</small></h3>
    <p><b>외모:</b> ${c.target.look.map(escapeHtml).join(', ')}</p>
    <p><b>성격:</b> ${c.target.personality.map(escapeHtml).join(', ')}</p>
    <p><b>내력:</b> ${c.target.history.slice(1).map(escapeHtml).join(' · ')}</p>
    <p><b>공개 성향:</b> ${dp.open.map(escapeHtml).join(' / ')}</p>
    <p class="redline-box"><b>지뢰 (닿으면 식는다):</b> ${dp.neg.map(escapeHtml).join(' / ')}
      <br><span class="handoff-warn">이 목록은 <b>의뢰인에게 자동으로 전달되지 않는다.</b> 취조실에서 직접 불러주지 않으면 모르는 채로 나간다.</span></p>
    <p class="unknown-prefs"><b>미공개 성향 ${dp.hiddenCount}건</b> — 내용 비공개. 대화가 거기까지 흘러가야만 나온다</p>
    <p class="unknown-prefs"><b>상대 특별 키워드:</b> 감정 미실시 — 상대는 우리 국민이 아니다. 뭘 못 읽고 뭘 의심하는지는 대화로만 드러난다</p>
    <hr>
    <p class="clash-line"><b>■ 둘 사이</b> ${escapeHtml(c.relation)}</p>
    <div class="diff-box diff-${d.key}">
      <span class="diff-name">난이도 ${escapeHtml(c.difficulty)}</span>
      <span class="diff-detail">성공선 호감 ${d.threshold} · 무전 ${d.radioText}+${d.radioTalk}회 · 총 ${d.textTurns + d.talkTurns}교환</span>
    </div>
    ${full ? `<div class="modal-btns"><button class="btn95 big" id="dossier-take">이 조합을 맡는다</button><button class="btn95" id="dossier-close">닫기</button></div>` : ''}`;
}

// 인물 시트. mine이면 성향을 **전부** 보여준다 — 의뢰인의 미공개 성향까지 요원에게는 공개다.
// 이걸 숨겨두면 지침이 왜 씹히는지, 공기를 왜 못 읽는지 플레이어가 영영 알 수 없다.
function sheetHtml(person, { mine = false } = {}) {
  const rows = keyReport(person);
  const wreck = WRECK_LABELS[person.keys.wreck.kind];
  const open = person.prefs.filter(x => x.open && !x.neg);
  const hidden = person.prefs.filter(x => !x.open);
  const neg = person.prefs.filter(x => x.open && x.neg);
  return `<div class="flaw-box">
    <h4>특별 키워드 <span class="dim">— 전부 실제로 작동한다</span></h4>
    <ul class="flaw-list">
      ${rows.map(r => `<li class="lv-${r.level}"><span class="flaw-axis">${escapeHtml(r.axis)}</span>
        <span class="flaw-tag lv-${r.level}">${escapeHtml(r.tag)}</span>
        <span class="flaw-desc">${escapeHtml(r.desc)}</span></li>`).join('')}
      <li class="lv-high"><span class="flaw-axis">어긋남</span>
        <span class="flaw-tag wreck">${escapeHtml(wreck.tag)}</span>
        <span class="flaw-desc">${escapeHtml(person.keys.wreck.line)}<br>
          <span class="dim">${escapeHtml(wreck.desc)}</span></span></li>
    </ul>
    <h4>성향 <span class="dim">${mine ? '— 미공개분 포함 전부. 요원에게는 숨기는 게 없다' : ''}</span></h4>
    <ul class="flaw-list">
      ${open.map(x => `<li class="lv-ok"><span class="flaw-tag lv-ok">공개</span>
        <span class="flaw-desc">${escapeHtml(x.t)}</span></li>`).join('')}
      ${mine ? hidden.map(x => `<li class="lv-mid"><span class="flaw-tag lv-mid">미공개</span>
        <span class="flaw-desc">${escapeHtml(x.t)}</span></li>`).join('') : ''}
      ${neg.map(x => `<li class="lv-bad"><span class="flaw-tag lv-bad">지뢰</span>
        <span class="flaw-desc">${escapeHtml(x.t)}</span></li>`).join('')}
    </ul>
  </div>`;
}

// 취조실·정문에서 곁눈질할 상대 요약.
function targetBriefHtml(c) {
  const k = c.client.keys;
  const dp = dossierPrefs(c);
  const comply = KEY_LABELS.comply[k.comply];
  const knows = k.interest === 'self'
    ? '겉모습뿐. <b>성격도 성향도 모른다.</b>'
    : k.interest === 'mixed'
      ? '겉모습과 성격. <b>뭘 좋아하는지는 모른다.</b>'
      : '겉모습·성격·공개 성향과 지뢰까지.';
  return `<h3>상대 · ${escapeHtml(c.target.name)} <small>(${escapeHtml(P.idOf(c.target))})</small></h3>
    <p><b>성격:</b> ${c.target.personality.map(escapeHtml).join(', ')}</p>
    <p><b>공개 성향:</b> ${dp.open.map(escapeHtml).join(' / ')}</p>
    <p class="redline-box"><b>지뢰:</b> ${dp.neg.map(escapeHtml).join(' / ')}</p>
    <p class="handoff-warn"><b>이 화면의 정보는 의뢰인에게 자동으로 넘어가지 않는다.</b>
      의뢰인이 아는 것: ${knows} 나머지는 <b>지침에 직접 적어야</b> 그 인간 머릿속에 들어간다.</p>
    <p class="weakness"><b>의뢰인 어긋남 (${escapeHtml(WRECK_LABELS[k.wreck.kind].tag)}):</b> ${escapeHtml(k.wreck.line)}</p>
    ${comply ? `<p class="brief-flaw"><b>의뢰인 지침 수용:</b>
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
    // 가위손 박은 조형 보정 플래그를 모른다(스키마에 없다). 시공 후에도 유지해준다.
    state.clientSpec = sanitizeSpec({ ...r.spec, femme: state.couple.client.spec.femme });
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
  renderPrepReact('coaching');

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
  renderPrepReact('speech');

  $('#btn-speech').onclick = () => runPrepReact('speech', '정문 반응 대기 중...', gateViewer);
  $('#btn-gate-back').onclick = () => { sfx.click(); gotoInterro(); };
  $('#btn-start-op').onclick = () => { sfx.radio(); startOperation(); };
}

function renderPrepReact(scene) {
  const r = state.prepReact[scene];
  const el = $(scene === 'coaching' ? '#coaching-result' : '#speech-result');
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
    renderPrepReact(scene);
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
  $('#meter-love-fill').style.width = s.love + '%';
  $('#meter-love-num').textContent = s.love;
  $('#meter-threshold').style.left = s.threshold + '%';
  // 후반에 같은 판정인데 호감이 덜 오르는 이유. 화면에 있어야 한다.
  $('#hud-sat').textContent = `호감 포화 ×${s.loveSat}`;
  $('#hud-sat').className = 'hud-chip ' + (s.loveSat >= 0.8 ? '' : s.loveSat >= 0.5 ? 'warn' : 'bad');
  $('#hud-sat').title = `이미 호감 ${s.love}. 여기서부터는 같은 판정이라도 ${Math.round(s.loveSat * 100)}%만 오른다.`;
  $('#hud-turns').textContent = `남은 교환 ${s.turnsLeft}/${s.turnsTotal}`;
  const left = s.turnsTotal ? s.turnsLeft / s.turnsTotal : 1;
  $('#hud-turns').className = 'hud-chip ' + (left <= 0.25 ? 'bad' : left <= 0.5 ? 'warn' : '');
  // 판정은 합 단위로 온다. 지금 몇 교환이 다음 합에 쌓여 있는지 보여준다.
  const hb = $('#hud-bout');
  if (hb) hb.textContent = `${s.bouts}합 판정 · 다음 합 ${s.pendingExchanges}/5교환`;
  $('#btn-intervene').textContent = `무전 개입 (잔여 ${s.radioLeft})`;
  $('#btn-intervene').disabled = s.radioLeft <= 0;
  markVibeReach(s.air);

  const t = state.couple.target;
  const dp = dossierPrefs(state.couple);
  $('#intel-count').textContent = `대화 중 ${s.revealedCount}건 · 미확인 ${s.secretLeft}건 남음`;
  $('#intel-list').innerHTML =
    dp.open.map(p => `<li class="known">${escapeHtml(p)} <span class="dim">(사전 통보)</span></li>`).join('') +
    s.revealed.map(p => `<li class="found">${escapeHtml(p)}</li>`).join('') +
    (s.revealedCount === 0 ? '<li class="unknown">아직 새로 드러난 것 없음</li>' : '') +
    (s.secretLeft > 0 ? `<li class="unknown">감춰둔 성향 ${s.secretLeft}건 미확인 — 대화가 거기까지 흘러가야 나온다</li>` : '');
  $('#redline-list').innerHTML = dp.neg.map(p => `<li class="mine">${escapeHtml(p)}</li>`).join('');
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
    j.firstImpression ? '<span class="tag first">대면 첫인상</span>' : (j.bout ? `<span class="tag first">${j.bout}합</span>` : ''),
    `<span class="tag calc">원판정 ${j.rawLove >= 0 ? '+' : ''}${j.rawLove}</span>`,
  ].join('');
  div.className = `judge-line ${fx.cls}`;
  div.innerHTML = `<b>호감 ${j.love >= 0 ? '+' : ''}${j.love}</b> ${escapeHtml(j.reason)}${tags}`;
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
  const why = r.verdict.reason;
  stamp.textContent = why === 'coerced' ? '강압 성사'
    : r.verdict.accepted ? c.winWord
        : why === 'death' ? '요원 과실 사망'
          : r.aborted ? '작전 파탄' : '고백 반려';
  stamp.className = `result-stamp ${r.verdict.accepted ? 'ok' : 'fail'}`;
  $('#result-grade').textContent = `공작 등급: ${r.verdict.grade}`;
  $('#result-score').textContent =
    `호감 ${r.verdict.love}/${r.difficulty.threshold} · 난이도 ${r.difficulty.badge}`;

  $('#debrief-summary').textContent = r.debrief.summary;
  $('#debrief-list').innerHTML = r.debrief.notes.map(n =>
    `<li class="${n.ok ? 'ok' : 'weak'}"><b>${escapeHtml(n.label)}</b> <span class="dscore">${escapeHtml(n.value)}</span><br><span class="dim">${escapeHtml(n.text)}</span></li>`).join('');
  $('#debrief-prefs').innerHTML =
    dossierPrefs(c).open.map(p => `<li class="known">${escapeHtml(p)} <span class="dim">(사전 통보)</span></li>`).join('') +
    r.debrief.surfaced.map(p => `<li class="found">${escapeHtml(p)} <span class="dim">(대화에서 화제에 올랐다)</span></li>`).join('') +
    r.debrief.missed.map(p => `<li class="missed">${escapeHtml(p)} <span class="dim">(끝내 안 나왔다)</span></li>`).join('');
  // 상대 쪽 심리 감정은 작전 중엔 못 본다. 끝났으니 이제 깐다 —
  // 왜 그 지침이 안 먹혔는지 알아야 재착수가 의미를 가진다.
  $('#debrief-flaw').innerHTML = `
    <h4>상대는 이런 사람이었다 <span class="dim small">(작전 중 비공개였던 항목 포함)</span></h4>
    ${sheetHtml(c.target, { mine: true })}
    <p class="dim">의뢰인 쪽 시트는 의뢰서에 처음부터 전부 나와 있었다. 재착수 전에 다시 읽어라.</p>`;

  $('#debrief-turns').innerHTML =
    '<div class="turn-table-wrap"><table class="turn-table"><tr><th>합</th><th>호감</th><th>누적</th><th>해설</th></tr>' +
    r.state.history.map(h =>
      `<tr class="${h.dLove > 0 ? 'good' : h.dLove < 0 ? 'bad' : ''}">` +
      `<td>${h.bout}${h.firstImpression ? '·착장' : `·${h.exchanges}교환`}${h.revealed ? '·발견' : ''}` +
      `${h.leverage && h.leverage !== 'none' ? `<b class="tt-lev">·압박</b>` : ''}` +
      `${h.walkout ? '<b class="tt-lev">·이탈</b>' : ''}</td>` +
      `<td>${h.dLove >= 0 ? '+' : ''}${h.dLove} <span class="dim">[${escapeHtml(h.tier)}] ${h.rawLove >= 0 ? '+' : ''}${h.rawLove}</span></td>` +
      `<td>${h.love}</td>` +
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
    const reach = VIBE_REACH[snap.air] || VIBE_REACH.well;
    const k = state.couple.client.keys;
    const comply = KEY_LABELS.comply[k.comply] || KEY_LABELS.comply.obeys;
    const wreck = WRECK_LABELS[k.wreck.kind];
    $('#radio-context').innerHTML =
      `<div class="radio-stat">` +
      `<span class="hud-chip">남은 턴 ${snap.turnsLeft}/${snap.turnsTotal}</span>` +
      `<span class="hud-chip">잔여 무전 ${snap.radioLeft}</span>` +
      `<span class="hud-chip">호감 ${snap.love}/${snap.threshold}</span>` +
      `</div>` +
      `<b>지금 공기:</b> ${escapeHtml(e.state.vibe || '(아직 아무 일도 없다)')} ` +
      `<span class="reach-chip ${reach.cls}">의뢰인에게 ${escapeHtml(reach.tag)}</span><br>` +
      `<span class="dim">${escapeHtml(reach.note)}.</span><br>` +
      `<span class="dim"><b>이 명령은 ${escapeHtml(comply.tag)}:</b> ${escapeHtml(comply.desc)}</span><br>` +
      // 단답 인물에게 "길게 설득해"를 시키는 건 지침이 아니라 헛수고다. 그 자리에서 보여야 한다.
      `<span class="dim"><b>의뢰인 어긋남 — ${escapeHtml(wreck.tag)}:</b> ${escapeHtml(wreck.desc)}</span><br>` +
      `<span class="dim">저 둘은 각자 원하는 게 따로 있다. 흐름을 바꾸고 싶으면 여기서 바꿔야 한다.</span><br>` +
      `<span class="dim">상대 지뢰: ${dossierPrefs(state.couple).neg.map(escapeHtml).join(' / ')} — 의뢰인은 지침으로 들은 것만 안다.</span><br>` +
      `<span class="radio-barrier"><b>둘 사이:</b> ${escapeHtml(state.couple.relation)}</span>`;
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
  $('#meter-love-name').textContent = P.ENDING.meterName;   // 게이지 이름의 원본은 prompts.js다
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
