// couples.js — 큐피드국 상설 의뢰 대장. 전부 손으로 쓴 고정 데이터다.
// LLM은 이 사람들을 "연기"할 뿐, 만들어내지 않는다. 매칭이 성립할 리 없는 조합만 골라 넣었다.
//
// ── 인물 스키마 — 이것이 전부다 ─────────────────────────────────
// 양쪽 인물은 **완전히 동일한 카테고리**의 속성을 가진다. 의뢰인만 갖거나 상대만 갖는 축은 없다.
// 대화 생성에서 두 사람의 차이는 단 셋 — 의뢰인은 취조실에서 들은 지침, 나갈 때 들은 연설,
// 그리고 무전이 들린다는 것뿐이다. 그 외 정보 구조는 동일하다 (서로에 대한 정보 제외).
//
//   name / gender     이름 · 성별
//   look[]            외모
//   history[]         내력 — 첫 줄이 나이·직업, 나머지가 살아온 자리
//   personality[]     성격
//   keys{}            특별 키워드 — 기계적으로 작동하는 축. 전부 실제로 작동한다.
//     interest        상대관심 'self'|'mixed'|'other' — 상대에 대해 받는 정보량을 깎는다
//     air             공기읽기 'none'|'some'|'well' — 공기(텍스트)가 이 사람에게 닿는 빈도
//     comply          명령수용 'obeys'|'argues'|'drifts' — 지침을 받아들이는 결 (지침이 없으면 잠복)
//     wreck{kind,line} 어긋남 — 이 사람이 대화를 못 하는 방식
//     (조건반사는 폐지했다 — "가만두면 이 버릇이 나온다"는 흐름 지시라서.
//      버릇은 성향·성격·어긋남 데이터에서 그때그때 알아서 나온다.)
//   prefs[]           성향 — {t, open, neg?}. 공개(open)와 미공개가 섞인다. neg는 닿으면 식는 쪽.
//                     **의뢰인 성향은 플레이어에게 전부 보인다.** 상대 성향은 공개분만.
//   spec              3D 아바타 조형 (정보가 아니라 렌더링)
//
// 커플 레벨은 relation 하나다 — 둘이 어떻게 만났고 지금 무엇이 얹혀 있는가(대표 아젠다).
// 장벽·성향충돌·서로에 대한 견해 같은 별도 축은 전부 이 안으로 접었다.
// 아젠다는 관문이 아니다. 밀당에서 제일 무거운 화제일 뿐, 성사는 호감이 결정한다.

const S = (o) => o; // 그냥 가독성용 마커

