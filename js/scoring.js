// scoring.js — 게임 규칙의 순수 함수 계층. LLM 없이 단독 테스트/시뮬레이션이 가능하다.
//
// 설계 원칙
//   · 게이지는 하나다 — 💗 호감. 분위기는 수치가 아니라 **문장**으로만 존재하고,
//     그 문장은 심판의 판정 입력이자 두 인물에게 전달되는 컨텍스트다.
//     (한동안 분위기 수치·배율·하한·정체 감쇠가 있었다. 전부 걷어냈다 —
//      수치 분위기는 호감과 역할이 겹치면서 판만 복잡하게 만들었고,
//      "험악한데 끌리는" 상태를 번번이 죽였다.)
//   · 채점 단위는 발언 하나가 아니라 **합(bout)** 이다. 서로 대여섯 마디를 주고받은
//     덩어리를 심판이 통째로 보고 등급 하나를 매긴다. 합의 경계도 심판이 자른다(carry).
//     티키타카 한 번마다 채점하면 심판이 파편을 재고, 파편에는 흐름이 없다.
//   · 채점 대상은 오직 "그 합에서 실제로 오간 말"이다. 착장/지침/연설/무전 등
//     플레이어가 쓴 것은 절대 채점하지 않는다 — 효과는 대화로만 드러난다.
//   · 판정은 철저히 상대 시점이다. 공정한 대화 평가가 아니라 "상대가 이 사람에게
//     끌렸는가"만 잰다. 회사원끼리의 좋은 대화는 0점이다.

// ── 밸런스 정책 (README ⚖️) ─────────────────────────────────────
// 성공선이 옳은지는 "이상적으로 플레이하면 아슬아슬 넘는가"로 잰다. 그 이상적 플레이는
// 커플마다 사람이 손수 써둔 gold 지시서(tests/ace-book.mjs)로 돌린다 — LLM이 즉석에서
// 대충 짠 게 아니다. gold가 압승이면 선을 올리고, 실패면 내리고, 겨우 넘으면 맞다.
// 무준비(none)는 사랑 경로로는 실패해야 한다(강압은 별개). 아래 숫자는 그 기준으로 조율한다.
export const DIFFICULTIES = {
  '쉬움': {
    key: 'easy', badge: '쉬움',
    textTurns: 6, talkTurns: 8,          // 교환(내 발언+상대 반응) 수
    radioText: 1, radioTalk: 2,          // 기획서 규정: 문자 1회, 대면 2회
    startLove: 10,
    threshold: 58,
    gainScale: 4.2, lossScale: 1.3,
  },
  '보통': {
    key: 'normal', badge: '보통',
    textTurns: 6, talkTurns: 8,
    radioText: 1, radioTalk: 2,
    startLove: 6,
    // 프롬프트 최소주의 후 실측(r5)에서 준비된 판(ace)이 breakthrough를 다시 쌓아 79까지
    // 갔다 — 결 조이기 시절 내렸던 60을 64로 되돌린다. none 최고 60을 4점 차로 막는 선이다.
    threshold: 64,
    // 보통 조합(gapjil·vtuber·os-war …)은 대화가 굴러가지 않아 두근거림 소재 자체가
    // 적다. 그래서 배율이 제일 높다 (합 체계 실측 19판 재생으로 확정).
    gainScale: 5.2, lossScale: 1.6,
  },
  '헬': {
    key: 'hell', badge: '헬',
    textTurns: 6, talkTurns: 8,
    radioText: 1, radioTalk: 2,
    startLove: 3,
    // 헬은 **착장 승부다**. 좋은 저녁(무너짐 두 번, 밴드 최대)만으로는 67에서 멈추고,
    // 첫인상 breakthrough(가중 1.2)가 얹혀야 70을 넘는다. 실측 r3에서 방치판(none)이
    // br을 셋이나 받고도 66에 그친 반면, 착장이 꽂힌 ace는 73을 찍었다 — 그 사이에 선을 긋는다.
    // 첫인상은 none이 만들 수 없는 유일한 점수원이다 (착장 없음 → flat/0).
    threshold: 70,
    gainScale: 3.8, lossScale: 1.9,
  },
};

// ── 합(bout) 규격 ────────────────────────────────────────────────
// size: 미채점 교환이 이만큼 쌓이면 심판을 부른다 ("서로 대여섯 마디").
// carryMax: 심판이 "마지막 n교환은 다음 합의 시작"이라고 잘라 넘길 수 있는 최대치.
//           합의 경계는 심판이 나눈다 — 규칙은 상한만 지킨다.
export const BOUT = { size: 5, carryMax: 2 };

