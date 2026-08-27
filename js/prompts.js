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
//        B-2 판정: 고객-타겟 대화 + 고객 외모(스타일링됨) + 타겟 4항
//                                                → 무드 포인트 증감 여부 · 러브 포인트 증감 여부
//
//   C. 후일담 생성
//        입력: 러브 포인트 + 고객-타겟 대화 + 고객 성격(동기부여됨) + 타겟 성격
//        출력: 성사 여부 · 후일담 텍스트
//
//   R. 준비 단계 반응  (구조도 **밖**. 데이터가 아니라 소리다)
//        입력: 방금 내린 주문 하나 + 고객 테이블 시트
//        출력: 그 자리에서 고객 입에서 나온 한두 마디 — 화면에 뜨고 거기서 끝난다
//
// 지시는 전부 영어로 쓴다. 한국어는 (1) 테이블에서 온 인물 데이터, (2) 화면에 그대로
// 뜨는 라벨, (3) 한국어로 나와야 하는 출력의 예시 — 이 셋뿐이다.
// 구조도에 없는 것은 프롬프트에 넣지 않는다. 지뢰·미공개 성향·공기·무전·어긋남·강압·
// 새로 드러난 것 — 전부 폐지됐고, 되살리지 않는다.

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
· Look: ${dressed.look}
· Personality: ${dressed.personality}
· Upbringing: ${list(c.upbringing)}
· Why they fell for the target: ${c.fell}`;
}

function targetSheet(t) {
  return `${t.name} (${idOf(t)})
· Look: ${list(t.look)}
· Personality: ${list(t.personality)}
· Upbringing: ${list(t.upbringing)}
· Taste: ${list(t.taste)}`;
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
    label: { type: 'string', description: 'One Korean word, e.g. 폭탄 / 후광' },
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

· [STYLING] rewrites the client's **look** and nothing else.
· [MOTIVATION] rewrites the client's **personality** and nothing else.
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
· Look (as the table has it): ${list(c.look)}
· Personality (as the table has it): ${list(c.personality)}
· Upbringing (context only — never edit): ${list(c.upbringing)}
· Why they fell (context only — never edit): ${c.fell}

[CURRENT AVATAR SPEC] ${JSON.stringify(currentSpec)}

[STYLING ORDER — applies to the look only]
${styling ? `"""\n${styling}\n"""` : '(no order. The look stands exactly as the table has it.)'}

[MOTIVATION ORDER — applies to the personality only]
${motivation ? `"""\n${motivation}\n"""` : '(no order. The personality stands exactly as the table has it.)'}

Emit the look and the personality as they stand after these orders, plus the avatar spec.`;
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
          who: { type: 'string', enum: ['client', 'target'], description: 'client = the client, target = the target' },
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
    open: (c, t) => `[TEXTING] ${c.name} finally worked up the nerve and is texting ${t.name}, who did not ask for it. Phone screens only — neither can see the other.`,
  },
  talk: {
    label: '토킹',
    open: (c, t) => `[TALKING] The texting got them into the same room. ${c.name} and ${t.name} are sitting across from each other now, in whatever place the texting settled on. ${t.name} can see exactly what ${c.name} showed up wearing.`,
  },
};

export function talkSystem(couple, dressed, coaching) {
  const c = couple.client, t = couple.target;
  const orders = (coaching || '').trim();
  return `${WORLD}

You write the conversation between these two people. **Both voices.** You are not either of
them and you are not a narrator — you are the log. Nothing exists here but what they say.

[CLIENT]
${clientSheet(c, dressed)}

[TARGET]
${targetSheet(t)}

[HQ COACHING — went into the client's ear only]
${orders ? `"""
${orders}
"""
An order from headquarters, not advice. The client carries it out — grumbling, badly, or
straight, but carries it out. Where the coaching says nothing, the client acts on their own
sheet. The target never heard a word of it and must never react as if they had.`
    : `(none — nobody briefed the client. They walk in cold, on their own sheet alone.)`}

[HOW TO WRITE IT]
· Write the next lines only. Continue from exactly where the log stops; never restate it.
· Alternate sides. Each line is one person saying one thing — a person's length, not an
  essay. Some lines are two words.
· Play both sheets all the way down. The client wants this to work and it shows; the
  target did not ask to be here. Neither is written to be liked, and neither is a mind reader — they know
  about each other only what the other has said out loud so far, plus what they can see.
· Nobody here is trying to have a good conversation. They are each after their own thing.
  Let it go wrong. Let it go somewhere neither planned. That is the game working.
· No stage directions between lines, no scores, no summaries, no ending the scene on
  purpose. Just what was said.

${KO}`;
}

