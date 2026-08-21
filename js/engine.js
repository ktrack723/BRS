// engine.js — 공작 하네스. 클라이언트 · 타겟 · 심판을 물려 돌리고 scoring.js 규칙으로 상태를 갱신한다.
// DOM을 전혀 모른다 — UI와는 콜백으로만 통신한다.
//
// 구조 (합 단위 판정):
//   · 대화는 교환(내 발언 + 상대 반응) 단위로 흐르고, **채점은 합(bout) 단위**다.
//     교환이 BOUT.size만큼 쌓이면 심판을 부른다. 심판은 합 전체의 순이동을 등급 하나로 매기고,
//     꼬리가 새 국면을 열었으면 carry로 잘라 다음 합으로 넘긴다 — 합의 경계는 심판이 나눈다.
//   · 판정은 **완전 비동기**다. 대화는 심판을 한 순간도 기다리지 않는다 — 도착해 있는
//     판정만 교환 사이에 반영하고, 안 오면 페일세이프(타임아웃 → 중립)가 정산한다.
//     심판이 느리면 합이 그만큼 커질 뿐이다. 심판 호출은 합당 1회.
//   · 공기(텍스트 분위기)는 심판이 매 합 갱신하고, **양쪽 모두에게** 각자의 공기읽기(air)만큼 전달된다.
//   · 수치 분위기는 없다. 자리 파탄은 심판의 walkout 판단이다.
//   · 시스템 프롬프트는 바이트 동일 → 캐시 breakpoint로 입력 토큰을 재사용한다.

import * as P from './prompts.js';
import * as S from './scoring.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const HISTORY_WINDOW = 12;   // 심판에게 주는 '직전 맥락' 줄 수 상한
const CONTEXT_LINES = 4;     // 합 앞에 붙는 이미 채점된 맥락 줄 수
// 심판 페일세이프. 이 시간 안에 판정이 안 오면 중립 판정으로 대체하고 대화는 계속 간다.
// 대화가 심판을 기다리는 일은 없다 — 페이즈 정산에서도 이 상한까지만 기다린다.
const JUDGE_TIMEOUT_MS = 60000;

