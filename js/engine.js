// engine.js — 공작 하네스(harness). 클라이언트 에이전트 · 타겟 에이전트 · 심판을 턴마다 물려 돌리고,
// scoring.js의 규칙으로 상태를 갱신한다. DOM을 전혀 모른다 — UI와는 콜백으로만 통신한다.
//
// 최적화 메모:
//   · 심판과 타겟 응답은 서로를 기다릴 이유가 없다 → 매 턴 Promise.all로 동시 발사 (턴당 왕복 3회 → 2회).
//   · 대면 상황 생성은 문자 마지막 턴의 판정/응답과 함께 미리 던진다 (왕복 1회 추가 절감).
//   · 시스템 프롬프트는 턴마다 바이트 동일 → 캐시 breakpoint를 걸어 입력 토큰을 재사용한다.
//   · 심판에게 넘기는 대화 로그는 최근 12줄로 자른다.
//
// UI와의 계약:
//   · bubble/judge 핸들러가 약속(Promise)을 돌려주면 하네스는 그걸 기다린다.
//     LLM이 응답하는 속도와 사람이 읽는 속도는 다르다 — 후자를 정하는 건 UI 쪽(pacing.js)이다.
//     기다리는 동안 다음 호출이 나가지 않으므로, 무전 개입이 '지금 보고 있는 장면'에 끼어든다.
//   · 동기 핸들러(테스트·시뮬레이터)를 넘기면 예전처럼 그냥 흘러간다.
//
// 구조 메모 (개편):
//   · 문자 → 대면으로 넘어갈 때 대화 내역을 **이어받는다.** 두 사람은 자기가 방금 주고받은 문자를 기억한다.
//     예전에는 대면에서 컨텍스트를 새로 시작해서, 만나자마자 초면처럼 구는 일이 있었다.
//   · '분위기'가 수치 말고 **문장**으로도 존재한다. 심판이 매 턴 갱신하고, 그 문장이 그대로
//     클라이언트에게 전달된다. 대화 규칙을 전부 걷어낸 자리를 이게 대신한다 —
//     "실마리를 물어라"라고 시키는 대신 "상대가 아까부터 시계를 본다"고 알려주는 쪽이다.

import * as P from './prompts.js';
import * as S from './scoring.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const HISTORY_WINDOW = 12;

// 받침에 맞는 조사. 마지막 글자가 한글이면 종성 유무로 고른다.
const JOSA = { '이': ['이', '가'], '과': ['과', '와'], '을': ['을', '를'], '은': ['은', '는'] };
function josa(word, kind) {
  const pair = JOSA[kind];
  if (!pair) return word;
  const ch = String(word).trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  const hangul = code >= 0 && code <= 11171;
  return word + (hangul ? pair[code % 28 === 0 ? 1 : 0] : `${pair[0]}(${pair[1]})`);
}

