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
// 여기 없는 것: 무전 · 공기 · 합/carry · 첫인상 판정 · 강압 · 사망 · 자리이탈 판정 ·
// 새로 드러난 것 · 난이도. 전부 폐지됐다.

import * as P from './prompts.js';
import { BEAT, PHASES, initialPoints, applyVerdict, isBroken } from './points.js';

/** 스타일링/동기부여를 거친 고객 시트. 시공을 안 했으면 테이블 값이 그대로 시트가 된다. */
export function dressOf(client, styled) {
  return {
    look: (styled?.look || client.look.join(', ')).trim(),
    personality: (styled?.personality || client.personality.join(', ')).trim(),
  };
}

const SAME = { mood: 'same', love: 'same' };

export class Engine {
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
  async #generate(phase, beat, beats) {
    this.messages.push({ role: 'user', content: P.talkUser(this.couple, phase, beat, beats) });
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
    const lines = (out?.lines || [])
      .filter(l => l && typeof l.text === 'string' && l.text.trim())
      .map(l => ({ who: l.who === 'target' ? 'target' : 'client', text: l.text.trim() }))
      .slice(0, BEAT.lines * 2);
    if (!lines.length) return [];
    // 모델이 자기 출력을 이어 읽을 수 있게 평문으로 되돌려 쌓는다. 접두사가 그대로 캐시된다.
    this.messages.push({ role: 'assistant', content: this.#segmentText(lines) });
    return lines;
  }

  // ── B-2. 판정 ─────────────────────────────────────────
  // 돌려받는 것은 증감 여부 둘뿐이다. 폭은 points.js가 정한다.
  #judge(priorLog, segment, phase, beat) {
    return this.llm.call({
      label: `${P.PHASE_SCENE[phase].label} ${beat}구간 · 판정`,
      system: this.judgeSys, cache: true,
      messages: [{ role: 'user', content: P.judgeUser(this.couple, priorLog, segment) }],
      schema: P.JUDGE_SCHEMA, effort: 'low', maxTokens: 2000,
    }).catch(() => SAME);
  }

  // ── 페이즈 하나 ───────────────────────────────────────
  async #runPhase(ph) {
    this.phase = ph.key;
    await this.h.phase?.({ key: ph.key, label: ph.label, beats: ph.beats });
    this.h.points?.(this.snapshot());

    for (let beat = 1; beat <= ph.beats; beat++) {
      if (this.aborted || isBroken(this.points)) return;

      const priorLog = this.fullTranscript();
      const lines = await this.#generate(ph.key, beat, ph.beats);
      if (!lines.length) { await this.#note('(회선이 끊겼다. 이 구간은 기록되지 않았다.)'); continue; }

      // 판정은 띄워놓고 말풍선을 먼저 흘린다 — 읽는 동안 뒤에서 날아온다.
      const segment = this.#segmentText(lines);
      const judging = this.#judge(priorLog, segment, ph.key, beat);

      for (const l of lines) {
        this.transcript.push(l);
        await this.h.line?.(l.who, l.text);
      }

      const verdict = await judging;
      this.points = applyVerdict(this.points, verdict, { phase: ph.key });
      const last = this.points.history.at(-1);
      await this.h.verdict?.({
        phase: ph.key, phaseLabel: ph.label, beat, beats: ph.beats,
        dMood: last.dMood, dLove: last.dLove,
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
    const transcript = this.fullTranscript();
    let out;
    try {
      out = await this.llm.call({
        label: '후일담 생성',
        system: P.epilogueSystem(this.couple, this.dressed),
        messages: [{ role: 'user', content: P.epilogueUser(this.couple, love, transcript) }],
        schema: P.EPILOGUE_SCHEMA, effort: 'medium', maxTokens: 6000,
      });
    } catch {
      // 후일담이 안 와도 러브 포인트는 이미 나와 있다. 성사 여부만 숫자로 떨어뜨린다.
      out = {
        success: love >= 60,
        epilogue: '(기록관이 자리를 비웠다. 후일담은 남지 않았다.)',
      };
    }
    return {
      success: !!out.success,
      epilogue: out.epilogue || '',
      love, mood: Math.round(this.points.mood),
      broken: this.points.broken,
      points: this.points, couple: this.couple, dressed: this.dressed,
      transcript,
    };
  }
}
