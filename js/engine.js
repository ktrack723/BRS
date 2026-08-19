// engine.js — 공작 하네스(harness). 클라이언트/타겟 에이전트와 심판을 턴마다 물려 돌리고,
// scoring.js의 규칙으로 상태를 갱신한다. DOM을 전혀 모른다 — UI는 콜백으로만 통신한다.
import * as P from './prompts.js';
import * as S from './scoring.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export class Engine {
  constructor(llm, { client, difficulty, prep, handlers }) {
    this.llm = llm;
    this.client = client;
    this.d = S.diffOf(difficulty);
    this.h = handlers || {};

    this.state = S.initialState(this.d, prep);
    this.state.radioCount = 0;
    this.state.radioAimSum = 0;
    this.outfitDesc = prep.outfitDesc || '';
    this.coaching = prep.coaching || '';

    this.transcript = [];
    this.clientHist = [];
    this.targetHist = [];
    this.foundPrefs = [];
    this.aborted = false;
    this.abortReason = null;

    this.paused = false;      // 무전 모달이 열려 있는 동안
    this.pendingRadio = null; // 다음 클라이언트 발언에 주입될 지시
    this.radioLeft = 0;
  }

  // ── 외부 제어 ────────────────────────────────────────
  setPaused(v) { this.paused = !!v; }

  // 무전 송신: 정확도를 채점해 즉시 상태에 반영하고, 다음 발언에 주입되도록 큐에 넣는다
  async submitRadio(text) {
    if (this.radioLeft <= 0 || !text.trim()) return null;
    this.radioLeft--;
    let aim = 4, comment = '';
    try {
      const r = await this.llm.call({
        label: '무전 정확도 판정',
        system: P.radioSystem(this.client),
        messages: [{ role: 'user', content: P.radioUser(this.#history(14), text) }],
        schema: P.RADIO_SCHEMA, effort: 'low', maxTokens: 4000,
      });
      aim = Math.max(0, Math.min(10, r.aim | 0));
      comment = r.comment || '';
    } catch { /* 판정 실패 시 중립 처리 */ }

    this.state = S.applyRadio(this.state, this.d, aim);
    this.state.radioCount++;
    this.state.radioAimSum += aim;
    this.pendingRadio = text;
    this.transcript.push({ who: 'radio', text });
    this.h.bubble?.('radio', text);
    this.h.radioResult?.({ aim, comment, delta: this.state.lastDelta });
    this.h.meters?.(this.snapshot());
    return { aim, comment };
  }

  snapshot() {
    const s = this.state;
    return {
      mood: Math.round(s.mood), love: Math.round(s.love), courage: Math.round(s.courage),
      styleScore: s.styleScore, coachScore: s.coachScore, courageScore: s.courageScore,
      styleMult: S.round1(s.styleMult), panic: !!s.panic,
      threshold: this.d.threshold, radioLeft: this.radioLeft,
      foundCount: this.foundPrefs.length,
      hiddenTotal: this.client.target.hiddenPrefs.length,
      visibleTotal: this.client.target.visiblePrefs.length,
    };
  }

  #history(limit = 0) {
    const lines = this.transcript.map(t =>
      t.who === 'client' ? `클라이언트: ${t.text}`
        : t.who === 'target' ? `타겟: ${t.text}`
          : t.who === 'radio' ? `[본부 무전]: ${t.text}`
            : `[상황]: ${t.text}`);
    return (limit ? lines.slice(-limit) : lines).join('\n');
  }

  fullTranscript() { return this.#history(); }

  #pushUser(hist, text) {
    const last = hist[hist.length - 1];
    if (last && last.role === 'user') last.content += '\n' + text;
    else hist.push({ role: 'user', content: text });
  }

  async #waitWhilePaused() {
    while (this.paused) await sleep(150);
  }

  // ── 문자 페이즈 ──────────────────────────────────────
  async runTexting() {
    const c = this.client;
    this.radioLeft = this.d.radioText;
    this.clientHist = [{ role: 'user', content: `[상황] 드디어 용기를 냈다. ${c.target.name}에게 먼저 보낼 첫 문자를 지금 작성해서 전송하라.` }];
    this.targetHist = [];
    this.h.phase?.({ phase: 'text', turns: this.d.textTurns, radioLeft: this.radioLeft });
    await this.#runTurns('text', this.d.textTurns);
    return !this.aborted;
  }

  // ── 대면 페이즈 ──────────────────────────────────────
  async situation() {
    try {
      return await this.llm.call({
        label: '대면 상황 생성',
        system: P.situationSystem(),
        messages: [{ role: 'user', content: P.situationUser(this.client, this.#history(20), this.outfitDesc, this.state.styleScore) }],
        schema: P.SITUATION_SCHEMA, effort: 'low',
      });
    } catch {
      return { place: '2077 만남의 광장', intro: '어찌저찌 만나기로 했다.', outfitReaction: '' };
    }
  }

  async runTalking(sit) {
    const c = this.client;
    this.radioLeft = this.d.radioTalk;

    // 첫인상: 스타일링 점수가 한 방에 반영되는 지점
    this.state = S.firstImpression(this.state, this.d);
    this.transcript.push({ who: 'sys', text: `[${sit.place}] ${sit.intro}` });
    this.h.bubble?.('sys', `[${sit.place}] ${sit.intro}`);
    if (sit.outfitReaction) {
      this.transcript.push({ who: 'target', text: sit.outfitReaction });
      this.h.bubble?.('target', sit.outfitReaction);
    }
    this.h.judge?.({
      mood: this.state.lastDelta.mood, love: this.state.lastDelta.love,
      reason: `첫인상 판정! 착장 ${this.state.styleScore}/10 — ${this.state.lastDelta.love >= 0 ? '눈길을 붙잡았다' : '시선이 빗나갔다'}`,
      firstImpression: true,
    });
    this.h.meters?.(this.snapshot());

    this.clientHist = [{ role: 'user', content: `[상황] 문자 작전 끝에 드디어 만났다. 장소: ${sit.place}. ${sit.intro}\n먼저 첫 마디를 건네라.` }];
    this.targetHist = [{ role: 'user', content: `[상황] ${sit.place}에서 ${c.name}을(를) 만나기로 해서 나왔다. 곧 상대가 말을 걸 것이다.` }];
    this.h.phase?.({ phase: 'talk', turns: this.d.talkTurns, radioLeft: this.radioLeft, place: sit.place });
    await this.#runTurns('talk', this.d.talkTurns);
    return !this.aborted;
  }

  // ── 턴 루프 ──────────────────────────────────────────
  async #runTurns(phase, turns) {
    const c = this.client;
    const clientSystem = P.clientAgentSystem(c, this.coaching, this.outfitDesc, phase);
    const targetSystem = P.targetAgentSystem(c, phase, this.outfitDesc);
    const judgeSys = P.judgeSystem(c);

    for (let i = 0; i < turns; i++) {
      await this.#waitWhilePaused();
      this.h.turn?.({ phase, turn: i + 1, turns });

      // 무전 지시 주입
      if (this.pendingRadio) {
        this.#pushUser(this.clientHist, `[본부 무전 - 상대에게는 안 들림] ${this.pendingRadio}`);
        this.pendingRadio = null;
      }
      // 컨디션(용기 스태미나)을 매 턴 주입 → 연기가 실제로 달라진다
      this.#pushUser(this.clientHist, P.conditionNote(this.state.courage, this.state.panic));

      // 1) 클라이언트 발언
      const clientMsg = await this.llm.call({
        label: `${phase === 'text' ? '문자' : '대면'} 발언 ${i + 1}`,
        system: clientSystem, messages: this.clientHist, effort: 'low', maxTokens: 4000,
      });
      const historyForJudge = this.#history(14);
      this.clientHist.push({ role: 'assistant', content: clientMsg });
      this.transcript.push({ who: 'client', text: clientMsg });
      this.h.bubble?.('client', clientMsg);

      // 2) 심판
      let judge;
      try {
        judge = await this.llm.call({
          label: `판정 ${i + 1}`, system: judgeSys,
          messages: [{ role: 'user', content: P.judgeUser(historyForJudge, clientMsg) }],
          schema: P.JUDGE_SCHEMA, effort: 'low', maxTokens: 4000,
        });
      } catch {
        judge = { moodDelta: 0, loveDelta: 0, reason: '(심판이 잠시 졸았다)', hiddenPrefHit: '' };
      }

      const wasPanic = !!this.state.panic;
      this.state = S.applyTurn(this.state, this.d, judge);

      // 미확인 취향 적중: 내용은 공개하지 않고 카운트만 올린다
      const hit = (judge.hiddenPrefHit || '').trim();
      if (hit && !this.foundPrefs.includes(hit) && c.target.hiddenPrefs.includes(hit)) {
        this.foundPrefs.push(hit);
        this.h.intel?.({ found: this.foundPrefs.length, total: c.target.hiddenPrefs.length });
      }

      this.h.judge?.({
        mood: this.state.lastDelta.mood, love: this.state.lastDelta.love,
        reason: judge.reason || '', raw: { moodDelta: judge.moodDelta, loveDelta: judge.loveDelta },
        choke: this.state.lastDelta.chokeMult < 1, hiddenHit: !!hit,
      });
      this.h.meters?.(this.snapshot());
      if (this.state.panic && !wasPanic) this.h.panic?.();

      const fail = S.failureReason(this.state);
      if (fail) {
        this.aborted = true; this.abortReason = fail;
        const msg = phase === 'text'
          ? '...읽씹당했다. 프로필 사진도 강아지로 바뀌었다.'
          : '...상대가 "화장실 좀"이라며 나가더니 돌아오지 않았다.';
        this.transcript.push({ who: 'sys', text: msg });
        this.h.bubble?.('sys', msg);
        return;
      }

      // 3) 타겟 응답
      this.#pushUser(this.targetHist, `[${c.name}의 ${phase === 'text' ? '문자' : '말'}] ${clientMsg}`);
      const targetMsg = await this.llm.call({
        label: `${phase === 'text' ? '문자' : '대면'} 응답 ${i + 1}`,
        system: targetSystem, messages: this.targetHist, effort: 'low', maxTokens: 4000,
      });
      this.targetHist.push({ role: 'assistant', content: targetMsg });
      this.transcript.push({ who: 'target', text: targetMsg });
      this.h.bubble?.('target', targetMsg);
      this.#pushUser(this.clientHist, `[${c.target.name}의 ${phase === 'text' ? '답장' : '말'}] ${targetMsg}`);
    }
  }

  // ── 정산 ─────────────────────────────────────────────
  async finish() {
    const v = S.verdict(this.state, this.d, { aborted: this.aborted });
    const debrief = S.debrief(this.state, this.d, v);
    const missed = this.client.target.hiddenPrefs.filter(p => !this.foundPrefs.includes(p));

    let letter = { letter: '(편지가 오지 않았다. 2077년의 우편은 원래 이렇다.)', epilogue: '통신 두절.', mvp: '알 수 없음' };
    try {
      letter = await this.llm.call({
        label: '결과 편지',
        system: P.resultSystem(),
        messages: [{
          role: 'user', content: P.resultUser(this.client, {
            ...v, threshold: this.d.threshold, aborted: this.aborted,
            styleScore: this.state.styleScore, coachScore: this.state.coachScore,
            courageScore: this.state.courageScore, radioCount: this.state.radioCount,
            foundPrefs: this.foundPrefs, missedPrefs: missed,
            transcript: this.fullTranscript(),
          }),
        }],
        schema: P.RESULT_SCHEMA, effort: 'medium', maxTokens: 8000,
      });
    } catch { /* 편지 생성 실패해도 결과는 확정되어 있다 */ }

    return {
      verdict: v, debrief, letter,
      aborted: this.aborted, abortReason: this.abortReason,
      foundPrefs: this.foundPrefs, missedPrefs: missed,
      visiblePrefs: this.client.target.visiblePrefs,
      difficulty: this.d,
    };
  }
}
