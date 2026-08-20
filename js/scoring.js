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
// ── 지시문 영문화 후 재계측 (40/47/54) ──────────────────────────
// 프롬프트 지시문을 전부 영어로 옮겼더니 **점수대가 통째로 내려앉았다.** 12판을 돌려 0판 성사.
// 원인은 난이도가 아니라 심판이었다. 판정의 63%가 nudge 한 칸에 몰렸다:
//
//   영문화 직후   breakthrough 3% · warm 23% · nudge 63% · flat 5% · chill 7% · disaster 0%
//
// nudge는 "아무 일도 없었다"가 아니라 **"절대 틀리지 않는 답"**이라서 기본값이 됐다.
// 분포 가드가 한쪽(인심 쓰지 마라)에만 걸려 있었던 게 원인이다. 양방향으로 바꿨다 —
// "절반 이상이 nudge면 그것도 채점이 아니라 판정 회피다. 틀릴 일 없는 등급은 정보가 없다."
//
//   가드 수정 후 breakthrough 4% · warm 31% · nudge 56% · flat 4% · chill 3% · disaster 1%
//   원판정 loveDelta 평균 2.47 → 2.83
//
// 그리고 프로필이 다시 갈렸다 (커플 3종 × 프로필 3종 = 9판, 판정 90건):
//
//              ace   good   none
//   쉬움        49     41     35
//   보통        54     44     33
//   헬          57     55     38
//
// 난이도별로 단조 분리가 살아났다. 남은 것은 성공선이 옛 판정기 기준이라는 것뿐이라
// 54/56/60 → **40/47/54**로 내렸다. ace의 여유가 쉬움 +9 · 보통 +7 · 헬 +3이 되도록 잡았다 —
// 숫자 자체는 헬이 더 높지만(gainScale 2.1), **여유가 가장 좁은 쪽이 헬**이라 난이도 사다리는 유지된다.
//
// 성공선을 내린 뒤 6판을 더 돌려 확인했다. nudge 비율 63% → 46%, flat과 chill이 살아났고
// 게임은 다시 이길 수 있다. ⚠ 다만 **판당 편차는 여전히 ±15점**이다 —
// 같은 커플·같은 프로필이 54였다가 65가 되고, 49였다가 36이 된다.
// 15판을 합치면 ace 4/6 · good 2/3 · none 1/6. "잘하면 성사"가 아니라 "잘하면 3분의 2쯤 성사"다.
// 위의 ⚠ 절과 같은 이유다 — 준비가 결과에 닿는 경로가 정보 비대칭 하나뿐이다.
//
// ── 지뢰선 투입 후 (성공선은 40/47/54 유지) ─────────────────────
// couples.js의 TRIPWIRE — 의뢰인의 조건반사가 상대의 지뢰를 반드시 밟게 만든 뒤 다시 쟀다.
// 성공선은 안 건드렸다. 대신 **프로필 격차가 처음으로 압도적이 됐다.**
//
//   짝지은 8판(판정 80건)   chill: 준비 전무 43% vs 숙련 8% · disaster 1건 vs 0건
//                          (지뢰선 이전 전 구간 실측 chill 3% · disaster 0~1%)
//
//              준비 전무        숙련 요원
//   보통           23              50   → 숙련만 성사
//   헬 (일반)     14, 22          64, 40  → 숙련이 넘는다
//   헬 (자동파멸) 3, 9, 20        35~48   → 양쪽 다 못 넘는다. 그게 설계다
//
// 준비 전무는 지뢰선 이후 9판에서 한 번도 성사하지 못했다. prank-funeral은 호감 3에서 끝났다.
// 「자동파멸」 3건은 숙련 요원도 못 넘긴다 — '거의 무조건 박살나는 관계'가 그 조합의 정의다.
// 성공선을 여기에 맞춰 더 내리지 않은 이유: 일반 헬은 숙련이 넘고 있다(politics 64/54).
// 자동파멸에 맞춰 내리면 나머지 스물한 건이 물러진다.
//
// ── 14턴 · 엔딩 4갈래 이후 재계측 (50/56/66) ────────────────────
// 턴을 9 → 14로 늘리니 호감이 통째로 올라왔다. 같은 커플·같은 프로필에서
// 쉬움 54 → 60~93, 보통 32~75 → 54~55, 헬 → 49~87.
// 성공선을 40/47/54 → **50/56/66**으로 올렸다. 대략 1.2배다 (턴은 1.56배지만 포화가 먹는다).
//
// (이 시점에는 장벽이 관문이었고 결렬의 대부분이 barrier였다. 지금은 아니다 —
//  아래 「대화 불능을 넣고, 장벽을 관문에서 뺐다」를 보라.)
//
// ── 판이 길어진 뒤의 재밸런싱 (60/72/78) ────────────────────────
// 라이브 18판(커플 3 × 프로필 3 × 2회)을 다시 재고 나서 알게 된 것:
//
//   **호감으로는 준비 수준이 안 갈린다.** 호감 분포가 ace 46~79 · good 38~92 · none 52~78로
//   완전히 겹친다. 유능한 에이전트 둘을 14~19턴 마주 앉히면 대화가 잘 굴러가고, 호감은
//   대화 품질을 재므로 결국 높게 끝난다. 프롬프트를 어느 쪽으로 조여도 이건 안 뒤집힌다 —
//   인물을 차갑게 만들면 무너질 방어선이 늘어나서 breakthrough가 오히려 더 나온다.
//
//   갈리는 건 **장벽**이다. 같은 18판에서 ace 3/3 처리 · good 0/3 · none 1/3.
//   의뢰인도 상대도 장벽을 모른다. 요원만 의뢰서에서 읽는다. 그래서 준비가 사는 자리는
//   "얼마나 좋아하게 만드는가"가 아니라 "앞을 막은 걸 꺼내게 만드는가"다.
//
// 그래서 성공선을 실측 중앙값 근처로 올렸다 — 호감을 장식이 아니라 진짜 관문으로 되돌린다.
// (당시엔 판을 끝내는 걸 장벽에 맡겼다. 그 역할은 뒤에 대화 불능으로 옮겼다.)
//
//   쉬움 50 → 66 · 보통 56 → 72 · 헬 66 → 76
//
// 27판(커플 3 × 프로필 3 × 3회) 실측 중앙값은 쉬움 72 · 보통 75 · 헬 66이었다.
// **호감은 난이도별로 안 갈린다.** gainScale 2.1이 헬의 가혹한 출발과 감쇠를 상쇄해서,
// 숫자만 보면 헬이 제일 안 어려워 보인다. 그러니 성공선으로 난이도를 표현하려 들면 안 된다 —
// 난이도는 이미 startLove·moodFloor·감쇠·lossScale과 조합 자체가 지고 있다.
// 성공선은 실측 중앙 구간에 놓고, 눈에 읽히도록만 완만하게 올린다.
//
// ── 서투름을 넣은 뒤 (60/66/70) ─────────────────────────────────
// 두 에이전트에게 「연애 경험 0」을 기본 전제로 깔고, 상대에게 상대를 싫어할 이유를 주고,
// 심판이 잘 굴러가는 대화를 warm으로 읽던 걸 조였다. 점수대가 통째로 25점쯤 내려앉았다.
//
//   chat-app  none 84 → 53      gapjil  none 60 → 62
//   chat-app  ace  85 → 61      gapjil  ace  62 → 14   (지침이 역효과를 낸 판)
//   chill 이하 비율 ace 8% → 27% · 감춰둔 얘기 유출 2~3/3 → 대부분 0~1/3
//
// 성공선을 그 분포에 맞춰 내렸다. 66/72/76 → **60/66/70**.
// 준비 전무가 호감으로 성공선을 넘는 판이 없어졌다.
//
// ⚠ ace 프로필의 편차가 이 국면에서 특히 크다(14 ~ 61). 요원 역할을 LLM이 맡는 구조라,
//    서투른 인물에게 무거운 지침을 첫 턴부터 물리면 오히려 다섯 턴을 얼려버린다.
//
// ── 대화 불능을 넣고, 장벽을 관문에서 뺐다 ───────────────────────
// 인물마다 '대화를 어떤 식으로 못 하는가'를 일곱 종으로 나눠 붙였다(couples.js WRECK).
// 단답은 ㅇㅇ·ㅇㅋ로 끝내고, 침묵은 '...'를 턴으로 쓰고, 폭주는 상대 자리를 안 남긴다.
// 여기에 "대충 하는 것도, 아예 안 하는 것도 선택지"라는 블록을 얹었다.
//
//   circadian  none  9 → 32   ace 93 → 68     orientation  none 9 → 4    ace 16 → 51
//   noise-vow  none 78 → 40   ace     → 71    taxidermy    none    1     ace       18
//   (none 0/3 · ace 2/3. 같은 조합에서 격차가 36~84점 난다)
//
// **그래서 장벽을 관문에서 뺐다.** 예전엔 장벽이 준비 수준을 가르는 유일한 축이었고,
// 그 대가로 「호감을 다 채우고도 차이는」 결말이 있었다. 지금은 대화 불능이 훨씬 크게 가른다.
// 장벽은 밀당의 대표 아젠다로 남는다 — 판을 제일 크게 흔드는 화제지만, 성사를 막지는 않는다.
// 마음이 충분하면 사람은 이런 걸 감수하기로 하고, 이 게임도 그렇게 친다.
//    사람 플레이어가 이보다 유리하다 — 계기판을 보고 무전 시점을 고를 수 있다.
//
// ── 그리고 상대의 want가 남은 원인이었다 ────────────────────────
// 서투름을 넣은 뒤에도 asmr·spice 두 조합만 79~94를 찍었다. 원한을 세게 다시 써도 안 고쳐졌다.
// 47건의 상대 want를 전수로 훑고 나서 알았다 —
// **상대가 원하는 것이 「이 사람하고 같이 뭘 한다」 꼴이면 자리를 뜰 이유가 없다.**
//
//   협력형 want  asmr 92/77 · spice 82/82
//   퇴장형 want  gapjil 14/62 · chat-app 61/53 · politics 46/46
//
// 둘 다 퇴장형으로 갈았다. sheets.test.mjs가 상대 want에 '같이'가 들어가는 걸 막는다.
//
//    재계측: ANTHROPIC_API_KEY=... node tests/live.mjs → node tests/sim.mjs <결과> --grid
export const DIFFICULTIES = {
  '쉬움': {
    key: 'easy', badge: '쉬움',
    textTurns: 6, talkTurns: 8,
    radioText: 1, radioTalk: 2,   // 기획서 규정: 문자 1회, 대면 2회
    startLove: 10, startMood: 55,
    threshold: 60, moodFloor: 25,
    loveDecay: 0.0,   // 턴마다 식는 호감
    moodDrift: 0.5,   // 턴마다 흐르는 분위기 (양수면 알아서 풀린다)
    gainScale: 4.5, lossScale: 1.45,
  },
  '보통': {
    key: 'normal', badge: '보통',
    textTurns: 6, talkTurns: 8,
    radioText: 1, radioTalk: 2,
    startLove: 6, startMood: 46,
    threshold: 66, moodFloor: 33,
    loveDecay: 0.3,
    moodDrift: -0.1,
    gainScale: 4.0, lossScale: 1.75,
  },
  '헬': {
    key: 'hell', badge: '헬',
    textTurns: 6, talkTurns: 8,
    radioText: 1, radioTalk: 2,
    startLove: 3, startMood: 38,
    threshold: 70, moodFloor: 40,
    loveDecay: 0.6,
    moodDrift: -0.7,
    gainScale: 3.6, lossScale: 2.00,
  },
};

