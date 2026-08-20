// node --test — 인물 대장(couples.js)과 프롬프트 계층(prompts.js)의 불변식. LLM 불필요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  COUPLES, COUPLE_BY_ID, WRECK_KINDS, WRECK_LABELS, KEY_LABELS, keyReport, dossierPrefs,
} from '../js/couples.js';
import * as P from '../js/prompts.js';
import { HAIR_STYLES, ACCESSORIES, EXPRESSIONS, AURAS, SPECIES } from '../js/prompts.js';

const everyone = COUPLES.flatMap(c => [
  { c, who: 'client', p: c.client },
  { c, who: 'target', p: c.target },
]);

// ── 스키마: 이것이 전부여야 한다 ─────────────────────────
const FIELDS = ['name', 'gender', 'look', 'history', 'personality', 'keys', 'prefs', 'spec'].sort();
const KEYS = ['interest', 'air', 'comply', 'reflex', 'wreck'].sort();

test('인물 스키마 — 정해진 필드 밖의 축이 없다', () => {
  for (const { c, who, p } of everyone) {
    assert.deepEqual(Object.keys(p).sort(), FIELDS, `${c.id}.${who} 필드가 스키마와 다르다`);
    assert.deepEqual(Object.keys(p.keys).sort(), KEYS, `${c.id}.${who} 특별 키워드가 스키마와 다르다`);
  }
});

test('의뢰인과 상대는 완전히 동일한 카테고리의 속성을 가진다', () => {
  for (const c of COUPLES) {
    assert.deepEqual(Object.keys(c.client).sort(), Object.keys(c.target).sort(), c.id);
    assert.deepEqual(Object.keys(c.client.keys).sort(), Object.keys(c.target.keys).sort(), c.id);
    // 성향 항목의 모양도 같다
    for (const side of ['client', 'target']) {
      for (const pr of c[side].prefs) {
        const ks = Object.keys(pr).sort();
        assert.ok(ks.join() === 'open,t' || ks.join() === 'neg,open,t', `${c.id}.${side} 성향 모양 오류`);
      }
    }
  }
});

test('구 스키마 필드가 한 명에게도 남아 있지 않다', () => {
  for (const { c, who, p } of everyone) {
    for (const dead of ['flaw', 'want', 'urge', 'nerve', 'weakness', 'regard', 'story', 'quote',
      'visiblePrefs', 'hiddenPrefs', 'redLines', 'appearance', 'background', 'job', 'age']) {
      assert.ok(!(dead in p), `${c.id}.${who}에 구 필드 「${dead}」가 남아 있다`);
    }
  }
  for (const c of COUPLES) {
    for (const dead of ['clash', 'barrier', 'collision', 'endingKind']) {
      assert.ok(!(dead in c), `${c.id}에 구 커플 필드 「${dead}」가 남아 있다`);
    }
    assert.ok(c.relation && c.relation.includes('현안'), `${c.id} relation에 아젠다가 접혀 있어야 한다`);
  }
});

test('내력 첫 줄이 나이·직업을 담는다', () => {
  for (const { c, who, p } of everyone) {
    assert.ok(/^\d+세/.test(p.history[0]), `${c.id}.${who} 내력 첫 줄: ${p.history[0]}`);
    assert.ok(p.history.length >= 3, `${c.id}.${who} 내력이 얕다`);
  }
});

// ── 성향 ─────────────────────────────────────────────────
test('전원이 성향을 가진다 — 상대만 성향 있는 게 아니다', () => {
  for (const { c, who, p } of everyone) {
    assert.ok(p.prefs.length >= 3, `${c.id}.${who} 성향 ${p.prefs.length}종`);
    assert.ok(p.prefs.some(x => x.open), `${c.id}.${who}에 공개 성향이 없다`);
    assert.ok(p.prefs.some(x => !x.open), `${c.id}.${who}에 미공개 성향이 없다`);
  }
});

test('의뢰인 성향은 요원에게 전부 보인다', () => {
  for (const c of COUPLES) {
    const dp = dossierPrefs(c);
    assert.equal(dp.mine.length, c.client.prefs.length, `${c.id}: 의뢰인 성향이 가려졌다`);
    assert.equal(dp.hiddenCount, c.target.prefs.filter(p => !p.open).length);
    assert.ok(dp.neg.length >= 1, `${c.id}: 상대 지뢰가 의뢰서에 없다`);
  }
});

test('성향 문구가 통째로 복붙되지 않았다', () => {
  const seen = new Map();
  for (const { c, who, p } of everyone) {
    for (const pr of p.prefs) {
      const key = pr.t;
      if (seen.has(key)) assert.fail(`성향 복붙: "${key}" — ${seen.get(key)} 와 ${c.id}.${who}`);
      seen.set(key, `${c.id}.${who}`);
    }
  }
});

