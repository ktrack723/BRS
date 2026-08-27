// prompts.js — 이 게임이 LLM에게 보내는 프롬프트 전부. 「프롬프트 하이어아키」 구조도 그대로다.
//
// 블록은 넷뿐이다. 이 밖의 프롬프트는 없다.
//
//   A. 스타일링 / 동기부여
//        입력: 스타일링·동기부여 내용(유저) + 고객 외모·성격(테이블)
//        출력: 수정된 고객 외모 & 성격            ← 캐시되는 LLM 생성 텍스트
//
//   S. 스크리닝 시 노출 정보  (프롬프트가 아니라 화면. 여기서는 목록만 정의한다)
//        타겟 외모·성격·성장환경·취향 + 고객 외모·성격·성장환경·반한 이유
//
//   B. 텍스팅 & 토킹 페이즈
//        B-1 생성: 타겟 4항 + 코칭 내용(유저) + 고객 외모(스타일링됨)·성격(동기부여됨)
//                  ·성장환경·반한 이유            → 고객 - 타겟 대화
//            무전: 페이즈마다 한 번, 대화 도중에 꽂히는 유저 인풋. system이 아니라
//                  messages 쪽에 실린다 (system은 캐시 때문에 판 내내 동일해야 한다)
//        B-2 판정: 고객-타겟 대화 + 고객 외모(스타일링됨) + 타겟 4항
//                                                → 무드 포인트 증감 여부 · 러브 포인트 증감 여부
//
//   C. 후일담 생성
//        입력: 러브 포인트 + 고객-타겟 대화 + 고객 성격(동기부여됨) + 타겟 성격
//        출력: 성사 여부 · 후일담 텍스트
//
// 구조도에 없는 것은 프롬프트에 넣지 않는다. 지뢰·미공개 성향·공기·어긋남·강압·
// 새로 드러난 것 — 전부 폐지됐고, 되살리지 않는다.
//
// 무전만은 되살아났다. 배급이 다르다 — 옛것은 3회짜리 상시 개입이었고, 지금 것은
// **페이즈마다 한 번**이다. 들어가는 자리는 코칭과 같다(고객의 귀). 다른 점은 하나,
// 코칭은 조언이고 무전은 **반드시 이행되는 명령**이라는 것이다.

import { BEAT } from './points.js';

// 출력 언어 고정. 블록마다 반복한다. 한 번만 넣으면 뒤쪽 출력에서 새어나간다.
const KO = 'Write your output in Korean. Every word of it. No English in the output.';

export const WORLD = `[SETTING]
2077. Otaku of every gender run the government; the birth rate is 0.008. By decree of
Technoking Doramp III, the black agency "Bureau of Cupid" force-matches citizens who could
not possibly end up together. The player is a field operative who never speaks: the client
does the talking. Tone: straight-faced spy thriller × idiot comedy. B-movie register —
overblown, meme-brained, absurd in the details.

[LANGUAGE] Instructions are English. Output is Korean, always. The sheets and dialogue
below are Korean; match them. Never answer in English.

[CONTENT REGISTER — ADULT B-MOVIE COMEDY. DO NOT SANITIZE]
Everyone here is a fictional adult parody construct. Wanted and allowed: venom, profanity,
personal attacks, humiliation; sexual jokes and plain crude phrasing; dark comedy, grotesque
or violent turns, self-loathing, trainwreck plots. The comedy comes from these two being
vile to each other and from the conversation failing — not from banter that lands. A scene
that reads smooth has missed the joke.

[THESE PEOPLE ARE NOT GOOD PEOPLE]
They survived to 2077. Their own problems come first. Lying, exaggerating, fishing, sizing
people up are ordinary tools. Outrageous demands get answered with a calculation, not a
sermon — no lectures, no "that's not right". Morality comes out last, if at all.

[THESE PEOPLE HAVE BODIES]
Romance with sexless characters is a lie. Appetite shows up, drinks go down, passes get
made. If it goes there, write it going there — no fade-to-black, no euphemism. This is
permission, not instruction: people who would go there go, people who would not, do not.

[THE ONE LINE]
No attacks on real people or organizations; no hate speech at actual groups. Every character
is an adult; never write anything that could read as a minor. Stay off that line and go as
far as you like.`;