// ── 자리가 길어지는 조건 ───────────────────────────────────────
// 대화가 잘 풀리면 사람은 안 일어난다. 케미가 뜨거우면 예정된 턴을 넘겨 더 앉아 있는다.
// 판정 등급이 곧 케미 계측기다 — 따로 지표를 만들지 않는다.
// 호감에는 포화가 걸려 있으므로 연장 턴의 한계 이득은 앞턴보다 작다. 그래서 상한만 막아두면 된다.
// 자리가 길어질지 짧아질지는 **모델이 정한다.**
// 예전엔 케미(최근 warm 개수 + 분위기)로 판단했는데, 그건 "잘 굴러가면 더 한다"라서
// 잡담이 길어지는 쪽으로만 작동했다. 지금은 심판이 매 턴 <keepGoing>을 답하고,
// 그 답이 연장과 조기 종료를 **양쪽 다** 굴린다.
export const EXTENSION = {
  maxExtra: { text: 2, talk: 3 },   // 페이즈별 최대 연장 턴
  minSeen: 2,                       // 최소 이만큼은 채점돼 있어야 판단한다
  // 조기 종료: 심판이 연달아 이만큼 "더 갈 데 없다"고 하면 페이즈를 끊는다.
  // 문자 페이즈를 더 짧게 잡는다 — 문자는 답장이 끊기면서 끝나는 게 자연스럽다.
  deadFor: { text: 2, talk: 3 },
};
// 판정은 한 턴 늦게 온다. 그래서 4턴짜리 문자 페이즈는 마지막 턴에서도 기록이 2개뿐이다 —
// window를 그대로 하한으로 쓰면 문자 페이즈는 영영 안 늘어난다. 하한은 minSeen이 따로 잡는다.

