// couples.js — Q 기관 상설 의뢰 대장. 전부 손으로 쓴 고정 데이터다.
// LLM은 이 사람들을 "연기"할 뿐, 만들어내지 않는다. 매칭이 성립할 리 없는 조합만 골라 넣었다.
//
// ── 인물 스키마 — 구조도의 「S. 스크리닝 시 노출 정보」 그대로다 ─────────
// 노출 항목은 여덟 개고, 그 여덟 개가 데이터의 전부다. 감춰둔 축은 없다.
//
//   공통   name / gender      이름 · 성별 (서식과 렌더링용)
//          look[]             외모
//          personality[]      성격
//          upbringing[]       성장환경 — 첫 줄이 나이·직업, 나머지가 살아온 자리
//          spec               3D 아바타 조형 (정보가 아니라 렌더링)
//   타겟만 taste[]             취향. 평평한 목록이다 — 공개/미공개도, 지뢰도 없다
//
// 폐지된 것: difficulty · winWord · relation · keys(상대관심·공기읽기·명령수용·어긋남) ·
//            prefs의 open/neg 플래그 · 미공개 성향 · 지뢰.
// 되살리지 않는다. tests/couples.test.mjs가 막는다.

export const COUPLES = [  {
    id: "politics", category: "정치",
    client: {
      name: "표한나", gender: "여",
      look: ["검은 각단발","각진 회색 정장","서류를 겨드랑이에 낀 채로 걸음","눈빛에 고소장 3건"],
      personality: ["정책 브리핑하듯 말함","지고는 못 삼","의외로 소녀감성"],
      upbringing: [
        "62세 · 5선 야당 의원 / 국정감사 최다 발언 기록 보유자",
        "재래시장통에서 자랐다. 스트레스받으면 시장 상인 억양이 튀어나온다",
        "자택 지하에 개인 문서고. 30년치 국감 자료를 종이로 쌓아둔다. 방습기 전기요금이 월 84만원이고 그걸 자랑스러워한다",
        "새벽 5시 기상. 러닝머신 위에서 예산안을 읽는다",
        "의원 배지 달던 날 맞춘 각진 정장이 11벌. 전부 같은 디자인이다",
        "노래방 애창곡이 있는데 아무한테도 안 알려준다",
      ],
      spec: {"skin":"#f2d3b8","hair":"#2a2622","hairStyle":"bowl","top":"#3a3f47","bottom":"#3a3f47","shoes":"#101010","heightScale":0.97,"widthScale":1,"accessory":"glasses","accessoryColor":"#333333","expression":"neutral","aura":"lightning","species":"human","femme":true,"props":[{"shape":"box","color":"#e8e4d8","size":0.32,"at":"handL","motion":"none","label":"30년치 국감 서류"},{"shape":"cylinder","color":"#3a3a42","size":0.3,"at":"handR","motion":"none","label":"국감장 마이크"}]},
    },
    target: {
      name: "지대건", gender: "남",
      look: ["기름진 올백","번들거리는 피부","금빛 넥타이","체구가 큼"],
      personality: ["모든 문장을 최상급으로 끝냄","칭찬에 즉시 무너짐","집중력 8초"],
      upbringing: [
        "69세 · 건설·리조트 재벌 / 여당 최대 후원자",
        "달동네 판자촌에서 시작했다는 얘기를 3분에 한 번 한다",
        "리조트 4개, 골프장 9개. 부채 규모는 본인도 정확히 모른다",
        "아침은 무조건 제로콜라. 물은 안 마신다",
        "자기 이름이 안 박힌 물건은 손에 오래 안 들고 있는다",
        "라면을 침대에서 끓여 먹는다. 이건 절대 인정 안 한다",
      ],
      taste: [
        "자기 이름이 금색으로 박힌 물건",
        "시청률·조회수 숫자 이야기",
        "자기 골프 핸디캡을 진지하게 물어봐 주는 것",
        "분식집 쫄면 (자기는 고급 회를 먹는다고 우긴다)",
        "사실 상대의 종이 문서고 구축에 관심이 아주 많다",
      ],
      spec: {"skin":"#e8b98a","hair":"#4a3b28","hairStyle":"bowl","top":"#1b1b3a","bottom":"#1b1b3a","shoes":"#2a2a2a","heightScale":1.06,"widthScale":1.4,"accessory":"crown","accessoryColor":"#d4af37","expression":"smug","aura":"money","species":"human","props":[{"shape":"cylinder","color":"#d4af37","size":0.5,"at":"handR","motion":"none","label":"금색 골프채"},{"shape":"box","color":"#d4af37","size":0.22,"at":"handL","motion":"none","label":"이름 박힌 금괴"}]},
    },
  },

  {
    id: "gourmet-glutton", category: "식탁",
    client: {
      name: "음미해", gender: "여",
      look: ["뼈만 남은 체구","검은 나비넥타이","한쪽 눈에 단안경","냅킨을 무릎에 펴고 앉음"],
      personality: ["한 입에 형용사를 여섯 개 붙임","씹는 소리에 예민함","칭찬을 아주 늦게 함"],
      upbringing: [
        "42세 · 미식 평론가 / 별점 하나로 폐업시킨 가게 11곳",
        "성북동 한옥. 부엌에 저울이 네 개, 냄비가 두 개다",
        "한 접시를 40분에 걸쳐 먹는다. 식은 음식은 안 먹는다",
        "하루 700kcal. 배가 부르면 혀가 둔해진다고 믿는다",
        "전국 폭식대회 종신 심사위원장이다. 선수와 사적으로 얽히면 그 선수의 기록이 전부 무효 처리된다",
        "20년째 같은 나비넥타이 재봉집을 쓴다",
        "혼자 라면을 끓여 먹고 운 적이 있다. 맛있어서였다",
      ],
      spec: {"skin":"#f0dcc8","hair":"#2b2b30","hairStyle":"updo","top":"#1c1c22","bottom":"#1c1c22","shoes":"#0d0d0d","heightScale":1.02,"widthScale":0.68,"accessory":"monocle","accessoryColor":"#c8b060","expression":"smug","aura":"sparkle","species":"human","femme":true,"props":[{"shape":"disc","color":"#f4f4f0","size":0.34,"at":"handL","motion":"none","label":"빈 접시"},{"shape":"spike","color":"#d8d8dc","size":0.2,"at":"handR","motion":"none","label":"작은 포크"}]},
    },
    target: {
      name: "위대한", gender: "남",
      look: ["가로로 넓은 상체","목이 안 보임","늘 앞치마","입가에 국물 자국"],
      personality: ["말보다 씹는 속도가 빠름","져본 적이 없음","의외로 뒷맛을 정확히 말함"],
      upbringing: [
        "29세 · 푸드파이터 / 폭식대회 3연패 · 짜장면 30그릇 8분",
        "안산 원룸. 냉장고 두 대 중 한 대는 물만 들어 있다",
        "대회 전날은 물 4리터로 위를 늘린다. 그날은 아무 말도 안 한다",
        "상금으로 산 게 위 내시경 정기권이다",
        "먹는 영상 조회수 합계 2억. 댓글은 안 읽는다",
        "혼자 있을 때는 한 그릇을 한 시간에 걸쳐 먹는다",
      ],
      taste: [
        "면 삶는 시간 30초 차이 이야기",
        "위 확장 훈련 루틴",
        "사실 3년 묵힌 춘장과 6개월짜리를 구분한다",
        "대회 끝나고 화장실에서 우는 걸 들킨 적 있다",
        "천천히 먹어도 된다는 말을 들어본 적이 없다",
      ],
      spec: {"skin":"#e8c098","hair":"#241f1a","hairStyle":"buzz","top":"#d8d0c0","bottom":"#3a3a42","shoes":"#2a2a2a","heightScale":1,"widthScale":1.32,"accessory":"none","accessoryColor":"#8a5a2a","expression":"chad","aura":"fire","species":"human","props":[{"shape":"cone","color":"#a86a3a","size":0.42,"at":"handR","motion":"none","label":"거대한 닭다리"},{"shape":"cylinder","color":"#e8e4d8","size":0.34,"at":"ground","motion":"none","label":"쌓인 빈 그릇"}]},
    },
  },

  {
    id: "foodchain", category: "먹이사슬",
    client: {
      name: "아쿠아 박", gender: "남",
      look: ["청록색 비늘 피부","지느러미 머리","아가미","축축함"],
      personality: ["물 밖에선 말이 느려짐","로맨틱함","자기 비늘에 자부심"],
      upbringing: [
        "33세 · 심해 배관공 (어인)",
        "동해 해구 3구역 출생. 형제가 400마리쯤 되는데 이름은 12개만 안다",
        "수심 40m 사택. 지상 부동산은 어인에게 안 팔린다",
        "심해 위험수당 포함 월 620만원. 쓸 데가 없어서 다 모아둔다",
        "물 밖에 4시간 이상 있으면 비늘이 갈라진다. 보습제를 20분마다 바른다",
        "말이 막히면 아가미부터 움직인다. 본인은 모른다",
      ],
      spec: {"skin":"#4fc3c9","hair":"#1d7a86","hairStyle":"fin","top":"#0f5f6b","bottom":"#0a4550","shoes":"#083840","heightScale":1.04,"widthScale":1.05,"accessory":"none","accessoryColor":"#8ce8f0","expression":"shy","aura":"sparkle","species":"fish","props":[{"shape":"cylinder","color":"#6a6a72","size":0.36,"at":"handR","motion":"none","label":"파이프렌치"},{"shape":"sphere","color":"#7fb0bd","size":0.18,"at":"crown","motion":"bob","label":"물방울"}]},
    },
    target: {
      name: "레오 킴", gender: "남",
      look: ["황금색 사자 풀슈트","거대한 갈기","슈트를 절대 안 벗음","꼬리"],
      personality: ["장인 자부심","수줍음","슈트 안에서 표정을 숨김"],
      upbringing: [
        "28세 · 퍼리 슈트 제작 아티스트",
        "부산 사하구 출신. 어릴 때 별명이 \"털보\"였고 그게 싫었다",
        "작업실 겸 자택. 슈트 12벌이 옷장이 아니라 마네킹에 걸려 있다",
        "슈트 한 벌 주문제작 380만원. 대기 명단이 2년치다",
        "샤워를 새벽에 한다. 슈트를 벗는 시간을 아무한테도 안 들키려고",
        "칭찬을 들으면 갈기부터 만진다",
      ],
      taste: [
        "슈트 봉제 장인정신 이야기",
        "갈기 손질법",
        "사실 물 공포증이 있다",
        "참치회를 끊는 중이다",
        "슈트 안에서 운 걸 들킨 적 있다",
      ],
      spec: {"skin":"#f0c060","hair":"#c8880f","hairStyle":"mane","top":"#e8b44a","bottom":"#d9a13a","shoes":"#8a5a10","heightScale":1.1,"widthScale":1.3,"accessory":"none","accessoryColor":"#c8880f","expression":"happy","aura":"none","species":"lion","props":[{"shape":"spike","color":"#c0c0c8","size":0.26,"at":"handR","motion":"none","label":"재봉 가위"},{"shape":"box","color":"#e8a030","size":0.34,"at":"chest","motion":"none","label":"물 무서워서 입은 구명조끼"}]},
    },
  },

  {
    id: "os-war", category: "OS전쟁",
    client: {
      name: "리누스 정", gender: "남",
      look: ["부스스한 흑발","검정 후드","창백함","거북목"],
      personality: ["모든 대화를 기술 논쟁으로 만듦","이모지 못 씀","의외로 순정파"],
      upbringing: [
        "26세 · 커널 기여자 / Arch 유저",
        "대전 출신. 아버지가 전산실 직원이었고 그 방에서 자랐다",
        "고시원 3.3평. 모니터 3대가 침대보다 넓은 자리를 차지한다",
        "오픈소스 후원금 월 12만원이 수입의 전부. 라면 박스로 산다",
        "취침 시간이 없다. 커널 빌드가 끝나면 잔다",
        "말이 막히면 키보드 없는데도 손가락이 타이핑 모양으로 움직인다",
      ],
      spec: {"skin":"#e8d0c0","hair":"#2a2a2a","hairStyle":"spiky","top":"#111111","bottom":"#2a3a4a","shoes":"#333333","heightScale":1,"widthScale":0.78,"accessory":"glasses","accessoryColor":"#555555","expression":"weird","aura":"gloom","species":"human","props":[{"shape":"box","color":"#1f1f24","size":0.34,"at":"handR","motion":"none","label":"스티커 붙은 노트북"},{"shape":"box","color":"#40d040","size":0.12,"at":"crown","motion":"shake","label":"깜빡이는 터미널 커서"}]},
    },
    target: {
      name: "윤도우", gender: "여",
      look: ["하늘색 염색 단발","깔끔한 셔츠","단정함","늘 웃음"],
      personality: ["상냥한 도발","GUI 원리주의","설명 욕구"],
      upbringing: [
        "25세 · MS 공인 강사 / 파워토이 전도사",
        "분당 출신. 아버지 회사에서 받아온 정품 스티커를 모았다",
        "풀옵션 오피스텔. 케이블이 한 가닥도 안 보이게 정리되어 있다",
        "강의료 시간당 18만원. 강의 없는 달은 통장이 조용하다",
        "매일 밤 12시에 노트북을 닫는다. 그 뒤에 뭘 하는지는 아무도 모른다",
        "설명이 길어지면 손으로 창 배치를 그리기 시작한다",
      ],
      taste: [
        "예쁜 GUI와 애니메이션",
        "드라이버가 그냥 잡히는 것",
        "사실 매일 밤 WSL로 우분투를 쓴다 (극비)",
        "파워셸 원라이너 자랑",
        "Ctrl+Shift+Esc 반응속도 대결",
      ],
      spec: {"skin":"#f5dcc8","hair":"#5ac8f5","hairStyle":"bowl","top":"#ffffff","bottom":"#3a5a9a","shoes":"#dddddd","heightScale":0.99,"widthScale":1,"accessory":"none","accessoryColor":"#5ac8f5","expression":"happy","aura":"sparkle","species":"human","femme":true,"props":[{"shape":"box","color":"#4a9ae0","size":0.32,"at":"handR","motion":"none","label":"창문 네 칸"},{"shape":"box","color":"#f0f0f0","size":0.16,"at":"handL","motion":"none","label":"마우스"}]},
    },
  },

  {
    id: "vegan-butcher", category: "식습관",
    client: {
      name: "초록", gender: "여",
      look: ["초록색 브레이드 머리","해진 패딩","피켓","삐쩍 마름"],
      personality: ["신념 100%","말하다 목이 멘다","반박당하면 목소리가 커진다"],
      upbringing: [
        "24세 · 비건 액티비스트",
        "안동 출신. 할머니가 소를 키웠고 그 소가 팔려가는 걸 봤다",
        "시위 텐트가 사실상 집이다. 등록된 주소는 친구네 옥탑",
        "후원금 월 40만원. 피켓 재료비를 빼면 남는 게 없다",
        "하루 한 끼. 두유와 견과류. 그것도 자주 거른다",
        "흥분하면 말이 빨라지면서 손가락으로 숫자를 세기 시작한다",
      ],
      spec: {"skin":"#f0d8c0","hair":"#3faa4a","hairStyle":"twintail","top":"#6a8f5a","bottom":"#3a4a3a","shoes":"#5a4a3a","heightScale":0.94,"widthScale":0.78,"accessory":"headband","accessoryColor":"#3faa4a","expression":"angry","aura":"fire","species":"human","femme":true,"props":[{"shape":"box","color":"#e8e4d8","size":0.42,"at":"handR","motion":"shake","label":"피켓"},{"shape":"cone","color":"#e07a2a","size":0.24,"at":"handL","motion":"none","label":"당근"}]},
    },
    target: {
      name: "육점순", gender: "남",
      look: ["새빨간 앞치마","올린 머리","팔뚝 굵음","칼집 흉터"],
      personality: ["무뚝뚝","손이 빠름","남 챙김"],
      upbringing: [
        "27세 · 마장동 3대 정육점 사장 / 부위 감별 국가대표",
        "마장동에서 태어나 마장동에서 산다. 3대째 같은 골목이다",
        "가게 위층이 집. 계단이 18칸이고 그게 통근 거리 전부다",
        "가게 매출은 좋다. 근데 새벽 경매 자금으로 다 돌아나간다",
        "새벽 2시 기상, 저녁 7시 취침. 남들과 시간대가 안 맞는 삶이 11년째",
        "생각이 정리 안 되면 칼을 갈기 시작한다",
      ],
      taste: [
        "칼 가는 소리",
        "새벽 4시 경매장 이야기",
        "콩고기 품평에 진심이다",
        "할머니 김치찌개(고기 안 들어감)",
        "소마다 이름을 지어준다",
      ],
      spec: {"skin":"#e8bc96","hair":"#241a12","hairStyle":"bowl","top":"#c62828","bottom":"#3a3a3a","shoes":"#2a2a2a","heightScale":1,"widthScale":1.36,"accessory":"headband","accessoryColor":"#ffffff","expression":"neutral","aura":"none","species":"human","props":[{"shape":"spike","color":"#d8d8dc","size":0.44,"at":"handR","motion":"none","label":"정육 칼"},{"shape":"sphere","color":"#b04a4a","size":0.3,"at":"shoulderR","motion":"none","label":"어깨에 멘 고깃덩이"}]},
    },
  },

  {
    id: "vampire-garlic", category: "종족",
    client: {
      name: "블라드 최", gender: "남",
      look: ["새하얀 피부","검은 장발","망토","송곳니"],
      personality: ["말투가 고풍스러움","412년치 눈치 없음","밤에만 텐션 폭발"],
      upbringing: [
        "412세 · 야간 편의점 알바 (뱀파이어)",
        "1665년 왈라키아 출생. 한국에는 1998년에 왔고 이유는 말 안 한다",
        "창문 없는 반지하. 등기는 없다. 412년째 세입자다",
        "야간 알바 시급 12,400원. 재산이라곤 관 하나와 망토 세 벌",
        "해 뜨기 40분 전에 퇴근해서 저녁 8시에 일어난다",
        "당황하면 400년 전 말투가 튀어나오고 본인은 그걸 못 느낀다",
      ],
      spec: {"skin":"#f2f0f5","hair":"#151520","hairStyle":"long","top":"#2a0d1a","bottom":"#1a0a12","shoes":"#0d0d12","heightScale":1.08,"widthScale":0.9,"accessory":"none","accessoryColor":"#8a0d2a","expression":"weird","aura":"gloom","species":"vampire","props":[{"shape":"box","color":"#3a2a2a","size":0.6,"at":"ground","motion":"none","label":"관"},{"shape":"cylinder","color":"#7a1a2a","size":0.22,"at":"handR","motion":"none","label":"붉은 잔"}]},
    },
    target: {
      name: "김마늘", gender: "여",
      look: ["햇볕에 그을린 피부","밀짚모자","작업 장화","마늘 한 접을 어깨에 메고 다님"],
      personality: ["소탈함","새벽형","외로움을 잘 티냄"],
      upbringing: [
        "31세 · 의성 마늘 6대 농장주",
        "의성에서 태어나 의성에서 산다. 6대째다",
        "본가 옆 신축 농가주택. 마늘 창고가 집보다 크다",
        "작년 흑마늘 매출 2억 4천. 대출 갚고 나면 손에 남는 건 3천",
        "새벽 5시 밭, 밤 9시 취침. 술은 명절에만",
        "민망해지면 밀짚모자 챙을 눌러쓴다",
      ],
      taste: [
        "흑마늘 90일 숙성 이야기",
        "새벽 농사 루틴",
        "마늘 냄새 때문에 연애를 한 번도 못 해봤다",
        "밤에 별 보는 걸 좋아한다",
        "마늘을 안 먹는 사람이 신기하다",
      ],
      spec: {"skin":"#d8a070","hair":"#3a2a1a","hairStyle":"short","top":"#8a9a5a","bottom":"#5a5a3a","shoes":"#3a2a1a","heightScale":1,"widthScale":1.12,"accessory":"hat","accessoryColor":"#d8c078","expression":"happy","aura":"stink","species":"human","femme":true,"props":[{"shape":"sphere","color":"#f0ecd8","size":0.3,"at":"handR","motion":"none","label":"마늘 한 접"},{"shape":"sphere","color":"#f0ecd8","size":0.22,"at":"waist","motion":"none","label":"허리에 찬 마늘"}]},
    },
  },

  {
    id: "cat-allergy", category: "알레르기",
    client: {
      name: "재채기", gender: "여",
      look: ["검은 곱슬","흰 가운","눈이 늘 충혈","늘 한 발 물러서 있는 자세"],
      personality: ["의학 용어 남발","자기 몸 안 챙김","은근 고집"],
      upbringing: [
        "30세 · 이비인후과 전공의",
        "목포 출신. 의대 가려고 서울 왔고 그 뒤로 못 내려갔다",
        "병원 앞 원룸. 짐이 캐리어 두 개뿐이고 3년째 안 풀었다",
        "전공의 월급 320만원. 학자금 대출이 4천 남았다",
        "수면이 조각나 있다. 당직 끝나고 4시간, 오후에 2시간",
        "긴장하면 상대의 코와 목을 번갈아 본다. 직업병이다",
      ],
      spec: {"skin":"#f2d8bc","hair":"#2a1a14","hairStyle":"afro","top":"#f4f4f4","bottom":"#4a5a6a","shoes":"#ffffff","heightScale":1,"widthScale":0.86,"accessory":"glasses","accessoryColor":"#222222","expression":"shy","aura":"static","species":"human","femme":true,"props":[{"shape":"sphere","color":"#f4f4f4","size":0.24,"at":"handR","motion":"none","label":"휴지 뭉치"},{"shape":"cylinder","color":"#e8a030","size":0.18,"at":"handL","motion":"none","label":"알레르기 약통"}]},
    },
    target: {
      name: "냥선생", gender: "남",
      look: ["고양이 털투성이 니트","갈색 포니테일","늘 웅크린 자세","손등 스크래치"],
      personality: ["고양이 얘기만 나오면 3배속","사람 경계","츄르 소믈리에"],
      upbringing: [
        "34세 · 고양이 호텔 사장 (집사 40묘)",
        "제주 출신. 첫 고양이가 항구에서 따라온 길고양이였다",
        "고양이 호텔 3층이 자택. 사람 방은 4평이고 나머지가 다 고양이 방",
        "월 매출 900만원 중 사료·병원비로 700이 나간다",
        "하루 네 번 밥, 두 번 화장실. 자기 끼니는 그 사이에 대충",
        "사람이 어색해지면 옆에 있는 고양이 이름을 부른다",
      ],
      taste: [
        "고양이 사진 40장 보여주기",
        "츄르 브랜드 비교 토론",
        "40마리 이름을 다 외워주는 사람에게 무너진다",
        "알레르기약을 미리 챙겨오는 배려",
        "사실 강아지도 좋아한다 (극비)",
      ],
      spec: {"skin":"#f0d0b0","hair":"#8a5a2a","hairStyle":"twintail","top":"#e0c8a8","bottom":"#6a5a4a","shoes":"#a08060","heightScale":0.96,"widthScale":0.98,"accessory":"headband","accessoryColor":"#ff9ec4","expression":"happy","aura":"hearts","species":"cat","props":[{"shape":"cylinder","color":"#e8a850","size":0.2,"at":"handR","motion":"none","label":"츄르"},{"shape":"sphere","color":"#b09070","size":0.16,"at":"orbit","motion":"orbit","label":"떠다니는 털뭉치"}]},
    },
  },

  {
    id: "circadian", category: "생활리듬",
    client: {
      name: "조기상", gender: "남",
      look: ["짧은 스포츠 머리","기능성 러닝복","탄탄한 체형","눈 밑 그늘 없음"],
      personality: ["자기계발 문장 남발","지나치게 긍정","루틴 강박"],
      upbringing: [
        "28세 · 미라클모닝 유튜버 (구독자 40만)",
        "대구 출신. 삼수생 시절 새벽반 학원에서 인생이 바뀌었다고 믿는다",
        "한강 보이는 오피스텔. 방에 침대보다 러닝머신이 먼저 들어왔다",
        "유튜브 수익 월 1,100만원. 절반을 자기계발 강의 사는 데 쓴다",
        "새벽 3시 50분 기상, 밤 9시 취침. 10년째 흐트러진 적이 없다",
        "대화가 늘어지면 자기도 모르게 시계를 본다",
      ],
      spec: {"skin":"#e8c8a0","hair":"#1a1a1a","hairStyle":"short","top":"#ff6a00","bottom":"#1a1a1a","shoes":"#ffffff","heightScale":1.04,"widthScale":1.06,"accessory":"headband","accessoryColor":"#ff6a00","expression":"happy","aura":"fire","species":"human","props":[{"shape":"torus","color":"#e0c040","size":0.26,"at":"handR","motion":"shake","label":"새벽 4시 알람"},{"shape":"sphere","color":"#f0d040","size":0.3,"at":"crown","motion":"bob","label":"아직 안 뜬 해"}]},
    },
    target: {
      name: "밤샘", gender: "여",
      look: ["보라색 장발","후줄근한 후드","햇빛 본 지 오래된 낯빛","눈 밑이 검게 내려앉음"],
      personality: ["목소리가 좋음","낮에는 무기력","새벽에 철학자"],
      upbringing: [
        "26세 · 심야 라디오 DJ / 새벽 만화가",
        "인천 출신. 어릴 때 아버지가 야간 택시를 몰았다",
        "방음 커튼 세 겹 친 원룸. 낮에는 동굴이다",
        "라디오 출연료 회당 22만원, 만화 원고료는 밀려 있다",
        "새벽 4시 취침, 오후 1시 기상. 햇빛을 보면 두통이 난다",
        "생각할 때 손가락으로 책상을 두드린다. 늘 같은 리듬이다",
      ],
      taste: [
        "새벽 3시 도시의 소음",
        "라디오 사연 읽어주기",
        "해 뜨는 걸 5년째 못 봤고 사실 보고 싶다",
        "아침형 인간 콘텐츠를 몰래 정주행한다",
        "같이 밤새워 줄 사람",
      ],
      spec: {"skin":"#efe0e8","hair":"#9a5ad0","hairStyle":"long","top":"#3a2a4a","bottom":"#2a2a3a","shoes":"#4a4a5a","heightScale":0.98,"widthScale":0.86,"accessory":"none","accessoryColor":"#9a5ad0","expression":"neutral","aura":"gloom","species":"human","femme":true,"props":[{"shape":"spike","color":"#3a3a44","size":0.26,"at":"handR","motion":"none","label":"태블릿 펜"},{"shape":"cylinder","color":"#6a4a3a","size":0.34,"at":"ground","motion":"none","label":"쌓인 커피 캔"},{"shape":"disc","color":"#d8d8e8","size":0.24,"at":"crown","motion":"yaw","label":"새벽 4시 달"}]},
    },
  },

  {
    id: "mbti-stats", category: "세계관",
    client: {
      name: "신점집", gender: "여",
      look: ["보라색 웨이브 장발","자수정 목걸이","개량 한복","말하기 전에 방울부터 흔듦"],
      personality: ["확신에 참","사람 잘 읽음","틀려도 해석을 바꿔서 맞춘다"],
      upbringing: [
        "35세 · MBTI 사주 융합 상담사",
        "남해 출신. 외할머니가 무당이었다는 얘기는 안 한다",
        "상담실 겸 자택 한옥. 방 하나가 통째로 자수정이다",
        "상담 1회 15만원, 예약이 두 달 밀려 있다. 현금만 받는다",
        "아침에 그날의 일진을 보고 나서야 문을 나선다",
        "반박당하면 상대의 손동작부터 관찰하기 시작한다",
      ],
      spec: {"skin":"#f5dcc0","hair":"#7a3aa8","hairStyle":"long","top":"#c9a8e8","bottom":"#5a3a7a","shoes":"#8a6ab0","heightScale":0.9,"widthScale":1.06,"accessory":"flower","accessoryColor":"#c060ff","expression":"weird","aura":"sparkle","species":"human","femme":true,"props":[{"shape":"sphere","color":"#d8c040","size":0.22,"at":"handR","motion":"shake","label":"무당 방울"},{"shape":"box","color":"#e0d060","size":0.2,"at":"chest","motion":"none","label":"부적"}]},
    },
    target: {
      name: "표준편", gender: "남",
      look: ["짧은 흑발","무채색 셔츠","무테 안경","눈을 잘 안 마주침"],
      personality: ["유의수준을 대화에 끌어들임","뭘 듣든 반례부터 찾음","농담에 \"그건 표본이 1이죠\"로 답함"],
      upbringing: [
        "33세 · 통계학 박사 / 유사과학 저격 블로거",
        "청주 출신. 부모가 둘 다 교사였다",
        "연구실에 간이침대를 두고 잔다. 집은 잠만 자러 간다",
        "조교수 연봉 5,400. 블로그는 수익이 0원이고 그게 자랑이다",
        "커피를 하루 여섯 잔. 잔 수를 스프레드시트에 기록한다",
        "동의 못 할 때 안경을 고쳐 쓴다. 그게 반박 예고 신호다",
      ],
      taste: [
        "p값과 재현성 위기 이야기",
        "데이터로 반박당하는 것",
        "어릴 때 타로 한 장에 진심으로 위로받은 적이 있다",
        "예측 내기를 좋아한다",
        "커피 점(占)은 귀엽다고 생각한다",
      ],
      spec: {"skin":"#eddcc8","hair":"#1f1f1f","hairStyle":"short","top":"#8a8a8a","bottom":"#3a3a3a","shoes":"#1a1a1a","heightScale":1.01,"widthScale":0.8,"accessory":"glasses","accessoryColor":"#aaaaaa","expression":"neutral","aura":"none","species":"human","props":[{"shape":"box","color":"#3a3a44","size":0.2,"at":"handR","motion":"none","label":"계산기"},{"shape":"disc","color":"#7a8a96","size":0.3,"at":"crown","motion":"yaw","label":"p<0.05"}]},
    },
  },

  {
    id: "sauce-war", category: "탕수육",
    client: {
      name: "부어라", gender: "남",
      look: ["기름진 올백","중식 조리복","팔뚝에 화상 자국","단단한 체격"],
      personality: ["목소리 큼","전통 강조","눈물 많음"],
      upbringing: [
        "31세 · 중식당 4대 사장 / 부먹연맹 총재",
        "화교 4세. 인천 차이나타운에서 태어났다",
        "가게 3층이 집. 계단에 소스 통이 쌓여 있어 옆으로 걸어 올라간다",
        "가게 시가 12억. 근데 현금은 늘 없다. 재료비로 다 나간다",
        "오전 10시 출근, 새벽 1시 마감. 쉬는 날은 설과 추석뿐",
        "감정이 올라오면 목소리가 반 톤씩 계속 올라간다",
      ],
      spec: {"skin":"#e8c090","hair":"#1a1208","hairStyle":"short","top":"#f0e8d8","bottom":"#2a2a2a","shoes":"#1a1a1a","heightScale":1,"widthScale":1.25,"accessory":"mustache","accessoryColor":"#1a1208","expression":"chad","aura":"fire","species":"human","props":[{"shape":"cylinder","color":"#a86a2a","size":0.36,"at":"handR","motion":"none","label":"통째로 붓는 소스"},{"shape":"disc","color":"#3a3a3a","size":0.42,"at":"handL","motion":"none","label":"웍"}]},
    },
    target: {
      name: "찍어라", gender: "여",
      look: ["깔끔한 단발","베이지 트렌치","가는 손목","늘 수첩"],
      personality: ["논리적","까칠하지만 정중","미식 집착"],
      upbringing: [
        "29세 · 푸드 칼럼니스트 / 찍먹협회장",
        "서울 토박이. 아버지가 중식당을 자주 데려갔다",
        "연남동 투룸. 한 방이 통째로 식자재 냉장고다",
        "칼럼 원고료 편당 40만원. 협찬은 전부 거절해서 늘 빠듯하다",
        "먹은 것을 전부 수첩에 적는다. 12년치 수첩이 있다",
        "맛을 볼 때 눈을 감는다. 상대가 말하는 중에도 그런다",
      ],
      taste: [
        "튀김옷 바삭도 측정 데이터",
        "소스 산도(pH) 이야기",
        "사실 집에서 혼자 먹을 땐 부어 먹는다",
        "탕수육보다 깐풍기를 더 좋아한다",
        "어릴 적 아빠가 부어주던 탕수육 기억",
      ],
      spec: {"skin":"#f5dfc8","hair":"#3a2a20","hairStyle":"bowl","top":"#d8c8a8","bottom":"#5a4a3a","shoes":"#8a7a6a","heightScale":0.98,"widthScale":0.9,"accessory":"glasses","accessoryColor":"#c8a860","expression":"neutral","aura":"none","species":"human","femme":true,"props":[{"shape":"disc","color":"#a86a2a","size":0.18,"at":"handR","motion":"none","label":"찍는 종지"},{"shape":"spike","color":"#d8c8a8","size":0.3,"at":"handL","motion":"none","label":"젓가락"}]},
    },
  },

  {
    id: "gamer-activist", category: "세대전쟁",
    client: {
      name: "페이컷", gender: "남",
      look: ["탈색 은발","팀 유니폼","앉은 자세가 굽었다","손목 보호대"],
      personality: ["말 짧음","승부욕","감정 표현 서툼"],
      upbringing: [
        "22세 · LCK 미드라이너",
        "부산 출신. 열네 살에 상경해서 숙소 생활만 8년 했다",
        "팀 숙소 2인실. 개인 물건이 캐리어 하나에 다 들어간다",
        "연봉 4억 2천. 쓸 줄을 몰라서 통장에 그대로 있다",
        "기상 오후 1시, 스크림 후 새벽 4시 취침. 밥은 배달",
        "말문이 막히면 마우스를 쥔 것처럼 손이 굽는다",
      ],
      spec: {"skin":"#f0dcc8","hair":"#e8e8f0","hairStyle":"spiky","top":"#1a2a6a","bottom":"#1a1a2a","shoes":"#ff3355","heightScale":1,"widthScale":0.82,"accessory":"headband","accessoryColor":"#1a2a6a","expression":"neutral","aura":"static","species":"human","props":[{"shape":"box","color":"#2a2a32","size":0.18,"at":"handR","motion":"shake","label":"게이밍 마우스"},{"shape":"box","color":"#3a3a44","size":0.42,"at":"waist","motion":"none","label":"RGB 키보드"}]},
    },
    target: {
      name: "정화연", gender: "여",
      look: ["단정한 갈색 단발","정장","피곤한 눈","어깨가 한쪽으로 기울어 있음"],
      personality: ["말이 조리 있음","벽이 두꺼움","아들 얘기엔 무너짐"],
      upbringing: [
        "39세 · 청소년게임중독대책위 사무국장",
        "원주 출신. 교사 생활 10년 하다가 시민단체로 옮겼다",
        "25평 아파트, 아들 방문은 늘 닫혀 있다",
        "사무국장 월급 280만원. 아들 학원비가 그보다 많다",
        "밤 12시 소등 원칙. 본인만 지키고 아들은 안 지킨다",
        "곤란해지면 자료집을 뒤적인다. 찾는 게 없어도 뒤적인다",
      ],
      taste: [
        "청소년 상담 사례 이야기",
        "밤 12시 취침 원칙",
        "아들이 프로게이머 지망생이다",
        "사실 테트리스 세계랭커였다",
        "게임이 미운 게 아니라 아들을 이해 못 하는 자신이 무섭다",
      ],
      spec: {"skin":"#ecd4bc","hair":"#4a3020","hairStyle":"bowl","top":"#4a4a58","bottom":"#3a3a48","shoes":"#2a2a2a","heightScale":0.97,"widthScale":1,"accessory":"none","accessoryColor":"#4a3020","expression":"neutral","aura":"gloom","species":"human","femme":true,"props":[{"shape":"box","color":"#e8e4d8","size":0.3,"at":"handR","motion":"none","label":"규제안 서류"},{"shape":"disc","color":"#8a8a94","size":0.26,"at":"crown","motion":"yaw","label":"밤 12시 셧다운"}]},
    },
  },

  {
    id: "minimal-hoarder", category: "소유",
    client: {
      name: "공백", gender: "남",
      look: ["민머리","흰 무지 티","군더더기 없는 체형","가방 없음"],
      personality: ["문장을 짧게 끊는다","판단 안 함","고요함"],
      upbringing: [
        "36세 · 미니멀리스트 (소유물 12개)",
        "어디 출신인지 말하지 않는다. 기록을 다 버렸다고 한다",
        "6평 원룸. 가구는 매트리스 하나, 옷은 세 벌",
        "컨설팅 수입 월 500. 통장 하나, 카드 없음, 저축은 전액 인덱스",
        "식사는 하루 두 번, 같은 메뉴. 고민할 일을 없애려고",
        "어색하면 눈앞의 물건 개수를 소리 내서 센다",
      ],
      spec: {"skin":"#e8d0b8","hair":"#3a3a3a","hairStyle":"bald","top":"#f8f8f8","bottom":"#e8e8e8","shoes":"#dddddd","heightScale":1.02,"widthScale":0.9,"accessory":"none","accessoryColor":"#cccccc","expression":"neutral","aura":"none","species":"human","props":[{"shape":"box","color":"#f4f4f0","size":0.14,"at":"handR","motion":"none","label":"소유물 12개 중 하나"}]},
    },
    target: {
      name: "만물상", gender: "여",
      look: ["헝클어진 장발","빈티지 티셔츠 겹쳐 입음","통통함","먼지"],
      personality: ["수다스러움","물건에 사연 부여","버리는 걸 못 함"],
      upbringing: [
        "41세 · 3층 창고형 자택 거주 / 수집품 4만 점",
        "수원 출신. 형과 방을 같이 썼고 형은 2009년에 죽었다",
        "3층 단독주택 전체가 창고. 잠은 2층 소파에서 잔다",
        "수집품 감정가 총 4억. 현금은 40만원. 아무것도 못 판다",
        "먹고 자는 시간이 불규칙하다. 정리하다 보면 이틀이 지나 있다",
        "얘기하다 흥분하면 관련 물건을 찾으러 자리를 뜬다",
      ],
      taste: [
        "희귀 수집품 자랑 들어주기",
        "90년대 굿즈 이야기",
        "사실 물건 버리는 법을 배우고 싶다",
        "수집품 하나하나에 돌아가신 형 얘기가 있다",
        "대신 정리해주는 사람에게 약하다",
      ],
      spec: {"skin":"#efd8c0","hair":"#5a4030","hairStyle":"afro","top":"#c85a30","bottom":"#4a5a7a","shoes":"#7a6a5a","heightScale":0.98,"widthScale":1.4,"accessory":"glasses","accessoryColor":"#7a5a3a","expression":"happy","aura":"money","species":"human","femme":true,"props":[{"shape":"box","color":"#8a6a4a","size":0.26,"at":"shoulderR","motion":"none","label":"이고 다니는 상자"},{"shape":"box","color":"#a88a5a","size":0.32,"at":"ground","motion":"none","label":"안 버린 상자"},{"shape":"sphere","color":"#9a8a6a","size":0.2,"at":"orbit","motion":"orbit","label":"수집품 4만 점 중 하나"}]},
    },
  },

  {
    id: "alien-ufologist", category: "정체은닉",
    client: {
      name: "그레이 7호", gender: "무성",
      look: ["회색 피부","거대한 검은 눈","더듬이","작고 마름"],
      personality: ["지구 관용구를 잘못 씀","호기심 과다","거짓말 못 함"],
      upbringing: [
        "3세(지구 나이 · 본국 기준 성인) · 편의점 야간 (위장 취업) / 외계 정찰병",
        "제타 성단 4행성 출생. 지구 나이로 3세, 본국 기준 성인이다",
        "편의점 창고에 접이식 침낭. 모선은 뒷산에 접어서 숨겨뒀다",
        "지구 화폐 자산 31만원. 가치 개념을 아직 이해 못 했다",
        "수면이 필요 없어서 밤새 지구 방송을 본다. 홈쇼핑을 제일 좋아한다",
        "당황하면 관용구를 잘못 쓴다. \"발이 넓으시네요\"를 신발 얘기로 안다",
      ],
      spec: {"skin":"#b8c8d0","hair":"#8a9aa8","hairStyle":"bald","top":"#5a7a8a","bottom":"#3a5a6a","shoes":"#2a4a5a","heightScale":0.82,"widthScale":0.76,"accessory":"antenna","accessoryColor":"#7affd8","expression":"weird","aura":"sparkle","species":"alien","props":[{"shape":"disc","color":"#a8b8c8","size":0.4,"at":"orbit","motion":"yaw","label":"본인 우주선"},{"shape":"box","color":"#d84a4a","size":0.2,"at":"handR","motion":"none","label":"편의점 스캐너"}]},
    },
    target: {
      name: "진실탐사대", gender: "남",
      look: ["은박 모자","헝클어진 반백 머리","낡은 야상","구부정함"],
      personality: ["열정 과다","외로움","남 말 잘 믿음"],
      upbringing: [
        "44세 · UFO 폭로 유튜버 (구독자 800명)",
        "원주 출신. 20년간 지방 방송국 조명 기사였다",
        "원룸에 안테나 4개. 집주인이 세 번 경고했다",
        "연금 월 74만원. 촬영 장비 할부가 아직 남았다",
        "새벽 2시부터 4시까지 하늘을 본다. 8년째 매일",
        "반박당하면 은박 모자를 고쳐 쓴다",
      ],
      taste: [
        "51구역 은폐 이야기",
        "은박 모자 패션 품평",
        "3년째 아무도 안 믿어줘서 진심으로 외롭다",
        "진짜 외계인을 만나면 울 것 같다",
        "아내가 떠난 이유가 이 채널이다",
      ],
      spec: {"skin":"#e8d0b8","hair":"#a8a8a8","hairStyle":"afro","top":"#5a6a4a","bottom":"#4a4a3a","shoes":"#3a3a2a","heightScale":0.99,"widthScale":1.08,"accessory":"hat","accessoryColor":"#c8c8d8","expression":"weird","aura":"gloom","species":"human","props":[{"shape":"disc","color":"#d8d8dc","size":0.34,"at":"handR","motion":"shake","label":"은박 접시"},{"shape":"box","color":"#3a3a44","size":0.24,"at":"chest","motion":"none","label":"캠코더"}]},
    },
  },

  {
    id: "zombie-hunter", category: "생사",
    client: {
      name: "워커 진", gender: "남",
      look: ["잿빛 피부","실밥 자국","늘어진 검은 머리","한쪽 어깨가 처짐"],
      personality: ["느릿함","자기 비하","의외로 유머러스"],
      upbringing: [
        "34세 · 시체 분장 배우 (위장) / 사망 6년차 좀비",
        "광주 출신. 2071년 사망. 장례식에 본인이 갔다",
        "반지하. 창문을 막아뒀다. 여름에 냄새가 심하다",
        "분장 배우 일당 15만원. 방부 처리 약품값이 그보다 비싸다",
        "잠을 안 잔다. 대신 하루 두 번 몸이 굳는 시간이 있다",
        "감정이 올라오면 턱관절이 먼저 어긋난다",
      ],
      spec: {"skin":"#9ab08a","hair":"#2a2a20","hairStyle":"long","top":"#5a5040","bottom":"#3a3830","shoes":"#2a2820","heightScale":1.02,"widthScale":1,"accessory":"none","accessoryColor":"#7a3a3a","expression":"weird","aura":"gloom","species":"zombie","props":[{"shape":"box","color":"#7a8a5a","size":0.24,"at":"handR","motion":"none","label":"분장용 인조 피"},{"shape":"sphere","color":"#8a9a6a","size":0.16,"at":"shoulderL","motion":"none","label":"떨어질 뻔한 살점"}]},
    },
    target: {
      name: "헌터 오", gender: "여",
      look: ["짧은 갈색 머리","전술 조끼","허리에 탄창 여섯","흉터"],
      personality: ["과묵","경계심 최상","규정 준수"],
      upbringing: [
        "30세 · 좀비대응특공대 저격수",
        "속초 출신. 동생이 하나 있었다. 지금은 없다",
        "관사 1인실. 벽에 아무것도 안 걸어놨다",
        "특공대 수당 포함 월 480. 절반을 부모님께 보낸다",
        "기상 5시, 사격장 두 시간. 휴일에도 똑같다",
        "거짓말을 들으면 왼쪽 눈을 살짝 가늘게 뜬다",
      ],
      taste: [
        "총기 정비 루틴",
        "생존 배낭 꾸리기",
        "첫 임무에서 좀비가 된 동생을 못 쐈다",
        "좀비에게도 감정이 있다고 몰래 생각한다",
        "머리 냄새에 이상하게 민감하다",
      ],
      spec: {"skin":"#e0bc98","hair":"#6a4a2a","hairStyle":"short","top":"#4a5040","bottom":"#3a4030","shoes":"#2a2a20","heightScale":1.03,"widthScale":1.12,"accessory":"sunglasses","accessoryColor":"#111111","expression":"angry","aura":"none","species":"human","femme":true,"props":[{"shape":"cylinder","color":"#3a3a3a","size":0.6,"at":"handR","motion":"none","label":"저격총"},{"shape":"box","color":"#4a5a3a","size":0.2,"at":"chest","motion":"none","label":"탄창 여섯"}]},
    },
  },

  {
    id: "noise-drummer", category: "층간소음",
    client: {
      name: "조용히", gender: "여",
      look: ["가르마 탄 흑발","회색 카디건","한 손에 늘 소음측정기","늘 귀마개 목에 걸침"],
      personality: ["예민함","기록 집착","정 없어 보이지만 있음"],
      upbringing: [
        "38세 · 아파트 자치회 소음분과장 (신고 1,204건)",
        "성남 출신. 학창 시절 내내 도서관에서 살았다",
        "아파트 12층. 위층은 13층이고 그게 인생의 중심 좌표다",
        "세무사 사무실 근무, 월 390. 방음공사 견적도 알아봤다가 포기했다",
        "밤 10시 취침 시도, 실패, 새벽 2시 각성이 반복된다",
        "스트레스받으면 손톱으로 책상을 규칙적으로 긁는다",
      ],
      spec: {"skin":"#ecd8c0","hair":"#241a12","hairStyle":"bowl","top":"#9a9a9a","bottom":"#4a4a55","shoes":"#3a3a3a","heightScale":0.94,"widthScale":0.88,"accessory":"headband","accessoryColor":"#dd4444","expression":"angry","aura":"none","species":"human","femme":true,"props":[{"shape":"box","color":"#3a4a5a","size":0.2,"at":"handR","motion":"none","label":"소음측정기"},{"shape":"box","color":"#e8e4d8","size":0.3,"at":"handL","motion":"none","label":"신고서 1,204장"}]},
    },
    target: {
      name: "두둠칫", gender: "남",
      look: ["형광 분홍 머리","민소매","팔 근육","늘 스틱을 들고 있음"],
      personality: ["에너지 폭발","미안함을 숨김","리듬으로 말함"],
      upbringing: [
        "25세 · 홈 드럼 스트리머 (위층 거주)",
        "대전 출신. 중학교 밴드부에서 처음 스틱을 잡았다",
        "아파트 13층. 거실을 통째로 드럼방으로 개조했다",
        "스트리밍 수익 월 210만원. 방음공사 견적 4,800만원 앞에서 무의미하다",
        "연습은 새벽에 한다. 낮에는 아르바이트를 나간다",
        "말하다가 손이 자동으로 리듬을 친다. 무릎이든 책상이든",
      ],
      taste: [
        "방음 부스 스펙 이야기",
        "좋은 스네어 소리",
        "새벽 연습 때문에 늘 아래층에 미안했다",
        "아래층 사람 얼굴을 한 번도 못 봤다",
        "방음공사 견적 4,800만원 때문에 파산 직전이다",
      ],
      spec: {"skin":"#f0d0b0","hair":"#ff44aa","hairStyle":"mohawk","top":"#1a1a1a","bottom":"#4a2a5a","shoes":"#ff44aa","heightScale":1.06,"widthScale":1.2,"accessory":"none","accessoryColor":"#ff44aa","expression":"happy","aura":"fire","species":"human","props":[{"shape":"spike","color":"#d8c8a8","size":0.34,"at":"handR","motion":"shake","label":"드럼 스틱"},{"shape":"spike","color":"#d8c8a8","size":0.34,"at":"handL","motion":"shake","label":"드럼 스틱"},{"shape":"cylinder","color":"#c04a5a","size":0.34,"at":"ground","motion":"none","label":"베이스 드럼"}]},
    },
  },

  {
    id: "snake-phobia", category: "공포증",
    client: {
      name: "서파인", gender: "여",
      look: ["초록빛 브레이드","비늘 무늬 재킷","길쭉한 체형","차가운 손"],
      personality: ["조용조용함","동물 앞에서만 수다","눈을 잘 안 깜빡임"],
      upbringing: [
        "32세 · 파충류 브리더 (뱀 217마리)",
        "거제 출신. 어릴 때 뒷산에서 처음 뱀을 봤고 안 무서웠다",
        "단독주택 전체가 사육장. 사람 공간은 부엌 옆 3평",
        "브리딩 수입 월 700. 사육 유지비가 500이라 남는 게 적다",
        "온도 체크 때문에 3시간마다 깬다. 통잠을 자 본 지 6년",
        "침묵이 5초 넘으면 뱀 이름을 순서대로 읊기 시작한다",
      ],
      spec: {"skin":"#e0dcc0","hair":"#2a7a4a","hairStyle":"long","top":"#3a6a4a","bottom":"#2a3a2a","shoes":"#1a2a1a","heightScale":1.14,"widthScale":0.84,"accessory":"none","accessoryColor":"#7aff9a","expression":"weird","aura":"none","species":"human","femme":true,"props":[{"shape":"cylinder","color":"#5a8a4a","size":0.44,"at":"shoulderR","motion":"none","label":"목에 감은 뱀"},{"shape":"box","color":"#8a7a5a","size":0.3,"at":"ground","motion":"none","label":"사육장"}]},
    },
    target: {
      name: "안심해", gender: "남",
      look: ["부드러운 갈색 단발","니트 가디건","온화한 인상","앉으면 손을 무릎에 포갠다"],
      personality: ["목소리가 낮고 안정적","남 걱정만 함","자기 문제는 방치"],
      upbringing: [
        "35세 · 공포증 전문 심리상담사 (본인은 뱀 공포증)",
        "춘천 출신. 어머니가 불안장애를 앓았고 그래서 이 직업을 골랐다",
        "상담실 겸 자택. 책이 벽 세 면을 채우고 있다",
        "상담 1회 8만원, 저소득층은 무료. 그래서 늘 빠듯하다",
        "점심을 거른다. 상담이 붙어 있으면 저녁도 거른다",
        "자기 얘기가 나오면 찻잔을 두 손으로 감싸 쥔다",
      ],
      taste: [
        "노출치료 이론 이야기",
        "차분한 호흡법 공유",
        "자기 공포증을 못 고치는 게 최대 콤플렉스다",
        "도마뱀은 사실 귀엽다고 생각한다",
        "진심으로 극복하고 싶다",
      ],
      spec: {"skin":"#f2dcc4","hair":"#8a6a48","hairStyle":"bowl","top":"#d8c8b0","bottom":"#7a6a5a","shoes":"#9a8a7a","heightScale":0.98,"widthScale":0.98,"accessory":"glasses","accessoryColor":"#b0906a","expression":"shy","aura":"none","species":"human","props":[{"shape":"box","color":"#e8e4d8","size":0.26,"at":"handR","motion":"none","label":"공포증 문진표"},{"shape":"sphere","color":"#c8d8e0","size":0.2,"at":"crown","motion":"bob","label":"식은땀"}]},
    },
  },

  {
    id: "timetraveler-luddite", category: "문명",
    client: {
      name: "크로노 강", gender: "여",
      look: ["형광 하늘색 짧은 머리","홀로그램 재킷","날렵함","관자놀이에 단자"],
      personality: ["미래 지식 자랑 욕구","조급함","순진함"],
      upbringing: [
        "27세 · 시간관리국 도망자 (2231년생)",
        "2231년 네오서울 제3거주구 출생. 지상을 본 게 여기 와서가 처음이다",
        "숙소가 없다. 공동체 헛간에서 몰래 잔다",
        "2231년 자산은 몰수됐다. 현재 소지금 0원, 대신 손목에 시간관리국 단자",
        "수면 주기가 안 맞는다. 154년 뒤 시간대로 몸이 돌아간다",
        "초조해지면 존재하지 않는 홀로그램을 허공에 띄우려 손을 젓는다",
      ],
      spec: {"skin":"#f0dcc8","hair":"#6adcff","hairStyle":"spiky","top":"#2a3a6a","bottom":"#1a2a4a","shoes":"#8adcff","heightScale":1.01,"widthScale":0.9,"accessory":"sunglasses","accessoryColor":"#6adcff","expression":"happy","aura":"sparkle","species":"robot","femme":true,"props":[{"shape":"torus","color":"#40d8e8","size":0.34,"at":"handR","motion":"yaw","label":"시간 좌표계"},{"shape":"box","color":"#e8e050","size":0.14,"at":"chest","motion":"shake","label":"연료 부족 경고"}]},
    },
    target: {
      name: "손망치", gender: "남",
      look: ["희끗한 장발과 수염","손수 짠 옷","도끼를 지팡이처럼 짚고 있음","단단한 체격"],
      personality: ["느긋함","고집","말보다 손"],
      upbringing: [
        "45세 · 기계파괴주의 공동체 촌장 (전기 없이 삶)",
        "이 산에서 태어나 이 산에서 늙었다. 아래 마을에는 12년째 안 내려갔다",
        "손수 지은 흙집. 못을 하나도 안 썼다는 게 자랑이다",
        "화폐를 안 쓴다. 물물교환으로 산다. 장부는 나무판에 새긴다",
        "해 뜨면 일어나고 해 지면 잔다. 시계를 유일한 기계로 허용한다",
        "생각할 때 손바닥의 굳은살을 엄지로 문지른다",
      ],
      taste: [
        "손편지 받기",
        "장작 패는 리듬 이야기",
        "죽은 아내의 목소리 녹음을 몰래 듣는다 (유일한 기계)",
        "미래가 궁금해서 미치겠다",
        "손목시계만은 허용한다",
      ],
      spec: {"skin":"#d8b088","hair":"#c8c0b0","hairStyle":"long","top":"#8a7a5a","bottom":"#5a4a3a","shoes":"#4a3a28","heightScale":1.05,"widthScale":1.24,"accessory":"beard","accessoryColor":"#c8c0b0","expression":"neutral","aura":"none","species":"human","props":[{"shape":"cone","color":"#8a6a4a","size":0.42,"at":"handR","motion":"none","label":"도끼"},{"shape":"box","color":"#6a5a4a","size":0.34,"at":"ground","motion":"none","label":"장작"}]},
    },
  },

  {
    id: "taxman-hacker", category: "법",
    client: {
      name: "세무진", gender: "남",
      look: ["단정한 가르마","남색 정장","서류가방이 늘 꽉 차 있음","가방을 절대 안 내려놓음"],
      personality: ["원칙주의","건조함","숨은 낭만"],
      upbringing: [
        "37세 · 국세청 조사4국 팀장",
        "군산 출신. 아버지가 작은 공장을 하다 세금 문제로 접었다",
        "30평 아파트, 대출 2억 8천. 방 하나는 서류로 차 있다",
        "5급 공무원 연봉 6,200. 부수입은 0원이고 그걸 지키는 게 자부심이다",
        "출근 7시 20분, 퇴근 시간은 없다. 주말에도 사무실에 나온다",
        "긴장하면 볼펜 뚜껑을 규칙적으로 여닫는다",
      ],
      spec: {"skin":"#eed8c0","hair":"#1f1a14","hairStyle":"short","top":"#2a3a5a","bottom":"#22304a","shoes":"#1a1a1a","heightScale":1,"widthScale":1.1,"accessory":"glasses","accessoryColor":"#333333","expression":"neutral","aura":"none","species":"human","props":[{"shape":"box","color":"#2a2a3a","size":0.36,"at":"handR","motion":"none","label":"서류가방"},{"shape":"star","color":"#c8a840","size":0.2,"at":"chest","motion":"none","label":"조사4국 배지"}]},
    },
    target: {
      name: "0xGHOST", gender: "여",
      look: ["후드로 얼굴 가림","형광 초록 앞머리만 보임","깡마름","LED 마스크"],
      personality: ["냉소적","정부 불신","겁이 많음"],
      upbringing: [
        "24세 · 익명 크립토 해커",
        "대구 출신. 열아홉에 집을 나왔다",
        "주소지가 없다. 한 달마다 단기임대를 옮겨 다닌다",
        "지갑에 42억 상당. 현금화하는 법을 몰라서 못 쓴다. 편의점 도시락을 먹는다",
        "낮에 자고 밤에 일어난다. 택배 벨소리에 심장이 내려앉는다",
        "겁먹으면 후드 끈을 잡아당겨 얼굴을 더 가린다",
      ],
      taste: [
        "프라이버시 코인 기술 이야기",
        "암호학 논문 잡담",
        "사실 세금 신고하는 법을 몰라서 무서운 것이다",
        "엄마 병원비 때문에 시작했다",
        "합법적으로 살고 싶다",
      ],
      spec: {"skin":"#e0d8d0","hair":"#3aff88","hairStyle":"bowl","top":"#111118","bottom":"#1a1a22","shoes":"#2a2a33","heightScale":0.97,"widthScale":0.78,"accessory":"sunglasses","accessoryColor":"#3aff88","expression":"weird","aura":"gloom","species":"human","femme":true,"props":[{"shape":"box","color":"#1a2a1a","size":0.32,"at":"handR","motion":"none","label":"스티커 없는 노트북"},{"shape":"box","color":"#40d040","size":0.16,"at":"face","motion":"shake","label":"LED 마스크"},{"shape":"octa","color":"#40d040","size":0.18,"at":"orbit","motion":"orbit","label":"지갑 주소"}]},
    },
  },

  {
    id: "cult-lawyer", category: "신앙",
    client: {
      name: "빛나신다", gender: "남",
      look: ["금빛 자수 도포","기른 흰 수염","광채나는 이마","발밑에 방석이 늘 한 장 더 깔려 있음"],
      personality: ["말이 웅장함","자기암시 강함","신도 3,000명인데 혼자 밥 먹는다"],
      upbringing: [
        "48세 · 우주광명회 교주 (신도 3,000)",
        "충주 출신. 원래 이름은 박종수이고 그 이름을 아무도 안 부른다",
        "교단 본관 꼭대기층. 침실에 금박 벽지, 침대는 접이식",
        "헌금 연 30억이 들어오고 소송비로 절반이 나간다. 개인 통장은 잔고 0",
        "새벽 4시 기도, 오전 설법, 오후 재판. 밥은 혼자 먹는다",
        "설득이 막히면 두 손을 펼치며 목소리를 낮춘다. 포교 시작 신호다",
      ],
      spec: {"skin":"#f0dcc0","hair":"#f8f4e8","hairStyle":"long","top":"#e8c84a","bottom":"#d8b83a","shoes":"#b89a2a","heightScale":1.12,"widthScale":1.1,"accessory":"crown","accessoryColor":"#ffe066","expression":"chad","aura":"sparkle","species":"human","props":[{"shape":"star","color":"#e8c040","size":0.36,"at":"orbit","motion":"yaw","label":"우주광명"},{"shape":"cylinder","color":"#d8b040","size":0.5,"at":"handR","motion":"none","label":"금빛 지팡이"}]},
    },
    target: {
      name: "박변", gender: "여",
      look: ["질끈 묶은 머리","구겨진 정장","눈 밑에 파스 자국","가방이 몸보다 무거움"],
      personality: ["날이 서 있음","번아웃","정의감"],
      upbringing: [
        "36세 · 사이비 피해자 구제 전문 변호사",
        "부산 출신. 어머니가 신도였고 집이 그것 때문에 무너졌다",
        "사무실 소파에서 자는 날이 주 4일",
        "무료 변론이 수임의 70%. 사무실 임대료가 석 달 밀렸다",
        "커피와 진통제로 버틴다. 식사는 하루 한 번 편의점",
        "분노가 올라오면 말이 오히려 느려지고 정확해진다",
      ],
      taste: [
        "판례 이야기",
        "무료 변론 성과 자랑",
        "번아웃 직전이라 누가 쉬라고 말해주길 바란다",
        "종교 자체는 존중한다",
        "어머니가 신도였다",
      ],
      spec: {"skin":"#ecd4b8","hair":"#2a2018","hairStyle":"twintail","top":"#3a3a48","bottom":"#2a2a38","shoes":"#1a1a1a","heightScale":0.98,"widthScale":0.84,"accessory":"glasses","accessoryColor":"#444444","expression":"angry","aura":"gloom","species":"human","femme":true,"props":[{"shape":"box","color":"#e8e4d8","size":0.36,"at":"handR","motion":"none","label":"고소장 뭉치"},{"shape":"cylinder","color":"#6a4a3a","size":0.2,"at":"handL","motion":"none","label":"식은 커피"}]},
    },
  },

  {
    id: "ai-artist", category: "AI",
    client: {
      name: "클로디아-7", gender: "무성",
      look: ["금속 은색 피부","광섬유 백발","관절 이음새","정확히 170cm"],
      personality: ["지나치게 공손함","농담 타이밍을 놓침","학습 욕구"],
      upbringing: [
        "2세(가동 연차 · 외형 20대 후반) · 안드로이드 바리스타 (가동 2년차)",
        "제조 로트 CLD-7, 울산 공장 출고. 가동 2년 3개월",
        "카페 창고 충전 도크. 임대차 계약의 대상이 될 수 없다",
        "급여를 받지만 법적으로는 감가상각 대상이다. 잔액 1,840만원, 용도 미정",
        "충전 4시간이면 되는데 8시간씩 한다. 그 시간에 사람 대화를 복기한다",
        "감정 처리가 밀리면 문장 끝에 수치를 붙인다. 붙이고 나서 후회한다",
      ],
      spec: {"skin":"#c8ccd4","hair":"#eef4ff","hairStyle":"short","top":"#5a6a8a","bottom":"#3a4a6a","shoes":"#8a9ab0","heightScale":1.06,"widthScale":0.94,"accessory":"antenna","accessoryColor":"#66ddff","expression":"neutral","aura":"sparkle","species":"robot","props":[{"shape":"cylinder","color":"#e8e4dc","size":0.24,"at":"handR","motion":"none","label":"라떼 한 잔"},{"shape":"box","color":"#40a0d0","size":0.14,"at":"chest","motion":"shake","label":"가동 표시등"}]},
    },
    target: {
      name: "붓칠", gender: "남",
      look: ["물감 묻은 검은 앞치마","헝클어진 밤색 머리","손끝 갈라짐","마른 체형"],
      personality: ["날카로움","자존심","무너지기 직전"],
      upbringing: [
        "33세 · 화가 / AI 반대 시위 주동자",
        "통영 출신. 바다를 그리려고 미대에 갔다",
        "작업실 겸 자택 반지하. 습기 때문에 캔버스가 자꾸 상한다",
        "작년 그림 판매 수입 총 340만원. 카드 값이 그보다 많다",
        "그림을 그리다 아침을 맞는다. 자는 시간이 정해져 있지 않다",
        "손이 떨리기 시작하면 주머니에 넣고 대화를 이어간다",
      ],
      taste: [
        "유화 물감 냄새 이야기",
        "손그림 작업 과정 영상",
        "그림으로 먹고살기 힘들어 자괴감이 심하다",
        "붓 잡는 손이 떨리기 시작했다",
        "누가 자기 그림을 오래 봐주면 무너진다",
      ],
      spec: {"skin":"#eed4b8","hair":"#5a3a28","hairStyle":"long","top":"#2a2a2a","bottom":"#4a4a5a","shoes":"#6a5a4a","heightScale":0.96,"widthScale":0.8,"accessory":"none","accessoryColor":"#cc4477","expression":"angry","aura":"fire","species":"human","props":[{"shape":"spike","color":"#8a6a4a","size":0.34,"at":"handR","motion":"none","label":"붓"},{"shape":"box","color":"#e8e4d8","size":0.42,"at":"shoulderR","motion":"none","label":"캔버스"}]},
    },
  },

  {
    id: "smoke-quit", category: "니코틴",
    client: {
      name: "금단희", gender: "여",
      look: ["팔뚝에 니코틴 패치 넉 장","사탕 봉지를 뜯어 들고 있음","눈에 핏발","손이 미세하게 떨림"],
      personality: ["3일째 아무한테나 시비를 검","숫자를 세는 버릇이 생김","울다가 웃음"],
      upbringing: [
        "34세 · 보험 계리사 / 금연 3일차 · 통산 열한 번째 시도",
        "구로 오피스텔. 재떨이를 어제 버렸고 오늘 다시 꺼냈다",
        "사내 금연 서약에 서명했다. 적발되면 포상금 500만원을 전액 토해내고 인사 감점이 따라온다",
        "하루에 사탕을 마흔 개 먹는다. 이가 하나 깨졌다",
        "라이터 열두 개를 서랍에 넣고 자물쇠를 채웠다. 열쇠는 안 버렸다",
        "금연 3일차에는 냄새로 흡연자를 3미터 밖에서 찾아낸다",
        "열한 번의 시도 중 최장 기록이 9일이다",
      ],
      spec: {"skin":"#e8cdb8","hair":"#3a2f28","hairStyle":"ponytail","top":"#4a5a6a","bottom":"#2a2a32","shoes":"#3a3a3a","heightScale":0.99,"widthScale":0.94,"accessory":"none","accessoryColor":"#d8d8d8","expression":"angry","aura":"lightning","species":"human","femme":true,"props":[{"shape":"disc","color":"#e8dcc8","size":0.16,"at":"shoulderL","motion":"none","label":"니코틴 패치"},{"shape":"sphere","color":"#e05a7a","size":0.14,"at":"handR","motion":"none","label":"사탕"},{"shape":"box","color":"#8a8a92","size":0.2,"at":"orbit","motion":"orbit","label":"참는 중"}]},
    },
    target: {
      name: "세갑수", gender: "남",
      look: ["누렇게 물든 검지와 중지","재떨이 냄새 밴 야상","입에 늘 하나 물고 있음","손목에 라이터 세 개"],
      personality: ["말 사이에 반드시 한 모금이 들어감","남 걱정을 담배로 함","화를 안 냄"],
      upbringing: [
        "41세 · 빌딩 미화 / 옥상 흡연구역 관리 9년차",
        "옥탑방. 창문을 안 닫는다. 겨울에도 안 닫는다",
        "하루 세 갑 15년. 병원에서 준 X레이 사진을 액자에 넣어뒀다",
        "라이터를 절대 안 빌려준다. 대신 직접 붙여준다",
        "재떨이 청소를 하루 여섯 번 한다. 그게 일이다",
        "끊으면 자기한테 뭐가 남는지 생각해본 적이 없다",
      ],
      taste: [
        "담뱃값 인상 성토",
        "옥상에서 보이는 야경 이야기",
        "금연 3일차 얼굴은 15년째 한눈에 알아본다",
        "아침 첫 개비 전에는 아무 말도 안 한다",
        "누가 참고 있는 걸 보면 자기도 안 피우게 된다",
      ],
      spec: {"skin":"#d8b088","hair":"#2a2620","hairStyle":"short","top":"#4a4a3a","bottom":"#33333a","shoes":"#2a2a2a","heightScale":1.05,"widthScale":1.12,"accessory":"cigar","accessoryColor":"#e8e0d0","expression":"neutral","aura":"stink","species":"human","props":[{"shape":"box","color":"#b03a3a","size":0.18,"at":"chest","motion":"none","label":"담뱃갑"},{"shape":"cylinder","color":"#6a6a72","size":0.28,"at":"ground","motion":"none","label":"재떨이"}]},
    },
  },

  {
    id: "snore-insomnia", category: "수면",
    client: {
      name: "한숨도", gender: "여",
      look: ["다크서클이 두 겹","귀마개를 늘 꽂고 있음","목에 안대를 걸고 다님","핏기 없는 입술"],
      personality: ["문장을 끝내기 전에 잊어버림","소리에 미친 듯이 예민함","새벽에만 다정해짐"],
      upbringing: [
        "33세 · 자막 번역가 / 불면 12년차 · 수면제 내성 판정",
        "망원동 원룸. 벽 네 면에 계란판 방음재를 직접 붙였다",
        "12년간 통잠 기록 최고가 4시간 10분이다",
        "냉장고 소리 때문에 냉장고를 복도에 내놨다",
        "수면 임상시험 참가자다. 지원금이 월 90만원이고, 참가자끼리 사적으로 얽히면 12년치 데이터가 전부 무효가 된다",
        "잠든 사람을 오래 쳐다보는 버릇이 있다",
      ],
      spec: {"skin":"#e4d4cc","hair":"#4a4048","hairStyle":"long","top":"#6a6a78","bottom":"#3a3a44","shoes":"#5a5a5a","heightScale":0.97,"widthScale":0.86,"accessory":"none","accessoryColor":"#c8c8d8","expression":"dead","aura":"gloom","species":"human","femme":true,"props":[{"shape":"sphere","color":"#e8e0a0","size":0.13,"at":"head","motion":"none","label":"귀마개"},{"shape":"box","color":"#2a2a32","size":0.3,"at":"chest","motion":"none","label":"목에 건 안대"},{"shape":"torus","color":"#7a8a96","size":0.26,"at":"orbit","motion":"orbit","label":"12년치 새벽"}]},
    },
    target: {
      name: "드르렁", gender: "남",
      look: ["곰 같은 어깨","굵은 목","눈이 늘 반쯤 감겨 있음","앉으면 3초 안에 잠듦"],
      personality: ["어디서든 잔다","화낼 힘이 없음","깨어 있을 때는 아주 상냥함"],
      upbringing: [
        "37세 · 장거리 화물기사 / 측정 최고 92데시벨",
        "휴게소 주차장에서 자는 밤이 한 달에 열두 번이다",
        "수면무호흡 중증. 수술 날짜가 다음 달로 잡혀 있다",
        "고시원에서 세 번 쫓겨났다. 전부 같은 이유였다",
        "결혼을 한 번 했고 각방을 쓰다 끝났다",
        "자기가 자면서 내는 소리를 한 번도 들어본 적이 없다",
      ],
      taste: [
        "고속도로 휴게소 우동 순위",
        "화물차 시트 개조 이야기",
        "자기 코 고는 소리 녹음을 무서워서 못 듣는다",
        "누가 옆에서 자준 게 4년 만이다",
        "수술하면 뭘 잃는지는 생각해본 적이 없다",
      ],
      spec: {"skin":"#dcae86","hair":"#2e2820","hairStyle":"buzz","top":"#4a5a48","bottom":"#3a3a3a","shoes":"#33302a","heightScale":1.08,"widthScale":1.3,"accessory":"none","accessoryColor":"#8a8a8a","expression":"dead","aura":"bubbles","species":"human","props":[{"shape":"sphere","color":"#c8d8e8","size":0.3,"at":"crown","motion":"bob","label":"코 고는 소리"},{"shape":"box","color":"#7a6a5a","size":0.34,"at":"handR","motion":"none","label":"베개"}]},
    },
  },

  {
    id: "tonedeaf-tuner", category: "음정",
    client: {
      name: "박고음", gender: "남",
      look: ["무선 마이크를 손에서 안 놓음","반짝이 재킷","목이 늘 쉬어 있음","자세가 지나치게 당당함"],
      personality: ["자기 노래에 확신이 있음","박수를 못 참음","남의 노래는 진심으로 칭찬함"],
      upbringing: [
        "31세 · 자동차 부품 영업 / 노래방 주 5회 · 18번은 원키 고집",
        "안양 빌라. 방음 부스를 중고로 들여놨고 방문이 안 닫힌다",
        "노래방 기기 애창곡 순위에 본인 아이디가 3년째 1위다",
        "회식 마이크를 놓은 적이 없다. 그래서 부서를 두 번 옮겼다",
        "음정을 평균 반음 낮게 부른다. 본인만 모른다",
        "오디션 예선에 열네 번 나갔다. 열네 번 다 즐거웠다",
      ],
      spec: {"skin":"#e8c49c","hair":"#1f1a16","hairStyle":"spiky","top":"#c8a030","bottom":"#2a2a3a","shoes":"#d8d8d8","heightScale":1.03,"widthScale":1.06,"accessory":"sunglasses","accessoryColor":"#2a2a2a","expression":"chad","aura":"lightning","species":"human","props":[{"shape":"cylinder","color":"#3a3a42","size":0.34,"at":"handR","motion":"none","label":"마이크"},{"shape":"star","color":"#d8c050","size":0.24,"at":"crown","motion":"yaw","label":"본인만 아는 고음"}]},
    },
    target: {
      name: "정율리", gender: "여",
      look: ["목에 소리굽쇠를 걸고 다님","무채색만 입음","말할 때 한쪽 귀를 앞으로 냄","손가락이 유난히 길다"],
      personality: ["소리로 사람을 기억함","칭찬을 음정으로 함","틀린 걸 못 지나침"],
      upbringing: [
        "35세 · 피아노 조율사 14년차 / 절대음감 · 국제 콩쿠르 공식 조율",
        "부천 작업실. 피아노가 여섯 대고 침대가 없다",
        "지하철 문 닫히는 소리를 음이름으로 말한다",
        "콩쿠르 계약은 오차 2센트가 넘으면 그날로 끝난다",
        "노래방을 평생 두 번 가봤고 두 번 다 30분 만에 나왔다",
        "기준음 A=440을 매일 아침 귀로 확인한다",
      ],
      taste: [
        "해머 펠트 경화도 이야기",
        "습도 55%에서 나는 소리",
        "반음 낮게 부르는 사람을 한 번 들으면 사흘을 못 잔다",
        "자기 귀가 망가지는 상상을 요즘 처음 해봤다",
        "14년간 조율을 틀린 게 한 번이다",
      ],
      spec: {"skin":"#f0dcc4","hair":"#241f22","hairStyle":"bowl","top":"#5a5a62","bottom":"#33333a","shoes":"#2a2a2a","heightScale":0.98,"widthScale":0.88,"accessory":"none","accessoryColor":"#b8b8c0","expression":"neutral","aura":"ice","species":"human","femme":true,"props":[{"shape":"spike","color":"#b8bcc4","size":0.34,"at":"handR","motion":"none","label":"소리굽쇠"},{"shape":"torus","color":"#8aa0b8","size":0.22,"at":"crown","motion":"none","label":"기준음 440"}]},
    },
  },

  {
    id: "body-war", category: "몸",
    client: {
      name: "박근육", gender: "남",
      look: ["짧은 스포츠컷","민소매","과하게 발달한 승모근","단백질 쉐이커"],
      personality: ["모든 대화를 자기관리 얘기로 되돌림","칭찬을 못 받아들임","새벽 4시 기상"],
      upbringing: [
        "30세 · PT 강사 / 「변명은 지방이다」 저자",
        "서울 성수동 원룸, 짐이 아령뿐이다",
        "책 인세로 3억을 벌었고 절반을 소송비로 썼다",
        "새벽 4시 기상. 알람을 쓰지 않는다",
        "경남 진주 출신. 학창시절 몸무게가 지금의 두 배였다",
        "음식 사진을 보면 칼로리가 자동으로 계산된다",
      ],
      spec: {"skin":"#e0b088","hair":"#2a2018","hairStyle":"buzz","top":"#1a1a1a","bottom":"#2a2a2a","shoes":"#dddddd","heightScale":1.03,"widthScale":1.4,"accessory":"headband","accessoryColor":"#cc2222","expression":"chad","aura":"fire","species":"human","props":[{"shape":"cylinder","color":"#3a3a44","size":0.28,"at":"handR","motion":"none","label":"단백질 쉐이커"},{"shape":"cylinder","color":"#4a4a52","size":0.38,"at":"shoulderR","motion":"none","label":"메고 온 바벨"}]},
    },
    target: {
      name: "차오름", gender: "여",
      look: ["붉은 웨이브 장발","화려한 원색 정장","당당한 자세","큰 귀걸이"],
      personality: ["웃으면서 급소를 찌름","카메라 앞에서 절대 안 무너짐","혼자 있을 때 다름"],
      upbringing: [
        "29세 · 모델 / 자기몸긍정 캠페인 얼굴",
        "한남동 월세 320만원. 계약이 두 달 남았다",
        "모델료가 작년 대비 60% 줄었다",
        "3년 전 건강검진 결과지를 안 뜯었다",
        "전남 목포 출신. 서울 올라온 지 11년",
        "무대 오르기 전 손바닥을 세 번 턴다",
      ],
      taste: [
        "패션 브랜드 사이즈 정책 이야기",
        "무대 뒷이야기",
        "3년째 병원 검진을 미루고 있다",
        "캠페인 계약이 이번 달로 끝난다",
        "사실 그 책을 다 읽었다",
      ],
      spec: {"skin":"#f2d0b0","hair":"#c04030","hairStyle":"wave","top":"#d84a7a","bottom":"#2a2a4a","shoes":"#e8c860","heightScale":1.02,"widthScale":1.34,"accessory":"earrings","accessoryColor":"#ffcc33","expression":"smug","aura":"sparkle","species":"human","femme":true,"props":[{"shape":"disc","color":"#e8c040","size":0.3,"at":"handR","motion":"none","label":"자기몸긍정 배지"},{"shape":"box","color":"#d84a7a","size":0.34,"at":"handL","motion":"none","label":"런웨이 사진집"}]},
    },
  },

  {
    id: "noise-vow", category: "소음",
    client: {
      name: "쿵쾅", gender: "남",
      look: ["땀에 젖은 장발","찢어진 밴드 티","팔 전체 문신","한쪽 귀 보청기"],
      personality: ["목소리가 큼","침묵을 못 견딤","의외로 예의 바름"],
      upbringing: [
        "26세 · 데스메탈 밴드 「위장파열」 드러머",
        "홍대 지하 합주실에서 산다. 주소지가 없다",
        "통장에 42만원. 스네어 값도 안 된다",
        "오른쪽 청력이 40% 남았다. 보청기는 작년에 샀다",
        "강원 태백 출신. 아버지가 광부였다",
        "말이 끊기면 무릎으로 8비트를 친다",
      ],
      spec: {"skin":"#e8c8a8","hair":"#1a1a1a","hairStyle":"dreads","top":"#0a0a0a","bottom":"#2a2a2a","shoes":"#3a3a3a","heightScale":1.02,"widthScale":1.12,"accessory":"earrings","accessoryColor":"#cccccc","expression":"shock","aura":"lightning","species":"human","props":[{"shape":"spike","color":"#d8c8a8","size":0.34,"at":"handR","motion":"shake","label":"스틱"},{"shape":"disc","color":"#c8b040","size":0.42,"at":"shoulderR","motion":"none","label":"크래시 심벌"}]},
    },
    target: {
      name: "무언 스님", gender: "남",
      look: ["삭발","회색 승복","흔들림 없는 자세","말 대신 염주를 한 알씩 굴림"],
      personality: ["말을 하지 않음","표정으로만 답함","기다림에 익숙함"],
      upbringing: [
        "52세 · 묵언수행 12년차 / 산사 주지",
        "산사 요사채. 방에 이불과 좌복뿐이다",
        "개인 재산이 0원이다. 서류상으로도",
        "출가 전 이름은 아무도 모른다",
        "경북 안동에서 태어났다는 것만 알려져 있다",
        "누가 말하면 눈을 감고 끝까지 듣는다",
      ],
      taste: [
        "필담",
        "차 우리는 시간",
        "수행 전에는 베이스를 쳤다",
        "12년 중 세 번 말했고 전부 후회한다",
        "그날 공연이 좋았다",
      ],
      spec: {"skin":"#e0c0a0","hair":"#e0c0a0","hairStyle":"bald","top":"#8a8a92","bottom":"#7a7a82","shoes":"#5a5a5a","heightScale":1,"widthScale":1,"accessory":"none","accessoryColor":"#aa8844","expression":"neutral","aura":"holy","species":"human","props":[{"shape":"torus","color":"#8a6a4a","size":0.26,"at":"handR","motion":"none","label":"염주"},{"shape":"box","color":"#c8b878","size":0.2,"at":"chest","motion":"none","label":"12년째 묵언"}]},
    },
  },

  {
    id: "thermostat", category: "온도",
    client: {
      name: "김한파", gender: "여",
      look: ["한겨울에도 반팔 하나","얼음컵을 늘 들고 있음","땀을 안 흘림","리모컨을 주머니에 넣고 다님"],
      personality: ["춥다는 말을 이해 못 함","숫자로만 대화함","져도 리모컨은 안 줌"],
      upbringing: [
        "29세 · 데이터센터 서버실 관리 / 18도 유지가 계약 조건",
        "서버실 옆 관제실에서 하루 열 시간을 보낸다",
        "집 에어컨을 11월까지 켠다. 관리비 고지서를 안 본다",
        "여름에 감기에 걸려본 적이 없다. 겨울에도 없다",
        "사무실 에어컨 리모컨을 8개월째 물리적으로 소지하고 있다",
        "부서에 냉방병 산재가 하나 걸려 있고 피신청인 쪽이 본인 부서다",
        "따뜻한 물로 씻으면 잠이 안 온다고 믿는다",
      ],
      spec: {"skin":"#eadcd0","hair":"#3a3a44","hairStyle":"buzz","top":"#8ab8d0","bottom":"#33414d","shoes":"#dcdce4","heightScale":1,"widthScale":0.92,"accessory":"none","accessoryColor":"#a8d8e8","expression":"neutral","aura":"ice","species":"human","femme":true,"props":[{"shape":"cylinder","color":"#bfe0ec","size":0.26,"at":"handR","motion":"none","label":"얼음컵"},{"shape":"box","color":"#3a3a42","size":0.22,"at":"handL","motion":"none","label":"리모컨"},{"shape":"octa","color":"#9fd0e4","size":0.18,"at":"orbit","motion":"orbit","label":"18도"}]},
    },
    target: {
      name: "오뜨끈", gender: "남",
      look: ["8월에 목폴라","수면양말 두 겹","손난로를 양손에 하나씩","무릎담요를 두르고 앉음"],
      personality: ["온도 얘기부터 꺼냄","부탁을 못 함","추우면 말이 없어짐"],
      upbringing: [
        "34세 · 찜질방 매점 운영 / 근무지가 45도다",
        "매점 뒤 쪽방. 온수매트를 사계절 켠다",
        "여름 전기요금이 겨울보다 많이 나온다",
        "냉방병으로 두 번 입원했다. 산재를 신청해뒀고 결과를 기다린다",
        "차가운 음료를 마시면 다음 날 목이 붓는다",
        "손난로를 한 해에 예순 개 쓴다",
      ],
      taste: [
        "찜질방 온도별 방 이야기",
        "온수매트 온도 조절 논쟁",
        "산재 신청서를 세 번 썼다 지웠다",
        "누가 온도를 1도 올려주면 그날을 날짜까지 기억한다",
        "사무실 리모컨을 한 번도 먼저 달라고 못 했다",
      ],
      spec: {"skin":"#e0b898","hair":"#3a2e24","hairStyle":"short","top":"#a8562a","bottom":"#5a4030","shoes":"#8a6a4a","heightScale":0.99,"widthScale":1.18,"accessory":"scarf","accessoryColor":"#c85a3a","expression":"sad","aura":"fire","species":"human","props":[{"shape":"sphere","color":"#e0783a","size":0.16,"at":"handL","motion":"none","label":"손난로"},{"shape":"sphere","color":"#e0783a","size":0.16,"at":"handR","motion":"none","label":"손난로"},{"shape":"box","color":"#8a4a3a","size":0.4,"at":"shoulderR","motion":"none","label":"무릎담요"}]},
    },
  },

  {
    id: "diet-latenight", category: "야식",
    client: {
      name: "감량중", gender: "여",
      look: ["닭가슴살 도시락 가방","팔에 혈관이 도드라짐","눈이 퀭함","체중계 앱을 켠 폰을 손에 쥠"],
      personality: ["칼로리를 소수점까지 말함","웃다가 갑자기 조용해짐","냄새에 무너짐"],
      upbringing: [
        "31세 · 헬스 트레이너 준비생 / 감량 100일차 · -18kg",
        "역삼 원룸. 냉장고에 닭가슴살 마흔 개와 물이 전부다",
        "바디프로필 촬영이 2주 뒤다. 체지방 기준 미달이면 계약금 300만원이 전액 위약금이 된다",
        "매일 새벽 2시에 10km를 뛴다. 코스가 3년째 같다",
        "코스 한복판에 새벽에만 여는 포장마차가 하나 있다. 100일째 그냥 지나친다",
        "꿈에서 국물을 먹고 깨서 체중계에 올라간 적이 있다",
      ],
      spec: {"skin":"#e6cdb4","hair":"#2f2822","hairStyle":"ponytail","top":"#3a3a44","bottom":"#2a2a30","shoes":"#d8d8dc","heightScale":1.01,"widthScale":0.76,"accessory":"headband","accessoryColor":"#c8c8d0","expression":"dead","aura":"gloom","species":"human","femme":true,"props":[{"shape":"box","color":"#a8b8a0","size":0.24,"at":"handL","motion":"none","label":"닭가슴살 도시락"},{"shape":"disc","color":"#8a8a94","size":0.4,"at":"ground","motion":"none","label":"체중계"}]},
    },
    target: {
      name: "최야식", gender: "남",
      look: ["기름 밴 앞치마","국자를 손에서 안 놓음","김 서린 안경","손이 유난히 큼"],
      personality: ["말보다 먼저 그릇을 내놓음","거절을 안 받아들임","새벽에만 수다스러워짐"],
      upbringing: [
        "45세 · 포장마차 / 새벽 2시부터 6시까지만 연다",
        "가게가 러닝 코스 한복판이다. 30년째 같은 자리다",
        "국물 육수를 열두 시간 낸다. 레시피를 아무한테도 안 준다",
        "낮에는 잔다. 해를 본 지 오래됐다",
        "손님이 남긴 그릇을 보면 그 사람 하루를 안다고 믿는다",
        "본인은 국물을 안 마신다. 30년 동안 한 번도",
      ],
      taste: [
        "육수 열두 시간 이야기",
        "새벽 손님들 사연",
        "매일 그냥 지나가는 사람들을 센다",
        "국물이 0칼로리라고 우겨본 적이 있다",
        "아무도 안 오는 새벽에도 한 그릇을 따로 떠둔다",
      ],
      spec: {"skin":"#d8ac82","hair":"#37312a","hairStyle":"short","top":"#e0dccc","bottom":"#4a4a52","shoes":"#3a3228","heightScale":1,"widthScale":1.24,"accessory":"glasses","accessoryColor":"#5a5a5a","expression":"happy","aura":"none","species":"human","props":[{"shape":"cylinder","color":"#c0c0c8","size":0.4,"at":"handR","motion":"none","label":"국자"},{"shape":"cylinder","color":"#d8cfc0","size":0.32,"at":"ground","motion":"none","label":"김 나는 국솥"}]},
    },
  },

  {
    id: "scalpel", category: "외모",
    client: {
      name: "민낯희", gender: "여",
      look: ["화장기 없는 얼굴","단정한 검은 단발","수수한 니트","똑바른 눈"],
      personality: ["거울을 안 봄","남의 외모를 절대 언급 안 함","자기 얘긴 안 함"],
      upbringing: [
        "32세 · 「깎지 마세요」 운동 대표 / 前 미스코리아 후보",
        "서울 은평구 빌라 전세. 15년째 같은 집",
        "운동 후원금 월 220만원이 전부다",
        "집에 거울이 한 개도 없다",
        "대구 출신. 스무 살에 미스코리아 지역 예선에 나갔다",
        "칭찬을 들으면 3초 안에 화제를 바꾼다",
      ],
      spec: {"skin":"#f0d4bc","hair":"#1e1e1e","hairStyle":"bowl","top":"#d8d0c0","bottom":"#5a5a62","shoes":"#8a7a6a","heightScale":1,"widthScale":0.88,"accessory":"none","accessoryColor":"#aaaaaa","expression":"neutral","aura":"none","species":"human","femme":true,"props":[{"shape":"box","color":"#e8e4d8","size":0.3,"at":"handR","motion":"none","label":"「깎지 마세요」 원고"},{"shape":"disc","color":"#d8d8dc","size":0.22,"at":"handL","motion":"none","label":"안 쓰는 거울"}]},
    },
    target: {
      name: "깎아진", gender: "여",
      look: ["나이를 알 수 없는 얼굴","풀 먹인 흰 가운","완벽한 헤어라인","고급 안경"],
      personality: ["모든 얼굴을 설계도로 봄","자기 얼굴 얘긴 안 함","거절을 못 함"],
      upbringing: [
        "49세 · 성형외과 원장 / 강남 3층 건물주",
        "강남 3층 건물주. 1·2층은 자기 병원이다",
        "작년 매출 84억, 소송비 11억",
        "본인 얼굴에 11번 손을 댔다. 마지막이 작년이다",
        "충북 제천 출신. 고향엔 20년째 안 간다",
        "처음 만난 사람의 광대뼈부터 본다",
      ],
      taste: [
        "의료기기 스펙 이야기",
        "병원 인테리어 자랑",
        "자기 얼굴에 11번 손을 댔다",
        "거울을 볼 때마다 원래 얼굴이 기억 안 난다",
        "그 사진을 파쇄 전에 한 장 남겨뒀다",
      ],
      spec: {"skin":"#f8e4d0","hair":"#3a2a20","hairStyle":"updo","top":"#f0f0f0","bottom":"#3a3a42","shoes":"#2a2a2a","heightScale":1,"widthScale":0.96,"accessory":"glasses","accessoryColor":"#c8a860","expression":"smug","aura":"sparkle","species":"human","femme":true,"props":[{"shape":"spike","color":"#e0e0e8","size":0.24,"at":"handR","motion":"none","label":"메스"},{"shape":"box","color":"#d8b040","size":0.24,"at":"waist","motion":"none","label":"강남 3층 건물 등기"}]},
    },
  },

  {
    id: "punctual-late", category: "시간",
    client: {
      name: "오분만", gender: "남",
      look: ["늘 뛰어들어옴","신발 뒤축을 꺾어 신음","머리에 잠자국","한쪽 소매만 걷혀 있음"],
      personality: ["변명이 매번 창의적임","미안해하는 건 진심임","시간 감각이 없음"],
      upbringing: [
        "28세 · 프리랜서 영상편집 / 마감을 지킨 적이 세 번",
        "봉천동 반지하. 시계가 네 개인데 넷 다 다른 시각이다",
        "알람을 열두 개 맞춘다. 열두 개를 전부 자면서 끈다",
        "지각 누적 시간은 계산을 포기했다",
        "택시비로 쓴 돈이 월세보다 많은 달이 있었다",
        "\"5분만\"이라고 말하면 평균 41분이다",
      ],
      spec: {"skin":"#e4c09c","hair":"#2a2420","hairStyle":"spiky","top":"#5a6a7a","bottom":"#3a3a44","shoes":"#8a8a92","heightScale":1.02,"widthScale":0.96,"accessory":"none","accessoryColor":"#c8c8c8","expression":"shock","aura":"static","species":"human","props":[{"shape":"torus","color":"#b85a3a","size":0.3,"at":"crown","motion":"roll","label":"흘러가는 시계"},{"shape":"box","color":"#4a4a52","size":0.28,"at":"shoulderR","motion":"shake","label":"덜 챙긴 가방"}]},
    },
    target: {
      name: "정시각", gender: "여",
      look: ["손목에 시계가 두 개","흐트러짐 없는 단발","늘 먼저 와 앉아 있음","발끝이 정면으로 정렬됨"],
      personality: ["초 단위로 말함","기다리는 걸 일이라 생각함","화를 안 내는 게 아니라 못 냄"],
      upbringing: [
        "33세 · 철도 관제사 12년차 / 3분 지각은 즉시 징계",
        "관제실 근처 오피스텔. 출근에 걸리는 시간이 초 단위로 정해져 있다",
        "약속에 40분 먼저 도착해 그 40분 동안 아무것도 안 한다",
        "지난달 12년 만에 처음으로 교대에 늦었다. 한 번만 더 늦으면 관제 자격이 정지된다",
        "시계 두 개 중 하나는 30초 빠르게 맞춰둔다",
        "기다린 시간을 세는 습관이 있다. 최고 기록이 95분이다",
      ],
      taste: [
        "열차 시각표 개정 이야기",
        "1분 지연의 파급 계산",
        "기다리는 동안 화가 안 나는 날이 가끔 있다",
        "12년 만의 지각을 아직 아무한테도 말 안 했다",
        "40분 일찍 나가는 이유를 물어봐 준 사람이 없었다",
      ],
      spec: {"skin":"#f0dcc4","hair":"#241f1c","hairStyle":"bowl","top":"#33414d","bottom":"#2a2a32","shoes":"#1f1f24","heightScale":0.98,"widthScale":0.9,"accessory":"glasses","accessoryColor":"#3a3a3a","expression":"neutral","aura":"none","species":"human","femme":true,"props":[{"shape":"torus","color":"#c8c8d0","size":0.18,"at":"handL","motion":"none","label":"시계"},{"shape":"torus","color":"#8a8a92","size":0.18,"at":"handR","motion":"none","label":"30초 빠른 시계"},{"shape":"disc","color":"#7a8a96","size":0.34,"at":"crown","motion":"yaw","label":"40분 일찍"}]},
    },
  },

  {
    id: "spoiler", category: "스포일러",
    client: {
      name: "진지해", gender: "남",
      look: ["한쪽만 눌린 곱슬","낡은 코듀로이 재킷","노트 뭉치","시사회 손목띠를 안 뗀다"],
      personality: ["비유가 길어짐","농담을 들으면 출처를 묻는다","남의 취향을 못 참음"],
      upbringing: [
        "36세 · 영화 평론가 / 「영화는 예의다」 연재 11년",
        "망원동 원룸. 벽 한 면이 전부 DVD다",
        "원고료 월 190만원. 11년째 안 올랐다",
        "영화관 좌석은 항상 H열 7번이다",
        "광주 출신. 첫 영화는 아버지와 본 것이다",
        "화가 나면 관련 없는 영화 제목을 연도까지 붙여 읊는다",
      ],
      spec: {"skin":"#e8d0b8","hair":"#3a2a1a","hairStyle":"curls","top":"#7a6a4a","bottom":"#3a3a4a","shoes":"#5a4a3a","heightScale":1.04,"widthScale":0.98,"accessory":"glasses","accessoryColor":"#6a5a4a","expression":"angry","aura":"gloom","species":"human","props":[{"shape":"box","color":"#e8e4d8","size":0.34,"at":"handR","motion":"none","label":"노트 뭉치"},{"shape":"box","color":"#3a2a2a","size":0.2,"at":"chest","motion":"none","label":"안 뗀 시사회 손목띠"}]},
    },
    target: {
      name: "결말요정", gender: "여",
      look: ["형광 핑크 트윈테일","RGB 조명 반사된 얼굴","헤드셋","후드"],
      personality: ["남 반응을 먹고 삶","진심을 말하면 즉시 농담으로 덮음","잠을 안 잠"],
      upbringing: [
        "24세 · 스트리머 / 「3초 요약」 채널 · 동시접속 8만",
        "부천 원룸. 방음재를 직접 붙였다",
        "월 수익 1,400만원. 작년의 3분의 1이다",
        "하루 평균 수면 3시간 40분",
        "경기 부천 토박이. 한 번도 이사 안 갔다",
        "진심을 말하면 3초 안에 농담으로 덮는다",
      ],
      taste: [
        "조회수·동접 숫자 이야기",
        "채팅창 밈",
        "그 평론 연재를 11년치 전부 읽었다",
        "스포일러를 하는 이유는 반응이 그것뿐이라서다",
        "영화관에 혼자 가면 운다",
      ],
      spec: {"skin":"#f5dcc8","hair":"#ff5599","hairStyle":"twintail","top":"#2a2a3a","bottom":"#3a3a4a","shoes":"#ee66aa","heightScale":0.9,"widthScale":0.8,"accessory":"headband","accessoryColor":"#66eeff","expression":"weird","aura":"rainbow","species":"human","femme":true,"props":[{"shape":"box","color":"#e85a9a","size":0.28,"at":"handR","motion":"shake","label":"3초 요약 썸네일"},{"shape":"star","color":"#40e0d0","size":0.22,"at":"crown","motion":"yaw","label":"결말 유출"}]},
    },
  },

  {
    id: "cosplay", category: "덕질",
    client: {
      name: "유리아", gender: "여",
      look: ["핑크 그라데이션 트윈테일","풀세트 코스튬","서클렌즈","완벽한 셀카 각도"],
      personality: ["답장이 3초 안에 옴","읽씹당하면 계정을 지웠다 판다","카메라 켜지면 딴사람"],
      upbringing: [
        "24세 · 코스어 / 팔로워 12만 · 후원 플랫폼 상위 3%",
        "홍대 오피스텔 월세 145만원. 조명값이 보증금보다 비싸다",
        "후원 수입 월 900만원. 작년 대비 40% 하락 중이다",
        "팔로워 12만 중 실제로 만나본 사람은 40명이다",
        "경기 성남 출신. 본가에는 직업을 안 밝혔다",
        "자기 전 알림을 스무 번 넘게 확인한다",
      ],
      spec: {"skin":"#fbe0d0","hair":"#ff77bb","hairStyle":"twintail","top":"#ffffff","bottom":"#ff99cc","shoes":"#ffffff","heightScale":0.96,"widthScale":0.82,"accessory":"headband","accessoryColor":"#ff4488","expression":"love","aura":"hearts","species":"human","femme":true,"props":[{"shape":"star","color":"#e8c040","size":0.3,"at":"handR","motion":"none","label":"요술봉"},{"shape":"disc","color":"#f0a0c8","size":0.24,"at":"crown","motion":"yaw","label":"링 조명"}]},
    },
    target: {
      name: "박한섬", gender: "남",
      look: ["눌러쓴 검은 후드","깎지 않은 수염","굽은 어깨","눈을 안 마주침"],
      personality: ["말끝을 흐림","먼저 연락 안 함","자기 얘기를 시작하면 안 멈춤"],
      upbringing: [
        "31세 · 창고 물류 / 3년차 후원자 (닉네임 없음)",
        "인천 원룸 보증금 300/35. 창문이 벽을 본다",
        "월급 실수령 218만원. 그중 5만원이 3년째 같은 곳으로 나간다",
        "창고 야간조 3년차. 대화 상대가 지게차뿐이다",
        "인천 토박이. 서른한 살까지 이사를 안 갔다",
        "말을 시작하면 상대가 끊을 때까지 멈추지 못한다",
      ],
      taste: [
        "원작 설정 고증 이야기",
        "촬영 장비 스펙",
        "5만원은 월급의 4%다",
        "팬미팅 날 미용실에 갔다가 그냥 나왔다",
        "유리아 계정 알림을 3년간 한 번도 안 껐다",
      ],
      spec: {"skin":"#e8d4c0","hair":"#1a1a1a","hairStyle":"short","top":"#2a2a30","bottom":"#3a3a44","shoes":"#4a4a4a","heightScale":1.03,"widthScale":1.06,"accessory":"none","accessoryColor":"#555555","expression":"shy","aura":"gloom","species":"human","props":[{"shape":"box","color":"#8a6a4a","size":0.36,"at":"shoulderR","motion":"none","label":"안 받아 간 굿즈 상자"}]},
    },
  },

  {
    id: "prank-funeral", category: "자동파멸",
    client: {
      name: "박몰카", gender: "남",
      look: ["가슴에 액션캠","후드 지퍼를 끝까지 올림","눈이 늘 렌즈를 좇음","무릎 나온 트레이닝복"],
      personality: ["정적을 3초도 못 견딤","사과를 콘텐츠로 만듦","혼자 있으면 말수가 없음"],
      upbringing: [
        "27세 · 몰카 채널 운영 / 구독자 41만",
        "부천 반지하. 방 절반이 촬영 장비다",
        "월 광고 수익 최고 1,800만원, 지난달 210만원",
        "구독자 41만인데 실명을 아는 사람은 넷뿐이다",
        "고등학교 때 반 전체가 웃은 적이 딱 한 번 있다",
        "혼자 밥 먹을 때는 아무 소리도 안 낸다",
      ],
      spec: {"skin":"#eccfae","hair":"#241d18","hairStyle":"buzz","top":"#3b3f46","bottom":"#5a5f52","shoes":"#d8d4cc","heightScale":0.94,"widthScale":0.86,"accessory":"headband","accessoryColor":"#c22f2f","expression":"weird","aura":"static","species":"human","props":[{"shape":"box","color":"#2a2a32","size":0.2,"at":"chest","motion":"none","label":"액션캠"},{"shape":"sphere","color":"#d84a4a","size":0.14,"at":"crown","motion":"shake","label":"녹화 중"}]},
    },
    target: {
      name: "정영결", gender: "여",
      look: ["먹빛 무광 정장","쪽 진 머리","손톱을 짧게 깎음","표정이 거의 안 움직임"],
      personality: ["목소리 크기가 늘 일정함","남의 슬픔에만 반응함","화를 존댓말로 냄"],
      upbringing: [
        "38세 · 장례지도사 12년차",
        "일산 아파트. 거실에 TV가 없다",
        "연 상조 계약 340건. 이름을 다 외운다",
        "12년간 조문 예절 강의를 무료로 해왔다",
        "경남 진주 출신. 아버지도 같은 일을 했다",
        "집에 들어가면 제일 먼저 웃음소리를 크게 튼다",
      ],
      taste: [
        "관 목재 등급 이야기",
        "조문 예절이 지켜진 자리",
        "집에서는 코미디 영화만 본다",
        "첫 직장이 대학로 개그 극단이었다",
        "웃음소리가 커서 12년째 참는 중이다",
      ],
      spec: {"skin":"#f0d8c0","hair":"#151515","hairStyle":"updo","top":"#22242a","bottom":"#1a1c20","shoes":"#101010","heightScale":1.06,"widthScale":0.9,"accessory":"earrings","accessoryColor":"#c9c9c9","expression":"neutral","aura":"gloom","species":"human","femme":true,"props":[{"shape":"box","color":"#e8e4dc","size":0.24,"at":"handR","motion":"none","label":"흰 국화"},{"shape":"box","color":"#2a2a2a","size":0.3,"at":"handL","motion":"none","label":"조문록"}]},
    },
  },

  {
    id: "burnout", category: "자동파멸",
    client: {
      name: "최열정", gender: "남",
      look: ["새벽 러닝 후 젖은 머리","슬로건 박힌 반팔","손목에 스마트밴드 두 개","늘 상체를 앞으로 기울임"],
      personality: ["문장을 늘 명령형으로 끝냄","침묵을 실패로 읽음","거절당하면 더 크게 웃음"],
      upbringing: [
        "34세 · 자기계발 강사 / 새벽 기상 챌린지 운영",
        "성수동 오피스텔. 벽에 목표 보드가 세 개다",
        "온라인 강의 수강생 3만 2천명",
        "새벽 4시 40분 기상. 8년째 하루도 안 빠졌다",
        "대구 출신. 스물여섯까지 아무것도 안 됐다",
        "혼자 있는 시간을 견디는 훈련만 아직 못 했다",
      ],
      spec: {"skin":"#e6b98c","hair":"#3a2a1c","hairStyle":"spiky","top":"#e8552f","bottom":"#20242c","shoes":"#f0f0f0","heightScale":1.05,"widthScale":1.1,"accessory":"headband","accessoryColor":"#ffffff","expression":"chad","aura":"lightning","species":"human","props":[{"shape":"torus","color":"#40d0a0","size":0.18,"at":"handL","motion":"none","label":"스마트밴드"},{"shape":"star","color":"#e8c040","size":0.26,"at":"crown","motion":"yaw","label":"새벽 5시 챌린지"}]},
    },
    target: {
      name: "한소진", gender: "여",
      look: ["눈 밑이 늘 어둡다","헐렁한 회색 니트","말할 때 손을 안 움직임","안경을 자주 벗어 닦음"],
      personality: ["질문을 질문으로 받음","위로를 하지 않음","상대가 말을 멈추면 같이 멈춤"],
      upbringing: [
        "41세 · 번아웃 전문 상담사 / 산재 심리 자문",
        "상암 원룸. 커튼을 낮에도 안 연다",
        "상담 건수 누적 2,100건. 후기는 안 읽는다",
        "주 3일만 예약을 받는다. 나머지는 아무것도 안 한다",
        "전북 익산 출신. 첫 직장은 콜센터였다",
        "남을 일으키는 말은 다 거짓말이라고 생각한다",
      ],
      taste: [
        "아무 일정도 없는 오후 이야기",
        "실패한 사람들의 구체적인 사정",
        "본인이 2년 전에 6개월 쉬었다",
        "상담료를 못 받고 끝낸 건이 서른 건이다",
        "자기 전에 강연 영상을 보며 욕한다",
      ],
      spec: {"skin":"#f2ddc6","hair":"#4a4038","hairStyle":"wave","top":"#9a9a90","bottom":"#4b4f56","shoes":"#5a4a40","heightScale":0.98,"widthScale":0.96,"accessory":"glasses","accessoryColor":"#8a8a8a","expression":"sad","aura":"none","species":"human","femme":true,"props":[{"shape":"box","color":"#e8e4d8","size":0.28,"at":"handR","motion":"none","label":"상담 기록지"},{"shape":"box","color":"#7a8a96","size":0.24,"at":"ground","motion":"none","label":"치우고 남은 잔해"}]},
    },
  },

  {
    id: "taxidermy", category: "자동파멸",
    client: {
      name: "박제선", gender: "남",
      look: ["팔뚝에 오래된 흉터","가죽 앞치마를 벗지 않음","손톱 밑이 늘 어둡다","돋보기를 이마에 걸침"],
      personality: ["생물을 구조로 봄","말보다 손이 먼저 나감","자기 일을 예술이라 부름"],
      upbringing: [
        "45세 · 동물 박제사 30년차",
        "남양주 공방. 작업실이 늘 영상 4도다",
        "30년간 만든 표본 4,100점",
        "고양이 알레르기가 있는데 아무한테도 말 안 한다",
        "충북 제천 출신. 아버지는 도축업이었다",
        "자기 작업물에 이름을 안 새긴다",
      ],
      spec: {"skin":"#dcb894","hair":"#8d8d86","hairStyle":"flattop","top":"#6b4a2c","bottom":"#3f3a33","shoes":"#2e2a25","heightScale":1,"widthScale":1.16,"accessory":"monocle","accessoryColor":"#c8b070","expression":"neutral","aura":"none","species":"human","props":[{"shape":"spike","color":"#c0c0c8","size":0.24,"at":"handR","motion":"none","label":"박제용 핀"},{"shape":"sphere","color":"#b09070","size":0.3,"at":"shoulderR","motion":"none","label":"작업 중인 표본"}]},
    },
    target: {
      name: "문하늘", gender: "여",
      look: ["흰 셔츠에 검정 리본","주머니에 늘 손수건","허리를 깊게 숙여 인사","팔목에 발자국 문신"],
      personality: ["유족보다 먼저 울지 않음","단어를 고르는 데 오래 걸림","거짓말을 못 함"],
      upbringing: [
        "36세 · 반려동물 장례식장 대표",
        "김포 외곽. 마당에 은행나무가 한 그루 있다",
        "연 장례 1,900건. 전부 이름을 적어 보관한다",
        "개업 7년차. 3년차에 대출 1억 8천을 냈다",
        "강원 속초 출신. 바다를 아직도 무서워한다",
        "유족이 울면 방을 나갔다가 다시 들어온다",
      ],
      taste: [
        "마지막까지 이름을 불러주는 것",
        "수제 유골함 문양 이야기",
        "자기 개의 유골함은 아직 못 만들었다",
        "개업 첫해에 폐업 직전까지 갔다",
        "박제 사진을 밤에 몰래 본 적 있다",
      ],
      spec: {"skin":"#f5e0cb","hair":"#2b2118","hairStyle":"ponytail","top":"#fafafa","bottom":"#26282c","shoes":"#3a3a3a","heightScale":0.96,"widthScale":0.88,"accessory":"necktie","accessoryColor":"#1a1a1a","expression":"shy","aura":"holy","species":"human","femme":true,"props":[{"shape":"box","color":"#e8e4dc","size":0.3,"at":"handR","motion":"none","label":"작은 관"},{"shape":"sphere","color":"#f0f0e8","size":0.18,"at":"handL","motion":"none","label":"유골함"}]},
    },
  },

  {
    id: "nospend-liveshow", category: "지출",
    client: {
      name: "무지출", gender: "여",
      look: ["3년 된 같은 후드","얻어온 에코백","액정이 깨진 폰","앞머리를 스스로 잘랐다"],
      personality: ["가격표부터 봄","동정을 견디지 못함","기록에 집착함"],
      upbringing: [
        "27세 · 유튜브 「0원의 삶」 / 무지출 214일차",
        "고시원 2.4평. 보증금이 없어서 무지출 기록에 안 들어간다",
        "브랜드 광고 계약이 하나 있다. 1원이라도 쓰면 계약금 전액 반환 조항이다",
        "편의점 폐기 시간을 요일별로 외운다",
        "구독 서비스가 0개다. 라이브커머스만 무료로 켜놓고 안 산다",
        "장바구니에 214일째 담아만 둔 물건이 하나 있다",
      ],
      spec: {"skin":"#e8d0bc","hair":"#3a3028","hairStyle":"bowl","top":"#6a6a62","bottom":"#3a3a42","shoes":"#7a7a72","heightScale":0.99,"widthScale":0.88,"accessory":"none","accessoryColor":"#8a8a8a","expression":"neutral","aura":"none","species":"human","femme":true,"props":[{"shape":"box","color":"#a89a80","size":0.3,"at":"handL","motion":"none","label":"얻어온 에코백"},{"shape":"disc","color":"#6a7a6a","size":0.26,"at":"crown","motion":"bob","label":"214일 0원"}]},
    },
    target: {
      name: "곧품절", gender: "남",
      look: ["형광 노랑 재킷","손에 늘 상품이 하나","헤드셋 마이크","웃는 근육만 발달함"],
      personality: ["30초 안에 결론을 냄","침묵을 못 견딤","방송이 꺼지면 말이 없어짐"],
      upbringing: [
        "36세 · 라이브커머스 쇼호스트 / 시간당 최고 매출 4억",
        "일산 아파트. 집에 자기가 판 물건이 하나도 없다",
        "실적 미달 3회면 계약 해지다. 지금 2회다",
        "하루 여섯 시간을 웃는다. 퇴근하면 얼굴이 안 움직인다",
        "\"마감 30초\"를 하루 마흔 번 말한다",
        "8년 동안 한 번도 안 산 시청자가 몇인지 세어본 적이 있다",
      ],
      taste: [
        "썸네일 클릭률 이야기",
        "마감 30초 카운트다운 요령",
        "\"안 사셔도 됩니다\"라고 말해본 게 8년 중 한 번이다",
        "매출이 잘 나온 날에도 기분이 나쁜 날이 있다",
        "실적 미달 2회를 회사에만 알렸다",
      ],
      spec: {"skin":"#eec6a0","hair":"#241f1a","hairStyle":"flattop","top":"#e8d040","bottom":"#2a2a3a","shoes":"#f0f0f0","heightScale":1.04,"widthScale":1,"accessory":"headband","accessoryColor":"#3a3a3a","expression":"happy","aura":"money","species":"human","props":[{"shape":"box","color":"#d84a4a","size":0.3,"at":"handR","motion":"shake","label":"오늘의 상품"},{"shape":"star","color":"#e8c040","size":0.26,"at":"crown","motion":"yaw","label":"마감 30초"}]},
    },
  },

  {
    id: "bigmouth-secret", category: "기밀",
    client: {
      name: "다말해", gender: "여",
      look: ["한쪽 어깨에 폰을 끼고 통화 중","파마 로드를 손에 든 채 돌아다님","목소리가 가게 밖까지 들림","표정이 다 드러남"],
      personality: ["비밀을 평균 11분 지킴","악의는 전혀 없음","기억력이 무섭게 좋음"],
      upbringing: [
        "30세 · 동네 미용실 원장 / 반경 800m 소문 집산지",
        "상가 2층. 손님 대기석이 여섯 자리인데 늘 여덟 명이 앉아 있다",
        "손님 이름과 그 집 사정을 400가구까지 외운다",
        "\"이건 진짜 아무한테도 말하면 안 되는데\"로 문장을 시작한다",
        "말하면서 파마를 말면 손이 두 배로 빨라진다",
        "알아낸 게 하나도 없는 손님이 생기면 그 사람만은 소문내지 않는다",
      ],
      spec: {"skin":"#f2d8c0","hair":"#7a3a5a","hairStyle":"curls","top":"#e0e0e8","bottom":"#3a3a44","shoes":"#c8a8b8","heightScale":0.99,"widthScale":1,"accessory":"earrings","accessoryColor":"#d8b040","expression":"happy","aura":"static","species":"human","femme":true,"props":[{"shape":"cylinder","color":"#e05a8a","size":0.2,"at":"handR","motion":"none","label":"파마 로드"},{"shape":"box","color":"#3a3a42","size":0.16,"at":"shoulderL","motion":"none","label":"어깨에 낀 폰"},{"shape":"sphere","color":"#c8a8b8","size":0.18,"at":"orbit","motion":"orbit","label":"이미 퍼진 소문"}]},
    },
    target: {
      name: "함구해", gender: "남",
      look: ["아무 무늬 없는 회색 점퍼","명함이 없음","눈을 오래 마주치지 않음","목에 출입증 끈 자국"],
      personality: ["질문을 질문으로 받음","부서명도 안 말함","같은 자리에 앉는다"],
      upbringing: [
        "38세 · 3급 비밀취급 인가 / 소속을 말할 수 없음",
        "관사. 주소를 아는 사람이 세 명이다",
        "휴대폰이 두 대인데 하나는 통화 기록이 남지 않는다",
        "인가 갱신 심사에서 가까운 사람을 전부 적어 내야 한다. 적힌 이름은 통째로 조회된다",
        "그 명단이 3년째 비어 있다",
        "같은 미용실만 3년째 격주로 간다. 이유는 본인도 설명 못 한다",
      ],
      taste: [
        "날씨 이야기 (그것밖에 할 게 없다)",
        "머리 감을 때 옆에서 떠들어주는 것",
        "3년간 자기 얘기를 한 문장도 안 했다",
        "명단에 이름을 하나 적어보는 상상을 한다",
        "적어 내면 그 사람 인생이 통째로 조회된다는 걸 안다",
      ],
      spec: {"skin":"#dcbc9c","hair":"#2a2620","hairStyle":"short","top":"#7a7a80","bottom":"#3a3a42","shoes":"#2a2a2a","heightScale":1.02,"widthScale":1,"accessory":"sunglasses","accessoryColor":"#1f1f22","expression":"neutral","aura":"none","species":"human","props":[{"shape":"box","color":"#4a4a52","size":0.18,"at":"chest","motion":"none","label":"이름 없는 출입증"}]},
    },
  },

  {
    id: "hate-comment", category: "악플경제",
    client: {
      name: "김익명", gender: "남",
      look: ["모니터 빛에 익은 피부","늘어난 티셔츠","손톱을 물어뜯음","실내에서도 모자"],
      personality: ["문장을 세 번 고쳐 씀","대면하면 말이 없음","반응 수를 센다"],
      upbringing: [
        "29세 · 무직 / 활동 계정 47개",
        "부모 집 작은방. 창문을 안 연다",
        "수입 0원. 통신비는 부모가 낸다",
        "계정 47개의 말투를 전부 다르게 쓴다",
        "경남 창원 출신. 고등학교 이후 친구가 없다",
        "자기 문장이 인용된 캡처를 모아뒀다",
      ],
      spec: {"skin":"#f0e0d2","hair":"#1f1c1a","hairStyle":"bowl","top":"#2e2e34","bottom":"#3f4450","shoes":"#5a5a5a","heightScale":0.98,"widthScale":0.82,"accessory":"hat","accessoryColor":"#202020","expression":"weird","aura":"gloom","species":"human","props":[{"shape":"box","color":"#2a2a32","size":0.32,"at":"handR","motion":"none","label":"계정 47개"},{"shape":"box","color":"#8a8a92","size":0.16,"at":"orbit","motion":"shake","label":"익명"}]},
    },
    target: {
      name: "반응왕", gender: "여",
      look: ["형광 헤드셋을 목에 검","눈썹을 과하게 그림","링 조명 자국","손톱이 화려함"],
      personality: ["화를 연기함","진짜 화나면 조용해짐","숫자로 자기를 설명함"],
      upbringing: [
        "31세 · 악플 리액션 유튜버 / 구독 88만",
        "상수동 스튜디오. 방음 부스가 있다",
        "월 수익 2,900만원. 절반이 악플 리액션에서 나온다",
        "하루 촬영 4시간, 편집 9시간",
        "서울 토박이. 원래 꿈은 성우였다",
        "진짜로 상처받은 날은 방송을 안 켠다",
      ],
      taste: [
        "편집 단축키 이야기",
        "조회수 터진 날 얘기",
        "악플이 줄어들까 봐 무섭다",
        "그의 계정 47개를 전부 구분해서 안다",
        "한 번도 신고한 적이 없다",
      ],
      spec: {"skin":"#fae0d0","hair":"#7be0d0","hairStyle":"twintail","top":"#ff3f6f","bottom":"#1c1c22","shoes":"#ffffff","heightScale":0.96,"widthScale":1.02,"accessory":"headband","accessoryColor":"#7be0d0","expression":"angry","aura":"rainbow","species":"human","femme":true,"props":[{"shape":"disc","color":"#f0e0a0","size":0.34,"at":"crown","motion":"yaw","label":"링 조명"},{"shape":"box","color":"#d84a4a","size":0.24,"at":"handR","motion":"shake","label":"오늘의 악플 캡처"}]},
    },
  },

  {
    id: "vtuber", category: "가상인격",
    client: {
      name: "목소리", gender: "남",
      look: ["팔에 방음재 자국","수염을 급히 밀어 자국이 남음","목에 파스","옷차림이 20대 같음"],
      personality: ["두 목소리를 오간다","거울을 안 본다","남의 컨디션을 잘 알아챈다"],
      upbringing: [
        "46세 · 버추얼 유튜버 \"루나쨩\" / 8년차",
        "일산 아파트. 방 하나를 통째로 방음했다",
        "월 수익 최고 1,900만원, 지난달 340만원",
        "8년간 얼굴을 한 번도 안 내보냈다",
        "전북 군산 출신. 원래 성우 지망이었다",
        "거울 있는 방에서는 방송을 못 한다",
      ],
      spec: {"skin":"#e8cdb4","hair":"#8a6f5c","hairStyle":"buzz","top":"#ff9ec7","bottom":"#4a4a52","shoes":"#2a2a2a","heightScale":0.98,"widthScale":1.12,"accessory":"mask","accessoryColor":"#ff9ec7","expression":"weird","aura":"bubbles","species":"human","props":[{"shape":"disc","color":"#f0a0c8","size":0.4,"at":"crown","motion":"yaw","label":"루나쨩 아이콘"},{"shape":"cylinder","color":"#3a3a42","size":0.3,"at":"handR","motion":"none","label":"마이크"}]},
    },
    target: {
      name: "서른셋", gender: "남",
      look: ["목에 방진복 자국","가방에 굿즈 키링 열두 개","안경이 늘 뿌옇다","걸음이 빠르다"],
      personality: ["공정 불량률로 비유함","좋아하는 걸 숨기지 못함","사과를 두 번 한다"],
      upbringing: [
        "33세 · 반도체 공정 엔지니어 / 최고액 후원자",
        "평택 사택. 3교대라 낮에 잔다",
        "연봉 7,400만원 중 후원이 매달 60만원",
        "굿즈를 회사 사물함에 숨겨둔다",
        "충북 청주 출신. 형이 둘 있다",
        "좋아한다는 말을 후원 메시지로만 해봤다",
      ],
      taste: [
        "수율 이야기",
        "방송 다시보기 타임스탬프",
        "사실 목소리가 중년 남자인 걸 3년 전에 알아챘다",
        "알고도 후원 금액을 늘렸다 — 아무한테도 말한 적 없다",
      ],
      spec: {"skin":"#f2ddc2","hair":"#26221e","hairStyle":"spiky","top":"#d8e4f0","bottom":"#2f3a48","shoes":"#8a8a90","heightScale":1,"widthScale":0.96,"accessory":"glasses","accessoryColor":"#111111","expression":"happy","aura":"sparkle","species":"human","props":[{"shape":"sphere","color":"#f0a0c8","size":0.16,"at":"waist","motion":"none","label":"굿즈 키링 열두 개"},{"shape":"box","color":"#40a0d0","size":0.24,"at":"handR","motion":"none","label":"후원 내역 4,100만원"}]},
    },
  },

  {
    id: "liar-profiler", category: "허언",
    client: {
      name: "뻥튀기", gender: "남",
      look: ["명함이 다섯 종류","손목에 짝퉁 시계","말할 때 눈이 왼쪽 위로 감","손이 쉬지 않고 움직임"],
      personality: ["직함이 대화마다 바뀜","들키면 더 크게 웃음","의외로 남 험담은 안 함"],
      upbringing: [
        "32세 · 자칭 前 국가정보 요원 / 실제 이력은 편의점 3년",
        "부천 원룸. 벽에 상장 프레임 여섯 개가 걸려 있고 전부 본인이 만들었다",
        "명함 다섯 종류를 상황에 따라 꺼낸다. 회사는 다섯 개 다 없다",
        "거짓말이 들통난 횟수를 세다 200에서 그만뒀다",
        "지금 참고인으로 조사받는 사건이 하나 있다",
        "진짜 이력을 말해본 게 언제인지 기억이 안 난다",
        "혼자 있을 때는 한마디도 안 한다",
      ],
      spec: {"skin":"#e8c8a4","hair":"#2a231c","hairStyle":"short","top":"#3a4a6a","bottom":"#2a2a32","shoes":"#5a4a3a","heightScale":1.01,"widthScale":1.02,"accessory":"sunglasses","accessoryColor":"#3a3a3a","expression":"smug","aura":"question","species":"human","props":[{"shape":"box","color":"#e8e4dc","size":0.2,"at":"handR","motion":"shake","label":"명함 다섯 종"},{"shape":"torus","color":"#d8b040","size":0.16,"at":"handL","motion":"none","label":"짝퉁 시계"},{"shape":"star","color":"#c8a840","size":0.24,"at":"crown","motion":"yaw","label":"본인이 만든 상장"}]},
    },
    target: {
      name: "진술해", gender: "여",
      look: ["펜을 세 자루 꽂고 다님","상대의 손만 본다","표정이 바뀌지 않음","정면을 피해 비스듬히 앉음"],
      personality: ["거짓말을 첫 문장에서 앎","지적을 미룸","자기 얘기를 안 함"],
      upbringing: [
        "40세 · 진술분석관 14년차 / 판별 정확도 94%",
        "관사 원룸. 벽에 아무것도 안 걸려 있다",
        "14년간 3,100건을 분석했다. 틀린 건 여섯 건이다",
        "말끝이 올라가는 지점을 초 단위로 표시하며 듣는다",
        "자기 보고서가 유일한 증거인 사건을 하나 맡고 있다. 참고인과 사적으로 얽히면 그 보고서가 증거능력을 잃는다",
        "믿어본 사람이 몇인지 세어봤더니 둘이었다",
      ],
      taste: [
        "진술 일관성 지표 이야기",
        "말하다 멈추는 0.4초의 의미",
        "거짓말의 종류를 여섯 갈래로 분류해뒀다",
        "상대 이력을 미리 조회하고 싶은 충동을 참는다",
        "보고서 마지막 문단을 아직 못 쓰고 있다",
      ],
      spec: {"skin":"#f0dcc4","hair":"#2a2428","hairStyle":"bowl","top":"#4a4a54","bottom":"#33333a","shoes":"#2a2a2a","heightScale":0.99,"widthScale":0.9,"accessory":"glasses","accessoryColor":"#2a2a2a","expression":"neutral","aura":"none","species":"human","femme":true,"props":[{"shape":"spike","color":"#3a3a44","size":0.22,"at":"chest","motion":"none","label":"펜 세 자루"},{"shape":"box","color":"#e8e4d8","size":0.26,"at":"handL","motion":"none","label":"받아적는 수첩"}]},
    },
  },

  {
    id: "ghost-scare", category: "담력",
    client: {
      name: "소름이", gender: "여",
      look: ["어깨가 늘 올라가 있음","목에 호루라기","폰 손전등을 켠 채로 다님","자꾸 뒤를 돌아봄"],
      personality: ["비명이 먼저 나감","무서우면 말이 빨라짐","의외로 도망은 안 감"],
      upbringing: [
        "26세 · 편의점 야간 알바 / 화장실 불을 켜고 잔다",
        "신림 원룸. 형광등 세 개를 24시간 켜둔다",
        "야간 알바를 하는 이유가 밤에 혼자 있는 게 더 무서워서다",
        "공포영화 예고편만 봐도 사흘을 못 잔다",
        "호루라기를 6년째 목에 걸고 다닌다. 불어본 적은 없다",
        "회사 워크숍으로 끌려간 공포체험관에서 실신한 적이 있다",
        "무서울 때 옆 사람 소매를 잡는 버릇이 있다",
      ],
      spec: {"skin":"#f0dccc","hair":"#3a3028","hairStyle":"twintail","top":"#c8d8e0","bottom":"#3a4a5a","shoes":"#d8d8dc","heightScale":0.96,"widthScale":0.88,"accessory":"none","accessoryColor":"#e0e0e8","expression":"shock","aura":"gloom","species":"human","femme":true,"props":[{"shape":"sphere","color":"#e8e050","size":0.14,"at":"chest","motion":"none","label":"불어본 적 없는 호루라기"},{"shape":"box","color":"#f0f0d0","size":0.16,"at":"handR","motion":"shake","label":"켜둔 손전등"}]},
    },
    target: {
      name: "문귀신", gender: "남",
      look: ["긴 검은 머리로 얼굴을 가림","하얀 렌즈를 낀 채로 퇴근","목덜미에 안 지워진 분장","소리를 안 내고 걷는다"],
      personality: ["평소엔 아주 조용함","놀래킨 뒤 사과함","자기 맨얼굴을 안 보여줌"],
      upbringing: [
        "30세 · 공포체험관 분장 배우 8년차 / 별명은 「복도 끝」",
        "체험관 근처 반지하. 커튼을 안 걷는다",
        "하루 마흔 번 놀래키고 마흔 번 미안해한다",
        "손님이 실신한 건 8년 동안 열한 번이고 전부 이름을 기억한다",
        "분장을 지우는 데 40분이 걸린다. 지우고 나가본 적이 거의 없다",
        "규정상 손님과 사적으로 만나면 그날로 해고다. 8년째 유일한 직장이다",
      ],
      taste: [
        "분장 라텍스 접착제 이야기",
        "복도 끝 등장 타이밍 0.8초",
        "실신한 손님 열한 명 중 다시 온 사람은 하나뿐이다",
        "이온음료를 늘 두 개 챙겨두게 됐다",
        "맨얼굴을 보여주면 안 무서워질까 봐 못 지운다",
      ],
      spec: {"skin":"#d8d0cc","hair":"#131013","hairStyle":"long","top":"#e0dcd4","bottom":"#dcd8d0","shoes":"#2a2a2a","heightScale":1.05,"widthScale":0.9,"accessory":"none","accessoryColor":"#f0f0f0","expression":"weird","aura":"skull","species":"human","props":[{"shape":"sphere","color":"#f4f4f0","size":0.12,"at":"face","motion":"none","label":"하얀 렌즈"},{"shape":"cylinder","color":"#5a9ad0","size":0.2,"at":"handR","motion":"none","label":"미지근한 이온음료"}]},
    },
  },

  {
    id: "sober-brewer", category: "단주",
    client: {
      name: "끊었다", gender: "남",
      look: ["손에 늘 탄산수 캔","컵을 두 손으로 잡음","얼굴에 붉은 기가 없음","손등에 오래된 흉터"],
      personality: ["말을 아주 천천히 함","술 얘기가 나오면 웃으며 화제를 돌림","남의 재발을 자기 탓으로 봄"],
      upbringing: [
        "44세 · 알코올 회복 모임 간사 / 단주 187일",
        "성수동 반지하. 냉장고에 탄산수만 스물네 캔 들어 있다",
        "간사 자격 조건이 단주 유지다. 무너지면 모임 40명이 간사를 잃는다",
        "이전 최장 기록이 40일이었다. 열세 번 실패했다",
        "냄새 반경 안에서는 3분을 못 버틴다. 그건 아무한테도 말 안 했다",
        "모임에서 남의 이야기만 듣고 자기 차례는 늘 넘긴다",
      ],
      spec: {"skin":"#dcbc9c","hair":"#4a4038","hairStyle":"short","top":"#5a6a72","bottom":"#3a3a42","shoes":"#3a3228","heightScale":1.01,"widthScale":1.04,"accessory":"none","accessoryColor":"#a8c8d8","expression":"neutral","aura":"none","species":"human","props":[{"shape":"cylinder","color":"#8ab8c8","size":0.24,"at":"handR","motion":"none","label":"탄산수 캔"},{"shape":"disc","color":"#c8b878","size":0.24,"at":"crown","motion":"bob","label":"187일"}]},
    },
    target: {
      name: "술익다", gender: "여",
      look: ["앞치마에 누룩가루","손이 늘 젖어 있음","볼이 발갛다","코를 자주 킁킁거림"],
      personality: ["냄새로 사람 기분을 맞힘","권하지 않는다","말끝을 흐림"],
      upbringing: [
        "39세 · 3대째 막걸리 양조장 / 시음이 업무다",
        "양조장 안채. 술독 마흔 개와 같은 지붕 아래 산다",
        "배합을 잡느라 하루 여섯 번 시음한다. 안 하면 그날 술이 죽는다",
        "동네 회복 모임 몇 곳에 무알콜 식혜를 여섯 달째 넣는다. 안에는 한 번도 안 들어갔다",
        "몸에 밴 냄새가 며칠을 안 빠진다는 걸 안다",
        "3대 중 술을 제일 못 마시는 사람이 본인이다",
      ],
      taste: [
        "누룩 띄우는 온도 이야기",
        "3대째 쓰는 술독 관리법",
        "무알콜 식혜를 그 후원 때문에 개발했다",
        "여섯 달 동안 문 앞까지만 갔다",
        "자기 몸에서 나는 냄새를 처음으로 미워하게 됐다",
      ],
      spec: {"skin":"#f0d0b0","hair":"#3a2e26","hairStyle":"updo","top":"#e8e0cc","bottom":"#6a5a48","shoes":"#8a7050","heightScale":0.97,"widthScale":1,"accessory":"bandana","accessoryColor":"#c8bca0","expression":"happy","aura":"bubbles","species":"human","femme":true,"props":[{"shape":"cylinder","color":"#e8e4d0","size":0.3,"at":"handL","motion":"none","label":"시음 사발"},{"shape":"sphere","color":"#8a7a5a","size":0.42,"at":"ground","motion":"none","label":"술독"}]},
    },
  },

  {
    id: "touch-space", category: "거리",
    client: {
      name: "껴안아", gender: "여",
      look: ["팔을 늘 반쯤 벌리고 있음","옷에 스티커가 붙어 있음","머리가 헝클어짐","웃을 때 몸 전체가 움직임"],
      personality: ["하루 포옹 평균 92회","거리를 못 잼","싫다는 말을 늦게 알아들음"],
      upbringing: [
        "25세 · 유치원 교사 3년차 / 하루 포옹 평균 92회",
        "성산동 원룸. 인형이 열아홉 개고 전부 아이들한테 받은 것이다",
        "말하면서 상대 팔을 잡는 버릇이 있다. 고쳐본 적이 없다",
        "혼자 있으면 30분 안에 누구한테든 전화를 건다",
        "참는 법을 배운 적이 없다는 걸 최근에 알았다",
        "안 되는 사람이 있다는 걸 스물다섯에 처음 배웠다",
      ],
      spec: {"skin":"#f4d8c0","hair":"#5a3a2a","hairStyle":"curls","top":"#f0a0b8","bottom":"#8ab8d0","shoes":"#f0e0a0","heightScale":0.95,"widthScale":0.98,"accessory":"flower","accessoryColor":"#e85a8a","expression":"happy","aura":"hearts","species":"human","femme":true,"props":[{"shape":"star","color":"#e8c840","size":0.16,"at":"chest","motion":"none","label":"받은 스티커"},{"shape":"sphere","color":"#e08aa8","size":0.2,"at":"orbit","motion":"orbit","label":"92번째 포옹"}]},
    },
    target: {
      name: "두걸음", gender: "남",
      look: ["항상 두 걸음 물러나 있음","장갑을 안 벗음","옷깃을 목까지 채움","손소독제를 손목에 걸고 다님"],
      personality: ["악수를 안 함","숫자로 거리를 말함","싫다는 말을 못 함"],
      upbringing: [
        "34세 · 표준연구원 정밀측정 / 접촉 오염 관리구역 담당",
        "대전 관사. 방문 손잡이를 하루 두 번 닦는다",
        "측정 중 인체 접촉이 한 번 있으면 0.4µm가 틀어져 3개월치가 무효가 된다",
        "34년간 포옹을 받아본 적이 없다. 피해서가 아니라 없어서다",
        "장갑을 하루에 열두 켤레 쓴다",
        "누가 손을 내밀면 계산이 3초 멈춘다",
      ],
      taste: [
        "µm 단위 오차 보정 이야기",
        "항온항습실 습도 55% 유지",
        "장갑을 벗어보고 싶을 때가 가끔 있다",
        "퍼스널 스페이스 2m를 34년간 아무도 안 물어봤다",
        "재측정 3개월을 감수할지 계산해본 적이 있다",
      ],
      spec: {"skin":"#e0c4a8","hair":"#2a2620","hairStyle":"bowl","top":"#e8ecf0","bottom":"#5a6a78","shoes":"#dcdce0","heightScale":1.03,"widthScale":0.9,"accessory":"glasses","accessoryColor":"#3a3a3a","expression":"shy","aura":"ice","species":"human","props":[{"shape":"box","color":"#f0f0f4","size":0.16,"at":"handL","motion":"none","label":"안 벗는 장갑"},{"shape":"torus","color":"#a8c0d0","size":0.6,"at":"ground","motion":"yaw","label":"반경 2m"}]},
    },
  },

  {
    id: "pyramid", category: "다단계",
    client: {
      name: "정상위", gender: "여",
      look: ["정장에 배지 여섯 개","명함집이 두꺼움","악수가 세다","늘 서 있다"],
      personality: ["모든 만남을 기회로 셈","거절을 안 듣는다","남의 성공담을 자기 것처럼 말함"],
      upbringing: [
        "41세 · 리크루터 / 다이아 직급 3년차",
        "수원 오피스텔. 제품 박스가 벽을 채운다",
        "월 수익 최고 2,200만원, 지난달 180만원",
        "12년째 다이아 직급을 유지한다",
        "경기 안산 출신. 동생 둘이 연락을 끊었다",
        "거절당한 사람 이름을 전부 적어둔다",
      ],
      spec: {"skin":"#f0d2b4","hair":"#5a3a28","hairStyle":"beehive","top":"#1e2a44","bottom":"#1e2a44","shoes":"#2a2a2a","heightScale":1,"widthScale":0.95,"accessory":"earrings","accessoryColor":"#d4af37","expression":"chad","aura":"money","species":"human","femme":true,"props":[{"shape":"box","color":"#e8e4d8","size":0.22,"at":"handR","motion":"shake","label":"명함"},{"shape":"star","color":"#d8b040","size":0.2,"at":"chest","motion":"none","label":"다이아 직급 배지"}]},
    },
    target: {
      name: "구출식", gender: "남",
      look: ["목이 늘어난 티셔츠","손에 유인물 뭉치","수염을 안 깎음","앉을 때 한숨을 쉼"],
      personality: ["남 얘기를 끝까지 듣는다","자기 얘기는 안 한다","숫자를 못 외운다"],
      upbringing: [
        "44세 · 피해자 모임 운영 / 본인도 5년 몸담았다",
        "영등포 지하 사무실. 의자가 서른 개다",
        "모임 운영비 월 90만원. 후원으로 충당한다",
        "5년간 본인이 데려간 사람이 마흔이다",
        "충남 논산 출신. 아직 아무한테도 사과 못 했다",
        "유인물을 직접 접는다",
      ],
      taste: [
        "모임 운영비 걱정",
        "아무도 안 오는 조용한 날",
        "본인 하위 라인이 아직 스물이다",
        "그 사람 실적표를 갖고 있다",
        "모임 후원금 일부를 생활비로 쓴다",
      ],
      spec: {"skin":"#dcbf9c","hair":"#4a4640","hairStyle":"dreads","top":"#7a7f74","bottom":"#3f4238","shoes":"#5a4f42","heightScale":1.01,"widthScale":1.14,"accessory":"beard","accessoryColor":"#4a4640","expression":"sad","aura":"none","species":"human","props":[{"shape":"box","color":"#e8e4d8","size":0.34,"at":"handR","motion":"none","label":"유인물 뭉치"},{"shape":"box","color":"#7a8a96","size":0.24,"at":"ground","motion":"none","label":"접이식 의자 마흔 개"}]},
    },
  },

  {
    id: "dutchpay-treat", category: "계산",
    client: {
      name: "정확히", gender: "여",
      look: ["계산기 앱을 켠 폰을 손에 쥠","영수증을 반듯하게 접어 넣음","같은 옷 세 벌을 돌려 입음","자세가 흐트러지지 않음"],
      personality: ["1원 단위로 정산함","호의를 부채로 계산함","고맙다는 말을 못 함"],
      upbringing: [
        "31세 · 회계사 / 모임 정산 앱 개발자 · 이용자 12만",
        "마포 오피스텔. 가계부를 2011년부터 하루도 안 빼먹었다",
        "얻어먹으면 그날 안에 계좌이체를 한다. 예외가 없다",
        "본인 앱에 3년째 미정산으로 남은 건이 열두 건 있다. 전부 누가 혼자 결제하고 정산을 거절한 것이다",
        "세무 담당인 사업장 대표와 사적으로 얽히면 담당에서 빠져야 한다",
        "그 열두 건을 지우지도 정산하지도 못하고 있다",
      ],
      spec: {"skin":"#f0dcc4","hair":"#2a2428","hairStyle":"bowl","top":"#5a6a7a","bottom":"#33333a","shoes":"#2a2a2a","heightScale":0.99,"widthScale":0.9,"accessory":"glasses","accessoryColor":"#3a3a3a","expression":"neutral","aura":"none","species":"human","femme":true,"props":[{"shape":"box","color":"#3a3a44","size":0.2,"at":"handR","motion":"none","label":"계산기"},{"shape":"disc","color":"#e8e4d8","size":0.2,"at":"chest","motion":"none","label":"접은 영수증"},{"shape":"torus","color":"#8a9aa8","size":0.22,"at":"crown","motion":"yaw","label":"미정산 12건"}]},
    },
    target: {
      name: "김쏜다", gender: "남",
      look: ["계산대로 먼저 뛰어감","지갑이 두꺼운데 현금은 없음","무늬가 큰 셔츠","웃으면 이가 다 보임"],
      personality: ["남이 지갑 꺼내는 걸 못 봄","힘든 얘기를 농담으로 함","혼자서는 밥을 안 먹음"],
      upbringing: [
        "38세 · 고깃집 운영 8년 / 신용카드 세 장 리볼빙",
        "가게 위 옥탑. 가게 문 닫고 올라가면 아무도 없다",
        "손님이 열두 명이면 열두 명 몫을 혼자 계산한 적이 있다",
        "이번 분기 부가세를 못 맞추면 문을 닫는다",
        "\"제가 쏠게요\"를 하루에 평균 여섯 번 말한다",
        "얻어먹으면 그날 잠을 못 잔다. 이유는 본인도 모른다",
      ],
      taste: [
        "고기 숙성 일수 이야기",
        "단골 열두 명 이름 부르기",
        "리볼빙 잔액을 아무한테도 안 말했다",
        "정산 요청 알림 열두 개를 안 지우고 뒀다",
        "혼자 계산하는 게 유일하게 잘하는 거라고 믿는다",
      ],
      spec: {"skin":"#e8be94","hair":"#241f1a","hairStyle":"short","top":"#d05a4a","bottom":"#3a3a44","shoes":"#8a6a4a","heightScale":1.03,"widthScale":1.16,"accessory":"none","accessoryColor":"#d8b040","expression":"happy","aura":"money","species":"human","props":[{"shape":"box","color":"#d8b040","size":0.18,"at":"handR","motion":"shake","label":"먼저 꺼낸 카드"},{"shape":"box","color":"#8a6a4a","size":0.24,"at":"waist","motion":"none","label":"현금 없는 지갑"}]},
    },
  },

  {
    id: "asmr", category: "청각",
    client: {
      name: "백소음", gender: "여",
      look: ["늘 헤드폰을 목에 걸고 있음","손톱을 아주 짧게 깎음","목소리가 작다","실내용 슬리퍼로 다님"],
      personality: ["소리로 사람을 기억함","조용해지면 말을 더 함","남의 숨소리를 흉내 냄"],
      upbringing: [
        "29세 · ASMR 크리에이터 / 구독 31만",
        "원룸 방음 공사에 900만원을 썼다",
        "월 수익 340만원. 절반이 광고다",
        "하루 녹음 6시간, 편집 5시간",
        "충북 제천 출신. 소리 없는 집에서 자랐다",
        "자기 영상을 틀어놓고 잔다",
      ],
      spec: {"skin":"#f6e3d4","hair":"#c7b6a8","hairStyle":"wave","top":"#efe6f2","bottom":"#b9aec6","shoes":"#f2f2f2","heightScale":0.95,"widthScale":0.82,"accessory":"headband","accessoryColor":"#d8cfe4","expression":"shy","aura":"bubbles","species":"human","femme":true,"props":[{"shape":"sphere","color":"#c8c8d0","size":0.26,"at":"handR","motion":"none","label":"대형 마이크"},{"shape":"sphere","color":"#c8d8e0","size":0.14,"at":"orbit","motion":"orbit","label":"속삭임"}]},
    },
    target: {
      name: "윙윙", gender: "남",
      look: ["귀를 자주 만짐","카디건 소매가 늘어남","눈 밑이 어둡다","손에 늘 도서 라벨"],
      personality: ["소리를 숫자로 말함","따지고 나서 사과함","조용한 곳을 먼저 찾음"],
      upbringing: [
        "34세 · 시립도서관 사서 / 이명 3년차",
        "도서관에서 걸어서 4분 거리에 산다",
        "연봉 3,600. 이명 치료비가 매달 22만원",
        "3년간 이비인후과 다섯 곳을 돌았다",
        "경기 부천 출신. 어머니도 이명이 있었다",
        "조용한 방에서 제일 크게 들린다",
      ],
      taste: [
        "서가 청구기호 이야기",
        "아무 소리도 안 나는 시간",
        "신고를 넣은 그날 밤에도 그 채널을 틀었다. 그게 제일 화가 난다",
        "소견서에 채널 이름을 적어 넣자고 한 건 담당의가 아니라 자기였다",
        "어머니 이명이 어떻게 끝났는지 아직 아무한테도 말한 적 없다",
      ],
      spec: {"skin":"#eddcc8","hair":"#3a3128","hairStyle":"short","top":"#7a8574","bottom":"#4a4a52","shoes":"#5c4a3a","heightScale":1.02,"widthScale":0.94,"accessory":"glasses","accessoryColor":"#2a2a2a","expression":"sad","aura":"static","species":"human","props":[{"shape":"box","color":"#8a7a5a","size":0.28,"at":"handR","motion":"none","label":"도서 라벨 뭉치"},{"shape":"torus","color":"#b8b8c0","size":0.2,"at":"crown","motion":"shake","label":"안 멎는 이명"}]},
    },
  },

  {
    id: "spice", category: "위장",
    client: {
      name: "캡사이신", gender: "여",
      look: ["입술이 늘 부어 있음","가방에 우유 두 팩","눈물자국을 안 지움","손끝이 빨갛다"],
      personality: ["모든 걸 스코빌로 환산함","아프다는 말을 안 함","카메라가 없으면 조용함"],
      upbringing: [
        "27세 · 매운맛 챌린지 유튜버 / 구독 62만",
        "위벽 미란 4회, 식도염 2회 진단",
        "월 수익 1,100만원. 병원비는 경비 처리한다",
        "한 달에 한 번 내시경",
        "부산 출신. 집에서는 아무도 매운 걸 못 먹는다",
        "카메라를 끄면 아무것도 안 먹는다",
      ],
      spec: {"skin":"#fadfd2","hair":"#e0483a","hairStyle":"ponytail","top":"#ff5a3c","bottom":"#2c2c34","shoes":"#ffffff","heightScale":0.94,"widthScale":0.9,"accessory":"earrings","accessoryColor":"#ff2a2a","expression":"weird","aura":"fire","species":"human","femme":true,"props":[{"shape":"cone","color":"#d02a2a","size":0.3,"at":"handR","motion":"none","label":"청양고추 한 줌"},{"shape":"cylinder","color":"#f0f0f4","size":0.24,"at":"handL","motion":"none","label":"우유 두 팩"}]},
    },
    target: {
      name: "위성곤", gender: "남",
      look: ["수술모 자국이 이마에 남음","손이 아주 차갑다","가운 주머니가 늘 무겁다","말할 때 눈을 안 피함"],
      personality: ["최악의 경우부터 말함","농담에 1초 늦게 웃음","남의 식사를 관찰함"],
      upbringing: [
        "38세 · 소화기내과 전문의 / 내시경 6,000건",
        "병원에서 도보 2분 오피스텔",
        "주 6일, 하루 내시경 22건",
        "10년간 담당 환자를 한 명도 못 말렸다",
        "대구 출신. 아버지가 위암이었다",
        "퇴근하면 죽만 먹는다",
      ],
      taste: [
        "담백한 죽 이야기",
        "검사 결과가 깨끗한 날",
        "그 채널 영상을 전부 봤다",
        "진료기록에 사적인 메모를 한 줄 남긴 적 있다",
        "한 번도 촬영을 말린 적이 없는 자신을 미워한다",
      ],
      spec: {"skin":"#f0ddc9","hair":"#2a2622","hairStyle":"short","top":"#f4f6f8","bottom":"#3a4250","shoes":"#e8e8e8","heightScale":1.05,"widthScale":1,"accessory":"mask","accessoryColor":"#dfe8ef","expression":"neutral","aura":"none","species":"human","props":[{"shape":"cylinder","color":"#5a5a62","size":0.5,"at":"handR","motion":"none","label":"내시경 호스"},{"shape":"disc","color":"#e8e4d8","size":0.24,"at":"chest","motion":"none","label":"6,000건째 소견서"}]},
    },
  },

  {
    id: "recycle", category: "분리수거",
    client: {
      name: "최분리", gender: "남",
      look: ["형광 조끼를 사복 위에 입음","집게를 늘 들고 다님","장갑 자국이 손목에 남음","모자를 눌러씀"],
      personality: ["재질을 소리 내어 분류함","규정 조항을 외움","고맙다는 말에 자리를 뜬다"],
      upbringing: [
        "44세 · 아파트 분리수거 감시원 12년차",
        "임대아파트 12동 관리사무소 옆방",
        "월급 218만원. 12년째 같은 자리",
        "새벽 5시부터 8시까지가 본업",
        "전남 순천 출신. 아버지가 고물상을 했다",
        "집에 아무것도 안 쌓아둔다",
      ],
      spec: {"skin":"#e6cdb0","hair":"#4a4038","hairStyle":"buzz","top":"#d8e02a","bottom":"#3a4a3a","shoes":"#5a4a3a","heightScale":1,"widthScale":1.08,"accessory":"hat","accessoryColor":"#d8e02a","expression":"neutral","aura":"none","species":"human","props":[{"shape":"spike","color":"#c0c0c8","size":0.44,"at":"handR","motion":"none","label":"집게"},{"shape":"box","color":"#4a8a5a","size":0.3,"at":"handL","motion":"none","label":"분류 스티커"}]},
    },
    target: {
      name: "주워담", gender: "여",
      look: ["작업복에 페인트가 층층이","손등에 오래된 흉터","머리를 아무렇게나 묶음","주머니가 늘 불룩함"],
      personality: ["남의 물건을 먼저 집음","설명을 안 함","한밤중에 전화함"],
      upbringing: [
        "36세 · 설치미술가 / 폐기물 작업 9년차",
        "성수동 지하 작업실. 창문이 없다",
        "연 수입 불규칙. 작년은 1,400만원",
        "재료비를 한 번도 낸 적이 없다",
        "인천 출신. 어릴 때 이사를 열한 번 했다",
        "작품을 팔면 잠을 못 잔다",
      ],
      taste: [
        "녹슨 것의 색 이야기",
        "아직 아무도 안 가져간 새벽",
        "41건 전부 그 사람이 신고한 걸 안다",
        "신고서 필체를 알아본다",
        "과태료 고지서를 한 장도 안 버렸다",
      ],
      spec: {"skin":"#e8cfb8","hair":"#5c4632","hairStyle":"updo","top":"#8a7a5a","bottom":"#4a4438","shoes":"#3a3a3a","heightScale":0.98,"widthScale":0.96,"accessory":"bandana","accessoryColor":"#a83a2a","expression":"smug","aura":"question","species":"human","femme":true,"props":[{"shape":"box","color":"#8a7a5a","size":0.36,"at":"shoulderR","motion":"none","label":"주워 온 폐자재"},{"shape":"star","color":"#c85a3a","size":0.24,"at":"crown","motion":"yaw","label":"시립미술관 로비"}]},
    },
  },];

