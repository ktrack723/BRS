// points.js — 코드가 들고 있는 수치 전부. LLM 없이 단독 테스트가 된다.
//
// 구조도에서 검은색으로 칠해진 것들이 여기 산다 — 「코드용 분류」.
//   · 무드 포인트 · 러브 포인트
//   · 심판이 돌려주는 것은 **증감 여부**(up/down/same)뿐이고, 폭은 여기서 정한다.
//   · 성사 여부는 여기 없다. 그건 C(후일담)가 러브 포인트를 보고 정한다.
//
// 무전 배급도 여기 산다. 요원이 판 도중에 쓸 수 있는 유일한 레버라서, 그 횟수는
// 프롬프트가 아니라 코드가 들고 있어야 한다. 심판도 대화도 이 숫자를 모른다.
//
// 게이지는 둘뿐이고, 서로 하는 일이 다르다.
//   무드 — 이 자리가 굴러가는가. 0이 되면 자리가 깨지고 페이즈가 거기서 끝난다.
//   러브 — 타겟이 고객을 원하게 됐는가. 후일담이 읽는 유일한 숫자다.
// 그 밖의 축(공기·강압·방어·개방 돌파·포화·난이도)은 없다. 되살리지 않는다.

// 대화 한 구간의 크기. 이만큼을 한 번에 생성하고, 그 구간을 통째로 판정한다.
export const BEAT = { lines: 6 };

// 페이즈 둘. 구조도의 「텍스팅 & 토킹 페이즈」가 이것이다.
export const PHASES = [
  { key: 'text', label: '텍스팅', beats: 4 },
  { key: 'talk', label: '토킹', beats: 5 },
];

// 무전 — 대화 도중의 개입. 페이즈마다 한 번씩만 배급된다 (텍스팅 1회 · 토킹 1회).
// 코칭이 자리에 앉기 전에 한 덩이로 들어가는 것이라면, 무전은 자리가 굴러가는
// 도중에 꽂히는 것이다. 배급을 늘리면 요원이 대화를 통째로 조종하게 된다 — 한 번이다.
export const RADIO = { perPhase: 1 };

export const POINTS = {
  moodStart: 50, moodStep: 12,
  loveStart: 12, loveStep: 8,
  min: 0, max: 100,
};

const clamp = (v) => Math.max(POINTS.min, Math.min(POINTS.max, v));

/** up / down / same → +1 / -1 / 0. 모르는 값은 same으로 떨어진다. */
export function direction(v) {
  return v === 'up' ? 1 : v === 'down' ? -1 : 0;
}

export function initialPoints() {
  return {
    mood: POINTS.moodStart,
    love: POINTS.loveStart,
    beats: 0,
    broken: false,     // 무드가 바닥나 자리가 깨졌는가
    history: [],       // 구간별 기록 (사후 화면용)
  };
}

/**
 * 판정 하나를 반영한다. verdict = { mood: 'up'|'down'|'same', love: ... }
 * 순수 함수다 — 새 상태를 돌려주고 원본은 건드리지 않는다.
 */
export function applyVerdict(state, verdict, meta = {}) {
  const dMood = direction(verdict?.mood);
  const dLove = direction(verdict?.love);
  const mood = clamp(state.mood + dMood * POINTS.moodStep);
  const love = clamp(state.love + dLove * POINTS.loveStep);
  return {
    ...state,
    mood, love,
    beats: state.beats + 1,
    broken: mood <= POINTS.min,
    history: [...state.history, {
      beat: state.beats + 1,
      phase: meta.phase || '',
      mood, love,
      dMood, dLove,
    }],
  };
}

/** 자리가 깨졌는가 — 무드가 바닥이면 남은 구간은 돌지 않는다. */
export function isBroken(state) { return state.mood <= POINTS.min; }

/** 게이지 하나를 화면에 그릴 때 쓰는 값. */
export function gauge(value) {
  return { value: Math.round(value), pct: Math.round(clamp(value)) };
}

/** 증감 여부의 표시용 기호. 판정이 내보내는 전부이므로 화면도 이게 전부다. */
export const MARK = { 1: '▲', '-1': '▼', 0: '─' };
export const MARK_CLASS = { 1: 'up', '-1': 'down', 0: 'same' };

/** 페이즈 정의를 key로 꺼낸다. */
export function phaseOf(key) { return PHASES.find(p => p.key === key) || PHASES[0]; }

/** 이 판에서 돌 수 있는 전체 구간 수. */
export const TOTAL_BEATS = PHASES.reduce((n, p) => n + p.beats, 0);
