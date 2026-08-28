// ui.js — 화면 어디서나 쓰는 손잡이들. 게임 규칙은 한 줄도 없다.
//
// game.js가 1000줄을 넘던 시절 여기저기 흩어져 있던 것들을 한 곳에 모은 것이다.
// 여기 있는 것은 전부 「DOM에 무언가를 하는 법」이고, 무엇을 할지는 부르는 쪽이 정한다.

import { sfx } from './audio.js';
import * as pace from './pacing.js';

export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const escapeHtml = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const list = v => (Array.isArray(v) ? v.join(' / ') : String(v ?? ''));

// 스토리지 차단 환경에서도 죽지 않게
export const sget = (store, k) => { try { return window[store].getItem(k); } catch { return null; } };
export const sset = (store, k, v) => { try { v === null ? window[store].removeItem(k) : window[store].setItem(k, v); } catch { } };

// 대기막에 뜨는 참고. 규칙을 한 줄로 줄여 둔 것이라 규칙이 바뀌면 여기도 바뀐다.
const TIPS = [
  '참고 · 출격 전에 요원이 쓰는 곳은 셋이다. 스타일링 · 동기부여 · 코칭. 셋 다 채점되지 않는다.',
  '참고 · 판 도중의 레버는 둘이다. 고객 무전(페이즈당 1회)과 현장 무전(판 전체 1회).',
  '참고 · 고객 무전은 명령이고, 현장 무전은 물리 지원이다 — 적은 그대로 실제로 벌어진다.',
  '참고 · 스타일링은 고객 외모를, 동기부여는 고객 성격을 통째로 덮어쓴다.',
  '참고 · 코칭은 고객에게만 간다. 타겟도 심판도 그 문장을 못 본다.',
  '참고 · 심판이 내보내는 것은 증감 여부뿐이다 — 무드 ▲▼─, 러브 ▲▼─. 점수도 해설도 없다.',
  '참고 · 무드 포인트가 0이 되면 그 자리는 거기서 끝난다. 남은 구간은 돌지 않는다.',
  '참고 · 러브 포인트만이 성사 여부를 가른다. 무드는 자리가 유지되는지만 본다.',
  '참고 · 잘 굴러간 대화는 러브가 안 오른다. 회사원끼리도 할 수 있는 대화이기 때문이다.',
  '참고 · 스크리닝에 뜬 일곱 항목이 전부다. 감춰둔 항목은 없다.',
  '참고 · 타겟 취향은 요원 화면에만 떠 있다. 고객은 코칭으로 들은 것만 안다.',
  '참고 · 만날 장소는 텍스팅에서 정해진다. 코칭에 적으면 화산 분화구도 예약된다.',
];

export function loading(on, label = '') {
  $('#loading-overlay').classList.toggle('hidden', !on);
  if (on) {
    $('#loading-text').textContent = label;
    $('#loading-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  }
}

// 겹쳐 불러도 마지막 하나가 끝날 때 걷힌다.
let loadingDepth = 0;
export async function withLoading(label, fn) {
  loadingDepth++;
  loading(true, label);
  try { return await fn(); } finally { if (--loadingDepth === 0) loading(false); }
}

let toastTimer = null;
export function toast(msg, ms = 5000) {
  const t = $('#toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

// 한 덩어리로 읽는 글(후일담)을 흘려 넣는다. 재생 속도 설정과 '눌러서 건너뛰기'가 똑같이 먹힌다.
export async function typeText(el, text, cps = 60) {
  const mult = pace.paceMult();
  let n = 0;
  await pace.typeInto(el, text, () => { if (n++ % 6 === 0) sfx.type(); },
    { typeMs: mult > 0 ? (text.length / cps) * 1000 * mult : 0, mult });
}
