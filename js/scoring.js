// scoring.js — 게임 규칙의 순수 함수 계층. LLM 없이 단독 테스트/시뮬레이션이 가능하다.
//
// 설계 원칙 (기획서 재독 후 확정):
//   · 게이지는 딱 둘이다 — 💗 호감(승리 조건) / 😊 분위기(호감 획득 배율).
//   · 채점은 오직 하나, "실제 문자·대면에서 클라이언트가 뱉은 발언"뿐이다.
//   · 스타일링 / 코칭 / 격려 연설 / 무전은 채점 대상이 아니다. 전부 프롬프트 주입일 뿐이며,
//     그 효과는 클라이언트가 실제로 어떻게 말하느냐로만 드러난다.
//     → 준비를 대충 하면 점수가 깎이는 게 아니라, 클라이언트가 대화에서 알아서 망한다.

// ── 밸런싱 근거 (라이브 계측) ────────────────────────────────────
// tests/live.mjs로 실제 API 플레이 20판(완주) + 8판(부분)을 돌려 얻은 값이다.
// 프로필은 ace(요원 역할 LLM) / good(성의 있는 템플릿) / lazy(한 단어) / none(공백).
//
//   쉬움 : 잘한 플레이 호감 56~96 · 대충한 플레이 17~38  → 성공선 45가 정확히 사이에 있다
//   보통 : 잘한 플레이 46~66 · 대충한 플레이  8~31       → 성공선 52 (잘한 최저 46과 대충한 최고 31 사이)
//   헬   : 계측 시점(구 판정기)엔 최고가 42여서 60이 도달 불가였다. 판정기가 '상대의 실제 반응'을
//          보게 된 뒤 미확인 취향 적중률이 오르는 것을 감안해 54로 내렸다.
//          → 세 난이도 중 헬만 외삽값이다. 재계측하려면 tests/live.mjs --couples=politics,ai-artist.
//
// '대충한 플레이'가 성공선을 넘지 못하는 이유는 점수를 깎기 때문이 아니다.
// 코칭이 없으면 클라이언트가 상대의 실마리를 못 알아채고(prompts.js의 실마리 무시 규칙),
// 그래서 미확인 취향을 하나도 캐지 못해 구조적 보너스를 통째로 놓치기 때문이다.
export const DIFFICULTIES = {
  '쉬움': {
    key: 'easy', badge: '쉬움',
    textTurns: 4, talkTurns: 5,
    radioText: 1, radioTalk: 2,   // 기획서 규정: 문자 1회, 대면 2회
    startLove: 10, startMood: 55,
    threshold: 45, moodFloor: 25,
    loveDecay: 0.0,   // 턴마다 식는 호감
    moodDrift: 0.5,   // 턴마다 흐르는 분위기 (양수면 알아서 풀린다)
    gainScale: 1.15, lossScale: 0.85,
  },
  '보통': {
    key: 'normal', badge: '보통',
    textTurns: 4, talkTurns: 5,
    radioText: 1, radioTalk: 2,
    startLove: 6, startMood: 46,
    threshold: 52, moodFloor: 33,
    loveDecay: 0.5,
    moodDrift: -0.6,
    gainScale: 1.0, lossScale: 1.0,
  },
  '헬': {
    key: 'hell', badge: '헬',
    textTurns: 4, talkTurns: 5,
    radioText: 1, radioTalk: 2,
    startLove: 3, startMood: 38,
    threshold: 54, moodFloor: 40,
    loveDecay: 1.0,
    moodDrift: -1.4,
    gainScale: 0.9, lossScale: 1.15,
  },
};

// 심판이 고른 등급이 곧 호감 증감의 상한/하한이다.
// 스칼라만 요구하면 LLM은 판정을 전부 +4~+6에 몰아넣는다(실측). 등급을 강제하고 여기서 클램프한다.
export const TIER_BANDS = {
  critical: [8, 10],
  hit: [5, 7],
  ok: [2, 4],
  empty: [-1, 1],
  backfire: [-5, -2],
  redline: [-10, -6],
};