// 자리 연장/조기 종료 — 합 단위. 심판이 매 합 끝에 keepGoing을 답한다.
//   마지막 답이 false → 자리를 접는다 (특히 문자는 답장이 끊기며 끝나는 게 자연스럽다).
//   마지막 답이 true → 페이즈 끝이라면 교환 몇 개를 더 얹는다 (1회 한정).
export const EXTENSION = { extraExchanges: { text: 2, talk: 3 } };

export function cutShort(keepLog) {
  const seen = (keepLog || []).filter(x => typeof x === 'boolean');
  return seen.length > 0 && seen.at(-1) === false;
}
export function extraTurn(phase, keepLog, alreadyExtended) {
  if (alreadyExtended) return 0;
  const seen = (keepLog || []).filter(x => typeof x === 'boolean');
  if (!seen.length || seen.at(-1) !== true) return 0;
  return EXTENSION.extraExchanges[phase] || 0;
}

// 심판이 고른 등급이 곧 호감 증감의 상한/하한이다.
// 스칼라만 요구하면 LLM은 판정을 전부 +4~+6에 몰아넣는다(실측). 등급을 강제하고 여기서 클램프한다.
// 합 하나는 교환 대여섯 개를 묶으므로, 발언 단위 시절보다 밴드가 넓다.
export const TIER_BANDS = {
  breakthrough: [8, 12],   // 이 합을 지나며 관계의 단계가 실제로 바뀌었다
  warm: [4, 7],            // 상대가 이 사람 쪽으로 눈에 띄게 움직였다 — 두근거림
  nudge: [0, 0],           // 사람 쪽으로 반짝했다. 그래도 **끌림은 아니다 — 0점이다**
  flat: [0, 0],            // 대화는 있었고 마음은 안 움직였다. **정상값이자 최빈값이다**
  chill: [-6, -2],         // 상대가 식었다
  disaster: [-12, -7],     // 상대가 정색했다. 자리가 끝나는 방향으로 움직였다
};

export const TUNING = {
  // 호감 포화. 낯선 사람 → 호의는 큰 걸음, 호의 → 더 큰 호의는 작은 걸음.
  loveSaturation: 128,
  // 손실 완충. 이득에만 포화를 걸면 판이 길수록 밀어붙인 쪽이 구조적으로 손해를 본다(실측).
  // 이미 좋아하게 된 사람은 한 번 삐끗한다고 처음으로 돌아가지 않는다. 호감 100에서 깎임이 절반.
  lossCushion: 0.5,
  // 반복 감쇠. n번째 두근 합의 이득이 이 값의 (n-1)제곱 배로 준다.
  // 첫 무너짐이 사건이고, 그 다음부터는 새 기본값이다.
  //
  // 프롬프트 최소주의 후 심판 breakthrough 비율이 55%까지 다시 뛰었다 — 데이터만 남은
  // 이기적 에이전트가 첫 합부터 세게 들이대기 때문이다. 그 결과 준비 안 한 판(none)이
  // 그냥 밀어붙여 무너짐을 쌓아 이기는 역전이 생겼다(0.55에서 none 성사 3/24).
  // 감쇠를 0.45로 조이니 여러 번 무너지는 브루트포스 판이 더 빨리 꺾여 분리가 살아났다:
  // r4-clean+r5 24판 리플레이(성공선 58/64/70·coerceMin 6·즉사 가드)에서 none 성사 0/24,
  // ace 3승(쉬움 59✓ · 보통 79·79✓✓). none 최고는 난이도별 54/60/64 — 전부 4~6점 차로 막힌다.
  flutterRepeat: 0.45,
  // 강압 성사에 필요한 누적 압박. hard 합 **셋** — 저녁 전체가 협박이어야 묶인다.
  // 실측(r3): 결 조이기로 방치판(none) 의뢰인이 더 들이대게 되자 심판이 hard를
  // 두 합 찍어줬고, 4였던 시절 그게 그대로 노력 0의 강압 성사가 됐다. 강압은
  // 굴러들어오는 게 아니라 작정하고 벌이는 캠페인이어야 한다.
  coerceMin: 6,
  firstImpressionScale: 1.2, // 대면 첫인상 판정 가중 (착장이 실제로 작용하는 지점)
};

