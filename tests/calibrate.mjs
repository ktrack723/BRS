// calibrate.mjs — 밸런싱 하네스. 값이 비싼 순서대로 아끼도록 짜여 있다.
//
//   ANTHROPIC_API_KEY=sk-... node tests/calibrate.mjs [옵션]
//     --couples=a,b,c   코퍼스에 쓸 커플 id (기본 6건)
//     --repeats=3       같은 구간을 몇 번 판정할지 (자기일관성 측정)
//     --budget=3        하드 상한($). 넘으면 그 자리에서 멈춘다
//     --stages=1,2,3,4  돌릴 단계
//     --corpus=path     코퍼스 캐시 (있으면 1단계를 건너뛴다)
//
// ── 왜 이렇게 나눴나 ─────────────────────────────────────
// 밸런싱에서 LLM이 실제로 필요한 것은 딱 둘이다.
//   ① 심판의 판정 분포   — ▲/▼/─ 가 어떤 비율로 나오는가
//   ② 후일담의 성사 곡선 — 러브 수치를 보고 성사를 언제 찍는가
// **산수 규칙(points.js) 자체는 LLM이 전혀 필요 없다.** ①만 있으면 무한히 돌릴 수 있다.
//
// 그리고 비용은 대사 생성 쪽에 몰려 있다 — 배우 둘이 줄마다 한 번씩, 구간당 여섯 번,
// 9구간을 돈다. 판정은 출력이 JSON 두 줄(30토큰)이라 거의 공짜다. 그래서:
//
//   1단계  대화 코퍼스를 **한 번만** 만든다 (비싼 쪽). 판정은 이때 호출하지 않고,
//          심판에게 갔을 (priorLog, segment)만 가로채 저장한다.
//   2단계  그 코퍼스 위에서 판정을 **여러 번** 돌린다 (싼 쪽). 같은 payload를
//          반복하므로 프롬프트 캐시가 그대로 먹는다.
//   3단계  같은 대화에 **러브 수치만 바꿔** 후일담을 부른다. 통제 실험이라
//          "C가 로그를 보고 정하는가 숫자를 보고 정하는가"가 그대로 드러난다.
//   4단계  ②의 분포로 오프라인 몬테카를로. 돈이 안 든다.

