// avatar.js — LLM이 생성한 스펙(JSON)으로 마인크래프트풍 블록 아바타를 조립하는 three.js 뷰어.
//
// 두 가지가 확장됐다.
//   1) 표현 범위. 가위손 박이 "그건 못 만듭니다"라고 할 일이 없어야 한다.
//      열거형(머리/액세서리/오라)을 대폭 늘리고, 그걸로도 안 되는 것을 위해 **자유 도형(props)**을 넣었다.
//      폭탄이든 후광이든 등에 멘 기타든, 도형·색·크기·붙일 자리·움직임의 조합으로 만든다.
//   2) 감정. 말할 때 한 가지로 튕기는 대신 12종 동작이 있다 — 웃고, 얼고, 움츠리고, 뒤로 자빠진다.
//
// 열거형의 원본은 prompts.js다. 스키마와 렌더러가 어긋나면 LLM이 만든 걸 못 그리게 되므로
// 양쪽이 같은 배열을 본다 (tests/scoring.test.mjs가 이 일치를 검사한다).
import * as THREE from '../vendor/three.module.min.js';
import {
  HAIR_STYLES as HAIR_LIST, ACCESSORIES as ACC_LIST, EXPRESSIONS as EXP_LIST,
  AURAS as AURA_LIST, SPECIES as SPECIES_LIST,
  PROP_SHAPES, PROP_SLOTS, PROP_MOTIONS, EMOTES,
} from './prompts.js';

export const DEFAULT_SPEC = {
  skin: '#ffcc99', hair: '#3a2a1a', hairStyle: 'short',
  top: '#5a6472', bottom: '#3c4450', shoes: '#26282a',
  heightScale: 1, widthScale: 1,
  accessory: 'none', accessoryColor: '#ffee00',
  expression: 'neutral', aura: 'none', species: 'human',
  props: [],
};

const HAIR_STYLES = new Set(HAIR_LIST);
const ACCESSORIES = new Set(ACC_LIST);
const EXPRESSIONS = new Set(EXP_LIST);
const AURAS = new Set(AURA_LIST);
// 인간이 아닌 의뢰인이 절반이다. 종족이 곧 실루엣이 된다. (스타일링으로는 절대 안 바뀐다)
const SPECIES = new Set(SPECIES_LIST);
const SHAPES = new Set(PROP_SHAPES);
const SLOTS = new Set(PROP_SLOTS);
const MOTIONS = new Set(PROP_MOTIONS);
const EMOTE_SET = new Set(EMOTES);

const MAX_PROPS = 6;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const clamp = (v, a, b) => Math.min(b, Math.max(a, Number(v) || 1));
const hexOr = (v, fallback) => {
  if (typeof v !== 'string') return fallback;
  const s = v.startsWith('#') ? v : '#' + v;
  return HEX_RE.test(s) ? s : fallback;
};

export function sanitizeSpec(raw) {
  const s = { ...DEFAULT_SPEC, ...(raw || {}) };
  for (const k of ['skin', 'hair', 'top', 'bottom', 'shoes', 'accessoryColor']) {
    s[k] = hexOr(s[k], DEFAULT_SPEC[k]);
  }
  s.heightScale = clamp(s.heightScale, 0.7, 1.45);
  s.widthScale = clamp(s.widthScale, 0.6, 1.7);
  if (!HAIR_STYLES.has(s.hairStyle)) s.hairStyle = 'short';
  if (!ACCESSORIES.has(s.accessory)) s.accessory = 'none';
  if (!EXPRESSIONS.has(s.expression)) s.expression = 'neutral';
  if (!AURAS.has(s.aura)) s.aura = 'none';
  if (!SPECIES.has(s.species)) s.species = 'human';
  s.props = sanitizeProps(s.props);
  return s;
}

// 자유 도형은 LLM이 만드는 것이라 뭐가 들어올지 모른다. 통째로 걸러 넣는다.
function sanitizeProps(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const p of raw.slice(0, MAX_PROPS)) {
    if (!p || typeof p !== 'object') continue;
    if (!SHAPES.has(p.shape) || !SLOTS.has(p.at)) continue;
    out.push({
      shape: p.shape,
      color: hexOr(p.color, '#cccccc'),
      size: clamp(p.size, 0.05, 1.2),
      at: p.at,
      motion: MOTIONS.has(p.motion) ? p.motion : 'none',
      label: typeof p.label === 'string' ? p.label.slice(0, 24) : '',
    });
  }
  return out;
}

function mat(color) { return new THREE.MeshToonMaterial({ color: new THREE.Color(color) }); }
function box(w, h, d, color) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); }

// ── 블록 아바타 조립 ────────────────────────────────────
// 구조: g (배치·좌우 회전) → body (감정에 따른 상체 기울임) → 부위들
// 감정 동작이 좌우 회전과 섞이지 않도록 한 겹을 더 뒀다.
export function buildAvatar(rawSpec) {
  const spec = sanitizeSpec(rawSpec);
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = spec.skin, hair = spec.hair;

  const legL = box(0.2, 0.5, 0.24, spec.bottom); legL.position.set(-0.14, 0.25, 0);
  const legR = legL.clone(); legR.position.x = 0.14;
  const shoeL = box(0.22, 0.1, 0.3, spec.shoes); shoeL.position.set(-0.14, 0.05, 0.02);
  const shoeR = shoeL.clone(); shoeR.position.x = 0.14;
  const torso = box(0.6, 0.55, 0.32, spec.top); torso.position.y = 0.775;
  const armL = box(0.16, 0.5, 0.2, spec.top); armL.position.set(-0.4, 0.78, 0);
  const armR = armL.clone(); armR.position.x = 0.4;
  const handL = box(0.14, 0.12, 0.16, skin); handL.position.set(-0.4, 0.48, 0);
  const handR = handL.clone(); handR.position.x = 0.4;
  const head = box(0.55, 0.5, 0.5, skin); head.position.y = 1.32;

  const headG = new THREE.Group();
  headG.add(head);
  addFace(headG, spec);
  addHair(headG, spec.hairStyle, hair);
  addAccessory(headG, spec);
  body.add(legL, legR, shoeL, shoeR, torso, armL, armR, handL, handR, headG);
  addSpecies(body, headG, spec, { armL, armR, torso });
  const props = addProps(body, headG, spec);

  // 머리 그룹의 회전축을 목 높이로 옮긴다 (발밑 축이면 회전 시 머리가 옆으로 미끄러진다)
  headG.position.y = 1.1;
  for (const ch of headG.children) ch.position.y -= 1.1;

  // 도형의 기준 좌표는 위 보정이 끝난 뒤에 잡아야 한다.
  // 머리에 붙은 도형은 여기서 y가 1.1만큼 내려가므로, 보정 전 좌표를 기억해두면
  // bob/orbit 같은 움직임이 매 프레임 원래 자리로 튀어 오른다.
  for (const pr of props) pr.base = pr.mesh.position.clone();

  g.scale.set(spec.widthScale, spec.heightScale, spec.widthScale);
  g.userData = {
    body, headG, armL, armR, spec, props,
    // 종족 파츠가 팔 각도를 미리 틀어놓는 경우가 있다(좀비는 팔을 앞으로 뻗는다).
    // 감정 동작이 매 프레임 rotation.x를 덮어쓰므로, 그 기본 자세를 따로 기억해 더한다.
    armBaseX: { l: armL.rotation.x, r: armR.rotation.x },
    emote: null, jump: 0, phase: Math.random() * Math.PI * 2,
  };
  return g;
}