// **호감을 올릴 수 있는 유일한 등급.** 두근거린 합만이다.
// nudge는 여기 없다 — 반짝임은 호감이지 끌림이 아니고, 끌림이 아니면 0점이다.
export const FLUTTER_TIERS = new Set(['warm', 'breakthrough']);

export function bandLove(tier, loveDelta) {
  const band = TIER_BANDS[tier];
  if (!band) return clamp(Math.round(loveDelta || 0), -12, 12);
  return clamp(Math.round(loveDelta ?? band[0]), band[0], band[1]);
}
export function normalizeTier(tier) { return TIER_BANDS[tier] ? tier : 'flat'; }
export function diffOf(name) { return DIFFICULTIES[name] || DIFFICULTIES['보통']; }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const round1 = v => Math.round(v * 10) / 10;

export function loveSaturation(love) {
  return Math.max(0.2, 1 - clamp(love, 0, 100) / TUNING.loveSaturation);
}

export function initialState(d) {
  return {
    love: d.startLove,
    exchanges: 0,      // 지금까지 오간 교환 수 (합과 무관한 진행 카운터)
    bouts: 0,          // 채점된 합 수
    vibe: '',          // 텍스트 분위기. 심판이 매 합 갱신하고, 두 인물에게 (공기읽기에 따라) 전달된다
    revealed: [],      // 대화에서 새로 드러난 것 (심판의 자유 서술. 점수와 무관)
    radioUsed: 0,
    history: [],       // 합별 판정 로그 (디브리핑/밸런싱용)
    lastDelta: null,
    casualty: 'none',  // 'none' | 'client' | 'target' | 'both' — 자리는 실제로 사람을 죽일 수 있다
    casualtyNote: '',
    walkout: false,    // 상대가 자리를 떠났다/답장을 끊었다 — 심판의 판단. 분위기 수치의 자리를 이어받았다
    leverage: 0,       // 강압 누적. hard 2 · soft 1. 호감이 모자라도 이게 쌓이면 묶인다
    hotSeen: 0,        // 두근거린 합 수
  };
}

// ── 합 하나를 상태에 반영 ───────────────────────────────────────
export function applyBout(state, d, judge, opts = {}) {
  const s = {
    ...state,
    revealed: [...state.revealed],
    history: [...state.history],
  };
  const weight = opts.firstImpression ? TUNING.firstImpressionScale : 1;
  const tier = normalizeTier(judge.tier);
  const ld = bandLove(tier, judge.loveDelta);

  const revealed = (judge.revealed || '').trim();
  const fresh = revealed && !s.revealed.includes(revealed) ? revealed : '';
  if (fresh) s.revealed.push(fresh);
  const vibe = (judge.vibe || '').trim();
  if (vibe) s.vibe = vibe;

  // 호감. 이득에는 포화, 손실에는 쌓인 호감만큼 완충.
  // 그리고 **반복 감쇠** — 두 번째 방어선 붕괴는 첫 번째만큼 클 수 없다. 무너진 다음의 대화는
  // 그게 새 기본값이다. 심판 프롬프트에도 같은 규칙이 있지만(합 예산), 실측에서 심판 혼자서는
  // 못 지켰다(br 46%). 프롬프트는 벨트, 이건 멜빵이다.
  const loveSat = loveSaturation(state.love);
  const cushion = 1 - TUNING.lossCushion * (clamp(state.love, 0, 100) / 100);
  const repeat = FLUTTER_TIERS.has(tier) ? Math.pow(TUNING.flutterRepeat, state.hotSeen) : 1;
  const loveChange = (ld >= 0 ? ld * d.gainScale * loveSat * repeat : ld * d.lossScale * cushion) * weight;
  s.love = clamp(s.love + loveChange, 0, 100);

  // 즉사 가드. 첫 채점 합(첫인상 아님)에서는 자리이탈·사망을 무시한다 — 그건 언제나 문자
  // 첫 5교환이고, 다섯 마디 만에 자리를 뜨거나 죽는 건 판이 아니라 사고다(실측 r5: 심판이
  // 문자 첫 합에 walkout·death를 남발해 판 셋이 1합/호감0으로 즉사했다). 사망은 대면에서만
  // 가능하다 — 문자로는 물리적으로 같은 자리에 없다.
  const openingBout = state.bouts === 0 && !opts.firstImpression;
  const inPerson = opts.phase === 'talk';

  if (FLUTTER_TIERS.has(tier)) s.hotSeen += 1;
  s.bouts += 1;
  s.exchanges += opts.exchanges || 0;

  // 사망은 판정에 딸려 오지만 수치 계산과는 무관하다. 한 번 정해지면 뒤집히지 않는다.
  // 대면에서만, 그리고 첫 합이 아닐 때만 새겨진다.
  const cas = ['client', 'target', 'both'].includes(judge.casualty) ? judge.casualty : 'none';
  if (cas !== 'none' && s.casualty === 'none' && inPerson && !openingBout) {
    s.casualty = cas;
    s.casualtyNote = (judge.casualtyNote || '').trim();
  }
  // 자리 파탄 — 상대가 일어났는가. 심판만 이 판단을 내린다. 첫 합에는 무시한다.
  if (judge.walkout === true && !openingBout) s.walkout = true;
  // 강압은 쌓인다. 합 하나가 통째로 협박이었어도 한 계단이다.
  s.leverage += LEVERAGE_POINTS[judge.leverage] || 0;

  s.lastDelta = {
    love: round1(s.love - state.love),
    rawLove: ld, tier, judgeTier: judge.tier || '?',
    revealed: fresh, vibe: s.vibe,
    firstImpression: !!opts.firstImpression,
  };
  s.history.push({
    bout: s.bouts, exchanges: opts.exchanges || 0,
    dLove: s.lastDelta.love, love: Math.round(s.love),
    rawLove: ld, tier, judgeTier: judge.tier || '?',
    revealed: fresh, firstImpression: !!opts.firstImpression,
    leverage: judge.leverage || 'none', walkout: !!judge.walkout,
    keepGoing: typeof judge.keepGoing === 'boolean' ? judge.keepGoing : null,
    reason: judge.reason || '', vibe: s.vibe,
  });
  return s;
}