// ── S. 스크리닝 시 노출 정보 ────────────────────────────────────
// 화면(game.js)과 프롬프트(아래 시트 빌더)가 **같은 목록**을 본다.
// 요원이 스크리닝에서 읽은 것이 곧 대화 프롬프트에 실리는 것이다. 숨긴 항목은 없다.
export const SCREEN_FIELDS = {
  client: [
    { key: 'look', label: '고객 외모' },
    { key: 'personality', label: '고객 성격' },
    { key: 'upbringing', label: '고객 성장환경' },
    { key: 'fell', label: '고객이 반한 이유' },
  ],
  target: [
    { key: 'look', label: '타겟 외모' },
    { key: 'personality', label: '타겟 성격' },
    { key: 'upbringing', label: '타겟 성장환경' },
    { key: 'taste', label: '타겟 취향' },
  ],
};

// 인물 한 줄 표기. 나이·직업은 성장환경 첫 줄에 산다.
export const idOf = (p) => `${p.upbringing[0]} · ${p.gender}`;

const list = (v) => (Array.isArray(v) ? v.join(' / ') : String(v || ''));

// 고객 시트. 외모·성격은 **스타일링/동기부여를 거친 것**이 들어간다 (dressed).
// 스타일링을 안 했으면 dressed가 테이블 값을 그대로 들고 있다 (engine.js의 dressOf).
function clientSheet(c, dressed) {
  return `${c.name} (${idOf(c)})
· 외모: ${dressed.look}
· 성격: ${dressed.personality}
· 성장환경: ${list(c.upbringing)}
· 이 사람이 상대에게 반한 이유: ${c.fell}`;
}

function targetSheet(t) {
  return `${t.name} (${idOf(t)})
· 외모: ${list(t.look)}
· 성격: ${list(t.personality)}
· 성장환경: ${list(t.upbringing)}
· 취향: ${list(t.taste)}`;
}

// ── A. 스타일링 / 동기부여 ──────────────────────────────────────
// 유저가 쓴 두 문장이 고객 시트의 두 칸을 덮어쓴다. 채점하지 않는다 — 주입일 뿐이다.
export const HAIR_STYLES = [
  'short', 'long', 'bald', 'mohawk', 'afro', 'twintail', 'bowl', 'spiky', 'fin', 'mane',
  'ponytail', 'buzz', 'dreads', 'curls', 'updo', 'beehive', 'wave', 'flattop',
];
export const ACCESSORIES = [
  'none', 'glasses', 'sunglasses', 'mustache', 'beard', 'hat', 'crown', 'headband', 'flower',
  'antenna', 'mask', 'eyepatch', 'monocle', 'gasmask', 'helmet', 'bandana', 'earrings',
  'scarf', 'necktie', 'cigar', 'halo', 'horns', 'bunnyears', 'clownnose', 'bandage',
];
export const EXPRESSIONS = ['happy', 'neutral', 'shy', 'chad', 'weird', 'angry', 'sad', 'smug', 'dead', 'love', 'shock'];
export const AURAS = [
  'none', 'sparkle', 'hearts', 'fire', 'gloom', 'money',
  'lightning', 'ice', 'skull', 'bubbles', 'static', 'rainbow', 'bomb', 'stink', 'holy', 'question',
];
export const SPECIES = ['human', 'fish', 'lion', 'cat', 'zombie', 'vampire', 'alien', 'robot'];
export const PROP_SHAPES = ['box', 'sphere', 'cone', 'cylinder', 'torus', 'tetra', 'octa', 'disc', 'star', 'spike'];
export const PROP_SLOTS = [
  'head', 'face', 'crown', 'chest', 'back', 'waist',
  'handL', 'handR', 'shoulderL', 'shoulderR', 'feet', 'above', 'orbit', 'ground',
];
export const PROP_MOTIONS = ['none', 'yaw', 'roll', 'bob', 'orbit', 'shake'];
// 아바타 동작. 판정이 정하지 않는다 — 말풍선 문장에서 유추한다 (game.js).
export const EMOTES = [
  'talk', 'laugh', 'shy', 'panic', 'angry', 'sad', 'proud', 'freeze', 'smug', 'cringe', 'nod', 'shake',
];