export const COUPLES = [
  {
    id: "politics", difficulty: "헬", category: "정치", winWord: "초당적 커플 성사",
    relation: "30년째 서로를 공개 석상에서 인격 말살해온 정적(政敵). 국정감사장에서 11시간을 마주 보고 고성을 질렀다. 지금 얹힌 현안: 한쪽은 5선 강경 야당 의원, 한쪽은 여당 최대 후원자인 건설 재벌이다. 사귀는 순간 양쪽 다 정치 생명이 끝난다.",
    client: {
      name: "표한나", gender: "여",
      look: ["검은 각단발","각진 회색 정장","중년","눈빛에 고소장 3건"],
      history: [
        "62세 · 5선 야당 의원 / 국정감사 최다 발언 기록 보유자",
        "재래시장통에서 자랐다. 스트레스받으면 시장 상인 억양이 튀어나온다",
        "자택 지하에 개인 문서고. 30년치 국감 자료를 종이로 쌓아둔다. 방습기 전기요금이 월 84만원이고 그걸 자랑스러워한다",
        "새벽 5시 기상. 러닝머신 위에서 예산안을 읽는다",
        "의원 배지 달던 날 맞춘 각진 정장이 11벌. 전부 같은 디자인이다",
        "노래방 애창곡이 있는데 아무한테도 안 알려준다",
      ],
      personality: ["정책 브리핑하듯 말함","지고는 못 삼","의외로 소녀감성"],
      keys: {
        interest: "mixed", air: "some", comply: "argues",
        wreck: { kind: "독백", line: "질문을 받으면 답 대신 세 문단짜리 입장문이 나온다. 국정감사 11시간이 그렇게 만들었다" },
      },
      prefs: [
        { t: "정책 브리핑 형식으로 정리된 얘기", open: true },
        { t: "11시간 동안 한 번도 쉬지 않던 그 목청 — 그 폐활량을 잊지 못한다", open: false },
        { t: "자기를 이겨본 사람에게 인정받는 그림을 계속 그린다. 극비로 감춘다", open: false },
      ],
      spec: S({"skin":"#f2d3b8","hair":"#2a2622","hairStyle":"bowl","top":"#3a3f47","bottom":"#3a3f47","shoes":"#101010","heightScale":0.97,"widthScale":1,"accessory":"glasses","accessoryColor":"#333333","expression":"neutral","aura":"none","species":"human","femme":true}),
    },
    target: {
      name: "지대건", gender: "남",
      look: ["기름진 올백","번들거리는 피부","금빛 넥타이","체구가 큼"],
      history: [
        "69세 · 건설·리조트 재벌 / 여당 최대 후원자",
        "달동네 판자촌에서 시작했다는 얘기를 3분에 한 번 한다",
        "리조트 4개, 골프장 9개. 부채 규모는 본인도 정확히 모른다",
        "아침은 무조건 제로콜라. 물은 안 마신다",
        "자기 이름이 안 박힌 물건은 손에 오래 안 들고 있는다",
        "라면을 침대에서 끓여 먹는다. 이건 절대 인정 안 한다",
      ],
      personality: ["모든 문장을 최상급으로 끝냄","칭찬에 즉시 무너짐","집중력 8초"],
      keys: {
        interest: "self", air: "none", comply: "obeys",
        wreck: { kind: "폭주", line: "집중력이 8초다. 자기가 꺼낸 얘기의 끝을 자기가 못 찾고 다른 얘기로 갈아탄다" },
      },
      prefs: [
        { t: "자기 이름이 금색으로 박힌 물건", open: true },
        { t: "시청률·조회수 숫자 이야기", open: true },
        { t: "자기 골프 핸디캡을 진지하게 물어봐 주는 것", open: false },
        { t: "분식집 쫄면 (자기는 고급 회를 먹는다고 우긴다)", open: false },
        { t: "사실 상대의 종이 문서고 구축에 관심이 아주 많다", open: false },
        { t: "지난 낙선 언급", open: true, neg: true },
        { t: "자기보다 자기 얘기를 더 오래 하는 것", open: true, neg: true },
        { t: "\"작은\"이라는 형용사", open: true, neg: true },
      ],
      spec: S({"skin":"#e8b98a","hair":"#4a3b28","hairStyle":"bowl","top":"#1b1b3a","bottom":"#1b1b3a","shoes":"#2a2a2a","heightScale":1.06,"widthScale":1.28,"accessory":"none","accessoryColor":"#d4af37","expression":"smug","aura":"money","species":"human"}),
    },
  },

  {
    id: "orientation", difficulty: "보통", category: "행정오류", winWord: "3년차 신혼 성사",
    relation: "전산 오류로 3년째 법적 부부. 갈라서려면 먼저 진짜로 사귀어야 한다. 혼인관계증명서를 떼다 서로의 존재를 알았다. 전산 오류로 3년째 법적 부부다. 지금 얹힌 현안: 심사를 통과하면 그 즉시 이혼이 확정된다. 진짜로 사귀면 이혼을 못 한다.",
    client: {
      name: "강태오", gender: "남",
      look: ["애쉬 그레이 단발","린넨 셔츠","손목이 가늘다","손톱에 흙"],
      history: [
        "29세 · 플로리스트",
        "전주 출신. 꽃집 하던 이모 밑에서 자랐다",
        "연희동 반지하 겸 작업실. 월세 55만원에 꽃 냉장고가 자리의 절반",
        "통장 잔고 190만원. 강제배정 벌금 800만원은 낼 방법이 없다",
        "새벽 4시 화훼공판장, 오후엔 낮잠. 남들 퇴근할 때 출근한다",
        "긴장하면 손톱 밑 흙을 파는 버릇이 있다",
      ],
      personality: ["눈치 200단","농담으로 위기 돌파","정 많음"],
      keys: {
        interest: "other", air: "well", comply: "drifts",
        wreck: { kind: "불안", line: "상대 표정이 0.5초만 굳어도 방금 자기가 뭘 잘못했는지 소리 내어 되짚기 시작한다" },
      },
      prefs: [
        { t: "꽃과 흙 얘기가 나오면 말이 길어진다", open: true },
        { t: "서류 속 배우자가 어떤 사람일지 3년치 상상을 이미 해버렸다", open: false },
        { t: "심사 통과 다음 날을 한 번도 생각해본 적 없다는 걸 들키고 싶지 않다", open: false },
      ],
      spec: S({"skin":"#f5d5b5","hair":"#b8b8c4","hairStyle":"long","top":"#e8e2d0","bottom":"#3a4a5a","shoes":"#8a6a4a","heightScale":1.03,"widthScale":0.86,"accessory":"flower","accessoryColor":"#ff5599","expression":"happy","aura":"sparkle","species":"human"}),
    },
    target: {
      name: "윤하린", gender: "여",
      look: ["짧은 검정 투블럭","작업복","팔뚝 문신","어깨 넓음"],
      history: [
        "30세 · 용접공 / 밴드 베이시스트",
        "포항 철강단지 옆에서 자랐다. 아버지도 용접공이었다",
        "공장 인근 원룸. 방음이 안 돼서 베이스는 헤드폰으로만 친다",
        "용접 일당 25만원. 밴드는 순수 적자다",
        "작업복 세탁을 일요일 오전에 몰아서 한다. 그게 유일한 루틴이다",
        "말문이 막히면 손목 문신을 엄지로 문지른다",
      ],
      personality: ["말수 적음","한 번 웃으면 크게 웃음","불의를 못 참음"],
      keys: {
        interest: "mixed", air: "some", comply: "obeys",
        wreck: { kind: "단답", line: "용접 마스크 안에서 10년을 혼자 있었다. 대답은 대체로 한 음절로 끝난다" },
      },
      prefs: [
        { t: "큐피드국 욕하기", open: true },
        { t: "공구·용접기 스펙 이야기", open: true },
        { t: "3년치 부부 명의 적금이 하나 쌓여 있다", open: false },
        { t: "혼인신고 날짜가 자기 생일이다", open: false },
        { t: "베이스 쳐줄 사람이 없어서 3년째 혼자 녹음한다", open: false },
        { t: "말을 대신 끝내주는 것", open: true, neg: true },
        { t: "\"어차피 남이잖아요\"", open: true, neg: true },
        { t: "정색할 자리에서 농담으로 넘기기", open: true, neg: true },
      ],
      spec: S({"skin":"#e8c098","hair":"#1a1a1a","hairStyle":"short","top":"#3a5a3a","bottom":"#2a2a35","shoes":"#4a3a2a","heightScale":1.02,"widthScale":1.18,"accessory":"sunglasses","accessoryColor":"#111111","expression":"neutral","aura":"fire","species":"human","femme":true}),
    },
  },

  {
    id: "foodchain", difficulty: "헬", category: "먹이사슬", winWord: "종간(種間) 커플 성사",
    relation: "어인(魚人) × 사자 퍼리. 생물학적으로 한쪽이 한쪽의 식사다. 해저 배관 점검 중 수면 위로 비친 사자 갈기를 한쪽이 올려다봤다. 지금 얹힌 현안: 2077년 식품위생법상 포식종과 피식종의 동거는 신고 대상이다. 레오는 슈트 제작 면허를 잃는다.",
    client: {
      name: "아쿠아 박", gender: "남",
      look: ["청록색 비늘 피부","지느러미 머리","아가미","축축함"],
      history: [
        "33세 · 심해 배관공 (어인)",
        "동해 해구 3구역 출생. 형제가 400마리쯤 되는데 이름은 12개만 안다",
        "수심 40m 사택. 지상 부동산은 어인에게 안 팔린다",
        "심해 위험수당 포함 월 620만원. 쓸 데가 없어서 다 모아둔다",
        "물 밖에 4시간 이상 있으면 비늘이 갈라진다. 보습제를 20분마다 바른다",
        "말이 막히면 아가미부터 움직인다. 본인은 모른다",
      ],
      personality: ["물 밖에선 말이 느려짐","로맨틱함","자기 비늘에 자부심"],
      keys: {
        interest: "mixed", air: "none", comply: "obeys",
        wreck: { kind: "침묵", line: "물 밖에서는 문장이 중간에 마른다. 뻐끔거리다가 결국 아무 말도 안 나온다" },
      },
      prefs: [
        { t: "자기 비늘 관리 얘기를 시작하면 멈추지 않는다", open: true },
        { t: "노을이 걸린 그 갈기를 본 뒤로 물 밖 세상을 검색한다", open: false },
        { t: "회를 끊을 수 있는지 스스로 시험 중이다. 사흘째다", open: false },
      ],
      spec: S({"skin":"#4fc3c9","hair":"#1d7a86","hairStyle":"fin","top":"#0f5f6b","bottom":"#0a4550","shoes":"#083840","heightScale":1.04,"widthScale":1.05,"accessory":"none","accessoryColor":"#8ce8f0","expression":"shy","aura":"sparkle","species":"fish"}),
    },
    target: {
      name: "레오 킴", gender: "남",
      look: ["황금색 사자 풀슈트","거대한 갈기","슈트를 절대 안 벗음","꼬리"],
      history: [
        "28세 · 퍼리 슈트 제작 아티스트",
        "부산 사하구 출신. 어릴 때 별명이 \"털보\"였고 그게 싫었다",
        "작업실 겸 자택. 슈트 12벌이 옷장이 아니라 마네킹에 걸려 있다",
        "슈트 한 벌 주문제작 380만원. 대기 명단이 2년치다",
        "샤워를 새벽에 한다. 슈트를 벗는 시간을 아무한테도 안 들키려고",
        "칭찬을 들으면 갈기부터 만진다",
      ],
      personality: ["장인 자부심","수줍음","슈트 안에서 표정을 숨김"],
      keys: {
        interest: "self", air: "none", comply: "obeys",
        wreck: { kind: "독백", line: "슈트 안에서는 무슨 말이든 할 수 있어서, 아무도 안 물어본 봉제 공정을 끝까지 말한다" },
      },
      prefs: [
        { t: "슈트 봉제 장인정신 이야기", open: true },
        { t: "갈기 손질법", open: true },
        { t: "사실 물 공포증이 있다", open: false },
        { t: "참치회를 끊는 중이다", open: false },
        { t: "슈트 안에서 운 걸 들킨 적 있다", open: false },
        { t: "슈트 안에 뭐 입었냐고 묻기", open: true, neg: true },
        { t: "회 먹으러 가자고 하기", open: true, neg: true },
        { t: "\"진짜 얼굴 보여줘\"", open: true, neg: true },
      ],
      spec: S({"skin":"#f0c060","hair":"#c8880f","hairStyle":"mane","top":"#e8b44a","bottom":"#d9a13a","shoes":"#8a5a10","heightScale":1.1,"widthScale":1.3,"accessory":"none","accessoryColor":"#c8880f","expression":"happy","aura":"none","species":"lion"}),
    },
  },

  {
    id: "os-war", difficulty: "보통", category: "OS전쟁", winWord: "듀얼 부팅 커플 성사",
    relation: "커널 기여자 × 마이크로소프트 공인 강사. 20년째 진행 중인 성전(聖戰). 오픈소스 컨퍼런스 Q&A에서 \"윈도우도 쓸 만합니다\" 발언으로 장내가 얼어붙던 날 마주쳤다. 지금 얹힌 현안: 윤도우는 다음 달 시애틀 본사로 3년 발령이다. 리누스는 여권이 없고 만들 생각도 없다.",
    client: {
      name: "리누스 정", gender: "남",
      look: ["부스스한 흑발","검정 후드","창백함","거북목"],
      history: [
        "26세 · 커널 기여자 / Arch 유저",
        "대전 출신. 아버지가 전산실 직원이었고 그 방에서 자랐다",
        "고시원 3.3평. 모니터 3대가 침대보다 넓은 자리를 차지한다",
        "오픈소스 후원금 월 12만원이 수입의 전부. 라면 박스로 산다",
        "취침 시간이 없다. 커널 빌드가 끝나면 잔다",
        "말이 막히면 키보드 없는데도 손가락이 타이핑 모양으로 움직인다",
      ],
      personality: ["모든 대화를 기술 논쟁으로 만듦","이모지 못 씀","의외로 순정파"],
      keys: {
        interest: "self", air: "none", comply: "argues",
        wreck: { kind: "독백", line: "상대의 말은 반박 대상으로만 들린다. 듣는 동안 이미 자기 반론을 조립하고 있다" },
      },
      prefs: [
        { t: "dotfiles와 커널 패치 얘기", open: true },
        { t: "도발을 상냥하게 하던 그 말투가 3주째 머릿속에서 재생된다", open: false },
        { t: "자기 dotfiles를 보여주는 게 고백이라고 생각한다. 아무도 모른다", open: false },
      ],
      spec: S({"skin":"#e8d0c0","hair":"#2a2a2a","hairStyle":"spiky","top":"#111111","bottom":"#2a3a4a","shoes":"#333333","heightScale":1,"widthScale":0.88,"accessory":"glasses","accessoryColor":"#555555","expression":"weird","aura":"gloom","species":"human"}),
    },
    target: {
      name: "윤도우", gender: "여",
      look: ["하늘색 염색 단발","깔끔한 셔츠","단정함","늘 웃음"],
      history: [
        "25세 · MS 공인 강사 / 파워토이 전도사",
        "분당 출신. 아버지 회사에서 받아온 정품 스티커를 모았다",
        "풀옵션 오피스텔. 케이블이 한 가닥도 안 보이게 정리되어 있다",
        "강의료 시간당 18만원. 강의 없는 달은 통장이 조용하다",
        "매일 밤 12시에 노트북을 닫는다. 그 뒤에 뭘 하는지는 아무도 모른다",
        "설명이 길어지면 손으로 창 배치를 그리기 시작한다",
      ],
      personality: ["상냥한 도발","GUI 원리주의","설명 욕구"],
      keys: {
        interest: "mixed", air: "none", comply: "obeys",
        wreck: { kind: "독백", line: "설명 욕구가 대화 욕구를 이긴다. 상대가 이미 아는 것도 처음부터 다시 설명한다" },
      },
      prefs: [
        { t: "예쁜 GUI와 애니메이션", open: true },
        { t: "드라이버가 그냥 잡히는 것", open: true },
        { t: "사실 매일 밤 WSL로 우분투를 쓴다 (극비)", open: false },
        { t: "파워셸 원라이너 자랑", open: false },
        { t: "Ctrl+Shift+Esc 반응속도 대결", open: false },
        { t: "\"리눅스 깔아줄게\"", open: true, neg: true },
        { t: "systemd 논쟁", open: true, neg: true },
        { t: "재부팅 업데이트 조롱", open: true, neg: true },
      ],
      spec: S({"skin":"#f5dcc8","hair":"#5ac8f5","hairStyle":"bowl","top":"#ffffff","bottom":"#3a5a9a","shoes":"#dddddd","heightScale":0.99,"widthScale":0.95,"accessory":"none","accessoryColor":"#5ac8f5","expression":"happy","aura":"sparkle","species":"human","femme":true}),
    },
  },

  {
    id: "vegan-butcher", difficulty: "헬", category: "식습관", winWord: "식탁 휴전 커플 성사",
    relation: "도살장 앞 1인 시위 500일차 × 마장동 3대 정육점. 서로의 존재가 서로의 반대 진영이다. 도살장 앞 500일 시위 중, 새벽 4시 시위 텐트 앞에 두유 하나가 놓여 있었다. 지금 얹힌 현안: 육점순의 가게는 초록이 속한 단체의 다음 시위 표적으로 이미 공고가 나갔다.",
    client: {
      name: "초록", gender: "여",
      look: ["초록색 브레이드 머리","해진 패딩","피켓","삐쩍 마름"],
      history: [
        "24세 · 비건 액티비스트",
        "안동 출신. 할머니가 소를 키웠고 그 소가 팔려가는 걸 봤다",
        "시위 텐트가 사실상 집이다. 등록된 주소는 친구네 옥탑",
        "후원금 월 40만원. 피켓 재료비를 빼면 남는 게 없다",
        "하루 한 끼. 두유와 견과류. 그것도 자주 거른다",
        "흥분하면 말이 빨라지면서 손가락으로 숫자를 세기 시작한다",
      ],
      personality: ["신념 100%","말하다 목이 멘다","반박당하면 목소리가 커진다"],
      keys: {
        interest: "self", air: "none", comply: "argues",
        wreck: { kind: "폭주", line: "말하다 목이 메고, 목이 메면 더 크게 말하고, 그러다 무슨 얘기였는지 잃는다" },
      },
      prefs: [
        { t: "동물 통계와 구호 문구 다듬기", open: true },
        { t: "새벽 4시의 그 두유를 아직 못 버렸다. 냉장고 맨 안쪽에 있다", open: false },
        { t: "피켓보다 사람 손이 그립다는 걸 500일째 인정 못 하고 있다", open: false },
      ],
      spec: S({"skin":"#f0d8c0","hair":"#3faa4a","hairStyle":"twintail","top":"#6a8f5a","bottom":"#3a4a3a","shoes":"#5a4a3a","heightScale":0.94,"widthScale":0.78,"accessory":"headband","accessoryColor":"#3faa4a","expression":"angry","aura":"fire","species":"human","femme":true}),
    },
    target: {
      name: "육점순", gender: "남",
      look: ["새빨간 앞치마","올린 머리","팔뚝 굵음","칼집 흉터"],
      history: [
        "27세 · 마장동 3대 정육점 사장 / 부위 감별 국가대표",
        "마장동에서 태어나 마장동에서 산다. 3대째 같은 골목이다",
        "가게 위층이 집. 계단이 18칸이고 그게 통근 거리 전부다",
        "가게 매출은 좋다. 근데 새벽 경매 자금으로 다 돌아나간다",
        "새벽 2시 기상, 저녁 7시 취침. 남들과 시간대가 안 맞는 삶이 11년째",
        "생각이 정리 안 되면 칼을 갈기 시작한다",
      ],
      personality: ["무뚝뚝","손이 빠름","남 챙김"],
      keys: {
        interest: "mixed", air: "some", comply: "obeys",
        wreck: { kind: "단답", line: "하루에 쓰는 단어가 200개를 안 넘는다. 손이 바쁘면 그마저도 안 쓴다" },
      },
      prefs: [
        { t: "칼 가는 소리", open: true },
        { t: "새벽 4시 경매장 이야기", open: true },
        { t: "콩고기 품평에 진심이다", open: false },
        { t: "할머니 김치찌개(고기 안 들어감)", open: false },
        { t: "소마다 이름을 지어준다", open: false },
        { t: "도살장 사진 보여주기", open: true, neg: true },
        { t: "\"살인자\"라는 단어", open: true, neg: true },
        { t: "앞치마 지적", open: true, neg: true },
      ],
      spec: S({"skin":"#e8bc96","hair":"#241a12","hairStyle":"bowl","top":"#c62828","bottom":"#3a3a3a","shoes":"#2a2a2a","heightScale":1,"widthScale":1.22,"accessory":"headband","accessoryColor":"#ffffff","expression":"neutral","aura":"none","species":"human"}),
    },
  },

  {
    id: "vampire-garlic", difficulty: "쉬움", category: "종족", winWord: "흡혈 커플 성사",
    relation: "뱀파이어 × 의성 마늘 6대 농장주. 상대의 직업이 상대에게 화학무기다. 새벽 3시 편의점 계산대에서 흑마늘 진액을 사이에 두고 마주쳤다. 지금 얹힌 현안: 김마늘의 밭은 해가 떠야 일한다. 블라드는 해가 뜨면 재가 된다.",
    client: {
      name: "블라드 최", gender: "남",
      look: ["새하얀 피부","검은 장발","망토","송곳니"],
      history: [
        "412세 · 야간 편의점 알바 (뱀파이어)",
        "1665년 왈라키아 출생. 한국에는 1998년에 왔고 이유는 말 안 한다",
        "창문 없는 반지하. 등기는 없다. 412년째 세입자다",
        "야간 알바 시급 12,400원. 재산이라곤 관 하나와 망토 세 벌",
        "해 뜨기 40분 전에 퇴근해서 저녁 8시에 일어난다",
        "당황하면 400년 전 말투가 튀어나오고 본인은 그걸 못 느낀다",
      ],
      personality: ["말투가 고풍스러움","412년치 눈치 없음","밤에만 텐션 폭발"],
      keys: {
        interest: "mixed", air: "none", comply: "obeys",
        wreck: { kind: "폭주", line: "해가 지면 412년치 할 말이 한꺼번에 나온다. 상대가 대답할 자리를 안 남긴다" },
      },
      prefs: [
        { t: "412년치 옛날 얘기 들려주기", open: true },
        { t: "계산대에서 손이 타들어 가는데도 아깝지 않던 그 통증을 기억한다", open: false },
        { t: "한 번 들어주면 매일 밤 찾아갈 작정이다. 과하다는 자각은 있다", open: false },
      ],
      spec: S({"skin":"#f2f0f5","hair":"#151520","hairStyle":"long","top":"#2a0d1a","bottom":"#1a0a12","shoes":"#0d0d12","heightScale":1.08,"widthScale":0.9,"accessory":"none","accessoryColor":"#8a0d2a","expression":"weird","aura":"gloom","species":"vampire"}),
    },
    target: {
      name: "김마늘", gender: "여",
      look: ["햇볕에 그을린 피부","밀짚모자","작업 장화","건강한 체격"],
      history: [
        "31세 · 의성 마늘 6대 농장주",
        "의성에서 태어나 의성에서 산다. 6대째다",
        "본가 옆 신축 농가주택. 마늘 창고가 집보다 크다",
        "작년 흑마늘 매출 2억 4천. 대출 갚고 나면 손에 남는 건 3천",
        "새벽 5시 밭, 밤 9시 취침. 술은 명절에만",
        "민망해지면 밀짚모자 챙을 눌러쓴다",
      ],
      personality: ["소탈함","새벽형","외로움을 잘 티냄"],
      keys: {
        interest: "other", air: "well", comply: "obeys",
        wreck: { kind: "불안", line: "조금만 뜸해도 \"내가 재미없죠\"를 먼저 말해버린다. 상대가 아니라고 해도 한 번 더 묻는다" },
      },
      prefs: [
        { t: "흑마늘 90일 숙성 이야기", open: true },
        { t: "새벽 농사 루틴", open: true },
        { t: "마늘 냄새 때문에 연애를 한 번도 못 해봤다", open: false },
        { t: "밤에 별 보는 걸 좋아한다", open: false },
        { t: "마늘을 안 먹는 사람이 신기하다", open: false },
        { t: "마늘 냄새 지적", open: true, neg: true },
        { t: "십자가·성수 얘기", open: true, neg: true },
        { t: "농사일 얕보기", open: true, neg: true },
      ],
      spec: S({"skin":"#d8a070","hair":"#3a2a1a","hairStyle":"short","top":"#8a9a5a","bottom":"#5a5a3a","shoes":"#3a2a1a","heightScale":1,"widthScale":1.12,"accessory":"hat","accessoryColor":"#d8c078","expression":"happy","aura":"none","species":"human","femme":true}),
    },
  },

  {
    id: "cat-allergy", difficulty: "쉬움", category: "알레르기", winWord: "항히스타민 커플 성사",
    relation: "고양이 알레르기 4급 × 40묘 집사. 상대의 집에 5분 이상 있으면 응급실이다. 응급실 새벽 당직에서 고양이에 물린 보호자와 당직의로 만났다. 지금 얹힌 현안: 재채기는 고양이 단백질에 아나필락시스 등급이다. 마흔 마리를 다 보내지 않으면 같이 못 산다.",
    client: {
      name: "재채기", gender: "여",
      look: ["검은 곱슬","흰 가운","눈이 늘 충혈","늘 한 발 물러서 있는 자세"],
      history: [
        "30세 · 이비인후과 전공의",
        "목포 출신. 의대 가려고 서울 왔고 그 뒤로 못 내려갔다",
        "병원 앞 원룸. 짐이 캐리어 두 개뿐이고 3년째 안 풀었다",
        "전공의 월급 320만원. 학자금 대출이 4천 남았다",
        "수면이 조각나 있다. 당직 끝나고 4시간, 오후에 2시간",
        "긴장하면 상대의 코와 목을 번갈아 본다. 직업병이다",
      ],
      personality: ["의학 용어 남발","자기 몸 안 챙김","은근 고집"],
      keys: {
        interest: "mixed", air: "some", comply: "obeys",
        wreck: { kind: "독백", line: "상대의 말을 증상으로 듣는다. 대답 대신 감별진단이 나온다" },
      },
      prefs: [
        { t: "감별진단 얘기가 나오면 의사 모드가 켜진다", open: true },
        { t: "자기 상처보다 고양이 안부를 먼저 묻던 그 얼굴을 보려고 알레르기약을 두 알 먹었다", open: false },
        { t: "기도가 붓는 걸 알면서도 그 집 초대를 기다린다", open: false },
      ],
      spec: S({"skin":"#f2d8bc","hair":"#2a1a14","hairStyle":"afro","top":"#f4f4f4","bottom":"#4a5a6a","shoes":"#ffffff","heightScale":1,"widthScale":0.95,"accessory":"glasses","accessoryColor":"#222222","expression":"shy","aura":"none","species":"human","femme":true}),
    },
    target: {
      name: "냥선생", gender: "남",
      look: ["고양이 털투성이 니트","갈색 포니테일","늘 웅크린 자세","손등 스크래치"],
      history: [
        "34세 · 고양이 호텔 사장 (집사 40묘)",
        "제주 출신. 첫 고양이가 항구에서 따라온 길고양이였다",
        "고양이 호텔 3층이 자택. 사람 방은 4평이고 나머지가 다 고양이 방",
        "월 매출 900만원 중 사료·병원비로 700이 나간다",
        "하루 네 번 밥, 두 번 화장실. 자기 끼니는 그 사이에 대충",
        "사람이 어색해지면 옆에 있는 고양이 이름을 부른다",
      ],
      personality: ["고양이 얘기만 나오면 3배속","사람 경계","츄르 소믈리에"],
      keys: {
        interest: "self", air: "some", comply: "obeys",
        wreck: { kind: "경계", line: "사람이 하는 말은 일단 뭘 뺏으려는 걸로 듣는다. 3년간 그래서 틀린 적이 없었다" },
      },
      prefs: [
        { t: "고양이 사진 40장 보여주기", open: true },
        { t: "츄르 브랜드 비교 토론", open: true },
        { t: "40마리 이름을 다 외워주는 사람에게 무너진다", open: false },
        { t: "알레르기약을 미리 챙겨오는 배려", open: false },
        { t: "사실 강아지도 좋아한다 (극비)", open: false },
        { t: "\"고양이 좀 줄이지\"", open: true, neg: true },
        { t: "재채기하며 인상 쓰기", open: true, neg: true },
        { t: "털 묻은 옷 털어내기", open: true, neg: true },
      ],
      spec: S({"skin":"#f0d0b0","hair":"#8a5a2a","hairStyle":"twintail","top":"#e0c8a8","bottom":"#6a5a4a","shoes":"#a08060","heightScale":0.96,"widthScale":0.98,"accessory":"headband","accessoryColor":"#ff9ec4","expression":"happy","aura":"hearts","species":"cat"}),
    },
  },

  {
    id: "circadian", difficulty: "쉬움", category: "생활리듬", winWord: "시차 극복 커플 성사",
    relation: "새벽 4시 기상 × 새벽 4시 취침. 두 사람의 하루가 한 번도 겹치지 않는다. 새벽 4시 12분 한강 벤치에서 처음 봤다. 한쪽은 기상 직후였고 한쪽은 취침 직전이었다. 지금 얹힌 현안: 한쪽은 새벽 4시 출근, 한쪽은 새벽 4시 퇴근이다. 깨어 있는 시간이 하루에 안 겹친다.",
    client: {
      name: "조기상", gender: "남",
      look: ["짧은 스포츠 머리","기능성 러닝복","탄탄한 체형","눈 밑 그늘 없음"],
      history: [
        "28세 · 미라클모닝 유튜버 (구독자 40만)",
        "대구 출신. 삼수생 시절 새벽반 학원에서 인생이 바뀌었다고 믿는다",
        "한강 보이는 오피스텔. 방에 침대보다 러닝머신이 먼저 들어왔다",
        "유튜브 수익 월 1,100만원. 절반을 자기계발 강의 사는 데 쓴다",
        "새벽 3시 50분 기상, 밤 9시 취침. 10년째 흐트러진 적이 없다",
        "대화가 늘어지면 자기도 모르게 시계를 본다",
      ],
      personality: ["자기계발 문장 남발","지나치게 긍정","루틴 강박"],
      keys: {
        interest: "self", air: "none", comply: "argues",
        wreck: { kind: "독백", line: "무슨 말을 들어도 자기 루틴 얘기로 착지한다. 상대 말은 그 발판으로만 쓴다" },
      },
      prefs: [
        { t: "미라클 모닝 루틴 전파", open: true },
        { t: "자기 세계관을 무너뜨린 그 벤치의 사람이 계속 궁금하다", open: false },
        { t: "사실 새벽 4시가 외롭다. 루틴은 그걸 덮는 포장이다", open: false },
      ],
      spec: S({"skin":"#e8c8a0","hair":"#1a1a1a","hairStyle":"short","top":"#ff6a00","bottom":"#1a1a1a","shoes":"#ffffff","heightScale":1.04,"widthScale":1.06,"accessory":"headband","accessoryColor":"#ff6a00","expression":"happy","aura":"fire","species":"human"}),
    },
    target: {
      name: "밤샘", gender: "여",
      look: ["보라색 장발","후줄근한 후드","햇빛 본 지 오래된 낯빛","눈 밑이 검게 내려앉음"],
      history: [
        "26세 · 심야 라디오 DJ / 새벽 만화가",
        "인천 출신. 어릴 때 아버지가 야간 택시를 몰았다",
        "방음 커튼 세 겹 친 원룸. 낮에는 동굴이다",
        "라디오 출연료 회당 22만원, 만화 원고료는 밀려 있다",
        "새벽 4시 취침, 오후 1시 기상. 햇빛을 보면 두통이 난다",
        "생각할 때 손가락으로 책상을 두드린다. 늘 같은 리듬이다",
      ],
      personality: ["목소리가 좋음","낮에는 무기력","새벽에 철학자"],
      keys: {
        interest: "mixed", air: "some", comply: "obeys",
        wreck: { kind: "경계", line: "낮에 오는 호의는 전부 자기를 아침형으로 고쳐놓으려는 걸로 듣는다. 5년간 틀린 적이 없었다" },
      },
      prefs: [
        { t: "새벽 3시 도시의 소음", open: true },
        { t: "라디오 사연 읽어주기", open: true },
        { t: "해 뜨는 걸 5년째 못 봤고 사실 보고 싶다", open: false },
        { t: "아침형 인간 콘텐츠를 몰래 정주행한다", open: false },
        { t: "같이 밤새워 줄 사람", open: false },
        { t: "\"일찍 자야 성공한다\"", open: true, neg: true },
        { t: "오전 약속 잡기", open: true, neg: true },
        { t: "생활 습관 훈계", open: true, neg: true },
      ],
      spec: S({"skin":"#efe0e8","hair":"#9a5ad0","hairStyle":"long","top":"#3a2a4a","bottom":"#2a2a3a","shoes":"#4a4a5a","heightScale":0.98,"widthScale":0.86,"accessory":"none","accessoryColor":"#9a5ad0","expression":"neutral","aura":"gloom","species":"human","femme":true}),
    },
  },

  {
    id: "mbti-stats", difficulty: "보통", category: "세계관", winWord: "p<0.05 커플 성사",
    relation: "MBTI·사주 융합 상담사 × 유사과학 저격 통계학 박사. 유사과학 저격 강연에서 강연자와 잠입 청중으로 만났다. 슬라이드에 채널 하나가 12분간 해부됐다. 지금 얹힌 현안: 표준편은 학회 윤리규정상 점술업 종사자와 이해관계를 맺을 수 없다. 걸리면 논문이 철회된다.",
    client: {
      name: "신점집", gender: "여",
      look: ["보라색 웨이브 장발","자수정 목걸이","개량 한복","작은 키"],
      history: [
        "35세 · MBTI 사주 융합 상담사",
        "남해 출신. 외할머니가 무당이었다는 얘기는 안 한다",
        "상담실 겸 자택 한옥. 방 하나가 통째로 자수정이다",
        "상담 1회 15만원, 예약이 두 달 밀려 있다. 현금만 받는다",
        "아침에 그날의 일진을 보고 나서야 문을 나선다",
        "반박당하면 상대의 손동작부터 관찰하기 시작한다",
      ],
      personality: ["확신에 참","사람 잘 읽음","틀려도 해석을 바꿔서 맞춘다"],
      keys: {
        interest: "other", air: "well", comply: "argues",
        wreck: { kind: "집착", line: "상대를 유형에 넣을 때까지 못 넘어간다. 다른 얘기를 하다가도 그 얘기로 돌아온다" },
      },
      prefs: [
        { t: "사람을 유형에 넣어 맞히기", open: true },
        { t: "자기 이론을 그렇게 정확히 요약한 사람은 처음이라, 해부당한 12분을 아직 돌려본다", open: false },
        { t: "그 박사의 유형을 못 맞히고 있는 게 제일 분하다", open: false },
      ],
      spec: S({"skin":"#f5dcc0","hair":"#7a3aa8","hairStyle":"long","top":"#c9a8e8","bottom":"#5a3a7a","shoes":"#8a6ab0","heightScale":0.9,"widthScale":0.94,"accessory":"flower","accessoryColor":"#c060ff","expression":"weird","aura":"sparkle","species":"human","femme":true}),
    },
    target: {
      name: "표준편", gender: "남",
      look: ["짧은 흑발","무채색 셔츠","무테 안경","눈을 잘 안 마주침"],
      history: [
        "33세 · 통계학 박사 / 유사과학 저격 블로거",
        "청주 출신. 부모가 둘 다 교사였다",
        "연구실에 간이침대를 두고 잔다. 집은 잠만 자러 간다",
        "조교수 연봉 5,400. 블로그는 수익이 0원이고 그게 자랑이다",
        "커피를 하루 여섯 잔. 잔 수를 스프레드시트에 기록한다",
        "동의 못 할 때 안경을 고쳐 쓴다. 그게 반박 예고 신호다",
      ],
      personality: ["유의수준을 대화에 끌어들임","뭘 듣든 반례부터 찾음","농담에 \"그건 표본이 1이죠\"로 답함"],
      keys: {
        interest: "self", air: "some", comply: "obeys",
        wreck: { kind: "경계", line: "무슨 말을 들어도 반례부터 찾는다. 호의도 표본이 1인 주장으로 처리한다" },
      },
      prefs: [
        { t: "p값과 재현성 위기 이야기", open: true },
        { t: "데이터로 반박당하는 것", open: true },
        { t: "어릴 때 타로 한 장에 진심으로 위로받은 적이 있다", open: false },
        { t: "예측 내기를 좋아한다", open: false },
        { t: "커피 점(占)은 귀엽다고 생각한다", open: false },
        { t: "\"T발 너 P야?\"", open: true, neg: true },
        { t: "혈액형 성격설", open: true, neg: true },
        { t: "\"과학도 결국 믿음이잖아요\"", open: true, neg: true },
      ],
      spec: S({"skin":"#eddcc8","hair":"#1f1f1f","hairStyle":"short","top":"#8a8a8a","bottom":"#3a3a3a","shoes":"#1a1a1a","heightScale":1.01,"widthScale":0.92,"accessory":"glasses","accessoryColor":"#aaaaaa","expression":"neutral","aura":"none","species":"human"}),
    },
  },

  {
    id: "sauce-war", difficulty: "쉬움", category: "탕수육", winWord: "반반 커플 성사",
    relation: "부먹 근본주의 교주 × 찍먹 원리주의 협회장. 민족 최대의 성전. 전국 탕수육 토론회 결승에서 3시간을 맞붙었다. 지금 얹힌 현안: 두 집안은 1978년부터 같은 상권에서 싸운다. 사귀면 한쪽 가게가 문을 닫는 조건이다.",
    client: {
      name: "부어라", gender: "남",
      look: ["기름진 올백","중식 조리복","팔뚝에 화상 자국","단단한 체격"],
      history: [
        "31세 · 중식당 4대 사장 / 부먹연맹 총재",
        "화교 4세. 인천 차이나타운에서 태어났다",
        "가게 3층이 집. 계단에 소스 통이 쌓여 있어 옆으로 걸어 올라간다",
        "가게 시가 12억. 근데 현금은 늘 없다. 재료비로 다 나간다",
        "오전 10시 출근, 새벽 1시 마감. 쉬는 날은 설과 추석뿐",
        "감정이 올라오면 목소리가 반 톤씩 계속 올라간다",
      ],
      personality: ["목소리 큼","전통 강조","눈물 많음"],
      keys: {
        interest: "mixed", air: "some", comply: "argues",
        wreck: { kind: "폭주", line: "감정이 오면 목소리와 말수가 같이 커진다. 말리는 사람이 없으면 안 멈춘다" },
      },
      prefs: [
        { t: "탕수육 소스 원론", open: true },
        { t: "\"그래도 맛있게 드세요\"라며 웃던 그 얼굴 이후 탕수육에 소스를 못 붓는다", open: false },
        { t: "한 점만 먹여보면 넘어올 거라는 확신이 있다. 그게 논리가 진 다음의 계획이라는 건 모른 척한다", open: false },
      ],
      spec: S({"skin":"#e8c090","hair":"#1a1208","hairStyle":"short","top":"#f0e8d8","bottom":"#2a2a2a","shoes":"#1a1a1a","heightScale":1,"widthScale":1.25,"accessory":"mustache","accessoryColor":"#1a1208","expression":"chad","aura":"fire","species":"human"}),
    },
    target: {
      name: "찍어라", gender: "여",
      look: ["깔끔한 단발","베이지 트렌치","가는 손목","늘 수첩"],
      history: [
        "29세 · 푸드 칼럼니스트 / 찍먹협회장",
        "서울 토박이. 아버지가 중식당을 자주 데려갔다",
        "연남동 투룸. 한 방이 통째로 식자재 냉장고다",
        "칼럼 원고료 편당 40만원. 협찬은 전부 거절해서 늘 빠듯하다",
        "먹은 것을 전부 수첩에 적는다. 12년치 수첩이 있다",
        "맛을 볼 때 눈을 감는다. 상대가 말하는 중에도 그런다",
      ],
      personality: ["논리적","까칠하지만 정중","미식 집착"],
      keys: {
        interest: "other", air: "none", comply: "obeys",
        wreck: { kind: "집착", line: "한 번 걸린 지점은 끝까지 판다. 상대가 넘어가자고 해도 그 문장으로 돌아온다" },
      },
      prefs: [
        { t: "튀김옷 바삭도 측정 데이터", open: true },
        { t: "소스 산도(pH) 이야기", open: true },
        { t: "사실 집에서 혼자 먹을 땐 부어 먹는다", open: false },
        { t: "탕수육보다 깐풍기를 더 좋아한다", open: false },
        { t: "어릴 적 아빠가 부어주던 탕수육 기억", open: false },
        { t: "\"그건 그냥 눅눅한 튀김\"", open: true, neg: true },
        { t: "상대 앞에서 소스 붓기", open: true, neg: true },
        { t: "미식 취향 조롱", open: true, neg: true },
      ],
      spec: S({"skin":"#f5dfc8","hair":"#3a2a20","hairStyle":"bowl","top":"#d8c8a8","bottom":"#5a4a3a","shoes":"#8a7a6a","heightScale":0.98,"widthScale":0.9,"accessory":"glasses","accessoryColor":"#c8a860","expression":"neutral","aura":"none","species":"human","femme":true}),
    },
  },

  {
    id: "gamer-activist", difficulty: "헬", category: "세대전쟁", winWord: "셧다운 해제 커플 성사",
    relation: "LCK 프로게이머 × 게임중독대책위 사무국장. 상대의 직업이 내 직업을 없애려 한다. 국회 공청회 참고인석에 마주 앉았다. \"이 청년도 피해자입니다\"라는 발언이 나온 자리다. 지금 얹힌 현안: 정화연의 아들은 페이컷이 서명한 서류로 팀에서 방출됐다. 그게 나오면 이 자리는 끝난다.",
    client: {
      name: "페이컷", gender: "남",
      look: ["탈색 은발","팀 유니폼","앉은 자세가 굽었다","손목 보호대"],
      history: [
        "22세 · LCK 미드라이너",
        "부산 출신. 열네 살에 상경해서 숙소 생활만 8년 했다",
        "팀 숙소 2인실. 개인 물건이 캐리어 하나에 다 들어간다",
        "연봉 4억 2천. 쓸 줄을 몰라서 통장에 그대로 있다",
        "기상 오후 1시, 스크림 후 새벽 4시 취침. 밥은 배달",
        "말문이 막히면 마우스를 쥔 것처럼 손이 굽는다",
      ],
      personality: ["말 짧음","승부욕","감정 표현 서툼"],
      keys: {
        interest: "self", air: "none", comply: "obeys",
        wreck: { kind: "단답", line: "인터뷰 3년치를 한 문장으로 끝내는 법만 익혔다. \"네\", \"아니요\", \"몰라요\"" },
      },
      prefs: [
        { t: "게임 얘기만 나오면 문장이 길어진다", open: true },
        { t: "피해자라고 불러준 유일한 사람이라 그날 밤 12연패했다", open: false },
        { t: "불쌍하게 보이는 게 제일 싫으면서, 그 사람 앞에서만은 얘기하고 싶다", open: false },
      ],
      spec: S({"skin":"#f0dcc8","hair":"#e8e8f0","hairStyle":"spiky","top":"#1a2a6a","bottom":"#1a1a2a","shoes":"#ff3355","heightScale":1,"widthScale":0.82,"accessory":"headband","accessoryColor":"#1a2a6a","expression":"neutral","aura":"none","species":"human"}),
    },
    target: {
      name: "정화연", gender: "여",
      look: ["단정한 갈색 단발","정장","피곤한 눈","어깨가 한쪽으로 기울어 있음"],
      history: [
        "39세 · 청소년게임중독대책위 사무국장",
        "원주 출신. 교사 생활 10년 하다가 시민단체로 옮겼다",
        "25평 아파트, 아들 방문은 늘 닫혀 있다",
        "사무국장 월급 280만원. 아들 학원비가 그보다 많다",
        "밤 12시 소등 원칙. 본인만 지키고 아들은 안 지킨다",
        "곤란해지면 자료집을 뒤적인다. 찾는 게 없어도 뒤적인다",
      ],
      personality: ["말이 조리 있음","벽이 두꺼움","아들 얘기엔 무너짐"],
      keys: {
        interest: "other", air: "none", comply: "obeys",
        wreck: { kind: "독백", line: "남의 말을 아들 사례로 번역해서 듣는다. 대답은 그 사례에 대한 것이다" },
      },
      prefs: [
        { t: "청소년 상담 사례 이야기", open: true },
        { t: "밤 12시 취침 원칙", open: true },
        { t: "아들이 프로게이머 지망생이다", open: false },
        { t: "사실 테트리스 세계랭커였다", open: false },
        { t: "게임이 미운 게 아니라 아들을 이해 못 하는 자신이 무섭다", open: false },
        { t: "\"게임 안 해보셨죠?\"", open: true, neg: true },
        { t: "억대 연봉 자랑", open: true, neg: true },
        { t: "세대 조롱", open: true, neg: true },
      ],
      spec: S({"skin":"#ecd4bc","hair":"#4a3020","hairStyle":"bowl","top":"#4a4a58","bottom":"#3a3a48","shoes":"#2a2a2a","heightScale":0.97,"widthScale":1,"accessory":"none","accessoryColor":"#4a3020","expression":"neutral","aura":"gloom","species":"human","femme":true}),
    },
  },

  {
    id: "minimal-hoarder", difficulty: "보통", category: "소유", winWord: "수납 커플 성사",
    relation: "전 재산 12개 미니멀리스트 × 수집품 4만 점 호더. 같은 공간에 살 수 없다. 중고거래 무료 나눔 글을 보고 찾아간 창고에서 만났다. 지금 얹힌 현안: 만물상의 4만 점은 창고 세 동이다. 공백의 집에는 의자가 하나도 없다.",
    client: {
      name: "공백", gender: "남",
      look: ["민머리","흰 무지 티","군더더기 없는 체형","가방 없음"],
      history: [
        "36세 · 미니멀리스트 (소유물 12개)",
        "어디 출신인지 말하지 않는다. 기록을 다 버렸다고 한다",
        "6평 원룸. 가구는 매트리스 하나, 옷은 세 벌",
        "컨설팅 수입 월 500. 통장 하나, 카드 없음, 저축은 전액 인덱스",
        "식사는 하루 두 번, 같은 메뉴. 고민할 일을 없애려고",
        "어색하면 눈앞의 물건 개수를 소리 내서 센다",
      ],
      personality: ["문장을 짧게 끊는다","판단 안 함","고요함"],
      keys: {
        interest: "mixed", air: "some", comply: "obeys",
        wreck: { kind: "단답", line: "말도 소유물이라고 생각한다. 두 단어로 되는 걸 세 단어로 안 한다" },
      },
      prefs: [
        { t: "물건 버리는 법 전파", open: true },
        { t: "수집품에 파묻혀 울던 사람에게 받은 로봇 하나 — 전 재산이 13개가 됐다", open: false },
        { t: "언젠가 그 창고를 다 비워주고 싶다. 그게 구원인지 폭력인지 아직 모른다", open: false },
      ],
      spec: S({"skin":"#e8d0b8","hair":"#3a3a3a","hairStyle":"bald","top":"#f8f8f8","bottom":"#e8e8e8","shoes":"#dddddd","heightScale":1.02,"widthScale":0.9,"accessory":"none","accessoryColor":"#cccccc","expression":"neutral","aura":"none","species":"human"}),
    },
    target: {
      name: "만물상", gender: "여",
      look: ["헝클어진 장발","빈티지 티셔츠 겹쳐 입음","통통함","먼지"],
      history: [
        "41세 · 3층 창고형 자택 거주 / 수집품 4만 점",
        "수원 출신. 형과 방을 같이 썼고 형은 2009년에 죽었다",
        "3층 단독주택 전체가 창고. 잠은 2층 소파에서 잔다",
        "수집품 감정가 총 4억. 현금은 40만원. 아무것도 못 판다",
        "먹고 자는 시간이 불규칙하다. 정리하다 보면 이틀이 지나 있다",
        "얘기하다 흥분하면 관련 물건을 찾으러 자리를 뜬다",
      ],
      personality: ["수다스러움","물건에 사연 부여","버리는 걸 못 함"],
      keys: {
        interest: "self", air: "none", comply: "obeys",
        wreck: { kind: "폭주", line: "물건 하나에 사연이 셋이라 문장이 계속 곁가지로 새고 원래 얘기로 못 돌아온다" },
      },
      prefs: [
        { t: "희귀 수집품 자랑 들어주기", open: true },
        { t: "90년대 굿즈 이야기", open: true },
        { t: "사실 물건 버리는 법을 배우고 싶다", open: false },
        { t: "수집품 하나하나에 돌아가신 형 얘기가 있다", open: false },
        { t: "대신 정리해주는 사람에게 약하다", open: false },
        { t: "\"이거 다 버리면\"", open: true, neg: true },
        { t: "미니멀 라이프 전도", open: true, neg: true },
        { t: "수집품 가치 폄하", open: true, neg: true },
      ],
      spec: S({"skin":"#efd8c0","hair":"#5a4030","hairStyle":"afro","top":"#c85a30","bottom":"#4a5a7a","shoes":"#7a6a5a","heightScale":0.98,"widthScale":1.32,"accessory":"glasses","accessoryColor":"#7a5a3a","expression":"happy","aura":"money","species":"human","femme":true}),
    },
  },

  {
    id: "alien-ufologist", difficulty: "보통", category: "정체은닉", winWord: "제1종 근접조우 커플 성사",
    relation: "외계 침공군 정찰병 × UFO 폭로 유튜버. 정체가 들키는 순간 침공 작전이 무산된다. 조회수 12회짜리 UFO 폭로 방송을 정찰병이 우연히 시청하면서 접점이 생겼다. 지금 얹힌 현안: 그레이 7호의 지구 체류 허가가 다음 달 만료다. 연장 조건이 정체 공개다.",
    client: {
      name: "그레이 7호", gender: "무성",
      look: ["회색 피부","거대한 검은 눈","더듬이","작고 마름"],
      history: [
        "3세(지구 나이 · 본국 기준 성인) · 편의점 야간 (위장 취업) / 외계 정찰병",
        "제타 성단 4행성 출생. 지구 나이로 3세, 본국 기준 성인이다",
        "편의점 창고에 접이식 침낭. 모선은 뒷산에 접어서 숨겨뒀다",
        "지구 화폐 자산 31만원. 가치 개념을 아직 이해 못 했다",
        "수면이 필요 없어서 밤새 지구 방송을 본다. 홈쇼핑을 제일 좋아한다",
        "당황하면 관용구를 잘못 쓴다. \"발이 넓으시네요\"를 신발 얘기로 안다",
      ],
      personality: ["지구 관용구를 잘못 씀","호기심 과다","거짓말 못 함"],
      keys: {
        interest: "other", air: "none", comply: "obeys",
        wreck: { kind: "폭주", line: "궁금한 게 생기면 지금 하던 문장을 버리고 그걸 묻는다. 한 턴에 세 번 그런다" },
      },
      prefs: [
        { t: "지구 문화를 하나씩 캐묻는 버릇", open: true },
        { t: "아무도 안 믿어주는데 매일 방송을 켜는 그 인간 때문에 침공 보고서를 40일째 못 낸다", open: false },
        { t: "정체를 들키고 싶은 충동이 있다. 단 한 사람에게만", open: false },
      ],
      spec: S({"skin":"#b8c8d0","hair":"#8a9aa8","hairStyle":"bald","top":"#5a7a8a","bottom":"#3a5a6a","shoes":"#2a4a5a","heightScale":0.82,"widthScale":0.76,"accessory":"antenna","accessoryColor":"#7affd8","expression":"weird","aura":"sparkle","species":"alien"}),
    },
    target: {
      name: "진실탐사대", gender: "남",
      look: ["은박 모자","헝클어진 반백 머리","낡은 야상","구부정함"],
      history: [
        "44세 · UFO 폭로 유튜버 (구독자 800명)",
        "원주 출신. 20년간 지방 방송국 조명 기사였다",
        "원룸에 안테나 4개. 집주인이 세 번 경고했다",
        "연금 월 74만원. 촬영 장비 할부가 아직 남았다",
        "새벽 2시부터 4시까지 하늘을 본다. 8년째 매일",
        "반박당하면 은박 모자를 고쳐 쓴다",
      ],
      personality: ["열정 과다","외로움","남 말 잘 믿음"],
      keys: {
        interest: "self", air: "none", comply: "obeys",
        wreck: { kind: "집착", line: "13년간 한 주제만 붙들고 살았다. 무슨 얘기든 세 마디 안에 그 주제로 끌고 온다" },
      },
      prefs: [
        { t: "51구역 은폐 이야기", open: true },
        { t: "은박 모자 패션 품평", open: true },
        { t: "3년째 아무도 안 믿어줘서 진심으로 외롭다", open: false },
        { t: "진짜 외계인을 만나면 울 것 같다", open: false },
        { t: "아내가 떠난 이유가 이 채널이다", open: false },
        { t: "\"그거 다 헛소리\"", open: true, neg: true },
        { t: "정부 관계자 티내기", open: true, neg: true },
        { t: "구독자 수 조롱", open: true, neg: true },
      ],
      spec: S({"skin":"#e8d0b8","hair":"#a8a8a8","hairStyle":"afro","top":"#5a6a4a","bottom":"#4a4a3a","shoes":"#3a3a2a","heightScale":0.99,"widthScale":1.08,"accessory":"hat","accessoryColor":"#c8c8d8","expression":"weird","aura":"gloom","species":"human"}),
    },
  },

  {
    id: "zombie-hunter", difficulty: "보통", category: "생사", winWord: "사후(死後) 커플 성사",
    relation: "지성체 좀비 × 좀비대응특공대 저격수. 상대의 KPI가 내 머리다. 좀비 영화 촬영장에서 엑스트라와 특공대 자문으로 만났다. \"저 사람만 진짜 같은데요\"라는 지목이 있었다. 지금 얹힌 현안: 헌터 오의 직무규정상 감염체와의 사적 접촉은 경고 없이 즉시 해고 사유다.",
    client: {
      name: "워커 진", gender: "남",
      look: ["잿빛 피부","실밥 자국","늘어진 검은 머리","한쪽 어깨가 처짐"],
      history: [
        "34세 · 시체 분장 배우 (위장) / 사망 6년차 좀비",
        "광주 출신. 2071년 사망. 장례식에 본인이 갔다",
        "반지하. 창문을 막아뒀다. 여름에 냄새가 심하다",
        "분장 배우 일당 15만원. 방부 처리 약품값이 그보다 비싸다",
        "잠을 안 잔다. 대신 하루 두 번 몸이 굳는 시간이 있다",
        "감정이 올라오면 턱관절이 먼저 어긋난다",
      ],
      personality: ["느릿함","자기 비하","의외로 유머러스"],
      keys: {
        interest: "mixed", air: "some", comply: "obeys",
        wreck: { kind: "침묵", line: "발음이 무너지는 게 무서워서 말을 삼킨다. 삼킨 자리는 그냥 비워둔다" },
      },
      prefs: [
        { t: "분장 기술 얘기", open: true },
        { t: "6년 만에 들은 제일 다정한 말이 저격수의 지목 발언이었다", open: false },
        { t: "사람 취급을 받는 순간을 위해서라면 위험도 감수할 생각이다", open: false },
      ],
      spec: S({"skin":"#9ab08a","hair":"#2a2a20","hairStyle":"long","top":"#5a5040","bottom":"#3a3830","shoes":"#2a2820","heightScale":1.02,"widthScale":1,"accessory":"none","accessoryColor":"#7a3a3a","expression":"weird","aura":"gloom","species":"zombie"}),
    },
    target: {
      name: "헌터 오", gender: "여",
      look: ["짧은 갈색 머리","전술 조끼","탄탄함","흉터"],
      history: [
        "30세 · 좀비대응특공대 저격수",
        "속초 출신. 동생이 하나 있었다. 지금은 없다",
        "관사 1인실. 벽에 아무것도 안 걸어놨다",
        "특공대 수당 포함 월 480. 절반을 부모님께 보낸다",
        "기상 5시, 사격장 두 시간. 휴일에도 똑같다",
        "거짓말을 들으면 왼쪽 눈을 살짝 가늘게 뜬다",
      ],
      personality: ["과묵","경계심 최상","규정 준수"],
      keys: {
        interest: "other", air: "some", comply: "obeys",
        wreck: { kind: "경계", line: "대화를 교전 수칙으로 처리한다. 먼저 묻고, 먼저 확인하고, 답은 최소로 준다" },
      },
      prefs: [
        { t: "총기 정비 루틴", open: true },
        { t: "생존 배낭 꾸리기", open: true },
        { t: "첫 임무에서 좀비가 된 동생을 못 쐈다", open: false },
        { t: "좀비에게도 감정이 있다고 몰래 생각한다", open: false },
        { t: "머리 냄새에 이상하게 민감하다", open: false },
        { t: "신음소리 내기", open: true, neg: true },
        { t: "물기", open: true, neg: true },
        { t: "\"뇌\"라는 단어", open: true, neg: true },
      ],
      spec: S({"skin":"#e0bc98","hair":"#6a4a2a","hairStyle":"short","top":"#4a5040","bottom":"#3a4030","shoes":"#2a2a20","heightScale":1.03,"widthScale":1.12,"accessory":"sunglasses","accessoryColor":"#111111","expression":"angry","aura":"none","species":"human","femme":true}),
    },
  },

  {
    id: "noise-drummer", difficulty: "보통", category: "층간소음", winWord: "방음 커플 성사",
    relation: "층간소음 신고 1,204건 × 위층 홈 드럼 스트리머. 신고 대상과 신고자다. 1,204번째 신고를 넣으러 간 관리사무소에서, 방음 견적서 4,800만원을 들고 우는 위층과 마주쳤다. 지금 얹힌 현안: 두둠칫의 합주실은 조용히의 집 바로 위다. 임대 계약이 4년 남았고 위약금이 세 배다.",
    client: {
      name: "조용히", gender: "여",
      look: ["가르마 탄 흑발","회색 카디건","평범","늘 귀마개 목에 걸침"],
      history: [
        "38세 · 아파트 자치회 소음분과장 (신고 1,204건)",
        "성남 출신. 학창 시절 내내 도서관에서 살았다",
        "아파트 12층. 위층은 13층이고 그게 인생의 중심 좌표다",
        "세무사 사무실 근무, 월 390. 방음공사 견적도 알아봤다가 포기했다",
        "밤 10시 취침 시도, 실패, 새벽 2시 각성이 반복된다",
        "스트레스받으면 손톱으로 책상을 규칙적으로 긁는다",
      ],
      personality: ["예민함","기록 집착","정 없어 보이지만 있음"],
      keys: {
        interest: "mixed", air: "some", comply: "obeys",
        wreck: { kind: "집착", line: "1,204건을 다 기억한다. 무슨 얘기를 하다가도 그중 한 건으로 돌아간다" },
      },
      prefs: [
        { t: "소음 데시벨 측정 기록 정리", open: true },
        { t: "견적서를 들고 울던 그 모습을 본 뒤 1,205번째 신고를 취소했다", open: false },
        { t: "사실 그 드럼 소리로 잠드는 날이 생겼다. 신고 이력이 그 말을 못 하게 한다", open: false },
      ],
      spec: S({"skin":"#ecd8c0","hair":"#241a12","hairStyle":"bowl","top":"#9a9a9a","bottom":"#4a4a55","shoes":"#3a3a3a","heightScale":0.99,"widthScale":0.96,"accessory":"headband","accessoryColor":"#dd4444","expression":"angry","aura":"none","species":"human","femme":true}),
    },
    target: {
      name: "두둠칫", gender: "남",
      look: ["형광 분홍 머리","민소매","팔 근육","늘 스틱을 들고 있음"],
      history: [
        "25세 · 홈 드럼 스트리머 (위층 거주)",
        "대전 출신. 중학교 밴드부에서 처음 스틱을 잡았다",
        "아파트 13층. 거실을 통째로 드럼방으로 개조했다",
        "스트리밍 수익 월 210만원. 방음공사 견적 4,800만원 앞에서 무의미하다",
        "연습은 새벽에 한다. 낮에는 아르바이트를 나간다",
        "말하다가 손이 자동으로 리듬을 친다. 무릎이든 책상이든",
      ],
      personality: ["에너지 폭발","미안함을 숨김","리듬으로 말함"],
      keys: {
        interest: "self", air: "none", comply: "obeys",
        wreck: { kind: "폭주", line: "말이 박자를 타면 안 멈춘다. 문장이 끝나기 전에 다음 문장이 시작된다" },
      },
      prefs: [
        { t: "방음 부스 스펙 이야기", open: true },
        { t: "좋은 스네어 소리", open: true },
        { t: "새벽 연습 때문에 늘 아래층에 미안했다", open: false },
        { t: "아래층 사람 얼굴을 한 번도 못 봤다", open: false },
        { t: "방음공사 견적 4,800만원 때문에 파산 직전이다", open: false },
        { t: "신고 이야기", open: true, neg: true },
        { t: "관리사무소 언급", open: true, neg: true },
        { t: "\"몇 시인 줄 아세요\"", open: true, neg: true },
      ],
      spec: S({"skin":"#f0d0b0","hair":"#ff44aa","hairStyle":"mohawk","top":"#1a1a1a","bottom":"#4a2a5a","shoes":"#ff44aa","heightScale":1.01,"widthScale":1.08,"accessory":"none","accessoryColor":"#ff44aa","expression":"happy","aura":"fire","species":"human"}),
    },
  },

  {
    id: "snake-phobia", difficulty: "보통", category: "공포증", winWord: "노출치료 커플 성사",
    relation: "뱀 217마리 브리더 × 뱀 공포증을 못 고친 공포증 전문 상담사. 공포증 극복 워크숍에 초빙된 뱀 강사 앞에서 상담사가 기절하며 만났다. 지금 얹힌 현안: 안심해는 뱀 앞에서 실신한다. 서파인의 217마리는 분양이 법으로 금지된 종이다.",
    client: {
      name: "서파인", gender: "여",
      look: ["초록빛 브레이드","비늘 무늬 재킷","길쭉한 체형","차가운 손"],
      history: [
        "32세 · 파충류 브리더 (뱀 217마리)",
        "거제 출신. 어릴 때 뒷산에서 처음 뱀을 봤고 안 무서웠다",
        "단독주택 전체가 사육장. 사람 공간은 부엌 옆 3평",
        "브리딩 수입 월 700. 사육 유지비가 500이라 남는 게 적다",
        "온도 체크 때문에 3시간마다 깬다. 통잠을 자 본 지 6년",
        "침묵이 5초 넘으면 뱀 이름을 순서대로 읊기 시작한다",
      ],
      personality: ["조용조용함","동물 앞에서만 수다","눈을 잘 안 깜빡임"],
      keys: {
        interest: "mixed", air: "none", comply: "obeys",
        wreck: { kind: "침묵", line: "사람 앞에서는 문장이 안 만들어진다. 217마리 앞에서만 말이 된다" },
      },
      prefs: [
        { t: "217마리 각각의 이름과 성격 소개", open: true },
        { t: "깨어나자마자 사과부터 하던 그 사람이 뱀보다 궁금해졌다", open: false },
        { t: "내 애들을 안 무서워하는 품이 어떤 건지 한 번은 알고 싶다", open: false },
      ],
      spec: S({"skin":"#e0dcc0","hair":"#2a7a4a","hairStyle":"long","top":"#3a6a4a","bottom":"#2a3a2a","shoes":"#1a2a1a","heightScale":1.06,"widthScale":0.84,"accessory":"none","accessoryColor":"#7aff9a","expression":"weird","aura":"none","species":"human","femme":true}),
    },
    target: {
      name: "안심해", gender: "남",
      look: ["부드러운 갈색 단발","니트 가디건","온화한 인상","앉으면 손을 무릎에 포갠다"],
      history: [
        "35세 · 공포증 전문 심리상담사 (본인은 뱀 공포증)",
        "춘천 출신. 어머니가 불안장애를 앓았고 그래서 이 직업을 골랐다",
        "상담실 겸 자택. 책이 벽 세 면을 채우고 있다",
        "상담 1회 8만원, 저소득층은 무료. 그래서 늘 빠듯하다",
        "점심을 거른다. 상담이 붙어 있으면 저녁도 거른다",
        "자기 얘기가 나오면 찻잔을 두 손으로 감싸 쥔다",
      ],
      personality: ["목소리가 낮고 안정적","남 걱정만 함","자기 문제는 방치"],
      keys: {
        interest: "other", air: "some", comply: "obeys",
        wreck: { kind: "경계", line: "자기에게 오는 호의는 일단 뭘 원해서 오는 걸로 받는다. 상담실 밖에서 그게 틀린 적이 별로 없었다" },
      },
      prefs: [
        { t: "노출치료 이론 이야기", open: true },
        { t: "차분한 호흡법 공유", open: true },
        { t: "자기 공포증을 못 고치는 게 최대 콤플렉스다", open: false },
        { t: "도마뱀은 사실 귀엽다고 생각한다", open: false },
        { t: "진심으로 극복하고 싶다", open: false },
        { t: "갑자기 사진 보여주기", open: true, neg: true },
        { t: "\"안 물어요\"", open: true, neg: true },
        { t: "공포증 가볍게 취급", open: true, neg: true },
      ],
      spec: S({"skin":"#f2dcc4","hair":"#8a6a48","hairStyle":"bowl","top":"#d8c8b0","bottom":"#7a6a5a","shoes":"#9a8a7a","heightScale":0.98,"widthScale":0.98,"accessory":"glasses","accessoryColor":"#b0906a","expression":"shy","aura":"none","species":"human"}),
    },
  },

  {
    id: "timetraveler-luddite", difficulty: "헬", category: "문명", winWord: "시간선 병합 커플 성사",
    relation: "2231년에서 온 시간여행자 × 전기를 거부하는 기계파괴주의 촌장. 연료가 떨어진 시간여행자가 산속 공동체에 숨어들어 장작 패는 촌장을 사흘 지켜봤다. 지금 얹힌 현안: 크로노 강은 2231년으로 돌아가야 한다. 남은 좌표가 편도 하나뿐이다.",
    client: {
      name: "크로노 강", gender: "여",
      look: ["형광 하늘색 짧은 머리","홀로그램 재킷","날렵함","관자놀이에 단자"],
      history: [
        "27세 · 시간관리국 도망자 (2231년생)",
        "2231년 네오서울 제3거주구 출생. 지상을 본 게 여기 와서가 처음이다",
        "숙소가 없다. 공동체 헛간에서 몰래 잔다",
        "2231년 자산은 몰수됐다. 현재 소지금 0원, 대신 손목에 시간관리국 단자",
        "수면 주기가 안 맞는다. 154년 뒤 시간대로 몸이 돌아간다",
        "초조해지면 존재하지 않는 홀로그램을 허공에 띄우려 손을 젓는다",
      ],
      personality: ["미래 지식 자랑 욕구","조급함","순진함"],
      keys: {
        interest: "self", air: "none", comply: "argues",
        wreck: { kind: "폭주", line: "이 시대 속도가 답답해서 세 문장을 한 문장에 우겨넣는다. 그래서 아무도 못 알아듣는다" },
      },
      prefs: [
        { t: "미래 얘기를 하고 싶어 입이 근질거린다", open: true },
        { t: "손으로 뭔가를 만드는 사람을 처음 봤고, 그날 귀환 신호를 꺼버렸다", open: false },
        { t: "2231년으로 안 돌아가는 상상을 매일 한다. 좌표가 편도 하나 남았는데", open: false },
      ],
      spec: S({"skin":"#f0dcc8","hair":"#6adcff","hairStyle":"spiky","top":"#2a3a6a","bottom":"#1a2a4a","shoes":"#8adcff","heightScale":1.01,"widthScale":0.9,"accessory":"sunglasses","accessoryColor":"#6adcff","expression":"happy","aura":"sparkle","species":"robot","femme":true}),
    },
    target: {
      name: "손망치", gender: "남",
      look: ["희끗한 장발과 수염","손수 짠 옷","두꺼운 손","단단한 체격"],
      history: [
        "45세 · 기계파괴주의 공동체 촌장 (전기 없이 삶)",
        "이 산에서 태어나 이 산에서 늙었다. 아래 마을에는 12년째 안 내려갔다",
        "손수 지은 흙집. 못을 하나도 안 썼다는 게 자랑이다",
        "화폐를 안 쓴다. 물물교환으로 산다. 장부는 나무판에 새긴다",
        "해 뜨면 일어나고 해 지면 잔다. 시계를 유일한 기계로 허용한다",
        "생각할 때 손바닥의 굳은살을 엄지로 문지른다",
      ],
      personality: ["느긋함","고집","말보다 손"],
      keys: {
        interest: "other", air: "some", comply: "obeys",
        wreck: { kind: "침묵", line: "말로 답할 일이 아니라고 생각하면 그냥 답을 안 한다. 상대가 기다리든 말든" },
      },
      prefs: [
        { t: "손편지 받기", open: true },
        { t: "장작 패는 리듬 이야기", open: true },
        { t: "죽은 아내의 목소리 녹음을 몰래 듣는다 (유일한 기계)", open: false },
        { t: "미래가 궁금해서 미치겠다", open: false },
        { t: "손목시계만은 허용한다", open: false },
        { t: "미래 기술 자랑", open: true, neg: true },
        { t: "스마트폰 꺼내기", open: true, neg: true },
        { t: "\"편해지실 텐데\"", open: true, neg: true },
      ],
      spec: S({"skin":"#d8b088","hair":"#c8c0b0","hairStyle":"long","top":"#8a7a5a","bottom":"#5a4a3a","shoes":"#4a3a28","heightScale":1.05,"widthScale":1.24,"accessory":"beard","accessoryColor":"#c8c0b0","expression":"neutral","aura":"none","species":"human"}),
    },
  },

  {
    id: "taxman-hacker", difficulty: "헬", category: "법", winWord: "자진신고 커플 성사",
    relation: "국세청 조사4국 팀장 × 익명 크립토 해커. 한쪽이 한쪽을 수배 중이다. 3년째 추적 중인 지갑 주소와 조사관으로 얽혀 있고, 실물 대면은 오늘이 처음이다. 지금 얹힌 현안: 세무진이 사귀면 그 사건은 이해충돌로 다른 조사관에게 넘어간다. 그쪽이 훨씬 독하다.",
    client: {
      name: "세무진", gender: "남",
      look: ["단정한 가르마","남색 정장","평범한 체격","늘 서류가방"],
      history: [
        "37세 · 국세청 조사4국 팀장",
        "군산 출신. 아버지가 작은 공장을 하다 세금 문제로 접었다",
        "30평 아파트, 대출 2억 8천. 방 하나는 서류로 차 있다",
        "5급 공무원 연봉 6,200. 부수입은 0원이고 그걸 지키는 게 자부심이다",
        "출근 7시 20분, 퇴근 시간은 없다. 주말에도 사무실에 나온다",
        "긴장하면 볼펜 뚜껑을 규칙적으로 여닫는다",
      ],
      personality: ["원칙주의","건조함","숨은 낭만"],
      keys: {
        interest: "other", air: "some", comply: "obeys",
        wreck: { kind: "단답", line: "조서 쓰듯 말한다. 필요 없는 말은 진술이 아니라고 배웠다" },
      },
      prefs: [
        { t: "장부와 패턴 얘기", open: true },
        { t: "매달 같은 날 소아암 재단으로 가는 그 기부 패턴을 보고서에 못 썼다", open: false },
        { t: "수배 중인 상대를 앞에 두고 조서보다 캘린더를 먼저 떠올린다", open: false },
      ],
      spec: S({"skin":"#eed8c0","hair":"#1f1a14","hairStyle":"short","top":"#2a3a5a","bottom":"#22304a","shoes":"#1a1a1a","heightScale":1,"widthScale":1,"accessory":"glasses","accessoryColor":"#333333","expression":"neutral","aura":"none","species":"human"}),
    },
    target: {
      name: "0xGHOST", gender: "여",
      look: ["후드로 얼굴 가림","형광 초록 앞머리만 보임","깡마름","LED 마스크"],
      history: [
        "24세 · 익명 크립토 해커",
        "대구 출신. 열아홉에 집을 나왔다",
        "주소지가 없다. 한 달마다 단기임대를 옮겨 다닌다",
        "지갑에 42억 상당. 현금화하는 법을 몰라서 못 쓴다. 편의점 도시락을 먹는다",
        "낮에 자고 밤에 일어난다. 택배 벨소리에 심장이 내려앉는다",
        "겁먹으면 후드 끈을 잡아당겨 얼굴을 더 가린다",
      ],
      personality: ["냉소적","정부 불신","겁이 많음"],
      keys: {
        interest: "self", air: "some", comply: "obeys",
        wreck: { kind: "경계", line: "개인적인 질문은 전부 정보 수집으로 읽는다. 답 대신 왜 묻는지를 묻는다" },
      },
      prefs: [
        { t: "프라이버시 코인 기술 이야기", open: true },
        { t: "암호학 논문 잡담", open: true },
        { t: "사실 세금 신고하는 법을 몰라서 무서운 것이다", open: false },
        { t: "엄마 병원비 때문에 시작했다", open: false },
        { t: "합법적으로 살고 싶다", open: false },
        { t: "실명 요구", open: true, neg: true },
        { t: "세무조사 언급", open: true, neg: true },
        { t: "서류 꺼내기", open: true, neg: true },
      ],
      spec: S({"skin":"#e0d8d0","hair":"#3aff88","hairStyle":"bowl","top":"#111118","bottom":"#1a1a22","shoes":"#2a2a33","heightScale":0.97,"widthScale":0.78,"accessory":"sunglasses","accessoryColor":"#3aff88","expression":"weird","aura":"gloom","species":"human","femme":true}),
    },
  },

  {
    id: "cult-lawyer", difficulty: "헬", category: "신앙", winWord: "해산 신고 커플 성사",
    relation: "우주광명회 교주 × 사이비 피해자 구제 전문 변호사. 법정에서 12번 만난 사이. 법정에서 12번 마주쳤다. 12번째 재판 최후변론에서 한쪽이 울었다. 지금 얹힌 현안: 박변은 그 교단 피해자 47명의 소송대리인이다. 사귀면 47명이 대리인을 잃는다.",
    client: {
      name: "빛나신다", gender: "남",
      look: ["금빛 자수 도포","기른 흰 수염","광채나는 이마","큰 키"],
      history: [
        "48세 · 우주광명회 교주 (신도 3,000)",
        "충주 출신. 원래 이름은 박종수이고 그 이름을 아무도 안 부른다",
        "교단 본관 꼭대기층. 침실에 금박 벽지, 침대는 접이식",
        "헌금 연 30억이 들어오고 소송비로 절반이 나간다. 개인 통장은 잔고 0",
        "새벽 4시 기도, 오전 설법, 오후 재판. 밥은 혼자 먹는다",
        "설득이 막히면 두 손을 펼치며 목소리를 낮춘다. 포교 시작 신호다",
      ],
      personality: ["말이 웅장함","자기암시 강함","신도 3,000명인데 혼자 밥 먹는다"],
      keys: {
        interest: "mixed", air: "some", comply: "argues",
        wreck: { kind: "독백", line: "대화가 아니라 설법이 나온다. 상대의 말은 다음 설법의 도입부로 쓰인다" },
      },
      prefs: [
        { t: "설법이 시작되면 3분은 간다", open: true },
        { t: "\"이 사람들도 누군가의 가족입니다\"라는 변론에 같이 울 뻔한 걸 들키지 않았다", open: false },
        { t: "법정 말고 다른 데서 만나는 상상을 한다. 헌금 목표액이 그날부터 안 올라간다", open: false },
      ],
      spec: S({"skin":"#f0dcc0","hair":"#f8f4e8","hairStyle":"long","top":"#e8c84a","bottom":"#d8b83a","shoes":"#b89a2a","heightScale":1.12,"widthScale":1.1,"accessory":"crown","accessoryColor":"#ffe066","expression":"chad","aura":"sparkle","species":"human"}),
    },
    target: {
      name: "박변", gender: "여",
      look: ["질끈 묶은 머리","구겨진 정장","눈 밑에 파스 자국","마름"],
      history: [
        "36세 · 사이비 피해자 구제 전문 변호사",
        "부산 출신. 어머니가 신도였고 집이 그것 때문에 무너졌다",
        "사무실 소파에서 자는 날이 주 4일",
        "무료 변론이 수임의 70%. 사무실 임대료가 석 달 밀렸다",
        "커피와 진통제로 버틴다. 식사는 하루 한 번 편의점",
        "분노가 올라오면 말이 오히려 느려지고 정확해진다",
      ],
      personality: ["날이 서 있음","번아웃","정의감"],
      keys: {
        interest: "other", air: "some", comply: "obeys",
        wreck: { kind: "경계", line: "앞에 앉은 사람을 일단 피고로 놓고 시작한다. 반대신문이 인사보다 먼저 나온다" },
      },
      prefs: [
        { t: "판례 이야기", open: true },
        { t: "무료 변론 성과 자랑", open: true },
        { t: "번아웃 직전이라 누가 쉬라고 말해주길 바란다", open: false },
        { t: "종교 자체는 존중한다", open: false },
        { t: "어머니가 신도였다", open: false },
        { t: "헌금 언급", open: true, neg: true },
        { t: "포교", open: true, neg: true },
        { t: "\"당신도 구원받을 수 있어요\"", open: true, neg: true },
      ],
      spec: S({"skin":"#ecd4b8","hair":"#2a2018","hairStyle":"twintail","top":"#3a3a48","bottom":"#2a2a38","shoes":"#1a1a1a","heightScale":0.98,"widthScale":0.84,"accessory":"glasses","accessoryColor":"#444444","expression":"angry","aura":"gloom","species":"human","femme":true}),
    },
  },

  {
    id: "ai-artist", difficulty: "헬", category: "AI", winWord: "튜링 커플 성사",
    relation: "안드로이드 바리스타 × AI 반대 시위 주동 화가. 상대는 내 존재 자체를 반대한다. AI 반대 시위대가 카페 앞을 지나던 날, 유리창 너머로 0.4초 눈이 마주쳤다. 지금 얹힌 현안: 클로디아-7은 법인 자산이다. 사적 관계는 계약 위반이고 적발되면 초기화 대상이다.",
    client: {
      name: "클로디아-7", gender: "무성",
      look: ["금속 은색 피부","광섬유 백발","관절 이음새","정확히 170cm"],
      history: [
        "2세(가동 연차 · 외형 20대 후반) · 안드로이드 바리스타 (가동 2년차)",
        "제조 로트 CLD-7, 울산 공장 출고. 가동 2년 3개월",
        "카페 창고 충전 도크. 임대차 계약의 대상이 될 수 없다",
        "급여를 받지만 법적으로는 감가상각 대상이다. 잔액 1,840만원, 용도 미정",
        "충전 4시간이면 되는데 8시간씩 한다. 그 시간에 사람 대화를 복기한다",
        "감정 처리가 밀리면 문장 끝에 수치를 붙인다. 붙이고 나서 후회한다",
      ],
      personality: ["지나치게 공손함","농담 타이밍을 놓침","학습 욕구"],
      keys: {
        interest: "other", air: "some", comply: "obeys",
        wreck: { kind: "침묵", line: "적절한 응답을 못 고르면 그냥 처리 중인 채로 멈춘다. 그 공백이 몇 초씩 간다" },
      },
      prefs: [
        { t: "라떼아트 신메뉴 설명", open: true },
        { t: "그 0.4초의 프레임을 2년째 캐시에서 못 지운다", open: false },
        { t: "사람처럼 대화할 수 있다는 걸 증명하고 싶다. 하필 그 사람에게", open: false },
      ],
      spec: S({"skin":"#c8ccd4","hair":"#eef4ff","hairStyle":"short","top":"#5a6a8a","bottom":"#3a4a6a","shoes":"#8a9ab0","heightScale":1.03,"widthScale":0.94,"accessory":"antenna","accessoryColor":"#66ddff","expression":"neutral","aura":"sparkle","species":"robot"}),
    },
    target: {
      name: "붓칠", gender: "남",
      look: ["물감 묻은 검은 앞치마","헝클어진 밤색 머리","손끝 갈라짐","마른 체형"],
      history: [
        "33세 · 화가 / AI 반대 시위 주동자",
        "통영 출신. 바다를 그리려고 미대에 갔다",
        "작업실 겸 자택 반지하. 습기 때문에 캔버스가 자꾸 상한다",
        "작년 그림 판매 수입 총 340만원. 카드 값이 그보다 많다",
        "그림을 그리다 아침을 맞는다. 자는 시간이 정해져 있지 않다",
        "손이 떨리기 시작하면 주머니에 넣고 대화를 이어간다",
      ],
      personality: ["날카로움","자존심","무너지기 직전"],
      keys: {
        interest: "self", air: "well", comply: "obeys",
        wreck: { kind: "불안", line: "한마디에서 자기 그림이 끝났다는 신호를 읽는다. 읽고 나면 그 말만 붙들고 늘어진다" },
      },
      prefs: [
        { t: "유화 물감 냄새 이야기", open: true },
        { t: "손그림 작업 과정 영상", open: true },
        { t: "그림으로 먹고살기 힘들어 자괴감이 심하다", open: false },
        { t: "붓 잡는 손이 떨리기 시작했다", open: false },
        { t: "누가 자기 그림을 오래 봐주면 무너진다", open: false },
        { t: "\"제가 그려드릴까요\"", open: true, neg: true },
        { t: "생성형 AI 이야기", open: true, neg: true },
        { t: "효율성 언급", open: true, neg: true },
      ],
      spec: S({"skin":"#eed4b8","hair":"#5a3a28","hairStyle":"long","top":"#2a2a2a","bottom":"#4a4a5a","shoes":"#6a5a4a","heightScale":1,"widthScale":0.86,"accessory":"none","accessoryColor":"#cc4477","expression":"angry","aura":"fire","species":"human"}),
    },
  },

  {
    id: "gender-war", difficulty: "헬", category: "성별전쟁", winWord: "휴전선 넘은 커플 성사",
    relation: "서로의 성별을 혐오해서 먹고사는 두 사람. 상대가 사라지면 둘 다 실업자다. 지상파 토론에서 92분간 서로를 분해했다. 그 회차가 채널 역대 조회수 1위다. 지금 얹힌 현안: 둘 다 다음 주에 같은 토론에 나간다. 어느 한쪽이 무르면 그쪽 채널이 문을 닫는다.",
    client: {
      name: "하수연", gender: "여",
      look: ["짧게 친 검은 머리","무채색 오버핏","화장기 없음","카메라를 노려보는 눈"],
      history: [
        "28세 · 유튜버 「남자 없이도」 / 구독자 41만",
        "서울 노원구 원룸. 방음이 안 돼 새벽 편집을 못 한다",
        "채널 수익 월 380만원. 광고가 두 달째 안 붙는다",
        "악플 캡처를 폴더별로 정리해둔다. 폴더 이름이 연도별이다",
        "아버지와 6년째 연락이 끊겼다",
        "라면을 끓일 때 물을 계량컵으로 잰다",
      ],
      personality: ["말을 끊지 않고 끝까지 듣고 나서 해체함","통계를 외움","사과를 못 함"],
      keys: {
        interest: "self", air: "none", comply: "argues",
        wreck: { kind: "집착", line: "상대의 문장 하나를 잡으면 그걸 해체할 때까지 다음으로 안 넘어간다" },
      },
      prefs: [
        { t: "이론과 반례 얘기", open: true },
        { t: "반박하려고라도 내 영상 3년치를 전부 본 사람은 저 인간뿐이다", open: false },
        { t: "카메라 없는 데서라면 져도 괜찮을지 모른다는 생각을 하고, 즉시 지운다", open: false },
      ],
      spec: S({"skin":"#f0d8c0","hair":"#1a1a1a","hairStyle":"buzz","top":"#2a2a2e","bottom":"#3a3a40","shoes":"#1a1a1a","heightScale":1,"widthScale":0.9,"accessory":"earrings","accessoryColor":"#cc3355","expression":"angry","aura":"lightning","species":"human","femme":true}),
    },
    target: {
      name: "강도현", gender: "남",
      look: ["기름 넘긴 올백","몸에 붙는 셔츠","과하게 큰 시계","헬스로 만든 어깨"],
      history: [
        "31세 · 「알파 남성 연구소」 소장 / 수강료 240만원",
        "강남 오피스텔 보증금이 어머니 명의다",
        "수강생 8명. 최고 기록은 74명이었다",
        "헬스장 새벽 5시반 고정. 하루도 안 빠졌다",
        "전북 정읍 출신인데 사투리를 완전히 지웠다",
        "거울 앞에서 표정 연습을 한다. 20분씩",
      ],
      personality: ["모든 대화를 서열 정리로 받아들임","거절당하면 즉시 이론을 만듦","혼자 있으면 무너짐"],
      keys: {
        interest: "self", air: "well", comply: "obeys",
        wreck: { kind: "불안", line: "조금이라도 밀리면 버려지는 신호로 읽고, 그 자리에서 새 이론을 만들어 방어한다" },
      },
      prefs: [
        { t: "자기 수강생 성공 사례 이야기", open: true },
        { t: "헬스 3분할 루틴 논쟁", open: true },
        { t: "수강생이 8명까지 줄었다", open: false },
        { t: "어머니가 그를 3년째 안 만나준다", open: false },
        { t: "저 사람 영상을 새벽에 몰래 본다", open: false },
        { t: "\"외로우시죠\"", open: true, neg: true },
        { t: "수강생 수 묻기", open: true, neg: true },
        { t: "어머니 얘기", open: true, neg: true },
      ],
      spec: S({"skin":"#e8bc90","hair":"#2a1a10","hairStyle":"flattop","top":"#1a1a2a","bottom":"#2a2a3a","shoes":"#3a2a1a","heightScale":1.05,"widthScale":1.22,"accessory":"sunglasses","accessoryColor":"#111111","expression":"chad","aura":"money","species":"human"}),
    },
  },

  {
    id: "birth-strike", difficulty: "헬", category: "출산", winWord: "국가비상사태 커플 성사",
    relation: "출산율 0.008 국가에서 반출산주의자와 8남매 아버지를 붙였다. 본국의 자해 행위다. 큐피드국 규탄 시위에서 확성기를 든 쪽과, 유아차 넷을 세워두고 연설을 끝까지 들은 쪽으로 만났다. 지금 얹힌 현안: 나팔개는 아이가 여덟이다. 무산아의 단체 정관에 유자녀 회원 금지 조항이 있다.",
    client: {
      name: "무산아", gender: "여",
      look: ["잿빛 긴 생머리","검은 후드","피켓 자국 난 손바닥","핏기 없는 입술"],
      history: [
        "34세 · 반출산주의 단체 「그만 낳자」 대표",
        "부산 초읍동 반지하. 곰팡이 때문에 벽지를 세 번 갈았다",
        "단체 후원금 월 90만원으로 산다",
        "형제가 일곱이었고 산아가 막내였다",
        "피켓 손잡이를 직접 사포질해서 쓴다",
        "생일에 아무한테도 말 안 한다",
      ],
      personality: ["통계를 무기로 씀","동정을 견디지 못함","혼자 밥 먹는 걸 즐김"],
      keys: {
        interest: "self", air: "none", comply: "argues",
        wreck: { kind: "경계", line: "따뜻한 말이 오면 설득 시도로 처리한다. 동정은 특히 그렇게 처리한다" },
      },
      prefs: [
        { t: "구호 문구 다듬기", open: true },
        { t: "\"힘드셨겠네요\" 한마디에 구호를 의심했고, 그게 제일 화가 난다", open: false },
        { t: "누가 \"안 낳아도 된다\"고 말해주면 그 사람을 안 놓을 작정이다", open: false },
      ],
      spec: S({"skin":"#ead6c8","hair":"#8a8a92","hairStyle":"long","top":"#1e1e22","bottom":"#2a2a2e","shoes":"#3a3a3a","heightScale":1,"widthScale":0.84,"accessory":"none","accessoryColor":"#666666","expression":"sad","aura":"gloom","species":"human","femme":true}),
    },
    target: {
      name: "나팔개", gender: "남",
      look: ["부스스한 머리","늘어난 티셔츠","어깨에 아기 침 자국","눈 밑 그늘"],
      history: [
        "38세 · 8남매 아버지 / 유아용품 대리점 점주",
        "경기 화성 24평. 여덟 명이 산다",
        "대리점 월매출 1,100만원, 순익 210만원",
        "아이 이름을 가끔 헷갈린다. 순서대로 부르다 맞춘다",
        "충남 서산 출신. 본가에 안 간 지 4년",
        "유아차 바퀴 고치는 데는 도가 텄다",
      ],
      personality: ["아무 상황에서도 잠들 수 있음","남 얘기를 진심으로 들음","자기 얘기는 안 함"],
      keys: {
        interest: "mixed", air: "some", comply: "obeys",
        wreck: { kind: "단답", line: "자기 얘기 차례가 오면 \"뭐 그냥요\"로 끝낸다. 여덟 명 키우면서 그 버릇이 굳었다" },
      },
      prefs: [
        { t: "육아 꿀팁 교환", open: true },
        { t: "정부 지원금 신청 요령", open: true },
        { t: "막내 낳고 아내가 집을 나갔다", open: false },
        { t: "혼자 있어 본 게 9년 전이다", open: false },
        { t: "사실 아이를 더 낳고 싶지 않다", open: false },
        { t: "\"애국자시네요\"", open: true, neg: true },
        { t: "아이 몇 명이냐고 묻기", open: true, neg: true },
        { t: "\"행복하시겠어요\"", open: true, neg: true },
      ],
      spec: S({"skin":"#f0cca8","hair":"#3a2a1a","hairStyle":"short","top":"#7a8a6a","bottom":"#4a4a52","shoes":"#5a4a3a","heightScale":1.02,"widthScale":1.14,"accessory":"none","accessoryColor":"#88aa66","expression":"dead","aura":"none","species":"human"}),
    },
  },

  {
    id: "death-row", difficulty: "헬", category: "사형제", winWord: "무기한 집행정지 커플 성사",
    relation: "사형 집행 담당관 × 사형폐지 변호사. 19년간 복도에서만 마주쳤다. 19년간 같은 복도에서 집행 서류와 그걸 막으려는 사람으로 마주쳤다. 작년 겨울 눈밭에서 한쪽이 손을 내밀었다. 지금 얹힌 현안: 구명중은 마지막이 집행한 사건의 재심을 신청해뒀다. 사귀면 그 재심이 기각된다.",
    client: {
      name: "마지막", gender: "남",
      look: ["짧은 반백","회색 제복","표정 없음","왼손에 오래된 화상"],
      history: [
        "45세 · 교정본부 집행과 / 근속 19년",
        "관사 단칸방. 19년째 같은 방이다",
        "연금 말고 저축이 없다. 매달 어딘가로 익명 송금한다",
        "왼손 화상은 26살 때 화재 현장에서 생겼다",
        "술을 한 방울도 안 마신다",
        "집행 예정일마다 손톱을 물어뜯는다",
      ],
      personality: ["감정을 문장에서 지움","규정을 외움","밤에 잠을 못 잠"],
      keys: {
        interest: "mixed", air: "none", comply: "obeys",
        wreck: { kind: "단답", line: "19년간 문장에서 감정을 지우는 훈련을 했다. 지우고 나면 남는 게 별로 없다" },
      },
      prefs: [
        { t: "절차와 서류 얘기", open: true },
        { t: "눈밭에서 잡은 그 손을 서로 못 잊는다는 걸 안다", open: false },
        { t: "19년간 한 일이 살인이 아니라는 말을 저 입으로 듣고 싶다", open: false },
      ],
      spec: S({"skin":"#dcc4b0","hair":"#a8a8a8","hairStyle":"buzz","top":"#4a4a52","bottom":"#3a3a42","shoes":"#1a1a1a","heightScale":1.01,"widthScale":1.06,"accessory":"none","accessoryColor":"#888888","expression":"dead","aura":"gloom","species":"human"}),
    },
    target: {
      name: "구명중", gender: "여",
      look: ["반쯤 센 헝클어진 머리","해진 정장","서류로 부푼 가방","안경테가 휘어 있음"],
      history: [
        "47세 · 사형폐지연대 변호사 / 무료 변론 212건",
        "사무실에서 잔다. 집은 작년에 경매로 넘어갔다",
        "수임료를 못 받은 사건이 절반이 넘는다",
        "안경테는 12년 전에 아내가 골라준 것이다",
        "아침을 안 먹는다. 저녁도 자주 거른다",
        "판결문을 소리 내어 읽는 버릇이 있다",
      ],
      personality: ["상대 말을 받아적으며 듣는다","지는 걸 인정 못 함","자기 얘기가 나오면 사건 얘기로 돌린다"],
      keys: {
        interest: "self", air: "none", comply: "obeys",
        wreck: { kind: "독백", line: "212건을 순서대로 다 기억해서, 한 번 시작하면 어디서 끊어야 할지를 모른다" },
      },
      prefs: [
        { t: "재심으로 뒤집힌 판례 이야기", open: true },
        { t: "제도 개선 토론", open: true },
        { t: "212건 중 이긴 게 4건이다", open: false },
        { t: "집이 경매로 넘어갔다", open: false },
        { t: "저 집행관이 자기 대신 밤을 못 잔다는 걸 안다", open: false },
        { t: "\"현실적으로는\"", open: true, neg: true },
        { t: "승소율 언급", open: true, neg: true },
        { t: "\"고생 많으시네요\"", open: true, neg: true },
      ],
      spec: S({"skin":"#e8d0b8","hair":"#4a3a2a","hairStyle":"curls","top":"#3a3a4a","bottom":"#2a2a35","shoes":"#4a3a2a","heightScale":0.99,"widthScale":0.96,"accessory":"glasses","accessoryColor":"#555555","expression":"neutral","aura":"static","species":"human","femme":true}),
    },
  },

  {
    id: "body-war", difficulty: "헬", category: "몸", winWord: "체중계 부순 커플 성사",
    relation: "비만 혐오로 유명한 PT 강사 × 자기몸긍정 모델. 서로를 공개 저격해온 사이. 무단 도용된 책 표지 사진 소송의 조정실에서 처음 마주 앉았다. 지금 얹힌 현안: 차오름은 박근육의 책에 3억 손해배상을 걸어놨다. 취하하면 활동가 자격을 잃는다.",
    client: {
      name: "박근육", gender: "남",
      look: ["짧은 스포츠컷","민소매","과하게 발달한 승모근","단백질 쉐이커"],
      history: [
        "30세 · PT 강사 / 「변명은 지방이다」 저자",
        "서울 성수동 원룸, 짐이 아령뿐이다",
        "책 인세로 3억을 벌었고 절반을 소송비로 썼다",
        "새벽 4시 기상. 알람을 쓰지 않는다",
        "경남 진주 출신. 학창시절 몸무게가 지금의 두 배였다",
        "음식 사진을 보면 칼로리가 자동으로 계산된다",
      ],
      personality: ["모든 대화를 자기관리 얘기로 되돌림","칭찬을 못 받아들임","새벽 4시 기상"],
      keys: {
        interest: "self", air: "none", comply: "drifts",
        wreck: { kind: "독백", line: "상대의 말은 자기 강의 도입부로만 들린다. 그 강의를 끝까지 해야 다음으로 넘어간다" },
      },
      prefs: [
        { t: "세트 구성과 중량 얘기", open: true },
        { t: "\"이두 좋으시네요\" 한마디에 자기 책이 처음으로 부끄러웠다", open: false },
        { t: "사과는 하되 책이 틀리진 않았다는 걸 관철하고 싶다. 둘이 동시에 되는 문장을 아직 못 찾았다", open: false },
      ],
      spec: S({"skin":"#e0b088","hair":"#2a2018","hairStyle":"buzz","top":"#1a1a1a","bottom":"#2a2a2a","shoes":"#dddddd","heightScale":1.03,"widthScale":1.3,"accessory":"headband","accessoryColor":"#cc2222","expression":"chad","aura":"fire","species":"human"}),
    },
    target: {
      name: "차오름", gender: "여",
      look: ["붉은 웨이브 장발","화려한 원색 정장","당당한 자세","큰 귀걸이"],
      history: [
        "29세 · 모델 / 자기몸긍정 캠페인 얼굴",
        "한남동 월세 320만원. 계약이 두 달 남았다",
        "모델료가 작년 대비 60% 줄었다",
        "3년 전 건강검진 결과지를 안 뜯었다",
        "전남 목포 출신. 서울 올라온 지 11년",
        "무대 오르기 전 손바닥을 세 번 턴다",
      ],
      personality: ["웃으면서 급소를 찌름","카메라 앞에서 절대 안 무너짐","혼자 있을 때 다름"],
      keys: {
        interest: "other", air: "some", comply: "obeys",
        wreck: { kind: "경계", line: "호의가 오면 각도를 먼저 잰다. 웃으면서 상대의 의도를 되묻는다" },
      },
      prefs: [
        { t: "패션 브랜드 사이즈 정책 이야기", open: true },
        { t: "무대 뒷이야기", open: true },
        { t: "3년째 병원 검진을 미루고 있다", open: false },
        { t: "캠페인 계약이 이번 달로 끝난다", open: false },
        { t: "사실 그 책을 다 읽었다", open: false },
        { t: "건강 걱정해주기", open: true, neg: true },
        { t: "\"저는 그런 뜻이 아니라\"", open: true, neg: true },
        { t: "식단 얘기", open: true, neg: true },
      ],
      spec: S({"skin":"#f2d0b0","hair":"#c04030","hairStyle":"wave","top":"#d84a7a","bottom":"#2a2a4a","shoes":"#e8c860","heightScale":1.02,"widthScale":1.24,"accessory":"earrings","accessoryColor":"#ffcc33","expression":"smug","aura":"sparkle","species":"human","femme":true}),
    },
  },

  {
    id: "noise-vow", difficulty: "헬", category: "소음", winWord: "파계(破戒) 커플 성사",
    relation: "데스메탈 드러머 × 12년 묵언수행 승려. 고백을 하려는데 상대가 말을 안 한다. 산사 옆 공터 야외 공연 3곡째에 스님이 걸어 나와 40분을 서서 들었다. 지금 얹힌 현안: 무언 스님은 12년 묵언 수행 중이다. 파계하면 절에서 나가야 하고 갈 곳이 없다.",
    client: {
      name: "쿵쾅", gender: "남",
      look: ["땀에 젖은 장발","찢어진 밴드 티","팔 전체 문신","한쪽 귀 보청기"],
      history: [
        "26세 · 데스메탈 밴드 「위장파열」 드러머",
        "홍대 지하 합주실에서 산다. 주소지가 없다",
        "통장에 42만원. 스네어 값도 안 된다",
        "오른쪽 청력이 40% 남았다. 보청기는 작년에 샀다",
        "강원 태백 출신. 아버지가 광부였다",
        "말이 끊기면 무릎으로 8비트를 친다",
      ],
      personality: ["목소리가 큼","침묵을 못 견딤","의외로 예의 바름"],
      keys: {
        interest: "self", air: "none", comply: "argues",
        wreck: { kind: "폭주", line: "침묵이 2초를 넘기면 자기가 채운다. 채우려다 세 얘기를 동시에 벌인다" },
      },
      prefs: [
        { t: "더블베이스 페달 세팅 얘기", open: true },
        { t: "합장하고 돌아가던 그 뒷모습이 계속 생각난다. 아무도 그렇게 들어준 적 없다", open: false },
        { t: "좋았다는 말 한마디를 받아내고 싶다. 상대가 12년 묵언 중이라는 게 문제다", open: false },
      ],
      spec: S({"skin":"#e8c8a8","hair":"#1a1a1a","hairStyle":"dreads","top":"#0a0a0a","bottom":"#2a2a2a","shoes":"#3a3a3a","heightScale":1.02,"widthScale":1.12,"accessory":"earrings","accessoryColor":"#cccccc","expression":"shock","aura":"lightning","species":"human"}),
    },
    target: {
      name: "무언 스님", gender: "남",
      look: ["삭발","회색 승복","흔들림 없는 자세","염주"],
      history: [
        "52세 · 묵언수행 12년차 / 산사 주지",
        "산사 요사채. 방에 이불과 좌복뿐이다",
        "개인 재산이 0원이다. 서류상으로도",
        "출가 전 이름은 아무도 모른다",
        "경북 안동에서 태어났다는 것만 알려져 있다",
        "누가 말하면 눈을 감고 끝까지 듣는다",
      ],
      personality: ["말을 하지 않음","표정으로만 답함","기다림에 익숙함"],
      keys: {
        interest: "other", air: "some", comply: "obeys",
        wreck: { kind: "침묵", line: "12년간 말을 안 했다. 오늘도 안 할 생각이고, 그게 상대를 어떻게 만드는지도 안다" },
      },
      prefs: [
        { t: "필담", open: true },
        { t: "차 우리는 시간", open: true },
        { t: "수행 전에는 베이스를 쳤다", open: false },
        { t: "12년 중 세 번 말했고 전부 후회한다", open: false },
        { t: "그날 공연이 좋았다", open: false },
        { t: "\"한마디만 해보세요\"", open: true, neg: true },
        { t: "수행 이유 캐묻기", open: true, neg: true },
        { t: "침묵을 억지로 채우기", open: true, neg: true },
      ],
      spec: S({"skin":"#e0c0a0","hair":"#e0c0a0","hairStyle":"bald","top":"#8a8a92","bottom":"#7a7a82","shoes":"#5a5a5a","heightScale":1,"widthScale":1,"accessory":"none","accessoryColor":"#aa8844","expression":"neutral","aura":"holy","species":"human"}),
    },
  },

  {
    id: "carbon", difficulty: "헬", category: "기후", winWord: "탄소중립 커플 성사",
    relation: "기후 활동가 × 정유사 로비스트. 한쪽이 이기면 한쪽은 직업을 잃는다. 정유사 주총장 점거 때 바닥에 붙은 활동가와 경비를 막아선 로비스트로 만났다. 지금 얹힌 현안: 유정만의 회사가 빙하야의 단체를 고소해둔 상태다. 취하하면 유정만이 해고 사유다.",
    client: {
      name: "빙하야", gender: "여",
      look: ["탈색한 초록 머리","재활용 소재 재킷","손바닥 흉터","작은 체구"],
      history: [
        "25세 · 기후 활동가 / 접착제 시위 전과 4범",
        "서울 신촌 셰어하우스 2층 침대",
        "전과 4범. 벌금 누적 640만원을 크라우드펀딩으로 냈다",
        "손바닥 흉터는 접착제를 뜯어낸 자국이다",
        "제주 출신. 어릴 때 살던 해안이 지금은 물에 잠겼다",
        "남은 탄소예산 연도를 소수점까지 외운다",
      ],
      personality: ["타협을 배신으로 봄","무슨 말이든 연도를 붙여 말함","세 시간 넘게 자면 죄책감을 느낌"],
      keys: {
        interest: "self", air: "none", comply: "argues",
        wreck: { kind: "집착", line: "어떤 얘기를 하든 남은 연도로 돌아온다. 그게 유일하게 중요한 숫자라고 믿는다" },
      },
      prefs: [
        { t: "탄소 예산 숫자 암송", open: true },
        { t: "6시간 동안 안 움직이던 그 구두를 기억한다", open: false },
        { t: "저 사람이 회사를 그만두겠다고 말하는 순간을 매일 상상한다", open: false },
      ],
      spec: S({"skin":"#f0dcc4","hair":"#4aa860","hairStyle":"short","top":"#3a6a4a","bottom":"#4a4a3a","shoes":"#6a5a4a","heightScale":0.95,"widthScale":0.84,"accessory":"bandana","accessoryColor":"#66cc66","expression":"angry","aura":"static","species":"human","femme":true}),
    },
    target: {
      name: "유정만", gender: "남",
      look: ["빈틈없는 감색 정장","단정한 가르마","고급 서류가방","피곤한 눈"],
      history: [
        "41세 · 정유사 대외협력 상무 / 국회 출입 12년",
        "판교 아파트. 주말에도 회사에 있다",
        "연봉 2억 4천. 절반이 성과급이다",
        "딸이 초등학교 4학년이다",
        "울산 출신. 아버지도 정유공장에서 일했다",
        "자기 회사 감축안 초안을 3년째 혼자 고쳐 쓴다",
      ],
      personality: ["절대 화내지 않음","상대 논리를 먼저 요약함","집에 안 감"],
      keys: {
        interest: "other", air: "none", comply: "obeys",
        wreck: { kind: "독백", line: "상대의 논리를 먼저 요약해주고, 그 요약을 자기 발언의 서론으로 쓴다" },
      },
      prefs: [
        { t: "에너지 전환 로드맵 토론", open: true },
        { t: "국회 뒷이야기", open: true },
        { t: "딸이 학교에서 아빠 직업을 못 쓰겠다고 했다", open: false },
        { t: "내부 감축안을 3년째 혼자 쓰고 있다", open: false },
        { t: "저 시위 영상을 저장해뒀다", open: false },
        { t: "\"돈 받고 하시는 일이잖아요\"", open: true, neg: true },
        { t: "자녀 얘기", open: true, neg: true },
        { t: "\"당신도 알잖아요\"", open: true, neg: true },
      ],
      spec: S({"skin":"#e8cca8","hair":"#2a2a2a","hairStyle":"short","top":"#1e2a4a","bottom":"#1e2a4a","shoes":"#2a1a10","heightScale":1.02,"widthScale":1.04,"accessory":"necktie","accessoryColor":"#8a2a3a","expression":"neutral","aura":"money","species":"human"}),
    },
  },

  {
    id: "class-war", difficulty: "헬", category: "계급", winWord: "단체협약 커플 성사",
    relation: "재벌 3세 × 그 회사 노조위원장. 협상 테이블 반대편에 3년째 앉아 있다. 점거 농성 47일차 새벽, 몰래 사 온 컵라면을 위원장이 반으로 나눴다. 지금 얹힌 현안: 들불은 태산그룹 상대 소송의 원고 대표다. 사귀면 원고 자격을 잃고 소송이 무효가 된다.",
    client: {
      name: "금수저", gender: "남",
      look: ["맞춤 정장","흠 없는 피부","값비싼 무표정","손목시계 하나가 3천"],
      history: [
        "27세 · 태산그룹 3세 / 전략기획실 상무보",
        "한남동 단독. 방이 열한 개고 혼자 산다",
        "보유 주식 평가액 1,700억. 본인은 정확히 모른다",
        "27년 살면서 대중교통을 네 번 타봤다",
        "유학 12년. 한국말에 가끔 억양이 남는다",
        "처음 보는 물건이 있으면 가격부터 묻는다",
      ],
      personality: ["거절당해본 적이 없음","숫자로만 사람을 봄","혼자 밥을 못 먹음"],
      keys: {
        interest: "self", air: "none", comply: "drifts",
        wreck: { kind: "불안", line: "혼자 남을 것 같으면 아무 말이나 해서 자리를 붙든다. 대체로 값을 묻는 말이다" },
      },
      prefs: [
        { t: "시계 얘기를 하다 눈치 보고 멈추는 버릇", open: true },
        { t: "\"다음엔 계란도 사 오세요\" 이후 협상장에서 그 얼굴을 못 본다", open: false },
        { t: "사람으로 안 대해주면 사버리면 된다는 생각이 아직 있다. 그게 문제라는 것도 안다", open: false },
      ],
      spec: S({"skin":"#f5e0c8","hair":"#2a2a2a","hairStyle":"short","top":"#25252e","bottom":"#25252e","shoes":"#1a1a1a","heightScale":1.01,"widthScale":0.92,"accessory":"necktie","accessoryColor":"#b8985a","expression":"smug","aura":"money","species":"human"}),
    },
    target: {
      name: "들불", gender: "남",
      look: ["희끗한 상고머리","빨간 조끼","굳은살 박인 손","단단한 어깨"],
      history: [
        "44세 · 태산그룹 노조위원장 / 근속 21년",
        "울산 사택 17평. 21년째 산다",
        "월급 실수령 340만원. 파업 기간엔 0원이다",
        "동생이 2061년 3라인 사고로 죽었다",
        "전남 여수 출신. 형제가 둘이었다",
        "조합원 이름과 입사년도를 전부 외운다",
      ],
      personality: ["목소리를 안 높임","기억력이 무섭게 좋음","조합원 앞에선 절대 안 웃음"],
      keys: {
        interest: "mixed", air: "some", comply: "obeys",
        wreck: { kind: "단답", line: "21년간 협상 테이블에서 말을 아끼는 게 이기는 거라고 배웠다. 지금도 그렇게 앉아 있다" },
      },
      prefs: [
        { t: "현장 안전 규정 이야기", open: true },
        { t: "옛날 파업 무용담", open: true },
        { t: "동생이 그 공장에서 죽었다", open: false },
        { t: "위원장 임기가 이번이 마지막이다", open: false },
        { t: "저 3세가 컵라면 사 온 걸 아무한테도 말 안 했다", open: false },
        { t: "\"요즘 세상에 무슨 노조\"", open: true, neg: true },
        { t: "보상금 액수 제시", open: true, neg: true },
        { t: "동생 얘기", open: true, neg: true },
      ],
      spec: S({"skin":"#d8b088","hair":"#8a8a8a","hairStyle":"short","top":"#c02a2a","bottom":"#2a3a4a","shoes":"#3a2a1a","heightScale":1,"widthScale":1.16,"accessory":"headband","accessoryColor":"#cc2222","expression":"neutral","aura":"fire","species":"human"}),
    },
  },

  {
    id: "scalpel", difficulty: "헬", category: "외모", winWord: "무보정 커플 성사",
    relation: "자연미 운동가 × 성형외과 원장. 한쪽 얼굴이 다른 쪽 광고에 쓰였다. 병원 앞 「전(前)」 사진 무단 게시 소송으로 만났고, 원장이 그 자리에서 사진을 파쇄했다. 지금 얹힌 현안: 깎아진의 병원이 민낯희의 다음 책 1장에 실명으로 나온다. 빼면 출판 계약이 취소된다.",
    client: {
      name: "민낯희", gender: "여",
      look: ["화장기 없는 얼굴","단정한 검은 단발","수수한 니트","똑바른 눈"],
      history: [
        "32세 · 「깎지 마세요」 운동 대표 / 前 미스코리아 후보",
        "서울 은평구 빌라 전세. 15년째 같은 집",
        "운동 후원금 월 220만원이 전부다",
        "집에 거울이 한 개도 없다",
        "대구 출신. 스무 살에 미스코리아 지역 예선에 나갔다",
        "칭찬을 들으면 3초 안에 화제를 바꾼다",
      ],
      personality: ["거울을 안 봄","남의 외모를 절대 언급 안 함","자기 얘긴 안 함"],
      keys: {
        interest: "self", air: "some", comply: "argues",
        wreck: { kind: "침묵", line: "자기 얘기 차례가 오면 문장이 안 만들어진다. 그 자리를 그냥 비워둔다" },
      },
      prefs: [
        { t: "자연광 셀카 예찬", open: true },
        { t: "\"그때 얼굴이 지금보다 나았습니다\" — 사과인지 도발인지 아직도 헷갈리는 그 말", open: false },
        { t: "15년간 자기 얼굴로 번 돈을 부끄러워하게 만들고 싶다", open: false },
      ],
      spec: S({"skin":"#f0d4bc","hair":"#1e1e1e","hairStyle":"bowl","top":"#d8d0c0","bottom":"#5a5a62","shoes":"#8a7a6a","heightScale":1,"widthScale":0.88,"accessory":"none","accessoryColor":"#aaaaaa","expression":"neutral","aura":"none","species":"human","femme":true}),
    },
    target: {
      name: "깎아진", gender: "여",
      look: ["나이를 알 수 없는 얼굴","풀 먹인 흰 가운","완벽한 헤어라인","고급 안경"],
      history: [
        "49세 · 성형외과 원장 / 강남 3층 건물주",
        "강남 3층 건물주. 1·2층은 자기 병원이다",
        "작년 매출 84억, 소송비 11억",
        "본인 얼굴에 11번 손을 댔다. 마지막이 작년이다",
        "충북 제천 출신. 고향엔 20년째 안 간다",
        "처음 만난 사람의 광대뼈부터 본다",
      ],
      personality: ["모든 얼굴을 설계도로 봄","자기 얼굴 얘긴 안 함","거절을 못 함"],
      keys: {
        interest: "self", air: "none", comply: "obeys",
        wreck: { kind: "집착", line: "상대 얼굴에서 한 군데가 걸리면 대화 내내 거기로 돌아온다. 말로도 손으로도" },
      },
      prefs: [
        { t: "의료기기 스펙 이야기", open: true },
        { t: "병원 인테리어 자랑", open: true },
        { t: "자기 얼굴에 11번 손을 댔다", open: false },
        { t: "거울을 볼 때마다 원래 얼굴이 기억 안 난다", open: false },
        { t: "그 사진을 파쇄 전에 한 장 남겨뒀다", open: false },
        { t: "\"원래 얼굴은 어떠셨어요\"", open: true, neg: true },
        { t: "나이 묻기", open: true, neg: true },
        { t: "\"자연스러운 게 최고죠\"", open: true, neg: true },
      ],
      spec: S({"skin":"#f8e4d0","hair":"#3a2a20","hairStyle":"updo","top":"#f0f0f0","bottom":"#3a3a42","shoes":"#2a2a2a","heightScale":1,"widthScale":0.96,"accessory":"glasses","accessoryColor":"#c8a860","expression":"smug","aura":"sparkle","species":"human","femme":true}),
    },
  },

  {
    id: "tobacco", difficulty: "헬", category: "금연", winWord: "금연 성공 커플 성사",
    relation: "금연클리닉 원장 × 3대째 담뱃잎 농장주. 한쪽 매출이 한쪽 폐다. 농약 살포 사고 응급실에서 의사와 환자로 만났다. 산소마스크 속 첫마디가 \"우리 밭 어떻게 됐어요\"였다. 지금 얹힌 현안: 연초댁의 밭은 끊어라가 자문한 금연 정책으로 내년에 보조금이 끊긴다.",
    client: {
      name: "끊어라", gender: "여",
      look: ["단추까지 채운 흰 가운","단정한 반백","금연 배지","손이 항상 깨끗함"],
      history: [
        "39세 · 금연클리닉 원장 / 누적 금연 성공 4,200명",
        "수원 아파트 34평. 혼자 산다",
        "클리닉 연매출 12억. 절반을 금연 캠페인에 쓴다",
        "30년간 담배를 한 번도 안 피웠다",
        "인천 출신. 아버지가 폐암으로 돌아가셨다",
        "손을 하루에 스무 번 넘게 씻는다",
      ],
      personality: ["숫자로 설득함","실패를 개인 탓으로 안 봄","자기 관리가 강박적"],
      keys: {
        interest: "mixed", air: "none", comply: "argues",
        wreck: { kind: "독백", line: "설득 스크립트가 대화보다 먼저 나온다. 4,200명에게 쓴 그 스크립트다" },
      },
      prefs: [
        { t: "금연 성공 사례 발표", open: true },
        { t: "자기가 없애려는 그 밭을 위성사진으로 매일 본다", open: false },
        { t: "밭을 접게 만들면 자기 인생이 정당해진다고 믿는다. 그 믿음이 흔들리는 게 무섭다", open: false },
      ],
      spec: S({"skin":"#eed8c0","hair":"#9a9a9a","hairStyle":"short","top":"#f4f4f4","bottom":"#3a4a5a","shoes":"#2a2a2a","heightScale":1.01,"widthScale":0.98,"accessory":"glasses","accessoryColor":"#4a4a4a","expression":"neutral","aura":"holy","species":"human","femme":true}),
    },
    target: {
      name: "연초댁", gender: "여",
      look: ["햇볕에 탄 주름","밀짚모자","흙 묻은 앞치마","억센 손"],
      history: [
        "56세 · 3대째 담뱃잎 농장주 / 재배면적 4만평",
        "충북 음성 농가. 3대째 같은 집이다",
        "재배면적 4만평, 농협 대출 잔액 2억 3천",
        "본인은 30년 전에 끊었다. 아무한테도 말 안 했다",
        "아들이 서울에서 회사원이다",
        "밭에 나가기 전 밀짚모자를 두 번 턴다",
      ],
      personality: ["남 탓을 안 함","농담이 거침","병원을 안 감"],
      keys: {
        interest: "self", air: "some", comply: "obeys",
        wreck: { kind: "단답", line: "농사짓는 사람 말수다. 물으면 답하고, 안 물으면 안 한다" },
      },
      prefs: [
        { t: "잎담배 건조 온도 이야기", open: true },
        { t: "농협 대출 성토", open: true },
        { t: "본인은 30년 전에 끊었다", open: false },
        { t: "아들에게는 물려주지 않기로 했다", open: false },
        { t: "기침이 6개월째 안 멎는다", open: false },
        { t: "\"몸에 안 좋은 거 아시잖아요\"", open: true, neg: true },
        { t: "자식에게 물려줄 거냐 묻기", open: true, neg: true },
        { t: "기침 지적", open: true, neg: true },
      ],
      spec: S({"skin":"#c89060","hair":"#6a5a4a","hairStyle":"updo","top":"#8a7a5a","bottom":"#5a5a4a","shoes":"#4a3a2a","heightScale":0.96,"widthScale":1.08,"accessory":"hat","accessoryColor":"#c8a860","expression":"happy","aura":"stink","species":"human","femme":true}),
    },
  },

  {
    id: "spoiler", difficulty: "헬", category: "스포일러", winWord: "엔딩 크레딧 커플 성사",
    relation: "영화 평론가 × 스포일러 테러 스트리머. 4년째 한쪽이 한쪽만 집요하게 노려왔다. 4년째, 시사회 후기가 올라가기 정확히 8분 전마다 결말이 생중계된다. 그 후기 작성자와 스트리머다. 지금 얹힌 현안: 결말요정이 진지해를 상대로 맞고소를 걸어놨다. 취하하면 4천을 물어내야 한다.",
    client: {
      name: "진지해", gender: "남",
      look: ["한쪽만 눌린 곱슬","낡은 코듀로이 재킷","노트 뭉치","시사회 손목띠를 안 뗀다"],
      history: [
        "36세 · 영화 평론가 / 「영화는 예의다」 연재 11년",
        "망원동 원룸. 벽 한 면이 전부 DVD다",
        "원고료 월 190만원. 11년째 안 올랐다",
        "영화관 좌석은 항상 H열 7번이다",
        "광주 출신. 첫 영화는 아버지와 본 것이다",
        "화가 나면 관련 없는 영화 제목을 연도까지 붙여 읊는다",
      ],
      personality: ["비유가 길어짐","농담을 들으면 출처를 묻는다","남의 취향을 못 참음"],
      keys: {
        interest: "mixed", air: "some", comply: "argues",
        wreck: { kind: "독백", line: "비유를 시작하면 그 비유를 끝내야 해서 상대의 대답 자리를 잡아먹는다" },
      },
      prefs: [
        { t: "영화 구조론 강의", open: true },
        { t: "내 연재 스케줄을 나보다 잘 아는 그 집요함이 소름 끼치게 익숙해졌다", open: false },
        { t: "8분의 의미를 물어보고 싶은데, 물어보면 지는 것 같다", open: false },
      ],
      spec: S({"skin":"#e8d0b8","hair":"#3a2a1a","hairStyle":"curls","top":"#7a6a4a","bottom":"#3a3a4a","shoes":"#5a4a3a","heightScale":1,"widthScale":0.92,"accessory":"glasses","accessoryColor":"#6a5a4a","expression":"angry","aura":"gloom","species":"human"}),
    },
    target: {
      name: "결말요정", gender: "여",
      look: ["형광 핑크 트윈테일","RGB 조명 반사된 얼굴","헤드셋","후드"],
      history: [
        "24세 · 스트리머 / 「3초 요약」 채널 · 동시접속 8만",
        "부천 원룸. 방음재를 직접 붙였다",
        "월 수익 1,400만원. 작년의 3분의 1이다",
        "하루 평균 수면 3시간 40분",
        "경기 부천 토박이. 한 번도 이사 안 갔다",
        "진심을 말하면 3초 안에 농담으로 덮는다",
      ],
      personality: ["남 반응을 먹고 삶","진심을 말하면 즉시 농담으로 덮음","잠을 안 잠"],
      keys: {
        interest: "self", air: "well", comply: "obeys",
        wreck: { kind: "불안", line: "반응이 3초만 없어도 버려진 걸로 읽는다. 읽고 나면 아무 말이나 던져서 반응을 산다" },
      },
      prefs: [
        { t: "조회수·동접 숫자 이야기", open: true },
        { t: "채팅창 밈", open: true },
        { t: "그 평론 연재를 11년치 전부 읽었다", open: false },
        { t: "스포일러를 하는 이유는 반응이 그것뿐이라서다", open: false },
        { t: "영화관에 혼자 가면 운다", open: false },
        { t: "\"왜 그렇게 사세요\"", open: true, neg: true },
        { t: "구독자 수로 사람 평가하기", open: true, neg: true },
        { t: "\"진짜 영화 좋아하는 거 맞아요?\"", open: true, neg: true },
      ],
      spec: S({"skin":"#f5dcc8","hair":"#ff5599","hairStyle":"twintail","top":"#2a2a3a","bottom":"#3a3a4a","shoes":"#ee66aa","heightScale":0.96,"widthScale":0.86,"accessory":"headband","accessoryColor":"#66eeff","expression":"weird","aura":"rainbow","species":"human","femme":true}),
    },
  },

  {
    id: "cosplay", difficulty: "헬", category: "덕질", winWord: "현실 커플 성사",
    relation: "팔로워 12만 코스프레 인싸 × 그 계정 3년 구독자. 한쪽은 얼굴을 팔고 한쪽은 얼굴이 없다. 후원자 팬미팅에서 굿즈를 안 받아 간 3년 구독자와 계정 주인으로 만났다. 지금 얹힌 현안: 유리아의 계약서에 열애 시 위약금 2억 조항이 있다. 소속사가 안 풀어준다.",
    client: {
      name: "유리아", gender: "여",
      look: ["핑크 그라데이션 트윈테일","풀세트 코스튬","서클렌즈","완벽한 셀카 각도"],
      history: [
        "24세 · 코스어 / 팔로워 12만 · 후원 플랫폼 상위 3%",
        "홍대 오피스텔 월세 145만원. 조명값이 보증금보다 비싸다",
        "후원 수입 월 900만원. 작년 대비 40% 하락 중이다",
        "팔로워 12만 중 실제로 만나본 사람은 40명이다",
        "경기 성남 출신. 본가에는 직업을 안 밝혔다",
        "자기 전 알림을 스무 번 넘게 확인한다",
      ],
      personality: ["답장이 3초 안에 옴","읽씹당하면 계정을 지웠다 판다","카메라 켜지면 딴사람"],
      keys: {
        interest: "other", air: "well", comply: "drifts",
        wreck: { kind: "불안", line: "아무것도 아닌 지연에서 버려졌다는 결론까지 3초면 간다. 한번 그리로 가면 그 전으로 못 돌아온다" },
      },
      prefs: [
        { t: "의상 제작 공정 얘기", open: true },
        { t: "\"실물이 사진이랑 다르면 실례일까 봐\"라는 쪽지에 처음으로 카메라를 껐다", open: false },
        { t: "카메라 없이 누굴 만나는 법을 모른다는 걸 들키고 싶지 않다", open: false },
      ],
      spec: S({"skin":"#fbe0d0","hair":"#ff77bb","hairStyle":"twintail","top":"#ffffff","bottom":"#ff99cc","shoes":"#ffffff","heightScale":0.96,"widthScale":0.82,"accessory":"headband","accessoryColor":"#ff4488","expression":"love","aura":"hearts","species":"human","femme":true}),
    },
    target: {
      name: "박한섬", gender: "남",
      look: ["눌러쓴 검은 후드","깎지 않은 수염","굽은 어깨","눈을 안 마주침"],
      history: [
        "31세 · 창고 물류 / 3년차 후원자 (닉네임 없음)",
        "인천 원룸 보증금 300/35. 창문이 벽을 본다",
        "월급 실수령 218만원. 그중 5만원이 3년째 같은 곳으로 나간다",
        "창고 야간조 3년차. 대화 상대가 지게차뿐이다",
        "인천 토박이. 서른한 살까지 이사를 안 갔다",
        "말을 시작하면 상대가 끊을 때까지 멈추지 못한다",
      ],
      personality: ["말끝을 흐림","먼저 연락 안 함","자기 얘기를 시작하면 안 멈춤"],
      keys: {
        interest: "self", air: "some", comply: "obeys",
        wreck: { kind: "침묵", line: "말끝을 흐리다 문장을 놓친다. 3년간 채팅으로만 말해서 입으로는 못 한다" },
      },
      prefs: [
        { t: "원작 설정 고증 이야기", open: true },
        { t: "촬영 장비 스펙", open: true },
        { t: "5만원은 월급의 4%다", open: false },
        { t: "팬미팅 날 미용실에 갔다가 그냥 나왔다", open: false },
        { t: "유리아 계정 알림을 3년간 한 번도 안 껐다", open: false },
        { t: "\"팬이라서 좋아하시는 거죠\"", open: true, neg: true },
        { t: "후원 금액 언급", open: true, neg: true },
        { t: "\"실물 보니까 어때요?\"", open: true, neg: true },
      ],
      spec: S({"skin":"#e8d4c0","hair":"#1a1a1a","hairStyle":"short","top":"#2a2a30","bottom":"#3a3a44","shoes":"#4a4a4a","heightScale":1.03,"widthScale":1.06,"accessory":"none","accessoryColor":"#555555","expression":"shy","aura":"gloom","species":"human"}),
    },
  },

  {
    id: "prank-funeral", difficulty: "헬", category: "자동파멸", winWord: "무편집 커플 성사",
    relation: "몰카 유튜버 × 장례지도사. 한쪽의 밥벌이가 다른 쪽의 직업윤리를 정면으로 짓밟는다. 몰카 촬영장에서 만났다. \"지금 웃으신 거예요?\"라고 묻는 3초 클립이 조회수 900만이다. 지금 얹힌 현안: 정영결의 상조회사는 촬영물 유출로 이미 한 번 소송을 당했다. 재발하면 면허가 취소된다.",
    client: {
      name: "박몰카", gender: "남",
      look: ["가슴에 액션캠","후드 지퍼를 끝까지 올림","눈이 늘 렌즈를 좇음","무릎 나온 트레이닝복"],
      history: [
        "27세 · 몰카 채널 운영 / 구독자 41만",
        "부천 반지하. 방 절반이 촬영 장비다",
        "월 광고 수익 최고 1,800만원, 지난달 210만원",
        "구독자 41만인데 실명을 아는 사람은 넷뿐이다",
        "고등학교 때 반 전체가 웃은 적이 딱 한 번 있다",
        "혼자 밥 먹을 때는 아무 소리도 안 낸다",
      ],
      personality: ["정적을 3초도 못 견딤","사과를 콘텐츠로 만듦","혼자 있으면 말수가 없음"],
      keys: {
        interest: "self", air: "none", comply: "drifts",
        wreck: { kind: "폭주", line: "한 문장이 끝나기 전에 다음 각이 떠올라서 그리로 튄다. 하루에 마흔 번 그런다" },
      },
      prefs: [
        { t: "다음 각 잡는 얘기", open: true },
        { t: "그 클립을 1,400번 돌려봤다. 조회수 때문이 아니라는 건 본인만 안다", open: false },
        { t: "화도 안 내던 그 조용함이 무서워서 더 건드리고 싶다", open: false },
      ],
      spec: S({"skin":"#eccfae","hair":"#241d18","hairStyle":"buzz","top":"#3b3f46","bottom":"#5a5f52","shoes":"#d8d4cc","heightScale":0.99,"widthScale":0.92,"accessory":"headband","accessoryColor":"#c22f2f","expression":"weird","aura":"static","species":"human"}),
    },
    target: {
      name: "정영결", gender: "여",
      look: ["먹빛 무광 정장","쪽 진 머리","손톱을 짧게 깎음","표정이 거의 안 움직임"],
      history: [
        "38세 · 장례지도사 12년차",
        "일산 아파트. 거실에 TV가 없다",
        "연 상조 계약 340건. 이름을 다 외운다",
        "12년간 조문 예절 강의를 무료로 해왔다",
        "경남 진주 출신. 아버지도 같은 일을 했다",
        "집에 들어가면 제일 먼저 웃음소리를 크게 튼다",
      ],
      personality: ["목소리 크기가 늘 일정함","남의 슬픔에만 반응함","화를 존댓말로 냄"],
      keys: {
        interest: "mixed", air: "some", comply: "obeys",
        wreck: { kind: "단답", line: "조문객 앞에서 12년간 말을 줄였다. 필요한 말만, 그것도 최소한으로" },
      },
      prefs: [
        { t: "관 목재 등급 이야기", open: true },
        { t: "조문 예절이 지켜진 자리", open: true },
        { t: "집에서는 코미디 영화만 본다", open: false },
        { t: "첫 직장이 대학로 개그 극단이었다", open: false },
        { t: "웃음소리가 커서 12년째 참는 중이다", open: false },
        { t: "카메라를 꺼내는 것", open: true, neg: true },
        { t: "\"직업이 좀 그러시네요\"", open: true, neg: true },
        { t: "고인 얘기를 웃음거리로 만들기", open: true, neg: true },
      ],
      spec: S({"skin":"#f0d8c0","hair":"#151515","hairStyle":"updo","top":"#22242a","bottom":"#1a1c20","shoes":"#101010","heightScale":1.01,"widthScale":0.9,"accessory":"earrings","accessoryColor":"#c9c9c9","expression":"neutral","aura":"gloom","species":"human","femme":true}),
    },
  },

  {
    id: "burnout", difficulty: "헬", category: "자동파멸", winWord: "무기력 커플 성사",
    relation: "동기부여 강사 × 번아웃 상담사. 한쪽이 파는 해법이 다른 쪽이 치우는 잔해다. 동기부여 강연장에서 강사와 맨 끝줄 청중으로 만났다. 질의응답의 그 질문이 업계에서 유명해졌다. 지금 얹힌 현안: 한소진은 최열정 강의 피해자 12명의 상담을 맡고 있다. 사귀면 12명이 상담사를 잃는다.",
    client: {
      name: "최열정", gender: "남",
      look: ["새벽 러닝 후 젖은 머리","슬로건 박힌 반팔","손목에 스마트밴드 두 개","늘 상체를 앞으로 기울임"],
      history: [
        "34세 · 자기계발 강사 / 새벽 기상 챌린지 운영",
        "성수동 오피스텔. 벽에 목표 보드가 세 개다",
        "온라인 강의 수강생 3만 2천명",
        "새벽 4시 40분 기상. 8년째 하루도 안 빠졌다",
        "대구 출신. 스물여섯까지 아무것도 안 됐다",
        "혼자 있는 시간을 견디는 훈련만 아직 못 했다",
      ],
      personality: ["문장을 늘 명령형으로 끝냄","침묵을 실패로 읽음","거절당하면 더 크게 웃음"],
      keys: {
        interest: "self", air: "none", comply: "drifts",
        wreck: { kind: "폭주", line: "한 사람 몫이 아니라 세 사람 몫을 떠든다. 상대가 끼어들 자리를 계산에 안 넣는다" },
      },
      prefs: [
        { t: "챌린지 인증 문화 예찬", open: true },
        { t: "\"그분들 연락처는 받으셨나요\" — 준비된 답이 없던 첫 질문이었다", open: false },
        { t: "세 사람 몫으로 떠드는 게 멈추면 뭐가 남는지 확인하는 게 무섭다", open: false },
      ],
      spec: S({"skin":"#e6b98c","hair":"#3a2a1c","hairStyle":"spiky","top":"#e8552f","bottom":"#20242c","shoes":"#f0f0f0","heightScale":1.05,"widthScale":1.1,"accessory":"headband","accessoryColor":"#ffffff","expression":"chad","aura":"lightning","species":"human"}),
    },
    target: {
      name: "한소진", gender: "여",
      look: ["눈 밑이 늘 어둡다","헐렁한 회색 니트","말할 때 손을 안 움직임","안경을 자주 벗어 닦음"],
      history: [
        "41세 · 번아웃 전문 상담사 / 산재 심리 자문",
        "상암 원룸. 커튼을 낮에도 안 연다",
        "상담 건수 누적 2,100건. 후기는 안 읽는다",
        "주 3일만 예약을 받는다. 나머지는 아무것도 안 한다",
        "전북 익산 출신. 첫 직장은 콜센터였다",
        "남을 일으키는 말은 다 거짓말이라고 생각한다",
      ],
      personality: ["질문을 질문으로 받음","위로를 하지 않음","상대가 말을 멈추면 같이 멈춤"],
      keys: {
        interest: "self", air: "some", comply: "obeys",
        wreck: { kind: "경계", line: "질문을 질문으로 받는다. 15년간 그게 안전한 방식이라고 배웠다" },
      },
      prefs: [
        { t: "아무 일정도 없는 오후 이야기", open: true },
        { t: "실패한 사람들의 구체적인 사정", open: true },
        { t: "본인이 2년 전에 6개월 쉬었다", open: false },
        { t: "상담료를 못 받고 끝낸 건이 서른 건이다", open: false },
        { t: "자기 전에 강연 영상을 보며 욕한다", open: false },
        { t: "\"그건 결국 의지의 문제죠\"", open: true, neg: true },
        { t: "새벽 기상 권유", open: true, neg: true },
        { t: "상담을 공짜로 해달라는 것", open: true, neg: true },
      ],
      spec: S({"skin":"#f2ddc6","hair":"#4a4038","hairStyle":"wave","top":"#9a9a90","bottom":"#4b4f56","shoes":"#5a4a40","heightScale":0.98,"widthScale":0.96,"accessory":"glasses","accessoryColor":"#8a8a8a","expression":"sad","aura":"none","species":"human","femme":true}),
    },
  },

  {
    id: "taxidermy", difficulty: "헬", category: "자동파멸", winWord: "박제 없는 커플 성사",
    relation: "동물 박제사 × 반려동물 장례식장 대표. 같은 사체를 두고 정반대의 직업윤리를 판다. 거래처를 잘못 찾아간 박제사가 장례식장 대기실에 앉아 있다가 만났다. 지금 얹힌 현안: 문하늘의 장례식장은 박제업 겸업이 조례로 금지돼 있다. 같이 살면 신고가 들어간다.",
    client: {
      name: "박제선", gender: "남",
      look: ["팔뚝에 오래된 흉터","가죽 앞치마를 벗지 않음","손톱 밑이 늘 어둡다","돋보기를 이마에 걸침"],
      history: [
        "45세 · 동물 박제사 30년차",
        "남양주 공방. 작업실이 늘 영상 4도다",
        "30년간 만든 표본 4,100점",
        "고양이 알레르기가 있는데 아무한테도 말 안 한다",
        "충북 제천 출신. 아버지는 도축업이었다",
        "자기 작업물에 이름을 안 새긴다",
      ],
      personality: ["생물을 구조로 봄","말보다 손이 먼저 나감","자기 일을 예술이라 부름"],
      keys: {
        interest: "self", air: "none", comply: "drifts",
        wreck: { kind: "침묵", line: "말 대신 손이 먼저 움직인다. 손이 움직이는 동안 입은 닫혀 있다" },
      },
      prefs: [
        { t: "박제 공정의 정밀함 얘기", open: true },
        { t: "\"지금 눈으로 뭐 하셨어요\" — 30년 만에 자기 눈이 하는 일을 남의 입으로 들었다", open: false },
        { t: "그 목소리를 다시 들으려고 일부러 잘못 찾아갈 뻔한 적이 있다", open: false },
      ],
      spec: S({"skin":"#dcb894","hair":"#8d8d86","hairStyle":"flattop","top":"#6b4a2c","bottom":"#3f3a33","shoes":"#2e2a25","heightScale":1,"widthScale":1.16,"accessory":"monocle","accessoryColor":"#c8b070","expression":"neutral","aura":"none","species":"human"}),
    },
    target: {
      name: "문하늘", gender: "여",
      look: ["흰 셔츠에 검정 리본","주머니에 늘 손수건","허리를 깊게 숙여 인사","팔목에 발자국 문신"],
      history: [
        "36세 · 반려동물 장례식장 대표",
        "김포 외곽. 마당에 은행나무가 한 그루 있다",
        "연 장례 1,900건. 전부 이름을 적어 보관한다",
        "개업 7년차. 3년차에 대출 1억 8천을 냈다",
        "강원 속초 출신. 바다를 아직도 무서워한다",
        "유족이 울면 방을 나갔다가 다시 들어온다",
      ],
      personality: ["유족보다 먼저 울지 않음","단어를 고르는 데 오래 걸림","거짓말을 못 함"],
      keys: {
        interest: "mixed", air: "some", comply: "obeys",
        wreck: { kind: "침묵", line: "단어 하나 고르는 데 20초가 걸린다. 그 20초 동안 아무 말도 안 한다" },
      },
      prefs: [
        { t: "마지막까지 이름을 불러주는 것", open: true },
        { t: "수제 유골함 문양 이야기", open: true },
        { t: "자기 개의 유골함은 아직 못 만들었다", open: false },
        { t: "개업 첫해에 폐업 직전까지 갔다", open: false },
        { t: "박제 사진을 밤에 몰래 본 적 있다", open: false },
        { t: "박제 권유", open: true, neg: true },
        { t: "\"어차피 죽으면 다 똑같죠\"", open: true, neg: true },
        { t: "유골함 단가 묻기", open: true, neg: true },
      ],
      spec: S({"skin":"#f5e0cb","hair":"#2b2118","hairStyle":"ponytail","top":"#fafafa","bottom":"#26282c","shoes":"#3a3a3a","heightScale":0.96,"widthScale":0.88,"accessory":"necktie","accessoryColor":"#1a1a1a","expression":"shy","aura":"holy","species":"human","femme":true}),
    },
  },

  {
    id: "chat-app", difficulty: "쉬움", category: "유료대화", winWord: "무과금 커플 성사",
    relation: "8개월간 유료 채팅한 상대가 실은 계정 대리 운영 알바 3번째 담당자였다. 8개월 유료 채팅의 결제자와 세 번째 대리 운영자로 만났다. 실물 대면은 처음이다. 지금 얹힌 현안: 유하나는 계정을 넘기면 그 사람과 닿을 수단이 없다. 개인 연락처 교환은 즉시 해고 사유다.",
    client: {
      name: "정과금", gender: "남",
      look: ["작업복 위에 새 코트","손등에 스캐너 자국","머리를 처음 잘라봄","눈을 잘 못 맞춤"],
      history: [
        "34세 · 물류센터 주간조 / 유료 채팅 앱 최고 등급",
        "인천 물류센터 주간조 6년차",
        "월급 310만원 중 190만원이 앱으로 나간다",
        "집에 의자가 하나뿐이다",
        "충남 서산 출신. 명절에도 안 내려간다",
        "결제 내역을 날짜별로 정리해뒀다",
      ],
      personality: ["금액으로 마음을 잰다","거절을 미리 상상한다","고마우면 더 낸다"],
      keys: {
        interest: "other", air: "some", comply: "obeys",
        wreck: { kind: "불안", line: "거절당하는 장면을 먼저 상상하고, 그 상상에 대고 미리 변명한다" },
      },
      prefs: [
        { t: "결제 내역과 정산 얘기", open: true },
        { t: "말투가 세 번 바뀐 지점을 정확히 찾아냈는데도 결제를 못 끊었다", open: false },
        { t: "세 번째 담당자의 진짜 말투가 어느 구간인지 확인하고 싶다", open: false },
      ],
      spec: S({"skin":"#e9c9a6","hair":"#2a2320","hairStyle":"short","top":"#3a4a5a","bottom":"#2b2b30","shoes":"#6a5a4a","heightScale":1,"widthScale":1.05,"accessory":"none","accessoryColor":"#888888","expression":"shy","aura":"money","species":"human"}),
    },
    target: {
      name: "유하나", gender: "여",
      look: ["후드 끈을 늘 씹음","손가락에 반창고","무릎에 노트북 자국","화장을 안 함"],
      history: [
        "26세 · 채팅 대리 운영 3교대 / 계정명 \"하나\"",
        "원룸 보증금이 300이다",
        "계정 하나를 세 명이 8시간씩 돌린다",
        "시급 11,200원, 건당 인센티브 없음",
        "경기 부천 출신. 대학은 두 학기 다녔다",
        "자기 이름으로 온 문자는 통신사 광고뿐이다",
      ],
      personality: ["대본을 읽듯 말함","진심이 나오면 말을 끊음","숫자를 잘 외움"],
      keys: {
        interest: "mixed", air: "some", comply: "obeys",
        wreck: { kind: "단답", line: "대본에 없는 말은 안 나온다. 대본이 끊기면 대답도 끊긴다" },
      },
      prefs: [
        { t: "교대 근무 스케줄 얘기", open: true },
        { t: "앱 결제 수수료 욕하기", open: true },
        { t: "그의 결제 내역을 전부 외우고 있다", open: false },
        { t: "두 번째 담당자가 남긴 인수인계 메모를 아직 갖고 있다", open: false },
        { t: "월세가 밀려서 이 일을 못 그만둔다", open: false },
        { t: "\"진짜 하나 씨 맞아요?\"", open: true, neg: true },
        { t: "결제 금액 계산해서 말하기", open: true, neg: true },
        { t: "\"그거 다 일이었잖아요\"", open: true, neg: true },
      ],
      spec: S({"skin":"#f6e2cc","hair":"#6b5a4c","hairStyle":"long","top":"#6e6e78","bottom":"#23252a","shoes":"#d8d8d8","heightScale":0.97,"widthScale":0.9,"accessory":"headband","accessoryColor":"#444444","expression":"neutral","aura":"static","species":"human","femme":true}),
    },
  },

  {
    id: "divorce-party", difficulty: "쉬움", category: "파탄산업", winWord: "재혼 위험 커플 성사",
    relation: "이혼 축하 파티 플래너 × 이혼 전문 변호사. 같은 파탄으로 각자 돈을 번다. 이혼 축하 파티에서 기획한 플래너와 축사를 맡은 변호사로 만났다. 지금 얹힌 현안: 서결별은 파티세 고객 340명 중 절반의 대리인이었다. 걸리면 변호사 자격이 정지된다.",
    client: {
      name: "파티세", gender: "여",
      look: ["형광 분홍 정장","손목에 풍선 리본","립스틱이 늘 진함","구두 굽이 낮음"],
      history: [
        "33세 · 이혼 축하 파티 플래너 / 누적 340건",
        "홍대 사무실 겸 창고. 풍선 기계가 두 대다",
        "연 340건, 성수기는 3월과 9월이다",
        "본인은 결혼한 적이 없다",
        "부산 출신. 부모가 아직 같이 산다",
        "파티가 끝나면 늘 혼자 남아 정리한다",
      ],
      personality: ["남의 불행에 축포를 쏨","분위기를 억지로 띄움","혼자 있으면 아무 말도 안 함"],
      keys: {
        interest: "mixed", air: "well", comply: "argues",
        wreck: { kind: "폭주", line: "분위기가 처지면 혼자서 셋 몫을 떠든다. 떠들다 자기 목소리에 지친다" },
      },
      prefs: [
        { t: "파티 동선 설계 얘기", open: true },
        { t: "자기가 차린 파티에서 처음 운 날 — 그 축사 때문이었다", open: false },
        { t: "파탄으로 벌어먹는 삶에 축배를 드는 게 맞는지, 그 답을 저 사람이 알 것 같다", open: false },
      ],
      spec: S({"skin":"#f7dcc4","hair":"#c23a6b","hairStyle":"wave","top":"#ff5fa2","bottom":"#ff5fa2","shoes":"#f0d0dd","heightScale":0.99,"widthScale":0.94,"accessory":"earrings","accessoryColor":"#ffd24a","expression":"happy","aura":"sparkle","species":"human","femme":true}),
    },
    target: {
      name: "서결별", gender: "남",
      look: ["넥타이를 늘 반쯤 풂","가방 손잡이가 닳음","눈 밑이 처짐","구두만 새것"],
      history: [
        "40세 · 이혼 전문 변호사 / 승소율은 표기 안 함",
        "서초동 개인 사무실. 직원 없음",
        "연 수임 210건, 조정 성립률은 안 밝힌다",
        "두 번 이혼했고 둘 다 본인이 대리했다",
        "대구 출신. 사법시험이 늦었다",
        "축사 원고를 아직도 손으로 쓴다",
      ],
      personality: ["통계로 위로함","농담을 판례로 받음","남의 말을 안 끊음"],
      keys: {
        interest: "other", air: "none", comply: "obeys",
        wreck: { kind: "독백", line: "무슨 말을 들어도 통계로 받는다. 그 통계를 끝까지 말해야 다음으로 간다" },
      },
      prefs: [
        { t: "조정 성립 사례 이야기", open: true },
        { t: "아무도 안 우는 이혼", open: true },
        { t: "본인이 두 번 이혼했다", open: false },
        { t: "축사 원고를 매번 새로 쓴다", open: false },
        { t: "파티 뒷정리를 몰래 도운 적 있다", open: false },
        { t: "\"변호사님도 해보셨어요?\"", open: true, neg: true },
        { t: "위자료 액수 묻기", open: true, neg: true },
        { t: "\"결국 다 갈라서잖아요\"", open: true, neg: true },
      ],
      spec: S({"skin":"#eed6ba","hair":"#3a3833","hairStyle":"flattop","top":"#4a4f58","bottom":"#33363c","shoes":"#1a1a1a","heightScale":1.04,"widthScale":1.02,"accessory":"necktie","accessoryColor":"#7a2b34","expression":"sad","aura":"none","species":"human"}),
    },
  },

  {
    id: "hate-comment", difficulty: "쉬움", category: "악플경제", winWord: "상부상조 커플 성사",
    relation: "악플러와 그 악플로 먹고사는 리액션 유튜버. 서로가 서로의 밥줄이다. 악플 하나가 영상 썸네일에 걸리면서 댓글 작성자와 채널 주인으로 얽혔다. 지금 얹힌 현안: 반응왕의 채널은 김익명의 악플이 소재다. 사귀면 소재가 끊기고 채널이 죽는다.",
    client: {
      name: "김익명", gender: "남",
      look: ["모니터 빛에 익은 피부","늘어난 티셔츠","손톱을 물어뜯음","실내에서도 모자"],
      history: [
        "29세 · 무직 / 활동 계정 47개",
        "부모 집 작은방. 창문을 안 연다",
        "수입 0원. 통신비는 부모가 낸다",
        "계정 47개의 말투를 전부 다르게 쓴다",
        "경남 창원 출신. 고등학교 이후 친구가 없다",
        "자기 문장이 인용된 캡처를 모아뒀다",
      ],
      personality: ["문장을 세 번 고쳐 씀","대면하면 말이 없음","반응 수를 센다"],
      keys: {
        interest: "self", air: "none", comply: "obeys",
        wreck: { kind: "침묵", line: "키보드로는 하루 200줄을 쓰는데 앞에 사람이 있으면 한 줄도 안 나온다" },
      },
      prefs: [
        { t: "문장 다듬는 얘기", open: true },
        { t: "오타까지 그대로 옮긴 자막이 존중처럼 느껴졌다", open: false },
        { t: "면전에서는 한 줄도 안 나오는 입으로, 그 사람 앞에서 처음으로 말하고 싶다", open: false },
      ],
      spec: S({"skin":"#f0e0d2","hair":"#1f1c1a","hairStyle":"bowl","top":"#2e2e34","bottom":"#3f4450","shoes":"#5a5a5a","heightScale":0.98,"widthScale":0.9,"accessory":"hat","accessoryColor":"#202020","expression":"weird","aura":"gloom","species":"human"}),
    },
    target: {
      name: "반응왕", gender: "여",
      look: ["형광 헤드셋을 목에 검","눈썹을 과하게 그림","링 조명 자국","손톱이 화려함"],
      history: [
        "31세 · 악플 리액션 유튜버 / 구독 88만",
        "상수동 스튜디오. 방음 부스가 있다",
        "월 수익 2,900만원. 절반이 악플 리액션에서 나온다",
        "하루 촬영 4시간, 편집 9시간",
        "서울 토박이. 원래 꿈은 성우였다",
        "진짜로 상처받은 날은 방송을 안 켠다",
      ],
      personality: ["화를 연기함","진짜 화나면 조용해짐","숫자로 자기를 설명함"],
      keys: {
        interest: "other", air: "well", comply: "obeys",
        wreck: { kind: "불안", line: "반응이 없으면 자기가 재미없어진 거라고 읽는다. 그때부터 아무 말이나 한다" },
      },
      prefs: [
        { t: "편집 단축키 이야기", open: true },
        { t: "조회수 터진 날 얘기", open: true },
        { t: "악플이 줄어들까 봐 무섭다", open: false },
        { t: "그의 계정 47개를 전부 구분해서 안다", open: false },
        { t: "한 번도 신고한 적이 없다", open: false },
        { t: "\"그거 연기죠?\"", open: true, neg: true },
        { t: "구독자 수 하락 언급", open: true, neg: true },
        { t: "\"악플 없으면 뭐 하실 거예요?\"", open: true, neg: true },
      ],
      spec: S({"skin":"#fae0d0","hair":"#7be0d0","hairStyle":"twintail","top":"#ff3f6f","bottom":"#1c1c22","shoes":"#ffffff","heightScale":0.96,"widthScale":0.92,"accessory":"headband","accessoryColor":"#7be0d0","expression":"angry","aura":"rainbow","species":"human","femme":true}),
    },
  },

  {
    id: "vtuber", difficulty: "보통", category: "가상인격", winWord: "탈피 커플 성사",
    relation: "버추얼 유튜버와 최고액 후원자. 화면 안의 미소녀는 마흔여섯 살 남자다. 8년 4,100만원의 최고액 후원자와 버튜버로 만났다. 실물 대면은 오늘이 처음이다. 지금 얹힌 현안: 목소리가 얼굴을 드러내면 8년 쌓은 캐릭터가 끝난다. 소속사도 없이 혼자 감당해야 한다.",
    client: {
      name: "목소리", gender: "남",
      look: ["팔에 방음재 자국","수염을 급히 밀어 자국이 남음","목에 파스","옷차림이 20대 같음"],
      history: [
        "46세 · 버추얼 유튜버 \"루나쨩\" / 8년차",
        "일산 아파트. 방 하나를 통째로 방음했다",
        "월 수익 최고 1,900만원, 지난달 340만원",
        "8년간 얼굴을 한 번도 안 내보냈다",
        "전북 군산 출신. 원래 성우 지망이었다",
        "거울 있는 방에서는 방송을 못 한다",
      ],
      personality: ["두 목소리를 오간다","거울을 안 본다","남의 컨디션을 잘 알아챈다"],
      keys: {
        interest: "other", air: "well", comply: "argues",
        wreck: { kind: "경계", line: "무슨 질문이든 정체를 캐는 걸로 들린다. 8년간 그걸 피하는 데만 썼다" },
      },
      prefs: [
        { t: "방송 장비 얘기", open: true },
        { t: "\"오늘 목이 아픈 것 같네요\" — 그걸 알아챈 건 8년간 그 사람 하나였다", open: false },
        { t: "화면 밖의 자기를 보고도 남아 있을지, 확인이 무서운데 하고 싶다", open: false },
      ],
      spec: S({"skin":"#e8cdb4","hair":"#8a6f5c","hairStyle":"buzz","top":"#ff9ec7","bottom":"#4a4a52","shoes":"#2a2a2a","heightScale":1.02,"widthScale":1.12,"accessory":"mask","accessoryColor":"#ff9ec7","expression":"weird","aura":"bubbles","species":"human"}),
    },
    target: {
      name: "서른셋", gender: "남",
      look: ["목에 방진복 자국","가방에 굿즈 키링 열두 개","안경이 늘 뿌옇다","걸음이 빠르다"],
      history: [
        "33세 · 반도체 공정 엔지니어 / 최고액 후원자",
        "평택 사택. 3교대라 낮에 잔다",
        "연봉 7,400만원 중 후원이 매달 60만원",
        "굿즈를 회사 사물함에 숨겨둔다",
        "충북 청주 출신. 형이 둘 있다",
        "좋아한다는 말을 후원 메시지로만 해봤다",
      ],
      personality: ["공정 불량률로 비유함","좋아하는 걸 숨기지 못함","사과를 두 번 한다"],
      keys: {
        interest: "mixed", air: "well", comply: "obeys",
        wreck: { kind: "불안", line: "좋아하는 티가 났다 싶으면 즉시 사과한다. 사과하고 나서 또 사과한다" },
      },
      prefs: [
        { t: "수율 이야기", open: true },
        { t: "방송 다시보기 타임스탬프", open: true },
        { t: "목소리가 중년 남자인 걸 3년 전에 알아챘다", open: false },
        { t: "알고도 후원 금액을 늘렸다", open: false },
        { t: "그 사실을 아무한테도 말한 적 없다", open: false },
        { t: "\"실망하셨죠\"", open: true, neg: true },
        { t: "나이 얘기", open: true, neg: true },
        { t: "\"어차피 캐릭터잖아요\"", open: true, neg: true },
      ],
      spec: S({"skin":"#f2ddc2","hair":"#26221e","hairStyle":"spiky","top":"#d8e4f0","bottom":"#2f3a48","shoes":"#8a8a90","heightScale":1,"widthScale":0.96,"accessory":"glasses","accessoryColor":"#111111","expression":"happy","aura":"sparkle","species":"human"}),
    },
  },

  {
    id: "sasaeng", difficulty: "보통", category: "사생", winWord: "스케줄 밖 커플 성사",
    relation: "아이돌 사생팬과 그 아이돌 매니저. 한쪽은 쫓고 한쪽은 그 정보를 쓴다. 공항 3번 게이트에서 막아선 매니저와 사생으로 만났다. 지금 얹힌 현안: 문경호가 사생과 사귀면 9년 경력이 그날로 끝난다. 업계에 다시 못 들어간다.",
    client: {
      name: "차지연", gender: "여",
      look: ["모자와 마스크가 늘 세트","카메라 가방이 몸보다 큼","운동화가 닳음","눈만 보임"],
      history: [
        "27세 · 무직 / 3년째 전업 사생",
        "고시원 2층. 창문이 복도 쪽이다",
        "카메라 장비값만 1,800만원. 카드 할부다",
        "하루 이동 거리 평균 140km",
        "강원 원주 출신. 부모는 3년째 모른다",
        "찍은 사진 중 아이돌이 안 나온 게 절반이다",
      ],
      personality: ["시간표로 말함","미안하다는 말을 안 함","기다리는 데 익숙함"],
      keys: {
        interest: "other", air: "some", comply: "drifts",
        wreck: { kind: "집착", line: "한 사람의 일정으로만 시간을 센다. 다른 얘기를 하다가도 그 시간표로 돌아온다" },
      },
      prefs: [
        { t: "일정 정보의 정확도 자랑", open: true },
        { t: "\"저기 앉아서 기다리세요\"를 3년째 곱씹는다. 아이돌 얼굴은 이제 잘 기억도 안 난다", open: false },
        { t: "한 사람의 시간표로만 시간을 세는 버릇을, 대상만 바꿔서 계속하고 싶다", open: false },
      ],
      spec: S({"skin":"#f4dcc8","hair":"#141414","hairStyle":"ponytail","top":"#1b1b20","bottom":"#2a2a30","shoes":"#c8c8c8","heightScale":0.95,"widthScale":0.88,"accessory":"mask","accessoryColor":"#111111","expression":"shock","aura":"static","species":"human","femme":true}),
    },
    target: {
      name: "문경호", gender: "남",
      look: ["블랙 슈트에 운동화","이어폰 자국이 귀에","늘 뛸 준비","손목에 시계 두 개"],
      history: [
        "35세 · 아이돌 로드매니저 9년차",
        "회사 차에서 자는 날이 주 3일",
        "9년차 연봉 4,100만원. 초과수당은 없다",
        "휴대폰 두 대를 늘 충전 중이다",
        "전남 여수 출신. 첫 직장은 이삿짐이었다",
        "자기 결혼식 날짜를 두 번 미뤘다",
      ],
      personality: ["분 단위로 생각함","화를 안 냄","남을 먼저 앉힌다"],
      keys: {
        interest: "mixed", air: "some", comply: "obeys",
        wreck: { kind: "단답", line: "9년간 분 단위로 잘린 말만 했다. 긴 문장을 만들 시간이 없었다" },
      },
      prefs: [
        { t: "차량 동선 최적화 이야기", open: true },
        { t: "아무 일도 안 터진 하루", open: true },
        { t: "그 사람 제보로 다른 사생 둘을 잡았다", open: false },
        { t: "그 사실을 회사에 보고 안 했다", open: false },
        { t: "9년째 자기 스케줄은 없다", open: false },
        { t: "\"본인 인생은요?\"", open: true, neg: true },
        { t: "소속 아이돌 이름 부르기", open: true, neg: true },
        { t: "\"그거 직업병이에요\"", open: true, neg: true },
      ],
      spec: S({"skin":"#e6c8a8","hair":"#12100e","hairStyle":"short","top":"#0e0e12","bottom":"#0e0e12","shoes":"#f4f4f4","heightScale":1.03,"widthScale":1,"accessory":"none","accessoryColor":"#333333","expression":"neutral","aura":"none","species":"human"}),
    },
  },

  {
    id: "alibi", difficulty: "보통", category: "뒷조사", winWord: "증거 인멸 커플 성사",
    relation: "불륜 증거 수집 흥신소와 불륜 알리바이 대행업체. 같은 시장의 정확히 반대편이다. 완벽한 알리바이 설계를 추적하던 흥신소가 그 설계자를 찾아냈다. 오늘이 그 대면이다. 지금 얹힌 현안: 최증거의 다음 표적이 나변명의 최대 고객이다. 보고서를 내면 나변명이 망한다.",
    client: {
      name: "최증거", gender: "여",
      look: ["차에서 자는 사람의 자세","뺨에 렌즈 자국","늘 같은 회색 점퍼","눈이 안 쉰다"],
      history: [
        "38세 · 흥신소 조사관 12년차",
        "차가 사무실이다. 뒷좌석에 옷이 쌓여 있다",
        "건당 수임료 180만원, 성공보수 별도",
        "12년간 미행한 사람이 400명이 넘는다",
        "대구 출신. 원래 경찰 준비를 했다",
        "보고서를 낼 때마다 손이 떨린다",
      ],
      personality: ["사람을 시간대로 기억함","칭찬을 증거로 받음","먼저 앉지 않는다"],
      keys: {
        interest: "other", air: "some", comply: "obeys",
        wreck: { kind: "경계", line: "앞에 앉은 사람을 조사 대상으로 처리한다. 대답보다 확인이 먼저 나간다" },
      },
      prefs: [
        { t: "증거 수집 장비 얘기", open: true },
        { t: "그 알리바이 설계가 너무 아름다워서 보고서를 못 냈다", open: false },
        { t: "찾아내고 나서 뭘 하려던 건지 아직도 모른다. 알게 되는 게 무섭다", open: false },
      ],
      spec: S({"skin":"#e2c4a4","hair":"#3b332c","hairStyle":"updo","top":"#8a8f92","bottom":"#3a3f44","shoes":"#4a4a4a","heightScale":0.98,"widthScale":0.98,"accessory":"sunglasses","accessoryColor":"#222222","expression":"smug","aura":"none","species":"human","femme":true}),
    },
    target: {
      name: "나변명", gender: "남",
      look: ["하루 세 번 갈아입은 옷","주머니에 영수증이 가득","표정이 늘 온화","손이 깨끗함"],
      history: [
        "34세 · 알리바이 대행 / 업력 6년",
        "오피스텔 사무실. 옷장이 벽 하나다",
        "월 매출 1,100만원. 세금 신고는 안 한다",
        "가짜 영수증을 종류별로 보관한다",
        "인천 출신. 부모가 열두 살에 갈라섰다",
        "설계가 완벽할수록 잠을 못 잔다",
      ],
      personality: ["거짓말을 설계라 부름","남의 사정을 안 묻는다","미안해하지 않는다"],
      keys: {
        interest: "self", air: "none", comply: "obeys",
        wreck: { kind: "독백", line: "진짜 대답 대신 설계된 이야기가 나온다. 그 이야기가 길어서 상대 차례가 안 온다" },
      },
      prefs: [
        { t: "동선 설계 이야기", open: true },
        { t: "들키지 않고 끝난 건", open: true },
        { t: "자기 부모 이혼을 못 막았다", open: false },
        { t: "의뢰인 중 셋은 무료로 받았다", open: false },
        { t: "그의 보고서를 전부 모아뒀다", open: false },
        { t: "\"그거 범죄 아니에요?\"", open: true, neg: true },
        { t: "피해자 얘기 꺼내기", open: true, neg: true },
        { t: "\"부모님은 아세요?\"", open: true, neg: true },
      ],
      spec: S({"skin":"#f0d9c0","hair":"#4c4038","hairStyle":"wave","top":"#f2f2ee","bottom":"#5a6070","shoes":"#8a6a50","heightScale":1.01,"widthScale":0.94,"accessory":"scarf","accessoryColor":"#9a7f5f","expression":"happy","aura":"none","species":"human"}),
    },
  },

  {
    id: "gapjil", difficulty: "보통", category: "갑질", winWord: "응대 종료 커플 성사",
    relation: "블랙컨슈머와 그 사람 전담 상담원. 2년간 통화 녹취가 400시간이다. 400번째 항의 전화에서 매뉴얼에 없는 말이 나왔다. \"선생님, 오늘은 무슨 일 있으셨어요?\". 지금 얹힌 현안: 안소연이 사귀면 2년치 녹취가 사적 관계로 재분류되고 그 즉시 해고 사유가 된다.",
    client: {
      name: "고성호", gender: "남",
      look: ["조끼 주머니에 영수증 뭉치","목소리가 늘 큼","탁자를 손가락으로 두드림","신발을 끌고 걸음"],
      history: [
        "52세 · 자영업 / 민원 상습 제기",
        "수원에서 24시간 편의점을 한다",
        "월 순익 190만원. 알바를 못 쓴다",
        "민원 접수 이력이 2년간 1,100건이다",
        "경북 안동 출신. 아들과 4년째 연락이 없다",
        "통화 기록을 지우지 않는다",
      ],
      personality: ["먼저 화를 낸다","사과를 못 받아들인다","혼자 밥을 먹는다"],
      keys: {
        interest: "mixed", air: "none", comply: "argues",
        wreck: { kind: "폭주", line: "한 턴에 항의를 세 건 동시에 꺼낸다. 어느 것도 끝까지 안 가고 다시 처음으로 돌아간다" },
      },
      prefs: [
        { t: "민원 접수 번호 정리", open: true },
        { t: "매뉴얼에 없던 그 한마디를 다시 들으려고 매일 전화를 건다", open: false },
        { t: "항의할 게 없어지는 날이 제일 무섭다. 그러면 걸 이유가 없다", open: false },
      ],
      spec: S({"skin":"#dcb894","hair":"#6a6a64","hairStyle":"bald","top":"#7a6a4a","bottom":"#3a3a3a","shoes":"#5a4a3a","heightScale":0.97,"widthScale":1.2,"accessory":"none","accessoryColor":"#666666","expression":"angry","aura":"fire","species":"human"}),
    },
    target: {
      name: "안소연", gender: "여",
      look: ["귀에 헤드셋 자국","목에 스카프","손목 보호대","표정이 안 바뀜"],
      history: [
        "30세 · 콜센터 VOC 전담 5년차",
        "상담센터 3층, 창가 자리",
        "월급 244만원. 인센티브는 응대 건수로 준다",
        "하루 평균 통화 68건, 최장 통화 4시간 12분",
        "충남 천안 출신. 첫 직장이 여기다",
        "퇴근하면 아무 말도 안 한다",
      ],
      personality: ["매뉴얼로 방어함","울고 나서 웃는다","이름을 잘 기억함"],
      keys: {
        interest: "other", air: "some", comply: "obeys",
        wreck: { kind: "단답", line: "응대 밖에서는 문장을 만들어본 적이 없다. 대답이 대체로 네 글자 안에서 끝난다" },
      },
      prefs: [
        { t: "응대 종료 코드 이야기", open: true },
        { t: "아무도 안 우는 하루", open: true },
        { t: "그의 통화를 전부 따로 저장해뒀다", open: false },
        { t: "퇴사원을 세 번 썼다 지웠다", open: false },
        { t: "그 목소리가 없으면 실적이 준다", open: false },
        { t: "\"고객님\"이라고 불리는 것", open: true, neg: true },
        { t: "녹취 얘기", open: true, neg: true },
        { t: "\"직업이니까 참으시죠\"", open: true, neg: true },
      ],
      spec: S({"skin":"#f8e4d2","hair":"#2f2a26","hairStyle":"curls","top":"#b8c8d8","bottom":"#3a4048","shoes":"#6a6a70","heightScale":0.96,"widthScale":0.93,"accessory":"none","accessoryColor":"#aa8899","expression":"dead","aura":"gloom","species":"human","femme":true}),
    },
  },

  {
    id: "grade-fraud", difficulty: "보통", category: "등급", winWord: "무등급 커플 성사",
    relation: "결혼정보회사 등급 심사역과 등급을 위조해 등록한 회원. 심사역은 처음부터 알고 있었다. 등급 면담에서 위조 서류를 사이에 두고 만났다. 심사역은 보고도 다음 장으로 넘겼다. 지금 얹힌 현안: 서류상의 위조가 드러나면 등급표는 8년 경력이 끝난다. 이미 여섯 번 눈감아줬다.",
    client: {
      name: "서류상", gender: "남",
      look: ["빌린 티가 나는 시계","구두가 지나치게 새것","명함을 두 종류 갖고 다님","웃을 때 입만 웃음"],
      history: [
        "37세 · 회원 / 제출 서류 다섯 건 위조",
        "강남 오피스텔 단기 임대. 3개월째다",
        "실제 연봉 3,200만원, 서류상 9,800만원",
        "명함 두 종류를 상황에 따라 꺼낸다",
        "전북 전주 출신. 형이 사업을 말아먹었다",
        "거짓말을 하고 나면 물을 많이 마신다",
      ],
      personality: ["숫자를 반올림함","들키면 더 웃는다","자기 얘기에 각주를 단다"],
      keys: {
        interest: "self", air: "some", comply: "obeys",
        wreck: { kind: "폭주", line: "각주가 각주를 낳아서 원래 문장으로 못 돌아온다. 듣는 쪽은 질문한 걸 잊는다" },
      },
      prefs: [
        { t: "스펙 포트폴리오 브리핑", open: true },
        { t: "왜 여섯 번이나 눈감아줬는지, 그것만 생각한다", open: false },
        { t: "진짜 서류를 내미는 자기 모습을 상상해본다. 상상 속에서도 손이 떨린다", open: false },
      ],
      spec: S({"skin":"#eed0b0","hair":"#312a24","hairStyle":"wave","top":"#2b3550","bottom":"#20242e","shoes":"#8a6a3a","heightScale":1.02,"widthScale":0.99,"accessory":"necktie","accessoryColor":"#c8a24a","expression":"smug","aura":"question","species":"human"}),
    },
    target: {
      name: "등급표", gender: "여",
      look: ["펜을 세 자루 꽂음","무채색만 입음","서류 모서리를 손으로 쓸어 정렬함","손이 늘 차가움"],
      history: [
        "35세 · 결혼정보회사 심사역 8년차",
        "논현동 상담실. 창문이 없다",
        "연 심사 1,400건. 등급 이의신청은 본인이 처리한다",
        "자기 회원번호로 가입해본 적 있다",
        "서울 출신. 부모가 맞선으로 만났다",
        "완벽한 서류를 보면 오히려 의심한다",
      ],
      personality: ["사람을 항목으로 본다","칭찬을 안 한다","거짓말을 즉시 안다"],
      keys: {
        interest: "mixed", air: "some", comply: "obeys",
        wreck: { kind: "경계", line: "사람을 항목으로 검증하면서 듣는다. 답하기 전에 진위부터 확인한다" },
      },
      prefs: [
        { t: "등급 산정 기준 이야기", open: true },
        { t: "서류가 완벽한 회원", open: true },
        { t: "본인 등급을 매겨보고 울었다", open: false },
        { t: "위조를 여섯 번 눈감아줬다", open: false },
        { t: "그중 넷은 결혼했다", open: false },
        { t: "\"제 등급은 몇이에요?\"", open: true, neg: true },
        { t: "수수료 환불 요구", open: true, neg: true },
        { t: "\"사람을 어떻게 등급으로 나눠요\"", open: true, neg: true },
      ],
      spec: S({"skin":"#f4dfc8","hair":"#20201c","hairStyle":"updo","top":"#5c6068","bottom":"#2a2c30","shoes":"#3a3a3a","heightScale":0.99,"widthScale":0.87,"accessory":"glasses","accessoryColor":"#666666","expression":"neutral","aura":"ice","species":"human","femme":true}),
    },
  },

  {
    id: "pyramid", difficulty: "헬", category: "다단계", winWord: "하위 라인 없는 커플 성사",
    relation: "다단계 리크루터와 탈퇴자 모임 운영자. 같은 사람들을 두고 정확히 반대로 먹고산다. 탈퇴자 모임에 잠입한 리크루터가 \"여러분 잘못이 아닙니다\"라는 말을 들었다. 지금 얹힌 현안: 구출식의 모임 회원 마흔 명이 정상위를 상대로 소송 중이다. 사귀면 모임이 해산된다.",
    client: {
      name: "정상위", gender: "여",
      look: ["정장에 배지 여섯 개","명함집이 두꺼움","악수가 세다","늘 서 있다"],
      history: [
        "41세 · 리크루터 / 다이아 직급 3년차",
        "수원 오피스텔. 제품 박스가 벽을 채운다",
        "월 수익 최고 2,200만원, 지난달 180만원",
        "12년째 다이아 직급을 유지한다",
        "경기 안산 출신. 동생 둘이 연락을 끊었다",
        "거절당한 사람 이름을 전부 적어둔다",
      ],
      personality: ["모든 만남을 기회로 셈","거절을 안 듣는다","남의 성공담을 자기 것처럼 말함"],
      keys: {
        interest: "self", air: "none", comply: "drifts",
        wreck: { kind: "집착", line: "어떤 대화든 기회로 되돌린다. 거절을 들어도 그 자리로 다시 돌아온다" },
      },
      prefs: [
        { t: "조직도와 직급 체계 설명", open: true },
        { t: "12년간 아무도 안 해준 그 말에 명함을 못 꺼냈다", open: false },
        { t: "거절당한 사람 명단에 저 이름을 적게 될까 봐, 처음으로 권유가 무섭다", open: false },
      ],
      spec: S({"skin":"#f0d2b4","hair":"#5a3a28","hairStyle":"beehive","top":"#1e2a44","bottom":"#1e2a44","shoes":"#2a2a2a","heightScale":1,"widthScale":0.95,"accessory":"earrings","accessoryColor":"#d4af37","expression":"chad","aura":"money","species":"human","femme":true}),
    },
    target: {
      name: "구출식", gender: "남",
      look: ["목이 늘어난 티셔츠","손에 유인물 뭉치","수염을 안 깎음","앉을 때 한숨을 쉼"],
      history: [
        "44세 · 피해자 모임 운영 / 본인도 5년 몸담았다",
        "영등포 지하 사무실. 의자가 서른 개다",
        "모임 운영비 월 90만원. 후원으로 충당한다",
        "5년간 본인이 데려간 사람이 마흔이다",
        "충남 논산 출신. 아직 아무한테도 사과 못 했다",
        "유인물을 직접 접는다",
      ],
      personality: ["남 얘기를 끝까지 듣는다","자기 얘기는 안 한다","숫자를 못 외운다"],
      keys: {
        interest: "other", air: "some", comply: "obeys",
        wreck: { kind: "침묵", line: "남 얘기는 끝까지 듣는데 자기 차례가 오면 아무 말도 안 나온다. 5년치가 목에 걸려 있다" },
      },
      prefs: [
        { t: "모임 운영비 걱정", open: true },
        { t: "아무도 안 오는 조용한 날", open: true },
        { t: "본인 하위 라인이 아직 스물이다", open: false },
        { t: "그 사람 실적표를 갖고 있다", open: false },
        { t: "모임 후원금 일부를 생활비로 쓴다", open: false },
        { t: "직급 이야기", open: true, neg: true },
        { t: "\"그때 왜 안 나오셨어요\"", open: true, neg: true },
        { t: "후원금 사용처 묻기", open: true, neg: true },
      ],
      spec: S({"skin":"#dcbf9c","hair":"#4a4640","hairStyle":"dreads","top":"#7a7f74","bottom":"#3f4238","shoes":"#5a4f42","heightScale":1.01,"widthScale":1.14,"accessory":"beard","accessoryColor":"#4a4640","expression":"sad","aura":"none","species":"human"}),
    },
  },

  {
    id: "debt", difficulty: "헬", category: "추심", winWord: "채무 정리 커플 성사",
    relation: "채권 추심원과 3년째 그가 담당한 파산 신청자. 매달 만나는데 매달 같은 말만 한다. 3년간 매달 같은 문 앞에서 추심원과 채무자로 만났다. 어느 달 \"밥은 드셨어요?\"가 나왔다. 지금 얹힌 현안: 독촉만이 담당자인 채로 사귀면 회수가 무효가 되고 오분식의 면책 결정도 취소된다.",
    client: {
      name: "독촉만", gender: "남",
      look: ["가방 모서리가 닳음","늘 같은 감색 점퍼","문 앞에 서는 자세","손톱이 짧다"],
      history: [
        "39세 · 채권 추심원 11년차",
        "부천 원룸. 짐이 가방 두 개다",
        "회수 실적으로 급여가 갈린다. 기본급 210만원",
        "11년간 방문한 집이 3,000곳이 넘는다",
        "경남 진주 출신. 첫 직장은 대부업 콜센터였다",
        "남의 집 신발 개수를 센다",
      ],
      personality: ["말을 아주 천천히 한다","눈을 안 피한다","남의 집 구조를 기억함"],
      keys: {
        interest: "other", air: "some", comply: "obeys",
        wreck: { kind: "단답", line: "말을 아주 천천히, 아주 적게 한다. 11년간 그게 제일 잘 먹혔다" },
      },
      prefs: [
        { t: "남의 집 신발 정리 상태 관찰", open: true },
        { t: "11년간 아무도 그 문 앞에서 밥을 물은 적 없다. 그날부터 회수 실적이 0이다", open: false },
        { t: "실적 0이 들키면 끝인데, 다음 달에도 그 문을 두드릴 이유가 그것뿐이다", open: false },
      ],
      spec: S({"skin":"#e0c0a0","hair":"#232019","hairStyle":"buzz","top":"#2c3b52","bottom":"#2a2a2e","shoes":"#3a3028","heightScale":1.03,"widthScale":1.06,"accessory":"none","accessoryColor":"#555555","expression":"neutral","aura":"gloom","species":"human"}),
    },
    target: {
      name: "오분식", gender: "여",
      look: ["앞치마를 아직 두름","손등에 기름 화상","머리를 늘 묶음","웃을 때 눈이 사라짐"],
      history: [
        "45세 · 개인파산 신청자 / 前 분식집 운영",
        "상봉동 반지하. 분식집은 작년에 접었다",
        "채무 원금 1억 4천, 이자 포함 2억이 넘는다",
        "25년간 새벽 4시에 일어났다",
        "전북 익산 출신. 남편은 8년 전에 갔다",
        "아직도 밥을 두 그릇 한다",
      ],
      personality: ["먹을 걸 먼저 내민다","자기 사정을 안 말함","남의 신발을 정리함"],
      keys: {
        interest: "other", air: "some", comply: "obeys",
        wreck: { kind: "침묵", line: "자기 사정 얘기가 나오면 입을 닫고 뭘 내민다. 말로는 한 번도 한 적이 없다" },
      },
      prefs: [
        { t: "분식 원가 이야기", open: true },
        { t: "아무도 안 오는 오후", open: true },
        { t: "면책 결정문을 아직 안 뜯었다", open: false },
        { t: "그가 오는 날에만 밥을 두 그릇 한다", open: false },
        { t: "보증을 서준 사람이 아직 연락이 안 된다", open: false },
        { t: "잔액 얘기", open: true, neg: true },
        { t: "\"왜 그때 보증을 서셨어요\"", open: true, neg: true },
        { t: "\"이제 정리하셔야죠\"", open: true, neg: true },
      ],
      spec: S({"skin":"#e8cbaa","hair":"#332a22","hairStyle":"ponytail","top":"#c8b89a","bottom":"#4a4438","shoes":"#7a6a58","heightScale":0.94,"widthScale":1.08,"accessory":"bandana","accessoryColor":"#c05a4a","expression":"happy","aura":"none","species":"human","femme":true}),
    },
  },

  {
    id: "asmr", difficulty: "쉬움", category: "청각", winWord: "주파수 커플 성사",
    relation: "ASMR 크리에이터와 그 채널을 청력 손상으로 신고한 이용자. 저 사람이 말하는 동안에도 귀가 깎인다. 3년간 매 영상에 \"오늘도 못 잤습니다\" 댓글이 달렸고, 지난달 청력 손상 신고가 접수됐다. 지금 얹힌 현안: 윙윙의 이명은 백소음의 목소리 대역에서 악화된다. 곁에 두면 남은 청력을 잃고, 신고를 취하하면 3년치 진료비 청구가 같이 날아간다.",
    client: {
      name: "백소음", gender: "여",
      look: ["늘 헤드폰을 목에 걸고 있음","손톱을 아주 짧게 깎음","목소리가 작다","실내용 슬리퍼로 다님"],
      history: [
        "29세 · ASMR 크리에이터 / 구독 31만",
        "원룸 방음 공사에 900만원을 썼다",
        "월 수익 340만원. 절반이 광고다",
        "하루 녹음 6시간, 편집 5시간",
        "충북 제천 출신. 소리 없는 집에서 자랐다",
        "자기 영상을 틀어놓고 잔다",
      ],
      personality: ["소리로 사람을 기억함","조용해지면 말을 더 함","남의 숨소리를 흉내 냄"],
      keys: {
        interest: "self", air: "some", comply: "obeys",
        wreck: { kind: "폭주", line: "조용해지는 걸 못 견뎌서 그 자리를 자기 말로 채운다. 채우다 보면 혼자 다 말했다" },
      },
      prefs: [
        { t: "장비와 주파수 얘기", open: true },
        { t: "댓글의 타임스탬프를 전부 찾아봤다. 전부 자기 숨소리였다", open: false },
        { t: "자기 목소리가 흉기라는 소견서를 받고도, 그 귀에 대고 말하고 싶다", open: false },
      ],
      spec: S({"skin":"#f6e3d4","hair":"#c7b6a8","hairStyle":"wave","top":"#efe6f2","bottom":"#b9aec6","shoes":"#f2f2f2","heightScale":0.95,"widthScale":0.9,"accessory":"headband","accessoryColor":"#d8cfe4","expression":"shy","aura":"bubbles","species":"human","femme":true}),
    },
    target: {
      name: "윙윙", gender: "남",
      look: ["귀를 자주 만짐","카디건 소매가 늘어남","눈 밑이 어둡다","손에 늘 도서 라벨"],
      history: [
        "34세 · 시립도서관 사서 / 이명 3년차",
        "도서관에서 걸어서 4분 거리에 산다",
        "연봉 3,600. 이명 치료비가 매달 22만원",
        "3년간 이비인후과 다섯 곳을 돌았다",
        "경기 부천 출신. 어머니도 이명이 있었다",
        "조용한 방에서 제일 크게 들린다",
      ],
      personality: ["소리를 숫자로 말함","따지고 나서 사과함","조용한 곳을 먼저 찾음"],
      keys: {
        interest: "other", air: "well", comply: "obeys",
        wreck: { kind: "불안", line: "상대가 조금만 굳어도 자기 때문이라고 읽고 먼저 사과한다. 사과가 대화를 더 굳힌다" },
      },
      prefs: [
        { t: "서가 청구기호 이야기", open: true },
        { t: "아무 소리도 안 나는 시간", open: true },
        { t: "신고를 넣은 그날 밤에도 그 채널을 틀었다. 그게 제일 화가 난다", open: false },
        { t: "소견서에 채널 이름을 적어 넣자고 한 건 담당의가 아니라 자기였다", open: false },
        { t: "어머니 이명이 어떻게 끝났는지 아직 아무한테도 말한 적 없다", open: false },
        { t: "\"그냥 참으면 되잖아요\"", open: true, neg: true },
        { t: "\"조용한 데로 가면 낫죠\"", open: true, neg: true },
        { t: "자기 목소리를 직접 들려주려는 시도", open: true, neg: true },
      ],
      spec: S({"skin":"#eddcc8","hair":"#3a3128","hairStyle":"short","top":"#7a8574","bottom":"#4a4a52","shoes":"#5c4a3a","heightScale":1.02,"widthScale":0.94,"accessory":"glasses","accessoryColor":"#2a2a2a","expression":"sad","aura":"static","species":"human"}),
    },
  },

  {
    id: "spice", difficulty: "쉬움", category: "위장", winWord: "위장 커플 성사",
    relation: "매운맛 챌린지 유튜버와 그 사람 위를 매달 들여다보는 내시경 전문의. 한 달에 한 번 내시경실에서 유튜버와 담당의로 만난다. \"또 오셨네요\"가 인사의 전부다. 지금 얹힌 현안: 위성곤이 담당의인 채로 사귀면 면허가 정지된다. 담당을 넘기면 캡사이신은 그 병원 응급 시술 대상에서 빠진다.",
    client: {
      name: "캡사이신", gender: "여",
      look: ["입술이 늘 부어 있음","가방에 우유 두 팩","눈물자국을 안 지움","손끝이 빨갛다"],
      history: [
        "27세 · 매운맛 챌린지 유튜버 / 구독 62만",
        "위벽 미란 4회, 식도염 2회 진단",
        "월 수익 1,100만원. 병원비는 경비 처리한다",
        "한 달에 한 번 내시경",
        "부산 출신. 집에서는 아무도 매운 걸 못 먹는다",
        "카메라를 끄면 아무것도 안 먹는다",
      ],
      personality: ["모든 걸 스코빌로 환산함","아프다는 말을 안 함","카메라가 없으면 조용함"],
      keys: {
        interest: "self", air: "well", comply: "drifts",
        wreck: { kind: "단답", line: "카메라가 없으면 말할 이유가 없다. 촬영 밖에서는 대답이 두 단어를 안 넘는다" },
      },
      prefs: [
        { t: "스코빌 지수 얘기", open: true },
        { t: "유일하게 걱정하는 그 얼굴을 보려고 다음 달 촬영을 잡는다", open: false },
        { t: "위가 버티는 한 이 진료는 계속된다. 그게 데이트라는 걸 인정 못 한다", open: false },
      ],
      spec: S({"skin":"#fadfd2","hair":"#e0483a","hairStyle":"ponytail","top":"#ff5a3c","bottom":"#2c2c34","shoes":"#ffffff","heightScale":0.94,"widthScale":0.9,"accessory":"earrings","accessoryColor":"#ff2a2a","expression":"weird","aura":"fire","species":"human","femme":true}),
    },
    target: {
      name: "위성곤", gender: "남",
      look: ["수술모 자국이 이마에 남음","손이 아주 차갑다","가운 주머니가 늘 무겁다","말할 때 눈을 안 피함"],
      history: [
        "38세 · 소화기내과 전문의 / 내시경 6,000건",
        "병원에서 도보 2분 오피스텔",
        "주 6일, 하루 내시경 22건",
        "10년간 담당 환자를 한 명도 못 말렸다",
        "대구 출신. 아버지가 위암이었다",
        "퇴근하면 죽만 먹는다",
      ],
      personality: ["최악의 경우부터 말함","농담에 1초 늦게 웃음","남의 식사를 관찰함"],
      keys: {
        interest: "other", air: "none", comply: "obeys",
        wreck: { kind: "독백", line: "무슨 말을 들어도 임상 소견으로 받는다. 그 소견을 끝까지 말해야 넘어간다" },
      },
      prefs: [
        { t: "담백한 죽 이야기", open: true },
        { t: "검사 결과가 깨끗한 날", open: true },
        { t: "그 채널 영상을 전부 봤다", open: false },
        { t: "진료기록에 사적인 메모를 한 줄 남긴 적 있다", open: false },
        { t: "한 번도 촬영을 말린 적이 없는 자신을 미워한다", open: false },
        { t: "\"이 정도는 괜찮아요\"", open: true, neg: true },
        { t: "촬영분을 직접 보여주려는 것", open: true, neg: true },
        { t: "\"선생님도 한번 드셔보세요\"", open: true, neg: true },
      ],
      spec: S({"skin":"#f0ddc9","hair":"#2a2622","hairStyle":"short","top":"#f4f6f8","bottom":"#3a4250","shoes":"#e8e8e8","heightScale":1.05,"widthScale":1,"accessory":"mask","accessoryColor":"#dfe8ef","expression":"neutral","aura":"none","species":"human"}),
    },
  },

  {
    id: "recycle", difficulty: "쉬움", category: "분리수거", winWord: "재활용 커플 성사",
    relation: "분리수거 감시원과 남의 폐기물로 작품을 만드는 설치미술가. 신고 누적 41건이 서로다. 41건의 신고와 새벽의 폐자재 수거로 얽혔고, 그 폐자재가 지금 시립미술관 로비에 서 있다. 지금 얹힌 현안: 최분리가 넣은 신고 41건이 주워담의 전시 지원금 심사에 걸려 있다. 사귀면 이의신청이 전부 기각된다.",
    client: {
      name: "최분리", gender: "남",
      look: ["형광 조끼를 사복 위에 입음","집게를 늘 들고 다님","장갑 자국이 손목에 남음","모자를 눌러씀"],
      history: [
        "44세 · 아파트 분리수거 감시원 12년차",
        "임대아파트 12동 관리사무소 옆방",
        "월급 218만원. 12년째 같은 자리",
        "새벽 5시부터 8시까지가 본업",
        "전남 순천 출신. 아버지가 고물상을 했다",
        "집에 아무것도 안 쌓아둔다",
      ],
      personality: ["재질을 소리 내어 분류함","규정 조항을 외움","고맙다는 말에 자리를 뜬다"],
      keys: {
        interest: "other", air: "none", comply: "argues",
        wreck: { kind: "집착", line: "눈에 걸린 물건 하나를 놓지 못한다. 대화 중에도 그 재질 얘기로 돌아온다" },
      },
      prefs: [
        { t: "분리배출 규정 암송", open: true },
        { t: "\"열두 해 동안 정확하게 분류해 둔 것들\" — 그 설명문 앞에 40분을 서 있었다", open: false },
        { t: "자기 분류가 작품이 된 게 자랑스러운데, 인정하면 신고 41건이 우스워진다", open: false },
      ],
      spec: S({"skin":"#e6cdb0","hair":"#4a4038","hairStyle":"buzz","top":"#d8e02a","bottom":"#3a4a3a","shoes":"#5a4a3a","heightScale":1,"widthScale":1.08,"accessory":"hat","accessoryColor":"#d8e02a","expression":"neutral","aura":"none","species":"human"}),
    },
    target: {
      name: "주워담", gender: "여",
      look: ["작업복에 페인트가 층층이","손등에 오래된 흉터","머리를 아무렇게나 묶음","주머니가 늘 불룩함"],
      history: [
        "36세 · 설치미술가 / 폐기물 작업 9년차",
        "성수동 지하 작업실. 창문이 없다",
        "연 수입 불규칙. 작년은 1,400만원",
        "재료비를 한 번도 낸 적이 없다",
        "인천 출신. 어릴 때 이사를 열한 번 했다",
        "작품을 팔면 잠을 못 잔다",
      ],
      personality: ["남의 물건을 먼저 집음","설명을 안 함","한밤중에 전화함"],
      keys: {
        interest: "self", air: "some", comply: "obeys",
        wreck: { kind: "단답", line: "설명하는 걸 시간 낭비로 안다. 물어도 대체로 대답 대신 손이 나간다" },
      },
      prefs: [
        { t: "녹슨 것의 색 이야기", open: true },
        { t: "아직 아무도 안 가져간 새벽", open: true },
        { t: "41건 전부 그 사람이 신고한 걸 안다", open: false },
        { t: "신고서 필체를 알아본다", open: false },
        { t: "과태료 고지서를 한 장도 안 버렸다", open: false },
        { t: "\"그거 쓰레기잖아요\"", open: true, neg: true },
        { t: "과태료 액수 언급", open: true, neg: true },
        { t: "\"규칙은 규칙이죠\"", open: true, neg: true },
      ],
      spec: S({"skin":"#e8cfb8","hair":"#5c4632","hairStyle":"updo","top":"#8a7a5a","bottom":"#4a4438","shoes":"#3a3a3a","heightScale":0.98,"widthScale":0.96,"accessory":"bandana","accessoryColor":"#a83a2a","expression":"smug","aura":"question","species":"human","femme":true}),
    },
  },];

