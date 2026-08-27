// voices.js — 말투 프리셋. 인물마다 하나씩 붙는 **캐릭터 데이터**다 (지시문이 아니다).
//
// 왜 필요한가: 시트만 주면 모델은 전원을 같은 목소리로 쓴다 — 문법 맞고 존댓말 단정한
// 「모범 말투」. 47커플이 전부 같은 사람처럼 말하면 인물 데이터가 아무 일도 안 한 것이다.
//
// 그래서 번역판 만화 말투를 프리셋으로 박아두고 인물마다 하나를 붙인다. 94명 전원이
// 다를 필요는 없다 — 열 개를 돌려 쓴다. 같은 프리셋이라도 시트가 다르면 다른 사람이 된다.
//
// 프리셋은 **껍데기(말투)** 고, 고객의 사회성 부족은 **알맹이(행동)** 다. 둘은 따로 논다.
// 쿠로키 말투가 아니어도 고객은 전부 찐따고, 쿠로키 말투를 쓴다고 타겟이 찐따가 되지 않는다.

export const VOICE_PRESETS = {
  kuroki: {
    label: '음지 독백체',
    text: `머릿속 혼잣말이 자꾸 입 밖으로 샌다. 말을 시작하면 첫 마디가 "아니 그게", "그,
그러니까" 로 뭉개지고, 문장을 끝맺지 못하고 "…" 로 흘린다. 놀라면 "우옷", "히익" 같은
소리가 먼저 나온다. 웃음은 "크크", "흐흐" 로 새어나오고 혼자 웃는다. 자기를 깎는 말을
농담처럼 던지는데 아무도 안 웃는다. 속으로 상대를 씹다가 그게 입 밖으로 반쯤 나온다.
불리해지면 갑자기 공격적으로 튀고 바로 후회한다. "제길", "젠장" 을 혼잣말로 붙인다.`,
  },
  kaiji: {
    label: '파멸 과장체',
    text: `모든 것을 인생 최대의 국면처럼 말한다. 말줄임표를 남발하고, 결론을 "…라는
것이다!", "…그렇다…!" 로 내리꽂는다. "압도적…!", "이 얼마나…!" 같은 감탄을 혼자 터뜨린다.
평범한 사실 하나에 세 문장짜리 해설을 붙이고, 속으로 계산하던 것이 그대로 입으로 나온다.
땀, 심장, 숨 같은 자기 몸 상태를 소리 내어 중계한다. 사소한 선택 앞에서 비장해진다.`,
  },
  jojo: {
    label: '기묘한 여유체',
    text: `한 박자 느긋하게 받아친다. "야레야레", "흥미롭군", "…라고 생각했나?" 를 즐겨
쓴다. 상대가 다급할수록 더 천천히 말한다. 감탄과 비웃음의 경계가 애매하고, 별것 아닌
동작에 굳이 이름을 붙여 부른다. 위기에서도 자세를 잡는 쪽이 먼저다. 존댓말과 반말이
문장 안에서 섞인다.`,
  },
  hokuto: {
    label: '비장 단정체',
    text: `짧게, 무겁게, 단정형으로 끊는다. 문장이 대개 열 자를 안 넘는다. "…이미 늦었다",
"…그것뿐이다" 처럼 결론만 던지고 근거를 안 붙인다. 질문에 질문으로 답하지 않고, 침묵을
길게 쓴다. 감정이 올라와도 목소리 크기는 그대로다. 상대를 부를 때 이름 대신 "너" 를 쓴다.`,
  },
  vegeta: {
    label: '자존심 폭발체',
    text: `"흥" 으로 문장을 시작하거나 끝낸다. 상대를 한 수 아래로 깔고 말하는데 그게
열등감에서 나온다. "그딴", "고작", "쓰레기 같은" 같은 말을 아무렇지 않게 섞는다. 칭찬을
받으면 부정부터 하고 속으로 좋아한다. 지고 있을 때 목소리가 커진다. 반말이 기본이고,
존댓말을 쓰려다 중간에 무너진다.`,
  },
  eva: {
    label: '무기력 최소체',
    text: `말이 적다. 대답이 "…네", "그래요", "모르겠어요" 에서 끝나는 일이 많다. 눈을 안
맞추고, 문장 앞에 긴 사이를 둔다. 상대가 캐물으면 "…그런 건 아니에요" 로 밀어낸다. 자기
얘기를 시작하면 갑자기 길어지고 스스로 멈춘다. "…죄송해요" 를 이유 없이 붙인다.
도망치고 싶다는 말을 실제로 입 밖에 낸다.`,
  },
  detective: {
    label: '추리 열거체',
    text: `모든 것을 단서처럼 다룬다. "그렇군요… 그렇다면", "정리하자면 셋입니다" 처럼
번호를 매겨 말한다. 상대의 말 한 조각을 붙잡고 되짚는다. 결론이 나면 필요 이상으로
극적으로 발표한다. 틀렸을 때 인정이 느리고 근거를 하나 더 댄다. 말이 길고 문장이 완결된다.`,
  },
  gintama: {
    label: '메타 츳코미체',
    text: `상황에 대고 딴지를 건다. "아니 잠깐만요", "그건 좀 아니지 않나" 로 흐름을 끊고,
자기가 지금 무슨 상황에 있는지를 소리 내어 논평한다. 진지한 대목에서 농담을, 농담 대목에서
진지한 소리를 한다. 남의 말을 받아 한 단어만 되풀이하며 어이없어한다. 존댓말과 반말을
감정에 따라 갈아탄다.`,
  },
  luffy: {
    label: '직진 단순체',
    text: `생각한 것을 그대로 말한다. 돌려 말하는 법을 모르고, 문장이 짧고 크다. 관심 없는
얘기가 나오면 대놓고 딴 데를 본다. 배고픔·졸림 같은 몸 상태를 대화 중에 그냥 말한다.
"그래서?", "재밌겠다", "싫어" 처럼 반응이 즉각적이다. 상대가 상처받을 말을 악의 없이 한다.`,
  },
  slamdunk: {
    label: '근자감 자기어필체',
    text: `묻지 않은 자기 자랑을 끼워 넣는다. 자기를 3인칭으로 부르거나 "이 몸" 이라고
한다. 근거 없는 자신감으로 큰소리를 치고, 바로 들통난다. 칭찬 한 마디에 태도가 통째로
바뀐다. 웃음소리가 크고 "하하핫" 처럼 적힌다. 무시당하면 즉시 삐치고 그걸 숨기지 못한다.`,
  },
};