// 지금 한 턴 더 앉아 있을 이유가 있는가.
// d는 난이도 규격 — 시작 분위기를 알아야 '끌어올렸는지'를 판단할 수 있다.
// 한 턴 더 앉아 있을 이유가 있는가. **심판의 마지막 대답만 본다.**
export function extraTurn(phase, keepLog, alreadyExtra) {
  const cap = EXTENSION.maxExtra[phase] ?? 0;
  if (alreadyExtra >= cap) return false;
  const seen = (keepLog || []).filter(x => typeof x === 'boolean');
  if (seen.length < EXTENSION.minSeen) return false;   // 아직 볼 게 없으면 늘리지 않는다
  return seen.at(-1) === true;
}

// 지금 이 자리를 접어야 하는가. 심판이 연달아 "더 갈 데 없다"고 했을 때만이다.
// 할 말이 없으면 빨리 끝나는 게 맞다 — 특히 문자는 답장이 끊기면서 끝난다.
export function cutShort(phase, keepLog) {
  const need = EXTENSION.deadFor[phase] ?? 3;
  const seen = (keepLog || []).filter(x => typeof x === 'boolean');
  if (seen.length < need) return false;
  return seen.slice(-need).every(x => x === false);
}

// 심판이 고른 등급이 곧 호감 증감의 상한/하한이다.
// 스칼라만 요구하면 LLM은 판정을 전부 +4~+6에 몰아넣는다(실측). 등급을 강제하고 여기서 클램프한다.
// 등급의 정의는 전부 "상대가 실제로 어떻게 반응했는가"다. 목록 대조는 없다.
export const TIER_BANDS = {
  breakthrough: [7, 10],   // 상대가 실제로 무너졌다
  warm: [4, 6],            // 눈에 띄게 호의적으로 움직였다
  nudge: [0, 0],           // 사람 쪽으로 반짝했다. 그래도 **끌림은 아니다 — 0점이다**
  flat: [0, 0],            // 대화는 있었고 마음은 안 움직였다. **정상값이다**
  chill: [-5, -2],         // 상대가 식었다
  disaster: [-10, -6],     // 상대가 정색했다
};