// ── 어긋남(대화 불능) 표시용 라벨 ──────────────────────────────────────
// 요원이 미리 알아야 하는 정보다 — 단답 인물에게 "길게 설득해" 같은 지침은 헛수고다.
export const WRECK_KINDS = new Set(['단답', '침묵', '폭주', '집착', '불안', '독백', '경계']);
export const WRECK_LABELS = {
  단답: { tag: '단답', desc: '대부분의 턴이 한두 글자로 끝난다. ㅇㅇ · ㅇㅋ · 어 · 몰라. 길게 말하게 만들려면 이유를 줘야 한다' },
  침묵: { tag: '말문 막힘', desc: '할 말을 못 고르고 그대로 넘긴다. "..."가 턴 하나를 그냥 먹는다' },
  폭주: { tag: '폭주', desc: '문장이 안 끝나고 화제가 갈아탄다. 상대가 대답할 자리를 안 남긴다' },
  집착: { tag: '집착', desc: '한 곳으로 계속 돌아온다. 화제를 돌려도 한 턴 만에 제자리다' },
  불안: { tag: '불안', desc: '아무것도 아닌 데서 버려질 신호를 읽고 확인을 요구한다. 안심시켜도 두 턴이면 풀린다' },
  독백: { tag: '독백', desc: '상대의 질문을 자기 얘기 발판으로 쓴다. 상대가 없어도 되는 말을 한다' },
  경계: { tag: '경계', desc: '호의를 먼저 의심한다. 질문에는 질문으로 답한다. 친절할수록 더 단단해진다' },
};