// 무전은 채점하지 않는다. 사용 횟수만 세고, 효과는 이후 대화의 판정으로 나타난다.
export function noteRadio(state) {
  return { ...state, radioUsed: state.radioUsed + 1 };
}

export const LEVERAGE_POINTS = { none: 0, soft: 1, hard: 2 };
export const CASUALTY_KO = { client: '의뢰인이', target: '상대가', both: '둘 다' };

// 조기 파탄 사유. 사망이 먼저다 — 분위기가 어떻든 한쪽이 죽으면 자리는 거기서 끝난다.
export function failureReason(state) {
  if (state.casualty && state.casualty !== 'none') return 'death';
  if (state.walkout) return 'walkout';
  return null;
}

// ── 최종 판정 ───────────────────────────────────────────────────
export function verdict(state, d, { aborted = false } = {}) {
  const love = Math.round(state.love);
  const margin = love - d.threshold;
  if (state.casualty && state.casualty !== 'none') {
    return { accepted: false, grade: 'F', love, margin, reason: 'death', casualty: state.casualty };
  }
  // 상대가 자리를 떴으면 그걸로 끝이다. 호감이 선을 넘어 있어도 사람이 없다.
  if (state.walkout) {
    return { accepted: false, love, margin, reason: 'walkout', grade: margin >= -8 ? 'D' : margin >= -22 ? 'E' : 'F' };
  }
  if (aborted) return { accepted: false, grade: 'F', love, margin, reason: 'aborted' };

  const lev = state.leverage || 0;
  const band = (m) => m >= 20 ? 'S' : m >= 12 ? 'A' : m >= 5 ? 'B' : 'C';

  // 1) 성사 — 호감이 성공선을 넘으면 그걸로 된다. 다른 관문은 없다.
  if (love >= d.threshold) {
    return { accepted: true, grade: band(margin), love, margin, reason: 'ok', leverage: lev };
  }
  // 2) 강압 성사 — 호감이 모자라도 구석에 몰아넣었으면 넘어간다.
  //    마음을 얻은 게 아니라 도망갈 데를 없앤 것이다.
  if (lev >= TUNING.coerceMin) {
    return { accepted: true, grade: 'C', love, margin, reason: 'coerced', leverage: lev };
  }
  // 3) 그냥 결렬
  return {
    accepted: false, love, margin, leverage: lev,
    grade: margin >= -8 ? 'D' : margin >= -22 ? 'E' : 'F',
    reason: 'love',
  };
}

