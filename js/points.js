// points.js — 코드가 들고 있는 수치 전부. LLM 없이 단독 테스트가 된다.
//
// 구조도에서 검은색으로 칠해진 것들이 여기 산다 — 「코드용 분류」.
//   · 무드 포인트 · 러브 포인트
//   · 심판이 돌려주는 것은 **증감 여부**(up/down/same)뿐이고, 폭은 여기서 정한다.
//   · 성사 여부는 여기 없다. 그건 C(후일담)가 러브 포인트를 보고 정한다.
//
// 게이지는 둘뿐이고, 서로 하는 일이 다르다.
//   무드 — 이 자리가 굴러가는가. 0이 되면 자리가 깨지고 페이즈가 거기서 끝난다.
//   러브 — 타겟이 고객을 원하게 됐는가. 후일담이 읽는 유일한 숫자다.
// 그 밖의 축(공기·강압·방어·개방 돌파·포화·난이도)은 없다. 되살리지 않는다.
//
// 눈금은 셀 수 있는 크기다. 한 걸음이 1이고 최대치가 10과 20이라, 화면의 숫자가 곧
// 「몇 번 움직였나」다. 0..100을 쓰던 시절에는 50에서 12씩 움직여 놓고 백분율인 척했다.

// 대화 한 구간의 크기. 이만큼을 한 번에 생성하고, 그 구간을 통째로 판정한다.
export const BEAT = { lines: 6 };

// 페이즈 둘. 구조도의 「텍스팅 & 토킹 페이즈」가 이것이다.
export const PHASES = [
  { key: 'text', label: '텍스팅', beats: 4 },
  { key: 'talk', label: '토킹', beats: 5 },
];

export const POINTS = {
  // 무드 — 자리의 온도. 언제나 한 걸음 1칸이다. 다섯 번 내려가면 자리가 깨진다.
  moodStart: 5, moodStep: 1, moodMax: 10,
  moodHot: 8,      // 이 위는 자리가 달아오른 것으로 친다 — 러브 ▲에 한 칸이 더 붙는다
  moodDanger: 2,   // 계기판이 빨개지는 선. 계산에는 안 쓴다

  // 러브 — 타겟의 당김. ▼는 언제나 한 칸, ▲만 사정을 탄다 (1~4칸).
  loveStart: 2, loveStep: 1, loveMax: 20,
  loveStreak: [0, 0, 1, 2],   // 연속 ▲ 1회 / 2회 / 3회 이상에 얹는 칸

  min: 0,
};

const clamp = (v, max) => Math.max(POINTS.min, Math.min(max, v));

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

/** 기록 끝에서 러브 ▲가 몇 번 연달아 나왔는지. 상태에 축을 늘리지 않으려고 원장을 되짚는다. */
function loveRun(history) {
  let n = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (!(history[i].dLove > 0)) break;
    n++;
  }
  return n;
}

/**
 * 러브 ▲ 한 번이 실제로 몇 칸인가. 규칙은 둘뿐이다.
 *   ① 자리가 달아올라 있으면(무드 ≥ moodHot) 한 칸 더 — 같은 한 마디도 뜨거운 자리에서 더 깊게 박힌다.
 *   ② 연달아 꽂히면 더 크다 — 한 번은 우연일 수 있지만 세 번은 사람이 넘어가는 중이다.
 * run은 이번 ▲를 포함한 연속 횟수(1부터)다.
 */
export function loveGain(mood, run) {
  const hot = mood >= POINTS.moodHot ? 1 : 0;
  const streak = POINTS.loveStreak[Math.min(run, POINTS.loveStreak.length - 1)];
  return POINTS.loveStep + hot + streak;
}

/**
 * 판정 하나를 반영한다. verdict = { mood: 'up'|'down'|'same', love: ... }
 * 순수 함수다 — 새 상태를 돌려주고 원본은 건드리지 않는다.
 */
export function applyVerdict(state, verdict, meta = {}) {
  const dMood = direction(verdict?.mood);
  const dLove = direction(verdict?.love);

  // 무드는 언제나 한 칸이다. 사정을 안 탄다.
  const mood = clamp(state.mood + dMood * POINTS.moodStep, POINTS.moodMax);

  // 러브 ▼도 언제나 한 칸이다 — 자리가 뜨겁든 얼었든 밟힌 건 밟힌 것이다.
  // ▲만 방금 정해진 무드와 여기까지의 연속을 본다.
  const step = dLove > 0 ? loveGain(mood, loveRun(state.history) + 1)
    : dLove < 0 ? -POINTS.loveStep
      : 0;
  const love = clamp(state.love + step, POINTS.loveMax);

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
      step,            // 이번 러브가 몇 칸 움직였나. 화면이 ▲ 옆에 그대로 띄운다
    }],
  };
}

/** 자리가 깨졌는가 — 무드가 바닥이면 남은 구간은 돌지 않는다. */
export function isBroken(state) { return state.mood <= POINTS.min; }

/** 게이지 하나를 화면에 그릴 때 쓰는 값. 최대치가 둘이 다르므로 같이 받는다. */
export function gauge(value, max) {
  const v = clamp(value, max);
  return { value: Math.round(v), max, pct: Math.round(v / max * 100) };
}

/**
 * 후일담(C)에 넘길 러브 포인트. C의 프롬프트는 「0이면 하루 종일 아무것도 안 움직인 것,
 * 100이면 이미 연인」이라는 **의미의 눈금**을 쓴다. 안쪽 눈금을 0..20으로 압축한 뒤에도
 * 그 문장이 그대로 맞도록, 넘길 때만 되돌려 보낸다. 프롬프트는 한 글자도 안 바뀐다.
 */
export function loveOutOf100(love) {
  return Math.round(clamp(love, POINTS.loveMax) / POINTS.loveMax * 100);
}

/** 증감 여부의 표시용 기호. 판정이 내보내는 전부이므로 화면도 이게 전부다. */
export const MARK = { 1: '▲', '-1': '▼', 0: '─' };
export const MARK_CLASS = { 1: 'up', '-1': 'down', 0: 'same' };

/** 페이즈 정의를 key로 꺼낸다. */
export function phaseOf(key) { return PHASES.find(p => p.key === key) || PHASES[0]; }

/** 이 판에서 돌 수 있는 전체 구간 수. */
export const TOTAL_BEATS = PHASES.reduce((n, p) => n + p.beats, 0);
