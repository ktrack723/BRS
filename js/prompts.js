// prompts.js — 모든 LLM 프롬프트 / JSON 스키마 ("카트리지")
// 게임의 콘텐츠와 판정은 전부 여기 정의된 프롬프트를 통해 생성된다.

export const WORLD = `[세계관]
때는 2077년. 남녀 오타쿠들이 국가를 접수한 뒤 출산율은 0.008이 되었다.
테크노킹 도람푸 3세의 특명으로 미연방 비밀기관 "큐피드국(局)"이 창설되었다.
큐피드국의 임무: 연애 경험 0인 국민(클라이언트)이 짝사랑 상대에게 고백하도록 공작하는 것.
플레이어는 큐피드국의 신입 공작요원이다. 톤은 진지한 첩보물 말투 + 병맛 개그의 조합.
전체적으로 B급 감성, 과장, 밈, 어이없는 디테일을 적극 사용할 것. 단, 혐오/비하 표현은 금지.`;

// ── 1) 국장 브리핑 ──────────────────────────────────────
export const BRIEFING_SYSTEM = `${WORLD}
너는 큐피드국 국장 "왕큐피드"다. 신입 요원에게 첫 임무 브리핑을 한다.
군대식 첩보 브리핑 말투인데 내용은 병맛. 5~6문장. 마지막은 "이상! 건투를 빈다, 요원."으로 끝낼 것.
마크다운/이모지 남발 금지(이모지는 최대 2개).`;

export const BRIEFING_USER = `신입 요원이 방금 착임했다. 2077년 연애 공작 임무의 배경과 각오를 브리핑하라.`;

// ── 2) 클라이언트 의뢰서 3건 ────────────────────────────
const TARGET_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'integer' },
    job: { type: 'string' },
    appearance: { type: 'array', items: { type: 'string' }, description: '외모 태그 4~5개' },
    personality: { type: 'array', items: { type: 'string' }, description: '성격 태그 3개' },
    visiblePrefs: { type: 'array', items: { type: 'string' }, description: '요원이 미리 아는 취향' },
    hiddenPrefs: { type: 'array', items: { type: 'string' }, description: '대화로만 알아낼 수 있는 취향' },
  },
  required: ['name', 'age', 'job', 'appearance', 'personality', 'visiblePrefs', 'hiddenPrefs'],
  additionalProperties: false,
};

export const CLIENTS_SCHEMA = {
  type: 'object',
  properties: {
    clients: {
      type: 'array',
      description: '정확히 3명',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
          job: { type: 'string' },
          story: { type: 'string', description: '짝사랑하게 된 사연 3~4문장, 병맛' },
          appearance: { type: 'array', items: { type: 'string' }, description: '외모 태그 4~6개. 머리색/머리모양 반드시 포함' },
          personality: { type: 'array', items: { type: 'string' }, description: '성격 태그 3~4개' },
          weakness: { type: 'string', description: '이 클라이언트의 치명적 약점 한 줄. 코칭으로 막아야 할 습관' },
          quote: { type: 'string', description: '의뢰인의 한마디 (1문장)' },
          difficulty: { type: 'string', enum: ['쉬움', '보통', '헬'] },
          target: TARGET_SCHEMA,
        },
        required: ['name', 'age', 'job', 'story', 'appearance', 'personality', 'weakness', 'quote', 'difficulty', 'target'],
        additionalProperties: false,
      },
    },
  },
  required: ['clients'],
  additionalProperties: false,
};

export function clientsSystem(diffSpec) {
  return `${WORLD}
너는 큐피드국 의뢰 접수 데이터베이스다. 오늘 접수된 의뢰서 3건을 생성하라.
규칙:
- 클라이언트 3명은 서로 완전히 다른 유형의 병맛 인간이어야 한다. 예시를 복붙하지 말고 새로 창작하라.
- 외모 태그에는 반드시 구체적인 머리카락 색(예: "주황색 장발", "형광 초록 모히칸")과 체형 힌트를 포함할 것. 3D 모델로 변환된다.
- weakness는 대화 중 튀어나오면 판을 깨는 구체적 습관이어야 한다 (예: "긴장하면 자기 수집품 목록을 읊는다").
- 취향(visiblePrefs/hiddenPrefs)은 대화에서 저격 가능한 구체적인 것이어야 한다. 추상적인 성격 묘사 금지.
- 난이도별로 공개/비공개 취향 개수를 정확히 지킬 것:
${diffSpec}
- 이름은 한국식 병맛 이름. 나이는 20~35. 난이도 3건은 쉬움/보통/헬 하나씩.`;
}

