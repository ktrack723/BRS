// scoring.js — 게임 규칙의 순수 함수 계층. LLM 없이 단독 테스트 가능하다.
// 설계 목표: 스타일링/코칭/격려/무전 네 레버가 모두 결과에 실질 영향을 주고,
// 난이도가 오를수록 하나라도 빠지면 성공선에 못 닿는다.

export const DIFFICULTIES = {
  '쉬움': {
    key: 'easy', badge: '쉬움',
    textTurns: 4, talkTurns: 5,
    radioText: 2, radioTalk: 3,
    visiblePrefs: 3, hiddenPrefs: 2,
    loveDecay: 0,        // 턴마다 빠지는 호감 (관성 방지)
    courageDecay: 1.2,   // 턴마다 닳는 용기
    moodDrift: 1,        // 코칭이 없을 때의 기본 분위기 흐름
    styleFloor: 0.70,    // 스타일링 0점일 때의 호감 획득 배율
    threshold: 40,       // 고백 성공 최소 호감
    moodFloor: 20,       // 성공에 필요한 최소 분위기
  },
  '보통': {
    key: 'normal', badge: '보통',
    textTurns: 5, talkTurns: 6,
    radioText: 1, radioTalk: 2,
    visiblePrefs: 2, hiddenPrefs: 3,
    loveDecay: 0.5,
    courageDecay: 5.5,
    moodDrift: 0,
    styleFloor: 0.55,
    threshold: 46,
    moodFloor: 30,
  },
  '헬': {
    key: 'hell', badge: '헬',
    textTurns: 5, talkTurns: 7,
    radioText: 1, radioTalk: 2,
    visiblePrefs: 1, hiddenPrefs: 4,
    loveDecay: 1.0,
    courageDecay: 6,
    moodDrift: -2,
    styleFloor: 0.40,
    threshold: 58,
    moodFloor: 45,
  },
};

export function diffOf(name) { return DIFFICULTIES[name] || DIFFICULTIES['보통']; }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const round1 = v => Math.round(v * 10) / 10;

// ── 준비 단계(컨설팅) 점수 → 런타임 초기 상태 ─────────────────
// styleScore/coachScore/courageScore: 각 0~10 (LLM 채점)
export function initialState(d, { styleScore = 0, coachScore = 0, courageScore = 0 }) {
  return {
    // 호감: 승리 조건. 스타일링이 출발선을 정한다.
    love: 8 + styleScore * 1.2,
    // 분위기: 호감 획득 배율의 원천. 코칭이 출발선을 정한다.
    mood: 30 + coachScore * 2.0,
    // 용기: 스태미나. 격려 연설이 정하고 턴마다 닳는다. 0이면 클라이언트가 얼어붙어 즉시 실패.
    courage: 12 + courageScore * 8.8,
    styleScore, coachScore, courageScore,
    // 스타일링 → 호감 획득 배율 (난이도가 높을수록 저점이 가혹)
    styleMult: d.styleFloor + (1.6 - d.styleFloor) * (styleScore / 10),
    // 코칭 → 분위기 증감 비대칭 (코칭이 나쁘면 잘 안 오르고 잘 깎인다)
    moodGainMult: 0.45 + coachScore * 0.105,
    moodLossMult: 1.55 - coachScore * 0.055,
  };
}

// ── 매 턴 판정 적용 ──────────────────────────────────────────
// judge: {moodDelta, loveDelta} (각 -10~10)
export function applyTurn(state, d, judge, opts = {}) {
  const s = { ...state };
  const before = { mood: s.mood, love: s.love, courage: s.courage };

  const md = clamp(judge.moodDelta | 0, -10, 10);
  const ld = clamp(judge.loveDelta | 0, -10, 10);

  // 1) 분위기: 코칭 품질이 증감 비대칭을 만든다 + 난이도 기본 흐름
  const moodChange = (md >= 0 ? md * s.moodGainMult : md * s.moodLossMult) + d.moodDrift;
  s.mood = clamp(s.mood + moodChange, 0, 100);

  // 2) 용기: 턴마다 소모. 낮으면 클라이언트가 쪼그라들어 호감 획득이 깎인다.
  s.courage = clamp(s.courage - d.courageDecay, 0, 100);
  // 용기가 바닥나면 즉시 종료가 아니라 '패닉': 말이 꼬이면서 분위기를 스스로 갉아먹는다.
  const panic = s.courage <= 0;
  if (panic) s.mood = clamp(s.mood - 7, 0, 100);
  s.panic = panic;
  const chokeMult = panic ? 0.25 : s.courage < 25 ? 0.55 : s.courage < 50 ? 0.85 : 1;

  // 3) 호감: 분위기 배율 × 스타일 배율 × 용기 상태, 그리고 난이도 감쇠
  const moodMult = 0.40 + (s.mood / 100) * 1.10; // 분위기 0→0.4배, 100→1.5배
  const gain = ld * moodMult * s.styleMult * chokeMult;
  s.love = clamp(s.love + gain - d.loveDecay, 0, 100);

  s.lastDelta = {
    mood: round1(s.mood - before.mood),
    love: round1(s.love - before.love),
    courage: round1(s.courage - before.courage),
    chokeMult, moodMult: round1(moodMult),
  };
  return s;
}