// ── 실측 기준선 (하이쿠 4.5 · 8커플 × 2프로필 × 9구간 × 3회 = 432표, 3회 측정) ──
//
// 「아무것도 안 한 판이 잘 굴러가면 안 된다」가 이 게임의 전제다. 세 번 재서 확인했다.
//
//                        무입력 러브▲   코칭 러브▲   격차      판정
//   1차 일괄 지침 코칭      40.7%        27.8%      -12.9pp   역전
//   2차 커플별 손글씨       44.4%        32.4%      -12.0pp   역전
//   3차 + 찐따 전제         11.1%        22.2%      +11.1pp   정상 ✅
//
// 1·2차의 역전은 코칭이 나빠서가 아니었다 (손글씨로 바꿔도 그대로였다). 대화 생성
// 프롬프트가 성공을 단정하고 있었던 것이다. 걷어낸 것 셋:
//   · 토킹 오프너의 "The texting got them into the same room" — 문자가 박살나도
//     상대가 만나기로 했다고 못박고 있었다. 페이즈별 러브 ▲가 이 지점에서 튀었다:
//     무입력 텍스팅 18.8% → 토킹 65.0%.  걷어낸 뒤 → 9.4% / 12.5%.
//   · "고객 wants this to work and it shows" — 고객이 적극적이라는 전제
//   · 코칭 없음 분기가 상태만 알리고 결과(실패)를 말하지 않던 것
// 그리고 「고객은 사회성이 떨어지고 상대를 못 읽는다」를 전제로 깔았다.
//
// 도장(60% 초과)도 사라졌다. 커플별 무입력 러브 ▲ 최고치: 88.9% → 33.3%.
//
// ── 남은 문제: 난이도가 너무 올라갔다 ──
// 3차 분포를 현행 상수(무드 5/10 · 러브 2/12)로 4만 판 돌린 결과:
//                  파탄     평균 구간   환산 평균   성사(문턱 70)
//   무입력         87.8%      6.6         16          0.1%   ← 의도대로 망한다
//   손글씨 코칭    43.7%      8.1         32          4.3%   ← 잘해도 못 이긴다
//
// 무드 ▼가 코칭 판에서도 62.5%다(무입력 81.9%).
//
// → 이 분포로 상수를 스윕해서 무드를 5/10에서 8/12로 올렸다. 후보 비교(문턱 70):
//                              무입력성사  코칭성사  배수   코칭파탄  hot체류
//     현행   무드5/10 러브12       0.1%      4.2%    42배    43.3%      1%
//     A      무드7/10 러브12       0.3%      6.4%    21배    13.6%     11%
//     B      무드5/10 러브8        1.4%     18.6%    13배    43.5%      1%
//     C ✅   무드8/12 러브12       0.3%      8.4%    28배     5.1%     23%
//     C++    무드8/12 러브10       2.0%     24.6%    12배     5.3%     45%
//
//   러브 눈금을 줄이는 쪽(B)은 무입력 성사를 14배로 밀어올리고(0.1→1.4%) 파탄을
//   전혀 안 고친다 — 판이 절반은 중간에 끊기니 실험이 안 된다. 무드 천장을 올리는
//   쪽(C)은 무입력을 0.3%에 붙여둔 채 코칭 판만 두 배로 올리고, 파탄이 5%로
//   내려가 아홉 구간이 다 돈다. 그리고 hot 체류가 1%→23%로 살아나 무드→러브
//   결합 규칙이 비로소 작동한다. 그래서 C를 택했다.
//   hot 문턱은 8이 최적이다 (9면 체류 11%, 10이면 3%로 밴드가 죽는다).
//
// ── 6~8차: 말투를 붙이면 심판이 그걸 사건으로 읽는다 ──
// 인물마다 말투를 붙이자 러브 ─ 기준선이 무너졌다. 세 번에 걸쳐 되돌린 기록이다.
//
//                          무입력▲  무입력─  코칭▲  코칭─  격차     무입력성사
//   3차 말투 없음            11.1%    73.6%   23.6%  69.4%  +12.5pp    0.8%
//   6차 만화 프리셋 10종     29.2%    37.5%   54.2%  33.3%  +25.0pp   25.8%  ⛔
//   7차 커플별 말투 47건     36.1%    50.0%   40.3%  56.9%   +4.2pp   21.2%  ⛔
//   8차 + 타겟 수동성        30.6%    56.9%   43.1%  52.8%  +12.5pp   12.8%
//
// 6차: 프리셋 열 개를 94명에게 나눠 붙이니 인물이 아니라 장르가 말했다. 말투가 세니
//      심판이 전부 사건으로 읽었다. 커플별 무입력 최고치 88.9% — 도장이다.
// 7차: 커플마다 손으로 쓰고 심판에 「말투가 세다고 ▲가 아니다」를 넣었다. 코칭 ▲가
//      54%→40%로 내렸지만, 결함이 타겟 쪽으로 옮겨갔다. 고객은 찐따가 됐는데 타겟
//      말투가 타겟을 능동적으로 만들어 알아서 마음을 열었다(cat-allergy 무입력 89%).
// 8차: 타겟 말투 14건을 닫는 방향으로 고치고 talkSystem에 타겟 수동성을 못박았다.
//      도장 소멸(55.6%), 무드가 코칭에 정방향 반응(+9.7pp), 격차 3차 수준 회복.
//
// 남은 것: 심판이 여전히 ▲를 과하게 준다 (코칭 43.1% / 건강선 20~35%). 그리고
// **이건 눈금으로 못 고친다** — 러브 최대치를 12에서 32까지 훑어도 무입력과 코칭이
// 같이 움직여서 배수가 3~16에 머문다(3차는 28). 눈금이 바꾸는 건 절대 수준뿐이다.
//   러브 0..12  무입력 12.8%  코칭 40.3%   러브 0..20  무입력 1.9%  코칭 11.3%  ← 채택
//   러브 0..24  무입력  0.5%  코칭  4.4%   러브 0..32  무입력 0.0%  코칭  0.5%
// 20을 골랐다. 무입력이 50판에 하나로 떨어지면서 코칭은 두 자릿수를 지킨다.
// 다음에 손댈 곳은 judgeSystem의 러브 정의다 — 눈금이 아니다.
//
// ── 9~11차: 심판 개조 통제 실험 — 세 변형 전부 기각, 구 심판 유지 ──
// 8차 코퍼스(144구간)를 고정하고 심판만 바꿔 재판정했다. 차이는 전부 심판 몫이다.
//
//              러브▲무입력  러브▲코칭  격차     위치비   비고
//   구 심판       30.6%      43.1%   12.5pp   1.80    현행 유지 ✅
//   v2 전면 재작성  38.9%      48.6%    9.7pp   1.39    WORLD 제거 + 델타 + 게이트
//   v3 구+전부 추가 30.6%      33.3%    2.7pp   1.58    코칭 ▲만 깎여 격차 붕괴
//   v4 구+델타만    34.7%      37.5%    2.8pp   1.56    〃
//
// 배운 것 셋.
// ① WORLD는 심판에게 하중을 받고 있었다. 「이들은 좋은 사람이 아니다」 프레임을 지우니
//    (v2) 심판이 기본값-로맨스로 읽어 ▲·무드▲가 오히려 올랐다. 단순화 가설 기각.
// ② 델타 규칙(「이미 지불된 온기는 다시 지불하지 않는다」)은 위치 편향을 실제로 줄인다
//    (1.80→1.39). 그러나 코칭의 성과는 설계상 후반에 몰리므로(공작안이 「마지막에
//    해라」로 짜여 있다) 후반 ▲ 억제는 코칭 신호부터 깎는다. 격차가 12.5→2.8pp로
//    무너졌다. 위치 편향의 상당 부분은 편향이 아니라 게임의 신호였다.
// ③ 무입력 ▲ 30%는 심판 문제가 아니라 텍스트에 실재한다. 구 심판의 무입력 ▲ 22건 중
//    20건을 v3 심판도 ▲로 봤다(두 심판 합의 91%). 표본을 읽어보면 무입력 판인데
//    타겟이 먼저 칵테일을 청하고(politics), 두유의 사연을 자백하고(vegan-butcher),
//    3년 전부터 알았다고 먼저 밝힌다(vtuber). 커플 데이터의 「사실 …」 비밀 항목이
//    B-1 프롬프트에 실려 있고, 생성이 그걸 무입력 판에서도 알아서 꺼내는 것이다.
//
// 다음 레버는 심판이 아니라 생성/데이터다: 타겟의 비밀 항목은 고객이 파내기 전에는
// 저절로 떠오르지 않는다는 규칙을 B-1에 박는 것. 심판은 현행 유지.
//
// ── 12차 + 검정력 분석: 이 하네스는 격차를 판정할 수 없다 ──
// 무호감 고정(B-1) 후 재측정. 대사는 눈에 띄게 바뀌었다 — 같은 장면에서 타겟이
// 먼저 라운지로 초대하던 것이 "우리가 뭐 하는 사이도 아닌데"로, 두유 비밀을 먼저
// 자백하던 것이 "(휴대폰을 꺼내 확인한다) 응."으로, 3년 비밀을 먼저 개봉하던 것이
// "저는 방송을 봤어요. 당신을 본 게 아니라."로 바뀌었다. 코칭 러브 ▲도 43.1%에서
// 31.9%로 내려와 건강선(20~35%)에 처음 들어왔다.
//
// 그런데 격차는 12.5pp에서 2.7pp로 보였다. 그래서 신뢰구간을 계산했다.
//
//   런    무입력▲   코칭▲    격차     95% CI
//   3차    8/72     17/72   12.5pp   [ 0, 25]
//   6차   21/72     39/72   25.0pp   [ 9, 41]
//   7차   26/72     29/72    4.2pp   [-12, 20]
//   8차   22/72     31/72   12.5pp   [ -3, 28]
//   12차  21/72     23/72    2.8pp   [-12, 18]
//
// **다섯 런의 신뢰구간이 전부 겹친다.** 8차(12.5pp)와 12차(2.8pp)의 차이는 z=0.88로
// 노이즈와 구분되지 않는다. 프로필당 n=72·반복 1회에서 한 셀의 CI는 ±11pp이고
// 두 셀 차이(격차)는 ±15.6pp다 — **격차가 16pp 이하로 다른 두 런은 이 설계로
// 구분할 수 없다.** 10pp 차이를 검정력 80%로 잡으려면 셀당 357구간이 필요하다.
//
// 그러므로 아래 결론들은 과잉 해석이었다. 취소한다:
//   · 「7차에서 격차가 붕괴했다」          → 구분 불가
//   · 「8차에서 격차가 3차 수준 회복」      → 구분 불가
//   · 「v3·v4가 구 심판보다 나쁘다」(9~11차) → 구분 불가. 심판 복원 자체는 무해하나
//                                            그 근거는 성립하지 않는다
// 반대로 노이즈 밖에서 살아남는 것들: 6차 만화 프리셋의 러브 ─ 붕괴(74%→38%, 36pp),
// 그리고 대사 자체의 변화(육안으로 확인되는 것).
//
// 격차를 실제로 판정하려면 커플 8건이 아니라 47건 전부를 돌려야 한다
// (94판 ≈ 코퍼스 $3.9 + 판정 $2.8 ≈ $6.7). 노이즈는 심판이 아니라 생성 쪽에 있으므로
// (심판 자기일관성 93~97%) 반복 횟수를 늘리는 것은 도움이 안 된다. 커플 수가 레버다.
//
// ── 15차: 초면 전제 — 세션 전체에서 처음으로 노이즈 밖의 개선 ──
// 반한 이유 폐지 + 통지서 지식 모델(이름·나이·성별·직업뿐) + 간직 부인 게이트를 얹고
// 전면 재측정했다.
//
//              러브▲     러브─    무드▼    비고
//   무입력       9.7%    84.7%    76.4%   ▲가 사상 처음 한 자릿수. ─가 기준선 회복
//   코칭        25.0%    73.6%    44.4%   건강선(20~35%) 안. 무드가 코칭에 32pp 반응
//
// 무입력 ▲ 29.2%→9.7%는 z=3.04로 유의미하다 — 이 하네스의 해상도(셀 ±11pp) 안에서도
// 실재하는 하락이다. 코칭 ▲는 z=0.93으로 유지. 도장(커플별 무입력 최고)도 67%→33%.
// 8커플 비밀 유출(무입력): 합계 3건, 전부 자기 공개(활동명)거나 자기 습관 언급.
//
// 사전 감정은 프롬프트가 아니라 데이터에 있었다는 것이 최종 결론이다. 반한 이유와
// 상대-참조 취향 행이 「이미 시작된 로맨스」를 실어 날랐고, 그것을 지운 뒤에야
// 「아무것도 안 하면 아무 일도 없다」가 성립했다.
//
// 이 분포로 러브 눈금을 되돌렸다(20→12): 무입력 성사 0.3% · 코칭 13.5%(문턱 70),
// 문턱 60이면 0.7% · 20.1%. 20을 유지하면 코칭도 1.8%라 이길 수 없는 게임이 된다.
//
// ── 16차: 프롬프트 압축 — 지시를 줄여도 판정이 그대로인가 ──
// B-1에서 중복만 걷어냈다(초면 블록 둘 → 하나, 실패 양상 11 → 8, 「누가 먼저 움직였나」
// 이중 기재 정리, 무전·현장 블록 압축). 심판(B-2)은 **한 글자도 안 건드렸다** — 12~14차에
// 세 번 손대서 세 번 다 못 얻었고, 그게 이 하네스가 남긴 유일한 확정 사실이다.
// 지시문 8,650자 → 7,300자(-16%), 판 전체 시스템 프롬프트 40.2k → 37.6k자.
//
//              러브▲     러브─    무드▼    비고
//   무입력       4.2%    84.7%    59.7%   ─가 기준선과 같다. ▲는 15차(9.7%)보다 낮다
//   코칭        22.2%    75.0%    43.1%   건강선(20~35%) 안. 15차 25.0%와 동일 수준
//
// 무입력 ▲ 9.7%→4.2%는 z=1.3, 코칭 ▲ 25.0%→22.2%는 z=0.4 — 둘 다 노이즈 안이다.
// 즉 **압축으로 잃은 것이 없다**(얻은 것도 측정되지 않는다). 격차는 15.3pp → 18.0pp.
// 커플별 무입력 최고치 33%→22%로 도장도 없다. 8커플 × 2프로필 × 9구간 × 1회, $0.98.
//
// 반복을 1회로 줄인 이유: 노이즈는 생성 쪽에 있고 심판 자기일관성은 93~97%다.
// 같은 코퍼스를 세 번 재판정해도 셀 신뢰구간(±11pp)이 줄지 않는다 — 커플 수만이 레버다.
//
// ── 17차: 배우를 둘로 가르다 — 서로의 시트를 구조적으로 못 보게 ──
// 한 호출이 양쪽 대사를 다 쓰던 것을 **줄마다 한 번씩, 배우 둘**로 갈랐다. 고객 회선에는
// 타겟 시트가 한 글자도 없고 그 반대도 같다. 상대에 대해 아는 것은 통지서 한 줄 + 오간 말 +
// 눈에 보이는 것뿐이다. 옛 구조는 「상대 시트를 못 본 척하라」는 지시로만 막고 있었다.
//
//              러브▲     러브▼    러브─    무드▲    무드▼
//   무입력       5.6%     0.0%    94.4%    20.8%    43.1%
//   코칭        14.1%     1.4%    84.5%    16.9%    33.8%
//
// 16차 대비: 무입력 ▲ 4.2→5.6%(z=0.35, 유지), 코칭 ▲ 22.2→14.1%(z=1.27).
// 셀 신뢰구간(±11pp) 안이라 「유의미한 하락」이라고 말할 수는 없지만, 방향은 하락이고
// 격차는 18.0pp → 8.5pp로 줄었다. 원인은 구조적으로 설명된다 — 옛 구조에서는 한 명의
// 작가가 양쪽 시트를 다 보고 썼으므로 코칭이 노린 지점에 타겟을 **맞춰줄** 수 있었다.
// 지금은 타겟 배우가 고객이 뭘 노리는지 모른다. 코칭은 고객이 실제로 입 밖에 낸 말을
// 통해서만 먹힌다. 「먹히기 어려워진 것」이 아니라 「공짜로 먹히던 것이 사라진 것」이다.
//
// 부수 효과 둘:
//   · 무드가 덜 깨진다 (▼ 59.7→43.1% 무입력). 한 작가가 파국으로 몰아가던 힘이 없어졌다.
//   · 러브 ▼가 거의 사라졌다 (11.1→0.0% 무입력). 타겟이 「닫는」 판정이 안 나온다.
// 둘 다 다음 조정 대상이다. 코칭 ▲를 건강선(20~35%)으로 되돌리려면 러브 눈금이나
// 러브 ▲ 폭을 만지는 쪽이 먼저다 — 프롬프트를 다시 부풀리는 것은 15·16차의 반복이다.
//
// 값: 생성 호출이 구간당 1 → 6으로 늘어 코퍼스가 $0.53 → $3.01 (16판 기준, 약 6배).
// 판정 쪽은 그대로다. 캐시 적중은 살아 있다(회선마다 접두사가 단조 증가).
//
// ── 18차: 재밸런싱 (오프라인 스윕 · 새 호출 0건) ──
// 17차 분포를 그대로 놓고 산수 상수만 4만 판씩 스윕했다. LLM은 한 번도 안 불렀다.
//
// 판정 하나가 성사에 얼마나 기여하는지는 최대치가 아니라 **성사선까지 벌어야 하는 칸수**로
// 정해진다: ceil(0.7 × loveMax) − loveStart.
//
//   벌 칸수   상수        무입력 성사(70/60)   코칭 성사(70/60)   배수
//     7칸    2 → 12       0.6% / 1.0%          6.3% / 9.8%       11배   ← 현행. 못 이긴다
//     6칸    1 → 10 ✅     1.0% / 2.2%         10.0% / 14.1%     10배
//     5칸    2 → 10       2.2% / 6.4%         14.3% / 26.3%       6배   ← 무입력이 붙는다
//
// 연속 보너스를 키우는 쪽(streak [0,0,2,3] 등)은 거의 아무것도 안 했다 — 코칭 6.3 → 7.3%.
// ▲가 14%까지 내려가면 2연속 자체가 거의 안 생겨서(판당 0.16회) 규칙 ②가 사실상 잠든다.
// ▲ 한 번의 기본값을 2로 올리면 코칭 11.2%까지 가지만, 그건 ▼(1칸)와의 대칭을 깨고
// 「우연한 한 방」과 「쌓인 한 방」의 차이도 지운다. 그래서 눈금만 옮겼다.
//
// 무드(8/12 · hot 8)는 안 건드렸다 — 달아오름 밴드 체류 43%, 코칭 판 파탄 0.1%로 건강하다.
// (배우를 가른 뒤 무드 ▼가 크게 줄어 파탄이 사실상 사라졌다. 자리가 안 깨지는 것 자체는
//  실험을 굴리기에는 좋지만, 「무드가 0이면 끝난다」는 규칙의 존재감은 옅어졌다 — 다음 관찰 대상.)
//
// ⚠ 하이쿠 실측치다. 절대 점수는 모델마다 다르다 (tests/test-model.mjs 참고).
//    여기서 유효한 것은 같은 조건에서의 전후 비교다.