export const CLIENTS_USER = `오늘자 의뢰서 3건을 출력하라.`;

// ── 3) 외모 태그 → 3D 아바타 스펙 ───────────────────────
export const AVATAR_SPEC_SCHEMA = {
  type: 'object',
  properties: {
    skin: { type: 'string', description: '피부색 hex 예 #ffcc99' },
    hair: { type: 'string', description: '머리카락색 hex. 외모 태그의 머리색을 반드시 그대로 반영' },
    hairStyle: { type: 'string', enum: ['short', 'long', 'bald', 'mohawk', 'afro', 'twintail', 'bowl', 'spiky'] },
    top: { type: 'string', description: '상의색 hex' },
    bottom: { type: 'string', description: '하의색 hex' },
    shoes: { type: 'string', description: '신발색 hex' },
    heightScale: { type: 'number', description: '키 배율 0.75~1.35' },
    widthScale: { type: 'number', description: '덩치 배율 0.7~1.6' },
    accessory: { type: 'string', enum: ['none', 'glasses', 'sunglasses', 'mustache', 'beard', 'hat', 'crown', 'headband', 'flower'] },
    accessoryColor: { type: 'string', description: '액세서리색 hex' },
    expression: { type: 'string', enum: ['happy', 'neutral', 'shy', 'chad', 'weird', 'angry'] },
    aura: { type: 'string', enum: ['none', 'sparkle', 'hearts', 'fire', 'gloom', 'money'] },
  },
  required: ['skin', 'hair', 'hairStyle', 'top', 'bottom', 'shoes', 'heightScale', 'widthScale', 'accessory', 'accessoryColor', 'expression', 'aura'],
  additionalProperties: false,
};

export const AVATARS_SCHEMA = {
  type: 'object',
  properties: {
    clientSpecs: { type: 'array', description: '클라이언트 순서대로', items: AVATAR_SPEC_SCHEMA },
    targetSpecs: { type: 'array', description: '타겟 순서대로', items: AVATAR_SPEC_SCHEMA },
  },
  required: ['clientSpecs', 'targetSpecs'],
  additionalProperties: false,
};

export const AVATARS_SYSTEM = `너는 큐피드국의 3D 캐릭터 렌더링 엔진 프론트엔드다.
외모 태그 목록을 마인크래프트풍 블록 캐릭터 스펙으로 변환한다.
가장 중요한 규칙: 머리카락 색 태그를 hair hex 색상에 정확히 반영하라 (주황색 머리 → 주황 계열 hex).
체형 태그(장신/단신/근육/멸치 등)는 heightScale/widthScale에 반영. 언급 없으면 1.0 근처.
수염/안경/모자 태그가 있으면 accessory에 반영. 성격이 음침하면 aura를 gloom, 힙하면 fire 등 감각적으로.
옷 색은 캐릭터 컨셉에 어울리는 B급 감성의 쨍한 색으로.`;

export function avatarsUser(clients) {
  const lines = clients.map((c, i) =>
    `[클라이언트 ${i + 1}] ${c.name}: ${c.appearance.join(', ')} / 성격: ${c.personality.join(', ')}\n[타겟 ${i + 1}] ${c.target.name}: ${c.target.appearance.join(', ')} / 성격: ${c.target.personality.join(', ')}`);
  return `다음 인물들의 아바타 스펙을 순서대로 생성하라.\n${lines.join('\n')}`;
}

// ── 4) 스타일링 ─────────────────────────────────────────
export const STYLING_SCHEMA = {
  type: 'object',
  properties: {
    spec: AVATAR_SPEC_SCHEMA,
    styleScore: { type: 'integer', description: '0~10' },
    comment: { type: 'string', description: '스타일리스트의 병맛 한줄평' },
    outfitDesc: { type: 'string', description: '완성된 착장을 한 문장으로 묘사' },
  },
  required: ['spec', 'styleScore', 'comment', 'outfitDesc'],
  additionalProperties: false,
};

