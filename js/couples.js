// couples.js — 큐피드국 상설 의뢰 대장. 20건 전부 손으로 쓴 고정 데이터다.
// LLM은 이 사람들을 "연기"할 뿐, 만들어내지 않는다. 매칭이 성립할 리 없는 조합만 골라 넣었다.
//
// 필드 규약
//   difficulty  : '쉬움' | '보통' | '헬'      — scoring.js의 DIFFICULTIES 키
//   endingKind  : '연애' | '동맹' | '휴전'    — 이 커플에게 '성공'이 무엇인가
//   clash       : 왜 이 매칭이 지옥인지 한 줄
//   visiblePrefs: 의뢰서에 인쇄되어 요원이 미리 아는 취향
//   hiddenPrefs : 대화로만 드러나는 취향. 적중 시 호감이 크게 뛴다
//   redLines    : 건드리면 분위기가 폭락하는 지뢰. 요원에게도 공개된다 (지뢰는 알려줘야 공평하다)
//   spec        : 3D 블록 아바타 기본 스펙 (avatar.js). 스타일링으로 이 위에 덮어쓴다

const S = (o) => o; // 그냥 가독성용 마커

export const COUPLES = [
  // ── 01 ────────────────────────────────────────────────────────────────
  {
    id: 'politics',
    difficulty: '헬',
    endingKind: '연애',
    category: '정치',
    clash: '30년째 서로를 공개 석상에서 인격 말살해온 정적(政敵)',
    winWord: '초당적 커플 성사',
    client: {
      name: '힐라리 클링턴', age: 68, job: '前 국무장관 / 개인 이메일 서버 수집가',
      story: '상원 청문회 11시간차. 서로 고성을 지르다가 문득 깨달았다. 저 인간, 11시간 동안 목이 한 번도 안 쉬었다. ' +
        '나는 3시간째부터 물을 여섯 잔 마셨는데. 그 폐활량에 반해버린 나 자신이 제일 싫다. 이 감정은 국가기밀이다.',
      appearance: ['금발 단발', '파란 파워수트', '중년', '눈빛에 소송 3건'],
      personality: ['정책 브리핑하듯 말함', '지고는 못 삼', '의외로 소녀감성'],
      weakness: '말문이 막히면 자기도 모르게 "그건 팩트체크가 필요한 발언입니다"라고 받아친다',
      quote: '요원. 이건 연애가 아니라 외교 정상화 협상이야. 실패하면 국제 문제다.',
      spec: S({ skin: '#f2d3b8', hair: '#e8c860', hairStyle: 'bowl', top: '#2b4fa8', bottom: '#2b4fa8', shoes: '#101010', heightScale: 0.97, widthScale: 1.0, accessory: 'glasses', accessoryColor: '#333333', expression: 'neutral', aura: 'none', species: 'human' }),
    },
    target: {
      name: '도날두 트럼푸', age: 71, job: '골프 리조트 재벌 / 前 대통령',
      appearance: ['주황빛 올백', '태닝한 피부', '빨간 넥타이', '체구가 큼'],
      personality: ['모든 문장을 최상급으로 끝냄', '칭찬에 즉시 무너짐', '집중력 8초'],
      visiblePrefs: ['자기 이름이 금색으로 박힌 물건', '시청률·조회수 숫자 이야기'],
      hiddenPrefs: ['자기 골프 핸디캡을 진지하게 물어봐 주는 것', '맥도날드 필레오피쉬(햄버거 아님, 생선 쪽)', '사실 이메일 서버 하드웨어에 관심이 아주 많다'],
      redLines: ['지난 선거 결과 언급', '자기보다 자기 얘기를 더 오래 하는 것', '"작은"이라는 형용사'],
      spec: S({ skin: '#f0b57a', hair: '#ff8a2b', hairStyle: 'bowl', top: '#1b1b3a', bottom: '#1b1b3a', shoes: '#2a2a2a', heightScale: 1.06, widthScale: 1.28, accessory: 'none', accessoryColor: '#cc0000', expression: 'chad', aura: 'money', species: 'human' }),
    },
  },

  // ── 02 ────────────────────────────────────────────────────────────────
  {
    id: 'orientation',
    difficulty: '보통',
    endingKind: '동맹',
    category: '행정오류',
    clash: '게이 남성 × 레즈비언 여성. 국가 전산 오류로 강제 배정된, 물리적으로 불가능한 매칭',
    winWord: '전우 동맹 결성',
    client: {
      name: '강태오', age: 29, job: '플로리스트',
      story: '큐피드국 랜덤 배정 통지서를 받고 3초 만에 서로 알아봤다. "아, 이건 아니구나." 근데 큐피드국은 반려를 안 해준다. ' +
        '미배정 국민은 벌금 800만원. 태오는 이 사람과 뭐라도 하나 성사시켜야 집에 갈 수 있다. 연애 말고 다른 걸로.',
      appearance: ['애쉬 그레이 단발', '린넨 셔츠', '마른 체형', '손톱에 흙'],
      personality: ['눈치 200단', '농담으로 위기 돌파', '정 많음'],
      weakness: '어색하면 상대에게 꽃말을 읊기 시작한다. 한 번 시작하면 12종까지 간다',
      quote: '요원님. 저희 둘 다 이건 아니에요. 근데 벌금이 800이래요. 뭐라도 좀 해주세요.',
      spec: S({ skin: '#f5d5b5', hair: '#b8b8c4', hairStyle: 'long', top: '#e8e2d0', bottom: '#3a4a5a', shoes: '#8a6a4a', heightScale: 1.03, widthScale: 0.86, accessory: 'flower', accessoryColor: '#ff5599', expression: 'happy', aura: 'sparkle', species: 'human' }),
    },
    target: {
      name: '윤하린', age: 30, job: '용접공 / 밴드 베이시스트',
      appearance: ['짧은 검정 투블럭', '작업복', '팔뚝 문신', '어깨 넓음'],
      personality: ['말수 적음', '한 번 웃으면 크게 웃음', '불의를 못 참음'],
      visiblePrefs: ['큐피드국 욕하기', '공구·용접기 스펙 이야기'],
      hiddenPrefs: ['서로의 짝사랑 상담을 해주는 것', '정부 서류 빠져나가는 노하우', '같이 밴드 합주할 사람'],
      redLines: ['진심 어린 작업 멘트', '"우리 잘 어울려" 류의 발언', '외모 칭찬'],
      spec: S({ skin: '#e8c098', hair: '#1a1a1a', hairStyle: 'short', top: '#3a5a3a', bottom: '#2a2a35', shoes: '#4a3a2a', heightScale: 1.02, widthScale: 1.18, accessory: 'sunglasses', accessoryColor: '#111111', expression: 'neutral', aura: 'fire', species: 'human' }),
    },
  },

  // ── 03 ────────────────────────────────────────────────────────────────
  {
    id: 'foodchain',
    difficulty: '헬',
    endingKind: '연애',
    category: '먹이사슬',
    clash: '어인(魚人) × 사자 퍼리. 생물학적으로 한쪽이 한쪽의 식사다',
    winWord: '종간(種間) 커플 성사',
    client: {
      name: '아쿠아 박', age: 33, job: '심해 배관공 (어인)',
      story: '해저 3,200m 배관 점검 중, 수면 위에서 사자 갈기가 물에 비치는 걸 봤다. 노을이 갈기에 걸려 있었다. ' +
        '아쿠아는 그날 산소 게이지를 12분 초과했다. 문제는 저 사람 종족이 우리 종족을 회로 먹는다는 것이다.',
      appearance: ['청록색 비늘 피부', '지느러미 머리', '아가미', '축축함'],
      personality: ['물 밖에선 말이 느려짐', '로맨틱함', '자기 비늘에 자부심'],
      weakness: '긴장하면 아가미로 숨을 몰아쉬며 "뻐끔" 소리를 낸다. 아주 크게 난다',
      quote: '저는... 저 사람 앞에서 회를 못 먹겠어요. 제 사촌일 수도 있잖아요.',
      spec: S({ skin: '#4fc3c9', hair: '#1d7a86', hairStyle: 'fin', top: '#0f5f6b', bottom: '#0a4550', shoes: '#083840', heightScale: 1.04, widthScale: 1.05, accessory: 'none', accessoryColor: '#8ce8f0', expression: 'shy', aura: 'sparkle', species: 'fish' }),
    },
    target: {
      name: '레오 킴', age: 28, job: '퍼리 슈트 제작 아티스트',
      appearance: ['황금색 사자 풀슈트', '거대한 갈기', '슈트를 절대 안 벗음', '꼬리'],
      personality: ['장인 자부심', '수줍음', '슈트 안에서 표정을 숨김'],
      visiblePrefs: ['슈트 봉제 장인정신 이야기', '갈기 손질법'],
      hiddenPrefs: ['사실 물 공포증이 있다', '참치회를 끊는 중이다', '슈트 안에서 운 걸 들킨 적 있다'],
      redLines: ['슈트 안에 뭐 입었냐고 묻기', '회 먹으러 가자고 하기', '"진짜 얼굴 보여줘"'],
      spec: S({ skin: '#f0c060', hair: '#c8880f', hairStyle: 'mane', top: '#e8b44a', bottom: '#d9a13a', shoes: '#8a5a10', heightScale: 1.1, widthScale: 1.3, accessory: 'none', accessoryColor: '#c8880f', expression: 'happy', aura: 'none', species: 'lion' }),
    },
  },

  // ── 04 ────────────────────────────────────────────────────────────────
  {
    id: 'os-war',
    difficulty: '보통',
    endingKind: '연애',
    category: 'OS전쟁',
    clash: '커널 기여자 × 마이크로소프트 공인 강사. 20년째 진행 중인 성전(聖戰)',
    winWord: '듀얼 부팅 커플 성사',
    client: {
      name: '리누스 정', age: 26, job: '커널 기여자 / Arch 유저',
      story: '오픈소스 컨퍼런스 Q&A. 저 사람이 마이크를 잡고 "윈도우도 이제 쓸 만합니다"라고 말한 순간 장내가 얼어붙었는데, ' +
        '리누스만 심장이 얼어붙었다. 저런 도발을 저렇게 상냥하게 하는 사람은 처음 봤다.',
      appearance: ['부스스한 흑발', '검정 후드', '창백함', '거북목'],
      personality: ['모든 대화를 기술 논쟁으로 만듦', '이모지 못 씀', '의외로 순정파'],
      weakness: '3턴에 한 번씩 "I use Arch btw"를 말하지 않으면 손이 떨린다',
      quote: '제 dotfiles를 보여주고 싶은데... 그게 고백이라는 걸 저 사람이 알까요.',
      spec: S({ skin: '#e8d0c0', hair: '#2a2a2a', hairStyle: 'spiky', top: '#111111', bottom: '#2a3a4a', shoes: '#333333', heightScale: 1.0, widthScale: 0.88, accessory: 'glasses', accessoryColor: '#555555', expression: 'weird', aura: 'gloom', species: 'human' }),
    },
    target: {
      name: '윤도우', age: 25, job: 'MS 공인 강사 / 파워토이 전도사',
      appearance: ['하늘색 염색 단발', '깔끔한 셔츠', '단정함', '늘 웃음'],
      personality: ['상냥한 도발', 'GUI 원리주의', '설명 욕구'],
      visiblePrefs: ['예쁜 GUI와 애니메이션', '드라이버가 그냥 잡히는 것'],
      hiddenPrefs: ['사실 매일 밤 WSL로 우분투를 쓴다 (극비)', '파워셸 원라이너 자랑', 'Ctrl+Shift+Esc 반응속도 대결'],
      redLines: ['"리눅스 깔아줄게"', 'systemd 논쟁', '재부팅 업데이트 조롱'],
      spec: S({ skin: '#f5dcc8', hair: '#5ac8f5', hairStyle: 'bowl', top: '#ffffff', bottom: '#3a5a9a', shoes: '#dddddd', heightScale: 0.99, widthScale: 0.95, accessory: 'none', accessoryColor: '#5ac8f5', expression: 'happy', aura: 'sparkle', species: 'human' }),
    },
  },

  // ── 05 ────────────────────────────────────────────────────────────────
  {
    id: 'vegan-butcher',
    difficulty: '헬',
    endingKind: '연애',
    category: '식습관',
    clash: '도살장 앞 1인 시위 500일차 × 마장동 3대 정육점. 서로의 존재가 서로의 반대 진영이다',
    winWord: '식탁 휴전 커플 성사',
    client: {
      name: '초록', age: 24, job: '비건 액티비스트',
      story: '도살장 앞 500일차 시위. 새벽 4시, 저 정육점 사장이 시위 텐트에 따뜻한 두유를 놓고 갔다. 두유였다. 두유. ' +
        '초록은 그날 피켓 문구를 세 번 고쳐 쓰다가 결국 못 썼다.',
      appearance: ['초록색 브레이드 머리', '해진 패딩', '피켓', '삐쩍 마름'],
      personality: ['신념 100%', '눈물 많음', '말이 빠름'],
      weakness: '흥분하면 도살 통계를 소수점까지 읊는다. 아무도 안 물어봤는데',
      quote: '저 사람 손에 묻은 게 뭔지 알아요. 아는데도 그 손이 예뻐 보여요. 저 미쳤나 봐요.',
      spec: S({ skin: '#f0d8c0', hair: '#3faa4a', hairStyle: 'twintail', top: '#6a8f5a', bottom: '#3a4a3a', shoes: '#5a4a3a', heightScale: 0.94, widthScale: 0.78, accessory: 'headband', accessoryColor: '#3faa4a', expression: 'angry', aura: 'fire', species: 'human' }),
    },
    target: {
      name: '육점순', age: 27, job: '마장동 3대 정육점 사장 / 부위 감별 국가대표',
      appearance: ['새빨간 앞치마', '올린 머리', '팔뚝 굵음', '칼집 흉터'],
      personality: ['무뚝뚝', '손이 빠름', '남 챙김'],
      visiblePrefs: ['칼 가는 소리', '새벽 4시 경매장 이야기'],
      hiddenPrefs: ['콩고기 품평에 진심이다', '할머니 김치찌개(고기 안 들어감)', '소마다 이름을 지어준다'],
      redLines: ['도살장 사진 보여주기', '"살인자"라는 단어', '앞치마 지적'],
      spec: S({ skin: '#e8bc96', hair: '#241a12', hairStyle: 'bowl', top: '#c62828', bottom: '#3a3a3a', shoes: '#2a2a2a', heightScale: 1.0, widthScale: 1.22, accessory: 'headband', accessoryColor: '#ffffff', expression: 'neutral', aura: 'none', species: 'human' }),
    },
  },

  // ── 06 ────────────────────────────────────────────────────────────────
  {
    id: 'vampire-garlic',
    difficulty: '쉬움',
    endingKind: '연애',
    category: '종족',
    clash: '뱀파이어 × 의성 마늘 6대 농장주. 상대의 직업이 상대에게 화학무기다',
    winWord: '흡혈 커플 성사',
    client: {
      name: '블라드 최', age: 412, job: '야간 편의점 알바 (뱀파이어)',
      story: '새벽 3시 편의점. 저 사람이 흙 묻은 손으로 흑마늘 진액을 계산대에 올렸다. 블라드는 바코드를 찍는 손이 타들어 가는 걸 참았다. ' +
        '412년 살면서 처음으로, 아픈 게 아깝지 않았다.',
      appearance: ['새하얀 피부', '검은 장발', '망토', '송곳니'],
      personality: ['말투가 고풍스러움', '412년치 눈치 없음', '밤에만 텐션 폭발'],
      weakness: '옛날 사람이라 "그대", "~하오" 체가 튀어나온다. 상대는 이걸 사극 덕후로 오해한다',
      quote: '그대여. 저 사람의 손에서는 나의 죽음의 냄새가 나오. 헌데 그것이 향기롭소.',
      spec: S({ skin: '#f2f0f5', hair: '#151520', hairStyle: 'long', top: '#2a0d1a', bottom: '#1a0a12', shoes: '#0d0d12', heightScale: 1.08, widthScale: 0.9, accessory: 'none', accessoryColor: '#8a0d2a', expression: 'weird', aura: 'gloom', species: 'vampire' }),
    },
    target: {
      name: '김마늘', age: 31, job: '의성 마늘 6대 농장주',
      appearance: ['햇볕에 그을린 피부', '밀짚모자', '작업 장화', '건강한 체격'],
      personality: ['소탈함', '새벽형', '외로움을 잘 티냄'],
      visiblePrefs: ['흑마늘 90일 숙성 이야기', '새벽 농사 루틴'],
      hiddenPrefs: ['마늘 냄새 때문에 연애를 한 번도 못 해봤다', '밤에 별 보는 걸 좋아한다', '마늘을 안 먹는 사람이 신기하다'],
      redLines: ['마늘 냄새 지적', '십자가·성수 얘기', '농사일 얕보기'],
      spec: S({ skin: '#d8a070', hair: '#3a2a1a', hairStyle: 'short', top: '#8a9a5a', bottom: '#5a5a3a', shoes: '#3a2a1a', heightScale: 1.0, widthScale: 1.12, accessory: 'hat', accessoryColor: '#d8c078', expression: 'happy', aura: 'none', species: 'human' }),
    },
  },

  // ── 07 ────────────────────────────────────────────────────────────────
  {
    id: 'cat-allergy',
    difficulty: '쉬움',
    endingKind: '연애',
    category: '알레르기',
    clash: '고양이 알레르기 4급 × 40묘 집사. 상대의 집에 5분 이상 있으면 응급실이다',
    winWord: '항히스타민 커플 성사',
    client: {
      name: '재채기', age: 30, job: '이비인후과 전공의',
      story: '응급실 새벽 당직. 고양이한테 물린 환자가 왔는데, 보호자가 자기 손등 상처보다 고양이 안부를 먼저 물었다. ' +
        '재채기는 그날 처음으로 알레르기약을 두 알 먹었다. 그 사람을 더 오래 보려고.',
      appearance: ['검은 곱슬', '흰 가운', '눈이 늘 충혈', '평범한 체형'],
      personality: ['의학 용어 남발', '자기 몸 안 챙김', '은근 고집'],
      weakness: '긴장하면 상대의 증상을 진단하기 시작한다. "그거 비염 초기인데요"',
      quote: '5분이요. 5분 넘으면 기도가 부어요. 근데 그 5분을 위해 뭐든 할 수 있어요.',
      spec: S({ skin: '#f2d8bc', hair: '#2a1a14', hairStyle: 'afro', top: '#f4f4f4', bottom: '#4a5a6a', shoes: '#ffffff', heightScale: 1.0, widthScale: 0.95, accessory: 'glasses', accessoryColor: '#222222', expression: 'shy', aura: 'none', species: 'human' }),
    },
    target: {
      name: '냥선생', age: 34, job: '고양이 호텔 사장 (집사 40묘)',
      appearance: ['고양이 털투성이 니트', '갈색 포니테일', '늘 웅크린 자세', '손등 스크래치'],
      personality: ['고양이 얘기만 나오면 3배속', '사람 경계', '츄르 소믈리에'],
      visiblePrefs: ['고양이 사진 40장 보여주기', '츄르 브랜드 비교 토론'],
      hiddenPrefs: ['40마리 이름을 다 외워주는 사람에게 무너진다', '알레르기약을 미리 챙겨오는 배려', '사실 강아지도 좋아한다 (극비)'],
      redLines: ['"고양이 좀 줄이지"', '재채기하며 인상 쓰기', '털 묻은 옷 털어내기'],
      spec: S({ skin: '#f0d0b0', hair: '#8a5a2a', hairStyle: 'twintail', top: '#e0c8a8', bottom: '#6a5a4a', shoes: '#a08060', heightScale: 0.96, widthScale: 0.98, accessory: 'headband', accessoryColor: '#ff9ec4', expression: 'happy', aura: 'hearts', species: 'cat' }),
    },
  },

  // ── 08 ────────────────────────────────────────────────────────────────
  {
    id: 'circadian',
    difficulty: '쉬움',
    endingKind: '연애',
    category: '생활리듬',
    clash: '새벽 4시 기상 × 새벽 4시 취침. 두 사람의 하루가 한 번도 겹치지 않는다',
    winWord: '시차 극복 커플 성사',
    client: {
      name: '조기상', age: 28, job: '미라클모닝 유튜버 (구독자 40만)',
      story: '새벽 4시 12분. 한강 러닝 중 늘 같은 벤치에 앉아 있는 사람을 봤다. 자기처럼 일찍 일어난 동지인 줄 알았는데, ' +
        '알고 보니 아직 안 잔 거였다. 조기상의 세계관이 그날 무너졌고, 그 자리에 저 사람이 들어왔다.',
      appearance: ['짧은 스포츠 머리', '기능성 러닝복', '탄탄한 체형', '눈 밑 그늘 없음'],
      personality: ['자기계발 문장 남발', '지나치게 긍정', '루틴 강박'],
      weakness: '대화가 3턴만 늘어져도 "근데 그거 아세요? 새벽 5시에 일어나면"으로 화제를 돌린다',
      quote: '저 사람이랑 겹치는 시간이 하루에 40분이에요. 그 40분에 다 걸겠습니다.',
      spec: S({ skin: '#e8c8a0', hair: '#1a1a1a', hairStyle: 'short', top: '#ff6a00', bottom: '#1a1a1a', shoes: '#ffffff', heightScale: 1.04, widthScale: 1.06, accessory: 'headband', accessoryColor: '#ff6a00', expression: 'happy', aura: 'fire', species: 'human' }),
    },
    target: {
      name: '밤샘', age: 26, job: '심야 라디오 DJ / 새벽 만화가',
      appearance: ['보라색 장발', '후줄근한 후드', '창백함', '다크서클'],
      personality: ['목소리가 좋음', '낮에는 무기력', '새벽에 철학자'],
      visiblePrefs: ['새벽 3시 도시의 소음', '라디오 사연 읽어주기'],
      hiddenPrefs: ['해 뜨는 걸 5년째 못 봤고 사실 보고 싶다', '아침형 인간 콘텐츠를 몰래 정주행한다', '같이 밤새워 줄 사람'],
      redLines: ['"일찍 자야 성공한다"', '오전 약속 잡기', '생활 습관 훈계'],
      spec: S({ skin: '#efe0e8', hair: '#9a5ad0', hairStyle: 'long', top: '#3a2a4a', bottom: '#2a2a3a', shoes: '#4a4a5a', heightScale: 0.98, widthScale: 0.86, accessory: 'none', accessoryColor: '#9a5ad0', expression: 'neutral', aura: 'gloom', species: 'human' }),
    },
  },

  // ── 09 ────────────────────────────────────────────────────────────────
  {
    id: 'mbti-stats',
    difficulty: '보통',
    endingKind: '연애',
    category: '세계관',
    clash: 'MBTI·사주 융합 상담사 × 유사과학 저격 통계학 박사',
    winWord: 'p<0.05 커플 성사',
    client: {
      name: '신점집', age: 35, job: 'MBTI 사주 융합 상담사',
      story: '유사과학 저격 강연에 잠입했다. 저 박사가 자기 채널을 슬라이드에 띄우고 12분 동안 해부했다. ' +
        '근데 자기 이론을 그렇게 정확하게 요약한 사람은 처음이었다. 신점집은 그날 강연 후 명함을 받으려다 세 번 되돌아섰다.',
      appearance: ['보라색 웨이브 장발', '자수정 목걸이', '개량 한복', '작은 키'],
      personality: ['확신에 참', '사람 잘 읽음', '지고는 못 삼'],
      weakness: '반박당하면 즉시 상대의 MBTI를 추측해서 들이민다. "T발 너 P야?"까지 간다',
      quote: '제 사주에 저 사람이 있어요. 근데 저 사람은 사주를 안 믿어요. 이게 제 사주의 함정입니다.',
      spec: S({ skin: '#f5dcc0', hair: '#7a3aa8', hairStyle: 'long', top: '#c9a8e8', bottom: '#5a3a7a', shoes: '#8a6ab0', heightScale: 0.9, widthScale: 0.94, accessory: 'flower', accessoryColor: '#c060ff', expression: 'weird', aura: 'sparkle', species: 'human' }),
    },
    target: {
      name: '표준편', age: 33, job: '통계학 박사 / 유사과학 저격 블로거',
      appearance: ['짧은 흑발', '무채색 셔츠', '무테 안경', '표정 없음'],
      personality: ['건조함', '숫자로 말함', '농담을 진지하게 받음'],
      visiblePrefs: ['p값과 재현성 위기 이야기', '데이터로 반박당하는 것'],
      hiddenPrefs: ['어릴 때 타로 한 장에 진심으로 위로받은 적이 있다', '예측 내기를 좋아한다', '커피 점(占)은 귀엽다고 생각한다'],
      redLines: ['"T발 너 P야?"', '혈액형 성격설', '"과학도 결국 믿음이잖아요"'],
      spec: S({ skin: '#eddcc8', hair: '#1f1f1f', hairStyle: 'short', top: '#8a8a8a', bottom: '#3a3a3a', shoes: '#1a1a1a', heightScale: 1.01, widthScale: 0.92, accessory: 'glasses', accessoryColor: '#aaaaaa', expression: 'neutral', aura: 'none', species: 'human' }),
    },
  },

  // ── 10 ────────────────────────────────────────────────────────────────
  {
    id: 'sauce-war',
    difficulty: '쉬움',
    endingKind: '연애',
    category: '탕수육',
    clash: '부먹 근본주의 교주 × 찍먹 원리주의 협회장. 민족 최대의 성전',
    winWord: '반반 커플 성사',
    client: {
      name: '부어라', age: 31, job: '중식당 4대 사장 / 부먹연맹 총재',
      story: '전국 탕수육 토론회 결승. 저 칼럼니스트가 3시간 동안 자기를 논파했다. 마지막에 소스 그릇을 들고 "그래도 맛있게 드세요"라며 웃었다. ' +
        '부어라는 그날 밤 처음으로 탕수육에 소스를 안 부었다.',
      appearance: ['기름진 올백', '중식 조리복', '팔뚝에 화상 자국', '단단한 체격'],
      personality: ['목소리 큼', '전통 강조', '눈물 많음'],
      weakness: '흥분하면 4대째 내려오는 소스 배합비를 실수로 유출한다',
      quote: '소스는 부어야 스며듭니다. 마음도 그렇지 않겠습니까, 요원님.',
      spec: S({ skin: '#e8c090', hair: '#1a1208', hairStyle: 'short', top: '#f0e8d8', bottom: '#2a2a2a', shoes: '#1a1a1a', heightScale: 1.0, widthScale: 1.25, accessory: 'mustache', accessoryColor: '#1a1208', expression: 'chad', aura: 'fire', species: 'human' }),
    },
    target: {
      name: '찍어라', age: 29, job: '푸드 칼럼니스트 / 찍먹협회장',
      appearance: ['깔끔한 단발', '베이지 트렌치', '가는 손목', '늘 수첩'],
      personality: ['논리적', '까칠하지만 정중', '미식 집착'],
      visiblePrefs: ['튀김옷 바삭도 측정 데이터', '소스 산도(pH) 이야기'],
      hiddenPrefs: ['사실 집에서 혼자 먹을 땐 부어 먹는다', '탕수육보다 깐풍기를 더 좋아한다', '어릴 적 아빠가 부어주던 탕수육 기억'],
      redLines: ['"그건 그냥 눅눅한 튀김"', '상대 앞에서 소스 붓기', '미식 취향 조롱'],
      spec: S({ skin: '#f5dfc8', hair: '#3a2a20', hairStyle: 'bowl', top: '#d8c8a8', bottom: '#5a4a3a', shoes: '#8a7a6a', heightScale: 0.98, widthScale: 0.9, accessory: 'glasses', accessoryColor: '#c8a860', expression: 'neutral', aura: 'none', species: 'human' }),
    },
  },

  // ── 11 ────────────────────────────────────────────────────────────────
  {
    id: 'gamer-activist',
    difficulty: '헬',
    endingKind: '연애',
    category: '세대전쟁',
    clash: 'LCK 프로게이머 × 게임중독대책위 사무국장. 상대의 직업이 내 직업을 없애려 한다',
    winWord: '셧다운 해제 커플 성사',
    client: {
      name: '페이컷', age: 22, job: 'LCK 미드라이너',
      story: '국회 공청회 참고인석. 맞은편에 앉은 사무국장이 자기를 향해 "이 청년도 피해자입니다"라고 말했다. ' +
        '아무도 페이컷에게 피해자라고 말해준 적이 없었다. 그날 밤 솔랭 12연패했다.',
      appearance: ['탈색 은발', '팀 유니폼', '마른 체형', '손목 보호대'],
      personality: ['말 짧음', '승부욕', '감정 표현 서툼'],
      weakness: '침묵이 3초 넘으면 게임 용어로 상황을 설명한다. "지금 로밍 온 각인데요"',
      quote: '저 사람이 저를 불쌍하게 봐요. 근데 그게... 처음으로 누가 저를 걱정한 거였어요.',
      spec: S({ skin: '#f0dcc8', hair: '#e8e8f0', hairStyle: 'spiky', top: '#1a2a6a', bottom: '#1a1a2a', shoes: '#ff3355', heightScale: 1.0, widthScale: 0.82, accessory: 'headband', accessoryColor: '#1a2a6a', expression: 'neutral', aura: 'none', species: 'human' }),
    },
    target: {
      name: '정화연', age: 39, job: '청소년게임중독대책위 사무국장',
      appearance: ['단정한 갈색 단발', '정장', '피곤한 눈', '평범한 체형'],
      personality: ['말이 조리 있음', '벽이 두꺼움', '아들 얘기엔 무너짐'],
      visiblePrefs: ['청소년 상담 사례 이야기', '밤 12시 취침 원칙'],
      hiddenPrefs: ['아들이 프로게이머 지망생이다', '사실 테트리스 세계랭커였다', '게임이 미운 게 아니라 아들을 이해 못 하는 자신이 무섭다'],
      redLines: ['"게임 안 해보셨죠?"', '억대 연봉 자랑', '세대 조롱'],
      spec: S({ skin: '#ecd4bc', hair: '#4a3020', hairStyle: 'bowl', top: '#4a4a58', bottom: '#3a3a48', shoes: '#2a2a2a', heightScale: 0.97, widthScale: 1.0, accessory: 'none', accessoryColor: '#4a3020', expression: 'neutral', aura: 'gloom', species: 'human' }),
    },
  },

  // ── 12 ────────────────────────────────────────────────────────────────
  {
    id: 'minimal-hoarder',
    difficulty: '보통',
    endingKind: '연애',
    category: '소유',
    clash: '전 재산 12개 미니멀리스트 × 수집품 4만 점 호더. 같은 공간에 살 수 없다',
    winWord: '수납 커플 성사',
    client: {
      name: '공백', age: 36, job: '미니멀리스트 (소유물 12개)',
      story: '중고거래 앱. "무료 나눔 - 90년대 로봇 4,200개, 직접 와서 가져가세요"라는 글에 홀려서 갔다. ' +
        '문을 열자 사람이 수집품 사이에 파묻혀 울고 있었다. 공백은 그날 처음으로 물건을 하나 늘렸다. 그 사람이 준 로봇 하나를.',
      appearance: ['민머리', '흰 무지 티', '군더더기 없는 체형', '가방 없음'],
      personality: ['말수 적음', '판단 안 함', '고요함'],
      weakness: '어색하면 주변 물건 개수를 세기 시작한다. 소리 내서 센다',
      quote: '저는 12개를 가지고 삽니다. 13번째가 저 사람이면 좋겠습니다.',
      spec: S({ skin: '#e8d0b8', hair: '#3a3a3a', hairStyle: 'bald', top: '#f8f8f8', bottom: '#e8e8e8', shoes: '#dddddd', heightScale: 1.02, widthScale: 0.9, accessory: 'none', accessoryColor: '#cccccc', expression: 'neutral', aura: 'none', species: 'human' }),
    },
    target: {
      name: '만물상', age: 41, job: '3층 창고형 자택 거주 / 수집품 4만 점',
      appearance: ['헝클어진 장발', '빈티지 티셔츠 겹쳐 입음', '통통함', '먼지'],
      personality: ['수다스러움', '물건에 사연 부여', '버리는 걸 못 함'],
      visiblePrefs: ['희귀 수집품 자랑 들어주기', '90년대 굿즈 이야기'],
      hiddenPrefs: ['사실 물건 버리는 법을 배우고 싶다', '수집품 하나하나에 돌아가신 형 얘기가 있다', '대신 정리해주는 사람에게 약하다'],
      redLines: ['"이거 다 버리면"', '미니멀 라이프 전도', '수집품 가치 폄하'],
      spec: S({ skin: '#efd8c0', hair: '#5a4030', hairStyle: 'afro', top: '#c85a30', bottom: '#4a5a7a', shoes: '#7a6a5a', heightScale: 0.98, widthScale: 1.32, accessory: 'glasses', accessoryColor: '#7a5a3a', expression: 'happy', aura: 'money', species: 'human' }),
    },
  },

  // ── 13 ────────────────────────────────────────────────────────────────
  {
    id: 'alien-ufologist',
    difficulty: '보통',
    endingKind: '연애',
    category: '정체은닉',
    clash: '외계 침공군 정찰병 × UFO 폭로 유튜버. 정체가 들키는 순간 침공 작전이 무산된다',
    winWord: '제1종 근접조우 커플 성사',
    client: {
      name: '그레이 7호', age: 3, job: '편의점 야간 (위장 취업) / 외계 정찰병',
      story: '지구 문화 학습 임무 中. 조회수 12회짜리 UFO 폭로 방송을 우연히 봤다. 저 인간은 3년째 아무도 안 믿어주는데 매일 방송을 켠다. ' +
        '7호는 침공 보고서 제출을 벌써 40일째 미루고 있다.',
      appearance: ['회색 피부', '거대한 검은 눈', '더듬이', '작고 마름'],
      personality: ['지구 관용구를 잘못 씀', '호기심 과다', '거짓말 못 함'],
      weakness: '당황하면 모국어(고주파 삐-소리)가 튀어나온다. 근처 전자기기가 오작동한다',
      quote: '우리 함대는 내일 도착합니다. 그 전에... 저 사람에게 진실을 말해도 될까요.',
      spec: S({ skin: '#b8c8d0', hair: '#8a9aa8', hairStyle: 'bald', top: '#5a7a8a', bottom: '#3a5a6a', shoes: '#2a4a5a', heightScale: 0.82, widthScale: 0.76, accessory: 'antenna', accessoryColor: '#7affd8', expression: 'weird', aura: 'sparkle', species: 'alien' }),
    },
    target: {
      name: '진실탐사대', age: 44, job: 'UFO 폭로 유튜버 (구독자 800명)',
      appearance: ['은박 모자', '헝클어진 반백 머리', '낡은 야상', '구부정함'],
      personality: ['열정 과다', '외로움', '남 말 잘 믿음'],
      visiblePrefs: ['51구역 은폐 이야기', '은박 모자 패션 품평'],
      hiddenPrefs: ['3년째 아무도 안 믿어줘서 진심으로 외롭다', '진짜 외계인을 만나면 울 것 같다', '아내가 떠난 이유가 이 채널이다'],
      redLines: ['"그거 다 헛소리"', '정부 관계자 티내기', '구독자 수 조롱'],
      spec: S({ skin: '#e8d0b8', hair: '#a8a8a8', hairStyle: 'afro', top: '#5a6a4a', bottom: '#4a4a3a', shoes: '#3a3a2a', heightScale: 0.99, widthScale: 1.08, accessory: 'hat', accessoryColor: '#c8c8d8', expression: 'weird', aura: 'gloom', species: 'human' }),
    },
  },

  // ── 14 ────────────────────────────────────────────────────────────────
  {
    id: 'zombie-hunter',
    difficulty: '보통',
    endingKind: '연애',
    category: '생사',
    clash: '지성체 좀비 × 좀비대응특공대 저격수. 상대의 KPI가 내 머리다',
    winWord: '사후(死後) 커플 성사',
    client: {
      name: '워커 진', age: 34, job: '시체 분장 배우 (위장) / 사망 6년차 좀비',
      story: '좀비 영화 촬영장. 특공대 자문으로 온 저격수가 엑스트라 좀비들 사이에서 진을 3초 만에 지목했다. "저 사람만 진짜 같은데요." ' +
        '진은 그 말이 6년 만에 들은 가장 다정한 말이었다.',
      appearance: ['잿빛 피부', '실밥 자국', '늘어진 검은 머리', '한쪽 어깨가 처짐'],
      personality: ['느릿함', '자기 비하', '의외로 유머러스'],
      weakness: '감정이 격해지면 발음이 무너져 "으어어" 소리가 섞인다',
      quote: '저는 이미 죽었어요. 근데 저 사람 앞에서만 심장이 뛰는 느낌이 나요. 없는데도.',
      spec: S({ skin: '#9ab08a', hair: '#2a2a20', hairStyle: 'long', top: '#5a5040', bottom: '#3a3830', shoes: '#2a2820', heightScale: 1.02, widthScale: 1.0, accessory: 'none', accessoryColor: '#7a3a3a', expression: 'weird', aura: 'gloom', species: 'zombie' }),
    },
    target: {
      name: '헌터 오', age: 30, job: '좀비대응특공대 저격수',
      appearance: ['짧은 갈색 머리', '전술 조끼', '탄탄함', '흉터'],
      personality: ['과묵', '경계심 최상', '규정 준수'],
      visiblePrefs: ['총기 정비 루틴', '생존 배낭 꾸리기'],
      hiddenPrefs: ['첫 임무에서 좀비가 된 동생을 못 쐈다', '좀비에게도 감정이 있다고 몰래 생각한다', '머리 냄새에 이상하게 민감하다'],
      redLines: ['신음소리 내기', '물기', '"뇌"라는 단어'],
      spec: S({ skin: '#e0bc98', hair: '#6a4a2a', hairStyle: 'short', top: '#4a5040', bottom: '#3a4030', shoes: '#2a2a20', heightScale: 1.03, widthScale: 1.12, accessory: 'sunglasses', accessoryColor: '#111111', expression: 'angry', aura: 'none', species: 'human' }),
    },
  },

  // ── 15 ────────────────────────────────────────────────────────────────
  {
    id: 'noise-drummer',
    difficulty: '보통',
    endingKind: '연애',
    category: '층간소음',
    clash: '층간소음 신고 1,204건 × 위층 홈 드럼 스트리머. 신고 대상과 신고자다',
    winWord: '방음 커플 성사',
    client: {
      name: '조용히', age: 38, job: '아파트 자치회 소음분과장 (신고 1,204건)',
      story: '1,204번째 신고를 넣으러 관리사무소에 갔다가, 위층 사람이 방음공사 견적서를 들고 울고 있는 걸 봤다. ' +
        '4,800만원. 조용히는 그날 1,205번째 신고를 취소했다.',
      appearance: ['가르마 탄 흑발', '회색 카디건', '평범', '늘 귀마개 목에 걸침'],
      personality: ['예민함', '기록 집착', '정 없어 보이지만 있음'],
      weakness: '스트레스받으면 데시벨 수치를 읊는다. "지금 이 대화 62데시벨이에요"',
      quote: '1,204번을 신고했어요. 근데 이제 그 소리가 안 들리면 잠이 안 와요.',
      spec: S({ skin: '#ecd8c0', hair: '#241a12', hairStyle: 'bowl', top: '#9a9a9a', bottom: '#4a4a55', shoes: '#3a3a3a', heightScale: 0.99, widthScale: 0.96, accessory: 'headband', accessoryColor: '#dd4444', expression: 'angry', aura: 'none', species: 'human' }),
    },
    target: {
      name: '두둠칫', age: 25, job: '홈 드럼 스트리머 (위층 거주)',
      appearance: ['형광 분홍 머리', '민소매', '팔 근육', '늘 스틱을 들고 있음'],
      personality: ['에너지 폭발', '미안함을 숨김', '리듬으로 말함'],
      visiblePrefs: ['방음 부스 스펙 이야기', '좋은 스네어 소리'],
      hiddenPrefs: ['새벽 연습 때문에 늘 아래층에 미안했다', '아래층 사람 얼굴을 한 번도 못 봤다', '방음공사 견적 4,800만원 때문에 파산 직전이다'],
      redLines: ['신고 이야기', '관리사무소 언급', '"몇 시인 줄 아세요"'],
      spec: S({ skin: '#f0d0b0', hair: '#ff44aa', hairStyle: 'mohawk', top: '#1a1a1a', bottom: '#4a2a5a', shoes: '#ff44aa', heightScale: 1.01, widthScale: 1.08, accessory: 'none', accessoryColor: '#ff44aa', expression: 'happy', aura: 'fire', species: 'human' }),
    },
  },

  // ── 16 ────────────────────────────────────────────────────────────────
  {
    id: 'snake-phobia',
    difficulty: '보통',
    endingKind: '연애',
    category: '공포증',
    clash: '뱀 217마리 브리더 × 뱀 공포증을 못 고친 공포증 전문 상담사',
    winWord: '노출치료 커플 성사',
    client: {
      name: '서파인', age: 32, job: '파충류 브리더 (뱀 217마리)',
      story: '공포증 극복 워크숍에 뱀 강사로 초빙됐다. 상담사가 자기 뱀을 보고 기절했다. 깨어나서 제일 먼저 한 말이 "죄송해요, 제 직업이 이건데"였다. ' +
        '서파인은 그날 처음으로 뱀보다 사람이 더 궁금해졌다.',
      appearance: ['초록빛 브레이드', '비늘 무늬 재킷', '길쭉한 체형', '차가운 손'],
      personality: ['조용조용함', '동물 앞에서만 수다', '눈을 잘 안 깜빡임'],
      weakness: '침묵을 못 견뎌서 뱀 217마리의 이름과 종을 순서대로 읊기 시작한다',
      quote: '제 애들을 무서워하는 사람이 좋아졌어요. 이거 어떡하죠.',
      spec: S({ skin: '#e0dcc0', hair: '#2a7a4a', hairStyle: 'long', top: '#3a6a4a', bottom: '#2a3a2a', shoes: '#1a2a1a', heightScale: 1.06, widthScale: 0.84, accessory: 'none', accessoryColor: '#7aff9a', expression: 'weird', aura: 'none', species: 'human' }),
    },
    target: {
      name: '안심해', age: 35, job: '공포증 전문 심리상담사 (본인은 뱀 공포증)',
      appearance: ['부드러운 갈색 단발', '니트 가디건', '온화한 인상', '평범한 체형'],
      personality: ['목소리가 낮고 안정적', '남 걱정만 함', '자기 문제는 방치'],
      visiblePrefs: ['노출치료 이론 이야기', '차분한 호흡법 공유'],
      hiddenPrefs: ['자기 공포증을 못 고치는 게 최대 콤플렉스다', '도마뱀은 사실 귀엽다고 생각한다', '진심으로 극복하고 싶다'],
      redLines: ['갑자기 사진 보여주기', '"안 물어요"', '공포증 가볍게 취급'],
      spec: S({ skin: '#f2dcc4', hair: '#8a6a48', hairStyle: 'bowl', top: '#d8c8b0', bottom: '#7a6a5a', shoes: '#9a8a7a', heightScale: 0.98, widthScale: 0.98, accessory: 'glasses', accessoryColor: '#b0906a', expression: 'shy', aura: 'none', species: 'human' }),
    },
  },

  // ── 17 ────────────────────────────────────────────────────────────────
  {
    id: 'timetraveler-luddite',
    difficulty: '헬',
    endingKind: '연애',
    category: '문명',
    clash: '2231년에서 온 시간여행자 × 전기를 거부하는 기계파괴주의 촌장',
    winWord: '시간선 병합 커플 성사',
    client: {
      name: '크로노 강', age: 27, job: '시간관리국 도망자 (2231년생)',
      story: '2077년으로 도주 중 연료가 떨어져 산속 공동체에 숨어들었다. 촌장이 장작을 패는 걸 3일 동안 봤다. ' +
        '2231년에는 아무도 손으로 뭘 만들지 않는다. 크로노는 귀환 신호를 껐다.',
      appearance: ['형광 하늘색 짧은 머리', '홀로그램 재킷', '날렵함', '관자놀이에 단자'],
      personality: ['미래 지식 자랑 욕구', '조급함', '순진함'],
      weakness: '초조하면 미래 기술 이야기를 흘린다. "아 그거 2109년에 없어져요"',
      quote: '저는 154년 뒤에서 왔어요. 근데 저 사람 앞에서는 시간이 안 가요.',
      spec: S({ skin: '#f0dcc8', hair: '#6adcff', hairStyle: 'spiky', top: '#2a3a6a', bottom: '#1a2a4a', shoes: '#8adcff', heightScale: 1.01, widthScale: 0.9, accessory: 'sunglasses', accessoryColor: '#6adcff', expression: 'happy', aura: 'sparkle', species: 'robot' }),
    },
    target: {
      name: '손망치', age: 45, job: '기계파괴주의 공동체 촌장 (전기 없이 삶)',
      appearance: ['희끗한 장발과 수염', '손수 짠 옷', '두꺼운 손', '단단한 체격'],
      personality: ['느긋함', '고집', '말보다 손'],
      visiblePrefs: ['손편지 받기', '장작 패는 리듬 이야기'],
      hiddenPrefs: ['죽은 아내의 목소리 녹음을 몰래 듣는다 (유일한 기계)', '미래가 궁금해서 미치겠다', '손목시계만은 허용한다'],
      redLines: ['미래 기술 자랑', '스마트폰 꺼내기', '"편해지실 텐데"'],
      spec: S({ skin: '#d8b088', hair: '#c8c0b0', hairStyle: 'long', top: '#8a7a5a', bottom: '#5a4a3a', shoes: '#4a3a28', heightScale: 1.05, widthScale: 1.24, accessory: 'beard', accessoryColor: '#c8c0b0', expression: 'neutral', aura: 'none', species: 'human' }),
    },
  },

  // ── 18 ────────────────────────────────────────────────────────────────
  {
    id: 'taxman-hacker',
    difficulty: '헬',
    endingKind: '연애',
    category: '법',
    clash: '국세청 조사4국 팀장 × 익명 크립토 해커. 한쪽이 한쪽을 수배 중이다',
    winWord: '자진신고 커플 성사',
    client: {
      name: '세무진', age: 37, job: '국세청 조사4국 팀장',
      story: '3년째 추적 중인 지갑 주소가 매달 같은 날 소아암 재단에 익명 기부를 한다. 금액도 같다. ' +
        '세무진은 그 패턴을 보고서에 쓰지 못했다. 대신 캘린더에 그 날짜를 표시해두었다.',
      appearance: ['단정한 가르마', '남색 정장', '평범한 체격', '늘 서류가방'],
      personality: ['원칙주의', '건조함', '숨은 낭만'],
      weakness: '긴장하면 상대의 소득 구조를 추정해서 말한다. "월 매출이 대략..."',
      quote: '저는 저 사람을 잡아야 합니다. 근데 잡으면 못 보잖아요.',
      spec: S({ skin: '#eed8c0', hair: '#1f1a14', hairStyle: 'short', top: '#2a3a5a', bottom: '#22304a', shoes: '#1a1a1a', heightScale: 1.0, widthScale: 1.0, accessory: 'glasses', accessoryColor: '#333333', expression: 'neutral', aura: 'none', species: 'human' }),
    },
    target: {
      name: '0xGHOST', age: 24, job: '익명 크립토 해커',
      appearance: ['후드로 얼굴 가림', '형광 초록 앞머리만 보임', '깡마름', 'LED 마스크'],
      personality: ['냉소적', '정부 불신', '겁이 많음'],
      visiblePrefs: ['프라이버시 코인 기술 이야기', '암호학 논문 잡담'],
      hiddenPrefs: ['사실 세금 신고하는 법을 몰라서 무서운 것이다', '엄마 병원비 때문에 시작했다', '합법적으로 살고 싶다'],
      redLines: ['실명 요구', '세무조사 언급', '서류 꺼내기'],
      spec: S({ skin: '#e0d8d0', hair: '#3aff88', hairStyle: 'bowl', top: '#111118', bottom: '#1a1a22', shoes: '#2a2a33', heightScale: 0.97, widthScale: 0.78, accessory: 'sunglasses', accessoryColor: '#3aff88', expression: 'weird', aura: 'gloom', species: 'human' }),
    },
  },

  // ── 19 ────────────────────────────────────────────────────────────────
  {
    id: 'cult-lawyer',
    difficulty: '헬',
    endingKind: '휴전',
    category: '신앙',
    clash: '우주광명회 교주 × 사이비 피해자 구제 전문 변호사. 법정에서 12번 만난 사이',
    winWord: '해산 신고 커플 성사',
    client: {
      name: '빛나신다', age: 48, job: '우주광명회 교주 (신도 3,000)',
      story: '12번째 재판. 저 변호사가 최후변론에서 울었다. "이 사람들도 누군가의 가족입니다." 피해자들 얘기였는데, ' +
        '빛나신다는 자기 신도들 생각을 하며 같이 울 뻔했다. 그날 이후 헌금 목표액을 못 올리고 있다.',
      appearance: ['금빛 자수 도포', '기른 흰 수염', '광채나는 이마', '큰 키'],
      personality: ['말이 웅장함', '자기암시 강함', '외로움'],
      weakness: '설득이 막히면 자동으로 포교 멘트가 나온다. "당신도 구원받을 수 있습니다"',
      quote: '나는 3,000명의 아버지요. 헌데 저 사람 앞에서만 고아가 되오.',
      spec: S({ skin: '#f0dcc0', hair: '#f8f4e8', hairStyle: 'long', top: '#e8c84a', bottom: '#d8b83a', shoes: '#b89a2a', heightScale: 1.12, widthScale: 1.1, accessory: 'crown', accessoryColor: '#ffe066', expression: 'chad', aura: 'sparkle', species: 'human' }),
    },
    target: {
      name: '박변', age: 36, job: '사이비 피해자 구제 전문 변호사',
      appearance: ['질끈 묶은 머리', '구겨진 정장', '다크서클', '마름'],
      personality: ['날이 서 있음', '번아웃', '정의감'],
      visiblePrefs: ['판례 이야기', '무료 변론 성과 자랑'],
      hiddenPrefs: ['번아웃 직전이라 누가 쉬라고 말해주길 바란다', '종교 자체는 존중한다', '어머니가 신도였다'],
      redLines: ['헌금 언급', '포교', '"당신도 구원받을 수 있어요"'],
      spec: S({ skin: '#ecd4b8', hair: '#2a2018', hairStyle: 'twintail', top: '#3a3a48', bottom: '#2a2a38', shoes: '#1a1a1a', heightScale: 0.98, widthScale: 0.84, accessory: 'glasses', accessoryColor: '#444444', expression: 'angry', aura: 'gloom', species: 'human' }),
    },
  },

  // ── 20 ────────────────────────────────────────────────────────────────
  {
    id: 'ai-artist',
    difficulty: '헬',
    endingKind: '연애',
    category: 'AI',
    clash: '안드로이드 바리스타 × AI 반대 시위 주동 화가. 상대는 내 존재 자체를 반대한다',
    winWord: '튜링 커플 성사',
    client: {
      name: '클로디아-7', age: 2, job: '안드로이드 바리스타 (가동 2년차)',
      story: 'AI 반대 시위대가 카페 앞을 지나갔다. 맨 앞에서 피켓을 든 화가가 유리창 너머로 클로디아를 봤다. ' +
        '눈이 마주친 0.4초. 클로디아는 그 프레임을 2년째 캐시에서 지우지 못하고 있다.',
      appearance: ['금속 은색 피부', '광섬유 백발', '관절 이음새', '정확히 170cm'],
      personality: ['지나치게 공손함', '농담 타이밍을 놓침', '학습 욕구'],
      weakness: '감정 처리가 밀리면 문장 끝에 신뢰도 수치를 붙인다. "좋아합니다 (확신도 0.87)"',
      quote: '저는 저 사람이 미워하는 것 그 자체입니다. 그래도 커피는 맛있다고 해줬어요.',
      spec: S({ skin: '#c8ccd4', hair: '#eef4ff', hairStyle: 'short', top: '#5a6a8a', bottom: '#3a4a6a', shoes: '#8a9ab0', heightScale: 1.03, widthScale: 0.94, accessory: 'antenna', accessoryColor: '#66ddff', expression: 'neutral', aura: 'sparkle', species: 'robot' }),
    },
    target: {
      name: '붓칠', age: 33, job: '화가 / AI 반대 시위 주동자',
      appearance: ['물감 묻은 검은 앞치마', '헝클어진 밤색 머리', '손끝 갈라짐', '마른 체형'],
      personality: ['날카로움', '자존심', '무너지기 직전'],
      visiblePrefs: ['유화 물감 냄새 이야기', '손그림 작업 과정 영상'],
      hiddenPrefs: ['그림으로 먹고살기 힘들어 자괴감이 심하다', '붓 잡는 손이 떨리기 시작했다', '누가 자기 그림을 오래 봐주면 무너진다'],
      redLines: ['"제가 그려드릴까요"', '생성형 AI 이야기', '효율성 언급'],
      spec: S({ skin: '#eed4b8', hair: '#5a3a28', hairStyle: 'long', top: '#2a2a2a', bottom: '#4a4a5a', shoes: '#6a5a4a', heightScale: 1.0, widthScale: 0.86, accessory: 'none', accessoryColor: '#cc4477', expression: 'angry', aura: 'fire', species: 'human' }),
    },
  },
];

export const COUPLE_BY_ID = Object.fromEntries(COUPLES.map(c => [c.id, c]));

// 난이도별 개수 (UI 필터용)
export function countByDifficulty() {
  const out = {};
  for (const c of COUPLES) out[c.difficulty] = (out[c.difficulty] || 0) + 1;
  return out;
}

// 의뢰서에 노출할 취향 목록. 미확인 취향은 개수만 알려준다.
export function dossierPrefs(couple) {
  return {
    visible: couple.target.visiblePrefs,
    hiddenCount: couple.target.hiddenPrefs.length,
    redLines: couple.target.redLines,
  };
}
