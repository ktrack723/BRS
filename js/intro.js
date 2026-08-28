// intro.js — 신입 교육. 게임을 시작하기 전에 알아야 하는 것만 남긴 넉 장이다.
//
// 규칙 하나: **한 장에 한 줄, 한 장에 그림 하나.** 읽는 데 3초를 넘기면 그 장은 실패다.
// 그래서 여기 없는 것들이 있다 — 스크리닝에 뭐가 뜨는지, 심판이 무엇을 내보내는지,
// 시공이 채점되지 않는다는 것. 전부 사실이지만 첫 판을 시작하는 데는 필요 없다.
// 화면에서 직접 보게 되는 것을 미리 설명하지 않는다.
//
// 삽화는 원·사각형·선만 쓴다. 색은 전부 토큰(css/style.css의 .slide-art)을 통한다.

import { $, $$ } from './ui.js';
import { sfx } from './audio.js';

const VB = '0 0 360 150';
const art = (label, body) =>
  `<svg class="art" viewBox="${VB}" role="img" aria-label="${label}">${body}</svg>`;

// 사람 — 머리 하나에 둥근 어깨 하나. 이 게임의 인물은 원래 블록 인형이다.
const person = (x, y, cls) =>
  `<circle class="${cls}" cx="${x}" cy="${y - 27}" r="12.5"/>`
  + `<path class="${cls}" d="M${x - 18} ${y + 13}v-12a18 18 0 0 1 36 0v12z"/>`;

// 서류 한 장 — 청색 머리띠에 제목, 아래에 줄.
const sheet = (x, y, w, h, title, rows = []) =>
  `<rect class="a-shade" x="${x + 3}" y="${y + 3}" width="${w}" height="${h}" rx="3"/>`
  + `<rect class="a-paper" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`
  + `<rect class="a-file" x="${x}" y="${y}" width="${w}" height="19" rx="3"/>`
  + `<text class="a-hdr" x="${x + w / 2}" y="${y + 14}">${title}</text>`
  + rows.map((r, i) => `<text class="a-cap" x="${x + w / 2}" y="${y + 39 + i * 18}">${r}</text>`).join('');

// 요원이 쓰는 칸은 파란 테두리(a-user), 그 밖의 표는 회색 테두리(a-tag)다. 구조도 범례와 같다.
const tag = (x, y, w, t, cls = 'a-user') =>
  `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="28" rx="4"/>`
  + `<text class="a-tag-t" x="${x + w / 2}" y="${y + 19}">${t}</text>`;

