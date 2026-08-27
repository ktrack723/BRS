// engine.js — 공작 하네스. 구조도의 B와 C를 순서대로 돌린다. DOM을 전혀 모른다.
//
// 한 판의 전부:
//   텍스팅 페이즈 · 토킹 페이즈, 각 페이즈는 구간(beat) 몇 개로 나뉜다.
//   구간마다 두 번 부른다 —
//     B-1  대화 생성   : 두 사람 몫을 한 번에 쓴다 (system은 판 내내 같다 → 캐시)
//     B-2  판정        : 그 구간을 보고 무드·러브의 증감 여부만 돌려준다
//   무드가 바닥나면 자리가 깨지고 남은 구간은 돌지 않는다.
//   끝나면 C를 한 번 불러 성사 여부와 후일담을 받는다.
//
//   무전 — 요원이 판 도중에 쓰는 유일한 레버. 페이즈마다 한 번(points.js의 RADIO).
//     버튼을 누르면 다음 줄 경계에서 대화가 **멈춘다**(#gate). 무전을 때리면 그 명령이
//     다음 생성 프롬프트에 「반드시 이행」으로 실린다. 구간 중간에서 잘렸으면 남은 대사는
//     없던 것이 되고, 실제로 오간 데까지만 다시 판정한다 — 하지 않은 말은 채점되지 않는다.
//     무전 문장 자체는 대화 기록(transcript)에 들어가지 않는다. 심판도 기록관도 못 본다.
//
// 여기 없는 것: 공기 · 합/carry · 첫인상 판정 · 강압 · 사망 · 자리이탈 판정 ·
// 새로 드러난 것 · 난이도. 전부 폐지됐다.

import * as P from './prompts.js';
import { BEAT, PHASES, RADIO, initialPoints, applyVerdict, isBroken, loveOutOf100 } from './points.js';

/** 스타일링/동기부여를 거친 고객 시트. 시공을 안 했으면 테이블 값이 그대로 시트가 된다. */
export function dressOf(client, styled) {
  return {
    look: (styled?.look || client.look.join(', ')).trim(),
    personality: (styled?.personality || client.personality.join(', ')).trim(),
  };
}