import { LlmClient } from '../js/llm.js';
import { Engine, dressOf } from '../js/engine.js';
import { COUPLES, COUPLE_BY_ID } from '../js/couples.js';
import * as P from '../js/prompts.js';
import { POINTS, PHASES, TOTAL_BEATS, applyVerdict, initialPoints, isBroken, loveOutOf100 } from '../js/points.js';
import { requireTestKey, resolveTestModel } from './test-model.mjs';
import { HAND_ORDERS, HAND_COUPLE_IDS } from './coaching-profiles.mjs';
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--'))
  .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || 'true']; }));

const KEY = requireTestKey();
const MODEL = resolveTestModel(args.model, process.argv, KEY);
const REPEATS = Number(args.repeats || 3);
const BUDGET = Number(args.budget || 3);
const STAGES = new Set((args.stages || '1,2,3,4').split(','));
const CONC = Number(args.concurrency || 6);
const CURVE_N = Number(args['curve-n'] || 6);
const CORPUS = args.corpus || '/tmp/claude-0/calibrate-corpus.json';
const OUT = args.out || '/tmp/claude-0/calibrate-result.json';
const DEFAULT_COUPLES = HAND_COUPLE_IDS;
const COUPLE_IDS = (args.couples ? args.couples.split(',') : DEFAULT_COUPLES).filter(id => COUPLE_BY_ID[id]);