const bubble = (x, y, w, cls) => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="21" rx="7"/>`;

// 말풍선 + 안에 든 글줄 둘. 비어 있는 풍선은 대화로 안 읽힌다.
const said = (x, y, w, cls) => bubble(x, y, w, cls)
  + [0.78, 0.52].map((f, i) =>
    `<rect class="a-txt" x="${x + 10}" y="${y + 7 + i * 6}" width="${(w - 20) * f}" height="3" rx="1.5"/>`).join('');

const arrow = (x1, x2, y) =>
  `<path class="a-dash" d="M${x1} ${y}H${x2 - 11}"/>`
  + `<polygon class="a-soft" points="${x2 - 11},${y - 6} ${x2 + 1},${y} ${x2 - 11},${y + 6}"/>`;

const cap = (x, y, t, cls = '') => `<text class="a-cap ${cls}" x="${x}" y="${y}">${t}</text>`;

export const SLIDES = [
  {
    // 요원은 유리 너머에 있다. 말하는 것은 고객이고, 요원의 말풍선에는 금이 그어져 있다.
    art: art('유리벽 너머의 요원과, 마주 앉아 이야기하는 고객과 타겟',
      bubble(18, 16, 56, 'a-tag') + '<path class="a-crack" d="M24 39L68 16"/>'
      + person(46, 96, 'a-ink') + cap(46, 124, '요원')
      + '<path class="a-dash" d="M112 8V142"/>'
      + tag(126, 62, 74, '주문서') + arrow(206, 244, 76)
      + said(224, 20, 52, 'a-bub-c') + said(294, 36, 46, 'a-bub-t')
      + person(262, 100, 'a-file') + cap(262, 128, '고객')
      + person(336, 100, 'a-stamp') + cap(336, 128, '타겟')),
    line: '자네는 그 자리에 없다. 말은 <b>고객</b>이 한다. 자네가 하는 건 그 인간의 <b>서류를 고쳐 쓰는 것</b>뿐이다.',
  },
  {
    // 주문 셋이 각각 어디에 꽂히는지. 외모·성격은 시트를 덮어쓰고, 대사는 그 입에서 나온다.
    art: art('세 장의 주문서가 고객의 시트와 입으로 들어가는 그림',
      tag(6, 10, 104, '외모') + tag(6, 56, 104, '성격') + tag(6, 102, 104, '대사')
      + arrow(116, 168, 24) + arrow(116, 168, 70) + arrow(116, 168, 116)
      + '<rect class="a-box" x="176" y="4" width="180" height="142" rx="6"/>'
      + sheet(266, 20, 78, 80, '시트', ['외모', '성격'])
      + bubble(188, 26, 52, 'a-bub-c') + cap(214, 41, '대사')
      + person(214, 110, 'a-file') + cap(214, 136, '고객')),
    line: '출격 전에 쓰는 칸은 셋 — <b>외모</b>·<b>성격</b>·<b>대사</b>. 아무것도 안 적고 내보내면 그 인간은 그대로 말아먹는다.',
  },
  {
    // 대화는 저 혼자 굴러간다. 요원이 하는 것은 그 줄 사이를 끊고 명령을 꽂는 것뿐이다.
    art: art('오가는 대화를 가로질러 무전이 끼어드는 그림',
      cap(42, 14, '고객') + cap(320, 14, '타겟')
      + said(14, 22, 132, 'a-bub-c') + said(212, 44, 134, 'a-bub-t')
      + '<path class="a-crack" d="M6 82H354"/>'
      + tag(126, 68, 108, '무전 개입')
      + said(14, 100, 108, 'a-bub-c') + said(212, 120, 134, 'a-bub-t')),
    line: '대화는 알아서 굴러간다. 자네는 <b>무전</b>으로 그걸 끊고 명령을 꽂는다 — 고객의 귀에 한 번, 현장에 한 번.',
  },
  {
    // 게이지 둘. 색은 실제 계기판과 같다 — 무드는 초록(바닥나면 붉게), 러브는 자주.
    art: art('무드 게이지와 러브 게이지, 그리고 성사 도장',
      cap(52, 32, '무드', 'a-key e')
      + '<rect class="a-track" x="62" y="16" width="150" height="26" rx="3"/>'
      + '<rect class="a-mood danger" x="64" y="18" width="34" height="22"/>'
      + '<path class="a-crack" d="M232 14l-9 15h13l-9 15"/>' + cap(292, 36, '자리 파탄')
      + cap(52, 106, '러브', 'a-key e')
      + '<rect class="a-track" x="62" y="90" width="150" height="26" rx="3"/>'
      + '<rect class="a-love" x="64" y="92" width="118" height="22"/>'
      + arrow(220, 258, 103)
      + '<circle class="a-seal" cx="308" cy="103" r="30"/><circle class="a-seal" cx="308" cy="103" r="24"/>'
      + '<text class="a-seal-t big" x="308" y="110" transform="rotate(-12 308 103)">성사</text>'),
    line: '<b>무드</b>가 0이면 자리가 그 자리에서 깨지고, 끝까지 갔다면 <b>러브</b> 하나로 성사가 갈린다.',
  },
];

let idx = 0;
let done = () => { };

/** 첫 장부터 다시 그린다. 화면 전환(show)은 부르는 쪽 몫이다. */
export function renderIntro(reset = true) {
  if (reset) idx = 0;
  const s = SLIDES[idx];
  $('#intro-slides').innerHTML =
    `<div class="slide"><div class="slide-art">${s.art}</div><p class="slide-line">${s.line}</p></div>`;
  $('#intro-step').textContent = `신입 교육 ${idx + 1} / ${SLIDES.length}`;
  $('#btn-intro-prev').disabled = idx === 0;
  $('#btn-intro-next').textContent = idx === SLIDES.length - 1 ? '스크리닝 개시 ▶' : '다음 ▶';
  $$('#intro-dots .dot').forEach((d, i) => d.classList.toggle('on', i === idx));
}

function go(n) {
  const next = Math.max(0, Math.min(SLIDES.length - 1, n));
  if (next === idx) return;
  idx = next;
  renderIntro(false);
}

/** 버튼과 키를 한 번만 매단다. isOpen — 지금 이 화면이 떠 있는가 (키 입력을 여기서만 먹는다). */
export function initIntro({ onDone, isOpen }) {
  done = onDone;
  $('#intro-dots').innerHTML = SLIDES.map((_, i) => `<span class="dot" data-i="${i}"></span>`).join('');
  $$('#intro-dots .dot').forEach(d => d.addEventListener('click', () => go(+d.dataset.i)));
  $('#btn-intro-next').addEventListener('click', () => {
    sfx.click();
    if (idx < SLIDES.length - 1) go(idx + 1); else done();
  });
  $('#btn-intro-prev').addEventListener('click', () => { sfx.click(); go(idx - 1); });
  $('#btn-intro-skip').addEventListener('click', () => { sfx.click(); done(); });
  document.addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter') $('#btn-intro-next').click();
    if (e.key === 'ArrowLeft') $('#btn-intro-prev').click();
  });
}