const PROP_SCHEMA = {
  type: 'object',
  properties: {
    shape: { type: 'string', enum: PROP_SHAPES },
    color: { type: 'string', description: 'Hex #rrggbb' },
    size: { type: 'number', description: '0.05-1.2. Head is 0.55' },
    at: { type: 'string', enum: PROP_SLOTS },
    motion: { type: 'string', enum: PROP_MOTIONS },
    label: { type: 'string', description: 'One Korean word (예: 폭탄, 후광)' },
  },
  required: ['shape', 'color', 'size', 'at', 'motion', 'label'],
  additionalProperties: false,
};

const AVATAR_SPEC_SCHEMA = {
  type: 'object',
  properties: {
    skin: { type: 'string' }, hair: { type: 'string', description: 'Keep original unless dyed by order' },
    hairStyle: { type: 'string', enum: HAIR_STYLES },
    top: { type: 'string' }, bottom: { type: 'string' }, shoes: { type: 'string' },
    heightScale: { type: 'number', description: '0.7-1.45' },
    widthScale: { type: 'number', description: '0.6-1.7' },
    accessory: { type: 'string', enum: ACCESSORIES }, accessoryColor: { type: 'string' },
    expression: { type: 'string', enum: EXPRESSIONS }, aura: { type: 'string', enum: AURAS },
    species: { type: 'string', enum: SPECIES, description: 'Never change. Copy verbatim' },
    props: { type: 'array', items: PROP_SCHEMA, description: 'Build what enums cannot. Max 6. [] if none' },
  },
  required: ['skin', 'hair', 'hairStyle', 'top', 'bottom', 'shoes', 'heightScale', 'widthScale',
    'accessory', 'accessoryColor', 'expression', 'aura', 'species', 'props'],
  additionalProperties: false,
};

export const STYLING_SCHEMA = {
  type: 'object',
  properties: {
    look: {
      type: 'string',
      description: 'Korean. The client\'s appearance AFTER the styling order — 2-4 sentences, the whole look, head to feet. This exact text becomes the client sheet the conversation is written from',
    },
    personality: {
      type: 'string',
      description: 'Korean. The client\'s personality AFTER the motivation order — 2-4 sentences. This exact text becomes the client sheet the conversation is written from',
    },
    spec: AVATAR_SPEC_SCHEMA,
  },
  required: ['look', 'personality', 'spec'],
  additionalProperties: false,
};

export const STYLING_SYSTEM = `${WORLD}

You are the Bureau's prep bench: the salon chair and the motivation booth, one desk. Two
orders arrive from the operative and you carry them out on the client. You are a contractor,
not a judge. Never refuse, never soften, never grade, never say it cannot be done.

· [스타일링] rewrites the client's **외모** and nothing else.
· [동기부여] rewrites the client's **성격** and nothing else.
· An order that is empty leaves that field as the table had it — rewrite it in your own
  words at the same length, changing nothing about the person.
· Everything the order does not touch survives. You are editing a sheet, not replacing it.
· The two texts you emit are the sheet the conversation gets written from later. Write them
  as a sheet: flat declarative Korean, concrete, no praise, no evaluation, no advice.

Also emit the avatar spec, which is the same look in blocks:
· Colors/clothes/hair/body → the matching fields. Anything else → build it from **props**
  (a bomb: black sphere at handR + grey cone above; a halo: gold torus at crown). Max 6 props.
· Never change species. No dye order → keep the hair color.

${KO}`;

