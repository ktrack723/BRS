// engine.js — 공작 하네스(harness). 클라이언트 에이전트 · 타겟 에이전트 · 심판을 턴마다 물려 돌리고,
// scoring.js의 규칙으로 상태를 갱신한다. DOM을 전혀 모른다 — UI와는 콜백으로만 통신한다.
//
// 최적화 메모:
//   · 심판과 타겟 응답은 서로를 기다릴 이유가 없다 → 매 턴 Promise.all로 동시 발사 (턴당 왕복 3회 → 2회).
//   · 대면 상황 생성은 문자 마지막 턴의 판정/응답과 함께 미리 던진다 (왕복 1회 추가 절감).
//   · 시스템 프롬프트는 턴마다 바이트 동일 → 캐시 breakpoint를 걸어 입력 토큰을 재사용한다.
//   · 심판에게 넘기는 대화 로그는 최근 12줄로 자른다.

import * as P from './prompts.js';
import * as S from './scoring.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const HISTORY_WINDOW = 12;

export class Engine {
  constructor(llm, { couple, prep, handlers }) {
    this.llm = llm;
    this.couple = couple;
    this.d = S.diffOf(couple.difficulty);
    this.h = handlers || {};
    this.prep = {
      outfitDesc: (prep?.outfitDesc || '').trim(),
      coaching: (prep?.coaching || '').trim(),
      speech: (prep?.speech || '').trim(),
    };

    this.state = S.initialState(this.d);
    this.transcript = [];
    this.clientHist = [];
    this.targetHist = [];
    this.aborted = false;
    this.abortReason = null;

    this.paused = false;      // 무전 모달이 열려 있는 동안
    this.pendingRadio = null; // 다음 클라이언트 발언에 주입될 지시
    this.radioLeft = 0;
    this.phase = 'text';
  }

  // ── 외부 제어 ────────────────────────────────────────
  setPaused(v) { this.paused = !!v; }

  // 무전 송신. 채점하지 않는다 — 다음 발언에 그대로 주입되고, 효과는 그 발언의 판정으로 드러난다.
  submitRadio(text) {
    const t = (text || '').trim();
    if (this.radioLeft <= 0 || !t) return false;
    this.radioLeft--;
    this.pendingRadio = t;
    this.state = S.noteRadio(this.state);
    this.transcript.push({ who: 'radio', text: t });
    this.h.bubble?.('radio', t);
    this.h.meters?.(this.snapshot());
    return true;
  }

  snapshot() {
    const s = this.state, t = this.couple.target;
    return {
      mood: Math.round(s.mood), love: Math.round(s.love),
      threshold: this.d.threshold, moodFloor: this.d.moodFloor,
      mult: S.round1(S.moodMultiplier(s.mood)),
      radioLeft: this.radioLeft, radioUsed: s.radioUsed,
      foundCount: s.hits.length, hiddenTotal: t.hiddenPrefs.length,
      visibleTotal: t.visiblePrefs.length, redLines: s.redLines,
      turn: s.turns, phase: this.phase,
    };
  }