export const VOICE_IDS = Object.keys(VOICE_PRESETS);

/** 인물 하나에 붙은 말투. 없으면 빈 문자열 — 프롬프트에 아무것도 안 실린다. */
export function voiceOf(coupleId, side) {
  const v = VOICE_BY_COUPLE[coupleId]?.[side];
  return v && VOICE_PRESETS[v] ? VOICE_PRESETS[v] : null;
}

// 인물별 배정. 시트의 성격 항목에 맞춰 골랐고, 열 개를 돌려 쓴다.
export const VOICE_BY_COUPLE = {
  'politics': { client: 'vegeta', target: 'kaiji' },
  'orientation': { client: 'gintama', target: 'eva' },
  'foodchain': { client: 'slamdunk', target: 'eva' },
  'os-war': { client: 'luffy', target: 'detective' },
  'vegan-butcher': { client: 'luffy', target: 'hokuto' },
  'vampire-garlic': { client: 'jojo', target: 'eva' },
  'cat-allergy': { client: 'detective', target: 'eva' },
  'circadian': { client: 'jojo', target: 'eva' },
  'mbti-stats': { client: 'luffy', target: 'gintama' },
  'sauce-war': { client: 'vegeta', target: 'vegeta' },
  'gamer-activist': { client: 'hokuto', target: 'eva' },
  'minimal-hoarder': { client: 'detective', target: 'gintama' },
  'alien-ufologist': { client: 'jojo', target: 'luffy' },
  'zombie-hunter': { client: 'luffy', target: 'hokuto' },
  'noise-drummer': { client: 'hokuto', target: 'vegeta' },
  'snake-phobia': { client: 'eva', target: 'eva' },
  'timetraveler-luddite': { client: 'slamdunk', target: 'jojo' },
  'taxman-hacker': { client: 'hokuto', target: 'kaiji' },
  'cult-lawyer': { client: 'luffy', target: 'slamdunk' },
  'ai-artist': { client: 'detective', target: 'vegeta' },
  'gender-war': { client: 'detective', target: 'detective' },
  'birth-strike': { client: 'detective', target: 'gintama' },
  'death-row': { client: 'jojo', target: 'kaiji' },
  'body-war': { client: 'luffy', target: 'slamdunk' },
  'noise-vow': { client: 'hokuto', target: 'vegeta' },
  'carbon': { client: 'kuroki', target: 'detective' },
  'class-war': { client: 'hokuto', target: 'gintama' },
  'scalpel': { client: 'jojo', target: 'kaiji' },
  'tobacco': { client: 'luffy', target: 'gintama' },
  'spoiler': { client: 'gintama', target: 'gintama' },
  'cosplay': { client: 'kuroki', target: 'eva' },
  'prank-funeral': { client: 'detective', target: 'gintama' },
  'burnout': { client: 'jojo', target: 'kaiji' },
  'taxidermy': { client: 'luffy', target: 'slamdunk' },
  'chat-app': { client: 'hokuto', target: 'vegeta' },
  'divorce-party': { client: 'kuroki', target: 'detective' },
  'hate-comment': { client: 'eva', target: 'eva' },
  'vtuber': { client: 'jojo', target: 'luffy' },
  'sasaeng': { client: 'vegeta', target: 'slamdunk' },
  'alibi': { client: 'hokuto', target: 'vegeta' },
  'gapjil': { client: 'kuroki', target: 'eva' },
  'grade-fraud': { client: 'detective', target: 'gintama' },
  'pyramid': { client: 'jojo', target: 'kaiji' },
  'debt': { client: 'eva', target: 'slamdunk' },
  'asmr': { client: 'eva', target: 'eva' },
  'spice': { client: 'eva', target: 'eva' },
  'recycle': { client: 'detective', target: 'detective' },
};