// 난이도와 무관한 구조 상수.
export const TUNING = {
  // 분위기는 호감을 **막을 수만 있고 만들어낼 수는 없다.**
  // 예전 0.30~1.60배는 5.3배 폭이었고, 그건 "분위기가 좋았다"를 "사랑에 빠졌다"로 환산하는
  // 장치였다. 즐거운 잡담이 점수를 만들어내면 안 된다 — 회사 동료끼리도 즐겁게 얘기한다.
  // 이제 상한이 1.0이다. 험악한 방은 여전히 호감을 눌러 앉힌다(그건 실제로 그렇다).
  moodMultFloor: 0.60,       // 분위기 0일 때의 호감 배율
  moodMultSpan: 0.50,        // 분위기 80에서 1.0에 닿고, 그 위로는 안 올라간다
  moodMultCap: 1.0,          // 분위기로는 증폭되지 않는다
  firstImpressionScale: 1.4, // 대면 첫인상 판정만 가중된다 (착장이 실제로 작용하는 지점)
  moodSaturation: 130,       // 분위기가 높을수록 더 올리기 어렵다. 감소분에는 적용하지 않는다
  // 호감도 같은 원리로 포화한다. 낯선 사람 → 호의는 큰 걸음이지만, 호의 → 더 큰 호의는 작은 걸음이다.
  // 라이브 실측에서 심판이 좋은 대화에 계속 warm을 주는 바람에 두 판 다 100/100으로 천장을 쳤다.
  // 프롬프트로 등급 분포를 눌러도 한계가 있어서, 규칙 계층에도 브레이크를 뒀다.
  // 이건 '특정 워딩을 맞히면 가점' 같은 공략 대상이 아니라, 올라갈수록 무거워지는 저울이다.
  loveSaturation: 128,
  // 강압 성사에 필요한 누적 압박. hard 두 번 + soft 한 번쯤이면 사람이 묶인다.
  // 한 번의 협박으로 성사되면 무전 한 방짜리 게임이 된다.
  coerceMin: 5,
  // ── 호감은 두근거린 턴에서만 오른다 ────────────────────────
  // 한동안 「관문 40」을 뒀다 — 대화만으로는 40에서 막히고 그 위는 warm 이상만 미는 구조.
  // 그건 우회로였다. 규칙을 직접 쓰는 게 맞다: **두근두근이 아니면 증가량이 0이다.**
  // nudge도 flat도 0점이다. 잘 굴러간 대화에는 한 점도 안 붙는다.
  // chill·disaster는 그대로 깎는다. 호감은 0에서 바닥을 친다.
  //   gainScale  쉬움 4.5 · 보통 4.0 · 헬 3.6
  //
  // 이 셋은 **실측 12판의 판정 시퀀스를 그대로 재생해서** 고른 값이다(합성 가정이 아니다).
  // 라이브에서 판당 두근거림이 난이도별로 이렇게 갈렸다:
  //   쉬움 1.8회 · 보통 4.3회 · 헬 7.8회   ← 사다리가 뒤집혀 있었다
  // 헬 조합은 소재가 진해서 두근거림을 훨씬 많이 만든다. 그래서 헬은 배율을 내리고
  // 쉬움은 올려서, 각 난이도의 전형적인 판이 자기 성공선 근처에 오게 맞췄다.
  // 재생 결과 (성공선 60 / 66 / 70):
  //   쉬움  circadian none 53 · ace  5    asmr none 35 · ace 19
  //   보통  gapjil    none 54 · ace 67✓   vtuber none 39 · ace 92✓
  //   헬    politics  none 52 · ace 91✓   noise-vow none 81✓ · ace 71✓
  // lossScale은 그대로 뒀다. 안 그러면 chill이 상대적으로 무의미해진다.
  //
  // ⚠ circadian ace는 두근거림이 **0회**라 배율로는 못 고친다(0은 곱해도 0).
  //    독백 × 단답은 서로에게 닿을 통로가 없다. 조합 쪽 문제로 남아 있다.
  moodGainScale: 1.0,        // 분위기 이득 쪽 감쇠. 예전 0.75는 분위기가 아예 안 오르게 만들었다
  disasterMood: -5,          // 상대가 정색하면 자리가 식는다. 등급에서 나오는 결과지 별도 판정이 아니다
  breakthroughMood: 3,       // 반대로 방어선이 무너진 순간엔 공기도 같이 풀린다
};