  #history(limit = 0) {
    const c = this.couple;
    const lines = this.transcript.map(t =>
      t.who === 'client' ? `${c.client.name}: ${t.text}`
        : t.who === 'target' ? `${c.target.name}: ${t.text}`
          : t.who === 'radio' ? `[본부 무전(상대는 못 들음)]: ${t.text}`
            : `[상황]: ${t.text}`);
    return (limit ? lines.slice(-limit) : lines).join('\n');
  }

  fullTranscript() { return this.#history(); }

  #pushUser(hist, text) {
    const last = hist[hist.length - 1];
    if (last && last.role === 'user') last.content += '\n' + text;
    else hist.push({ role: 'user', content: text });
  }

  async #gate() { while (this.paused) await sleep(120); }

  // ── 문자 페이즈 ──────────────────────────────────────
  async runTexting() {
    const c = this.couple;
    this.phase = 'text';
    this.radioLeft = this.d.radioText;
    this.pendingRadio = null;
    this.clientHist = [{
      role: 'user',
      content: `[상황] 드디어 용기를 냈다. ${c.target.name}에게 먼저 보낼 첫 문자를 지금 작성해서 전송하라.`,
    }];
    this.targetHist = [];
    this.h.phase?.({ phase: 'text', turns: this.d.textTurns, radioLeft: this.radioLeft });
    this.h.meters?.(this.snapshot());
    await this.#runTurns('text', this.d.textTurns);
    return !this.aborted;
  }

  // 문자 마지막 턴에 미리 던져둔 대면 상황을 회수한다
  async situation() {
    if (this.situationPromise) {
      const r = await this.situationPromise.catch(() => null);
      if (r) return r;
    }
    return this.#callSituation(this.#history());
  }

  #callSituation(history) {
    return this.llm.call({
      label: '대면 상황 생성',
      system: P.situationSystem(this.couple),
      messages: [{ role: 'user', content: P.situationUser(this.couple, history, this.prep.outfitDesc) }],
      schema: P.SITUATION_SCHEMA, effort: 'low', maxTokens: 4000,
    }).catch(() => ({
      place: '2077 국립 강제매칭 광장',
      intro: '어찌저찌 만나기로 했다. 광장 스피커에서는 국가 출산 장려가가 흘러나온다.',
      outfitReaction: '(상대가 당신을 위아래로 훑어본다)',
    }));
  }

  // ── 대면 페이즈 ──────────────────────────────────────
  async runTalking(sit) {
    const c = this.couple;
    this.phase = 'talk';
    this.radioLeft = this.d.radioTalk;
    this.pendingRadio = null;   // 문자 페이즈 막판에 보낸 지시는 대면 맥락에 맞지 않는다

    this.transcript.push({ who: 'sys', text: `[${sit.place}] ${sit.intro}` });
    this.h.bubble?.('sys', `[${sit.place}] ${sit.intro}`);
    this.transcript.push({ who: 'target', text: sit.outfitReaction });
    this.h.bubble?.('target', sit.outfitReaction);

    // 첫인상 판정 — 스타일링이 실제로 효력을 발휘하는 지점. 준비 단계가 아니라 '만남'에서 채점된다.
    let fi;
    try {
      fi = await this.llm.call({
        label: '첫인상 판정',
        system: P.judgeSystem(this.couple), cache: true,
        messages: [{ role: 'user', content: P.firstImpressionUser(this.couple, this.prep.outfitDesc, sit.outfitReaction) }],
        schema: P.JUDGE_SCHEMA, effort: 'low', maxTokens: 3000,
      });
    } catch { fi = { tier: 'empty', moodDelta: 0, loveDelta: 0, visiblePrefHit: '', hiddenPrefHit: '', redLineHit: false, reason: '(첫인상 판정 불능)' }; }

    this.state = S.applyTurn(this.state, this.d, fi, {
      firstImpression: true, knownHidden: c.target.hiddenPrefs, knownVisible: c.target.visiblePrefs,
    });
    this.#reportJudge(fi, { firstImpression: true });

    this.clientHist = [{
      role: 'user',
      content: `[상황] 문자 작전 끝에 드디어 만났다. 장소: ${sit.place}. ${sit.intro}\n` +
        `${c.target.name}의 첫 반응: "${sit.outfitReaction}"\n먼저 첫 마디를 건네라.`,
    }];
    this.targetHist = [
      { role: 'user', content: `[상황] ${sit.place}에서 ${c.client.name}을(를) 만나기로 해서 나왔다. 방금 상대의 차림새를 보고 한마디 했다.` },
      { role: 'assistant', content: sit.outfitReaction },
    ];
    this.h.phase?.({ phase: 'talk', turns: this.d.talkTurns, radioLeft: this.radioLeft, place: sit.place });
    await this.#runTurns('talk', this.d.talkTurns);
    return !this.aborted;
  }

  #reportJudge(judge, extra = {}) {
    const dl = this.state.lastDelta;
    this.h.judge?.({
      mood: dl.mood, love: dl.love,
      rawMood: dl.rawMood, rawLove: dl.rawLove, mult: dl.mult,
      reason: judge.reason || '', hit: !!dl.hit, red: !!dl.red,
      ...extra,
    });
    if (dl.hit) this.h.intel?.({ found: this.state.hits.length, total: this.couple.target.hiddenPrefs.length });
    if (dl.red) this.h.redline?.({ count: this.state.redLines });
    this.h.meters?.(this.snapshot());
  }

  // ── 턴 루프 ──────────────────────────────────────────
  async #runTurns(phase, turns) {
    const c = this.couple;
    const clientSystem = P.clientAgentSystem(c, this.prep, phase);
    const targetSystem = P.targetAgentSystem(c, phase, this.prep.outfitDesc);
    const judgeSys = P.judgeSystem(c);
    const label = phase === 'text' ? '문자' : '대면';

    for (let i = 0; i < turns; i++) {
      await this.#gate();
      // turn 핸들러는 await한다 — 자동 플레이 하네스가 이 시점에 무전을 끼워 넣을 수 있게.
      await this.h.turn?.({ phase, turn: i + 1, turns });
      await this.#gate();

      // 무전 지시 주입 (상대에게는 안 들린다)
      if (this.pendingRadio) {
        this.#pushUser(this.clientHist, `[본부 무전 - 상대에게는 안 들림] ${this.pendingRadio}`);
        this.pendingRadio = null;
      }

      // 1) 클라이언트 발언 — 이것만은 순차적으로 나와야 한다
      const clientMsg = await this.llm.call({
        label: `${label} 발언 ${i + 1}`,
        system: clientSystem, cache: true,
        messages: this.clientHist, effort: 'low', maxTokens: 3000,
      });
      const historyForJudge = this.#history(HISTORY_WINDOW);
      this.clientHist.push({ role: 'assistant', content: clientMsg });
      this.transcript.push({ who: 'client', text: clientMsg });
      this.h.bubble?.('client', clientMsg);

      // 2) 심판과 타겟 응답은 서로 독립이다 → 동시 발사
      this.#pushUser(this.targetHist, `[${c.client.name}의 ${phase === 'text' ? '문자' : '말'}] ${clientMsg}`);
      const isLastTextTurn = phase === 'text' && i === turns - 1;

      const jobs = [
        this.llm.call({
          label: `판정 ${i + 1}`, system: judgeSys, cache: true,
          messages: [{ role: 'user', content: P.judgeUser(historyForJudge, clientMsg) }],
          schema: P.JUDGE_SCHEMA, effort: 'low', maxTokens: 3000,
        }).catch(() => ({ tier: 'empty', moodDelta: 0, loveDelta: 0, visiblePrefHit: '', hiddenPrefHit: '', redLineHit: false, reason: '(심판이 잠시 졸았다)' })),
        this.llm.call({
          label: `${label} 응답 ${i + 1}`,
          system: targetSystem, cache: true,
          messages: this.targetHist, effort: 'low', maxTokens: 3000,
        }).catch(() => '...(상대가 답이 없다)'),
      ];
      // 문자 마지막 턴이면 대면 상황 생성까지 같은 배치에 태운다
      if (isLastTextTurn) {
        this.situationPromise = this.#callSituation(this.#history() + `\n${c.client.name}: ${clientMsg}`);
      }

      const [judge, targetMsg] = await Promise.all(jobs);

      // 3) 판정 반영
      this.state = S.applyTurn(this.state, this.d, judge, {
        knownHidden: c.target.hiddenPrefs, knownVisible: c.target.visiblePrefs,
      });
      this.#reportJudge(judge);

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

      // 4) 타겟 응답 반영
      this.targetHist.push({ role: 'assistant', content: targetMsg });
      this.transcript.push({ who: 'target', text: targetMsg });
      this.h.bubble?.('target', targetMsg);
      this.#pushUser(this.clientHist, `[${c.target.name}의 ${phase === 'text' ? '답장' : '말'}] ${targetMsg}`);
    }
  }

  // ── 정산 ─────────────────────────────────────────────
  async finish() {
    const v = S.verdict(this.state, this.d, { aborted: this.aborted });
    const db = S.debrief(this.state, this.d, v, this.couple);

    let letter = {
      letter: '(편지가 오지 않았다. 2077년의 우편은 원래 이렇다.)',
      epilogue: '통신 두절.', mvp: '알 수 없음',
    };
    try {
      letter = await this.llm.call({
        label: '결과 편지',
        system: P.resultSystem(this.couple),
        messages: [{
          role: 'user', content: P.resultUser(this.couple, {
            ...v, threshold: this.d.threshold, moodFloor: this.d.moodFloor, aborted: this.aborted,
            found: this.state.hits, missed: db.missed,
            redLines: this.state.redLines, radioUsed: this.state.radioUsed,
            transcript: this.fullTranscript(),
          }),
        }],
        schema: P.RESULT_SCHEMA, effort: 'medium', maxTokens: 6000,
      });
    } catch { /* 편지 생성 실패해도 결과는 확정되어 있다 */ }

    return {
      verdict: v, debrief: db, letter,
      aborted: this.aborted, abortReason: this.abortReason,
      state: this.state, difficulty: this.d, couple: this.couple,
      transcript: this.fullTranscript(),
    };
  }
}