// 키를 먼저 넣어야 업자가 정해진다. 모델은 그 뒤에 얹는다 (setter가 안 맞는 모델을 갈아 끼운다).
const llm = new LlmClient();
llm.apiKey = KEY;
llm.model = MODEL;
const money = () => llm.usage.cost;
const fmt = n => '$' + n.toFixed(4);

/** 하드 상한. 예산은 지키라고 있는 것이지 참고하라고 있는 게 아니다. */
class BudgetOut extends Error {}
function checkBudget(where) {
  if (money() >= BUDGET) throw new BudgetOut(`예산 ${fmt(BUDGET)} 소진 (${where}, 현재 ${fmt(money())})`);
}

/** 동시 실행 풀. 순차로 돌리면 코퍼스 한 벌에 30분이 넘는다. */
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

// 프로필 둘. 「일괄 지침 vs 없음」을 비교하면 아무것도 안 나온다 — 요원이 시트를 실제로
// 읽고 짠 공작안이라야 코칭이 뭘 하는지가 보인다. hand는 커플별 손글씨다 (coaching-profiles.mjs).
const EMPTY = { styling: '', motivation: '', coaching: '' };
const PROFILES = {
  none: c => EMPTY,
  hand: c => HAND_ORDERS[c.id] || EMPTY,
};