// ── 표정 ────────────────────────────────────────────────
function addFace(headG, spec) {
  const z = 0.26; // 얼굴 면
  const e = spec.expression;
  const eyeL = box(0.08, 0.1, 0.02, '#111111'); eyeL.position.set(-0.12, 1.36, z);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.12;
  headG.add(eyeL, eyeR);

  if (e === 'weird') { eyeR.scale.set(1.8, 1.8, 1); eyeR.position.y = 1.39; }
  if (e === 'dead') {   // 눈이 ✕ 두 개
    eyeL.visible = false; eyeR.visible = false;
    for (const sx of [-1, 1]) for (const rot of [0.7, -0.7]) {
      const bar = box(0.14, 0.025, 0.02, '#111111');
      bar.position.set(sx * 0.12, 1.36, z); bar.rotation.z = rot; headG.add(bar);
    }
  }
  if (e === 'love') {   // 눈이 하트 대신 붉은 마름모
    for (const eye of [eyeL, eyeR]) { eye.material = mat('#b0455f'); eye.scale.set(1.4, 1.4, 1); eye.rotation.z = 0.78; }
  }
  if (e === 'shock') {  // 눈이 커지고 입이 벌어진다
    for (const eye of [eyeL, eyeR]) { eye.scale.set(1.6, 1.7, 1); }
    const jawDrop = box(0.16, 0.14, 0.02, '#3a1a1a'); jawDrop.position.set(0, 1.16, z); headG.add(jawDrop);
  }
  if (e === 'angry') {
    const browL = box(0.14, 0.03, 0.02, '#aa0000'); browL.position.set(-0.12, 1.45, z); browL.rotation.z = -0.5;
    const browR = browL.clone(); browR.position.x = 0.12; browR.rotation.z = 0.5;
    headG.add(browL, browR);
  }
  if (e === 'sad') {
    const browL = box(0.13, 0.03, 0.02, '#4a4a5a'); browL.position.set(-0.13, 1.45, z); browL.rotation.z = 0.42;
    const browR = browL.clone(); browR.position.x = 0.13; browR.rotation.z = -0.42;
    const tear = box(0.04, 0.12, 0.02, '#6aa8d8'); tear.position.set(-0.14, 1.26, z);
    headG.add(browL, browR, tear);
  }
  if (e === 'smug') {
    const browL = box(0.13, 0.03, 0.02, '#333333'); browL.position.set(-0.12, 1.46, z); browL.rotation.z = -0.3;
    const browR = browL.clone(); browR.position.x = 0.12; browR.rotation.z = -0.1;
    eyeL.scale.set(1, 0.5, 1);
    headG.add(browL, browR);
  }
  if (e === 'chad') {
    const jaw = box(0.58, 0.12, 0.52, spec.skin); jaw.position.set(0, 1.1, 0);
    const browL = box(0.14, 0.04, 0.02, '#222222'); browL.position.set(-0.12, 1.44, z);
    const browR = browL.clone(); browR.position.x = 0.12;
    headG.add(jaw, browL, browR);
  }
  if (e === 'shy') {
    const cheekL = box(0.09, 0.05, 0.02, '#ff7799'); cheekL.position.set(-0.17, 1.27, z);
    const cheekR = cheekL.clone(); cheekR.position.x = 0.17;
    headG.add(cheekL, cheekR);
  }

  const MOUTH = {
    happy: [0.2, 0.07, '#e0447a', 0], neutral: [0.12, 0.03, '#a55', 0],
    shy: [0.07, 0.04, '#e0447a', 0], chad: [0.2, 0.03, '#333333', 0],
    weird: [0.14, 0.06, '#e0447a', 0.1], angry: [0.16, 0.05, '#552222', 0],
    sad: [0.13, 0.04, '#7a4a5a', 0], smug: [0.14, 0.03, '#8a4a5a', 0.05],
    dead: [0.16, 0.04, '#5a4a4a', 0], love: [0.18, 0.06, '#e0447a', 0],
    shock: [0.05, 0.02, '#5a2a2a', 0],
  };
  const m = MOUTH[e] || MOUTH.neutral;
  const mouth = box(m[0], m[1], 0.02, m[2]);
  mouth.position.set(m[3], 1.19, z);
  headG.add(mouth);
}