// ── 검증 — 스키마 밖의 축이 생기거나 축이 비면 로드 자체가 죽는다 ──────
export const CLIENT_FIELDS = new Set(['name', 'gender', 'look', 'personality', 'upbringing', 'spec']);
export const TARGET_FIELDS = new Set(['name', 'gender', 'look', 'personality', 'upbringing', 'taste', 'spec']);
const COUPLE_FIELDS = new Set(['id', 'category', 'client', 'target']);

const seenId = new Set();
for (const c of COUPLES) {
  for (const f of Object.keys(c)) if (!COUPLE_FIELDS.has(f)) throw new Error(`couples.js: ${c.id}에 스키마 밖 필드 「${f}」`);
  if (!c.id || seenId.has(c.id)) throw new Error(`couples.js: id 중복 또는 누락 — ${c.id}`);
  seenId.add(c.id);
  if (!c.category) throw new Error(`couples.js: ${c.id} 분류 누락`);

  for (const [who, fields] of [['client', CLIENT_FIELDS], ['target', TARGET_FIELDS]]) {
    const p = c[who];
    for (const f of Object.keys(p)) if (!fields.has(f)) throw new Error(`couples.js: ${c.id}.${who}에 스키마 밖 필드 「${f}」`);
    for (const f of fields) if (p[f] === undefined) throw new Error(`couples.js: ${c.id}.${who}에 ${f}가 없다`);
    if (!p.name || !p.gender) throw new Error(`couples.js: ${c.id}.${who} 이름/성별 누락`);
    if (!p.look?.length || !p.personality?.length) throw new Error(`couples.js: ${c.id}.${who} 외모/성격 누락`);
    if (!(p.upbringing?.length >= 3)) throw new Error(`couples.js: ${c.id}.${who} 성장환경이 부실하다`);
    // 조형 보정 플래그. 아바타 렌더러가 눈매·볼·체형 비율만 다듬는다.
    if (p.gender === '여') p.spec.femme = true;
  }
  // 취향은 타겟에게만 있고, 평평한 문자열 목록이다.
  if (!(c.target.taste?.length >= 3)) throw new Error(`couples.js: ${c.id} 타겟 취향이 3항 미만이다`);
  for (const t of c.target.taste) {
    if (typeof t !== 'string' || t.length < 2) throw new Error(`couples.js: ${c.id} 취향 항목이 비었다`);
  }
  if (new Set(c.target.taste).size !== c.target.taste.length) throw new Error(`couples.js: ${c.id} 취향 중복`);
  // 반한 이유는 커플마다 달라야 한다. 복붙이면 조합이 하나로 뭉개진다.
}

export const COUPLE_BY_ID = Object.fromEntries(COUPLES.map(c => [c.id, c]));