// ── 1단계. 대화 코퍼스 ───────────────────────────────────
// 진짜 Engine을 그대로 돌린다. 판정만 가로채서 API를 안 태우고, 심판에게 갔을
// payload를 기록한다 — 대화 생성은 무드·러브를 전혀 안 보므로(talkSystem 참고)
// 판정을 굶겨도 나오는 대화는 실제 판과 같은 분포다 (배우 둘 다 무드·러브를 전혀 안 본다).
async function buildCorpus() {
  const jobs = COUPLE_IDS.flatMap(id => Object.keys(PROFILES).map(p => ({ id, p })));
  let done = 0;
  const per = await pool(jobs, CONC, async ({ id, p }) => {
    checkBudget('코퍼스');
    const c = COUPLE_BY_ID[id];
    const orders = PROFILES[p](c);
    const beats = [];
    // A. 미용실(외모)과 취조실(성격)을 실제로 돌린다. 둘은 서로를 모르는 별개 호출이다.
    // 주문이 없는 쪽은 부르지 않는다 — 테이블 값이 그대로 시트가 된다.
    const [salon, booth] = await Promise.all([
      orders.styling ? llm.call({
        label: `미용실 ${id}/${p}`, system: P.STYLING_SYSTEM, cache: true,
        messages: [{ role: 'user', content: P.stylingUser(c, c.client.spec || { species: 'human' }, orders.styling) }],
        schema: P.STYLING_SCHEMA, effort: 'low', maxTokens: 4000,
      }).catch(() => null) : null,
      orders.motivation ? llm.call({
        label: `취조실 ${id}/${p}`, system: P.MOTIVATION_SYSTEM, cache: true,
        messages: [{ role: 'user', content: P.motivationUser(c, orders.motivation) }],
        schema: P.MOTIVATION_SCHEMA, effort: 'low', maxTokens: 2000,
      }).catch(() => null) : null,
    ]);
    const dressed = dressOf(c.client, { look: salon?.look, personality: booth?.personality });
    // 판정만 가로채는 대역. 대사 생성은 그대로 API로 나간다.
    const spy = {
      usage: llm.usage,
      async call(a) {
        if (a.label.includes('판정')) {
          beats.push({ couple: id, profile: p, label: a.label, user: a.messages[0].content });
          return { mood: 'same', love: 'same' };
        }
        return llm.call(a);
      },
    };
    const e = new Engine(spy, { couple: c, dressed, coaching: orders.coaching, handlers: {} });
    await e.run().catch(() => {});
    // 판정·후일담이 볼 고객 시트. 프로필마다 다르므로 구간마다 같이 저장한다.
    for (const b of beats) b.dressed = dressed;
    console.log(`  [${++done}/${jobs.length}] ${id.padEnd(16)} ${p.padEnd(5)} 구간 ${beats.length}  누적 ${fmt(money())}`);
    return beats;
  });
  return per.flat();
}

