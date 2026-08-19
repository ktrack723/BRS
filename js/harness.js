// harness.js — 브라우저용 Claude LLM 하네스.
// 이 게임의 모든 로직은 이 하네스를 통과한다. API 키가 없으면 게임은 1도 안 돌아간다.

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

// effort 파라미터를 지원하지 않는 모델 (Haiku 4.5)
const NO_EFFORT_MODELS = new Set(['claude-haiku-4-5']);

const PRICES = { // $ per MTok (input, output)
  'claude-opus-5': [5, 25],
  'claude-sonnet-5': [3, 15],
  'claude-haiku-4-5': [1, 5],
};

export class RefusalError extends Error {
  constructor() { super('LLM이 이 요청을 정중히 거절했다'); this.name = 'RefusalError'; }
}

export class Harness {
  constructor() {
    this.apiKey = null;
    this.model = 'claude-opus-5';
    this.log = [];
    this.usage = { calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
    this.listeners = new Set();
  }

  onLog(fn) { this.listeners.add(fn); }
  #emit(entry) { for (const fn of this.listeners) { try { fn(entry, this.usage); } catch { /* UI 리스너 실패는 무시 */ } } }

  // 핵심 진입점. schema를 주면 구조화 JSON, 없으면 텍스트를 반환한다.
  async call({ label, system, messages, schema = null, effort = 'low', maxTokens = 8000 }) {
    if (!this.apiKey) throw new Error('API 키 없음: 하네스 미가동');
    const body = {
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages,
    };
    const outputConfig = {};
    if (!NO_EFFORT_MODELS.has(this.model)) outputConfig.effort = effort;
    if (schema) outputConfig.format = { type: 'json_schema', schema };
    if (Object.keys(outputConfig).length) body.output_config = outputConfig;

    const entry = { label, model: this.model, at: Date.now(), request: body, status: 'pending' };
    this.log.push(entry);
    this.#emit(entry);

    const started = performance.now();
    let lastErr = null;
    for (let attempt = 0; attempt <= 3; attempt++) {
      if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1) + Math.random() * 400);
      let res, data;
      try {
        res = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': API_VERSION,
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify(body),
        });
        data = await res.json();
      } catch (e) {
        lastErr = new Error(`통신 두절: ${e.message}`);
        continue; // 네트워크 오류는 재시도
      }

      if (!res.ok) {
        const type = data?.error?.type || `http_${res.status}`;
        const msg = data?.error?.message || res.statusText;
        if (res.status === 429 || res.status >= 500) { lastErr = new Error(`${type}: ${msg}`); continue; }
        entry.status = 'error'; entry.error = `${type}: ${msg}`; entry.ms = performance.now() - started;
        this.#emit(entry);
        if (res.status === 401) throw new Error('API 키가 틀렸다. 본부 인증 실패!');
        throw new Error(`${type}: ${msg}`);
      }

      // max_tokens에 잘리면 한 번만 더 크게 재시도
      if (data.stop_reason === 'max_tokens' && body.max_tokens < 32000) {
        body.max_tokens = Math.min(body.max_tokens * 3, 32000);
        lastErr = new Error('출력이 잘림 (max_tokens)');
        continue;
      }

      entry.ms = performance.now() - started;
      entry.response = data;
      this.usage.calls += 1;
      const u = data.usage || {};
      this.usage.inputTokens += u.input_tokens || 0;
      this.usage.outputTokens += u.output_tokens || 0;
      const p = PRICES[data.model] || PRICES[this.model] || [5, 25];
      this.usage.cost += ((u.input_tokens || 0) * p[0] + (u.output_tokens || 0) * p[1]) / 1e6;

      if (data.stop_reason === 'refusal') {
        entry.status = 'refusal'; this.#emit(entry);
        throw new RefusalError();
      }

      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
      if (schema) {
        try {
          const parsed = JSON.parse(text);
          entry.status = 'ok'; this.#emit(entry);
          return parsed;
        } catch {
          lastErr = new Error('JSON 파싱 실패'); continue;
        }
      }
      if (!text) { lastErr = new Error('빈 응답'); continue; }
      entry.status = 'ok'; this.#emit(entry);
      return text;
    }
    entry.status = 'error'; entry.error = lastErr?.message || '원인불명'; entry.ms = performance.now() - started;
    this.#emit(entry);
    throw lastErr || new Error('LLM 호출 실패');
  }

  // 부팅 시 키 검증용 초소형 호출
  async ping() {
    return this.call({
      label: '본부 인증',
      system: '한 단어로만 답하라.',
      messages: [{ role: 'user', content: '통신 상태 확인. "이상무"라고만 답하라.' }],
      maxTokens: 2000,
      effort: 'low',
    });
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