// ── 머리 ────────────────────────────────────────────────
function addHair(headG, style, color) {
  const add = (...m) => headG.add(...m);
  switch (style) {
    case 'bald': break;
    case 'buzz': {
      const cap = box(0.57, 0.06, 0.52, color); cap.position.y = 1.56; add(cap);
      break;
    }
    case 'long': {
      const top = box(0.6, 0.14, 0.55, color); top.position.y = 1.6;
      const back = box(0.6, 0.7, 0.14, color); back.position.set(0, 1.28, -0.28);
      add(top, back); break;
    }
    case 'mohawk': {
      const strip = box(0.12, 0.3, 0.55, color); strip.position.y = 1.68; add(strip);
      break;
    }
    case 'afro': {
      const puff = box(0.75, 0.5, 0.7, color); puff.position.y = 1.66; add(puff);
      break;
    }
    case 'twintail': {
      const top = box(0.6, 0.14, 0.55, color); top.position.y = 1.6;
      const tailL = box(0.13, 0.62, 0.13, color); tailL.position.set(-0.36, 1.22, -0.1); tailL.rotation.z = 0.18;
      const tailR = tailL.clone(); tailR.position.x = 0.36; tailR.rotation.z = -0.18;
      add(top, tailL, tailR); break;
    }
    case 'ponytail': {
      const top = box(0.6, 0.14, 0.55, color); top.position.y = 1.6;
      const tie = box(0.14, 0.1, 0.14, color); tie.position.set(0, 1.5, -0.3);
      const tail = box(0.15, 0.66, 0.15, color); tail.position.set(0, 1.2, -0.36); tail.rotation.x = -0.18;
      add(top, tie, tail); break;
    }
    case 'bowl': {
      const cap = box(0.62, 0.28, 0.57, color); cap.position.y = 1.5; add(cap);
      break;
    }
    case 'flattop': {
      const slab = box(0.6, 0.3, 0.54, color); slab.position.y = 1.68;
      const side = box(0.63, 0.12, 0.56, color); side.position.y = 1.5;
      add(slab, side); break;
    }
    case 'dreads': {
      const top = box(0.6, 0.12, 0.55, color); top.position.y = 1.59; add(top);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const strand = box(0.08, 0.5 + (i % 3) * 0.12, 0.08, color);
        strand.position.set(Math.cos(a) * 0.28, 1.32, Math.sin(a) * 0.26);
        add(strand);
      }
      break;
    }
    case 'curls': {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 7), mat(color));
        puff.position.set(Math.cos(a) * 0.26, 1.6 + Math.sin(i * 2) * 0.05, Math.sin(a) * 0.24);
        add(puff);
      }
      const crownP = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), mat(color));
      crownP.position.y = 1.66; add(crownP);
      break;
    }
    case 'updo': {
      const base = box(0.6, 0.12, 0.55, color); base.position.y = 1.58;
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 10), mat(color));
      bun.position.set(0, 1.78, -0.05);
      const pin = box(0.02, 0.28, 0.02, '#d8c078'); pin.position.set(0.1, 1.8, -0.05); pin.rotation.z = 0.5;
      add(base, bun, pin); break;
    }
    case 'beehive': {
      const base = box(0.6, 0.12, 0.55, color); base.position.y = 1.58;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.55, 10), mat(color));
      cone.position.y = 1.92;
      add(base, cone); break;
    }
    case 'wave': {
      const top = box(0.6, 0.13, 0.55, color); top.position.y = 1.59; add(top);
      for (let i = 0; i < 4; i++) {
        const w = box(0.62, 0.13, 0.13, color);
        w.position.set(0, 1.46 - i * 0.15, -0.28 - (i % 2) * 0.06);
        add(w);
      }
      break;
    }
    case 'fin': {  // 어인 등지느러미
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.42, 3), mat(color));
      fin.position.set(0, 1.74, -0.04); fin.rotation.x = -0.25;
      const ridge = box(0.1, 0.14, 0.5, color); ridge.position.set(0, 1.6, -0.02);
      add(fin, ridge); break;
    }
    case 'mane': {  // 사자 갈기
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.19, 6, 12), mat(color));
      ring.position.set(0, 1.3, -0.02);
      const top = box(0.66, 0.18, 0.6, color); top.position.y = 1.62;
      add(ring, top); break;
    }
    case 'spiky': {
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 4), mat(color));
        spike.position.set(-0.2 + i * 0.1, 1.66, 0.02 * (i % 2 ? 1 : -1));
        add(spike);
      }
      const base = box(0.58, 0.1, 0.53, color); base.position.y = 1.57; add(base);
      break;
    }
    default: { // short
      const top = box(0.58, 0.14, 0.53, color); top.position.y = 1.6;
      const fringe = box(0.58, 0.1, 0.06, color); fringe.position.set(0, 1.53, 0.25);
      add(top, fringe);
    }
  }
}