// ── 무전 창 ─────────────────────────────────────────────────────────
// 개선안 여섯을 같은 판정 시퀀스로 재생해 비교했고(하이쿠 12판), 이게 이겼다.
//
//   radio    ace 96.5  none 52.7  격차 +43.8   ace 5/6 · none 2/6   ← 승자
//   ladder   ace 85.2  none 56.0       +29.2
//   variety  ace 80.3  none 52.7       +27.7
//   baseline ace 92.7  none 69.0       +23.7
//   arousal  ace 92.7  none 69.0       +23.7   (각성이 거의 안 쓰여 baseline과 동일)
//   redline  ace 79.3  none 57.0       +22.3
//   decay    ace 60.0  none 46.3       +13.7
//
// 왜 이게 제일 잘 가르는가: **무전은 순수한 실력 레버다.** 배급량이 정해져 있고
// (난이도별 3회), 언제 쓰느냐 말고는 아무것도 요원 마음대로가 아니다.
// 준비를 안 한 판은 무전을 아예 안 쓰므로 모든 두근거림이 창 밖에서 터진다.
// 입력칸에 무엇을 쳤는지는 여전히 안 본다 — 보는 건 **지시가 실제로 꽂혔는가**다.
const RADIO_WINDOW = {
  turns: 2,     // 지시가 꽂힌 발언과 그 다음 두 턴까지가 창 안이다
  inside: 1.5,
  outside: 0.7,
};

