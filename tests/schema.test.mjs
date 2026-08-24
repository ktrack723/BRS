// node --test tests/schema.test.mjs — 구조화 출력 스키마 계약 테스트.
// Claude 구조화 출력은 JSON Schema 전체가 아니라 부분집합만 받는다.
// maxItems 하나가 섞여 있어서 "시공 개시"가 400 invalid_request_error로 통째로 멈췄던 적이 있다.
// 다시는 그 상태로 배포되지 않게, 실제로 보내는 스키마를 여기서 검사한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stripUnsupportedSchemaKeys } from '../js/llm.js';
import * as P from '../js/prompts.js';

// API가 거부하는 키워드 (엔진이 아니라 API 쪽 제약이다)
const BANNED = [
  'maxItems', 'minItems', 'uniqueItems', 'maxLength', 'minLength', 'pattern', 'format',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  'maxProperties', 'minProperties', 'patternProperties', 'default',
];
const NAME_MAPS = new Set(['properties', '$defs', 'definitions']);

// properties 아래의 키는 필드 이름이라 검사 대상이 아니다. 키워드 자리만 본다.
function bannedKeys(node, path = '$', found = []) {
  if (Array.isArray(node)) {
    node.forEach((n, i) => bannedKeys(n, `${path}[${i}]`, found));
    return found;
  }
  if (!node || typeof node !== 'object') return found;
  for (const [k, v] of Object.entries(node)) {
    if (BANNED.includes(k)) found.push(`${path}.${k}`);
    if (NAME_MAPS.has(k) && v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [name, sub] of Object.entries(v)) bannedKeys(sub, `${path}.${k}.${name}`, found);
    } else {
      bannedKeys(v, `${path}.${k}`, found);
    }
  }
  return found;
}

// export되는 *_SCHEMA = 실제로 API에 보내는 최상위 스키마 전부.
// (PROP/AVATAR_SPEC 같은 내포 스키마는 export하지 않는다 — STYLING_SCHEMA 검사가 재귀로 같이 본다.)
const SCHEMAS = Object.entries(P).filter(([k, v]) => k.endsWith('_SCHEMA') && v && typeof v === 'object');

test('내보내는 스키마가 하나도 빠짐없이 존재한다', () => {
  const names = SCHEMAS.map(([k]) => k);
  for (const k of ['STYLING_SCHEMA', 'PREP_REACT_SCHEMA', 'JUDGE_SCHEMA', 'SITUATION_SCHEMA', 'RESULT_SCHEMA']) {
    assert.ok(names.includes(k), `${k}가 스키마 목록에서 사라졌다`);
  }
});

for (const [name, schema] of SCHEMAS) {
  test(`${name}에 API가 거부하는 키워드가 없다`, () => {
    assert.deepEqual(bannedKeys(schema, name), [], `${name}에 지원되지 않는 키워드가 있다`);
  });
}

test('보내기 직전 정리기가 남은 키워드를 걷어낸다', () => {
  const dirty = {
    type: 'object',
    properties: {
      props: { type: 'array', maxItems: 6, minItems: 1, items: { type: 'string', maxLength: 24 } },
      name: { type: 'string', pattern: '^x$', description: '설명은 살아남는다' },
    },
    required: ['props', 'name'],
    additionalProperties: false,
  };
  const clean = stripUnsupportedSchemaKeys(dirty);
  assert.deepEqual(bannedKeys(clean, '$'), []);
  assert.equal(clean.properties.props.type, 'array');
  assert.equal(clean.properties.props.items.type, 'string');
  assert.deepEqual(clean.required, ['props', 'name']);
  assert.equal(clean.additionalProperties, false);
  assert.equal(clean.properties.name.description, '설명은 살아남는다');
  assert.equal(dirty.properties.props.maxItems, 6, '원본 스키마는 건드리지 않는다');
});

test('필드 이름이 하필 format이나 pattern이어도 지워지지 않는다', () => {
  const clean = stripUnsupportedSchemaKeys({
    type: 'object',
    properties: { format: { type: 'string', pattern: '^a$' }, pattern: { type: 'string' } },
    required: ['format', 'pattern'],
  });
  assert.ok(clean.properties.format, '이름이 format인 필드가 사라졌다');
  assert.ok(clean.properties.pattern, '이름이 pattern인 필드가 사라졌다');
  assert.equal(clean.properties.format.pattern, undefined, '필드 안의 pattern 제약은 걷어내야 한다');
});

test('props 상한 6개는 스키마가 아니라 프롬프트와 sanitize가 지킨다', async () => {
  assert.match(P.STYLING_SYSTEM, /Max 6 props/, '상한을 프롬프트에서 지시해야 한다');
  const { sanitizeSpec } = await import('../js/avatar.js');
  const many = Array.from({ length: 10 }, (_, i) => ({
    shape: 'sphere', color: '#112233', size: 0.3, at: 'orbit', motion: 'orbit', label: `p${i}`,
  }));
  assert.equal(sanitizeSpec({ props: many }).props.length, 6, 'sanitize가 6개로 잘라야 한다');
});