// ── 액세서리 ────────────────────────────────────────────
function addAccessory(headG, spec) {
  const c = spec.accessoryColor, z = 0.27;
  const add = (...m) => headG.add(...m);
  switch (spec.accessory) {
    case 'glasses': {
      const rimL = box(0.14, 0.12, 0.02, c); rimL.position.set(-0.12, 1.36, z);
      const rimR = rimL.clone(); rimR.position.x = 0.12;
      const bridge = box(0.1, 0.03, 0.02, c); bridge.position.set(0, 1.37, z);
      add(rimL, rimR, bridge); break;
    }
    case 'sunglasses': {
      const bar = box(0.42, 0.11, 0.03, '#111111'); bar.position.set(0, 1.36, z); add(bar); break;
    }
    case 'monocle': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 6, 14), mat(c));
      ring.position.set(0.12, 1.36, z);
      const chain = box(0.015, 0.24, 0.015, c); chain.position.set(0.2, 1.24, z); chain.rotation.z = 0.3;
      add(ring, chain); break;
    }
    case 'eyepatch': {
      const patch = box(0.17, 0.15, 0.03, '#141414'); patch.position.set(-0.12, 1.36, z);
      const strap = box(0.58, 0.03, 0.52, '#141414'); strap.position.set(0, 1.42, 0); strap.rotation.z = 0.16;
      add(patch, strap); break;
    }
    case 'mustache': {
      const m1 = box(0.2, 0.05, 0.03, c); m1.position.set(0, 1.24, z); add(m1); break;
    }
    case 'beard': {
      const b1 = box(0.5, 0.16, 0.06, c); b1.position.set(0, 1.12, 0.24); add(b1); break;
    }
    case 'bandage': {
      const b1 = box(0.2, 0.05, 0.03, '#f0e8d8'); b1.position.set(0.14, 1.44, z); b1.rotation.z = 0.5;
      const b2 = b1.clone(); b2.rotation.z = -0.5;
      add(b1, b2); break;
    }
    case 'clownnose': {
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), mat('#cc2222'));
      nose.position.set(0, 1.29, 0.3); add(nose); break;
    }
    case 'hat': {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 12), mat(c)); brim.position.y = 1.58;
      const crownB = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.3, 12), mat(c)); crownB.position.y = 1.74;
      add(brim, crownB); break;
    }
    case 'helmet': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(c));
      dome.position.y = 1.52;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 6, 14), mat(c));
      rim.position.y = 1.52; rim.rotation.x = Math.PI / 2;
      add(dome, rim); break;
    }
    case 'gasmask': {
      const plate = box(0.46, 0.3, 0.06, c); plate.position.set(0, 1.3, 0.27);
      const filterL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 10), mat('#3a3a3a'));
      filterL.position.set(-0.16, 1.22, 0.34); filterL.rotation.x = Math.PI / 2;
      const filterR = filterL.clone(); filterR.position.x = 0.16;
      add(plate, filterL, filterR); break;
    }
    case 'crown': {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.12, 8), mat(c)); ring.position.y = 1.64;
      add(ring);
      for (let i = 0; i < 4; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), mat(c));
        const a = (i / 4) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.24, 1.75, Math.sin(a) * 0.24);
        add(spike);
      }
      break;
    }
    case 'halo': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 18), mat(c));
      ring.position.y = 1.9; ring.rotation.x = Math.PI / 2;
      add(ring); break;
    }
    case 'horns': {
      for (const sx of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 6), mat(c));
        horn.position.set(sx * 0.2, 1.72, -0.02); horn.rotation.z = sx * -0.4;
        add(horn);
      }
      break;
    }
    case 'bunnyears': {
      for (const sx of [-1, 1]) {
        const ear = box(0.1, 0.46, 0.06, c); ear.position.set(sx * 0.14, 1.82, -0.02); ear.rotation.z = sx * 0.14;
        const inner = box(0.05, 0.34, 0.02, '#f0a8c0'); inner.position.set(sx * 0.14, 1.82, 0.02); inner.rotation.z = sx * 0.14;
        add(ear, inner);
      }
      break;
    }
    case 'headband': {
      const band = box(0.6, 0.07, 0.55, c); band.position.y = 1.47; add(band); break;
    }
    case 'bandana': {
      const band = box(0.6, 0.14, 0.56, c); band.position.y = 1.5;
      const knot = box(0.1, 0.1, 0.1, c); knot.position.set(-0.3, 1.46, -0.2);
      const tail = box(0.06, 0.24, 0.06, c); tail.position.set(-0.32, 1.32, -0.22); tail.rotation.z = 0.4;
      add(band, knot, tail); break;
    }
    case 'earrings': {
      for (const sx of [-1, 1]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 12), mat(c));
        hoop.position.set(sx * 0.29, 1.24, 0);
        add(hoop);
      }
      break;
    }
    case 'scarf': {
      const wrap = box(0.5, 0.16, 0.36, c); wrap.position.set(0, 1.06, 0);
      const hang = box(0.14, 0.4, 0.08, c); hang.position.set(0.16, 0.86, 0.18);
      add(wrap, hang); break;
    }
    case 'necktie': {
      const knot = box(0.1, 0.1, 0.08, c); knot.position.set(0, 1.03, 0.18);
      const blade = box(0.13, 0.36, 0.05, c); blade.position.set(0, 0.83, 0.18);
      add(knot, blade); break;
    }
    case 'cigar': {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8), mat('#5a3a20'));
      stick.position.set(0.14, 1.19, 0.34); stick.rotation.z = Math.PI / 2; stick.rotation.y = 0.3;
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), mat('#ff6a2a'));
      ember.position.set(0.28, 1.19, 0.38);
      add(stick, ember); break;
    }
    case 'antenna': {
      for (const x of [-0.13, 0.13]) {
        const rod = box(0.03, 0.26, 0.03, c); rod.position.set(x, 1.7, 0);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mat(c)); bulb.position.set(x, 1.85, 0);
        add(rod, bulb);
      }
      break;
    }
    case 'mask': {
      const plate = box(0.5, 0.3, 0.04, c); plate.position.set(0, 1.3, 0.27); add(plate);
      break;
    }
    case 'flower': {
      const stem = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), mat('#ffdd00')); stem.position.set(0.26, 1.55, 0.12);
      add(stem);
      for (let i = 0; i < 5; i++) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), mat(c));
        const a = (i / 5) * Math.PI * 2;
        petal.position.set(0.26 + Math.cos(a) * 0.09, 1.55 + Math.sin(a) * 0.09, 0.1);
        add(petal);
      }
      break;
    }
  }
}

// ── 자유 도형 ───────────────────────────────────────────
// 열거형으로 못 담는 건 전부 여기로 온다. 폭탄, 후광, 등에 멘 기타, 머리 위를 도는 위성.
// 슬롯이 붙일 자리를 정하고, motion이 매 프레임 어떻게 움직일지 정한다.
const SLOT_POS = {
  head:      { on: 'head', p: [0, 1.66, 0] },
  face:      { on: 'head', p: [0, 1.3, 0.33] },
  crown:     { on: 'head', p: [0, 1.92, 0] },
  chest:     { on: 'body', p: [0, 0.86, 0.21] },
  back:      { on: 'body', p: [0, 0.86, -0.24] },
  waist:     { on: 'body', p: [0, 0.54, 0.2] },
  handL:     { on: 'body', p: [-0.44, 0.4, 0.1] },
  handR:     { on: 'body', p: [0.44, 0.4, 0.1] },
  shoulderL: { on: 'body', p: [-0.44, 1.04, 0] },
  shoulderR: { on: 'body', p: [0.44, 1.04, 0] },
  feet:      { on: 'body', p: [0, 0.08, 0.22] },
  above:     { on: 'body', p: [0, 2.05, 0] },
  orbit:     { on: 'body', p: [0, 1.5, 0] },
  ground:    { on: 'body', p: [0, 0.06, 0.5] },
};

