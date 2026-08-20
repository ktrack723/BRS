// llm.js — Claude Messages API의 브라우저용 클라이언트 래퍼.
// 역할은 여기까지다: 요청 전송, 프롬프트 캐싱, 재시도/백오프, 구조화 출력 파싱, 거절 처리, 사용량 집계, 호출 로그.
// 에이전트를 턴마다 물려 돌리는 '하네스'는 engine.js다.

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

// effort 파라미터를 지원하지 않는 모델.
// **접두사로 본다** — 실제 id에는 날짜가 붙는다(claude-haiku-4-5-20251001).
// 정확 일치로 두면 그 날짜 붙은 id가 안 걸려서 전 호출이 invalid_request_error로 죽는다.
const NO_EFFORT_PREFIXES = ['claude-haiku-'];
export const supportsEffort = (m) => !NO_EFFORT_PREFIXES.some(p => String(m || '').startsWith(p));

const PRICES = { // $ per MTok (input, output)
  'claude-opus-5': [5, 25],
  'claude-sonnet-5': [3, 15],
  'claude-haiku-4-5': [1, 5],
};
const CACHE_WRITE_MULT = 1.25;  // 캐시 기록은 입력 단가의 1.25배
const CACHE_READ_MULT = 0.1;    // 캐시 적중은 0.1배

// 구조화 출력(output_config.format.schema)이 받지 않는 JSON Schema 키워드.
// 하나라도 섞이면 400 invalid_request_error가 나면서 그 화면이 통째로 멈춘다
// (예: "For 'array' type, property 'maxItems' is not supported").
// 스키마 쪽에서 안 쓰는 게 원칙이지만, 하나 흘러들었다고 게임이 서면 안 되니 보내기 직전에 걷어낸다.
// 개수·길이 상한 같은 건 프롬프트로 지시하고 실제 강제는 파싱 후 sanitize 단계가 한다.
const UNSUPPORTED_SCHEMA_KEYS = new Set([
  'maxItems', 'minItems', 'uniqueItems', 'contains', 'maxContains', 'minContains',
  'maxLength', 'minLength', 'pattern', 'format',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  'maxProperties', 'minProperties', 'patternProperties', 'propertyNames',
  'default', 'examples', 'deprecated', 'readOnly', 'writeOnly',
]);

// properties / $defs 아래의 키는 키워드가 아니라 '필드 이름'이다.
// 하필 이름이 format이나 pattern인 필드를 지우면 안 되니, 이 자리에서는 걸러내지 않는다.
const SCHEMA_NAME_MAPS = new Set(['properties', '$defs', 'definitions']);

// 스키마를 재귀로 훑어 지원되지 않는 키워드만 제거한 사본을 만든다. 원본은 건드리지 않는다.
export function stripUnsupportedSchemaKeys(node) {
  if (Array.isArray(node)) return node.map(n => stripUnsupportedSchemaKeys(n));
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (UNSUPPORTED_SCHEMA_KEYS.has(k)) continue;
    if (SCHEMA_NAME_MAPS.has(k) && v && typeof v === 'object' && !Array.isArray(v)) {
      const inner = {};
      for (const [name, sub] of Object.entries(v)) inner[name] = stripUnsupportedSchemaKeys(sub);
      out[k] = inner;
      continue;
    }
    out[k] = stripUnsupportedSchemaKeys(v);
  }
  return out;
}

export class RefusalError extends Error {
  constructor(msg) { super(msg || 'LLM이 이 요청을 정중히 거절했다'); this.name = 'RefusalError'; }
}

export class LlmClient {
  constructor() {
    this.apiKey = null;
    this.model = 'claude-opus-5';
    this.log = [];
    this.usage = { calls: 0, inputTokens: 0, outputTokens: 0, cacheWrite: 0, cacheRead: 0, cost: 0, saved: 0 };
    this.listeners = new Set();
    this.maxLog = 80;
  }

  onLog(fn) { this.listeners.add(fn); }
  #emit(entry) { for (const fn of this.listeners) { try { fn(entry, this.usage); } catch { /* UI 리스너 실패는 무시 */ } } }