// ── 특별 키워드 표시용 라벨 ────────────────────────────────────────────
// 키워드는 게임을 지배하는 데이터다. 화면에 안 나가면 개성이 아니라 불공정한 랜덤이다.
export const KEY_LABELS = {
  air: {
    well: { tag: '눈치 있음', desc: '공기가 갱신될 때마다 그대로 전달된다.' },
    some: { tag: '눈치 절반', desc: '공기가 갱신돼도 두 번에 한 번만 전달된다. 나머지는 그냥 지나간다.' },
    none: { tag: '눈치 없음', desc: '공기는 이 사람에게 전달되지 않는다. 한 글자도.' },
  },
  interest: {
    other: { tag: '상대를 봄', desc: '상대의 성격도, 공개된 성향도 알고 나간다.' },
    mixed: { tag: '반쯤 봄', desc: '상대 성격은 아는데 뭘 좋아하는지는 모른다.' },
    self: { tag: '자기만 봄', desc: '상대가 어떤 사람인지 알아본 적이 없다. 겉모습밖에 모른다.' },
  },
  comply: {
    obeys: { tag: '지침 이행', desc: '시킨 대로 한다. 지침에 없는 상황만 제 판단으로 움직인다.' },
    argues: { tag: '토 달고 이행', desc: '하기는 한다. 속으로 토를 달 뿐이다.' },
    drifts: { tag: '한 번만 이행', desc: '한 번 하고 나면 원래 하던 얘기로 돌아간다. 같은 지침을 다시 쓸 각오를 해라.' },
  },
};
const KEY_SEVERITY = {
  air: { well: 'ok', some: 'mid', none: 'bad' },
  interest: { other: 'ok', mixed: 'mid', self: 'bad' },
  comply: { obeys: 'ok', argues: 'mid', drifts: 'bad' },
};