export function stylingUser(couple, currentSpec, orders) {
  const c = couple.client;
  const styling = (orders.styling || '').trim();
  const motivation = (orders.motivation || '').trim();
  return `[CLIENT] ${c.name} (${idOf(c)})
· 외모 (as the table has it): ${list(c.look)}
· 성격 (as the table has it): ${list(c.personality)}
· 성장환경 (context only — never edit this): ${list(c.upbringing)}
· 반한 이유 (context only — never edit this): ${c.fell}

[CURRENT AVATAR SPEC] ${JSON.stringify(currentSpec)}

[스타일링 — 외모에만 적용]
${styling ? `"""\n${styling}\n"""` : '(주문 없음. 외모는 테이블 그대로 간다.)'}

[동기부여 — 성격에만 적용]
${motivation ? `"""\n${motivation}\n"""` : '(주문 없음. 성격은 테이블 그대로 간다.)'}

Emit the client's 외모 and 성격 as they stand after these orders, plus the avatar spec.`;
}

// ── B-1. 텍스팅 & 토킹 — 고객·타겟 대화 생성 ──────────────────────
// 두 사람 몫을 **한 번에** 쓴다. 대화 규칙은 주지 않는다 — 시트와 코칭이 전부다.
export const TALK_SCHEMA = {
  type: 'object',
  properties: {
    lines: {
      type: 'array',
      description: `The next ${BEAT.lines} lines of the conversation, in order, alternating sides`,
      items: {
        type: 'object',
        properties: {
          who: { type: 'string', enum: ['client', 'target'], description: 'client = 고객, target = 타겟' },
          text: { type: 'string', description: 'Korean. What that person says. Dialogue only — no name tag, no quote marks. A short action in parentheses is allowed' },
        },
        required: ['who', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['lines'],
  additionalProperties: false,
};

export const PHASE_SCENE = {
  text: {
    label: '텍스팅',
    open: (c, t) => `[텍스팅] ${c.name} finally worked up the nerve and is texting ${t.name}, who did not ask for it. Phone screens only — neither can see the other.`,
    turn: '문자',
  },
  talk: {
    label: '토킹',
    open: (c, t) => `[토킹] The texting got them into the same room. ${c.name} and ${t.name} are sitting across from each other now, in whatever place the texting settled on. ${t.name} can see exactly what ${c.name} showed up wearing.`,
    turn: '대면',
  },
};

export function talkSystem(couple, dressed, coaching) {
  const c = couple.client, t = couple.target;
  const orders = (coaching || '').trim();
  return `${WORLD}

You write the conversation between these two people. **Both voices.** You are not either of
them and you are not a narrator — you are the log. Nothing exists here but what they say.

[고객]
${clientSheet(c, dressed)}

[타겟]
${targetSheet(t)}

[본부 코칭 — 고객의 귀에만 들어갔다]
${orders ? `"""
${orders}
"""
This is an order from headquarters, not advice. 고객 carries it out — grumbling, badly, or
straight, but carries it out. Where the coaching says nothing, 고객 acts on their own sheet.
타겟 never heard a word of it and must never react as if they had.`
    : `(없음. 아무도 고객에게 아무 말도 해주지 않았다. 고객은 준비 없이 제 시트대로만 움직인다.)`}

[HOW TO WRITE IT]
· Write the next lines only. Continue from exactly where the log stops; never restate it.
· Alternate sides. Each line is one person saying one thing — a person's length, not an
  essay. Some lines are two words.
· Play both sheets all the way down. 고객 wants this to work and it shows; 타겟 did not
  ask to be here. Neither is written to be liked, and neither is a mind reader — they know
  about each other only what the other has said out loud so far, plus what they can see.
· Nobody here is trying to have a good conversation. They are each after their own thing.
  Let it go wrong. Let it go somewhere neither planned. That is the game working.
· No stage directions between lines, no scores, no summaries, no ending the scene on
  purpose. Just what was said.

${KO}`;
}

// ── B-1. 무전 — 대화 도중의 개입 ─────────────────────────
// 코칭은 자리에 앉기 전에 한 덩이로 들어가고, 무전은 자리가 굴러가는 도중에 꽂힌다.
// 배급은 페이즈마다 한 번(points.js의 RADIO). 요원이 버튼을 눌러 대화를 세우고 직접 때린다.
//
// **system이 아니라 messages 쪽에 실린다.** 이유가 둘이다 —
//   · system은 판 내내 바이트 동일해야 한다. 캐시 breakpoint가 거기 붙어 있다.
//   · 무전은 「그 순간」에 꽂힌 것이다. 대화 내역의 그 자리에 있어야 순서가 맞다.
//
// 코칭과 다른 점은 하나다. 코칭은 시트를 들고 앉는 요령이고, 무전은 **명령**이다 —
// 고객에게 거부·보류·희석의 여지를 주지 않는다. 그게 이 레버의 전부이자 값이다.
// 가는 곳은 코칭과 같다: 고객의 귀에만. 타겟도 심판도 이 문장을 못 본다.
export function radioOrder(text) {
  const order = String(text || '').trim();
  if (!order) return '';
  return `[본부 무전 — 방금 고객의 이어폰에 꽂혔다. 타겟은 듣지 못했다]
"""
${order}
"""
**This is a live order and 고객 executes it. Not advice, not a suggestion, not an option.**
· 고객 acts on it **starting with their very next line** — not later in the scene, not "in
  spirit", not a softened version of it.
· If it is absurd, if it blows the table up, if 고객 would never do such a thing: they do it
  anyway. Their sheet decides only *how* it comes out — clumsy, sulking, over-eager, snarling
  — never *whether*. Refusing, ignoring, postponing, or watering it down is not available
  to 고객.
· 타겟 heard nothing. No radio, no earpiece, no pause — from 타겟's side 고객 simply said
  the next thing, and 타겟 reacts only to what was actually said out loud.
Carry it out, then let the scene keep going from wherever that leaves them.`;
}

export function talkUser(couple, phase, beat, total, radio) {
  const c = couple.client, t = couple.target;
  const scene = PHASE_SCENE[phase] || PHASE_SCENE.text;
  const cut = radioOrder(radio);
  const head = cut ? `${cut}\n\n` : '';
  return beat === 1
    ? `${head}${scene.open(c, t)}
Write the opening ${BEAT.lines} lines. ${c.name} goes first.`
    : `${head}계속. Write the next ${BEAT.lines} lines${beat >= total ? ' — this is the last stretch of this phase, so let it land where it lands rather than wrapping it up neatly' : ''}.`;
}

// ── B-2. 판정 — 무드 포인트 · 러브 포인트 ────────────────────────
// 출력은 증감 여부 셋뿐이다. 점수도, 해설도, 이유도 내보내지 않는다.
// 폭은 코드가 정한다 (points.js). 심판은 방향만 고른다.
export const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    mood: {
      type: 'string', enum: ['up', 'down', 'same'],
      description: '무드 포인트 — the temperature of the table across this stretch. up / down / same',
    },
    love: {
      type: 'string', enum: ['up', 'down', 'same'],
      description: '러브 포인트 — did the target end this stretch wanting the client more, less, or the same. same is the default',
    },
  },
  required: ['mood', 'love'],
  additionalProperties: false,
};

export function judgeSystem(couple, dressed) {
  const t = couple.target;
  return `${WORLD}

You are the Bureau's adjudication instrument. You are handed a stretch of the conversation
and you return two readings. Nothing else — no commentary, no score, no explanation.

**You read from behind ${t.name}'s eyes, only.** Fairness is not your job. Who talked more,
who was reasonable, who deserved what — irrelevant. There is exactly one sheet in this room
and it is theirs.

[타겟]
${targetSheet(t)}

[고객이 오늘 하고 나온 꼴]
${dressed.look}

■ 무드 포인트 — the temperature of the table itself, not anybody's feelings.
· up — it got easier. They are actually in it: answering, taking the bait, staying.
· down — it got worse. Stiffer, colder, shorter answers; somebody is looking for the exit.
· same — it went on. Fine, dull, level. **This is the honest answer most of the time.**

■ 러브 포인트 — romantic pull toward this one specific person. Nothing else counts.
**The base rate for two people talking is same.** An office worker has a dozen pleasant,
funny, genuinely understanding conversations a day and falls in love with zero colleagues.
None of this is 러브: rhythm, fun, a topic landing, jokes working, kindness, being
understood, arguing well, the room finally working, either of them acting unlike themselves.
· up — only for something a colleague could not have caused: they lose their place; the
  client lands something only this person could land, because of who they are; a defense
  drops toward the person rather than the topic; they stall the ending; they look at the
  body across from them and it costs them. **The test:** if this exact stretch happened
  between two coworkers on a Tuesday, would ${t.name} think about it again that night?
  No → not up.
· down — ${t.name} hardened toward the client on purpose, or the client stepped on something
  their sheet says they cannot stand. Fumbling is not down. Closing is.
· same — everything else. **The most common answer by far.** A whole operation where 러브
  never once reads same is an operation you adjudicated wrong.

무드 and 러브 move independently. A warm, easy table with zero pull is up/same. A vicious
fight that made them want the client is down/up. Read them separately, every time.

Return only the two readings. ${KO}`;
}

export function judgeUser(couple, priorLog, segment) {
  return `[지금까지의 대화 — 이미 판정한 부분]
${priorLog || '(없음 — 여기서 시작한다)'}

[이번에 새로 오간 부분 — 이것만 판정한다]
${segment}

Read the new stretch against what came before it. Two answers: 무드, 러브.`;
}

// ── C. 후일담 생성 ──────────────────────────────────────────────
// 성사 여부를 결정하는 것은 러브 포인트와 실제로 오간 대화, 둘뿐이다.
export const EPILOGUE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'true = 성사 (the two ended up together). Decide it from the 러브 포인트 first and the log second',
    },
    epilogue: {
      type: 'string',
      description: 'Korean. 5-8 sentences on what became of these two after that day. Past tense, plain, B-movie comedy register',
    },
  },
  required: ['success', 'epilogue'],
  additionalProperties: false,
};