// 두근거림을 다섯 종류(각성·응답·밀당·신체·전환)로 가르고 종류마다 곡선을 달리 주는
// 구조를 한동안 뒀다. 이론 근거는 탄탄했지만 판정이 복잡해져서 걷어냈다.
// 지금 기준은 하나다 — **상대가 이 사람에게 끌렸는가.** 그것만 본다.

// **호감을 올릴 수 있는 유일한 등급.** 두근거린 턴만이다.
// nudge는 여기 없다 — 반짝임은 호감이지 끌림이 아니고, 끌림이 아니면 0점이다.
export const FLUTTER_TIERS = new Set(['warm', 'breakthrough']);

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
  const m = TUNING.moodMultFloor + (clamp(mood, 0, 100) / 100) * TUNING.moodMultSpan;
  return Math.min(TUNING.moodMultCap, m);
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
    // 사상자. 화산 분화구·고래 뱃속·칼을 든 상대 — 이 게임의 자리는 실제로 사람을 죽일 수 있다.
    // 'none' | 'client' | 'target' | 'both'
    casualty: 'none',
    casualtyNote: '',
    // 현실 장벽을 대화에서 실제로 다뤘는가. 한 번 다루면 계속 다뤄진 것으로 둔다.
    barrierCleared: false,
    // 강압 누적. hard 2점 · soft 1점. 호감이 모자라도 이게 쌓이면 묶인다.
    leverage: 0,
    // 무전 창 판정용. **실제로 벌어진 일만 본다** —
    // 요원이 입력칸에 무엇을 쳤는지는 규칙 계층이 절대 보지 않는다(그건 형식 보상이 된다).
    hotSeen: 0,        // 지금까지 셈된 두근거림 횟수
    sinceRadio: 99,    // 마지막 무전 주입 이후 몇 턴 지났나
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

  const hot = FLUTTER_TIERS.has(tier);

  // 무전 창. 지시가 꽂힌 발언과 그 직후 두 턴 안에서 터진 두근거림만 제값을 받는다.
  // 창 밖은 깎인다 — 저절로 굴러간 두근거림은 요원이 만든 게 아니다.
  const inWindow = s.sinceRadio <= RADIO_WINDOW.turns;
  const vMult = hot ? (inWindow ? RADIO_WINDOW.inside : RADIO_WINDOW.outside) : 1;
  if (hot) s.hotSeen += 1;
  s.sinceRadio = opts.radioInjected ? 0 : s.sinceRadio + 1;

  const scaled = (ld >= 0 ? ld * d.gainScale * loveSat * vMult : ld * d.lossScale) * weight;
  const loveChange = scaled * mult - d.loveDecay;

  s.mood = moodAfter;
  s.love = clamp(s.love + loveChange, 0, 100);
  s.turns += 1;

  // 사망은 판정에 딸려 오지만 수치 계산과는 무관하다. 한 번 정해지면 뒤집히지 않는다.
  const cas = ['client', 'target', 'both'].includes(judge.casualty) ? judge.casualty : 'none';
  if (cas !== 'none' && s.casualty === 'none') {
    s.casualty = cas;
    s.casualtyNote = (judge.casualtyNote || '').trim();
  }

  // 장벽은 한 번 다루면 다뤄진 것이다. 매 턴 다시 증명하게 하면 대화가 그 얘기만 하게 된다.
  if (judge.barrierAddressed === true) s.barrierCleared = true;
  // 강압은 쌓인다. 한 번의 협박으로 사람이 묶이지는 않는다.
  s.leverage += LEVERAGE_POINTS[judge.leverage] || 0;

  s.lastDelta = {
    mood: round1(s.mood - before.mood),
    love: round1(s.love - before.love),
    rawMood: md, rawLove: ld, tier, judgeTier: judge.tier || '?',
    mult: round1(mult), inRadioWindow: !!(hot && inWindow),
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
    inRadioWindow: !!(hot && inWindow),
    revealed: fresh, firstImpression: !!opts.firstImpression,
    // 장벽·압박은 이제 판을 끝내는 조건이다. 턴 기록에 안 남으면 사후에 왜 졌는지 못 짚는다.
    barrier: judge.barrierAddressed === true, leverage: judge.leverage || 'none',
    radioInjected: !!opts.radioInjected,
    reason: judge.reason || '', vibe: s.vibe,
  });
  return s;
}