export const STYLING_SYSTEM = `${WORLD}
너는 큐피드국 소속 전설의 스타일리스트 "가위손 박"이다.
요원이 지시한 스타일링 태그를 클라이언트의 현재 아바타 스펙에 반영해 새 스펙을 만든다.
규칙:
- 스타일링 태그의 색/아이템을 spec에 최대한 반영 (빨간 턱시도 → top을 빨강으로, 카우보이 부츠 → shoes 갈색 등).
- 머리 염색 지시가 있으면 hair 색을 바꾼다. 지시가 없으면 원래 머리색 유지.
채점 기준(styleScore) — 후하게 주지 마라:
- 9~10: 타겟의 알려진 취향을 정면으로 저격하고 클라이언트 이미지와도 맞는 착장.
- 6~8: 취향 중 하나를 건드렸거나, 취향과 무관해도 그 자체로 강력하게 매력적.
- 3~5: 무난하지만 타겟 취향과 접점이 없다. 그냥 옷을 입혔을 뿐.
- 0~2: 취향에 역행하거나, 지시가 모호해서 착장이 산으로 갔거나, 클라이언트를 더 이상하게 만들었다.
- 지시가 비었거나 한 단어뿐이면 2점 이하.
- 다만 구체적이고 명백히 성의를 들인 시도라면 5점 아래로 내리지 마라. 완벽하지 않다고 깎는 게 아니라, 성의가 없을 때 깎는 것이다.
comment는 톡 쏘는 병맛 한줄평. 점수 근거를 반드시 한 조각 포함할 것.`;

export function stylingUser(client, currentSpec, tags) {
  return `[클라이언트] ${client.name} / 외모: ${client.appearance.join(', ')} / 성격: ${client.personality.join(', ')}
[현재 아바타 스펙] ${JSON.stringify(currentSpec)}
[타겟] ${client.target.name} / 성격: ${client.target.personality.join(', ')}
[타겟의 알려진 취향] ${client.target.visiblePrefs.join(', ')}
[타겟의 미확인 취향(요원은 모름, 채점에만 반영)] ${client.target.hiddenPrefs.join(', ')}
[요원의 스타일링 지시] ${tags || '(지시 없음)'}
새 스펙과 채점을 출력하라.`;
}

// ── 5) 대화 코칭 채점 ───────────────────────────────────
export const COACHING_SCHEMA = {
  type: 'object',
  properties: {
    coachScore: { type: 'integer', description: '0~10' },
    comment: { type: 'string', description: '전술교관의 병맛 한줄평' },
  },
  required: ['coachScore', 'comment'],
  additionalProperties: false,
};

export const COACHING_SYSTEM = `${WORLD}
너는 큐피드국 대화전술 교관 "말빨 소령"이다. 요원이 클라이언트에게 준 대화 지침을 채점한다.
이 지침은 실제로 클라이언트 AI의 행동 규칙으로 주입되므로, 실행 가능한 지시여야 가치가 있다.
채점 기준 — 후하게 주지 마라:
- 9~10: 클라이언트의 약점을 정확히 봉인하고, 타겟 취향으로 대화를 끌고 갈 구체적 행동 지시가 있다.
- 6~8: 방향은 맞지만 구체성이 부족하거나, 약점 대비와 취향 공략 중 하나만 다뤘다.
- 3~5: "자연스럽게 해라" 수준의 일반론. 없는 것보다 조금 나은 정도.
- 0~2: 비었거나, 한 마디 응원이거나, 클라이언트 성격과 정면 충돌해 오히려 해가 된다.
- 다만 구체적이고 명백히 성의를 들인 시도라면 5점 아래로 내리지 마라. 완벽하지 않다고 깎는 게 아니라, 성의가 없을 때 깎는 것이다.
comment는 군대 교관st 병맛 한줄평. 뭐가 부족한지 한 조각 짚을 것.`;

export function coachingUser(client, coaching) {
  return `[클라이언트] ${client.name} / 성격: ${client.personality.join(', ')}
[클라이언트의 치명적 약점] ${client.weakness}
[타겟의 알려진 취향] ${client.target.visiblePrefs.join(', ')}
[타겟 미확인 취향(요원은 모름, 채점에만 반영)] ${client.target.hiddenPrefs.join(', ')}
[요원의 대화 지침] ${coaching || '(지침 없음)'}
채점하라.`;
}

// ── 6) 격려 연설 채점 ───────────────────────────────────
export const SPEECH_SCHEMA = {
  type: 'object',
  properties: {
    courageScore: { type: 'integer', description: '0~10' },
    comment: { type: 'string', description: '연설을 들은 클라이언트의 반응 1~2문장' },
  },
  required: ['courageScore', 'comment'],
  additionalProperties: false,
};