function propGeometry(shape, s) {
  switch (shape) {
    case 'sphere': return new THREE.SphereGeometry(s / 2, 10, 10);
    case 'cone': return new THREE.ConeGeometry(s / 2, s, 8);
    case 'cylinder': return new THREE.CylinderGeometry(s / 2, s / 2, s, 10);
    case 'torus': return new THREE.TorusGeometry(s / 2, s / 6, 8, 14);
    case 'tetra': return new THREE.TetrahedronGeometry(s / 2);
    case 'octa': return new THREE.OctahedronGeometry(s / 2);
    case 'disc': return new THREE.CylinderGeometry(s / 2, s / 2, s / 8, 14);
    case 'spike': return new THREE.ConeGeometry(s / 5, s * 1.4, 6);
    case 'star': {
      const g = new THREE.OctahedronGeometry(s / 2, 0);
      g.scale(1, 1, 0.28);
      return g;
    }
    default: return new THREE.BoxGeometry(s, s, s);
  }
}

function addProps(body, headG, spec) {
  const out = [];
  spec.props.forEach((p, i) => {
    const slot = SLOT_POS[p.at] || SLOT_POS.chest;
    const mesh = new THREE.Mesh(propGeometry(p.shape, p.size), mat(p.color));
    mesh.position.set(...slot.p);
    // 머리 위의 링·원반은 세워두면 정체를 알 수 없다. 눕혀야 후광으로 읽힌다.
    if ((p.shape === 'torus' || p.shape === 'disc') && ['crown', 'above', 'head'].includes(p.at)) {
      mesh.rotation.x = Math.PI / 2;
    }
    if (p.at === 'orbit') mesh.position.x += 0.62;   // 궤도 반지름
    (slot.on === 'head' ? headG : body).add(mesh);
    out.push({
      mesh, motion: p.motion, at: p.at, label: p.label,
      base: mesh.position.clone(),   // buildAvatar가 머리 보정 후 다시 잡는다
      phase: (i / Math.max(1, spec.props.length)) * Math.PI * 2,
    });
  });
  return out;
}

// ── 종족 파츠 ───────────────────────────────────────────
// 어인·퍼리·좀비·뱀파이어·외계인·안드로이드가 절반이다. 종족이 실루엣을 바꾼다.
function addSpecies(body, headG, spec, parts) {
  const skin = spec.skin;
  const add = (...m) => headG.add(...m);
  const addBody = (...m) => body.add(...m);

  switch (spec.species) {
    case 'fish': {
      // 볼 아가미 3줄 + 옆지느러미 + 꼬리지느러미
      for (let i = 0; i < 3; i++) {
        const gill = box(0.03, 0.1, 0.02, '#0d4f58');
        gill.position.set(-0.28, 1.3 - i * 0.02, 0.1 - i * 0.07); add(gill);
        const gr = gill.clone(); gr.position.x = 0.28; add(gr);
      }
      for (const sx of [-1, 1]) {
        const sideFin = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 3), mat(spec.hair));
        sideFin.position.set(sx * 0.3, 1.3, -0.1); sideFin.rotation.z = sx * 1.2; add(sideFin);
      }
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 3), mat(spec.hair));
      tail.position.set(0, 0.5, -0.3); tail.rotation.x = 1.5; addBody(tail);
      break;
    }
    case 'lion':
    case 'cat': {
      const big = spec.species === 'lion';
      for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(big ? 0.12 : 0.09, big ? 0.2 : 0.16, 4), mat(spec.hair));
        ear.position.set(sx * 0.2, 1.68, 0); add(ear);
      }
      const snout = box(0.2, 0.12, 0.1, skin); snout.position.set(0, 1.22, 0.29); add(snout);
      const nose = box(0.08, 0.06, 0.03, '#2a1a1a'); nose.position.set(0, 1.26, 0.35); add(nose);
      for (let i = 0; i < 3; i++) {
        for (const sx of [-1, 1]) {
          const wk = box(0.16, 0.012, 0.012, '#ffffff');
          wk.position.set(sx * 0.24, 1.22 + i * 0.035, 0.28); wk.rotation.z = sx * (0.15 - i * 0.12); add(wk);
        }
      }
      const tail = box(0.08, 0.08, 0.5, spec.hair); tail.position.set(0, 0.72, -0.35); tail.rotation.x = 0.5; addBody(tail);
      if (big) { const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), mat(spec.hair)); tuft.position.set(0, 0.6, -0.58); addBody(tuft); }
      break;
    }
    case 'zombie': {
      // 팔을 앞으로. 실밥 자국과 흘러내린 눈.
      parts.armL.rotation.x = -1.35; parts.armR.rotation.x = -1.35;
      for (let i = 0; i < 4; i++) {
        const st = box(0.03, 0.02, 0.02, '#5a2a2a');
        st.position.set(-0.2 + i * 0.11, 1.44, 0.26); add(st);
      }
      const drip = box(0.06, 0.1, 0.02, '#2a4a2a'); drip.position.set(-0.12, 1.28, 0.26); add(drip);
      const patch = box(0.14, 0.12, 0.02, '#7a8f6a'); patch.position.set(0.2, 1.24, 0.26); add(patch);
      break;
    }
    case 'vampire': {
      for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 4), mat(skin));
        ear.position.set(sx * 0.3, 1.4, 0); ear.rotation.z = sx * -0.4; add(ear);
      }
      for (const sx of [-1, 1]) {
        const fang = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.09, 4), mat('#ffffff'));
        fang.position.set(sx * 0.06, 1.14, 0.26); fang.rotation.x = Math.PI; add(fang);
      }
      const cape = box(0.72, 0.9, 0.06, '#5a0d1a'); cape.position.set(0, 0.85, -0.2); addBody(cape);
      const collar = box(0.5, 0.26, 0.06, '#8a0d2a'); collar.position.set(0, 1.15, -0.22); addBody(collar);
      break;
    }
    case 'alien': {
      // 눈만 거대하다. 나머지는 작다.
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), mat('#0a0a12'));
        eye.position.set(sx * 0.14, 1.35, 0.2); eye.scale.set(1, 1.4, 0.6); add(eye);
        const glint = box(0.04, 0.04, 0.02, '#ffffff'); glint.position.set(sx * 0.16, 1.42, 0.31); add(glint);
      }
      const dome = box(0.5, 0.16, 0.46, skin); dome.position.y = 1.58; add(dome);
      break;
    }
    case 'robot': {
      const visor = box(0.44, 0.14, 0.03, '#0d1a22'); visor.position.set(0, 1.36, 0.26); add(visor);
      for (let i = 0; i < 3; i++) {
        const px = box(0.05, 0.05, 0.02, spec.accessoryColor);
        px.position.set(-0.12 + i * 0.12, 1.36, 0.29); add(px);
      }
      const jaw = box(0.36, 0.06, 0.04, '#8a9aa8'); jaw.position.set(0, 1.16, 0.26); add(jaw);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8), mat('#8a9aa8'));
      neck.position.set(0, 1.06, 0); addBody(neck);
      const chest = box(0.24, 0.16, 0.04, '#1a2a33'); chest.position.set(0, 0.82, 0.17); addBody(chest);
      const led = box(0.07, 0.07, 0.02, spec.accessoryColor); led.position.set(0, 0.82, 0.2); addBody(led);
      break;
    }
  }
}