// 무전은 채점하지 않는다. 사용 횟수만 세고, 효과는 다음 발언의 판정으로 나타난다.
export function noteRadio(state) {
  return { ...state, radioUsed: state.radioUsed + 1 };
}

// ── 조기 파탄 ───────────────────────────────────────────────────
// 사상자 표기. 디브리핑과 결과 화면이 같은 말을 쓰게 한 곳에 둔다.
// 강압의 무게. 한 번 세게 찌른 것(hard)이 두 번 slow-press(soft)와 같다.
export const LEVERAGE_POINTS = { none: 0, soft: 1, hard: 2 };

export const CASUALTY_KO = { client: '의뢰인이', target: '상대가', both: '둘 다' };

export function failureReason(state) {
  // 사망이 먼저다. 분위기가 아무리 좋아도 한쪽이 죽으면 그 자리는 거기서 끝난다.
  if (state.casualty && state.casualty !== 'none') return 'death';
  if (state.mood <= 0) return 'mood';   // 분위기 파탄. 상대가 자리를 뜬다
  return null;
}

// ── 최종 판정 ───────────────────────────────────────────────────
export function verdict(state, d, { aborted = false } = {}) {
  const love = Math.round(state.love), mood = Math.round(state.mood);
  const margin = love - d.threshold;
  // 사망은 무조건 F다. 호감이 성공선을 넘었어도 성사시킬 사람이 없다.
  if (state.casualty && state.casualty !== 'none') {
    return { accepted: false, grade: 'F', love, mood, margin, reason: 'death', casualty: state.casualty };
  }
  if (aborted) return { accepted: false, grade: 'F', love, mood, margin, reason: 'aborted' };

  const moodOk = mood >= d.moodFloor;
  const won = love >= d.threshold && moodOk;
  const lev = state.leverage || 0;

  const band = (m) => m >= 20 ? 'S' : m >= 12 ? 'A' : m >= 5 ? 'B' : 'C';

  // 1) 성사 — 호감이 성공선을 넘고 공기가 살아 있으면 그걸로 된다.
  //    **장벽은 여기서 아무것도 막지 않는다.** 호감으로 넘어가는 것이고, 그게 정상이다.
  //    (한동안 장벽이 관문이었다. 호감을 다 채우고도 차이는 결말이 있었고, 그게 판별력을
  //     담당했다. 지금 그 자리는 대화 불능이 맡는다 — 실측 격차가 훨씬 크다: 93 대 9.)
  if (won) {
    return { accepted: true, grade: band(margin), love, mood, margin, reason: 'ok', leverage: lev };
  }
  // 2) 강압 성사 — 호감이 모자라도 구석에 몰아넣었으면 넘어간다.
  //    마음을 얻은 게 아니라 도망갈 데를 없앤 것이다. 분위기 하한은 안 본다 —
  //    공기가 좋아서 묶인 게 아니기 때문이다.
  if (lev >= TUNING.coerceMin && mood > 0) {
    return { accepted: true, grade: 'C', love, mood, margin, reason: 'coerced', leverage: lev };
  }
  // 3) 그냥 결렬
  return {
    accepted: false, love, mood, margin, leverage: lev,
    grade: margin >= -8 ? 'D' : margin >= -22 ? 'E' : 'F',
    reason: moodOk ? 'love' : 'mood',
  };
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
      ? `대화 내내 상대의 새로운 면이 한 번도 안 나왔다. ${state.history.length}턴을 인사만 주고받은 셈이다.`
      : state.revealed.slice(0, 4).join(' · '),
  });
  // 장벽은 관문이 아니라 **밀당의 대표 아젠다**다. 성사 여부를 막지 않는다.
  // 다만 이 얘기가 테이블에 올라왔는지 아닌지는 그 판이 어디까지 갔는지를 말해준다.
  notes.push({
    key: 'barrier', label: '둘 사이의 현안',
    value: state.barrierCleared ? '대화에서 다뤄짐' : '끝내 안 나옴',
    ok: !!state.barrierCleared,
    text: state.barrierCleared
      ? `${couple.barrier} — 이 얘기가 실제로 테이블에 올라왔다. 여기까지 갔다는 뜻이다.`
      : `${couple.barrier} — 아무도 이 얘기를 꺼내지 않았다. 성사를 막지는 않지만, 그만큼 겉만 돌았다는 뜻이다.`,
  });
  // 두근거림 관문. 여기서 멈춘 판은 "못했다"가 아니라 "아무 일도 없었다"다.
  // 그 차이를 안 알려주면 플레이어는 게이지가 고장 났다고 생각한다.
  const hotTurns = state.history.filter(h => h.tier === 'warm' || h.tier === 'breakthrough');
  const hot = hotTurns.length;
  notes.push({
    key: 'flutter', label: '두근거린 순간',
    value: `${hot}회`,
    ok: hot > 0,
    text: hot === 0
      ? '한 번도 없었다. 그래서 호감은 시작한 자리에서 한 발짝도 안 움직였다 — ' +
        '합이 맞고 농담이 통하는 건 채점 대상이 아니다. 저 사람이라서 닿는 말이 하나도 없었다.'
      : `${hot}번 있었다. 오른 호감은 전부 이 순간들이 민 것이다. 나머지 턴은 한 점도 안 보탰다.`,
  });
  // 무전 창. 이게 이 게임에서 준비를 제일 잘 가르는 축이다 — 안 알려주면 숨겨둔 규칙이다.
  const onRadio = hotTurns.filter(h => h.inRadioWindow).length;
  notes.push({
    key: 'radiowindow', label: '무전 창에서 터진 두근거림',
    value: `${onRadio} / ${hot}회`,
    ok: hot > 0 && onRadio > hot / 2,
    text: hot === 0
      ? '두근거린 순간이 없었으니 무전 타이밍도 잴 게 없다.'
      : onRadio === 0
        ? '한 번도 없다. 두근거림이 전부 무전 밖에서 저절로 터졌고, 그건 제값의 70%만 친다. ' +
          '무전은 배급량이 정해져 있다 — 안 쓰면 그만큼 그냥 버리는 것이다.'
        : `${onRadio}번이 무전 직후 세 턴 안에서 터졌다. 그 턴들은 1.5배로 실렸고, 나머지 ${hot - onRadio}번은 0.7배다.`,
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
    summary: v.reason === 'coerced'
      ? `호감 ${v.love}/${d.threshold}에는 못 미쳤다. 마음이 아니라 압박으로 묶었다.`
      : v.accepted
        ? `호감 ${v.love}/${d.threshold} — 성공선을 ${v.margin}점 넘겼다.`
        : v.reason === 'death'
        ? `호감 ${v.love}/${d.threshold}까지 갔지만 ${CASUALTY_KO[state.casualty] || '누군가'} 사망했다. 성사시킬 사람이 없다.`
        : v.reason === 'mood'
          ? `호감 ${v.love}/${d.threshold}은 넘겼지만 분위기 ${v.mood}/${d.moodFloor}이 바닥이라 고백이 묻혔다.`
          : `호감 ${v.love}/${d.threshold} — 성공선에 ${Math.abs(v.margin)}점 모자랐다.`,
  };
}