const SAME = { mood: 'same', love: 'same' };

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
    this.messages = [];       // 생성 호출의 대화 내역 (접두사가 그대로 캐시된다)
    this.aborted = false;
    this.phase = PHASES[0].key;

    // 무전 — 페이즈마다 한 번씩 배급된다. 남은 횟수는 코드가 들고 있고 프롬프트는 모른다.
    this.radioLeft = Object.fromEntries(PHASES.map(p => [p.key, RADIO.perPhase]));
    this.radioLog = [];        // [{phase, phaseLabel, beat, text}] — 화면용. transcript에는 안 들어간다
    this.pendingRadio = null;  // 다음 생성 호출에 실릴 명령
    this.holdWanted = false;   // 버튼이 눌렸다 — 다음 경계에서 멈춘다
    this.held = false;         // 지금 멈춰 서서 무전을 기다리는 중
    this.writesLeft = 0;       // 이 페이즈에 아직 나갈 생성 호출 수. 무전이 먹힐 자리가 있는가의 기준

    // system 프롬프트 둘은 판 내내 바이트 동일하다. 캐시 breakpoint가 붙는 자리다.
    this.talkSys = P.talkSystem(couple, dressed, this.coaching);
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

  // ── B-1. 대화 생성 ────────────────────────────────────
  // 대기 중인 무전이 있으면 여기서 물고 나간다 — system이 아니라 이 user 메시지에 실린다.
  async #generate(phase, beat, beats) {
    this.writesLeft = Math.max(0, this.writesLeft - 1);
    const radio = this.pendingRadio;
    this.pendingRadio = null;
    this.messages.push({ role: 'user', content: P.talkUser(this.couple, phase, beat, beats, radio) });
    let out;
    try {
      out = await this.llm.call({
        label: `${P.PHASE_SCENE[phase].label} ${beat}구간 · 대화 생성`,
        system: this.talkSys, cache: true,
        messages: this.messages,
        schema: P.TALK_SCHEMA, effort: 'low', maxTokens: 6000,
      });
    } catch {
      return [];
    }
    return (out?.lines || [])
      .filter(l => l && typeof l.text === 'string' && l.text.trim())
      .map(l => ({ who: l.who === 'target' ? 'target' : 'client', text: l.text.trim() }))
      .slice(0, BEAT.lines * 2);
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
    await this.h.phase?.({ key: ph.key, label: ph.label, beats: ph.beats });
    this.h.points?.(this.snapshot());

    for (let beat = 1; beat <= ph.beats; beat++) {
      if (this.aborted || isBroken(this.points)) return;

      await this.#gate('beat');   // 구간 사이에서 눌렀다면 여기서 받는다

      const priorLog = this.fullTranscript();
      const lines = await this.#generate(ph.key, beat, ph.beats);
      if (!lines.length) { await this.#note('(회선이 끊겼다. 이 구간은 기록되지 않았다.)'); continue; }

      // 판정은 띄워놓고 말풍선을 먼저 흘린다 — 읽는 동안 뒤에서 날아온다.
      const judging = this.#judge(priorLog, this.#segmentText(lines), ph.key, beat);

      // 무전이 들어오면 그 줄에서 대화가 끊긴다. 뒤에 있던 대사는 없던 것이 된다 —
      // 요원이 자리를 세운 시점보다 뒤의 말은 아직 나오지 않은 말이기 때문이다.
      const said = [];
      let cut = false;
      for (const l of lines) {
        this.transcript.push(l);
        said.push(l);
        await this.h.line?.(l.who, l.text);
        if (said.length < lines.length && await this.#gate('line')) { cut = true; break; }
      }

      // 모델이 자기 출력을 이어 읽을 수 있게 평문으로 되돌려 쌓는다. 접두사가 그대로 캐시된다.
      this.messages.push({ role: 'assistant', content: this.#segmentText(said) });

      // 잘렸으면 띄워둔 판정은 버린다. 하지 않은 말은 채점되지 않는다.
      let verdict = await judging;
      if (cut) verdict = await this.#judge(priorLog, this.#segmentText(said), ph.key, beat, ' · 무전 개입분 재판정');

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

  // ── 무전 — 요원이 판 도중에 쓰는 유일한 레버 ──────────
  // 화면이 부르는 것은 이 넷뿐이다: radioState · requestHold · sendRadio · releaseHold.

  /** 이 페이즈에 남은 배급. */
  radioFor(phase = this.phase) { return this.radioLeft[phase] ?? 0; }

  /** 지금 무전을 부를 수 있는가. 배급이 남았고, 그 명령이 실릴 대사가 아직 남아 있어야 한다. */
  canRadio() {
    return !this.aborted && !this.held && !this.holdWanted
      && this.radioFor() > 0 && this.writesLeft > 0;
  }

  /** 화면이 버튼 하나를 그릴 때 보는 것 전부. */
  radioState() {
    const cur = PHASES.find(p => p.key === this.phase) || PHASES[0];
    return {
      phase: this.phase, phaseLabel: cur.label,
      left: this.radioFor(), per: RADIO.perPhase,
      can: this.canRadio(), armed: this.holdWanted, open: this.held,
      spent: this.radioLog.length,
    };
  }

  /** 무전 버튼. 다음 줄 경계에서 대화가 선다. 실제로 서는 건 #gate다. */
  requestHold() {
    if (!this.canRadio()) return false;
    this.holdWanted = true;
    return true;
  }

  /**
   * 무전을 때린다. 붙잡혀 있던 대화가 여기서 풀리고, 명령은 다음 생성 프롬프트에
   * 「반드시 이행」으로 실린다. 배급은 이때 깎인다 — 버튼만 누르고 취소하면 그대로다.
   */
  sendRadio(text) {
    const order = String(text || '').trim();
    if (!this.held || !order || this.radioFor() <= 0) return this.releaseHold();
    this.radioLeft[this.phase] -= 1;
    this.pendingRadio = order;
    const cur = PHASES.find(p => p.key === this.phase) || PHASES[0];
    this.radioLog.push({
      phase: this.phase, phaseLabel: cur.label,
      beat: this.points.beats + 1, text: order,
    });
    this.#release();
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
    const order = this.pendingRadio;
    await this.h.resume?.({ phase: this.phase, at, order: order || null, left: this.radioFor() });
    return !!order;
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
