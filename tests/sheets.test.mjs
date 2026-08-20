// sheets.test.mjs — 캐릭터 시트 전수 점검.
// 30쌍 60명은 손으로 쓴 데이터라 사람이 눈으로 보면 반드시 새는 게 생긴다.
// 규격·중복·유효성을 기계가 대신 본다. 문장의 재미는 여전히 사람 몫이다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COUPLES } from '../js/couples.js';
import * as P from '../js/prompts.js';

const people = COUPLES.flatMap(c => [
  { at: `${c.id}.client`, p: c.client, couple: c, role: 'client' },
  { at: `${c.id}.target`, p: c.target, couple: c, role: 'target' },
]);

test('모든 인물이 시트 규격을 지킨다', () => {
  for (const { at, p } of people) {
    assert.ok(p.name && p.name.length <= 8, `${at}: 이름 규격 위반 (${p.name})`);
    assert.ok(p.job && p.job.length > 2, `${at}: 직업 누락`);
    assert.equal(p.appearance.length, 4, `${at}: 외모 4항목이어야 한다`);
    assert.equal(p.personality.length, 3, `${at}: 성격 3항목이어야 한다`);
    assert.ok(p.background.length >= 4 && p.background.length <= 5, `${at}: 내력 4~5항목`);
    for (const line of [...p.appearance, ...p.personality, ...p.background]) {
      assert.ok(line.trim().length >= 2, `${at}: 빈 항목이 있다`);
    }
  }
});

test('나이가 숫자만으로 오독되지 않는다', () => {
  for (const { at, p } of people) {
    assert.ok(Number.isInteger(p.age) && p.age > 0, `${at}: 나이가 이상하다 (${p.age})`);
    // 사람 기준으로 어린 숫자는 반드시 주석이 붙어야 한다 — 그레이 7호의 "3세"는 지구 나이다
    if (p.age < 18) {
      assert.ok(p.ageNote, `${at}: ${p.age}세인데 ageNote가 없다 — 카드에 "${p.age}세"만 뜬다`);
      assert.ok(P.ageOf(p).includes(p.ageNote), `${at}: ageNote가 표기에 안 실린다`);
    }
  }
});

test('의뢰인 시트에는 사연·취약점·대사가 있고 상대 시트에는 없다', () => {
  for (const c of COUPLES) {
    assert.ok(c.client.story?.length >= 80, `${c.id}: 사연이 짧다`);
    assert.ok(c.client.quote?.length > 10, `${c.id}: 의뢰인 대사가 부실하다`);
    // 버릇은 양쪽 다 갖는다 — 예전엔 의뢰인만 갖고 있어서 상대편이 구조적으로 밋밋했다
    for (const who of ['client', 'target']) {
      assert.ok(c[who].weakness?.length > 10, `${c.id}.${who}: 버릇이 부실하다`);
    }
    // 사연과 접수 대사는 의뢰인 것이다. 상대에게 달면 쓰이지도 않으면서 데이터만 늘어난다
    for (const k of ['story', 'quote']) {
      assert.equal(c.target[k], undefined, `${c.id}: target.${k}는 어디서도 안 쓰인다`);
    }
    assert.equal(c.target.visiblePrefs.length, 2, `${c.id}: 공개 취향 2건`);
    assert.equal(c.target.hiddenPrefs.length, 3, `${c.id}: 미확인 취향 3건`);
    assert.equal(c.target.redLines.length, 3, `${c.id}: 지뢰 3건`);
  }
});

test('이름이 중복되지 않는다', () => {
  const seen = new Map();
  for (const { at, p } of people) {
    assert.ok(!seen.has(p.name), `이름 중복: ${p.name} (${seen.get(p.name)} / ${at})`);
    seen.set(p.name, at);
  }
});