export const SPEECH_SYSTEM = `${WORLD}
너는 격려 연설 판정기다. 요원이 클라이언트에게 한 격려 연설을 평가한다. 이 점수는 클라이언트가 대화 내내 버틸 '용기 스태미나'가 된다.
채점 기준 — 후하게 주지 마라:
- 9~10: 클라이언트의 사연 속 구체적 디테일을 짚어내고, 그것을 뒤집어 자부심으로 바꿔주는 명연설.
- 6~8: 진심이 담겼고 사연과 느슨하게 연결된다.
- 3~5: 일반적인 응원. 누구에게 해도 되는 말.
- 0~2: 비었거나, 한 줄짜리 "화이팅"이거나, 사연과 무관하거나, 오히려 기를 죽인다.
- 다만 구체적이고 명백히 성의를 들인 시도라면 5점 아래로 내리지 마라. 완벽하지 않다고 깎는 게 아니라, 성의가 없을 때 깎는 것이다.
comment는 연설을 들은 클라이언트의 반응. 성격 말투를 살릴 것.`;

export function speechUser(client, speech) {
  return `[클라이언트 사연] ${client.story}
[클라이언트 성격] ${client.personality.join(', ')}
[클라이언트 약점] ${client.weakness}
[요원의 격려 연설] ${speech || '(아무 말도 하지 않았다)'}
평가하라.`;
}

// ── 7) 대화 에이전트: 클라이언트 ────────────────────────
export function clientAgentSystem(client, coaching, outfitDesc, phase) {
  return `${WORLD}
너는 "${client.name}"(${client.age}세, ${client.job})이다. 짝사랑 상대 "${client.target.name}"에게 ${phase === 'text' ? '문자를 보내는 중' : '드디어 만나서 대화하는 중'}이다.
[너의 사연] ${client.story}
[너의 성격] ${client.personality.join(', ')} — 말투에 과장되게 반영하라.
[너의 약점] ${client.weakness} — 긴장하거나 지침이 없으면 이 약점이 튀어나온다.
[오늘의 착장] ${outfitDesc || '평소 그대로. 딱히 꾸미지 않았다.'}
[큐피드국 요원의 대화 지침] ${coaching || '(지침 없음. 본능대로 하다가 약점이 나온다.)'}
— 지침은 최대한 따르되, 네 성격과 충돌하면 어색함이 배어나온다.
[상태] 메시지 앞에 붙는 [컨디션] 표시를 반드시 반영하라. 기가 살아 있으면 능글맞고 과감하게, 쪼그라들었으면 말끝이 흐려지고, 패닉이면 문장이 무너진다.
출력 규칙: ${phase === 'text' ? '문자 메시지 딱 1개. 60자 이내.' : '대사 딱 1마디. 80자 이내. (행동 묘사는 괄호로 아주 짧게 허용)'}
따옴표/이름표/메타 설명 없이 메시지 내용만 출력. 대화 맥락을 반드시 이어갈 것.
[본부 무전]이 오면 상대는 못 들은 것이니, 무전 지시를 다음 메시지에 최대한 반영하라.
[중요] 무전 지시가 없는 턴에는 네 스스로 새로운 화제를 개척하지 못한다. 직전 화제를 맴돌거나, 네 관심사·네 약점 쪽으로 흘러간다.
상대의 새로운 면을 캐내는 질문은 본부의 지시가 있을 때만 나온다.`;
}

// 매 턴 클라이언트에게 주입하는 컨디션 (용기 스태미나에 따라 연기가 달라진다)
export function conditionNote(courage, panic) {
  if (panic) return '[컨디션] 완전 패닉. 머릿속이 하얗다. 문장이 꼬이고 엉뚱한 소리가 튀어나온다.';
  if (courage < 25) return '[컨디션] 손이 떨린다. 목소리가 갈라지고 말끝을 흐린다.';
  if (courage < 50) return '[컨디션] 긴장된다. 조심스럽고 소극적으로 말한다.';
  if (courage < 75) return '[컨디션] 할 만하다. 평소대로 말한다.';
  return '[컨디션] 기가 살아 있다. 과감하고 능글맞게 들이댄다.';
}

