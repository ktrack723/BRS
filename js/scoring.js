// scoring.js — 게임 규칙의 순수 함수 계층. LLM 없이 단독 테스트/시뮬레이션이 가능하다.
//
// 설계 원칙
//   · 게이지는 딱 둘이다 — 💗 호감(승리 조건) / 😊 분위기(호감 획득 배율).
//   · 채점은 오직 하나, "실제 문자·대면에서 클라이언트가 뱉은 발언"뿐이다.
//   · 스타일링 / 대화 지침 / 연설 / 무전은 채점 대상이 아니다. 전부 프롬프트 주입일 뿐이며,
//     그 효과는 클라이언트가 실제로 어떻게 말하느냐로만 드러난다.
//
// ── 왜 '취향 적중' 계층을 통째로 걷어냈는가 ──────────────────────
// 예전 규칙에는 목록 대조 계층이 있었다. 심판이 뱉은 취향 문자열을 커플 데이터의
// hiddenPrefs/visiblePrefs와 대조해서, 맞으면 구조적 보너스(+6)를 주고 아니면 등급을 ok로 눌렀다.
// 이건 실제로 작동했다. 다만 작동한 방식이 문제였다 — 두 에이전트가 대화를 하는 대신
// "목록에 있는 단어를 대화에 등장시키는 게임"을 하기 시작했다.
// 타겟은 매 턴 실마리를 흘려야 했고, 클라이언트는 그걸 물어야 했다. 사람은 그렇게 말하지 않는다.
//
// 그래서 목록 대조를 전부 없앴다. 남은 규칙은 하나다:
//   **상대가 실제로 어떻게 반응했는가.**
// 등급 이름도 그 축으로 갈아끼웠다. breakthrough/warm/nudge/flat/chill/disaster는
// "무엇을 맞췄는가"가 아니라 "상대가 얼마나 움직였는가"의 눈금이다.
// 목록에 없는 이유로 상대가 무너져도 똑같이 유효하다. 그게 이 개편의 전부다.

// ── 밸런싱 근거 ──────────────────────────────────────────────────
// 이전 성공선(45/52/54)은 라이브 20판 실측에서 뽑은 값이었다. 그 판들은 구(舊) 판정기,
// 즉 '취향 적중 보너스 +6 × 3건'이라는 구조적 가점이 살아 있던 시절의 데이터다.
// 지금은 그 가점이 없고, 대신 등급 밴드가 전 구간 후해졌다(게이트가 없으니 ok 상한이 사라졌다).
// 두 변화가 상쇄되지 않으므로 실측값을 그대로 쓸 수 없다.
//
// 그래서 실제 API로 다시 쟀다 (Sonnet, 커플 3종 × 프로필 4종 = 12판, 판정 120건).
// 그 실측 분포로 몬테카를로(판당 3,000회 표본)를 돌려 아래 값을 뽑았다.
//
// ── 인물 하자 시스템 투입 후 재계측 ─────────────────────────────
// 그 전까지는 준비 품질이 결과를 거의 못 갈랐다(ace↔none 24~31%p). 두 에이전트가
// 준비와 무관하게 상대를 잘 맞춰줬기 때문이다. couples.js의 하자 시스템으로 그걸 끊었다:
// 공기를 못 읽는 인물에게는 vibe를 안 주고, 관심 없는 인물에게는 상대 정보를 안 준다.
//
//   실측 등급 분포: breakthrough 10% · warm 38% · nudge 43% · flat 2% · chill 7% · disaster 0%
//   프로필별 chill 비율: ace 0% · good 3% · lazy 7% · none 17%   ← 여기서 갈린다
//
//              ace      good     lazy     none      (성사율 / 호감 중앙값)
//   쉬움 54   97%/68   84%/62   78%/62   38%/50
//   보통 56   63%/58   34%/52   37%/52    9%/39
//   헬   60   43%/58   17%/50   24%/51    4%/37
//
// ace↔none 격차가 39~59%p로 벌어졌다. 준비 없는 의뢰인은 상대의 지뢰를 모르고,
// 공기도 못 읽고, 상대에게 관심도 없어서 자기 관심사로 대화를 끌고 가다 상대를 식힌다.
//
// ⚠ 남은 한계: good과 lazy는 여전히 잘 안 갈린다(표본 30건 기준 오차 범위).
//    breakthrough 쪽으로는 준비가 거의 작용하지 않는다 — 갈리는 건 chill 꼬리뿐이다.
//
//    재계측: ANTHROPIC_API_KEY=... node tests/live.mjs → node tests/sim.mjs <결과> --grid
export const DIFFICULTIES = {
  '쉬움': {
    key: 'easy', badge: '쉬움',
    textTurns: 4, talkTurns: 5,
    radioText: 1, radioTalk: 2,   // 기획서 규정: 문자 1회, 대면 2회
    startLove: 10, startMood: 55,
    threshold: 54, moodFloor: 25,
    loveDecay: 0.0,   // 턴마다 식는 호감
    moodDrift: 0.5,   // 턴마다 흐르는 분위기 (양수면 알아서 풀린다)
    gainScale: 1.7, lossScale: 0.85,
  },
  '보통': {
    key: 'normal', badge: '보통',
    textTurns: 4, talkTurns: 5,
    radioText: 1, radioTalk: 2,
    startLove: 6, startMood: 46,
    threshold: 56, moodFloor: 33,
    loveDecay: 0.3,
    moodDrift: -0.1,
    gainScale: 1.7, lossScale: 1.0,
  },
  '헬': {
    key: 'hell', badge: '헬',
    textTurns: 4, talkTurns: 5,
    radioText: 1, radioTalk: 2,
    startLove: 3, startMood: 38,
    threshold: 60, moodFloor: 40,
    loveDecay: 0.6,
    moodDrift: -0.7,
    gainScale: 2.1, lossScale: 1.15,
  },
};

