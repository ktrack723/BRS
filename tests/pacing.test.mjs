// node --test tests/pacing.test.mjs — 재생 속도 계층.
// 대화가 눈보다 빨리 지나가서 만든 층이라, 여기서 검증할 것은 "충분히 느린가"와
// "느린 게 싫은 사람이 빠져나갈 수 있는가" 둘이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as pace from '../js/pacing.js';

const mult = k => pace.PACE_STEPS.find(s => s.key === k).mult;
const line = n => '가'.repeat(n);

test('속도 단계가 느린 것부터 빠른 것 순으로 정의돼 있다', () => {
  const m = pace.PACE_STEPS.map(s => s.mult);
  for (let i = 1; i < m.length; i++) assert.ok(m[i] < m[i - 1], `${i}번째 단계가 더 느리다`);
  assert.equal(m.at(-1), 0, '마지막 단계는 대기 없음이어야 한다');
  assert.ok(pace.PACE_STEPS.some(s => s.key === pace.DEFAULT_PACE));
});

test('읽는 시간이 글 길이를 따라간다', () => {
  assert.ok(pace.readMs(line(10)) < pace.readMs(line(60)));
  assert.ok(pace.readMs(line(60)) < pace.readMs(line(120)));
});

test('짧은 말도 한 박자는 머물고, 긴 말도 무한정 붙잡지 않는다', () => {
  assert.ok(pace.readMs('응') >= 1000, '한 마디도 스치듯 지나가면 안 된다');
  assert.ok(pace.readMs(line(2000)) <= 12000, '건너뛰기가 있으니 상한이 있어야 한다');
});

test('사람이 읽을 수 있는 속도다 — 초당 20자를 넘지 않는다', () => {
  for (const n of [20, 60, 120]) {
    const cps = n / (pace.readMs(line(n), 1) / 1000);
    assert.ok(cps <= 20, `${n}자를 초당 ${cps.toFixed(1)}자로 넘긴다 — 너무 빠르다`);
  }
});

test('말풍선 계획: 타자 시간과 남는 숨을 합치면 읽는 시간이 된다', () => {
  const p = pace.bubblePlan(line(50), 1);
  assert.ok(p.typeMs > 0 && p.beatMs > 0);
  assert.ok(p.typeMs < p.total, '타자가 읽는 시간보다 오래 걸리면 안 된다');
  assert.ok(p.typeMs + p.beatMs >= p.total, '합이 읽는 시간을 밑돌면 안 된다');
});

test('속도를 바꾸면 대기 시간이 그만큼 움직인다', () => {
  const t = line(50);
  const slow = pace.bubblePlan(t, mult('slow')).total;
  const normal = pace.bubblePlan(t, mult('normal')).total;
  const fast = pace.bubblePlan(t, mult('fast')).total;
  assert.ok(slow > normal && normal > fast, `${slow}/${normal}/${fast}`);
  assert.deepEqual(pace.bubblePlan(t, 0), { total: 0, typeMs: 0, beatMs: 0 }, "'즉시'는 아무것도 기다리지 않는다");
  assert.equal(pace.judgeMs('무난', 0), 0);
});

test('판정줄은 말풍선보다 짧게 잡힌다', () => {
  const t = line(120);
  assert.ok(pace.judgeMs(t, 1) < pace.bubblePlan(t, 1).total);
});

test('대기는 정해진 시간만큼 걸린다', async () => {
  const t0 = Date.now();
  await pace.beat(220);
  assert.ok(Date.now() - t0 >= 180, '너무 일찍 풀렸다');
});

test('누르면 대기가 그 자리에서 끝난다', async () => {
  const t0 = Date.now();
  const waiting = pace.beat(5000);
  assert.equal(pace.isWaiting(), true, '대기 중이라는 신호가 서야 한다');
  setTimeout(() => pace.skipNow(), 30);
  await waiting;
  assert.ok(Date.now() - t0 < 1500, '건너뛰기가 먹지 않았다');
  assert.equal(pace.isWaiting(), false);
});

// typeInto는 DOM을 textContent로만 만진다. 가짜 노드 하나면 검증에 충분하다.
const fakeEl = () => ({ textContent: '' });

test('타자 연출이 결국 원문을 그대로 채운다', async () => {
  const el = fakeEl();
  await pace.typeInto(el, '안녕하세요 반갑습니다', null, { typeMs: 40, mult: 1 });
  assert.equal(el.textContent, '안녕하세요 반갑습니다');
});

test('타자 중에 누르면 나머지가 한꺼번에 채워진다', async () => {
  const el = fakeEl();
  const text = line(300);
  const t0 = Date.now();
  const typing = pace.typeInto(el, text, null, { typeMs: 8000, mult: 1 });
  setTimeout(() => pace.skipNow(), 40);
  await typing;
  assert.equal(el.textContent, text);
  assert.ok(Date.now() - t0 < 2000, '누르고도 계속 타자를 쳤다');
});

test("'즉시' 설정에서는 타자 없이 바로 다 나온다", async () => {
  const el = fakeEl();
  const t0 = Date.now();
  await pace.typeInto(el, line(200), null, { mult: 0 });
  assert.equal(el.textContent, line(200));
  assert.ok(Date.now() - t0 < 100);
});

test('없는 속도 키는 무시하고 쓰던 속도를 유지한다', () => {
  const before = pace.getPace();
  assert.equal(pace.setPace('그런속도없음'), before);
});