// 난이도와 무관한 구조 상수. 라이브 플레이 로그로 캘리브레이션한 값들이다.
export const TUNING = {
  moodMultFloor: 0.30,   // 분위기 0일 때의 호감 배율
  moodMultSpan: 1.30,    // 분위기 100이면 0.30 + 1.30 = 1.60배
  hiddenBonus: 6,        // 미확인 취향을 처음 저격했을 때 붙는 구조적 보너스 (호감)
  hiddenMoodBonus: 4,    // 같은 순간의 분위기 보너스
  redLineLove: -7,       // 지뢰를 밟았을 때 추가로 깎이는 호감
  redLineMood: -13,      // 지뢰를 밟았을 때 추가로 깎이는 분위기
  firstImpressionScale: 1.4, // 대면 첫인상 판정만 가중된다 (착장이 실제로 작용하는 지점)
  moodSaturation: 130,       // 분위기가 높을수록 더 올리기 어렵다. 감소분에는 적용하지 않는다
  moodGainScale: 0.75,       // 심판의 moodDelta 자체가 후한 편이라 이득 쪽만 눌러둔다
};

// 심판의 tier에 맞춰 loveDelta를 밴드 안으로 강제한다.
export function bandLove(tier, loveDelta) {
  const band = TIER_BANDS[tier];
  if (!band) return clamp(Math.round(loveDelta || 0), -10, 10);
  return clamp(Math.round(loveDelta ?? band[0]), band[0], band[1]);
}

// hit/critical 게이트: 취향 목록을 실제로 건드리지 않았으면 아무리 대화가 좋아도 ok가 상한이다.
// 프롬프트로 부탁만 하면 심판은 매력적인 대사를 전부 hit으로 올려버린다(실측 51%). 규칙 계층에서 강제한다.
export function gateTier(tier, { visibleHit, hiddenHit, redHit }) {
  if (redHit) return 'redline';
  if ((tier === 'hit' || tier === 'critical') && !visibleHit && !hiddenHit) return 'ok';
  if (tier === 'critical' && !hiddenHit) return 'hit';   // critical은 미확인 취향 관통에만 준다
  return TIER_BANDS[tier] ? tier : 'empty';
}

export function diffOf(name) { return DIFFICULTIES[name] || DIFFICULTIES['보통']; }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const round1 = v => Math.round(v * 10) / 10;

// 분위기 → 호감 획득 배율
export function moodMultiplier(mood) {
  return TUNING.moodMultFloor + (clamp(mood, 0, 100) / 100) * TUNING.moodMultSpan;
}

export function initialState(d) {
  return {
    love: d.startLove,
    mood: d.startMood,
    turns: 0,
    hits: [],          // 적중한 미확인 취향 (문자열)
    seenVisible: [],   // 이미 써먹은 알려진 취향 (재탕은 hit 자격 상실)
    redLines: 0,       // 밟은 지뢰 횟수
    radioUsed: 0,
    history: [],       // 턴별 판정 로그 (디브리핑/밸런싱용)
    lastDelta: null,
  };
}