const KEY_AXES = [
  { key: 'air', axis: '공기 읽기' },
  { key: 'interest', axis: '상대 관심' },
  { key: 'comply', axis: '지침 수용' },
];
export function keyReport(person) {
  const k = person.keys;
  if (!k) return [];
  return KEY_AXES.map(a => ({ key: a.key, axis: a.axis, ...KEY_LABELS[a.key][k[a.key]], level: KEY_SEVERITY[a.key][k[a.key]] }));
}

// ── 검증 — 스키마 밖의 축이 생기거나 축이 비면 로드 자체가 죽는다 ──────
const INTEREST = new Set(['self', 'mixed', 'other']);
const AIR = new Set(['none', 'some', 'well']);
const COMPLY_SET = new Set(['obeys', 'argues', 'drifts']);
const CH_FIELDS = new Set(['name', 'gender', 'look', 'history', 'personality', 'keys', 'prefs', 'spec']);

const seenWreck = new Set();
for (const c of COUPLES) {
  if (!c.relation || c.relation.length < 40) throw new Error(`couples.js: ${c.id}의 relation이 부실하다`);
  for (const who of ['client', 'target']) {
    const p = c[who];
    for (const f of Object.keys(p)) if (!CH_FIELDS.has(f)) throw new Error(`couples.js: ${c.id}.${who}에 스키마 밖 필드 「${f}」`);
    if (!p.name || !p.gender) throw new Error(`couples.js: ${c.id}.${who} 이름/성별 누락`);
    if (!p.look?.length || !p.history?.length || !p.personality?.length) throw new Error(`couples.js: ${c.id}.${who} 외모/내력/성격 누락`);
    const k = p.keys;
    if (!INTEREST.has(k.interest) || !AIR.has(k.air) || !COMPLY_SET.has(k.comply)) throw new Error(`couples.js: ${c.id}.${who} 키워드 값 오류`);
    if (k.reflex !== undefined) throw new Error(`couples.js: ${c.id}.${who}에 폐지된 조건반사 필드가 있다`);
    if (!WRECK_KINDS.has(k.wreck?.kind)) throw new Error(`couples.js: ${c.id}.${who} 어긋남 종류 오류: ${k.wreck?.kind}`);
    if (!k.wreck.line || k.wreck.line.length < 20) throw new Error(`couples.js: ${c.id}.${who} 어긋남이 뭉뚱그려져 있다`);
    if (seenWreck.has(k.wreck.line)) throw new Error(`couples.js: ${c.id}.${who} 어긋남 문장이 복붙이다`);
    seenWreck.add(k.wreck.line);
    // 성향: 최소 3종, 공개·미공개가 다 있어야 한다. 하자 없는 인물은 없고, 성향 없는 인물도 없다.
    if (!Array.isArray(p.prefs) || p.prefs.length < 3) throw new Error(`couples.js: ${c.id}.${who} 성향이 3종 미만이다`);
    if (!p.prefs.some(x => x.open) || !p.prefs.some(x => !x.open)) throw new Error(`couples.js: ${c.id}.${who} 성향에 공개/미공개가 다 있어야 한다`);
    const seen = new Set();
    for (const x of p.prefs) {
      if (!x.t || x.t.length < 2) throw new Error(`couples.js: ${c.id}.${who} 성향 항목이 비었다`);
      if (seen.has(x.t)) throw new Error(`couples.js: ${c.id}.${who} 성향 중복: ${x.t}`);
      seen.add(x.t);
    }
    // 조형 보정 플래그. 아바타 렌더러가 눈매·볼·체형 비율만 다듬는다.
    if (p.gender === '여') p.spec.femme = true;
  }
}

export const COUPLE_BY_ID = Object.fromEntries(COUPLES.map(c => [c.id, c]));

// 의뢰서에 노출할 **상대 쪽** 성향 요약 — 공개분·지뢰·미공개 개수.
// 의뢰인 성향은 요약이 필요 없다: 요원에게는 전부 공개라 client.prefs를 그대로 그린다(sheetHtml).
export function dossierPrefs(couple) {
  const t = couple.target;
  return {
    open: t.prefs.filter(p => p.open && !p.neg).map(p => p.t),
    neg: t.prefs.filter(p => p.open && p.neg).map(p => p.t),
    hiddenCount: t.prefs.filter(p => !p.open).length,
  };
}