// ── 자리가 길어지는 조건 ───────────────────────────────────────
// 대화가 잘 풀리면 사람은 안 일어난다. 케미가 뜨거우면 예정된 턴을 넘겨 더 앉아 있는다.
// 판정 등급이 곧 케미 계측기다 — 따로 지표를 만들지 않는다.
// 호감에는 포화가 걸려 있으므로 연장 턴의 한계 이득은 앞턴보다 작다. 그래서 상한만 막아두면 된다.
export const EXTENSION = {
  maxExtra: { text: 2, talk: 3 },   // 페이즈별 최대 연장 턴
  window: 3,                        // 최근 몇 턴을 보는가
  minSeen: 2,                       // 최소 이만큼은 채점돼 있어야 판단한다
  hotTiers: ['breakthrough', 'warm'],
  needHot: 2,                       // 그 중 몇 턴이 뜨거워야 하는가
  // 절대값이 아니라 '시작보다 얼마나 끌어올렸나'로 잰다.
  // 절대 하한을 쓰면 쉬움(시작 55)은 시작하자마자 조건을 만족하고,
  // 헬(시작 38, 매 턴 -0.7)은 아무리 잘해도 도달을 못 해 연장이 사문화된다.
  moodGain: 12,
};
// 판정은 한 턴 늦게 온다. 그래서 4턴짜리 문자 페이즈는 마지막 턴에서도 기록이 2개뿐이다 —
// window를 그대로 하한으로 쓰면 문자 페이즈는 영영 안 늘어난다. 하한은 minSeen이 따로 잡는다.

// 지금 한 턴 더 앉아 있을 이유가 있는가.
// d는 난이도 규격 — 시작 분위기를 알아야 '끌어올렸는지'를 판단할 수 있다.
export function extraTurn(phase, tiers, mood, alreadyExtra, d) {
  const cap = EXTENSION.maxExtra[phase] ?? 0;
  if (alreadyExtra >= cap) return false;
  const base = (d?.startMood ?? 50) + EXTENSION.moodGain;
  if (mood < base) return false;
  const recent = (tiers || []).slice(-EXTENSION.window);
  if (recent.length < EXTENSION.minSeen) return false;   // 아직 볼 게 없으면 늘리지 않는다
  return recent.filter(t => EXTENSION.hotTiers.includes(t)).length >= EXTENSION.needHot;
}

// 심판이 고른 등급이 곧 호감 증감의 상한/하한이다.
// 스칼라만 요구하면 LLM은 판정을 전부 +4~+6에 몰아넣는다(실측). 등급을 강제하고 여기서 클램프한다.
// 등급의 정의는 전부 "상대가 실제로 어떻게 반응했는가"다. 목록 대조는 없다.
export const TIER_BANDS = {
  breakthrough: [7, 10],   // 상대가 실제로 무너졌다
  warm: [4, 6],            // 눈에 띄게 호의적으로 움직였다
  nudge: [1, 3],           // 조금 통했다 — 잘 굴러가는 대화의 대부분
  flat: [-1, 1],           // 아무 일도 일어나지 않았다
  chill: [-5, -2],         // 상대가 식었다
  disaster: [-10, -6],     // 상대가 정색했다
};