// ── 이모지 스프라이트 ───────────────────────────────────
// 이모지 대신 단색 활자 기호를 쓴다. 관찰실 계측 표시처럼 보여야 하기 때문이다.
// 폰트가 없어도 깨지지 않도록 전부 널리 쓰이는 활자 기호만 골랐다.
const texCache = new Map();
function glyphTexture(ch, color) {
  const key = ch + color;
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = 'bold 46px "IBM Plex Mono", ui-monospace, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(ch, 32, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}
function glyphSprite(ch, color, size = 0.3) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glyphTexture(ch, color), transparent: true, depthWrite: false,
  }));
  sp.scale.set(size, size, 1);
  return sp;
}

// [기호, 색] — 캐릭터 분위기를 계측 표시로 환산한다
const AURA_MARK = {
  sparkle:   ['+', '#cdd6c0'],
  hearts:    ['♡', '#b0566c'],
  fire:      ['▲', '#b5713a'],
  gloom:     ['▼', '#6d7a86'],
  money:     ['₩', '#8a7f45'],
  lightning: ['↑', '#a99433'],
  ice:       ['*', '#7fa8c0'],
  skull:     ['†', '#8a8a92'],
  bubbles:   ['○', '#7fb0bd'],
  static:    ['#', '#8f8f8f'],
  rainbow:   ['≈', '#a06a8a'],
  bomb:      ['●', '#4a4a4a'],
  stink:     ['~', '#7a8a52'],
  holy:      ['◇', '#c2b46a'],
  question:  ['?', '#8a8f7a'],
};

// ── 감정 동작 ───────────────────────────────────────────
// 심판이 매 턴 clientEmote/targetEmote를 뱉는다. 그걸 여기서 몸으로 옮긴다.
// 각 항목은 [지속시간, 적용 함수]. 함수는 진행도 p(0→1)와 잔여치 k를 받아 자세를 덮어쓴다.
const EMOTE_MOVES = {
  talk:   [0.55, (o, p, k, t) => { o.y += k * 0.3; o.armL += k * 1.2; o.armR -= k * 1.2; }],
  laugh:  [1.3, (o, p, k, t) => { o.lean -= k * 0.32; o.headX -= k * 0.34; o.y += Math.abs(Math.sin(t * 22)) * k * 0.14; o.armL += k * 0.9; o.armR -= k * 0.9; }],
  shy:    [1.4, (o, p, k) => { o.headX += k * 0.36; o.lean += k * 0.14; o.armL -= k * 0.5; o.armR += k * 0.5; o.y -= k * 0.05; }],
  panic:  [1.2, (o, p, k, t) => { o.armLx -= k * 2.2; o.armRx -= k * 2.2; o.spinZ += Math.sin(t * 28) * k * 0.22; o.y += Math.abs(Math.sin(t * 18)) * k * 0.1; }],
  angry:  [1.1, (o, p, k, t) => { o.lean -= k * 0.3; o.headX -= k * 0.12; o.armL += k * 0.55; o.armR -= k * 0.55; o.spinZ += Math.sin(t * 30) * k * 0.06; }],
  sad:    [1.6, (o, p, k) => { o.headX += k * 0.5; o.lean += k * 0.26; o.y -= k * 0.09; o.armL -= k * 0.14; o.armR += k * 0.14; }],
  proud:  [1.3, (o, p, k) => { o.lean -= k * 0.22; o.headX -= k * 0.18; o.y += k * 0.12; o.armL += k * 1.5; o.armR -= k * 1.5; }],
  freeze: [1.5, (o, p, k) => { o.still = Math.max(o.still, k); o.spinZ += k * 0.07; }],
  smug:   [1.2, (o, p, k) => { o.headZ += k * 0.3; o.headY += k * 0.22; o.armL += k * 0.9; }],
  cringe: [1.3, (o, p, k) => { o.lean += k * 0.4; o.headY += k * 0.5; o.armL -= k * 0.3; o.armRx -= k * 1.5; }],
  nod:    [1.1, (o, p, k, t) => { o.headX += Math.sin(t * 11) * k * 0.4; }],
  shake:  [1.1, (o, p, k, t) => { o.headY += Math.sin(t * 13) * k * 0.45; }],
};

// ── 썸네일 렌더러 ───────────────────────────────────────
// 의뢰 대장에 30쌍 = 60명이 깔린다. 카드마다 WebGL 컨텍스트를 잡으면 브라우저 상한(보통 16개)에서 터진다.
// 그래서 오프스크린 렌더러 하나를 돌려쓰며 PNG로 구워낸다. 선택된 커플만 살아 있는 3D 무대에 올린다.
let thumbRenderer = null, thumbScene = null, thumbCam = null;
const thumbCache = new Map();

function initThumb() {
  if (thumbRenderer) return;
  const cv = document.createElement('canvas');
  cv.width = 320; cv.height = 400;
  thumbRenderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  thumbRenderer.setClearColor(0x000000, 0);
  thumbScene = new THREE.Scene();
  thumbScene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(2, 5, 4);
  const rim = new THREE.PointLight(0x9fb4c8, 10, 12); rim.position.set(-2, 2, 2);
  thumbScene.add(sun, rim);
  thumbCam = new THREE.PerspectiveCamera(38, 320 / 400, 0.1, 40);
  thumbCam.position.set(0.9, 1.35, 3.2);
  thumbCam.lookAt(0, 0.9, 0);
}