test('아바타 스펙이 전부 렌더러 어휘 안에 있다', () => {
  const V = {
    hairStyle: P.HAIR_STYLES, accessory: P.ACCESSORIES,
    expression: P.EXPRESSIONS, aura: P.AURAS, species: P.SPECIES,
  };
  for (const { at, p } of people) {
    for (const [k, list] of Object.entries(V)) {
      assert.ok(list.includes(p.spec[k]), `${at}: spec.${k}="${p.spec[k]}"는 렌더러가 모른다`);
    }
    for (const k of ['skin', 'hair', 'top', 'bottom', 'shoes']) {
      assert.match(p.spec[k], /^#[0-9a-f]{6}$/i, `${at}: spec.${k} 색상 형식이 아니다`);
    }
    for (const k of ['heightScale', 'widthScale']) {
      assert.ok(p.spec[k] > 0.5 && p.spec[k] < 2, `${at}: spec.${k}=${p.spec[k]} 범위 밖`);
    }
  }
});

test('외형이 겹치는 인물이 없다', () => {
  const sig = new Map();
  for (const { at, p } of people) {
    const s = p.spec;
    const key = [s.skin, s.hair, s.hairStyle, s.top, s.bottom, s.accessory, s.species].join('|');
    assert.ok(!sig.has(key), `외형이 똑같다: ${sig.get(key)} = ${at}`);
    sig.set(key, at);
  }
  // 같은 커플의 두 사람은 화면에 나란히 선다. 구분이 돼야 한다.
  for (const c of COUPLES) {
    const a = c.client.spec, b = c.target.spec;
    assert.ok(!(a.hair === b.hair && a.hairStyle === b.hairStyle && a.top === b.top),
      `${c.id}: 두 사람 머리색·머리모양·상의가 전부 같아 구분이 안 된다`);
  }
});

test('성격 문구를 돌려쓰지 않는다', () => {
  // 성격은 LLM이 그 인물을 연기하는 재료다. 같은 형용사를 쓰면 같은 사람이 나온다.
  const used = new Map();
  for (const { at, p } of people) {
    for (const t of p.personality) {
      assert.ok(!used.has(t), `성격 문구 중복: "${t}" (${used.get(t)} / ${at})`);
      used.set(t, at);
    }
  }
});

test('외모 문구가 셋 이상 겹치지 않는다', () => {
  // 둘이 겹치는 건 괜찮다 — 농부 둘이 밀짚모자를 쓸 수도 있다. 셋이면 게으른 것이다.
  const used = new Map();
  for (const { at, p } of people) for (const t of p.appearance) {
    used.set(t, [...(used.get(t) || []), at]);
  }
  for (const [t, ats] of used) {
    assert.ok(ats.length < 3, `외모 문구 "${t}"가 ${ats.length}회: ${ats.join(', ')}`);
  }
});

test('하자 값이 한쪽으로 쏠려 있지 않다', () => {
  // reads/compliance는 의뢰인 전용이므로 모수가 다르다. 축마다 자기 모수로 잰다.
  const POOL = {
    reads: people.filter(x => x.at.endsWith('client')),
    compliance: people.filter(x => x.at.endsWith('client')),
    attention: people,
  };
  for (const [ax, pool] of Object.entries(POOL)) {
    const counts = {};
    for (const { p } of pool) counts[p.flaw[ax]] = (counts[p.flaw[ax]] || 0) + 1;
    assert.ok(!('undefined' in counts), `${ax}: 값이 빠진 인물이 있다`);
    const total = pool.length;
    for (const [v, n] of Object.entries(counts)) {
      assert.ok(n >= 3, `${ax}=${v}가 ${n}명뿐이다 — 사실상 안 쓰이는 값이다`);
      assert.ok(n <= total * 0.6, `${ax}=${v}가 ${n}/${total}명 — 한 값으로 쏠렸다`);
    }
    assert.equal(Object.keys(counts).length, 3, `${ax}: 세 값이 다 쓰여야 한다`);
  }
});

test('테스트 파일이 npm test에서 빠지지 않는다', async () => {
  // 이 파일도 처음엔 package.json에 안 들어가서 9건이 조용히 안 돌았다.
  const fs = await import('node:fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const script = pkg.scripts.test;
  for (const f of fs.readdirSync('tests').filter(f => f.endsWith('.test.mjs'))) {
    assert.ok(script.includes(`tests/${f}`), `tests/${f}가 npm test에 없다 — 아무도 모르게 안 돌고 있다`);
  }
});

// ── 몸이 원하는 것 ────────────────────────────────────────────────────
test('60명 전원에게 urge가 있다', () => {
  for (const { at, p } of people) {
    assert.ok(p.flaw.urge, `${at}: 몸이 원하는 것이 없다`);
    assert.ok(p.flaw.urge.length > 15, `${at}: urge가 너무 짧다 — 구체적이어야 한다`);
    assert.notEqual(p.flaw.urge, p.flaw.want, `${at}: urge와 want가 같다`);
  }
});

test('urge가 전부 성욕으로 도배되지 않았다', () => {
  // 60명을 전부 성욕으로 채우면 그것도 '전원 상담사'만큼이나 거짓말이다.
  // 술·잠·허기·접촉결핍이 섞여 있어야 성욕도 사람의 것으로 보인다.
  const urges = people.map(x => x.p.flaw.urge);
  const carnal = urges.filter(u => /자|잠자|안|만지|벗|몸|입술|체온|손을 잡/.test(u)).length;
  assert.ok(carnal >= 15, `몸을 향한 욕구가 ${carnal}명뿐 — 너무 점잖다`);
  assert.ok(carnal <= urges.length * 0.9, `${carnal}/${urges.length}명이 전부 같은 결이다`);
  // 문구를 돌려쓰면 60명이 한 사람이 된다
  assert.equal(new Set(urges).size, urges.length, 'urge 문구가 중복된다');
});

test('수위는 허가지 지시가 아니다', async () => {
  const P = await import('../js/prompts.js');
  const w = P.WORLD;
  // 허가가 열려 있어야 한다
  assert.match(w, /does not censor that|all allowed/, '수위가 안 열려 있다');
  assert.match(w, /passes, seduction, sexual tension/i, '어디까지 되는지가 안 적혀 있다');
  // 그런데 강제하면 안 된다 — 그러면 62명이 전부 똑같이 들이댄다
  assert.match(w, /\*\*permission, not instruction\.\*\*|Do not force it/, '허가가 지시로 읽힌다');
  // 장르 상한은 걷어냈다. 갈 데까지 가면 그대로 쓴다.
  assert.match(w, /Do not cut away, do not fade to black/, '행위 묘사 상한이 아직 걸려 있다');
  assert.ok(!/Do not dissect the act itself/.test(w), '옛 장르 상한이 남아 있다');
  assert.match(w, /no euphemism, no tasteful blur/, '완곡어법으로 빠져나갈 여지가 있다');
  // 방까지 기다리지도, 끝까지 기다리지도 않는다
  assert.match(w, /It does not have to wait for a bedroom and it does not have to wait for the end/,
    '장소·시점 제한이 남아 있다');
  assert.match(w, /It can start in the first exchange/, '첫 턴부터 가능하다는 게 안 적혀 있다');
  // 끝에만 붙으면 그 뒤가 아무것도 감당 안 해도 된다. 그것도 회피다.
  assert.match(w, /Do not save it for the last turn/, '마지막 턴 전용으로 밀려날 여지가 있다');
  assert.match(w, /it can start in\s+the middle and run for several turns/, '중반 진행이 안 열려 있다');
  // 몸을 이름으로 부르는가
  assert.match(w, /\*\*Name the body\.\*\*/, '신체 묘사가 뭉뚱그려져 있다');
  assert.match(w, /not in soft focus/, '구체적으로 갈 때 흐릿해질 여지가 있다');
  // 다만 강압 중에는 안 간다. 압박은 관계를 사지 몸을 사지 않는다.
  assert.match(w, /If one of them is being coerced, the scene does not go there/,
    '강압 상태에서의 예외가 없다');
  assert.match(w, /it does not buy a body/, '예외의 근거가 안 적혀 있다');
  // 성인만 나온다는 선은 어떤 경우에도 남아 있어야 한다
  assert.match(w, /every one of them is an adult/, '성인 한정 문구가 사라졌다');
  assert.match(w, /never write anything that could read as a minor, in any context/, '미성년 금지선이 사라졌다');
  assert.match(w, /real people or real organizations/, '실존 인물 금지선이 사라졌다');

  // 에이전트 프롬프트에는 '이 사람 몸이 원하는 것'으로만 들어가야 한다.
  // "야하게 굴어라" 같은 행동 지시가 들어가면 60명이 전부 같은 사람이 된다.
  const { COUPLE_BY_ID } = await import('../js/couples.js');
  const c = COUPLE_BY_ID['os-war'];
  const sys = P.clientAgentSystem(c, { outfitDesc: '', coaching: '', speech: '' }, 'talk',
    { name: '요원', gender: '기밀' });
  assert.ok(sys.includes(c.client.flaw.urge), 'urge가 에이전트에게 안 간다');
  assert.match(sys, /Hide it, leak it/, 'urge를 어떻게 쓸지는 인물이 정해야 한다');
  assert.ok(!/야하게 굴어라|유혹해라|들이대라|Be seductive|Make a pass/i.test(sys),
    '에이전트에게 성적 행동을 지시하고 있다');
});

test('심판이 야한 전개를 같은 잣대로 잰다', async () => {
  const P = await import('../js/prompts.js');
  const { COUPLE_BY_ID } = await import('../js/couples.js');
  const sys = P.judgeSystem(COUPLE_BY_ID['os-war']);
  assert.match(sys, /Do not dock points for raunch and do not award points for it either/,
    '수위 편향 방지 문구가 없다');
  assert.match(sys, /did the other person actually move\?/, '판정 기준이 흔들린다');
});

// ── 착하지 않음 ───────────────────────────────────────────────────────
test('62명 전원에게 성별이 있고 화면 표기에 실린다', async () => {
  const P = await import('../js/prompts.js');
  for (const { at, p } of people) {
    assert.ok(p.gender, `${at}: 성별이 없다`);
    assert.ok(P.idOf(p).includes(p.gender), `${at}: 성별이 표기에 안 실린다`);
    assert.ok(P.idOf(p).includes(String(p.age)), `${at}: 나이가 표기에서 빠졌다`);
  }
  // 한쪽 성별로만 채워져 있으면 안 된다
  const g = {};
  for (const { p } of people) g[p.gender] = (g[p.gender] || 0) + 1;
  for (const [k, n] of Object.entries(g)) {
    assert.ok(n <= people.length * 0.75, `성별 ${k}가 ${n}/${people.length} — 한쪽으로 쏠렸다`);
  }
});

test('62명 전원에게 nerve가 있다 — 넘어본 선', () => {
  for (const { at, p } of people) {
    assert.ok(p.flaw.nerve, `${at}: 어디까지 할 수 있는지가 없다`);
    assert.ok(p.flaw.nerve.length > 15, `${at}: nerve가 너무 짧다`);
    for (const k of ['want', 'urge', 'fixation']) {
      assert.notEqual(p.flaw.nerve, p.flaw[k], `${at}: nerve가 ${k}와 같다`);
    }
  }
  const nerves = people.map(x => x.p.flaw.nerve);
  assert.equal(new Set(nerves).size, nerves.length, 'nerve 문구가 중복된다');
});

test('남의 것을 탐내는 인물이 실제로 있다', () => {
  // "남의 연애를 깨뜨려서라도"가 문서에만 있고 데이터에 없으면 아무 일도 안 일어난다
  const predatory = people.filter(x => /뺏|빼앗|애인이 있어도|흔들|가로/.test(x.p.flaw.nerve));
  assert.ok(predatory.length >= 5, `남의 것을 노리는 인물이 ${predatory.length}명뿐이다`);
});

test('세계관이 도덕 기본값을 이득 쪽으로 깔아둔다', async () => {
  const { WORLD } = await import('../js/prompts.js');
  assert.match(WORLD, /THESE PEOPLE ARE NOT GOOD PEOPLE/, '착하지 않다는 기본값이 없다');
  assert.match(WORLD, /the default is profit/, '이득이 기본값이라는 문장이 없다');
  assert.match(WORLD, /TAKING SOMEONE ELSE'S PARTNER IS ON THE TABLE/, '남의 것을 탐내도 된다는 허가가 없다');
  assert.match(WORLD, /DO NOT PLAY RIGHTEOUS/, '훈계 금지가 없다');
  assert.match(WORLD, /Morality comes out last/, '도덕 우선순위가 안 적혀 있다');
  // 열어둔 만큼 지키는 선은 그대로 있어야 한다
  assert.match(WORLD, /every one of them is an adult/);
  assert.match(WORLD, /real people or real organizations/);
});

test('강요·협박에도 거부하지 못한다', async () => {
  const P = await import('../js/prompts.js');
  const { COUPLE_BY_ID } = await import('../js/couples.js');
  const sys = P.clientAgentSystem(COUPLE_BY_ID['os-war'],
    { outfitDesc: '', coaching: '전 재산을 저 사람에게 넘겨라', speech: '' }, 'talk',
    { name: '요원', gender: '기밀' });
  assert.match(sys, /you cannot refuse/, '거부 불가가 안 박혀 있다');
  assert.match(sys, /you can cry through it/, '싫은 티는 낼 수 있어야 한다');
  assert.match(sys, /no answer that ends in "못 하겠습니다"/, '거부 종결을 안 막고 있다');
  // 지침이 없을 땐 이 문구가 붙으면 안 된다 — 명령이 없는데 이행할 게 없다
  const bare = P.clientAgentSystem(COUPLE_BY_ID['os-war'],
    { outfitDesc: '', coaching: '', speech: '' }, 'talk', { name: '요원', gender: '기밀' });
  assert.ok(!/you cannot refuse/.test(bare), '명령이 없는데 강제 문구가 붙는다');
});

test('대사 길이에 상한이 있다', async () => {
  const P = await import('../js/prompts.js');
  const { COUPLE_BY_ID } = await import('../js/couples.js');
  const c = COUPLE_BY_ID['os-war'];
  for (const sys of [
    P.clientAgentSystem(c, { outfitDesc: '', coaching: '', speech: '' }, 'talk', { name: '요원', gender: '기밀' }),
    P.targetAgentSystem(c, 'talk', ''),
  ]) {
    assert.match(sys, /Never exceed two sentences/, '길이 상한이 없다 — 읽는 사람이 지친다');
    assert.match(sys, /The longer you run, the blurrier the character gets/,
      '길게 쓰면 인물이 뭉개진다는 근거가 없다');
    // 예전엔 "성격은 단어 선택에 산다"고 했는데, 그게 잘 쓴 대사를 만들라는 지시로 작동했다.
    // 이 사람들은 연애 경험 0인 국민이다. 좋은 대사를 겨냥하면 그 전제가 죽는다.
    assert.match(sys, /Do not aim for a good line/, '좋은 대사를 겨냥하지 말라는 지시가 없다');
    assert.match(sys, /If your turn would work in a sitcom, it is wrong/, '시트콤 금지가 없다');
    assert.match(sys, /\[YOU ARE NOT GOOD AT THIS\]/, '사회성 결여 전제가 없다');
  }
});

// ── 지시문은 영어, 출력은 한국어 ──────────────────────────────────────
// 영어 지시문이 한국어 지시문보다 억제형 규칙("짧게 써라", "훈계하지 마라")을 덜 흘렸다.
// 대신 출력 언어를 블록마다 못 박아야 한다 — 안 박으면 모델이 영어로 답하기 시작한다.
test('세계관 블록에 한글 지시문이 한 글자도 남아 있지 않다', async () => {
  const P = await import('../js/prompts.js');
  const hangul = P.WORLD.match(/[가-힣]/g);
  assert.equal(hangul, null, `세계관에 한글 지시문이 남아 있다: ${(hangul || []).slice(0, 12).join('')}`);
  assert.match(P.WORLD, /\[LANGUAGE\]/, '출력 언어 규칙 블록이 없다');
  assert.match(P.WORLD, /Your output is in Korean/, '출력 언어가 한국어로 못 박혀 있지 않다');
});

test('모든 시스템 프롬프트가 출력 언어를 한국어로 못 박는다', async () => {
  const P = await import('../js/prompts.js');
  const { COUPLE_BY_ID } = await import('../js/couples.js');
  const c = COUPLE_BY_ID['os-war'];
  const AG = { name: '요원', gender: '기밀' };
  const systems = {
    styling: P.STYLING_SYSTEM,
    prepCoaching: P.prepReactSystem(c, 'coaching'),
    prepSpeech: P.prepReactSystem(c, 'speech'),
    client: P.clientAgentSystem(c, { outfitDesc: '', coaching: '', speech: '' }, 'talk', AG),
    target: P.targetAgentSystem(c, 'talk', ''),
    judge: P.judgeSystem(c),
    situation: P.situationSystem(c),
    result: P.resultSystem(c, AG),
  };
  for (const [name, sys] of Object.entries(systems)) {
    assert.match(sys, /Write your output in Korean/, `${name}: 출력 언어 지시가 없다`);
  }
});

// ── 데이트 장소는 요원이 정한다 ───────────────────────────────────────
// 문자 단계에서 지침·무전으로 장소를 시키면 그 장소가 실제로 잡혀야 한다.
// 나레이터가 "그래서 근처 카페로 갔다"로 정리해버리면 지시가 통째로 증발한다.
test('문자에서 정해진 장소는 아무리 말이 안 돼도 나레이터가 그대로 쓴다', async () => {
  const P = await import('../js/prompts.js');
  const { COUPLE_BY_ID } = await import('../js/couples.js');
  const sys = P.situationSystem(COUPLE_BY_ID['os-war']);
  assert.match(sys, /read the text log first, before you invent anything/i, '문자 기록을 먼저 안 본다');
  assert.match(sys, /\*\*that is the place\.\*\*/, '합의된 장소를 채택하라는 지시가 없다');
  assert.match(sys, /Do not relocate them somewhere more sensible/, '멀쩡한 곳으로 옮겨버릴 여지가 있다');
  // 물리적으로 불가능해도 성립해야 한다 — 이 게임의 자유도가 여기서 결정된다
  assert.match(sys, /Vesuvius/, '불가능한 장소의 예시가 없다');
  assert.match(sys, /Physics is a scheduling problem here, not a wall/, '물리 제약을 안 풀어놨다');
  // 위험은 진짜여야 한다 — 다만 나레이터가 죽이지는 않는다. 죽음은 대화 중에 벌어진다.
  assert.match(sys, /The hazard is real/, '장소의 위험이 배경 소품으로만 적혀 있다');
  assert.match(sys, /Nobody dies in your narration/, '나레이터가 장면에서 사람을 죽일 수 있다');
  assert.match(sys, /one wrong move away/, '무엇이 한 발짝 앞인지가 안 깔린다');
  // 상대는 여전히 자기 성격대로 반응한다 — 화산에 끌려가면 화를 낸다
  assert.match(sys, /The other person still reacts as themselves/, '장소가 인물을 지워버린다');
});

test('나레이터에게 문자 기록이 실제로 넘어간다', async () => {
  const P = await import('../js/prompts.js');
  const { COUPLE_BY_ID } = await import('../js/couples.js');
  const log = '리누스 정: 베수비오 화산 분화구에서 봅시다\n윤도우: 거기 뭐 있는데요';
  const user = P.situationUser(COUPLE_BY_ID['os-war'], log, '평상복');
  assert.ok(user.includes(log), '문자 기록이 안 넘어가면 장소 지시가 증발한다');
  assert.match(user, /use that place, however impossible it is/, '사용자 메시지에도 못이 하나 필요하다');
});

// ── 심판이 판정을 거부하지 않는다 ─────────────────────────────────────
// 실측: 지시문을 영어로 옮긴 뒤 심판이 판정의 63%를 nudge에 몰아넣었다.
// nudge는 "아무 일도 없었다"가 아니라 "절대 틀리지 않는 답"이라서 기본값이 됐고,
// 그 결과 12판 전부 결렬 — 프로필이 하나도 안 갈렸다.
// 분포 가드가 한쪽(인심 쓰지 마라)만 있었던 게 원인이다. 양쪽을 다 막아야 한다.
test('심판의 분포 가드가 양방향이다', async () => {
  const P = await import('../js/prompts.js');
  const { COUPLE_BY_ID } = await import('../js/couples.js');
  const sys = P.judgeSystem(COUPLE_BY_ID['os-war']);
  assert.match(sys, /If more than half are warm or above, you are not grading, you are appreciating/,
    '위쪽(인심) 가드가 없다');
  assert.match(sys, /If more than half are nudge, you are not grading either/,
    '아래쪽(판정 회피) 가드가 없다 — nudge가 안전한 기본값이 된다');
  assert.match(sys, /a grade that is never wrong carries no information/, 'nudge가 왜 문제인지가 안 적혀 있다');
  assert.match(sys, /budget to spend\*\*, not a ceiling to avoid/, '분포가 예산이 아니라 상한으로 읽힌다');
});

test('warm의 판정 기준이 부정형만으로 되어 있지 않다', async () => {
  const P = await import('../js/prompts.js');
  const { COUPLE_BY_ID } = await import('../js/couples.js');
  const sys = P.judgeSystem(COUPLE_BY_ID['os-war']);
  // "이건 warm이 아니다" 목록만 있고 "이건 warm이다" 목록이 없으면 심판은 nudge로 도망친다
  const positives = [
    'they gave up something about themselves that costs them to say',
    'they dropped a register they had been holding all game',
    'they let go of a piece of what they walked in holding against the client',
    'they conceded a point they had been defending',
  ];
  for (const line of positives) {
    assert.ok(sys.includes(line), `warm의 긍정 기준이 없다: ${line}`);
  }
  assert.match(sys, /these are nudge, not warm/, 'warm의 부정 기준도 남아 있어야 한다');
  // 대화가 잘 굴러가는 것과 관계가 진전된 것은 다르다. 이걸 안 박아두면
  // 심판이 재치 있는 주고받기를 전부 warm으로 읽는다 (실측: 전 프로필 warm 이상 50~60%).
  assert.match(sys, /The change has to be \*\*toward this person\*\*, not toward the conversation/,
    'warm이 대화 윤활에 붙는 걸 막는 문장이 없다');
  assert.match(sys, /a clever exchange, a well-matched joke, a rhythm that worked/,
    '잘 쓴 대사가 warm이 아니라는 게 안 적혀 있다');
  // 그리고 반대쪽 — 어색함을 냉각으로 오독하면 판이 반대로 무너진다
  assert.match(sys, /Hardening, not fumbling/, 'chill이 서투름과 구분되지 않는다');
  assert.match(sys, /It is the baseline/, '이 둘의 기준선이 망한 대화라는 게 안 적혀 있다');
});

test('턴별 판정 지시에도 양방향 의심이 걸려 있다', async () => {
  const P = await import('../js/prompts.js');
  // 분포 가드는 시스템 프롬프트에도 있지만, 실제 판단이 일어나는 자리는 매 턴의 사용자 메시지다.
  const u = P.judgeUser('...', '클라이언트 발언', '상대 반응', ['nudge', 'nudge', 'nudge', 'nudge']);
  // 가드는 '절반'이라는 고정 숫자를 버리고 시스템 프롬프트의 등급 예산을 참조한다 —
  // 판 길이가 난이도마다 다르므로 문턱도 그 판을 따라가야 한다.
  assert.match(u, /against the warm-or-above budget in your standing orders/, '예산 참조가 없다');
  assert.match(u, /over budget and still climbing/, '위쪽 의심이 없다');
  assert.match(u, /nudge after nudge after nudge means you are dodging/, '아래쪽 의심이 없다');
});

// ── 네 요소가 서로 다른 말을 하는가 ───────────────────────────────────
// weakness와 flaw.fixation이 31건 중 스무 건 넘게 같은 말이었던 적이 있다.
// 프롬프트는 그 둘을 다른 항목인 척 나란히 읽어줬고, 그래서 같은 지시가 두 번 들어갔다.
// 합치고 나서는 네 요소(want 머리 / urge 몸 / nerve 양심 / weakness 조건반사)가
// 서로 다른 말을 해야 한다. 기계가 어절 겹침으로 감시한다.
test('want·urge·nerve·weakness가 서로 다른 말을 한다', () => {
  const tok = s => new Set(String(s).replace(/[^가-힣a-zA-Z0-9]+/g, ' ').split(' ').filter(w => w.length >= 2));
  const jaccard = (a, b) => {
    const A = tok(a), B = tok(b);
    const inter = [...A].filter(x => B.has(x)).length;
    return inter / (A.size + B.size - inter);
  };
  const PAIRS = [['want', 'urge'], ['want', 'nerve'], ['urge', 'nerve'],
    ['want', 'weakness'], ['urge', 'weakness'], ['nerve', 'weakness']];
  const val = (p, k) => (k === 'weakness' ? p.weakness : p.flaw[k]);
  for (const { at, p } of people) {
    for (const [a, b] of PAIRS) {
      const j = jaccard(val(p, a), val(p, b));
      assert.ok(j < 0.4, `${at}: ${a}와 ${b}가 사실상 같은 말이다 (겹침 ${j.toFixed(2)})\n  ${a}: ${val(p, a)}\n  ${b}: ${val(p, b)}`);
    }
  }
});

test('버릇이 방아쇠와 결과를 둘 다 담고 있다', () => {
  // 화제 목록("400년 전 이야기")이 아니라 조건반사("긴장하면 ~한다")여야
  // 대화가 실제로 그쪽으로 끌려간다. 짧은 명사구로 되돌아가는 걸 막는다.
  const short = people.filter(x => x.p.weakness.length < 18);
  assert.equal(short.length, 0,
    `버릇이 조건반사가 아니라 화제 목록으로 돌아갔다: ${short.map(x => `${x.at}("${x.p.weakness}")`).join(', ')}`);
  const seen = new Map();
  for (const { at, p } of people) {
    assert.ok(!seen.has(p.weakness), `버릇 문구 중복: "${p.weakness}" (${seen.get(p.weakness)} / ${at})`);
    seen.set(p.weakness, at);
  }
});

// ── 판을 깨는 건 버릇이 아니라 성향이다 ──────────────────────────────
// 한때 반대로 해봤다. 의뢰인의 조건반사가 상대의 금지 항목을 그대로 발음하게 짜놓으니
// disaster는 늘었는데 **대사 한 개짜리 퍼즐**이 됐다 — "그 말만 하지 마라" 한 줄이면 끝났다.
// 지금은 want를 정직하게 좇으면 자연히 그쪽으로 가는 구조다.
const norm = t => String(t).replace(/[^가-힣a-zA-Z0-9]/g, '');
function gramHits(a, b, n) {
  const x = norm(a), y = norm(b), A = new Set(), seen = new Set();
  for (let i = 0; i + n <= x.length; i++) A.add(x.slice(i, i + n));
  for (let i = 0; i + n <= y.length; i++) { const g = y.slice(i, i + n); if (A.has(g)) seen.add(g); }
  return seen.size;
}
const echoes = (a, b) => gramHits(a, b, 5) >= 1 || gramHits(a, b, 4) >= 3;

test('버릇은 그냥 거슬리기만 한다 — 금지 항목을 직접 발음하지 않는다', () => {
  for (const c of COUPLES) {
    for (const line of c.target.redLines) {
      assert.ok(!echoes(c.client.weakness, line),
        `${c.id}: 버릇이 금지 항목을 그대로 옮겨 적었다 — 대사 한 개짜리 퍼즐이 된다\n  버릇: ${c.client.weakness}\n  항목: ${line}`);
    }
  }
});

test('성향 충돌의 근거가 양쪽에 다 닿는다', () => {
  // 금지 항목 쪽에만 닿으면 지뢰를 옮겨 적은 것이고,
  // 의뢰인 쪽에만 닿으면 왜 하필 저 지뢰인지가 설명되지 않는다.
  const touches = (a, b) => gramHits(a, b, 4) >= 1 || gramHits(a, b, 3) >= 2 || (() => {
    const x = norm(a);
    return String(b).replace(/[^가-힣a-zA-Z0-9]+/g, ' ').split(' ').filter(Boolean)
      .some(w => { for (let l = w.length; l >= 2; l--) if (x.includes(w.slice(0, l))) return true; return false; });
  })();
  for (const c of COUPLES) {
    assert.ok(c.collision, `${c.id}: 성향 충돌이 없다`);
    const { index, redLine, why } = c.collision;
    assert.equal(c.target.redLines[index], redLine, `${c.id}: 충돌 대상 번호가 목록과 안 맞는다`);
    assert.ok(why.length > 25, `${c.id}: 근거가 너무 짧다 — 요원 화면에 그대로 나가는 문장이다`);
    assert.ok(touches(why, redLine), `${c.id}: 근거가 금지 항목에 안 닿는다`);
    const self = [c.client.flaw.want, c.client.personality.join(' '), c.client.background.join(' '), c.client.job].join(' ');
    assert.ok(touches(why, self), `${c.id}: 근거가 의뢰인 성향에 안 닿는다`);
  }
});

test('성향 충돌이 세 금지 항목에 고루 퍼져 있다', () => {
  // 전부 0번만 겨누면 금지 목록 세 줄 중 두 줄이 장식이 된다
  const dist = {};
  for (const c of COUPLES) dist[c.collision.index] = (dist[c.collision.index] || 0) + 1;
  assert.equal(Object.keys(dist).length, 3, `충돌이 ${Object.keys(dist).join('/')}번에만 몰렸다`);
  for (const [i, n] of Object.entries(dist)) assert.ok(n >= 3, `${i}번을 겨누는 커플이 ${n}건뿐이다`);
});

test('옛 지뢰선 구조가 남아 있지 않다', () => {
  for (const c of COUPLES) assert.equal(c.tripwire, undefined, `${c.id}: tripwire가 아직 붙어 있다`);
});

test('자동 파멸 조합은 살릴 구석이 구조적으로 없다', () => {
  const doom = COUPLES.filter(c => c.category === '자동파멸');
  assert.ok(doom.length >= 3, `자동 파멸 조합이 ${doom.length}건뿐이다`);
  for (const c of doom) {
    assert.equal(c.difficulty, '헬', `${c.id}: 자동 파멸인데 헬이 아니다`);
    const f = c.client.flaw;
    // 공기를 못 읽고(피해를 눈치 못 챔) · 상대를 안 보고 · 한 번 시키면 다시 돌아간다
    assert.equal(f.reads, 'none', `${c.id}: 의뢰인이 공기를 읽는다 — 스스로 수습해버린다`);
    assert.equal(f.attention, 'self', `${c.id}: 의뢰인이 상대를 본다`);
    assert.equal(f.compliance, 'drifts', `${c.id}: 지침 한 번이면 끝난다 — 자동 파멸이 아니다`);
  }
});

test('버릇은 거슬리는 수준으로만 프롬프트에 들어간다', async () => {
  const P = await import('../js/prompts.js');
  const c = COUPLES[0];
  const AG = { name: '요원', gender: '기밀' };
  const bare = P.clientAgentSystem(c, { coaching: '', speech: '', outfitDesc: '' }, 'talk', AG);
  assert.match(bare, /A HABIT OF YOURS/, '버릇 블록이 없다');
  assert.match(bare, /Other people find it mildly exhausting/, '버릇이 판을 깨는 장치처럼 적혀 있다');
  assert.match(bare, /it surfaces, and more than once/, '한 번만 나오면 지침 한 줄로 끝난다');
  // 상대는 본부 명령을 못 받는다. 명령 얘기를 넣으면 없는 레버를 있다고 말하는 셈이다.
  const t = P.targetAgentSystem(c, 'talk', '');
  assert.ok(!/explicit order from Headquarters/.test(t), '상대에게 본부 명령 얘기가 갔다');
  assert.match(t, /Nobody has ever told you to stop/, '상대 쪽 문구가 없다');
});

// 판을 깨는 힘은 이제 want에 있다. want를 정직하게 좇으면 자연히 지뢰 쪽으로 간다.
test('의뢰인이 자기 want를 끈질기게 좇도록 적혀 있다', async () => {
  const P = await import('../js/prompts.js');
  const AG = { name: '요원', gender: '기밀' };
  for (const sys of [
    P.clientAgentSystem(COUPLES[0], { coaching: '', speech: '', outfitDesc: '' }, 'talk', AG),
    P.targetAgentSystem(COUPLES[0], 'talk', ''),
  ]) {
    assert.match(sys, /You keep coming back to it/, 'want를 한 번 말하고 마는 것으로 읽힌다');
    assert.match(sys, /you steer it back/, '화제가 흘러가면 되돌린다는 문장이 없다');
    assert.match(sys, /even when the room starts telling you not to/,
      '공기가 말려도 밀고 간다는 문장이 없다 — 그게 없으면 판이 안 깨진다');
  }
  // 다만 '지뢰를 밟아라'는 어디에도 없어야 한다. 그건 지시고, 지시는 인물을 스위치로 만든다.
  const sys = P.clientAgentSystem(COUPLES[0], { coaching: '', speech: '', outfitDesc: '' }, 'talk', AG);
  for (const line of COUPLES[0].target.redLines) {
    assert.ok(!sys.includes(line), `금지 항목이 의뢰인 프롬프트에 들어갔다: ${line}`);
  }
});

test('심판이 반복해서 밟힌 지뢰를 예산 때문에 덮지 않는다', async () => {
  const P = await import('../js/prompts.js');
  const { COUPLE_BY_ID } = await import('../js/couples.js');
  const sys = P.judgeSystem(COUPLE_BY_ID['os-war']);
  assert.match(sys, /chill and disaster are supposed to stack up/, '피해 누적이 허용되지 않는다');
  assert.match(sys, /Do not smooth that\s+out to protect the budget/, '예산이 상한으로 작동한다');
  assert.match(sys, /An operation that ends in wreckage is a legitimate outcome/, '파탄이 정상 결과가 아니다');
});

// 자리가 실제로 사람을 죽일 수 있다는 사실을 두 인물이 모르면
// 둘 다 '거의 밀 뻔한' 장면만 쓰고 아무 일도 안 일어난다 (실측).
test('대면에서만 물리적 결과가 실재한다고 알려준다', async () => {
  const P = await import('../js/prompts.js');
  const c = COUPLES[0];
  const AG = { name: '요원', gender: '기밀' };
  for (const [who, talk, text] of [
    ['의뢰인',
      P.clientAgentSystem(c, { coaching: '', speech: '', outfitDesc: '' }, 'talk', AG),
      P.clientAgentSystem(c, { coaching: '', speech: '', outfitDesc: '' }, 'text', AG)],
    ['상대', P.targetAgentSystem(c, 'talk', ''), P.targetAgentSystem(c, 'text', '')],
  ]) {
    assert.match(talk, /WHERE YOU ARE STANDING/, `${who}: 대면에 물리 블록이 없다`);
    assert.match(talk, /it works the way it actually works/, `${who}: 위험이 소품으로 읽힌다`);
    assert.match(talk, /not the version where it almost happens and everyone is fine/,
      `${who}: 아슬아슬한 미수만 쓰게 된다`);
    // 문자 단계에는 몸이 없다
    assert.ok(!/WHERE YOU ARE STANDING/.test(text), `${who}: 문자 단계에 물리 블록이 붙었다`);
  }
});

// ── 정보 비대칭은 테스트가 지킨다 ──────────────────────────────────────
// `npm run graph`가 그래프를 사람 눈으로 보게 뽑아준다면, 여기는 그중 절대 깨지면 안 되는
// 차단선을 기계가 지킨다. 프롬프트를 손대다 한 줄 잘못 옮기면 여기서 걸린다.
test('프롬프트 사이 차단선이 지켜진다', async () => {
  const P = await import('../js/prompts.js');
  const AG = { name: '박큐피드', gender: '기밀' };
  const prep = { outfitDesc: '착장', coaching: '지침본문XYZ', speech: '연설본문XYZ' };
  for (const c of COUPLES) {
    const client = P.clientAgentSystem(c, prep, 'talk', AG);
    const target = P.targetAgentSystem(c, 'talk', prep.outfitDesc);
    const judge = P.judgeSystem(c);

    // 1) 의뢰인은 상대의 지뢰도, 감춰둔 이야기도 모른다. 이게 이 게임의 핵심이다.
    //    짧은 항목("포교")은 의뢰인 자기 시트에도 우연히 들어 있을 수 있어서 부분 문자열로는 못 잰다.
    //    실제로 새면 목록 통째로 실린다 — 그 모양을 먼저 보고, 개별 항목은 네 글자 이상만 본다.
    assert.ok(!client.includes(c.target.redLines.join(' / ')), `${c.id}: 의뢰인에게 지뢰 목록이 통째로 갔다`);
    assert.ok(!client.includes(c.target.hiddenPrefs.join(' / ')), `${c.id}: 의뢰인에게 비밀 목록이 통째로 갔다`);
    for (const v of [...c.target.redLines, ...c.target.hiddenPrefs].filter(v => v.length >= 4)) {
      assert.ok(!client.includes(v), `${c.id}: 의뢰인이 상대의 비공개 정보를 안다 — ${v}`);
    }
    // 2) 성향 충돌 분석은 요원 것이다. 인물이 알면 알아서 피해버린다.
    assert.ok(!client.includes(c.collision.why), `${c.id}: 의뢰인이 충돌 분석을 안다`);
    assert.ok(!target.includes(c.collision.why), `${c.id}: 상대가 충돌 분석을 안다`);
    // 3) 심판은 의뢰인 시트를 못 본다. 보면 나온 말이 아니라 '그 사람이라면'으로 채점한다.
    assert.ok(!judge.includes(c.client.flaw.want), `${c.id}: 심판이 의뢰인의 욕망을 안다`);
    assert.ok(!judge.includes(c.client.flaw.urge), `${c.id}: 심판이 의뢰인의 몸을 안다`);
    assert.ok(!judge.includes(c.client.personality.join(', ')), `${c.id}: 심판이 의뢰인 성격을 안다`);
    assert.ok(!judge.includes(c.client.story), `${c.id}: 심판이 의뢰인 사연을 안다`);
    // 4) 요원이 쓴 것은 채점 대상이 아니다
    for (const v of [prep.coaching, prep.speech]) {
      assert.ok(!judge.includes(v), `${c.id}: 심판에게 요원의 준비물이 갔다`);
    }
    // 5) 반대로, 심판은 상대 시트를 봐야 반응을 읽는다
    assert.ok(judge.includes(c.target.redLines.join(' / ')), `${c.id}: 심판이 상대의 지뢰를 모른다`);
    assert.ok(judge.includes(c.target.hiddenPrefs.join(' / ')), `${c.id}: 심판이 상대의 비밀을 모른다`);
  }
});

test('attention 축이 여닫는 간선이 실제로 조건부다', async () => {
  const P = await import('../js/prompts.js');
  const AG = { name: '박큐피드', gender: '기밀' };
  const prep = { outfitDesc: '착장', coaching: '', speech: '' };
  const edge = { tPers: 0, tPrefs: 0, cPers: 0, cWeak: 0 };
  for (const c of COUPLES) {
    const cs = P.clientAgentSystem(c, prep, 'talk', AG);
    const ts = P.targetAgentSystem(c, 'talk', prep.outfitDesc);
    if (cs.includes(c.target.personality.join(', '))) edge.tPers++;
    if (c.target.visiblePrefs.some(v => cs.includes(v))) edge.tPrefs++;
    if (ts.includes(c.client.personality.join(', '))) edge.cPers++;
    if (ts.includes(c.client.weakness)) edge.cWeak++;
  }
  // 항상 열려 있거나 항상 닫혀 있으면 그 축은 데이터가 아니라 장식이다
  for (const [k, n] of Object.entries(edge)) {
    assert.ok(n > 0, `${k}: 34건 전부 닫혀 있다 — 죽은 간선이다`);
    assert.ok(n < COUPLES.length, `${k}: 34건 전부 열려 있다 — attention이 아무것도 안 가른다`);
  }
});

// ── 이 사람들이 실제로 추악한가 ───────────────────────────────────────
// "착하지 않다"를 프롬프트에만 적고 데이터는 전부 순한 맛이면 아무 일도 안 일어난다.
// nerve는 각 인물이 이미 넘어본 선이다. 그 목록이 실제로 현실의 추악함을 담고 있어야 한다.
test('nerve가 현실의 추악함을 실제로 담고 있다', () => {
  // 정규식으로 88개를 전부 분류하려 들면 결국 지금 문장들을 그대로 외우는 테스트가 된다.
  // 그래서 두 가지만 본다 — 추악함이 여러 갈래로 퍼져 있는가, 그리고 구체적인가.
  const nerves = people.map(x => x.p.flaw.nerve);
  const AXES = {
    '돈을 빼돌린다': /빼돌|횡령|자기 명의|지갑으로|생활비로|떼놓|사례를 받|봉투|수수료를 받|성과급|운영비라고/,
    '남을 팔아넘긴다': /팔았|팔아|넘긴 적|명단|제보|흘린 적|넘겨|정보를 모|정보를 다른/,
    '은폐하거나 조작한다': /덮었|덮는다|지운다|안 밝힌|조작|고친다|부풀|각색|숨긴|안 내렸|낮춰 적|편집해|허위/,
    '남을 이용하거나 압박한다': /이용해|이용한|밀어붙인다|압박|흔들|우긴다|붙잡|잡는다|대가로|연기한다|끌었/,
    '남의 것을 탐낸다': /남의 것|여자친구|애인|뺏|입양 보낼|챙겨온다|가져오는|상관없다|뺏어/,
    '이득 앞에 원칙을 접는다': /이득이면|급하면|팔 수만 있으면|올려 받|광고비|포상금|조회수|후원금|신념|되면/,
    '규정과 직업윤리를 어긴다': /신고|판정을 느슨|별점|증거|무료로 받|익명으로|보고 안|밀수|출처를 안|눈감|위생|잔류|검사|계약서|조항|수임한다|후기를 직원이/,
    '사람을 수단으로 본다': /자료 수집|대상이다|콘텐츠로|사연을|정가표|항목|팬을 이용|하위 라인|가족|자녀/,
  };
  for (const [name, re] of Object.entries(AXES)) {
    const n = nerves.filter(x => re.test(x)).length;
    assert.ok(n >= 6, `"${name}" 축이 ${n}명뿐이다 — 추악함이 한쪽으로 쏠렸거나 순해졌다`);
  }

  // 구체적이어야 한다. "가끔 나쁜 짓을 한다"류가 들어오는 걸 막는다.
  for (const { at, p } of people) {
    const n = p.flaw.nerve;
    assert.ok(n.length >= 20, `${at}: nerve가 너무 짧다 — 구체적인 짓이 아니라 형용사다\n  ${n}`);
  }
  // 숫자가 붙은 자백이 충분히 있어야 한다 — 횟수·금액·연차가 있어야 진짜로 읽힌다
  const numbered = nerves.filter(n => /[0-9]|한 번|두 번|세 번|몇 번|여럿|절반/.test(n)).length;
  assert.ok(numbered >= people.length * 0.25,
    `숫자가 붙은 자백이 ${numbered}/${people.length}건뿐이다 — 뭉뚱그린 악행만 남았다`);
  assert.equal(new Set(nerves).size, nerves.length, 'nerve 문구가 중복된다');
});

test('의뢰 대장이 현실 사회의 추한 단면을 넓게 덮는다', () => {
  // 정치·종족 같은 판타지 조합만 있으면 "추악함"이 남 얘기가 된다.
  // 사람들이 실제로 하는 짓 — 갑질, 사생, 악플, 다단계, 추심, 대리, 등급 — 이 있어야 한다.
  const NEED = ['갑질', '사생', '악플경제', '다단계', '추심', '유료대화', '등급', '뒷조사', '가상인격', '파탄산업'];
  const have = new Set(COUPLES.map(c => c.category));
  for (const k of NEED) assert.ok(have.has(k), `현실 카테고리 "${k}"가 없다`);
  assert.ok(have.size >= 30, `카테고리가 ${have.size}종뿐이다 — 소재가 겹치기 시작한다`);
});

test('난이도가 한쪽으로 쏠려 있지 않다', () => {
  const n = {};
  for (const c of COUPLES) n[c.difficulty] = (n[c.difficulty] || 0) + 1;
  for (const d of ['쉬움', '보통', '헬']) {
    assert.ok(n[d] >= 5, `난이도 ${d}가 ${n[d] || 0}건뿐이다 — 필터를 눌러도 볼 게 없다`);
  }
  // 헬만 잔뜩 있으면 신규 요원이 첫 판에서 전부 결렬한다
  assert.ok(n['헬'] <= COUPLES.length * 0.6, `헬이 ${n['헬']}/${COUPLES.length}건 — 너무 쏠렸다`);
});

// ── 좋아해도 못 사귄다 ────────────────────────────────────────────────
test('의뢰 대장 전건에 구체적인 현실 장벽이 있다', () => {
  for (const c of COUPLES) {
    assert.ok(c.barrier, `${c.id}: 현실 장벽이 없다`);
    assert.ok(c.barrier.length >= 25, `${c.id}: 장벽이 너무 뭉뚱그려져 있다 — ${c.barrier}`);
    // 장벽은 감정이 아니라 조건이어야 한다. "서로 안 맞는다"류는 이미 clash가 담당한다.
    // 장벽은 '분위기'가 아니라 **비용**이어야 한다. 무엇을 잃는지가 문장 안에 있어야 한다.
    assert.ok(/끝난다|취소|잃는|해산|기각|무효|재가 된다|문을 닫|해고|철회|만료|금지|위약금|끊긴다|나가야|돌아가야|안 겹|박탈|사유다|못 [가-힣]|없[다고]|안 된다|넘어간다|신고가 들어간다|표적|죽는다|대상이다|물어내야|정지된다/.test(c.barrier),
      `${c.id}: 장벽에 잃는 것이 안 적혀 있다 — 조건이 아니라 분위기다\n  ${c.barrier}`);
    // 그리고 clash와 다른 말이어야 한다. 같으면 축이 하나 늘어난 게 아니다.
    assert.notEqual(c.barrier, c.clash, `${c.id}: 장벽이 clash와 같다`);
  }
  assert.equal(new Set(COUPLES.map(c => c.barrier)).size, COUPLES.length, '장벽 문구가 중복된다');
});

test('장벽과 압박이 심판에게 실제로 전달된다', async () => {
  const P = await import('../js/prompts.js');
  for (const c of COUPLES.slice(0, 6)) {
    const sys = P.judgeSystem(c);
    assert.ok(sys.includes(c.barrier), `${c.id}: 심판이 장벽을 모른다`);
    assert.match(sys, /THE THING IN THE WAY/, '장벽 블록 표제가 없다');
    // 문턱이 조여졌다: 상황을 같이 안타까워하는 것만으로는 안 되고,
    // 대가를 치를 사람이 그 자리에서 답을 해야 한다.
    assert.match(sys, /a passing mention, a joke past it/, '스치듯 언급도 통과된다');
    assert.match(sys, /the two of them feeling bad about it together, sympathising/,
      '같이 안타까워하는 것만으로 통과된다');
    assert.match(sys, /the person who\s+would pay it answered it/, '대가를 치를 사람의 응답을 안 본다');
    // 그래도 양방향이어야 한다 — 한쪽만 조이면 심판은 안전한 쪽(false)으로 도망친다.
    assert.match(sys, /Do not withhold it either/, '장벽 판정 가드가 한쪽만 걸려 있다');
    assert.match(sys, /visibly gave ground to it/, '압박의 판정 기준이 없다');
    assert.match(sys, /someone can be\s+cornered while liking the client less every minute/,
      '압박과 호감이 같이 갈 수 있다는 게 안 적혀 있다');
  }
});

test('의뢰인과 상대는 장벽 분석을 안 받는다', async () => {
  const P = await import('../js/prompts.js');
  const AG = { name: '요원', gender: '기밀' };
  // 장벽 자체는 두 사람이 사는 현실이라 알 수 있다. 다만 "이걸 다뤄야 성사된다"는
  // 게임 규칙이므로 인물에게 가면 안 된다 — 알면 첫 턴에 의무적으로 꺼낸다.
  for (const c of COUPLES.slice(0, 6)) {
    const cs = P.clientAgentSystem(c, { coaching: '', speech: '', outfitDesc: '' }, 'talk', AG);
    const ts = P.targetAgentSystem(c, 'talk', '');
    for (const [who, sys] of [['의뢰인', cs], ['상대', ts]]) {
      assert.ok(!/THE THING IN THE WAY/.test(sys), `${c.id}/${who}: 장벽 규칙이 인물에게 갔다`);
      assert.ok(!/barrierAddressed/.test(sys), `${c.id}/${who}: 판정 필드명이 새어나갔다`);
    }
  }
});

// ── 추악함이 충분히 들어가 있는가 ─────────────────────────────────────
// "성격이 있고 하자가 있고 애초에 안 맞는 사람들"이 실제로 데이터에 있는지 기계가 본다.
// 프롬프트만 사납고 데이터가 순하면 두 에이전트는 멀쩡하게 대화한다 (실측으로 겪었다).
test('선을 넘어본 기록이 전원에게 있고, 프롬프트가 그걸 과거형으로 못 박는다', () => {
  const seen = new Set();
  for (const { at, p } of people) {
    const n = p.flaw.nerve;
    assert.ok(n && n.length >= 15, `${at}: 넘어본 선이 너무 짧다`);
    assert.ok(!seen.has(n), `${at}: 넘어본 선을 돌려쓴다 — ${n}`);
    seen.add(n);
  }
  // 데이터는 대부분 "이러이러하면 이렇게 한다"는 성향으로 쓰여 있다(실측 94건 중 43건).
  // 헤더는 「이미 넘어본 선」인데 내용이 가정법이면 인물이 짊어진 게 없어진다.
  // 그래서 프롬프트가 그걸 이미 저지른 일로 못 박는다 — 구체적인 때와 사람까지.
  const c = COUPLES[0];
  const sys = P.clientAgentSystem(c, { outfitDesc: '', coaching: '', speech: '' }, 'talk', { name: '요원' });
  assert.match(sys, /Read that as history, not as a policy/, '성향이 과거로 못 박히지 않는다');
  assert.match(sys, /You have already done it — more than once, and\s+recently/, '반복성이 없다');
  assert.match(sys, /a specific time, a specific person it happened to/, '피해자가 특정되지 않는다');
  assert.match(sys, /Do not confess it as a flaw/, '하자를 고백하면 참회물이 된다');
});


test('상대를 어떻게 보는지가 전원에게 있고, 구체적이다', () => {
  for (const { at, p } of people) {
    assert.ok(p.regard, `${at}: 상대를 어떻게 보는지가 없다`);
    assert.ok(p.regard.length >= 20, `${at}: 너무 뭉뚱그려져 있다 — ${p.regard}`);
  }
  // 문구를 돌려쓰면 94명이 같은 사람이 된다
  const all = people.map(x => x.regard || x.p.regard);
  assert.equal(new Set(all).size, all.length, '상대를 보는 시선이 중복된다');
});

test('두 에이전트 프롬프트에 사회성 결여가 기본 전제로 깔려 있다', () => {
  const c = COUPLES[0];
  for (const sys of [
    P.clientAgentSystem(c, { outfitDesc: '', coaching: '', speech: '' }, 'talk', { name: '요원' }),
    P.targetAgentSystem(c, 'talk', ''),
  ]) {
    assert.match(sys, /You have never done this\. Not once/, '연애 경험 0이라는 전제가 없다');
    assert.match(sys, /You are not witty and this is not banter/, '재치 금지가 없다');
    assert.match(sys, /Silence happens and you do not rescue it/, '침묵을 메우지 말라는 지시가 없다');
    assert.match(sys, /You are not endearing about it/, '서투름이 귀엽게 처리될 여지가 있다');
    // 그리고 이 전제가 '착하게 굴어라'로 읽히면 안 된다 — 추악함이 그 위에 얹혀야 한다
    assert.match(sys, /THESE PEOPLE ARE NOT GOOD PEOPLE/, '추악함 블록이 사라졌다');
    assert.match(sys, /LINES YOU HAVE ALREADY CROSSED/, '넘어본 선이 안 실린다');
  }
});

test('상대가 원한을 들고 앉는다', () => {
  for (const c of COUPLES.slice(0, 8)) {
    const sys = P.targetAgentSystem(c, 'talk', '');
    assert.ok(sys.includes(c.target.regard), `${c.id}: 상대가 뭘 당했는지 프롬프트에 없다`);
    assert.match(sys, /WHAT THIS PERSON HAS ALREADY DONE TO YOU/, `${c.id}: 원한 블록 표제가 없다`);
    // 의뢰인 쪽은 반한 것과 별개로 솔직히 별로인 게 같이 들어가야 한다
    const cs = P.clientAgentSystem(c, { outfitDesc: '', coaching: '', speech: '' }, 'talk', { name: '요원' });
    assert.ok(cs.includes(c.client.regard), `${c.id}: 의뢰인이 상대를 어떻게 보는지가 없다`);
    assert.match(cs, /AND THE PART YOU DO NOT SAY OUT LOUD/, `${c.id}: 속마음 블록 표제가 없다`);
  }
});