// ── 대면 첫인상: 스타일링의 일회성 큰 스윙 ────────────────────
export function firstImpression(state, d) {
  const s = { ...state };
  const swing = (s.styleScore - 4.5) * (d.key === 'hell' ? 2.6 : d.key === 'normal' ? 2.2 : 1.8);
  s.love = clamp(s.love + swing, 0, 100);
  s.mood = clamp(s.mood + swing * 0.5, 0, 100);
  s.lastDelta = { love: round1(swing), mood: round1(swing * 0.5), firstImpression: true };
  return s;
}

// ── 무전 개입 효과 ───────────────────────────────────────────
// aim 0~10: 지시가 상황·취향에 얼마나 정확히 꽂혔는지 (LLM 채점)
export function applyRadio(state, d, aim) {
  const s = { ...state };
  const a = clamp(aim | 0, 0, 10);
  const courageGain = 4 + a * 1.8;        // 헛발질이어도 최소한 기운은 난다
  const moodShift = (a - 4) * 2.2;        // 엉뚱한 지시는 분위기를 깎는다
  const loveShift = a >= 6 ? (a - 5) * 3.6 : (a - 4) * 1.6;  // 정확하면 크게 먹고, 겉돌면 깎인다
  s.courage = clamp(s.courage + courageGain, 0, 100);
  s.mood = clamp(s.mood + moodShift, 0, 100);
  s.love = clamp(s.love + loveShift, 0, 100);
  s.lastDelta = { courage: round1(courageGain), mood: round1(moodShift), love: round1(loveShift), radio: true, aim: a };
  return s;
}

// ── 종료 판정 ────────────────────────────────────────────────
// 공작이 중단되는 조건. 호감이 0이어도 대화 자체는 끝까지 간다(그저 실패할 뿐).
export function failureReason(state) {
  if (state.mood <= 0) return 'mood';         // 분위기 파탄, 상대가 자리를 뜸
  return null;
}

export function verdict(state, d, { aborted = false } = {}) {
  const love = Math.round(state.love), mood = Math.round(state.mood);
  if (aborted) return { accepted: false, grade: 'F', love, mood, margin: love - d.threshold };
  const accepted = love >= d.threshold && mood >= d.moodFloor;
  const margin = love - d.threshold;
  let grade;
  if (!accepted) grade = margin >= -10 ? 'D' : margin >= -25 ? 'E' : 'F';
  else if (margin >= 18) grade = 'S';
  else if (margin >= 10) grade = 'A';
  else if (margin >= 4) grade = 'B';
  else grade = 'C';
  return { accepted, grade, love, mood, margin };
}

// ── 사후 브리핑: 어느 레버가 부족했는지 ──────────────────────
export function debrief(state, d, v) {
  const items = [];
  const lv = (n, score, good, bad) => items.push({
    name: n, score,
    verdictText: score >= 7 ? good : score >= 4 ? '무난했다' : bad,
    ok: score >= 7, weak: score < 4,
  });
  lv('스타일링', state.styleScore, '타겟 취향을 제대로 저격했다', '착장이 발목을 잡았다');
  lv('대화 코칭', state.coachScore, '클라이언트가 흔들리지 않았다', '지침이 없어 대화가 새버렸다');
  lv('격려 연설', state.courageScore, '끝까지 기가 살아 있었다', '중반부터 쪼그라들었다');
  const radioScore = state.radioCount ? Math.round(state.radioAimSum / state.radioCount) : 0;
  items.push({
    name: '무전 개입', score: state.radioCount ? radioScore : 0,
    verdictText: !state.radioCount ? '한 번도 개입하지 않았다'
      : radioScore >= 7 ? '결정적인 순간을 잡아냈다' : radioScore >= 4 ? '무난한 지시였다' : '지시가 겉돌았다',
    ok: state.radioCount > 0 && radioScore >= 7,
    weak: !state.radioCount || radioScore < 4,
  });
  return {
    items,
    threshold: d.threshold,
    summary: v.accepted
      ? `호감 ${v.love}/${d.threshold} — 성공선을 ${v.margin}점 넘겼다.`
      : `호감 ${v.love}/${d.threshold} — 성공선에 ${Math.abs(v.margin)}점 모자랐다.`,
  };
}