export function renderThumb(rawSpec, cacheKey = null) {
  if (cacheKey && thumbCache.has(cacheKey)) return thumbCache.get(cacheKey);
  initThumb();
  const g = buildAvatar(rawSpec);
  g.rotation.y = 0.35;
  thumbScene.add(g);
  thumbRenderer.render(thumbScene, thumbCam);
  const url = thumbRenderer.domElement.toDataURL('image/png');
  thumbScene.remove(g);
  disposeGroup(g);
  if (cacheKey) thumbCache.set(cacheKey, url);
  return url;
}

export function clearThumbCache() { thumbCache.clear(); }

// ── 뷰어 ────────────────────────────────────────────────
export class AvatarViewer {
  constructor(canvas, { spin = false, cameraY = 1.3, cameraZ = 4.0 } = {}) {
    this.canvas = canvas;
    this.spin = spin;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
    this.camera.position.set(0, cameraY, cameraZ);
    this.camera.lookAt(0, 0.9, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(2, 5, 4);
    this.scene.add(sun);
    // 관찰실 형광등. 성사 연출('party') 때만 살짝 따뜻해진다.
    this.discoA = new THREE.PointLight(0xd8e0e8, 16, 14); this.discoA.position.set(2.5, 2.8, 1.5);
    this.discoB = new THREE.PointLight(0xb8c4b0, 14, 14); this.discoB.position.set(-2.5, 2.8, 1.5);
    this.scene.add(this.discoA, this.discoB);

    // 무대 바닥
    this.tiles = [];
    const floor = new THREE.Group();
    for (let x = -4; x < 4; x++) for (let z = -3; z < 3; z++) {
      const t = box(0.78, 0.08, 0.78, (x + z) % 2 ? '#5c6355' : '#666d5f');
      t.position.set(x * 0.8 + 0.4, -0.06, z * 0.8 + 0.4);
      this.tiles.push(t); floor.add(t);
    }
    this.floorTiles = floor;
    this.baseTileColors = this.tiles.map(t => t.material.color.getHex());
    this.scene.add(floor);

    this.avatars = { left: null, right: null };
    this.particles = [];
    this.party = false;
    this.lastTileFlash = 0;
    this.auraTick = 0;
    this._dead = false;
    this._clock = new THREE.Clock();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // 얼굴은 +Z를 본다(눈·코가 z>0에 붙어 있다). Y축 θ 회전은 시선을 (sinθ, 0, cosθ)로 보낸다.
  // 왼쪽(x=-0.9)이 상대를 보려면 +X를 봐야 하니 sinθ>0 → θ=+π/2, 오른쪽은 그 반대.
  // 부호가 뒤집혀 있어서 'each'인데 서로 등을 지고 바깥을 보고 있었다.
  // ±0.4는 완전 측면이 되지 않게 카메라 쪽으로 살짝 트는 각도다 — 얼굴이 보여야 한다.
  static FACE_EACH = Math.PI / 2 - 0.4;
  static FACE_CAM = 0.25;

  #place(g, slot, duo, facing) {
    const each = facing === 'each';
    if (!duo) { g.position.set(0, 0, 0); g.rotation.y = 0; }
    else if (slot === 'left') { g.position.set(-0.9, 0, 0); g.rotation.y = each ? AvatarViewer.FACE_EACH : AvatarViewer.FACE_CAM; }
    else { g.position.set(0.9, 0, 0); g.rotation.y = each ? -AvatarViewer.FACE_EACH : -AvatarViewer.FACE_CAM; }
  }

  #swap(slot, spec) {
    if (this.avatars[slot]) { this.scene.remove(this.avatars[slot]); disposeGroup(this.avatars[slot]); this.avatars[slot] = null; }
    if (spec) {
      const g = buildAvatar(spec);
      this.avatars[slot] = g;
      this.scene.add(g);
    }
  }

  setSolo(spec) {
    this.#swap('left', spec); this.#swap('right', null);
    this.#place(this.avatars.left, 'left', false);
  }

  setDuo(specL, specR, facing = 'camera') {
    this.#swap('left', specL); this.#swap('right', specR);
    this.facing = facing;
    this.#place(this.avatars.left, 'left', true, facing);
    this.#place(this.avatars.right, 'right', true, facing);
  }

  updateLeft(spec) {
    const duo = !!this.avatars.right;
    this.#swap('left', spec);
    this.#place(this.avatars.left, 'left', duo, this.facing);
  }

  say(slot) { this.emote(slot, 'talk'); }

  // 감정 동작 하나를 재생한다. 알 수 없는 값이 오면 말하는 동작으로 떨어뜨린다.
  emote(slot, kind) {
    const a = this.avatars[slot];
    if (!a) return;
    const k = EMOTE_SET.has(kind) && EMOTE_MOVES[kind] ? kind : 'talk';
    a.userData.emote = { kind: k, t: 0, dur: EMOTE_MOVES[k][0] };
  }

  burst(kind, slot = null) {
    // 판정 피드백 표식. 붉은 관인색은 호감 상승, 청색은 하락, 인광색은 승인.
    const [ch, color] = {
      love:    ['♥', '#8a2b3a'],
      bad:     ['✕', '#3a4f6b'],
      sparkle: ['+', '#d8d2c0'],
      rain:    ['·', '#6d7a86'],
      money:   ['₩', '#8a7f45'],
      ok:      ['◆', '#4e6b4e'],
    }[kind] || ['?', '#888888'];
    const x = slot === 'left' ? -0.9 : slot === 'right' ? 0.9 : 0;
    const n = kind === 'rain' ? 10 : 6;
    for (let i = 0; i < n; i++) {
      const sp = glyphSprite(ch, color, 0.16 + Math.random() * 0.09);
      sp.position.set(x + (Math.random() - 0.5) * 0.8, 1.4 + Math.random() * 0.6, 0.4);
      this.scene.add(sp);
      this.particles.push({
        sp,
        vel: new THREE.Vector3((Math.random() - 0.5) * 1.6, kind === 'rain' ? -0.5 : 1.5 + Math.random() * 1.2, (Math.random() - 0.5) * 0.6),
        life: 1.4,
      });
    }
  }

  setParty(on) { this.party = on; }

