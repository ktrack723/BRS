// audio.js — WebAudio 8비트 병맛 사운드. 외부 파일 0개, 전부 발진기로 생성.
let ctx = null;
let bgmOn = true;
let bgmTimer = null;
let masterGain = null;

function ensureCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function blip(freq, dur, type = 'square', vol = 0.12, when = 0, slide = 0) {
  const c = ensureCtx();
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g); g.connect(masterGain);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

// ── 효과음 ──────────────────────────────────────────────
export const sfx = {
  click() { blip(880, 0.06, 'square', 0.08); },
  type() { blip(1200 + Math.random() * 600, 0.03, 'square', 0.04); },
  send() { blip(660, 0.07, 'square', 0.1); blip(990, 0.09, 'square', 0.1, 0.07); },
  love() { [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.09, 'square', 0.11, i * 0.07)); },
  bad() { blip(220, 0.25, 'sawtooth', 0.12, 0, -80); blip(110, 0.3, 'sawtooth', 0.1, 0.1, -30); },
  radio() { blip(1400, 0.05, 'square', 0.09); blip(700, 0.05, 'square', 0.09, 0.06); blip(1400, 0.05, 'square', 0.09, 0.12); },
  fanfare() { [523, 523, 523, 659, 784, 1047].forEach((f, i) => blip(f, i === 5 ? 0.5 : 0.12, 'square', 0.13, i * 0.13)); },
  trombone() { [392, 370, 349, 330].forEach((f, i) => blip(f, 0.4, 'sawtooth', 0.12, i * 0.35, -15)); },
  stamp() { blip(140, 0.15, 'square', 0.16, 0, -60); },
};

// ── BGM: かわいい 8bit 발렌타인st 루프 ──────────────────
// 음계: 헤르츠. 0 = 쉼표.
const N = { C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880 };
const MELODY = [
  N.C5, 0, N.E5, 0, N.G5, 0, N.E5, 0, N.F5, N.E5, N.D5, 0, N.E5, 0, 0, 0,
  N.D5, 0, N.F5, 0, N.A5, 0, N.F5, 0, N.G5, N.F5, N.E5, 0, N.D5, 0, 0, 0,
  N.C5, 0, N.E5, 0, N.G5, 0, N.C5, 0, N.A4, 0, N.B4, 0, N.C5, 0, 0, 0,
  N.F5, N.E5, N.D5, N.C5, N.D5, 0, N.B4, 0, N.C5, 0, 0, 0, 0, 0, 0, 0,
];
const BASS = [
  N.C4, 0, N.G4, 0, N.C4, 0, N.G4, 0, N.F4, 0, N.C4, 0, N.G4, 0, N.G4, 0,
  N.D4, 0, N.A4, 0, N.D4, 0, N.A4, 0, N.G4, 0, N.D4, 0, N.G4, 0, N.G4, 0,
  N.C4, 0, N.G4, 0, N.C4, 0, N.G4, 0, N.F4, 0, N.G4, 0, N.C4, 0, N.C4, 0,
  N.F4, 0, N.G4, 0, N.G4, 0, N.G4, 0, N.C4, 0, N.G4, 0, N.C4, 0, 0, 0,
];
const STEP = 0.14; // 16분음표 길이(초)

function scheduleBar(startStep) {
  for (let i = 0; i < 16; i++) {
    const idx = (startStep + i) % MELODY.length;
    if (MELODY[idx]) blip(MELODY[idx], STEP * 0.9, 'square', 0.045, i * STEP);
    if (BASS[idx]) blip(BASS[idx] / 2, STEP * 0.9, 'triangle', 0.07, i * STEP);
    if (i % 4 === 2) blip(6000, 0.02, 'square', 0.012, i * STEP); // 하이햇 흉내
  }
}

export function startBgm() {
  if (bgmTimer || !bgmOn) return;
  ensureCtx();
  let step = 0;
  scheduleBar(step);
  bgmTimer = setInterval(() => {
    if (!bgmOn) return;
    step = (step + 16) % MELODY.length;
    scheduleBar(step);
  }, STEP * 16 * 1000);
}

export function toggleBgm() {
  bgmOn = !bgmOn;
  if (!bgmOn && bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  else if (bgmOn) startBgm();
  return bgmOn;
}

export function unlockAudio() { ensureCtx(); }