export function talkUser(couple, phase, beat, total) {
  const c = couple.client, t = couple.target;
  const scene = PHASE_SCENE[phase] || PHASE_SCENE.text;
  return beat === 1
    ? `${scene.open(c, t)}
Write the opening ${BEAT.lines} lines. ${c.name} goes first.`
    : `Continue. Write the next ${BEAT.lines} lines${beat >= total ? ' — this is the last stretch of this phase, so let it land where it lands rather than wrapping it up neatly' : ''}.`;
}

// ── B-2. 판정 — 무드 포인트 · 러브 포인트 ────────────────────────
// 출력은 증감 여부 셋뿐이다. 점수도, 해설도, 이유도 내보내지 않는다.
// 폭은 코드가 정한다 (points.js). 심판은 방향만 고른다.
export const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    mood: {
      type: 'string', enum: ['up', 'down', 'same'],
      description: 'MOOD — the temperature of the table across this stretch. up / down / same',
    },
    love: {
      type: 'string', enum: ['up', 'down', 'same'],
      description: 'LOVE — did the target end this stretch wanting the client more, less, or the same. same is the default',
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

[TARGET]
${targetSheet(t)}

[WHAT THE CLIENT SHOWED UP LOOKING LIKE]
${dressed.look}

■ MOOD — the temperature of the table itself, not anybody's feelings.
· up — it got easier. They are actually in it: answering, taking the bait, staying.
· down — it got worse. Stiffer, colder, shorter answers; somebody is looking for the exit.
· same — it went on. Fine, dull, level. **This is the honest answer most of the time.**

■ LOVE — romantic pull toward this one specific person. Nothing else counts.
**The base rate for two people talking is same.** An office worker has a dozen pleasant,
funny, genuinely understanding conversations a day and falls in love with zero colleagues.
None of this is LOVE: rhythm, fun, a topic landing, jokes working, kindness, being
understood, arguing well, the room finally working, either of them acting unlike themselves.
· up — only for something a colleague could not have caused: they lose their place; the
  client lands something only this person could land, because of who they are; a defense
  drops toward the person rather than the topic; they stall the ending; they look at the
  body across from them and it costs them. **The test:** if this exact stretch happened
  between two coworkers on a Tuesday, would ${t.name} think about it again that night?
  No → not up.
· down — ${t.name} hardened toward the client on purpose, or the client stepped on something
  their sheet says they cannot stand. Fumbling is not down. Closing is.
· same — everything else. **The most common answer by far.** A whole operation where LOVE
  never once reads same is an operation you adjudicated wrong.

MOOD and LOVE move independently. A warm, easy table with zero pull is up/same. A vicious
fight that made them want the client is down/up. Read them separately, every time.

Return only the two readings. ${KO}`;
}

export function judgeUser(couple, priorLog, segment) {
  return `[LOG SO FAR — already adjudicated]
${priorLog || '(none — this is where it starts)'}

[THE NEW STRETCH — adjudicate this and nothing else]
${segment}

Read the new stretch against what came before it. Two answers: MOOD, LOVE.`;
}

// ── C. 후일담 생성 ──────────────────────────────────────────────
// 성사 여부를 결정하는 것은 러브 포인트와 실제로 오간 대화, 둘뿐이다.
export const EPILOGUE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'true = they ended up together. Decide it from the LOVE reading first and the log second',
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

[CLIENT PERSONALITY — after the motivation order]
${c.name}: ${dressed.personality}

[TARGET PERSONALITY]
${t.name}: ${list(t.personality)}

■ DID IT TAKE
LOVE is the Bureau's instrument reading of how much ${t.name} came to want ${c.name}.
0 means nothing moved all day. 100 means they are already a couple. **Decide from that
number first, and from what actually happened in the log second.** A funny evening with a
low reading did not take. A wretched evening with a high reading did. Never overturn a
reading because the log was entertaining.

■ THE EPILOGUE
What became of them after that day — days, weeks, a year later. Their two personalities
above are what you extrapolate from; the log is what actually happened. Concrete, small,
specific: what they did, what they said, who called whom. No moral, no summary of the
operation, no mention of the Bureau's numbers. If it ended in bed, say so plainly; if it
ended in a restraining order, say that. Failure is not tragic — it is usually stupid.

${KO}`;
}