  // system을 캐시 가능한 블록 배열로. 시스템 프롬프트는 턴마다 바이트 단위로 동일해야 캐시가 붙는다.
  #systemBlocks(system, cache) {
    if (!system) return undefined;
    const block = { type: 'text', text: system };
    if (cache) block.cache_control = { type: 'ephemeral' };
    return [block];
  }

  // 핵심 진입점. schema를 주면 구조화 JSON, 없으면 텍스트를 반환한다.
  //   cache=true  → system 블록에 캐시 breakpoint를 건다 (턴마다 재사용되는 에이전트용)
  //   model       → 이 호출만 다른 모델로 (심판처럼 기계적인 판정을 싸게 돌릴 때)
  async call({ label, system, messages, schema = null, effort = 'low', maxTokens = 4000, cache = false, model = null }) {
    if (!this.apiKey) throw new Error('API 키 없음: 하네스 미가동');
    const useModel = model || this.model;
    const body = {
      model: useModel,
      max_tokens: maxTokens,
      messages,
    };
    const sys = this.#systemBlocks(system, cache);
    if (sys) body.system = sys;

    const outputConfig = {};
    if (supportsEffort(useModel)) outputConfig.effort = effort;
    if (schema) outputConfig.format = { type: 'json_schema', schema: stripUnsupportedSchemaKeys(schema) };
    if (Object.keys(outputConfig).length) body.output_config = outputConfig;

    const entry = { label, model: useModel, at: Date.now(), request: body, status: 'pending' };
    this.log.push(entry);
    while (this.log.length > this.maxLog) this.log.shift();
    this.#emit(entry);

    const started = now();
    let lastErr = null;
    for (let attempt = 0; attempt <= 3; attempt++) {
      if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1) + Math.random() * 400);
      let res;
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
      } catch (e) {
        lastErr = new Error(`통신 두절: ${e.message}`);
        continue; // 네트워크 오류는 재시도
      }
      let data = null;
      try { data = await res.json(); } catch { /* 게이트웨이가 비JSON을 뱉는 경우 — 상태코드로 판단 */ }

      if (!res.ok) {
        const type = data?.error?.type || `http_${res.status}`;
        const msg = data?.error?.message || res.statusText || '본문 없음';
        if (res.status === 429 || res.status >= 500) { lastErr = new Error(`${type}: ${msg}`); continue; }
        entry.status = 'error'; entry.error = `${type}: ${msg}`; entry.ms = now() - started;
        this.#emit(entry);
        if (res.status === 401) throw new Error('API 키가 틀렸다. 본부 인증 실패!');
        throw new Error(`${type}: ${msg}`);
      }
      if (!data) { lastErr = new Error('응답 본문 파싱 불가'); continue; }

      // 사용량은 재시도되는 호출까지 전부 집계한다 (실제 과금 기준)
      entry.ms = now() - started;
      entry.response = data;
      this.#account(data, useModel);

      // max_tokens에 잘리면 상한을 키워 재시도
      if (data.stop_reason === 'max_tokens' && body.max_tokens < 32000) {
        body.max_tokens = Math.min(body.max_tokens * 3, 32000);
        lastErr = new Error('출력이 잘림 (max_tokens)');
        continue;
      }
      if (data.stop_reason === 'refusal') {
        entry.status = 'refusal'; this.#emit(entry);
        throw new RefusalError(data.stop_details?.explanation);
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
    entry.status = 'error'; entry.error = lastErr?.message || '원인불명'; entry.ms = now() - started;
    this.#emit(entry);
    throw lastErr || new Error('LLM 호출 실패');
  }

  #account(data, useModel) {
    const u = data.usage || {};
    const inTok = u.input_tokens || 0;
    const outTok = u.output_tokens || 0;
    const cw = u.cache_creation_input_tokens || 0;
    const cr = u.cache_read_input_tokens || 0;
    const p = PRICES[data.model] || PRICES[useModel] || [5, 25];

    this.usage.calls += 1;
    this.usage.inputTokens += inTok;
    this.usage.outputTokens += outTok;
    this.usage.cacheWrite += cw;
    this.usage.cacheRead += cr;
    this.usage.cost += (inTok * p[0] + outTok * p[1] + cw * p[0] * CACHE_WRITE_MULT + cr * p[0] * CACHE_READ_MULT) / 1e6;
    // 캐시가 없었다면 정가로 냈을 금액과의 차액 (콘솔에 절감액으로 표시)
    this.usage.saved += (cr * p[0] * (1 - CACHE_READ_MULT) - cw * p[0] * (CACHE_WRITE_MULT - 1)) / 1e6;
  }

  // 부팅 시 키 검증용 초소형 호출
  async ping() {
    return this.call({
      label: '본부 인증',
      system: '한 단어로만 답하라.',
      messages: [{ role: 'user', content: '통신 상태 확인. "이상무"라고만 답하라.' }],
      maxTokens: 1000, effort: 'low',
    });
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