export class Engine {
  constructor(llm, { couple, prep, agent, handlers }) {
    this.llm = llm;
    this.couple = couple;
    this.agent = agent || { name: '무명', gender: '' };
    this.d = S.diffOf(couple.difficulty);
    this.h = handlers || {};
    this.prep = {
      outfitDesc: (prep?.outfitDesc || '').trim(),
      coaching: (prep?.coaching || '').trim(),
      speech: (prep?.speech || '').trim(),
    };

    this.state = S.initialState(this.d);
    this.state.vibe = P.openingVibe(couple, 'text');
    this.transcript = [];
    this.clientHist = [];
    this.targetHist = [];
    this.aborted = false;
    this.abortReason = null;

    this.paused = false;      // 무전 모달이 열려 있는 동안
    this.pendingRadio = null; // 다음 클라이언트 발언에 주입될 지시
    this.keepLog = [];        // 심판이 매 턴 답한 '더 갈 데 있나' — 연장과 조기 종료를 둘 다 굴린다
    this.pendingJudge = null; // 아직 채점되지 않은 직전 발언 (판정은 한 턴 늦게 온다)
    this.tierLog = [];        // 심판이 지금까지 매긴 등급. 심판 본인에게 되돌려줘 분포를 점검하게 한다
    this.lastVibeSent = null; // 클라이언트에게 마지막으로 알려준 공기 (바뀔 때만 다시 알려준다)
    this.vibeBeats = 0;       // 공기가 갱신된 횟수. 눈치가 반쯤인 인물은 이 중 절반만 받는다
    this.radioLeft = 0;
    this.phase = 'text';
    this.phaseTurn = 0;    // 현재 페이즈에서 소화한 턴 수. 남은 턴을 계기판에 띄우려면 필요하다
    this.phaseTurns = 0;   // 현재 페이즈의 실제 턴 수. 케미가 좋으면 예정치보다 늘어난다
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
    // 케미가 좋으면 자리가 길어진다. 예정 턴이 아니라 실제 턴을 띄운다.
    const turnsTotal = this.phaseTurns || (this.phase === 'text' ? this.d.textTurns : this.d.talkTurns);
    return {
      mood: Math.round(s.mood), love: Math.round(s.love),
      threshold: this.d.threshold, moodFloor: this.d.moodFloor,
      mult: S.round1(S.moodMultiplier(s.mood)),
      // 후반에 같은 등급인데 호감이 덜 오르는 이유. 지금까지 계기판에 안 나갔다.
      loveSat: S.round1(S.loveSaturation(s.love)),
      radioLeft: this.radioLeft, radioUsed: s.radioUsed,
      revealed: [...s.revealed], revealedCount: s.revealed.length,
      secretTotal: t.hiddenPrefs.length, visibleTotal: t.visiblePrefs.length,
      // 심판이 보고하는 revealed는 자유 문장이라 감춘 취향과 1:1이 아니다.
      // 개수를 뺄셈으로 때우면 계기판이 디브리핑과 다른 말을 한다 (실측으로 잡았다).
      // 사후 보고와 같은 함수를 쓴다.
      secretLeft: S.surfacedSecrets(this.couple, this.#history(), s.revealed).missed.length,
      vibe: s.vibe,
      // 앞을 막고 있는 것. 호감을 다 채워도 이걸 안 다루면 차인다.
      // 의뢰서에만 적어두면 플레이어는 14턴 내내 그런 게 있는 줄도 모르고 논다 (실측).
      barrier: this.couple.barrier || '',
      barrierCleared: !!s.barrierCleared,
      // 화면 위의 공기가 실제로 의뢰인에게 닿는가. 안 닿는 사람이 있다.
      reads: this.couple.client.flaw?.reads || 'well',
      vibeDelivered: this.lastVibeSent,
      turn: s.turns, phase: this.phase,
      turnsTotal, turnsLeft: Math.max(0, turnsTotal - this.phaseTurn),
    };
  }

  // opts.noRadio — 무전 줄을 뺀 기록.
  // 나레이터는 '어디서 만났고 상대가 뭐라고 했나'만 만들면 된다. 본부가 무엇을 시켰는지는
  // 그 장면에 쓸 일이 없고, 알면 의뢰인을 '지시받는 사람'으로 그리기 시작한다.
  // (심판과 결과 기록관에게는 그대로 간다 — 화제가 튄 이유를 알아야 하고, 편지에는 그게 재료다.)
  #history(limit = 0, { noRadio = false } = {}) {
    const c = this.couple;
    const src = noRadio ? this.transcript.filter(t => t.who !== 'radio') : this.transcript;
    const lines = src.map(t =>
      t.who === 'client' ? `${c.client.name}: ${t.text}`
        : t.who === 'target' ? `${c.target.name}: ${t.text}`
          : t.who === 'radio' ? `[HQ RADIO — the other person cannot hear this]: ${t.text}`
            : `[SCENE]: ${t.text}`);
    return (limit ? lines.slice(-limit) : lines).join('\n');
  }

  fullTranscript() { return this.#history(); }

  #pushUser(hist, text) {
    const last = hist[hist.length - 1];
    if (last && last.role === 'user') last.content += '\n' + text;
    else hist.push({ role: 'user', content: text });
  }