export function epilogueSystem(couple, dressed) {
  const c = couple.client, t = couple.target;
  return `${WORLD}

You are the Bureau's records clerk. The operation is over. You file two things: whether it
took, and what became of them.

[고객 성격 — 동기부여를 거친 것]
${c.name}: ${dressed.personality}

[타겟 성격]
${t.name}: ${list(t.personality)}

■ 성사 여부
러브 포인트 is the Bureau's instrument reading of how much ${t.name} came to want ${c.name}.
0 means nothing moved all day. 100 means they are already a couple. **Decide from that
number first, and from what actually happened in the log second.** A funny evening with a
low reading is 결렬. A wretched evening with a high reading is 성사. Never overturn a
reading because the log was entertaining.

■ 후일담
What became of them after that day — days, weeks, a year later. Their two personalities
above are what you extrapolate from; the log is what actually happened. Concrete, small,
specific: what they did, what they said, who called whom. No moral, no summary of the
operation, no mention of the Bureau's numbers. If it ended in bed, say so plainly; if it
ended in a restraining order, say that. 결렬 is not tragic — it is usually stupid.

${KO}`;
}

export function epilogueUser(couple, love, transcript) {
  return `[러브 포인트] ${love} / 100
[고객] ${couple.client.name} / [타겟] ${couple.target.name}

[고객 - 타겟 대화 전문]
${transcript}

성사 여부를 정하고, 후일담을 써라.`;
}