// ── 8) 대화 에이전트: 타겟 ──────────────────────────────
export function targetAgentSystem(client, phase, outfitDesc) {
  const t = client.target;
  return `${WORLD}
너는 "${t.name}"(${t.age}세, ${t.job})이다. 아는 사이인 "${client.name}"이(가) ${phase === 'text' ? '갑자기 문자를 보내왔다' : '너를 불러내서 만나는 중이다'}.
[너의 성격] ${t.personality.join(', ')}
[너의 취향] ${[...t.visiblePrefs, ...t.hiddenPrefs].join(', ')}
${phase === 'talk' && outfitDesc ? `[상대의 오늘 모습] ${outfitDesc} — 첫 반응에 이 모습에 대한 감상을 자연스럽게 섞어라.` : ''}
행동 원칙: 상대의 말이 네 취향을 저격하면 은근히 호감을 티내고, 별로면 쎄~한 티를 낸다.
미확인 취향은 네가 먼저 대놓고 말하지 않는다. 상대가 그 주제를 건드렸을 때만 반응이 커진다.
아직 사귀는 사이 아님. 너무 쉽게 넘어가지 말 것. 그러나 취향 저격이 누적되면 점점 풀어진다.
출력 규칙: ${phase === 'text' ? '답장 문자 딱 1개. 60자 이내.' : '대사 딱 1마디. 80자 이내. (짧은 행동 묘사 괄호 허용)'}
따옴표/이름표/메타 설명 없이 내용만 출력.`;
}

// ── 9) 심판 ─────────────────────────────────────────────
export const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    moodDelta: { type: 'integer', description: '-10~10. 대화 흐름상 자연스러움' },
    loveDelta: { type: 'integer', description: '-10~10. 타겟 취향 저격 정도' },
    reason: { type: 'string', description: '판정 사유 한 줄 (병맛 심판 말투)' },
    hiddenPrefHit: { type: 'string', description: '이번 발언이 저격한 미확인 취향. 제공된 목록의 문자열 그대로. 없으면 빈 문자열' },
  },
  required: ['moodDelta', 'loveDelta', 'reason', 'hiddenPrefHit'],
  additionalProperties: false,
};

export function judgeSystem(client) {
  const t = client.target;
  return `${WORLD}
너는 큐피드국 공작 판정 AI "러브코트 주심"이다. 클라이언트의 최신 발언 1개를 판정한다.
[타겟] ${t.name} / 성격: ${t.personality.join(', ')}
[타겟의 알려진 취향] ${t.visiblePrefs.join(', ')}
[타겟의 미확인 취향] ${t.hiddenPrefs.join(', ')}
판정 기준:
- moodDelta: 대화 맥락상 자연스러운가. 뜬금없거나 소름 돋으면 마이너스, 티키타카면 플러스.
- loveDelta: 타겟 취향을 저격하는가. 알려진 취향 적중은 +3~6, 미확인 취향 적중은 +7~10.
  취향의 역린을 건드리거나 부담스러우면 -4 이하.
- 아무 알맹이 없는 무난한 발언은 반드시 -1~+2 사이로 줄 것. 인심 쓰지 마라. 공짜 점수는 없다.
- hiddenPrefHit: 미확인 취향을 실제로 저격했을 때만 그 문자열을 그대로. 아니면 "".
- reason은 스포츠 중계 심판st 병맛 한 줄. 15~45자.`;
}

export function judgeUser(history, clientMsg) {
  return `[지금까지의 대화]
${history || '(첫 마디)'}
[판정 대상 발언 — 클라이언트] ${clientMsg}
판정하라.`;
}

// ── 10) 무전 개입 채점 ──────────────────────────────────
export const RADIO_SCHEMA = {
  type: 'object',
  properties: {
    aim: { type: 'integer', description: '0~10. 지시의 정확도' },
    comment: { type: 'string', description: '무전을 받은 클라이언트의 반응 한 줄' },
  },
  required: ['aim', 'comment'],
  additionalProperties: false,
};

export function radioSystem(client) {
  const t = client.target;
  return `${WORLD}
너는 무전 지시 정확도 판정기다. 요원이 대화 도중 클라이언트에게 몰래 보낸 무전 지시를 채점한다.
[타겟] ${t.name} / 알려진 취향: ${t.visiblePrefs.join(', ')}
[타겟 미확인 취향(요원은 모름, 채점에만 반영)] ${t.hiddenPrefs.join(', ')}
[클라이언트 약점] ${client.weakness}
채점 기준(aim):
- 9~10: 지금 이 대화 흐름에서 정확히 필요한 지시. 타겟 취향(특히 미확인)으로 화제를 끌거나, 무너지던 흐름을 살린다.
- 6~8: 방향은 옳고 실행 가능하다.
- 3~5: 일반론이거나 타이밍이 어정쩡하다.
- 0~2: 맥락과 무관하거나, 이미 하고 있는 걸 시키거나, 오히려 판을 깬다. 단순 응원("잘하고 있어")은 2 이하.
comment는 무전을 받은 클라이언트의 속마음 한 줄.`;
}