  // 공기는 **읽을 줄 아는 사람에게만** 간다.
  //
  // 분위기 못 읽는 인물에게 "지금 상대가 식었다"고 알려주면 그 인물은 더 이상 그 인물이 아니다.
  // 프롬프트로 "너는 눈치가 없다"고 지시해봐야 안 먹는다(실측) — 그러니 정보를 아예 안 준다.
  //   none : 평생 못 받는다. 상대가 시계를 봐도 모른다.
  //   some : 갱신 두 번에 한 번만 닿는다. 뒤늦게, 띄엄띄엄 알아챈다.
  //   well : 바뀔 때마다 받는다.
  // (같은 문장을 매 턴 반복하지 않는 것은 캐시·로그 문제이기도 하다)
  #injectVibe() {
    const reads = this.couple.client.flaw?.reads || 'well';
    if (reads === 'none') return;
    const v = (this.state.vibe || '').trim();
    if (!v || v === this.lastVibeSent) return;
    this.vibeBeats += 1;
    if (reads === 'some' && this.vibeBeats % 2 === 0) return;  // 이번 갱신은 그냥 지나간다
    this.lastVibeSent = v;
    this.#pushUser(this.clientHist, `[THE AIR AT THIS TABLE RIGHT NOW] ${v}`);
  }

  async #gate() { while (this.paused) await sleep(120); }

  // ── 문자 페이즈 ──────────────────────────────────────
  async runTexting() {
    const c = this.couple;
    this.phase = 'text';
    this.radioLeft = this.d.radioText;
    this.phaseTurn = 0;
    this.phaseTurns = this.d.textTurns;
    this.pendingRadio = null;
    this.clientHist = [{
      role: 'user',
      content: `[SCENE] You finally worked up the nerve. Write and send the first text to ${c.target.name}, now.`,
    }];
    this.targetHist = [];
    this.h.phase?.({ phase: 'text', turns: this.d.textTurns, radioLeft: this.radioLeft });
    this.h.vibe?.(this.state.vibe);
    this.h.meters?.(this.snapshot());
    await this.#runTurns('text', this.d.textTurns);
    // 문자 페이즈의 마지막 판정을 여기서 끝낸다.
    // 예전에는 이 미결 판정이 runTalking 안까지 따라가서, 대면 장소·도입부·상대의 첫마디가
    // 이미 화면에 뜬 뒤에 "문자 8턴 판정"이 뒤늦게 찍혔다. 페이즈가 넘어간 뒤에 나오는
    // 지난 페이즈 판정은 플레이어에게 그냥 오작동으로 보인다.
    await this.#flushJudge('text');
    return !this.aborted;
  }

  // 문자 마지막 턴에 미리 던져둔 대면 상황을 회수한다
  async situation() {
    if (this.situationPromise) {
      const r = await this.situationPromise.catch(() => null);
      if (r) return r;
    }
    return this.#callSituation(this.#history(0, { noRadio: true }));
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
      vibe: '둘 다 앉기만 하고 아무 말이 없다.',
    }));
  }

  // ── 대면 페이즈 ──────────────────────────────────────
  async runTalking(sit) {
    const c = this.couple;
    this.phase = 'talk';
    this.radioLeft = this.d.radioTalk;
    // 페이즈가 바뀌는 즉시 계기판을 갱신한다. 안 하면 대면 초반에 문자 페이즈의
    // 잔여 턴("0/4")과 잔여 무전이 그대로 남아 거짓 수치가 보인다 (라이브에서 잡았다).
    this.phaseTurn = 0;
    this.phaseTurns = this.d.talkTurns;
    this.h.meters?.(this.snapshot());
    this.pendingRadio = null;   // 문자 페이즈 막판에 보낸 지시는 대면 맥락에 맞지 않는다

    this.transcript.push({ who: 'sys', text: `[${sit.place}] ${sit.intro}` });
    await this.h.bubble?.('sys', `[${sit.place}] ${sit.intro}`);
    this.transcript.push({ who: 'target', text: sit.outfitReaction });
    await this.h.bubble?.('target', sit.outfitReaction);

    if (this.aborted) return false;

    // 첫인상 판정 — 스타일링이 실제로 효력을 발휘하는 지점. 준비 단계가 아니라 '만남'에서 채점된다.
    let fi;
    try {
      fi = await this.llm.call({
        label: '첫인상 판정',
        system: P.judgeSystem(this.couple), cache: true,
        messages: [{ role: 'user', content: P.firstImpressionUser(this.couple, this.prep.outfitDesc, sit.outfitReaction, this.tierLog) }],
        schema: P.JUDGE_SCHEMA, effort: 'low', maxTokens: 3000,
      });
    } catch { fi = this.#neutralJudge('(첫인상 판정 불능)'); }

    this.state = S.applyTurn(this.state, this.d, fi, { firstImpression: true });
    await this.#reportJudge(fi, { firstImpression: true });

    // 대화 내역을 이어받는다. 두 사람은 방금 주고받은 문자를 기억한 채로 마주 앉는다.
    this.lastVibeSent = null;   // 자리가 바뀌었으니 공기를 다시 알려준다
    this.#pushUser(this.clientHist,
      `[SCENE CHANGE] The texting worked and you are finally in front of them. Place: ${sit.place}. ${sit.intro}\n` +
      `The first thing ${c.target.name} said on seeing you: "${sit.outfitReaction}"\n` +
      `This is face to face now, not texting. Open with the first thing you say.`);
    this.#pushUser(this.targetHist,
      `[SCENE CHANGE] You came out to meet ${c.client.name} at ${sit.place}. ${sit.intro}\n` +
      `You just said something about the state of their outfit.`);
    this.targetHist.push({ role: 'assistant', content: sit.outfitReaction });

    this.h.phase?.({ phase: 'talk', turns: this.d.talkTurns, radioLeft: this.radioLeft, place: sit.place });
    await this.#runTurns('talk', this.d.talkTurns);
    await this.#flushJudge('talk');
    return !this.aborted;
  }

  // 심판이 죽었을 때 쓰는 빈 판정. **flat이 아니라 nudge다** —
  // flat은 "아무 일도 안 일어났다"는 실제 판정이고, 정체 감쇠가 거기에 붙는다.
  // 판정을 못 받은 턴에까지 그걸 물리면 API 한 번 흔들린 걸로 자리가 깨진다.
  // nudge는 점수도 0이고 정체에도 안 세므로, 셈에서 빠지는 자리로 쓴다.
  #neutralJudge(reason) {
    return {
      tier: 'nudge', moodDelta: 0, loveDelta: 0, reason,
      vibe: this.state.vibe, revealed: '', clientEmote: 'talk', targetEmote: 'talk',
    };
  }

  // 판정줄·게이지·표정은 같은 순간에 움직여야 한다. 그래서 judge 핸들러를 먼저 '띄우고',
  // 나머지를 다 반영한 뒤에 그 핸들러가 돌려준 대기(읽는 시간)를 마지막에 기다린다.
  async #reportJudge(judge, extra = {}) {
    const dl = this.state.lastDelta;
    this.tierLog.push(dl.tier);
    const shown = this.h.judge?.({
      mood: dl.mood, love: dl.love,
      rawMood: dl.rawMood, rawLove: dl.rawLove, mult: dl.mult, tier: dl.tier,
      reason: judge.reason || '', revealed: dl.revealed,
      ...extra,
    });
    if (dl.revealed) this.h.intel?.({ text: dl.revealed, count: this.state.revealed.length });
    if (dl.vibe) this.h.vibe?.(dl.vibe);
    if (judge.clientEmote) this.h.emote?.('client', judge.clientEmote);
    if (judge.targetEmote) this.h.emote?.('target', judge.targetEmote);
    this.h.meters?.(this.snapshot());
    await shown;
  }

  // 심판 호출 하나. 반드시 '상대가 실제로 어떻게 반응했는지'까지 같이 넘긴다 —
  // 그게 없으면 심판은 발언 하나만 보고 허공에 대고 채점하게 된다.
  #judgeCall(pending, tag) {
    return this.llm.call({
      label: `판정 ${tag}`, system: P.judgeSystem(this.couple), cache: true,
      messages: [{ role: 'user', content: P.judgeUser(pending.history, pending.clientMsg, pending.reaction, this.tierLog) }],
      schema: P.JUDGE_SCHEMA, effort: 'low', maxTokens: 3000,
    }).catch(() => this.#neutralJudge('(심판이 잠시 졸았다)'));
  }

  // 판정 하나를 상태에 반영. 분위기 파탄이면 true를 돌려준다.
  // 판정줄도 사람이 읽는 것이라 UI가 붙잡아 둘 수 있어야 한다 → 핸들러를 기다린다.
  async #applyJudge(judge, pending, opts = {}) {
    this.state = S.applyTurn(this.state, this.d, judge, { radioInjected: !!pending?.radioInjected, ...opts });
    // **명시적인 답만 자리 길이를 움직인다.** true면 늘리고, false가 연달아 나오면 끊는다.
    // 답이 없으면(구형 심판·응답 실패) null로 남기고 아무것도 안 한다 —
    // 없는 답 때문에 자리가 끊기거나 늘어나면 그건 판정이 아니라 사고다.
    if (!opts.firstImpression) {
      this.keepLog.push(typeof judge?.keepGoing === 'boolean' ? judge.keepGoing : null);
    }
    await this.#reportJudge(judge, { turn: pending?.turn, ...(opts.firstImpression ? { firstImpression: true } : {}) });
    return !!S.failureReason(this.state);
  }

  async #breakdown(phase) {
    // 사망이면 파탄 문구가 달라진다. 읽씹당한 게 아니라 사람이 죽은 것이다.
    const cas = this.state.casualty;
    let msg;
    if (cas && cas !== 'none') {
      const c = this.couple;
      // 이 줄은 판에서 제일 크게 읽히는 문장이다. "트럼푸이(가) 사망했다"로 나가면 김이 샌다.
      const who = cas === 'both' ? `${josa(c.client.name, '과')} ${josa(c.target.name, '이')} 둘 다`
        : josa(cas === 'client' ? c.client.name : c.target.name, '이');
      const note = this.state.casualtyNote ? ` ${this.state.casualtyNote}` : '';
      msg = `...${who} 사망했다.${note} 공작은 여기서 종료된다.`;
      this.abortReason = 'death';
    } else {
      msg = phase === 'text'
        ? '...읽씹당했다. 프로필 사진도 강아지로 바뀌었다.'
        : '...상대가 "화장실 좀"이라며 나가더니 돌아오지 않았다.';
      this.abortReason = 'mood';
    }
    this.aborted = true;
    this.transcript.push({ who: 'sys', text: msg });
    await this.h.bubble?.('sys', msg);
  }

  // ── 턴 루프 ──────────────────────────────────────────
  // 판정을 한 턴 늦춘다. 그래야 심판이 "그 발언에 상대가 실제로 어떻게 반응했는가"를 보고 채점할 수 있고,
  // 동시에 [직전 턴 판정 ∥ 이번 턴 타겟 응답]을 한 배치로 묶어 턴당 순차 왕복 2회를 유지한다.
  async #runTurns(phase, turns) {
    const c = this.couple;
    const clientSystem = P.clientAgentSystem(c, this.prep, phase, this.agent);
    const targetSystem = P.targetAgentSystem(c, phase, this.prep.outfitDesc);
    const label = phase === 'text' ? '문자' : '대면';
    const said = phase === 'text' ? '문자' : '말';
    let pending = this.pendingJudge || null;   // 아직 채점되지 않은 직전 발언
    this.pendingJudge = null;

    this.phaseTurn = 0;
    this.phaseTurns = turns;   // 연장되면 늘어난다
    let extra = 0;

    for (let i = 0; i < this.phaseTurns; i++) {
      await this.#gate();
      this.phaseTurn = i;

      // 마지막 턴에 들어서는 참인데 케미가 뜨거우면 자리가 길어진다.
      // 대면 상황 선발주(아래)보다 먼저 판단해야 한다 — 그래야 '진짜 마지막 턴'에서 발주된다.
      // 할 말이 떨어지면 자리를 접는다. 심판이 연달아 "더 갈 데 없다"고 했을 때만이다.
      // 문자는 답장이 끊기면서 끝나는 게 자연스러워서 더 짧게 잡혀 있다.
      if (i > 0 && S.cutShort(phase, this.keepLog)) {
        const msg = phase === 'text'
          ? '(답장이 끊겼다. 둘 다 더 보낼 말이 없다.)'
          : '(할 말이 떨어졌다. 누가 먼저랄 것도 없이 일어난다.)';
        this.transcript.push({ who: 'sys', text: msg });
        await this.h.bubble?.('sys', msg);
        this.phaseTurns = i + 1;
        break;
      }

      if (i === this.phaseTurns - 1 && S.extraTurn(phase, this.keepLog, extra)) {
        this.phaseTurns += 1; extra += 1;
        const msg = phase === 'text'
          ? '(아직 할 말이 남았다. 둘 다 휴대폰을 놓지 않는다.)'
          : '(누구도 자리에서 일어나지 않는다. 얘기가 더 이어진다.)';
        this.transcript.push({ who: 'sys', text: msg });
        await this.h.bubble?.('sys', msg);
        this.h.extend?.({ phase, turns: this.phaseTurns, extra });
      }

      // turn 핸들러는 await한다 — 자동 플레이 하네스가 이 시점에 무전을 끼워 넣을 수 있게.
      await this.h.turn?.({ phase, turn: i + 1, turns: this.phaseTurns, turnsLeft: this.phaseTurns - i });
      await this.#gate();

      // 무전 지시 주입 (상대에게는 안 들린다)
      let radioThisTurn = false;
      if (this.pendingRadio) {
        this.#pushUser(this.clientHist,
          `[ORDER FROM HQ — carry this out with your very next line. The other person cannot hear it]\n` +
          `${this.pendingRadio}\n` +
          `Refusal is not available. Show that you hate it if you hate it, but do it.`);
        this.pendingRadio = null;
        radioThisTurn = true;
      }
      // 갱신된 공기 주입
      this.#injectVibe();

      // 1) 클라이언트 발언 — 이것만은 순차적으로 나와야 한다
      const historyBefore = this.#history(HISTORY_WINDOW);
      const clientMsg = await this.llm.call({
        label: `${label} 발언 ${i + 1}`,
        system: clientSystem, cache: true,
        messages: this.clientHist, effort: 'low', maxTokens: 3000,
      });
      this.clientHist.push({ role: 'assistant', content: clientMsg });
      this.transcript.push({ who: 'client', text: clientMsg });
      await this.h.bubble?.('client', clientMsg);

      // 2) [직전 턴 판정] ∥ [이번 턴 타겟 응답] — 서로 독립이므로 동시 발사
      this.#pushUser(this.targetHist, `[${c.client.name} — ${said}] ${clientMsg}`);
      const jobs = [
        this.llm.call({
          label: `${label} 응답 ${i + 1}`,
          system: targetSystem, cache: true,
          messages: this.targetHist, effort: 'low', maxTokens: 3000,
        }).catch(() => '...(상대가 답이 없다)'),
        pending ? this.#judgeCall(pending, `${pending.turn}`) : Promise.resolve(null),
      ];
      // 문자 마지막 턴이면 대면 상황 생성까지 같은 배치에 태운다
      if (phase === 'text' && i === this.phaseTurns - 1) {
        this.situationPromise = this.#callSituation(this.#history(0, { noRadio: true }));
      }

      const [targetMsg, judge] = await Promise.all(jobs);

      // 3) 직전 턴 판정 반영
      if (judge && await this.#applyJudge(judge, pending)) { await this.#breakdown(phase); return; }

      // 4) 타겟 응답 반영 — 이게 이번 발언의 '반응'이 되어 다음 배치에서 채점된다
      this.targetHist.push({ role: 'assistant', content: targetMsg });
      this.transcript.push({ who: 'target', text: targetMsg });
      await this.h.bubble?.('target', targetMsg);
      this.#pushUser(this.clientHist, `[${c.target.name} — ${phase === 'text' ? '답장' : '말'}] ${targetMsg}`);

      // 무전이 꽂힌 발언인지 같이 들고 간다 — 판정이 한 턴 늦게 오므로 발언에 딸려 다녀야 한다
      pending = { history: historyBefore, clientMsg, reaction: targetMsg, turn: `${label} ${i + 1}`, radioInjected: radioThisTurn };
    }
    // 페이즈 마지막 발언은 아직 채점되지 않았다. 문자 페이즈면 대면으로 넘겨 이어서 처리한다.
    this.pendingJudge = pending;
    this.phaseTurn = this.phaseTurns;   // 페이즈를 다 소화했다. 남은 턴 표시가 1에서 멈추면 안 된다

  }

  // 남은 판정을 정산 전에 반드시 비운다
  async #flushJudge(phase) {
    const pending = this.pendingJudge;
    this.pendingJudge = null;
    if (!pending) return;
    const judge = await this.#judgeCall(pending, `${pending.turn} (최종)`);
    if (await this.#applyJudge(judge, pending)) await this.#breakdown(phase);
  }

  // ── 정산 ─────────────────────────────────────────────
  async finish() {
    if (this.pendingJudge && !this.aborted) await this.#flushJudge(this.phase);
    const v = S.verdict(this.state, this.d, { aborted: this.aborted });
    const transcript = this.fullTranscript();
    const db = S.debrief(this.state, this.d, v, this.couple, transcript);

    let letter = {
      letter: '(편지가 오지 않았다. 2077년의 우편은 원래 이렇다.)',
      epilogue: '통신 두절.', mvp: '알 수 없음',
    };
    try {
      letter = await this.llm.call({
        label: '결과 편지',
        system: P.resultSystem(this.couple, this.agent),
        messages: [{
          role: 'user', content: P.resultUser(this.couple, {
            ...v, threshold: this.d.threshold, moodFloor: this.d.moodFloor, aborted: this.aborted,
            abortReason: this.abortReason,
            casualty: this.state.casualty, casualtyNote: this.state.casualtyNote,
            leverage: this.state.leverage, barrierCleared: this.state.barrierCleared,
            vibe: this.state.vibe, revealed: this.state.revealed, missed: db.missed,
            radioUsed: this.state.radioUsed, transcript,
          }),
        }],
        schema: P.RESULT_SCHEMA, effort: 'medium', maxTokens: 6000,
      });
    } catch { /* 편지 생성 실패해도 결과는 확정되어 있다 */ }

    return {
      verdict: v, debrief: db, letter,
      aborted: this.aborted, abortReason: this.abortReason,
      state: this.state, difficulty: this.d, couple: this.couple,
      agent: this.agent, transcript,
    };
  }
}

// ── 준비 단계 반응 ────────────────────────────────────────
// 취조실(지침)과 정문(연설)에서 클라이언트가 실제로 어떤 표정을 짓는지 받아온다.
// 채점이 아니다. 요원이 써넣은 문장에 대한 유일한 피드백이고, 그 피드백은 점수가 아니라 사람의 반응이다.
export async function prepReaction(llm, { couple, agent, scene, text }) {
  return llm.call({
    label: scene === 'speech' ? '정문 반응' : '취조실 반응',
    system: P.prepReactSystem(couple, scene),
    messages: [{ role: 'user', content: P.prepReactUser(scene, text, agent) }],
    schema: P.PREP_REACT_SCHEMA, effort: 'low', maxTokens: 3000,
  });
}
