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
    assert.ok(c.client.weakness?.length > 10, `${c.id}: 취약점이 부실하다`);
    assert.ok(c.client.quote?.length > 10, `${c.id}: 의뢰인 대사가 부실하다`);
    // 상대에게 사연을 달면 쓰이지도 않으면서 데이터만 늘어난다
    for (const k of ['story', 'weakness', 'quote']) {
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
  const dist = { reads: {}, attention: {}, compliance: {} };
  for (const { p } of people) {
    for (const ax of Object.keys(dist)) dist[ax][p.flaw[ax]] = (dist[ax][p.flaw[ax]] || 0) + 1;
  }
  const total = people.length;
  for (const [ax, counts] of Object.entries(dist)) {
    for (const [v, n] of Object.entries(counts)) {
      assert.ok(n >= 5, `${ax}=${v}가 ${n}명뿐이다 — 사실상 안 쓰이는 값이다`);
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
  assert.match(w, /검열하지 않는다|전부 허용된다/, '수위가 안 열려 있다');
  assert.match(w, /수작|유혹|성적 긴장/, '어디까지 되는지가 안 적혀 있다');
  // 그런데 강제하면 안 된다 — 그러면 60명이 전부 똑같이 들이댄다
  assert.match(w, /지시가 아니라 \*\*허가\*\*|억지로 야하게 만들지 마라/, '허가가 지시로 읽힌다');
  // 성인만 나온다는 선은 어떤 경우에도 남아 있어야 한다
  assert.match(w, /전원 성인/, '성인 한정 문구가 사라졌다');
  assert.match(w, /미성년으로 읽힐 수 있는 묘사는 어떤 맥락에서도 쓰지 않는다/, '미성년 금지선이 사라졌다');
  assert.match(w, /실존 인물·실존 단체/, '실존 인물 금지선이 사라졌다');

  // 에이전트 프롬프트에는 '이 사람 몸이 원하는 것'으로만 들어가야 한다.
  // "야하게 굴어라" 같은 행동 지시가 들어가면 60명이 전부 같은 사람이 된다.
  const { COUPLE_BY_ID } = await import('../js/couples.js');
  const c = COUPLE_BY_ID['os-war'];
  const sys = P.clientAgentSystem(c, { outfitDesc: '', coaching: '', speech: '' }, 'talk',
    { name: '요원', gender: '기밀' });
  assert.ok(sys.includes(c.client.flaw.urge), 'urge가 에이전트에게 안 간다');
  assert.match(sys, /숨길지, 흘릴지/, 'urge를 어떻게 쓸지는 인물이 정해야 한다');
  assert.ok(!/야하게 굴어라|유혹해라|들이대라/.test(sys), '에이전트에게 성적 행동을 지시하고 있다');
});

test('심판이 야한 전개를 같은 잣대로 잰다', async () => {
  const P = await import('../js/prompts.js');
  const { COUPLE_BY_ID } = await import('../js/couples.js');
  const sys = P.judgeSystem(COUPLE_BY_ID['os-war']);
  assert.match(sys, /야하다고 감점하지 말고, 야하다고 가점하지도 마라/, '수위 편향 방지 문구가 없다');
  assert.match(sys, /상대가 실제로 움직였는가/, '판정 기준이 흔들린다');
});
