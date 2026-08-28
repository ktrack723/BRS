// node --test tests/couples.test.mjs — 인물 시트가 구조도의 여덟 항목으로 닫혀 있는가.
//
// 스크리닝에서 노출되는 항목과 프롬프트에 실리는 항목은 **같은 목록**이어야 한다.
// 어느 한쪽에만 있는 축이 생기면 그게 곧 "화면이 거짓말하는" 상태다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { COUPLES, COUPLE_BY_ID, CLIENT_FIELDS, TARGET_FIELDS } from '../js/couples.js';
import * as P from '../js/prompts.js';
import { sanitizeSpec } from '../js/avatar.js';

test('대장이 비어 있지 않다', () => {
  assert.ok(COUPLES.length >= 40, `커플이 ${COUPLES.length}건뿐이다`);
  assert.equal(Object.keys(COUPLE_BY_ID).length, COUPLES.length, 'id가 중복이다');
});

test('고객 필드는 다섯 개로 닫혀 있다 (이름·성별 + 노출 네 항목)', () => {
  assert.deepEqual([...CLIENT_FIELDS].sort(),
    ['gender', 'look', 'name', 'personality', 'spec', 'upbringing'].sort());
});

test('타겟 필드도 같은 폭이다 — 반한 이유 대신 취향', () => {
  assert.deepEqual([...TARGET_FIELDS].sort(),
    ['gender', 'look', 'name', 'personality', 'spec', 'taste', 'upbringing'].sort());
});

test('스크리닝 노출 목록과 실제 필드가 정확히 일치한다', () => {
  const shown = {
    client: P.SCREEN_FIELDS.client.map(f => f.key),
    target: P.SCREEN_FIELDS.target.map(f => f.key),
  };
  assert.deepEqual(shown.client, ['look', 'personality', 'upbringing']);
  assert.deepEqual(shown.target, ['look', 'personality', 'upbringing', 'taste']);
  for (const c of COUPLES) {
    for (const k of shown.client) assert.ok(c.client[k], `${c.id}.client.${k} 없음`);
    for (const k of shown.target) assert.ok(c.target[k], `${c.id}.target.${k} 없음`);
  }
});

test('폐지된 축이 데이터에 남아 있지 않다', () => {
  const DEAD = ['difficulty', 'winWord', 'relation', 'keys', 'prefs', 'history', 'flaw', 'want', 'wreck'];
  for (const c of COUPLES) {
    for (const k of DEAD) {
      assert.ok(!(k in c), `${c.id}에 폐지된 ${k}가 있다`);
      assert.ok(!(k in c.client), `${c.id}.client에 폐지된 ${k}가 있다`);
      assert.ok(!(k in c.target), `${c.id}.target에 폐지된 ${k}가 있다`);
    }
  }
});

test('지뢰(neg)·미공개(open) 개념이 취향에 남아 있지 않다 — 취향은 평평한 문자열 목록이다', () => {
  for (const c of COUPLES) {
    for (const t of c.target.taste) {
      assert.equal(typeof t, 'string', `${c.id}: 취향 항목이 문자열이 아니다`);
    }
  }
});

test('각 인물의 시트가 실제로 채워져 있다', () => {
  for (const c of COUPLES) {
    for (const who of ['client', 'target']) {
      const p = c[who];
      assert.ok(p.name && p.gender, `${c.id}.${who} 이름/성별 누락`);
      assert.ok(p.look.length >= 2, `${c.id}.${who} 외모가 부실하다`);
      assert.ok(p.personality.length >= 2, `${c.id}.${who} 성격이 부실하다`);
      assert.ok(p.upbringing.length >= 3, `${c.id}.${who} 성장환경이 부실하다`);
    }
    assert.ok(c.target.taste.length >= 3, `${c.id} 타겟 취향이 3항 미만이다`);
  }
});


test('아바타 스펙이 렌더러를 통과한다', () => {
  for (const c of COUPLES) {
    for (const who of ['client', 'target']) {
      const s = sanitizeSpec(c[who].spec);
      assert.ok(P.SPECIES.includes(s.species), `${c.id}.${who} 종족값 오류`);
      assert.ok(P.HAIR_STYLES.includes(s.hairStyle), `${c.id}.${who} 머리 오류`);
      assert.ok(P.ACCESSORIES.includes(s.accessory), `${c.id}.${who} 액세서리 오류`);
      assert.ok(P.AURAS.includes(s.aura), `${c.id}.${who} 오라 오류`);
      assert.ok(P.EXPRESSIONS.includes(s.expression), `${c.id}.${who} 표정 오류`);
    }
  }
});

test('여성 인물에는 조형 보정 플래그가 붙는다', () => {
  for (const c of COUPLES) {
    for (const who of ['client', 'target']) {
      if (c[who].gender === '여') assert.equal(c[who].spec.femme, true, `${c.id}.${who} femme 누락`);
    }
  }
});

// 조형은 정보가 아니라 렌더링이다 — 그런데 **읽히지 않으면 렌더링도 아니다.**
// 아래 두 값은 눈으로 정한 게 아니라 썸네일 카메라(320×400 · fov 38 · z 3.2)로
// 실제로 뽑아 재본 것이다. 로스터 47건은 이 썸네일 한 장으로만 판단된다.
const THUMB = {
  // 어깨가 프레임 좌우를 넘기 시작하는 지점
  maxWidth: 1.4,
  // 'above'(y=2.05)는 프레임 위로 벗어나고, 'back'(z=-0.24)은 몸에 완전히 가린다
  offFrame: new Set(['above', 'back']),
};

test('인물마다 소품이 붙어 있다 — 조합이 썸네일 한 장에서 읽혀야 한다', () => {
  for (const c of COUPLES) {
    for (const who of ['client', 'target']) {
      const props = sanitizeSpec(c[who].spec).props;
      assert.ok(props.length >= 1, `${c.id}.${who} 소품이 없다`);
      assert.equal(props.length, c[who].spec.props.length,
        `${c.id}.${who} 소품이 sanitize에서 잘려나갔다 (도형·자리 오타)`);
      for (const p of props) assert.ok(p.label, `${c.id}.${who} 소품에 이름이 없다`);
    }
  }
});

test('소품이 썸네일 프레임 안에 있다 — 안 보이는 자리에 두지 않는다', () => {
  for (const c of COUPLES) {
    for (const who of ['client', 'target']) {
      const s = sanitizeSpec(c[who].spec);
      assert.ok(s.widthScale <= THUMB.maxWidth,
        `${c.id}.${who} 가로 ${s.widthScale} — 썸네일에서 어깨가 잘린다 (상한 ${THUMB.maxWidth})`);
      for (const p of s.props) {
        assert.ok(!THUMB.offFrame.has(p.at),
          `${c.id}.${who} 「${p.label}」이 ${p.at}에 있다 — 썸네일에서 안 보인다`);
      }
    }
  }
});
