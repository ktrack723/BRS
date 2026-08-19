// avatar.js — LLM이 생성한 스펙(JSON)으로 마인크래프트풍 블록 아바타를 조립하는 three.js 뷰어.
import * as THREE from '../vendor/three.module.min.js';

export const DEFAULT_SPEC = {
  skin: '#ffcc99', hair: '#3a2a1a', hairStyle: 'short',
  top: '#ff2d95', bottom: '#2d7dff', shoes: '#222222',
  heightScale: 1, widthScale: 1,
  accessory: 'none', accessoryColor: '#ffee00',
  expression: 'neutral', aura: 'none', species: 'human',
};

const HAIR_STYLES = new Set(['short', 'long', 'bald', 'mohawk', 'afro', 'twintail', 'bowl', 'spiky', 'fin', 'mane']);
const ACCESSORIES = new Set(['none', 'glasses', 'sunglasses', 'mustache', 'beard', 'hat', 'crown', 'headband', 'flower', 'antenna', 'mask']);
const EXPRESSIONS = new Set(['happy', 'neutral', 'shy', 'chad', 'weird', 'angry']);
const AURAS = new Set(['none', 'sparkle', 'hearts', 'fire', 'gloom', 'money']);
// 인간이 아닌 의뢰인이 절반이다. 종족이 곧 실루엣이 된다.
const SPECIES = new Set(['human', 'fish', 'lion', 'cat', 'zombie', 'vampire', 'alien', 'robot']);

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const clamp = (v, a, b) => Math.min(b, Math.max(a, Number(v) || 1));

export function sanitizeSpec(raw) {
  const s = { ...DEFAULT_SPEC, ...(raw || {}) };
  for (const k of ['skin', 'hair', 'top', 'bottom', 'shoes', 'accessoryColor']) {
    if (typeof s[k] !== 'string') s[k] = DEFAULT_SPEC[k];
    if (!s[k].startsWith('#')) s[k] = '#' + s[k];
    if (!HEX_RE.test(s[k])) s[k] = DEFAULT_SPEC[k];
  }
  s.heightScale = clamp(s.heightScale, 0.7, 1.45);
  s.widthScale = clamp(s.widthScale, 0.6, 1.7);
  if (!HAIR_STYLES.has(s.hairStyle)) s.hairStyle = 'short';
  if (!ACCESSORIES.has(s.accessory)) s.accessory = 'none';
  if (!EXPRESSIONS.has(s.expression)) s.expression = 'neutral';
  if (!AURAS.has(s.aura)) s.aura = 'none';
  if (!SPECIES.has(s.species)) s.species = 'human';
  return s;
}

function mat(color) { return new THREE.MeshToonMaterial({ color: new THREE.Color(color) }); }
function box(w, h, d, color) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); }

// ── 블록 아바타 조립 ────────────────────────────────────
export function buildAvatar(rawSpec) {
  const spec = sanitizeSpec(rawSpec);
  const g = new THREE.Group();
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
  g.add(legL, legR, shoeL, shoeR, torso, armL, armR, handL, handR, headG);
  addSpecies(g, headG, spec, { armL, armR, torso });

  // 머리 그룹의 회전축을 목 높이로 옮긴다 (발밑 축이면 회전 시 머리가 옆으로 미끄러진다)
  headG.position.y = 1.1;
  for (const ch of headG.children) ch.position.y -= 1.1;

  g.scale.set(spec.widthScale, spec.heightScale, spec.widthScale);
  g.userData = { headG, armL, armR, spec, jump: 0, phase: Math.random() * Math.PI * 2 };
  return g;
}

