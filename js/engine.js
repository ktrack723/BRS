// engine.js — 공작 하네스. 구조도의 B와 C를 순서대로 돌린다. DOM을 전혀 모른다.
//
// 한 판의 전부:
//   텍스팅 페이즈 · 토킹 페이즈, 각 페이즈는 구간(beat) 몇 개로 나뉜다.
//   구간 하나는 대사 여섯 줄이고, **줄마다 한 번씩 부른다** —
//     B-1  대사 생성   : 배우 둘이 번갈아 한 줄씩 쓴다. 회선이 둘로 갈려 있어
//                        서로의 시트를 못 본다 (system은 판 내내 같다 → 캐시)
//     B-2  판정        : 그 구간 여섯 줄을 보고 무드·러브의 증감 여부만 돌려준다
//   무드가 바닥나면 자리가 깨지고 남은 구간은 돌지 않는다.
//   끝나면 C를 한 번 불러 성사 여부와 후일담을 받는다.
//
//   무전 — 요원이 판 도중에 쓰는 레버 하나. 페이즈마다 한 번(points.js의 RADIO).
//   현장 무전 — 판 도중의 두 번째 레버. 현장 요원이 물리 지원(꽃다발·차량·연출)을 그대로
//     실행한다. 페이즈 무관 판 전체 1회(points.js의 FIELD). 같은 게이트, 같은 주입 경로다.
//     버튼을 누르면 다음 줄 경계에서 대화가 **멈춘다**(#gate). 무전을 때리면 그 명령이
//     **바로 다음 줄**의 프롬프트에 실린다 — 아직 안 쓴 말이라 버릴 것도, 다시 판정할 것도
//     없다. 무전은 고객 회선에만, 현장 무전은 양쪽 회선에 실린다.
//     무전 문장 자체는 대화 기록(transcript)에 들어가지 않는다. 심판도 기록관도 못 본다.
//
// 여기 없는 것: 공기 · 합/carry · 첫인상 판정 · 강압 · 사망 · 자리이탈 판정 ·
// 새로 드러난 것 · 난이도. 전부 폐지됐다.

import * as P from './prompts.js';
import { BEAT, PHASES, RADIO, FIELD, initialPoints, applyVerdict, isBroken, loveOutOf100 } from './points.js';

/** 스타일링/동기부여를 거친 고객 시트. 시공을 안 했으면 테이블 값이 그대로 시트가 된다. */
export function dressOf(client, styled) {
  return {
    look: (styled?.look || client.look.join(', ')).trim(),
    personality: (styled?.personality || client.personality.join(', ')).trim(),
  };
}

const SAME = { mood: 'same', love: 'same' };

// 판 도중 요원이 쓰는 레버 둘. 기계는 하나다 — 갈리는 것은 배급 단위 하나뿐이다.
//   radio (고객 무전) : 페이즈마다 한 번. 고객의 이어폰에 꽂히는 명령이다.
//   field (현장 무전) : 판 전체에 한 번. 현장팀이 물리 지원을 그대로 실행한다.
// 셋째 레버가 생기면 여기 한 줄이 늘 뿐이다.
const LEVERS = {
  radio: { per: RADIO.perPhase, perPhase: true },
  field: { per: FIELD.perOp, perPhase: false },
};
const LEVER_KINDS = Object.keys(LEVERS);

export class Engine {
  #wake = null;    // 멈춰 선 대화를 다시 굴리는 손잡이. 무전을 때리거나 취소하면 풀린다

  constructor(llm, { couple, dressed, coaching, handlers }) {
    this.llm = llm;
    this.couple = couple;
    this.dressed = dressed;
    this.coaching = (coaching || '').trim();
    this.h = handlers || {};

    this.points = initialPoints();
    this.transcript = [];     // [{who:'client'|'target'|'sys', text}]
    this.aborted = false;
    this.phase = PHASES[0].key;

    // 레버 둘의 배급·원장·대기 명령. 기계는 하나고 배급 단위만 다르다 (LEVERS).
    // 남은 횟수는 코드가 들고 있고 프롬프트는 모른다.
    this.levers = Object.fromEntries(Object.entries(LEVERS).map(([kind, spec]) => [kind, {
      spec,
      left: spec.perPhase ? Object.fromEntries(PHASES.map(p => [p.key, spec.per])) : spec.per,
      log: [],       // [{phase, phaseLabel, beat, text}] — 화면용. transcript에는 안 들어간다
      pending: null, // 다음 생성 호출에 실릴 명령
    }]));
    this.holdWanted = false;   // 버튼이 눌렸다 — 다음 경계에서 멈춘다
    this.held = false;         // 지금 멈춰 서서 무전을 기다리는 중
    this.writesLeft = 0;       // 이 페이즈에 아직 나갈 생성 호출 수. 무전이 먹힐 자리가 있는가의 기준

    // 배우 둘. 각자 제 시트만 들고 제 회선에서 논다 — 서로의 시트는 어느 쪽에도 없다.
    // system 셋은 판 내내 바이트 동일하다. 캐시 breakpoint가 붙는 자리다.
    this.sys = {
      client: P.clientSystem(couple, dressed, this.coaching),
      target: P.targetSystem(couple),
    };
    this.threads = { client: [], target: [] };    // 각 배우의 대화 내역
    this.heard = { client: [], target: [] };      // 다음 차례에 넘겨줄 「상대가 한 말」
    this.scene = { client: null, target: null };  // 페이즈가 열릴 때 한 번 실리는 상황
    this.pending = { client: {}, target: {} };    // 다음 차례에 실릴 무전·현장 명령
    this.turn = 0;                                // 짝수면 고객 차례
    this.judgeSys = P.judgeSystem(couple, dressed);
  }