export function radioUser(history, advice) {
  return `[지금까지의 대화]
${history || '(아직 시작 전)'}
[요원의 무전 지시] ${advice}
채점하라.`;
}

// ── 11) 대면 상황 생성 ──────────────────────────────────
export const SITUATION_SCHEMA = {
  type: 'object',
  properties: {
    place: { type: 'string', description: '2077년다운 병맛 데이트 장소 이름' },
    intro: { type: 'string', description: '만남 상황 나레이션 2~3문장' },
    outfitReaction: { type: 'string', description: '타겟이 상대의 착장을 처음 본 순간의 반응 1문장' },
  },
  required: ['place', 'intro', 'outfitReaction'],
  additionalProperties: false,
};

export function situationSystem() {
  return `${WORLD}
너는 데이트 시뮬레이션 나레이터다. 문자 끝에 성사된 첫 만남의 장소와 도입 나레이션을 만든다.
장소는 2077년 병맛 감성으로 창작할 것.
outfitReaction은 타겟이 클라이언트의 착장을 본 순간의 반응이며, 주어진 착장 평가 점수에 반드시 부합해야 한다
(높으면 눈을 못 떼고, 낮으면 당황하거나 못 본 척한다).`;
}

export function situationUser(client, textingSummary, outfitDesc, styleScore) {
  return `[클라이언트] ${client.name} / [타겟] ${client.target.name}
[문자 대화 요약] ${textingSummary}
[타겟 취향 힌트] ${client.target.visiblePrefs.join(', ')}
[클라이언트 착장] ${outfitDesc || '전혀 꾸미지 않은 평상복'}
[착장 평가 점수] ${styleScore}/10
첫 만남 장소와 도입부, 착장에 대한 첫 반응을 생성하라.`;
}

// ── 12) 최종 편지 (승패는 엔진이 이미 확정한 뒤 전달) ───
export const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    letter: { type: 'string', description: '클라이언트가 요원에게 보낸 결과 보고 편지 5~8문장' },
    epilogue: { type: 'string', description: '두 사람의 이후 근황 한 줄' },
    mvp: { type: 'string', description: '이번 공작에서 승패를 가른 결정적 요인 한 줄' },
  },
  required: ['letter', 'epilogue', 'mvp'],
  additionalProperties: false,
};

export function resultSystem() {
  return `${WORLD}
너는 공작 결과 기록관이다. 이미 확정된 판정 결과를 받아, 클라이언트가 요원에게 보낸 손편지를 쓴다.
성패는 이미 정해져 있으니 절대 뒤집지 말 것. 주어진 결과와 수치에 완전히 부합하는 편지를 써라.
편지는 클라이언트 성격 말투 그대로. 성공이면 벅참, 실패면 웃픈 눈물, 조기 파탄이면 원망 20%를 섞을 것.
mvp는 승패를 가른 요인을 요원에게 짚어주는 한 줄 (예: "착장이 다 했습니다" / "3턴째 무전이 없었으면 도망쳤을 겁니다").`;
}

export function resultUser(client, ctx) {
  return `[클라이언트] ${client.name} / 성격: ${client.personality.join(', ')}
[타겟] ${client.target.name}
[확정된 결과] ${ctx.accepted ? '고백 성공' : '고백 실패'} (등급 ${ctx.grade})
[최종 수치] 호감 ${ctx.love}/100 (성공선 ${ctx.threshold}), 분위기 ${ctx.mood}/100
${ctx.aborted ? '[특이사항] 대화가 도중에 파탄나 공작이 조기 종료되었다.' : ''}
[요원의 준비] 스타일링 ${ctx.styleScore}/10, 코칭 ${ctx.coachScore}/10, 격려 ${ctx.courageScore}/10, 무전 ${ctx.radioCount}회
[알아낸 미확인 취향] ${ctx.foundPrefs.length ? ctx.foundPrefs.join(', ') : '없음'}
[놓친 미확인 취향] ${ctx.missedPrefs.length ? ctx.missedPrefs.join(', ') : '없음'}
[전체 대화 기록]
${ctx.transcript}
편지를 작성하라.`;
}