function addFace(headG, spec) {
  const z = 0.26; // 얼굴 면
  const eyeL = box(0.08, 0.1, 0.02, '#111111'); eyeL.position.set(-0.12, 1.36, z);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.12;
  headG.add(eyeL, eyeR);
  const e = spec.expression;
  if (e === 'weird') { eyeR.scale.set(1.8, 1.8, 1); eyeR.position.y = 1.39; }
  if (e === 'angry') {
    const browL = box(0.14, 0.03, 0.02, '#aa0000'); browL.position.set(-0.12, 1.45, z); browL.rotation.z = -0.5;
    const browR = browL.clone(); browR.position.x = 0.12; browR.rotation.z = 0.5;
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
  const mouthSpec = { happy: [0.2, 0.07, '#e0447a', 0], neutral: [0.12, 0.03, '#a55', 0], shy: [0.07, 0.04, '#e0447a', 0], chad: [0.2, 0.03, '#333333', 0], weird: [0.14, 0.06, '#e0447a', 0.1], angry: [0.16, 0.05, '#552222', 0] }[spec.expression] || [0.12, 0.03, '#a55', 0];
  const mouth = box(mouthSpec[0], mouthSpec[1], 0.02, mouthSpec[2]);
  mouth.position.set(mouthSpec[3], 1.19, z);
  headG.add(mouth);
}

function addHair(headG, style, color) {
  const add = m => headG.add(m);
  switch (style) {
    case 'bald': break;
    case 'long': {
      const top = box(0.6, 0.14, 0.55, color); top.position.y = 1.6; add(top);
      const back = box(0.6, 0.7, 0.14, color); back.position.set(0, 1.28, -0.28); add(back);
      break;
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
      const top = box(0.6, 0.14, 0.55, color); top.position.y = 1.6; add(top);
      const tailL = box(0.13, 0.62, 0.13, color); tailL.position.set(-0.36, 1.22, -0.1); tailL.rotation.z = 0.18; add(tailL);
      const tailR = tailL.clone(); tailR.position.x = 0.36; tailR.rotation.z = -0.18; add(tailR);
      break;
    }
    case 'bowl': {
      const cap = box(0.62, 0.28, 0.57, color); cap.position.y = 1.5; add(cap);
      break;
    }
    case 'fin': {  // 어인 등지느러미
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.42, 3), mat(color));
      fin.position.set(0, 1.74, -0.04); fin.rotation.x = -0.25; add(fin);
      const ridge = box(0.1, 0.14, 0.5, color); ridge.position.set(0, 1.6, -0.02); add(ridge);
      break;
    }
    case 'mane': {  // 사자 갈기
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.19, 6, 12), mat(color));
      ring.position.set(0, 1.3, -0.02); add(ring);
      const top = box(0.66, 0.18, 0.6, color); top.position.y = 1.62; add(top);
      break;
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
      const top = box(0.58, 0.14, 0.53, color); top.position.y = 1.6; add(top);
      const fringe = box(0.58, 0.1, 0.06, color); fringe.position.set(0, 1.53, 0.25); add(fringe);
    }
  }
}

function addAccessory(headG, spec) {
  const c = spec.accessoryColor, z = 0.27;
  const add = m => headG.add(m);
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
    case 'mustache': {
      const m1 = box(0.2, 0.05, 0.03, c); m1.position.set(0, 1.24, z); add(m1); break;
    }
    case 'beard': {
      const b1 = box(0.5, 0.16, 0.06, c); b1.position.set(0, 1.12, 0.24); add(b1); break;
    }
    case 'hat': {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 12), mat(c)); brim.position.y = 1.58;
      const crownB = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.3, 12), mat(c)); crownB.position.y = 1.74;
      add(brim, crownB); break;
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
    case 'headband': {
      const band = box(0.6, 0.07, 0.55, c); band.position.y = 1.47; add(band); break;
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

// ── 종족 파츠 ───────────────────────────────────────────
// 어인·퍼리·좀비·뱀파이어·외계인·안드로이드가 절반이다. 종족이 실루엣을 바꾼다.
function addSpecies(g, headG, spec, parts) {
  const skin = spec.skin;
  const add = m => headG.add(m);
  const addBody = m => g.add(m);

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
const texCache = new Map();
function emojiTexture(ch) {
  if (texCache.has(ch)) return texCache.get(ch);
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = '48px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ch, 32, 36);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(ch, tex);
  return tex;
}
function emojiSprite(ch, size = 0.3) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(ch), transparent: true, depthWrite: false }));
  sp.scale.set(size, size, 1);
  return sp;
}

const AURA_EMOJI = { sparkle: '✨', hearts: '💖', fire: '🔥', gloom: '💧', money: '💸' };