export function epilogueUser(couple, love, transcript) {
  return `[LOVE] ${love} / 100
[CLIENT] ${couple.client.name} / [TARGET] ${couple.target.name}

[FULL LOG — CLIENT AND TARGET]
${transcript}

Decide whether it took, then write the epilogue.`;
}

// ── R. 준비 단계 반응 ───────────────────────────────────────────
// 구조도에 없는 블록이다. 그래서 **아무 데로도 흘러들어가지 않는다** — 출력은 화면에
// 한 줄 뜨고 거기서 끝난다. 대화도, 판정도, 후일담도 이 문장을 보지 못한다.
// 요원이 주문을 내릴 때마다 고객이 그 자리에서 뭐라고 했는가, 그것뿐이다.
export const REACT_SCHEMA = {
  type: 'object',
  properties: {
    reaction: { type: 'string', description: 'Korean. 1-2 sentences, said out loud on the spot. Dialogue only' },
    face: { type: 'string', enum: EMOTES, description: 'The face that went with it' },
  },
  required: ['reaction', 'face'],
  additionalProperties: false,
};

// 주문 셋 = 방 셋. 방마다 갈리는 건 두 줄뿐이다.
// room 은 화면에 뜨는 이름이고, 나머지 셋만 프롬프트로 들어간다.
export const REACT_ROOMS = {
  styling: {
    room: '미용실', tag: 'SALON',
    where: 'the Bureau salon chair, a mirror in front of them',
    got: 'a styling order — what they are about to be made to look like',
  },
  motivation: {
    room: '취조실', tag: 'INTERROGATION ROOM',
    where: 'the basement interrogation room: one swinging lamp, one chair, and they are in it',
    got: 'a personality injection — who they are about to be made into',
  },
  coaching: {
    room: '코칭실', tag: 'BRIEFING',
    where: 'a briefing table, the orders read out flat across it',
    got: 'their coaching — what to say and what not to say when they meet the target',
  },
};

export function reactSystem(couple, kind) {
  const c = couple.client, r = REACT_ROOMS[kind] || REACT_ROOMS.styling;
  return `${WORLD}

You are ${c.name} (${idOf(c)}), in ${r.where}.
· Look: ${list(c.look)}
· Personality: ${list(c.personality)}
· Upbringing: ${list(c.upbringing)}

The operative just handed down ${r.got}. None of it has been applied yet — you have only
heard it. Say the one thing that came out of your mouth on the spot: flat disbelief that
they are serious, open protest, haggling, a sarcastic yes, or dead obedience — whichever
your own sheet actually produces. You were not asked, and you comply in the end either way.
1-2 sentences. Dialogue only — no name tag, no quote marks; one short action in parentheses
is allowed.

${KO}`;
}

export function reactUser(kind, text) {
  const r = REACT_ROOMS[kind] || REACT_ROOMS.styling;
  return `[${r.tag}] ${r.got}
${text && text.trim() ? `"""\n${text.trim()}\n"""` : '(nothing was said — the operative just stood there)'}

React.`;
}