  #animateAvatar(a, dt, t) {
    const u = a.userData;
    // 기본 대기 자세
    const o = {
      y: Math.abs(Math.sin(t * 3 + u.phase)) * 0.05,
      armL: 0.12 + Math.sin(t * 3 + u.phase) * 0.1,
      armR: -0.12 - Math.sin(t * 3 + u.phase) * 0.1,
      armLx: 0, armRx: 0,
      headX: 0, headY: 0, headZ: Math.sin(t * 2 + u.phase) * 0.04,
      lean: 0, spinZ: 0, still: 0,
    };

    if (u.emote) {
      u.emote.t += dt;
      const e = u.emote;
      const p = Math.min(1, e.t / e.dur);
      // 앞부분은 세게, 뒤로 갈수록 잦아든다 (0 → 1 → 0이 아니라 1 → 0의 감쇠)
      const k = 1 - p * p;
      EMOTE_MOVES[e.kind][1](o, p, k, t);
      if (e.t >= e.dur) u.emote = null;
    }
    // freeze는 대기 흔들림 자체를 멈춘다
    if (o.still > 0) {
      const keep = 1 - o.still;
      o.y *= keep; o.headZ *= keep;
      o.armL = 0.12 + (o.armL - 0.12) * keep;
      o.armR = -0.12 + (o.armR + 0.12) * keep;
    }

    a.position.y = o.y;
    u.body.rotation.x = o.lean;
    u.body.rotation.z = o.spinZ;
    u.armL.rotation.z = o.armL; u.armR.rotation.z = o.armR;
    u.armL.rotation.x = u.armBaseX.l + o.armLx;
    u.armR.rotation.x = u.armBaseX.r + o.armRx;
    u.headG.rotation.x = o.headX;
    u.headG.rotation.y = o.headY;
    u.headG.rotation.z = o.headZ;
    if (this.spin) a.rotation.y += dt * 1.2;

    // 자유 도형 움직임
    for (const pr of u.props) {
      const m = pr.mesh, b = pr.base, ph = pr.phase;
      switch (pr.motion) {
        case 'yaw': m.rotation.y += dt * 1.6; break;
        case 'roll': m.rotation.z += dt * 2.2; break;
        case 'bob': m.position.y = b.y + Math.sin(t * 2.4 + ph) * 0.09; break;
        case 'shake':
          m.position.x = b.x + Math.sin(t * 26 + ph) * 0.035;
          m.position.y = b.y + Math.cos(t * 31 + ph) * 0.03;
          break;
        case 'orbit': {
          const r = Math.hypot(b.x, b.z) || 0.62;
          m.position.x = Math.cos(t * 1.5 + ph) * r;
          m.position.z = Math.sin(t * 1.5 + ph) * r;
          m.rotation.y += dt * 1.2;
          break;
        }
      }
    }

    // 오라 방출
    const aura = u.spec.aura;
    if (aura !== 'none' && AURA_MARK[aura] && this.auraTick > 0.5) {
      const sp = glyphSprite(AURA_MARK[aura][0], AURA_MARK[aura][1], 0.17);
      sp.position.set(a.position.x + (Math.random() - 0.5) * 0.7, 0.3, 0.3);
      this.scene.add(sp);
      this.particles.push({ sp, vel: new THREE.Vector3(0, aura === 'gloom' ? 0.25 : 0.8, 0), life: 1.6 });
    }
  }

  _loop() {
    if (this._dead) return;
    requestAnimationFrame(this._loop);
    if (!this.canvas.isConnected || this.canvas.offsetParent === null) return; // 숨겨진 화면은 렌더 생략
    const dt = Math.min(this._clock.getDelta(), 0.05);
    const t = this._clock.elapsedTime;

    // 캔버스 리사이즈 대응
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (w && h && (this.canvas.width !== w * devicePixelRatio || this.canvas.height !== h * devicePixelRatio)) {
      this.renderer.setPixelRatio(devicePixelRatio);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }

    // 순찰 조명
    const spd = this.party ? 1.1 : 0.22;
    this.discoA.position.x = Math.cos(t * spd) * 2.8;
    this.discoA.position.z = Math.sin(t * spd) * 2.2 + 1;
    this.discoB.position.x = -Math.cos(t * spd * 0.8) * 2.8;
    this.discoB.position.z = -Math.sin(t * spd * 0.8) * 2.2 + 1;
    if (this.party && t - this.lastTileFlash > 0.9) {
      // 성사 연출: 바닥 타일에 은은한 온기만 돈다 (채도 0.28 상한)
      this.lastTileFlash = t;
      for (const tile of this.tiles) {
        if (Math.random() < 0.18) tile.material.color.setHSL(0.09 + Math.random() * 0.06, 0.28, 0.42);
      }
    }

    this.auraTick += dt;
    for (const slot of ['left', 'right']) {
      const a = this.avatars[slot];
      if (a) this.#animateAvatar(a, dt, t);
    }
    if (this.auraTick > 0.5) this.auraTick = 0;

    // 파티클 갱신
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.sp.position.addScaledVector(p.vel, dt);
      p.vel.y -= dt * (p.vel.y > 0 ? 1.2 : 0.2);
      p.sp.material.opacity = Math.max(0, p.life);
      if (p.life <= 0) { this.scene.remove(p.sp); p.sp.material.dispose(); this.particles.splice(i, 1); }
    }

    this.renderer.render(this.scene, this.camera);
  }

  // 화면 재진입 시 무대만 초기화하고 WebGL 컨텍스트는 재사용한다
  reset() {
    this.#swap('left', null); this.#swap('right', null);
    for (const p of this.particles) { this.scene.remove(p.sp); p.sp.material.dispose(); }
    this.particles = [];
    this.party = false;
    this.facing = 'camera';
    // 성사 연출로 물든 바닥을 원래 색으로 되돌린다 (안 그러면 다음 판에 그대로 남는다)
    this.tiles.forEach((tile, i) => tile.material.color.setHex(this.baseTileColors[i]));
  }

  dispose() {
    this._dead = true;
    this.reset();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // 캔버스가 버려지는 미니 뷰어용: 컨텍스트 즉시 반납 (브라우저 컨텍스트 상한 고갈 방지)
  }
}

function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
  });
}