  snapshot() {
    const done = PHASES.slice(0, PHASES.findIndex(p => p.key === this.phase))
      .reduce((n, p) => n + p.beats, 0);
    const cur = PHASES.find(p => p.key === this.phase) || PHASES[0];
    return {
      mood: Math.round(this.points.mood),
      love: Math.round(this.points.love),
      phase: this.phase,
      phaseLabel: cur.label,
      beat: Math.max(0, this.points.beats - done),
      beats: cur.beats,
      broken: this.points.broken,
    };
  }

  /** 지금까지 오간 대화 전문. 'sys' 줄은 상황 안내라 이름표 없이 나간다. */
  fullTranscript() {
    const c = this.couple;
    return this.transcript.map(l =>
      l.who === 'client' ? `${c.client.name}: ${l.text}`
        : l.who === 'target' ? `${c.target.name}: ${l.text}`
          : `[${l.text}]`).join('\n');
  }

  #segmentText(lines) {
    const c = this.couple;
    return lines.map(l => `${l.who === 'client' ? c.client.name : c.target.name}: ${l.text}`).join('\n');
  }

  // ── B-1. 대사 한 줄 ───────────────────────────────────
  // 배우 하나를 불러 한 마디를 받는다. 그 배우의 회선에만 쌓이고, 나온 말은 상대 회선의
  // 「들은 말」 큐로 넘어간다. 무전·현장은 system이 아니라 이 user 메시지에 실린다.
  async #say(side, phase, beat) {
    const scene = this.scene[side];
    const orders = this.pending[side];
    const heard = this.heard[side];
    const first = !this.threads[side].length;
    this.scene[side] = null;
    this.pending[side] = {};
    this.heard[side] = [];

    this.threads[side].push({
      role: 'user',
      content: P.actorUser(this.couple, { scene, heard, side, first, ...orders }),
    });
    let out;
    try {
      out = await this.llm.call({
        label: `${P.PHASE_SCENE[phase].label} ${beat}구간 · ${side === 'client' ? '고객' : '타겟'} 대사`,
        system: this.sys[side], cache: true,
        messages: this.threads[side],
        schema: P.TALK_SCHEMA, effort: 'low', maxTokens: 2000,
      });
    } catch {
      // 실패한 차례는 없던 일로 되돌린다. 안 그러면 장면 안내와 명령이 통째로 증발한다.
      this.threads[side].pop();
      this.scene[side] = scene;
      this.pending[side] = orders;
      this.heard[side] = heard.concat(this.heard[side]);
      return null;
    }
    const text = String(out?.text || '').trim();
    if (!text) { this.threads[side].pop(); return null; }
    this.threads[side].push({ role: 'assistant', content: text });
    this.heard[side === 'client' ? 'target' : 'client'].push({ who: side, text });
    return { who: side, text };
  }

  // ── B-2. 판정 ─────────────────────────────────────────
  // 돌려받는 것은 증감 여부 둘뿐이다. 폭은 points.js가 정한다.
  #judge(priorLog, segment, phase, beat, tag = '') {
    return this.llm.call({
      label: `${P.PHASE_SCENE[phase].label} ${beat}구간 · 판정${tag}`,
      system: this.judgeSys, cache: true,
      messages: [{ role: 'user', content: P.judgeUser(this.couple, priorLog, segment) }],
      schema: P.JUDGE_SCHEMA, effort: 'low', maxTokens: 2000,
    }).catch(() => SAME);
  }

  // ── 페이즈 하나 ───────────────────────────────────────
  async #runPhase(ph) {
    this.phase = ph.key;
    this.writesLeft = ph.beats;
    // 페이즈가 열렸다. 두 배우에게 각자 제 시점의 상황을 한 번씩 건다.
    for (const side of ['client', 'target']) {
      this.scene[side] = P.sceneOpen(this.couple, this.dressed, ph.key, side);
    }
    await this.h.phase?.({ key: ph.key, label: ph.label, beats: ph.beats });
    this.h.points?.(this.snapshot());

    for (let beat = 1; beat <= ph.beats; beat++) {
      if (this.aborted || isBroken(this.points)) return;

      await this.#gate('beat');   // 구간 사이에서 눌렀다면 여기서 받는다

      // 이 구간이 시작되면 그만큼의 자리가 줄어든다. 남은 자리가 없으면 무전이 먹힐 데도 없다.
      this.writesLeft = Math.max(0, this.writesLeft - 1);
      const priorLog = this.fullTranscript();

      // 여섯 줄. 줄마다 배우가 갈리고, 줄 사이마다 무전이 들어올 자리가 있다.
      // 아직 안 쓴 말이라 잘라낼 것이 없다 — 명령은 곧바로 다음 줄에 실린다.
      const said = [];
      for (let i = 0; i < BEAT.lines; i++) {
        if (this.aborted) break;
        const side = this.turn % 2 === 0 ? 'client' : 'target';
        const line = await this.#say(side, ph.key, beat);
        if (!line) break;
        this.turn++;
        this.transcript.push(line);
        said.push(line);
        await this.h.line?.(line.who, line.text);
        if (i < BEAT.lines - 1) await this.#gate('line');
      }
      if (!said.length) { await this.#note('(회선이 끊겼다. 이 구간은 기록되지 않았다.)'); continue; }

      const verdict = await this.#judge(priorLog, this.#segmentText(said), ph.key, beat);

      this.points = applyVerdict(this.points, verdict, { phase: ph.key });
      const last = this.points.history.at(-1);
      await this.h.verdict?.({
        phase: ph.key, phaseLabel: ph.label, beat, beats: ph.beats,
        dMood: last.dMood, dLove: last.dLove, step: last.step,
        mood: Math.round(this.points.mood), love: Math.round(this.points.love),
      });
      this.h.points?.(this.snapshot());

      if (isBroken(this.points)) {
        await this.#note(ph.key === 'text'
          ? '(답장이 끊겼다. 무드 포인트가 바닥났다 — 이 자리는 여기서 끝이다.)'
          : '(한쪽이 일어섰다. 무드 포인트가 바닥났다 — 이 자리는 여기서 끝이다.)');
        return;
      }
    }
  }

  // ── 무전 · 현장 무전 — 판 도중의 레버 둘 ──────────────
  // 화면이 부르는 것은 이 넷뿐이다: 상태 · requestHold · 송출 · releaseHold.
  // 아래 다섯 메서드가 두 레버 몫을 다 한다. 그 밑은 이름만 붙인 손잡이다.

  #phaseNow() { return PHASES.find(p => p.key === this.phase) || PHASES[0]; }

  /** 남은 배급. 무전은 페이즈별로, 현장은 판 전체로 센다. */
  leverLeft(kind, phase = this.phase) {
    const L = this.levers[kind];
    return L.spec.perPhase ? (L.left[phase] ?? 0) : L.left;
  }

  /** 지금 부를 수 있는가. 배급이 남았고, 그 명령이 실릴 대사가 아직 남아 있어야 한다. */
  canUse(kind) {
    return !this.aborted && !this.held && !this.holdWanted
      && this.leverLeft(kind) > 0 && this.writesLeft > 0;
  }

  /** 화면이 레버 하나를 그릴 때 보는 것 전부. */
  leverState(kind) {
    const L = this.levers[kind];
    return {
      phase: this.phase, phaseLabel: this.#phaseNow().label,
      left: this.leverLeft(kind), per: L.spec.per,
      can: this.canUse(kind), armed: this.holdWanted, open: this.held,
      spent: L.log.length,
    };
  }

  /**
   * 레버를 때린다. 붙잡혀 있던 대화가 여기서 풀리고, 명령은 다음 생성 프롬프트에 실린다.
   * 배급은 이때 깎인다 — 버튼만 누르고 취소하면 그대로다.
   */
  send(kind, text) {
    const L = this.levers[kind];
    const order = String(text || '').trim();
    if (!this.held || !order || this.leverLeft(kind) <= 0) return this.releaseHold();
    if (L.spec.perPhase) L.left[this.phase] -= 1; else L.left -= 1;
    L.pending = order;   // 회선이 열린 자리에서 화면이 읽어간다
    // 무전은 고객이 「바로 다음 대사부터」 이행한다고 약속된 것이다. 지금이 타겟 차례면
    // 그 차례를 건너뛴다 — 고객이 말을 자르고 끼어드는 그림이고, 약속도 지켜진다.
    if (kind === 'radio' && this.turn % 2 !== 0) this.turn++;
    // 배달: 무전은 고객 귀에만, 현장 사건은 두 사람 다 겪는다.
    this.pending.client[kind] = order;
    if (kind === 'field') this.pending.target.field = order;
    L.log.push({
      phase: this.phase, phaseLabel: this.#phaseNow().label,
      beat: this.points.beats + 1, text: order,
    });
    this.#release();
    return true;
  }

  // 이름만 붙인 손잡이. 화면과 테스트가 부르는 말은 그대로 둔다.
  get radioLog() { return this.levers.radio.log; }
  get fieldLog() { return this.levers.field.log; }
  get fieldLeft() { return this.levers.field.left; }
  radioFor(phase = this.phase) { return this.leverLeft('radio', phase); }
  canRadio() { return this.canUse('radio'); }
  canField() { return this.canUse('field'); }
  radioState() { return this.leverState('radio'); }
  fieldState() { return this.leverState('field'); }
  sendRadio(text) { return this.send('radio', text); }
  sendField(text) { return this.send('field', text); }

  /** 개입 버튼. 다음 줄 경계에서 대화가 선다. 무전이든 현장이든 회선은 하나다. */
  requestHold() {
    if (!LEVER_KINDS.some(k => this.canUse(k))) return false;
    this.holdWanted = true;
    return true;
  }

  /** 무전 없이 회선을 닫는다. 배급은 소모되지 않고 대화가 그대로 이어진다. */
  releaseHold() {
    this.holdWanted = false;
    this.#release();
    return false;
  }

  #release() { const f = this.#wake; this.#wake = null; if (f) f(); }

  /**
   * 무전 게이트. 버튼이 눌려 있으면 여기서 대화가 **멈추고** 무전이 올 때까지 기다린다.
   * 무전이 실제로 들어왔으면 true — 부르는 쪽은 그걸로 구간을 자를지 정한다.
   * 대기 손잡이를 h.hold보다 먼저 잡아둔다. 화면이 그 자리에서 바로 송출해도 안 걸리게.
   */
  async #gate(at) {
    if (!this.holdWanted || this.aborted) return false;
    this.holdWanted = false;
    this.held = true;
    const open = new Promise(res => { this.#wake = res; });
    await this.h.hold?.({ phase: this.phase, at, left: this.radioFor() });
    await open;
    this.held = false;
    const order = this.levers.radio.pending;
    const field = this.levers.field.pending;
    this.levers.radio.pending = null;
    this.levers.field.pending = null;
    await this.h.resume?.({ phase: this.phase, at, order: order || null, field: field || null, left: this.radioFor() });
    return !!(order || field);
  }

  async #note(text) {
    this.transcript.push({ who: 'sys', text });
    await this.h.line?.('sys', text);
  }

  /** 텍스팅 → 토킹. 무드가 바닥나면 거기서 멈춘다. */
  async run() {
    for (const ph of PHASES) {
      await this.#runPhase(ph);
      if (this.aborted || isBroken(this.points)) break;
    }
    return !this.points.broken;
  }

  // ── C. 후일담 ─────────────────────────────────────────
  async finish() {
    const love = Math.round(this.points.love);
    // 안쪽 눈금은 0..20이지만 C가 읽는 눈금은 0..100이다 (points.js의 loveOutOf100 참고).
    // 환산은 여기서 한 번만 하고, 후일담 프롬프트는 한 글자도 모른다.
    const reading = loveOutOf100(love);
    const transcript = this.fullTranscript();
    let out;
    try {
      out = await this.llm.call({
        label: '후일담 생성',
        system: P.epilogueSystem(this.couple, this.dressed),
        messages: [{ role: 'user', content: P.epilogueUser(this.couple, reading, transcript) }],
        schema: P.EPILOGUE_SCHEMA, effort: 'medium', maxTokens: 6000,
      });
    } catch {
      // 후일담이 안 와도 러브 포인트는 이미 나와 있다. 성사 여부만 숫자로 떨어뜨린다.
      out = {
        success: reading >= 60,
        epilogue: '(기록관이 자리를 비웠다. 후일담은 남지 않았다.)',
      };
    }
    return {
      success: !!out.success,
      epilogue: out.epilogue || '',
      love, reading, mood: Math.round(this.points.mood),
      broken: this.points.broken,
      points: this.points, couple: this.couple, dressed: this.dressed,
      transcript,
    };
  }
}