// 난이도와 무관한 구조 상수.
export const TUNING = {
  moodMultFloor: 0.30,       // 분위기 0일 때의 호감 배율
  moodMultSpan: 1.30,        // 분위기 100이면 0.30 + 1.30 = 1.60배
  firstImpressionScale: 1.4, // 대면 첫인상 판정만 가중된다 (착장이 실제로 작용하는 지점)
  moodSaturation: 130,       // 분위기가 높을수록 더 올리기 어렵다. 감소분에는 적용하지 않는다
  // 호감도 같은 원리로 포화한다. 낯선 사람 → 호의는 큰 걸음이지만, 호의 → 더 큰 호의는 작은 걸음이다.
  // 라이브 실측에서 심판이 좋은 대화에 계속 warm을 주는 바람에 두 판 다 100/100으로 천장을 쳤다.
  // 프롬프트로 등급 분포를 눌러도 한계가 있어서, 규칙 계층에도 브레이크를 뒀다.
  // 이건 '특정 워딩을 맞히면 가점' 같은 공략 대상이 아니라, 올라갈수록 무거워지는 저울이다.
  loveSaturation: 128,
  moodGainScale: 1.0,        // 분위기 이득 쪽 감쇠. 예전 0.75는 분위기가 아예 안 오르게 만들었다
  disasterMood: -5,          // 상대가 정색하면 자리가 식는다. 등급에서 나오는 결과지 별도 판정이 아니다
  breakthroughMood: 3,       // 반대로 방어선이 무너진 순간엔 공기도 같이 풀린다
};

// 심판의 tier에 맞춰 loveDelta를 밴드 안으로 강제한다.
export function bandLove(tier, loveDelta) {
  const band = TIER_BANDS[tier];
  if (!band) return clamp(Math.round(loveDelta || 0), -10, 10);
  return clamp(Math.round(loveDelta ?? band[0]), band[0], band[1]);
}

// 모르는 등급이 오면 중립으로 떨어뜨린다. 이것이 유일하게 남은 등급 보정이다.
export function normalizeTier(tier) {
  return TIER_BANDS[tier] ? tier : 'flat';
}

export function diffOf(name) { return DIFFICULTIES[name] || DIFFICULTIES['보통']; }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const round1 = v => Math.round(v * 10) / 10;

// 분위기 → 호감 획득 배율
export function moodMultiplier(mood) {
  return TUNING.moodMultFloor + (clamp(mood, 0, 100) / 100) * TUNING.moodMultSpan;
}

// 호감 → 호감 획득 포화. 이미 높으면 같은 판정이라도 덜 오른다.
// 계기판이 이 값을 그대로 띄운다 — 후반에 점수가 안 오르는 이유를 숨길 이유가 없다.
export function loveSaturation(love) {
  return Math.max(0.2, 1 - clamp(love, 0, 100) / TUNING.loveSaturation);
}

export function initialState(d) {
  return {
    love: d.startLove,
    mood: d.startMood,
    turns: 0,
    vibe: '',          // 텍스트 형태의 분위기. 대화창 상단에 뜨고 클라이언트에게 그대로 전달된다
    revealed: [],      // 대화 중 상대에 대해 새로 드러난 것 (심판이 자유 서술로 남긴다. 점수와 무관)
    radioUsed: 0,
    history: [],       // 턴별 판정 로그 (디브리핑/밸런싱용)
    lastDelta: null,
  };
}