// ── 2단계. 판정 반복 ─────────────────────────────────────
async function judgeCorpus(beats) {
  let done = 0;
  const rows = await pool(beats, CONC, async (b) => {
    const c = COUPLE_BY_ID[b.couple];
    const sys = P.judgeSystem(c, b.dressed || dressOf(c.client, null));
    const votes = [];
    // 같은 payload를 REPEATS번 반복한다 — 2회차부터는 프롬프트 캐시가 그대로 먹는다.
    for (let r = 0; r < REPEATS; r++) {
      checkBudget('판정');
      const v = await llm.call({
        label: `판정 ${b.couple}/${b.profile} r${r}`, system: sys, cache: true,
        messages: [{ role: 'user', content: b.user }],
        schema: P.JUDGE_SCHEMA, effort: 'low', maxTokens: 2000,
      }).catch(() => null);
      if (v) votes.push(v);
    }
    if (++done % 12 === 0) console.log(`  판정 ${done}/${beats.length}  누적 ${fmt(money())}`);
    return votes.length ? { couple: b.couple, profile: b.profile, beat: b.label, votes } : null;
  });
  return rows.filter(Boolean);
}

// ── 3단계. 성사 곡선 (통제 실험) ─────────────────────────
// 같은 대화 전문에 러브 수치만 갈아 끼운다. C가 숫자를 보는지 로그를 보는지 갈린다.
const LOVE_GRID = [10, 30, 50, 70, 90];
async function successCurve(transcripts) {
  const jobs = transcripts.flatMap(t => LOVE_GRID.map(love => ({ t, love })));
  let done = 0;
  const out = await pool(jobs, CONC, async ({ t, love }) => {
    checkBudget('후일담');
    const c = COUPLE_BY_ID[t.couple];
    const r = await llm.call({
      label: `후일담 ${t.couple}/${t.profile} love=${love}`,
      system: P.epilogueSystem(c, t.dressed || dressOf(c.client, null)), cache: true,
      messages: [{ role: 'user', content: P.epilogueUser(c, love, t.transcript) }],
      schema: P.EPILOGUE_SCHEMA, effort: 'medium', maxTokens: 4000,
    }).catch(() => null);
    if (++done % 10 === 0) console.log(`  후일담 ${done}/${jobs.length}  누적 ${fmt(money())}`);
    return r ? { couple: t.couple, profile: t.profile, love, success: !!r.success } : null;
  });
  return out.filter(Boolean);
}