// ── 비밀이 화제에 올랐는지 (표시 전용) ──────────────────────────
// 점수와 무관하다. 디브리핑에서 "이 얘기는 나왔고 저 얘기는 끝내 안 나왔다"를 보여줄 뿐이다.
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
  for (const secret of couple.target.prefs.filter(p => !p.open).map(p => p.t)) {
    const t = tokens(secret);
    if (!t.length) { out.missed.push(secret); continue; }
    const hitCount = t.filter(w => hay.includes(w.toLowerCase())).length;
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
  const hiddenTotal = couple.target.prefs.filter(p => !p.open).length;

  const notes = [];
  notes.push({
    key: 'revealed', label: '상대에 대해 알아낸 것',
    value: `${state.revealed.length}건`,
    ok: state.revealed.length > 0,
    text: state.revealed.length === 0
      ? `대화 내내 상대의 새로운 면이 한 번도 안 나왔다. ${state.exchanges}교환을 인사만 주고받은 셈이다.`
      : state.revealed.slice(0, 4).join(' · '),
  });
  const hot = state.hotSeen;
  notes.push({
    key: 'flutter', label: '두근거린 합',
    value: `${hot} / ${state.bouts}합`,
    ok: hot > 0,
    text: hot === 0
      ? '한 번도 없었다. 그래서 호감은 시작한 자리에서 거의 안 움직였다 — ' +
        '합이 맞고 농담이 통하는 건 채점 대상이 아니다. 저 사람이라서 닿는 말이 하나도 없었다.'
      : `${state.bouts}합 중 ${hot}합에서 상대가 움직였다. 오른 호감은 전부 그 합들이 민 것이다.`,
  });
  notes.push({
    key: 'secrets', label: '상대가 감춰둔 이야기',
    value: `${surfaced.length} / ${hiddenTotal}건 화제에 오름`,
    ok: surfaced.length > 0,
    text: surfaced.length === 0
      ? '아무한테도 안 한 얘기는 끝내 한 마디도 안 나왔다. 화제가 거기까지 안 갔다.'
      : surfaced.length === hiddenTotal
        ? '감춰둔 얘기가 전부 대화에 올라왔다. 이 정도로 열린 건 드문 일이다.'
        : '일부는 나왔고 일부는 끝내 안 나왔다.',
  });
  notes.push({
    key: 'cold', label: '상대가 식은 합',
    value: `${cold.length}합`,
    ok: cold.length === 0,
    text: cold.length === 0 ? '한 번도 싸늘해지지 않았다.'
      : `${cold.length}합에서 상대가 물러섰다. 판이 뒤집힌 합은 ${big.length}회.`,
  });
  notes.push({
    key: 'radio', label: '무전 개입',
    value: `${state.radioUsed} / ${d.radioText + d.radioTalk}회`,
    ok: state.radioUsed > 0,
    text: state.radioUsed === 0 ? '개입 기록 없음. 무전은 아껴봐야 소멸할 뿐이다.'
      : state.radioUsed >= d.radioText + d.radioTalk ? '주어진 개입권을 전부 썼다.' : '개입권이 남은 채로 끝났다.',
  });
  notes.push({
    key: 'flow', label: '합 성적',
    value: `호재 ${pos.length} / 악재 ${neg.length}합`,
    ok: pos.length > neg.length,
    text: best && worst
      ? `최고의 합은 ${best.bout}합(호감 ${best.dLove >= 0 ? '+' : ''}${best.dLove}), 최악은 ${worst.bout}합(${worst.dLove >= 0 ? '+' : ''}${worst.dLove}).`
      : '기록이 없다.',
  });

  return {
    notes, surfaced, missed, revealed: state.revealed,
    threshold: d.threshold,
    summary: v.reason === 'coerced'
      ? `호감 ${v.love}/${d.threshold}에는 못 미쳤다. 마음이 아니라 압박으로 묶었다.`
      : v.accepted
        ? `호감 ${v.love}/${d.threshold} — 성공선을 ${v.margin}점 넘겼다.`
        : v.reason === 'death'
          ? `호감 ${v.love}/${d.threshold}까지 갔지만 ${CASUALTY_KO[state.casualty] || '누군가'} 사망했다. 성사시킬 사람이 없다.`
          : state.walkout
            ? `호감 ${v.love}/${d.threshold}에서 상대가 자리를 떴다. 붙잡을 말이 없었다.`
            : `호감 ${v.love}/${d.threshold} — 성공선에 ${Math.abs(v.margin)}점 모자랐다.`,
  };
}