// 받침에 맞는 조사.
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

    this.paused = false;
    this.pendingRadio = null;
    this.keepLog = [];        // 합마다 심판이 답한 '더 갈 데 있나'
    this.tierLog = [];        // 심판이 매긴 합 등급 (분포 자기 점검용으로 되돌려준다)
    this.boutBuf = [];        // 아직 채점되지 않은 교환들 [{c, t}]
    this.pendingJudge = null; // 날아가 있는 심판 호출 {promise, exchanges, tag}
    // 공기는 읽을 줄 아는 쪽에게만, 갱신됐을 때만 간다. 양쪽 각자.
    this.vibeSent = { client: null, target: null };
    this.vibeBeats = { client: 0, target: 0 };
    this.radioLeft = 0;
    this.phase = 'text';
    this.phaseTurn = 0;
    this.phaseTurns = 0;
  }

  setPaused(v) { this.paused = !!v; }

  // 무전 송신. 채점하지 않는다 — 다음 발언에 주입되고, 효과는 대화로 드러난다.
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
    const turnsTotal = this.phaseTurns || (this.phase === 'text' ? this.d.textTurns : this.d.talkTurns);
    return {
      love: Math.round(s.love),
      threshold: this.d.threshold,
      loveSat: S.round1(S.loveSaturation(s.love)),
      radioLeft: this.radioLeft, radioUsed: s.radioUsed,
      revealed: [...s.revealed], revealedCount: s.revealed.length,
      secretTotal: t.prefs.filter(p => !p.open).length,
      secretLeft: S.surfacedSecrets(this.couple, this.#history(), s.revealed).missed.length,
      vibe: s.vibe,
      bouts: s.bouts, pendingExchanges: this.boutBuf.length,
      // 공기가 실제로 의뢰인에게 닿는가. 안 닿는 사람이 있다.
      air: this.couple.client.keys.air,
      turn: s.exchanges, phase: this.phase,
      turnsTotal, turnsLeft: Math.max(0, turnsTotal - this.phaseTurn),
    };
  }

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

  // 공기는 읽을 줄 아는 사람에게만 간다. "너는 눈치가 없다"는 지시는 안 먹고,
  // 정보를 아예 안 주는 건 먹는다(실측). 이제 양쪽 모두가 각자의 air를 갖는다.
  //   none: 평생 못 받는다 · some: 갱신 두 번에 한 번 · well: 바뀔 때마다
  #injectVibe(side) {
    const person = this.couple[side];
    const hist = side === 'client' ? this.clientHist : this.targetHist;
    const air = person.keys.air || 'well';
    if (air === 'none') return;
    const v = (this.state.vibe || '').trim();
    if (!v || v === this.vibeSent[side]) return;
    this.vibeBeats[side] += 1;
    if (air === 'some' && this.vibeBeats[side] % 2 === 0) return;
    this.vibeSent[side] = v;
    this.#pushUser(hist, `[THE AIR AT THIS TABLE RIGHT NOW] ${v}`);
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
    await this.#runExchanges('text');
    await this.#flushBout('text', { final: true });
    return !this.aborted;
  }

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
    this.phaseTurn = 0;
    this.phaseTurns = this.d.talkTurns;
    this.h.meters?.(this.snapshot());
    this.pendingRadio = null;

    this.transcript.push({ who: 'sys', text: `[${sit.place}] ${sit.intro}` });
    await this.h.bubble?.('sys', `[${sit.place}] ${sit.intro}`);
    this.transcript.push({ who: 'target', text: sit.outfitReaction });
    await this.h.bubble?.('target', sit.outfitReaction);

    if (this.aborted) return false;

    // 첫인상 판정 — 착장이 실제로 효력을 발휘하는 지점.
    let fi;
    try {
      fi = await this.llm.call({
        label: '첫인상 판정',
        system: P.judgeSystem(this.couple), cache: true,
        messages: [{ role: 'user', content: P.firstImpressionUser(this.couple, this.prep.outfitDesc, sit.outfitReaction, this.tierLog) }],
        schema: P.JUDGE_SCHEMA, effort: 'low', maxTokens: 3000,
      });
    } catch { fi = this.#neutralJudge('(첫인상 판정 불능)'); }
    await this.#applyJudge(fi, { firstImpression: true, exchanges: 0 });
    if (this.aborted) return false;

    // 대화 내역을 이어받는다. 두 사람은 방금 주고받은 문자를 기억한 채로 마주 앉는다.
    this.vibeSent = { client: null, target: null };
    this.#pushUser(this.clientHist,
      `[SCENE CHANGE] The texting worked and you are finally in front of them. Place: ${sit.place}. ${sit.intro}\n` +
      `The first thing ${c.target.name} said on seeing you: "${sit.outfitReaction}"\n` +
      `This is face to face now, not texting. Open with the first thing you say.`);
    this.#pushUser(this.targetHist,
      `[SCENE CHANGE] You came out to meet ${c.client.name} at ${sit.place}. ${sit.intro}\n` +
      `You just said something about the state of their outfit.`);
    this.targetHist.push({ role: 'assistant', content: sit.outfitReaction });

    this.h.phase?.({ phase: 'talk', turns: this.d.talkTurns, radioLeft: this.radioLeft, place: sit.place });
    await this.#runExchanges('talk');
    await this.#flushBout('talk', { final: true });
    return !this.aborted;
  }

  // 심판이 죽었을 때 쓰는 빈 판정. nudge다 — 점수 0이면서 어떤 규칙에도 안 세는 자리.
  // keepGoing은 일부러 뺀다 — API가 한 번 흔들린 걸로 자리가 늘거나 끊기면 그건 판정이 아니라 사고다.
  #neutralJudge(reason) {
    return {
      carry: 0, tier: 'nudge', loveDelta: 0, reason,
      vibe: this.state.vibe, revealed: '', clientEmote: 'talk', targetEmote: 'talk',
      casualty: 'none', casualtyNote: '', leverage: 'none', walkout: false,
    };
  }

  // 합 하나를 판정대에 올린다. 호출은 띄우기만 하고 절대 기다리지 않는다.
  #fireJudge(phase, { final = false } = {}) {
    if (!this.boutBuf.length) return;
    const c = this.couple;
    const bout = this.boutBuf;
    this.boutBuf = [];
    const boutLines = bout.flatMap(x => [
      ...(x.radio ? [`[HQ RADIO — the other person cannot hear this]: ${x.radio}`] : []),
      `${c.client.name}: ${x.c}`,
      `${c.target.name}: ${x.t}`,
    ]).join('\n');
    // #fireJudge는 pendingJudge가 없을 때만 불린다 — 다음 합 번호는 언제나 bouts+1이다.
    const tag = `${phase === 'text' ? '문자' : '대면'} ${this.state.bouts + 1}합`;
    const pj = { bout, tag, final, settled: false };
    const call = this.llm.call({
      label: `판정 ${tag}`, system: P.judgeSystem(this.couple), cache: true,
      messages: [{ role: 'user', content: P.judgeUser(this.#context(bout), boutLines, this.tierLog) }],
      schema: P.JUDGE_SCHEMA, effort: 'low', maxTokens: 3000,
    }).catch(() => this.#neutralJudge('(심판이 잠시 졸았다)'));
    // 페일세이프: 상한 안에 안 오면 중립 판정으로 정산한다. 늦게 도착한 진짜 판정은 버려진다 —
    // 판이 심판 사정으로 멈추는 것보다 합 하나가 0점으로 흘러가는 쪽이 낫다.
    // (Promise.race를 안 쓰는 이유: 판정이 먼저 와도 타이머가 살아남아 프로세스를 붙잡는다)
    pj.promise = new Promise(resolve => {
      const timer = setTimeout(() => resolve(this.#neutralJudge('(심판 응답 지연 — 중립 처리)')), JUDGE_TIMEOUT_MS);
      call.then(r => { clearTimeout(timer); resolve(r); });   // call은 catch가 붙어 있어 절대 reject하지 않는다
    }).then(r => { pj.settled = true; return r; });
    this.pendingJudge = pj;
  }

  // 합 직전의 '이미 채점된' 맥락 몇 줄.
  #context(bout) {
    const boutLineCount = bout.length * 2;
    const all = this.#history(HISTORY_WINDOW + boutLineCount).split('\n');
    return all.slice(0, Math.max(0, all.length - boutLineCount)).slice(-CONTEXT_LINES).join('\n');
  }

  // 정산 완료된 판정만 비차단으로 반영한다. 심판이 아직 날아 있으면 아무것도 기다리지 않는다.
  async #drainJudge() {
    if (!this.pendingJudge?.settled) return this.aborted;
    return this.#settleJudge();
  }

  // 날아가 있는 판정을 회수해 반영한다. carry는 버퍼 앞으로 되돌린다.
  // 대기가 필요한 자리(페이즈 정산)에서만 부른다 — 대기 상한은 fire 쪽 페일세이프가 지킨다.
  async #settleJudge() {
    const pj = this.pendingJudge;
    if (!pj) return this.aborted;
    this.pendingJudge = null;
    const judge = await pj.promise;
    // 심판이 꼬리를 다음 합으로 잘랐다 — 마지막 페이즈 정산이면 자를 다음이 없다.
    // 합 전체를 넘기려 들면(carry ≥ 합 크기) 무시한다 — 판정 없는 합이 생기면 안 된다.
    const carry = pj.final ? 0 : Math.max(0, Math.min(S.BOUT.carryMax, Math.round(judge.carry || 0)));
    const back = carry < pj.bout.length ? carry : 0;
    if (back > 0) this.boutBuf.unshift(...pj.bout.slice(-back));
    await this.#applyJudge(judge, { exchanges: pj.bout.length - back });
    return this.aborted;
  }

  // 판정 하나를 상태에 반영하고 UI에 알린다.
  async #applyJudge(judge, opts = {}) {
    // 사망 가드가 페이즈를 본다 — 문자로는 죽지 않는다.
    this.state = S.applyBout(this.state, this.d, judge, { ...opts, phase: this.phase });
    const dl = this.state.lastDelta;
    this.tierLog.push(dl.tier);
    if (!opts.firstImpression) {
      this.keepLog.push(typeof judge.keepGoing === 'boolean' ? judge.keepGoing : null);
    }
    const shown = this.h.judge?.({
      love: dl.love, rawLove: dl.rawLove, tier: dl.tier,
      reason: judge.reason || '', revealed: dl.revealed,
      ...(opts.firstImpression ? { firstImpression: true } : { bout: this.state.bouts }),
    });
    if (dl.revealed) this.h.intel?.({ text: dl.revealed, count: this.state.revealed.length });
    if (dl.vibe) this.h.vibe?.(dl.vibe);
    if (judge.clientEmote) this.h.emote?.('client', judge.clientEmote);
    if (judge.targetEmote) this.h.emote?.('target', judge.targetEmote);
    this.h.meters?.(this.snapshot());
    await shown;
    if (S.failureReason(this.state)) { await this.#breakdown(this.phase); return true; }
    return false;
  }

  async #breakdown(phase) {
    const cas = this.state.casualty;
    let msg;
    if (cas && cas !== 'none') {
      const c = this.couple;
      const who = cas === 'both' ? `${josa(c.client.name, '과')} ${josa(c.target.name, '이')} 둘 다`
        : josa(cas === 'client' ? c.client.name : c.target.name, '이');
      const note = this.state.casualtyNote ? ` ${this.state.casualtyNote}` : '';
      msg = `...${who} 사망했다.${note} 공작은 여기서 종료된다.`;
      this.abortReason = 'death';
    } else {
      msg = phase === 'text'
        ? '...읽씹당했다. 프로필 사진도 강아지로 바뀌었다.'
        : '...상대가 "화장실 좀"이라며 나가더니 돌아오지 않았다.';
      this.abortReason = 'walkout';
    }
    this.aborted = true;
    this.transcript.push({ who: 'sys', text: msg });
    await this.h.bubble?.('sys', msg);
  }

  // ── 교환 루프 ────────────────────────────────────────
  // 교환마다: [클라이언트 발언] → [타겟 응답 ∥ (합이 차 있으면) 직전 합 판정].
  // 합이 BOUT.size만큼 쌓이면 판정을 띄우고 계속 진행한다 — 반영은 다음 교환에서.
  async #runExchanges(phase) {
    const c = this.couple;
    const clientSystem = P.clientAgentSystem(c, this.prep, phase, this.agent);
    const targetSystem = P.targetAgentSystem(c, phase, this.prep.outfitDesc);
    const label = phase === 'text' ? '문자' : '대면';
    const said = phase === 'text' ? '문자' : '말';
    let extended = false;

    this.phaseTurn = 0;

    for (let i = 0; i < this.phaseTurns; i++) {
      await this.#gate();
      this.phaseTurn = i;

      // 직전 합에서 심판이 '더 갈 데 없다'고 했으면 자리를 접는다.
      if (i > 0 && S.cutShort(this.keepLog)) {
        const msg = phase === 'text'
          ? '(답장이 끊겼다. 둘 다 더 보낼 말이 없다.)'
          : '(할 말이 떨어졌다. 누가 먼저랄 것도 없이 일어난다.)';
        this.transcript.push({ who: 'sys', text: msg });
        await this.h.bubble?.('sys', msg);
        this.phaseTurns = i;
        break;
      }
      // 마지막 교환에 들어서는데 심판이 '아직 열려 있다'고 했으면 자리가 길어진다. 1회 한정.
      if (i === this.phaseTurns - 1 && !extended) {
        const extra = S.extraTurn(phase, this.keepLog, extended);
        if (extra > 0) {
          this.phaseTurns += extra; extended = true;
          const msg = phase === 'text'
            ? '(아직 할 말이 남았다. 둘 다 휴대폰을 놓지 않는다.)'
            : '(누구도 자리에서 일어나지 않는다. 얘기가 더 이어진다.)';
          this.transcript.push({ who: 'sys', text: msg });
          await this.h.bubble?.('sys', msg);
          this.h.extend?.({ phase, turns: this.phaseTurns, extra });
        }
      }

      await this.h.turn?.({ phase, turn: i + 1, turns: this.phaseTurns, turnsLeft: this.phaseTurns - i });
      await this.#gate();

      // 무전 지시 주입 (상대에게는 안 들린다)
      let radioThisTurn = null;
      if (this.pendingRadio) {
        this.#pushUser(this.clientHist,
          `[ORDER FROM HQ — carry this out with your very next line. The other person cannot hear it]\n` +
          `${this.pendingRadio}\n` +
          `Refusal is not available. Show that you hate it if you hate it, but do it.`);
        radioThisTurn = this.pendingRadio;
        this.pendingRadio = null;
      }
      // 갱신된 공기 주입 — 양쪽 각자, 각자의 공기읽기만큼
      this.#injectVibe('client');
      this.#injectVibe('target');

      // 1) 클라이언트 발언
      const clientMsg = await this.llm.call({
        label: `${label} 발언 ${i + 1}`,
        system: clientSystem, cache: true,
        messages: this.clientHist, effort: 'low', maxTokens: 3000,
      });
      this.clientHist.push({ role: 'assistant', content: clientMsg });
      this.transcript.push({ who: 'client', text: clientMsg });
      await this.h.bubble?.('client', clientMsg);

      // 2) 타겟 응답 — 심판은 뒤에서 알아서 날아온다
      this.#pushUser(this.targetHist, `[${c.client.name} — ${said}] ${clientMsg}`);
      const replyJob = this.llm.call({
        label: `${label} 응답 ${i + 1}`,
        system: targetSystem, cache: true,
        messages: this.targetHist, effort: 'low', maxTokens: 3000,
      }).catch(() => '...(상대가 답이 없다)');
      // 문자 마지막 교환이면 대면 상황 생성을 같은 배치에 태운다
      if (phase === 'text' && i === this.phaseTurns - 1) {
        this.situationPromise = this.#callSituation(this.#history(0, { noRadio: true }));
      }

      const targetMsg = await replyJob;
      // 판정은 절대 기다리지 않는다 — 이미 도착해 있는 것만 이 자리에서 반영한다.
      if (await this.#drainJudge()) return;

      // 3) 타겟 응답 반영
      this.targetHist.push({ role: 'assistant', content: targetMsg });
      this.transcript.push({ who: 'target', text: targetMsg });
      await this.h.bubble?.('target', targetMsg);
      this.#pushUser(this.clientHist, `[${c.target.name} — ${phase === 'text' ? '답장' : '말'}] ${targetMsg}`);

      // 4) 교환을 합 버퍼에 쌓고, 합이 찼으면 판정을 띄운다
      this.boutBuf.push({ c: clientMsg, t: targetMsg, radio: radioThisTurn });
      if (this.boutBuf.length >= S.BOUT.size && !this.pendingJudge) {
        this.#fireJudge(phase);
      }
      this.phaseTurn = i + 1;
    }
  }

  // 페이즈가 끝날 때 미결 판정과 잔여 교환을 전부 정산한다.
  async #flushBout(phase, { final = false } = {}) {
    if (await this.#settleJudge()) return;
    if (this.boutBuf.length && !this.aborted) {
      this.#fireJudge(phase, { final });
      await this.#settleJudge();
    }
  }

  // ── 정산 ─────────────────────────────────────────────
  async finish() {
    if (!this.aborted) await this.#flushBout(this.phase, { final: true });
    // 사망·자리이탈은 상태에 이미 새겨져 있어 verdict가 직접 읽는다.
    const v = S.verdict(this.state, this.d);
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
            ...v, threshold: this.d.threshold, aborted: this.aborted,
            abortReason: this.abortReason,
            casualty: this.state.casualty, casualtyNote: this.state.casualtyNote,
            leverage: this.state.leverage,
            vibe: this.state.vibe, revealed: this.state.revealed, missed: db.missed,
            radioUsed: this.state.radioUsed, transcript,
          }),
        }],
        schema: P.RESULT_SCHEMA, effort: 'medium', maxTokens: 6000,
      });
    } catch { /* 편지 실패해도 결과는 확정되어 있다 */ }

    return {
      verdict: v, debrief: db, letter,
      aborted: this.aborted, abortReason: this.abortReason,
      state: this.state, difficulty: this.d, couple: this.couple,
      agent: this.agent, transcript,
    };
  }
}

// ── 준비 단계 반응 ────────────────────────────────────────
export async function prepReaction(llm, { couple, agent, scene, text }) {
  return llm.call({
    label: scene === 'speech' ? '정문 반응' : '취조실 반응',
    system: P.prepReactSystem(couple, scene),
    messages: [{ role: 'user', content: P.prepReactUser(scene, text, agent) }],
    schema: P.PREP_REACT_SCHEMA, effort: 'low', maxTokens: 3000,
  });
}