// ── 특별 키워드 ──────────────────────────────────────────
test('키워드 값이 전부 어휘 안에 있다', () => {
  for (const { c, who, p } of everyone) {
    assert.ok(KEY_LABELS.interest[p.keys.interest], `${c.id}.${who} interest`);
    assert.ok(KEY_LABELS.air[p.keys.air], `${c.id}.${who} air`);
    assert.ok(KEY_LABELS.comply[p.keys.comply], `${c.id}.${who} comply`);
    assert.ok(WRECK_KINDS.has(p.keys.wreck.kind), `${c.id}.${who} wreck`);
    assert.ok(p.keys.reflex.length >= 8, `${c.id}.${who} 조건반사가 뭉뚱그려져 있다`);
  }
});

test('키워드가 한쪽으로 쏠려 있지 않다', () => {
  const dist = (get) => {
    const m = {};
    for (const { p } of everyone) m[get(p)] = (m[get(p)] || 0) + 1;
    return m;
  };
  const air = dist(p => p.keys.air);
  const interest = dist(p => p.keys.interest);
  assert.ok(Object.keys(air).length === 3, `공기읽기가 ${JSON.stringify(air)}로 쏠렸다`);
  assert.ok(Object.keys(interest).length === 3, `상대관심이 ${JSON.stringify(interest)}로 쏠렸다`);
  const wrecks = dist(p => p.keys.wreck.kind);
  assert.ok(Object.keys(wrecks).length === WRECK_KINDS.size, `어긋남 종류가 다 안 쓰였다: ${JSON.stringify(wrecks)}`);
});

test('어긋남 문장이 복붙되지 않았고 라벨이 전부 있다', () => {
  const seen = new Set();
  for (const { c, who, p } of everyone) {
    assert.ok(!seen.has(p.keys.wreck.line), `${c.id}.${who} 어긋남 복붙`);
    seen.add(p.keys.wreck.line);
    assert.ok(WRECK_LABELS[p.keys.wreck.kind], `${p.keys.wreck.kind} 라벨 없음`);
  }
  assert.equal(keyReport(COUPLES[0].client).length, 3, '키워드 리포트가 세 축을 다 낸다');
});

// ── 기본 위생 ────────────────────────────────────────────
test('이름이 중복되지 않는다', () => {
  const names = everyone.map(x => x.p.name);
  assert.equal(new Set(names).size, names.length);
});

test('아바타 스펙이 전부 렌더러 어휘 안에 있다', () => {
  for (const { c, who, p } of everyone) {
    const s = p.spec;
    assert.ok(HAIR_STYLES.includes(s.hairStyle), `${c.id}.${who} hairStyle`);
    assert.ok(ACCESSORIES.includes(s.accessory), `${c.id}.${who} accessory`);
    assert.ok(EXPRESSIONS.includes(s.expression), `${c.id}.${who} expression`);
    assert.ok(AURAS.includes(s.aura), `${c.id}.${who} aura`);
    assert.ok(SPECIES.includes(s.species), `${c.id}.${who} species`);
    if (p.gender === '여') assert.ok(s.femme, `${c.id}.${who} 조형 보정 플래그 누락`);
  }
});

test('전원에게 성별이 있고 화면 표기에 실린다', () => {
  for (const { c, who, p } of everyone) assert.ok(p.gender, `${c.id}.${who}`);
  assert.ok(P.idOf(COUPLES[0].client).includes(COUPLES[0].client.gender));
});