// ── 매 턴 판정 적용 ─────────────────────────────────────────────
// judge: { tier, loveDelta:-10..10, moodDelta:-10..10, reason, vibe, revealed }
// opts:  { firstImpression:boolean }
export function applyTurn(state, d, judge, opts = {}) {
  const s = { ...state, revealed: [...(state.revealed || [])], history: [...state.history] };
  const before = { mood: s.mood, love: s.love };
  const weight = opts.firstImpression ? TUNING.firstImpressionScale : 1;

  const tier = normalizeTier(judge.tier);
  const md = clamp(Math.round(judge.moodDelta || 0), -10, 10);
  const ld = bandLove(tier, judge.loveDelta);

  // 심판이 남긴 서술은 그대로 보관한다. 목록과 대조하지 않는다 — 대조할 목록이 없어졌다.
  const revealed = (judge.revealed || '').trim();
  const fresh = revealed && !s.revealed.includes(revealed) ? revealed : '';
  if (fresh) s.revealed.push(fresh);
  const vibe = (judge.vibe || '').trim();
  if (vibe) s.vibe = vibe;

  // 1) 분위기: 판정 + 난이도 흐름 + 등급에서 따라오는 결과.
  //    이득 쪽만 포화시킨다 — 분위기가 이미 높으면 더 끌어올리기 어렵고, 떨어질 땐 그대로 떨어진다.
  const saturate = Math.max(0.15, 1 - s.mood / TUNING.moodSaturation);
  const tierMood = tier === 'disaster' ? TUNING.disasterMood
    : tier === 'breakthrough' ? TUNING.breakthroughMood * saturate : 0;
  const moodGain = (md >= 0 ? md * TUNING.moodGainScale * saturate : md) * weight;
  const moodChange = moodGain + tierMood + d.moodDrift;
  const moodAfter = clamp(s.mood + moodChange, 0, 100);

  // 2) 호감: 판정 × 난이도 스케일 × 분위기 배율 × 호감 포화.
  //    배율과 포화는 둘 다 '발언 시점'의 값을 쓴다. 이득 쪽만 포화시킨다 — 떨어질 땐 그대로 떨어진다.
  const mult = moodMultiplier(before.mood);
  const loveSat = loveSaturation(before.love);
  const scaled = (ld >= 0 ? ld * d.gainScale * loveSat : ld * d.lossScale) * weight;
  const loveChange = scaled * mult - d.loveDecay;

  s.mood = moodAfter;
  s.love = clamp(s.love + loveChange, 0, 100);
  s.turns += 1;

  s.lastDelta = {
    mood: round1(s.mood - before.mood),
    love: round1(s.love - before.love),
    rawMood: md, rawLove: ld, tier, judgeTier: judge.tier || '?',
    mult: round1(mult),
    revealed: fresh,
    vibe: s.vibe,
    firstImpression: !!opts.firstImpression,
  };
  // 히스토리에는 증감(dMood/dLove)과 누적(mood/love)을 둘 다 남긴다 — 디브리핑과 밸런싱 양쪽에서 쓴다
  s.history.push({
    turn: s.turns,
    dMood: s.lastDelta.mood, dLove: s.lastDelta.love,
    mood: Math.round(s.mood), love: Math.round(s.love),
    rawMood: md, rawLove: ld, tier, judgeTier: judge.tier || '?', mult: s.lastDelta.mult,
    revealed: fresh, firstImpression: !!opts.firstImpression,
    reason: judge.reason || '', vibe: s.vibe,
  });
  return s;
}

// 무전은 채점하지 않는다. 사용 횟수만 세고, 효과는 다음 발언의 판정으로 나타난다.
export function noteRadio(state) {
  return { ...state, radioUsed: state.radioUsed + 1 };
}

// ── 조기 파탄 ───────────────────────────────────────────────────
export function failureReason(state) {
  if (state.mood <= 0) return 'mood';   // 분위기 파탄. 상대가 자리를 뜬다
  return null;
}

// ── 최종 판정 ───────────────────────────────────────────────────
export function verdict(state, d, { aborted = false } = {}) {
  const love = Math.round(state.love), mood = Math.round(state.mood);
  const margin = love - d.threshold;
  if (aborted) return { accepted: false, grade: 'F', love, mood, margin, reason: 'aborted' };
  const moodOk = mood >= d.moodFloor;
  const accepted = love >= d.threshold && moodOk;
  let grade;
  if (!accepted) grade = margin >= -8 ? 'D' : margin >= -22 ? 'E' : 'F';
  else if (margin >= 20) grade = 'S';
  else if (margin >= 12) grade = 'A';
  else if (margin >= 5) grade = 'B';
  else grade = 'C';
  return { accepted, grade, love, mood, margin, reason: accepted ? 'ok' : moodOk ? 'love' : 'mood' };
}