// ── 4단계. 오프라인 몬테카를로 (무료) ────────────────────
// 2단계에서 잰 실측 분포로 판을 몇만 번 리샘플링한다. 산수 규칙은 LLM이 필요 없다.
function offlineSweep(dist, n = 20000) {
  const pick = d => { const r = Math.random(); return r < d.up ? 'up' : r < d.up + d.down ? 'down' : 'same'; };
  const loves = [], moods = []; let broke = 0;
  for (let i = 0; i < n; i++) {
    let s = initialPoints();
    outer: for (const ph of PHASES) {
      for (let b = 0; b < ph.beats; b++) {
        if (isBroken(s)) break outer;
        s = applyVerdict(s, { mood: pick(dist.mood), love: pick(dist.love) }, { phase: ph.key });
      }
    }
    loves.push(s.love); moods.push(s.mood); if (s.broken) broke++;
  }
  const sorted = [...loves].sort((a, b) => a - b);
  const q = p => sorted[Math.floor(p * (sorted.length - 1))];
  return {
    n, loveMean: +(loves.reduce((a, b) => a + b, 0) / n).toFixed(2),
    loveP10: q(0.1), loveMedian: q(0.5), loveP90: q(0.9), loveMax: sorted.at(-1),
    readingMean: Math.round(loveOutOf100(loves.reduce((a, b) => a + b, 0) / n)),
    moodMean: +(moods.reduce((a, b) => a + b, 0) / n).toFixed(2),
    brokenPct: +(broke / n * 100).toFixed(1),
    capPct: +(loves.filter(v => v >= POINTS.loveMax).length / n * 100).toFixed(1),
  };
}