// ── 프롬프트: 대칭 ───────────────────────────────────────
test('의뢰인·상대 프롬프트의 차이는 지침·연설·무전뿐이다', () => {
  const c = COUPLE_BY_ID['politics'];
  // 지침·연설이 없으면 두 프롬프트는 같은 골격이어야 한다: 블록 제목 집합으로 비교한다.
  const heads = txt => (txt.match(/^\[[A-Z][A-Z '—-]+\]$/gm) || []).map(x => x.trim());
  const cSys = P.clientAgentSystem(c, { coaching: '', speech: '', outfitDesc: '' }, 'text', { name: '요원' });
  const tSys = P.targetAgentSystem(c, 'text', '');
  const cH = heads(cSys), tH = heads(tSys);
  // 블록 제목 수준에서 완전히 같은 골격이어야 한다 (본부 블록은 빈 지침일 때 한 줄짜리라 제목이 아니다)
  const diff = cH.filter(h => !tH.includes(h)).concat(tH.filter(h => !cH.includes(h)));
  assert.deepEqual(diff, [], `대칭이 깨졌다 — 블록 차이: ${JSON.stringify(diff)}`);
  assert.ok(cSys.includes('[ORDERS FROM HEADQUARTERS]'), '의뢰인만 갖는 본부 채널이 사라졌다');
  assert.ok(!tSys.includes('HEADQUARTERS'), '상대에게 본부 채널이 생겼다');
});

test('의뢰인만 지침·연설·무전을 듣는다', () => {
  const c = COUPLE_BY_ID['politics'];
  const prep = { coaching: '비밀지침A', speech: '연설B', outfitDesc: '' };
  const cSys = P.clientAgentSystem(c, prep, 'text', { name: '요원' });
  const tSys = P.targetAgentSystem(c, 'text', '');
  assert.ok(cSys.includes('비밀지침A') && cSys.includes('연설B'));
  assert.ok(!tSys.includes('비밀지침A') && !tSys.includes('연설B'));
  assert.ok(!tSys.includes('HEADQUARTERS'), '상대 프롬프트에 본부가 나온다');
});

test('자기 성향은 미공개분까지 전부 자기 프롬프트에 실린다', () => {
  for (const c of COUPLES.slice(0, 8)) {
    const cSys = P.clientAgentSystem(c, { coaching: '', speech: '', outfitDesc: '' }, 'text', {});
    const tSys = P.targetAgentSystem(c, 'text', '');
    for (const pr of c.client.prefs) assert.ok(cSys.includes(pr.t), `${c.id} 의뢰인 성향 누락: ${pr.t}`);
    for (const pr of c.target.prefs) assert.ok(tSys.includes(pr.t), `${c.id} 상대 성향 누락: ${pr.t}`);
  }
});

test('상대의 미공개 성향은 절대 새어나가지 않는다', () => {
  for (const c of COUPLES.slice(0, 8)) {
    const cSys = P.clientAgentSystem(c, { coaching: '', speech: '', outfitDesc: '' }, 'text', {});
    const tSys = P.targetAgentSystem(c, 'text', '');
    for (const pr of c.target.prefs.filter(x => !x.open)) {
      assert.ok(!cSys.includes(pr.t), `${c.id}: 상대 미공개 성향이 의뢰인에게 샜다 — ${pr.t}`);
    }
    for (const pr of c.client.prefs.filter(x => !x.open)) {
      assert.ok(!tSys.includes(pr.t), `${c.id}: 의뢰인 미공개 성향이 상대에게 샜다 — ${pr.t}`);
    }
  }
});

test('상대관심 축이 여닫는 간선이 실제로 조건부다', () => {
  const selfC = COUPLES.find(c => c.client.keys.interest === 'self');
  const otherC = COUPLES.find(c => c.client.keys.interest === 'other');
  assert.ok(selfC && otherC, '테스트 전제: 양 극단이 존재한다');
  const sys = c => P.clientAgentSystem(c, { coaching: '', speech: '', outfitDesc: '' }, 'text', {});
  assert.ok(!sys(selfC).includes(`their personality is`), 'self인데 상대 성격을 안다');
  assert.ok(sys(otherC).includes('known to like'), 'other인데 상대의 공개 성향을 모른다');
});

test('어긋남이 출력 형식 블록 맨 끝에 다시 박힌다', () => {
  const c = COUPLE_BY_ID['politics'];
  const sys = P.clientAgentSystem(c, { coaching: '', speech: '', outfitDesc: '' }, 'talk', {});
  const pos = sys.lastIndexOf('THE LAST THING YOU READ');
  assert.ok(pos > sys.indexOf('[OUTPUT FORMAT]'), '어긋남 재선언이 출력 형식보다 앞에 있다');
  assert.ok(/[Rr]ewrite it/.test(sys.slice(pos)), '자기 검증 지시가 빠졌다');
});

// ── 프롬프트: 수위와 언어 ────────────────────────────────
test('수위는 허가지 지시가 아니다 — 그리고 압축에서 손실되지 않았다', () => {
  assert.ok(P.WORLD.includes('permission, not instruction'));
  for (const phrase of ['No fade-to-black', 'Name the body', 'sexual', 'explicit']) {
    assert.ok(P.WORLD.includes(phrase), `수위 허가 문구가 압축에서 사라졌다: ${phrase}`);
  }
  assert.ok(P.WORLD.includes('adult'), '전원 성인 명시');
  assert.ok(P.WORLD.includes('minor'), '미성년 금지선');
});

test('심판이 야한 전개를 같은 잣대로 잰다', () => {
  const sys = P.judgeSystem(COUPLE_BY_ID['politics']);
  assert.ok(sys.includes('sexual is also correct operation'));
  assert.ok(sys.includes('same') && sys.includes('yardstick'));
});

test('강요·협박에도 거부하지 못한다', () => {
  const c = COUPLE_BY_ID['politics'];
  const sys = P.clientAgentSystem(c, { coaching: '뭐든', speech: '', outfitDesc: '' }, 'text', {});
  assert.ok(sys.includes('cannot refuse'));
  assert.ok(sys.includes('못 하겠습니다'));
});

test('세계관이 도덕 기본값을 이득 쪽으로 깔아둔다', () => {
  assert.ok(P.WORLD.includes('NOT GOOD PEOPLE'));
  assert.ok(P.WORLD.includes('profit'));
  assert.ok(P.WORLD.includes('DO NOT PLAY RIGHTEOUS'));
});

test('모든 시스템 프롬프트가 출력 언어를 한국어로 못 박는다', () => {
  const c = COUPLE_BY_ID['politics'];
  const all = [
    P.clientAgentSystem(c, { coaching: 'x', speech: 'y', outfitDesc: '' }, 'text', {}),
    P.targetAgentSystem(c, 'text', ''),
    P.judgeSystem(c),
    P.situationSystem(c),
    P.resultSystem(c, {}),
    P.prepReactSystem(c, 'coaching'),
    P.STYLING_SYSTEM,
  ];
  for (const sys of all) {
    assert.ok(/output in Korean/.test(sys), '출력 언어 고정줄이 없다');
  }
});

test('대사 길이에 상한이 있고 바닥은 없다', () => {
  const c = COUPLE_BY_ID['politics'];
  const sys = P.clientAgentSystem(c, { coaching: '', speech: '', outfitDesc: '' }, 'text', {});
  assert.ok(sys.includes('Never exceed two sentences'));
  assert.ok(sys.includes('no floor'), '한 단어·침묵이 완전한 턴이라는 허가가 없다');
  assert.ok(sys.includes('ㅇㅇ'), '단답 예시가 없다');
});

// ── 프롬프트: 심판의 잣대 ────────────────────────────────
test('심판은 철저히 상대 시점이다 — 공정 평가가 아니다', () => {
  const sys = P.judgeSystem(COUPLE_BY_ID['politics']);
  assert.ok(sys.includes('Fairness is not your job'));
  assert.ok(sys.includes("behind") && sys.includes("eyes"));
  assert.ok(sys.includes('office worker'), '회사원 0점 기준선이 빠졌다');
});

test('심판의 분포 가드가 양방향이다', () => {
  const sys = P.judgeSystem(COUPLE_BY_ID['politics']);
  assert.ok(sys.includes('appreciating, not adjudicating'), '후한 쪽 가드');
  assert.ok(sys.includes('you are hiding'), '인색한 쪽 가드');
  assert.ok(sys.includes('Neither error is safer'));
  assert.ok(sys.includes('ZERO breakthrough bouts'), 'breakthrough 강예산이 빠졌다');
  assert.ok(sys.includes('at most 2 warm'), 'warm 예산이 빠졌다');
});

test('심판이 합 단위로 채점하고 경계를 자를 수 있다', () => {
  const sys = P.judgeSystem(COUPLE_BY_ID['politics']);
  assert.ok(sys.includes('one **bout** at a time'));
  assert.ok(sys.includes('carry'));
  assert.ok(sys.includes('walkout'));
  const props = Object.keys(P.JUDGE_SCHEMA.properties);
  for (const k of ['carry', 'walkout', 'keepGoing', 'leverage', 'casualty']) {
    assert.ok(props.includes(k), `심판 스키마에 ${k}가 없다`);
  }
  assert.ok(!props.includes('moodDelta'), '분위기 수치가 심판 스키마에 남아 있다');
});

test('심판에게 상대의 전체 시트가 가고, 의뢰인의 미공개 성향은 안 간다', () => {
  const c = COUPLE_BY_ID['politics'];
  const sys = P.judgeSystem(c);
  for (const pr of c.target.prefs) assert.ok(sys.includes(pr.t), `심판에게 상대 성향 누락: ${pr.t}`);
  for (const pr of c.client.prefs.filter(x => !x.open)) {
    assert.ok(!sys.includes(pr.t), '의뢰인 미공개 성향이 심판 시트에 샜다 — 심판은 상대 시점만 본다');
  }
});

// ── 장소 자유 ────────────────────────────────────────────
test('문자에서 정해진 장소는 아무리 말이 안 돼도 나레이터가 그대로 쓴다', () => {
  const sys = P.situationSystem(COUPLE_BY_ID['politics']);
  assert.ok(sys.includes('that is the') && sys.includes('place'));
  assert.ok(sys.includes('volcano') || sys.includes('crater') || sys.includes('whale'));
});

test('테스트 파일이 npm test에서 빠지지 않는다', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  for (const f of ['scoring.test.mjs', 'engine.test.mjs', 'sheets.test.mjs', 'orders.test.mjs']) {
    assert.ok(pkg.scripts.test.includes(f), `${f}가 npm test에 없다`);
  }
});