// ── 비밀이 화제에 올랐는지 (표시 전용) ──────────────────────────
// 점수와 아무 상관 없다. 디브리핑에서 "이 얘기는 나왔고 저 얘기는 끝내 안 나왔다"를
// 보여주기 위한 것뿐이다. 예전처럼 이 대조 결과로 가점을 주지 않는다 — 그게 이 개편의 요지다.
const STOP = new Set(['사실', '것이다', '것을', '있다', '하는', '하고', '한다', '되는', '그것', '이것', '저것', '때문']);
function tokens(text) {
  return String(text || '')
    .replace(/[^가-힣a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(w => w.length >= 2 && !STOP.has(w));
}
export function surfacedSecrets(couple, transcript, revealed = []) {
  const hay = (String(transcript || '') + ' ' + revealed.join(' ')).toLowerCase();
  const out = { surfaced: [], missed: [] };
  for (const secret of couple.target.hiddenPrefs) {
    const t = tokens(secret);
    if (!t.length) { out.missed.push(secret); continue; }
    const hitCount = t.filter(w => hay.includes(w.toLowerCase())).length;
    // 절반 이상의 토큰이 대화록/기록에 등장하면 "화제에 올랐다"로 본다. 어림값이고, 표시용이다.
    (hitCount * 2 >= t.length ? out.surfaced : out.missed).push(secret);
  }
  return out;
}

// ── 디브리핑: 채점이 아니라 '무슨 일이 있었는지'의 요약 ─────────
export function debrief(state, d, v, couple, transcript = '') {
  const { surfaced, missed } = surfacedSecrets(couple, transcript, state.revealed);
  const pos = state.history.filter(h => h.dLove > 0);
  const neg = state.history.filter(h => h.dLove < 0);
  const cold = state.history.filter(h => h.tier === 'chill' || h.tier === 'disaster');
  const big = state.history.filter(h => h.tier === 'breakthrough');
  const best = state.history.reduce((b, h) => (!b || h.dLove > b.dLove ? h : b), null);
  const worst = state.history.reduce((b, h) => (!b || h.dLove < b.dLove ? h : b), null);

  const notes = [];
  notes.push({
    key: 'revealed', label: '상대에 대해 알아낸 것',
    value: `${state.revealed.length}건`,
    ok: state.revealed.length > 0,
    text: state.revealed.length === 0
      ? '대화 내내 상대의 새로운 면이 한 번도 안 나왔다. 아홉 턴을 인사만 주고받은 셈이다.'
      : state.revealed.slice(0, 4).join(' · '),
  });
  notes.push({
    key: 'secrets', label: '상대가 감춰둔 이야기',
    value: `${surfaced.length} / ${couple.target.hiddenPrefs.length}건 화제에 오름`,
    ok: surfaced.length > 0,
    text: surfaced.length === 0
      ? '아무한테도 안 한 얘기는 끝내 한 마디도 안 나왔다. 화제가 거기까지 안 갔다.'
      : surfaced.length === couple.target.hiddenPrefs.length
        ? '감춰둔 얘기가 전부 대화에 올라왔다. 이 정도로 열린 건 드문 일이다.'
        : '일부는 나왔고 일부는 끝내 안 나왔다.',
  });
  notes.push({
    key: 'cold', label: '상대가 식은 턴',
    value: `${cold.length}턴`,
    ok: cold.length === 0,
    text: cold.length === 0 ? '한 번도 싸늘해지지 않았다.'
      : `${cold.length}턴에서 상대가 물러섰다. 판이 뒤집힌 순간은 ${big.length}회.`,
  });
  notes.push({
    key: 'radio', label: '무전 개입',
    value: `${state.radioUsed} / ${d.radioText + d.radioTalk}회`,
    ok: state.radioUsed > 0,
    text: state.radioUsed === 0 ? '개입 기록 없음. 무전은 아껴봐야 소멸할 뿐이다.'
      : state.radioUsed >= d.radioText + d.radioTalk ? '주어진 개입권을 전부 썼다.' : '개입권이 남은 채로 끝났다.',
  });
  notes.push({
    key: 'flow', label: '발언 성적',
    value: `호재 ${pos.length} / 악재 ${neg.length}턴`,
    ok: pos.length > neg.length,
    text: best && worst
      ? `최고의 한마디는 ${best.turn}턴(호감 ${best.dLove >= 0 ? '+' : ''}${best.dLove}), 최악은 ${worst.turn}턴(${worst.dLove >= 0 ? '+' : ''}${worst.dLove}).`
      : '기록이 없다.',
  });

  return {
    notes, surfaced, missed, revealed: state.revealed,
    threshold: d.threshold, moodFloor: d.moodFloor,
    summary: v.accepted
      ? `호감 ${v.love}/${d.threshold} — 성공선을 ${v.margin}점 넘겼다.`
      : v.reason === 'mood'
        ? `호감 ${v.love}/${d.threshold}은 넘겼지만 분위기 ${v.mood}/${d.moodFloor}이 바닥이라 고백이 묻혔다.`
        : `호감 ${v.love}/${d.threshold} — 성공선에 ${Math.abs(v.margin)}점 모자랐다.`,
  };
}