// ── 본체 ─────────────────────────────────────────────────
const result = { model: MODEL, couples: COUPLE_IDS, repeats: REPEATS };
try {
  let corpus = null;
  if (STAGES.has('1')) {
    console.log(`\n① 대화 코퍼스 — ${COUPLE_IDS.length}커플 × ${Object.keys(PROFILES).length}프로필 (판정은 API를 안 탄다)`);
    corpus = await buildCorpus();
    fs.writeFileSync(CORPUS, JSON.stringify(corpus));
    console.log(`  구간 ${corpus.length}개 저장 → ${CORPUS}   여기까지 ${fmt(money())}`);
  } else if (fs.existsSync(CORPUS)) {
    corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
    console.log(`\n① 코퍼스 재사용 — 구간 ${corpus.length}개`);
  }

  if (STAGES.has('2') && corpus) {
    console.log(`\n② 판정 — 구간 ${corpus.length}개 × ${REPEATS}회`);
    const spent = money();
    result.judged = await judgeCorpus(corpus);
    result.judgeCost = +(money() - spent).toFixed(4);
  }

  if (STAGES.has('3') && corpus) {
    // 코퍼스 구간 중 각 판의 마지막 것 = 대화 전문이 가장 긴 것 (priorLog + segment)
    const last = new Map();
    for (const b of corpus) last.set(`${b.couple}/${b.profile}`, b);
    // judgeUser는 [지금까지] + [이번에 새로] 두 토막이다. 마지막 구간까지 실으려면 둘을 붙여야 한다.
    const ts = [...last.values()].slice(0, CURVE_N).map(b => {
      const [head, tail = ''] = b.user.split('[이번에 새로 오간 부분 — 이것만 판정한다]');
      const prior = head.replace(/^\[지금까지의 대화[^\]]*\]\n/, '').trim();
      const seg = tail.split('Read the new stretch')[0].trim();
      return { couple: b.couple, profile: b.profile, dressed: b.dressed, transcript: `${prior}\n${seg}`.trim() };
    });
    console.log(`\n③ 성사 곡선 — 대화 ${ts.length}건 × 러브 ${LOVE_GRID.join('/')}`);
    const spent = money();
    result.curve = await successCurve(ts);
    result.curveCost = +(money() - spent).toFixed(4);
  }
} catch (e) {
  if (e instanceof BudgetOut) console.log(`\n⛔ ${e.message}`);
  else throw e;
}

// ── 집계 ─────────────────────────────────────────────────
if (result.judged?.length) {
  const flat = result.judged.flatMap(r => r.votes);
  const rate = (arr, k, v) => +(arr.filter(x => x[k] === v).length / arr.length).toFixed(3);
  result.dist = {
    love: { up: rate(flat, 'love', 'up'), down: rate(flat, 'love', 'down'), same: rate(flat, 'love', 'same') },
    mood: { up: rate(flat, 'mood', 'up'), down: rate(flat, 'mood', 'down'), same: rate(flat, 'mood', 'same') },
  };
  // 프로필별 러브 ▲ 비율 — none이 good보다 낮아야 게임이 성립한다
  result.byProfile = {};
  for (const p of Object.keys(PROFILES)) {
    const v = result.judged.filter(r => r.profile === p).flatMap(r => r.votes);
    if (v.length) result.byProfile[p] = { n: v.length, loveUp: rate(v, 'love', 'up'), moodUp: rate(v, 'mood', 'up') };
  }
  // 자기일관성 — 같은 구간을 몇 %나 같게 보는가 (최빈값 비율)
  const agree = key => {
    const rs = result.judged.filter(r => r.votes.length > 1);
    if (!rs.length) return null;
    return +(rs.reduce((acc, r) => {
      const cnt = {}; for (const v of r.votes) cnt[v[key]] = (cnt[v[key]] || 0) + 1;
      return acc + Math.max(...Object.values(cnt)) / r.votes.length;
    }, 0) / rs.length).toFixed(3);
  };
  result.selfAgreement = { love: agree('love'), mood: agree('mood') };
  result.offline = offlineSweep(result.dist);
}
result.usage = { ...llm.usage, cost: +llm.usage.cost.toFixed(4) };
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`\n💰 총 ${fmt(money())}  (호출 ${llm.usage.calls} · 입력 ${llm.usage.inputTokens} · 출력 ${llm.usage.outputTokens} · 캐시읽기 ${llm.usage.cacheRead})`);
console.log(`   결과 → ${OUT}`);