// ── 썸네일 렌더러 ───────────────────────────────────────
// 의뢰 대장에 20쌍 = 40명이 깔린다. 카드마다 WebGL 컨텍스트를 잡으면 브라우저 상한(보통 16개)에서 터진다.
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
  const rim = new THREE.PointLight(0xff33cc, 14, 12); rim.position.set(-2, 2, 2);
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
    this.discoA = new THREE.PointLight(0xff33cc, 22, 14); this.discoA.position.set(2.5, 2.6, 1.5);
    this.discoB = new THREE.PointLight(0x33ddff, 22, 14); this.discoB.position.set(-2.5, 2.6, 1.5);
    this.scene.add(this.discoA, this.discoB);

    // 체커보드 병맛 무대
    this.tiles = [];
    const floor = new THREE.Group();
    for (let x = -4; x < 4; x++) for (let z = -3; z < 3; z++) {
      const t = box(0.78, 0.08, 0.78, (x + z) % 2 ? '#ff2d95' : '#2dfff2');
      t.position.set(x * 0.8 + 0.4, -0.06, z * 0.8 + 0.4);
      this.tiles.push(t); floor.add(t);
    }
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

  #place(g, slot, duo, facing) {
    if (!duo) { g.position.set(0, 0, 0); g.rotation.y = 0; }
    else if (slot === 'left') { g.position.set(-0.9, 0, 0); g.rotation.y = facing === 'each' ? -Math.PI / 2 + 0.4 : 0.25; }
    else { g.position.set(0.9, 0, 0); g.rotation.y = facing === 'each' ? Math.PI / 2 - 0.4 : -0.25; }
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

  say(slot) { const a = this.avatars[slot]; if (a) a.userData.jump = 1; }

  burst(kind, slot = null) {
    const ch = { love: '💖', bad: '💢', sparkle: '✨', rain: '💧', money: '💸', ok: '⭐' }[kind] || '❓';
    const x = slot === 'left' ? -0.9 : slot === 'right' ? 0.9 : 0;
    const n = kind === 'rain' ? 18 : 12;
    for (let i = 0; i < n; i++) {
      const sp = emojiSprite(ch, 0.26 + Math.random() * 0.2);
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

    // 디스코 조명 회전
    const spd = this.party ? 3.2 : 0.7;
    this.discoA.position.x = Math.cos(t * spd) * 2.8;
    this.discoA.position.z = Math.sin(t * spd) * 2.2 + 1;
    this.discoB.position.x = -Math.cos(t * spd * 0.8) * 2.8;
    this.discoB.position.z = -Math.sin(t * spd * 0.8) * 2.2 + 1;
    if (this.party && t - this.lastTileFlash > 0.4) {
      this.lastTileFlash = t;
      for (const tile of this.tiles) if (Math.random() < 0.3) tile.material.color.setHSL(Math.random(), 0.9, 0.6);
    }

    // 아바타 애니메이션 (봉제인형st 들썩임)
    this.auraTick += dt;
    for (const slot of ['left', 'right']) {
      const a = this.avatars[slot];
      if (!a) continue;
      const u = a.userData;
      a.position.y = Math.abs(Math.sin(t * 3 + u.phase)) * 0.05 + u.jump * 0.35;
      u.jump = Math.max(0, u.jump - dt * 3);
      u.armL.rotation.z = 0.12 + Math.sin(t * 3 + u.phase) * 0.1 + u.jump * 1.4;
      u.armR.rotation.z = -0.12 - Math.sin(t * 3 + u.phase) * 0.1 - u.jump * 1.4;
      u.headG.rotation.z = Math.sin(t * 2 + u.phase) * 0.04 + u.jump * 0.2;
      if (this.spin) a.rotation.y += dt * 1.2;
      // 오라 방출
      const aura = u.spec.aura;
      if (aura !== 'none' && AURA_EMOJI[aura] && this.auraTick > 0.5) {
        const sp = emojiSprite(AURA_EMOJI[aura], 0.18);
        sp.position.set(a.position.x + (Math.random() - 0.5) * 0.7, 0.3, 0.3);
        this.scene.add(sp);
        this.particles.push({ sp, vel: new THREE.Vector3(0, aura === 'gloom' ? 0.25 : 0.8, 0), life: 1.6 });
      }
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