// ── 매 턴 판정 적용 ─────────────────────────────────────────────
// judge: { moodDelta:-10..10, loveDelta:-10..10, hiddenPrefHit:string, redLineHit:boolean, reason }
// opts:  { firstImpression:boolean, knownHidden:string[] } — knownHidden은 해당 커플의 실제 미확인 취향 목록
export function applyTurn(state, d, judge, opts = {}) {
  const s = { ...state, hits: [...state.hits], seenVisible: [...(state.seenVisible || [])], history: [...state.history] };
  const before = { mood: s.mood, love: s.love };
  const weight = opts.firstImpression ? TUNING.firstImpressionScale : 1;

  // 미확인 취향 적중 — 목록에 실제로 있는 문자열만, 그리고 처음 한 번만 인정한다
  const rawHidden = (judge.hiddenPrefHit || '').trim();
  const known = opts.knownHidden || [];
  const hit = rawHidden && known.includes(rawHidden) && !s.hits.includes(rawHidden) ? rawHidden : '';
  if (hit) s.hits.push(hit);

  // 알려진 취향 적중 — 보너스는 없지만 hit 등급의 자격 요건이다. 같은 취향 재탕은 자격을 잃는다.
  const rawVisible = (judge.visiblePrefHit || '').trim();
  const visibleOk = !!rawVisible && (opts.knownVisible || []).includes(rawVisible);
  const freshVisible = visibleOk && !s.seenVisible?.includes(rawVisible);
  if (visibleOk) s.seenVisible = [...(s.seenVisible || []), rawVisible];

  const red = !!judge.redLineHit;
  if (red) s.redLines += 1;

  const tier = gateTier(judge.tier, { visibleHit: freshVisible, hiddenHit: !!hit, redHit: red });
  const md = clamp(Math.round(judge.moodDelta || 0), -10, 10);
  const ld = bandLove(tier, tier === judge.tier ? judge.loveDelta : TIER_BANDS[tier][1]);

  // 1) 분위기: 판정 + 난이도 흐름 + 지뢰 + 미확인 보너스.
  //    이득 쪽만 포화시킨다 — 분위기가 이미 높으면 더 끌어올리기 어렵고, 떨어질 땐 그대로 떨어진다.
  const saturate = Math.max(0.15, 1 - s.mood / TUNING.moodSaturation);
  const moodGain = (md >= 0 ? md * TUNING.moodGainScale * saturate : md) * weight
    + (hit ? TUNING.hiddenMoodBonus * saturate : 0);
  const moodChange = moodGain + d.moodDrift + (red ? TUNING.redLineMood : 0);
  const moodAfter = clamp(s.mood + moodChange, 0, 100);

  // 2) 호감: 판정 × 난이도 스케일 × 분위기 배율. 배율은 '발언 시점'의 분위기를 쓴다.
  const mult = moodMultiplier(before.mood);
  const scaled = (ld >= 0 ? ld * d.gainScale : ld * d.lossScale) * weight;
  const loveChange = scaled * mult
    + (hit ? TUNING.hiddenBonus : 0)
    + (red ? TUNING.redLineLove : 0)
    - d.loveDecay;

  s.mood = moodAfter;
  s.love = clamp(s.love + loveChange, 0, 100);
  s.turns += 1;

  s.lastDelta = {
    mood: round1(s.mood - before.mood),
    love: round1(s.love - before.love),
    rawMood: md, rawLove: ld, tier, judgeTier: judge.tier || '?',
    mult: round1(mult),
    hit, red,
    firstImpression: !!opts.firstImpression,
  };
  // 히스토리에는 증감(dMood/dLove)과 누적(mood/love)을 둘 다 남긴다 — 디브리핑과 밸런싱 양쪽에서 쓴다
  s.history.push({
    turn: s.turns,
    dMood: s.lastDelta.mood, dLove: s.lastDelta.love,
    mood: Math.round(s.mood), love: Math.round(s.love),
    rawMood: md, rawLove: ld, tier, judgeTier: judge.tier || '?', mult: s.lastDelta.mult,
    hit, red, firstImpression: !!opts.firstImpression,
    reason: judge.reason || '',
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

// ── 디브리핑: 채점이 아니라 '무슨 일이 있었는지'의 요약 ─────────
export function debrief(state, d, v, couple) {
  const hidden = couple.target.hiddenPrefs;
  const missed = hidden.filter(p => !state.hits.includes(p));
  const pos = state.history.filter(h => h.dLove > 0);
  const neg = state.history.filter(h => h.dLove < 0);
  const best = state.history.reduce((b, h) => (!b || h.dLove > b.dLove ? h : b), null);
  const worst = state.history.reduce((b, h) => (!b || h.dLove < b.dLove ? h : b), null);

  const notes = [];
  notes.push({
    key: 'hidden', label: '미확인 취향 발굴',
    value: `${state.hits.length} / ${hidden.length}건`,
    ok: state.hits.length >= Math.ceil(hidden.length / 2),
    text: state.hits.length === 0
      ? '끝내 하나도 못 캤다. 무전으로 화제를 끌지 않으면 상대는 먼저 말하지 않는다.'
      : state.hits.length === hidden.length ? '전부 캐냈다. 이건 요원의 실력이다.'
        : '절반은 건드렸다. 나머지는 화제 자체가 나오지 않았다.',
  });
  notes.push({
    key: 'redline', label: '지뢰 접촉',
    value: `${state.redLines}회`,
    ok: state.redLines === 0,
    text: state.redLines === 0 ? '지뢰는 한 번도 안 밟았다.'
      : `${state.redLines}번 밟았다. 지뢰 한 번이 잘한 두 턴을 지운다.`,
  });
  notes.push({
    key: 'radio', label: '무전 개입',
    value: `${state.radioUsed} / ${d.radioText + d.radioTalk}회`,
    ok: state.radioUsed > 0,
    text: state.radioUsed === 0 ? '한 번도 개입하지 않았다. 무전은 아껴봐야 소멸할 뿐이다.'
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
    notes, missed, found: state.hits,
    threshold: d.threshold, moodFloor: d.moodFloor,
    summary: v.accepted
      ? `호감 ${v.love}/${d.threshold} — 성공선을 ${v.margin}점 넘겼다.`
      : v.reason === 'mood'
        ? `호감 ${v.love}/${d.threshold}은 넘겼지만 분위기 ${v.mood}/${d.moodFloor}이 바닥이라 고백이 묻혔다.`
        : `호감 ${v.love}/${d.threshold} — 성공선에 ${Math.abs(v.margin)}점 모자랐다.`,
  };
}
