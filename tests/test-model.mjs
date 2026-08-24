// test-model.mjs — 테스트가 쓸 키와 모델을 한 곳에서 강제한다.
//
// 왜 강제하는가: 실측 결과 Opus 5로 밸런싱 한 라운드(20판)를 돌리면 $6.6가 나간다.
// Sonnet으로 내려도 12판에 $6.6였다. 개선안을 여섯 개 비교하려면 판수가 몇 배로 늘어난다.
// 테스트는 "규칙이 의도대로 갈리는가"를 보는 것이지 최고 품질의 연기를 보는 게 아니므로
// 최하위 등급으로 충분하다. 게임 본체(js/)의 기본 모델은 Opus 5 그대로 둔다 — 여긴 테스트 전용이다.
//
// ⚠ 주의: 절대 점수는 모델에 따라 달라진다. Haiku 실측치를 Sonnet 판의 성공선 근거로
//    쓰면 안 된다. Haiku로 보는 건 **같은 조건에서 A안과 B안 중 뭐가 더 잘 가르는가**다.
//
// 업자는 게임 본체와 똑같이 **키 접두사로** 정해진다(js/llm.js). 여기서 하는 일은
// 그 업자에서 쓸 싸구려 모델을 고르고, 비싼 걸 요청하면 막는 것뿐이다.
import { detectProvider, DEFAULT_PROVIDER } from '../js/llm.js';

export const TEST_MODEL = 'claude-haiku-4-5-20251001';

// 업자별 기본 테스트 모델과 허용 목록. 전부 각 업자의 최하위 등급이다.
const PER_PROVIDER = {
  anthropic: { model: TEST_MODEL, allowed: /^claude-(haiku|sonnet)-/ },
  openai: { model: 'gpt-5-nano', allowed: /^(gpt-5-(mini|nano)|gpt-4\.1-(mini|nano)|o4-mini|o3-mini)/ },
  openrouter: { model: 'anthropic/claude-haiku-4.5', allowed: /(haiku|sonnet|mini|nano|flash)/i },
};

// 환경변수는 업자별로 따로 받는다. 여러 개가 있으면 앞의 것이 이긴다.
const KEY_VARS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'LLM_API_KEY'];

/** 환경변수에서 키를 찾는다. 없으면 null. */
export function resolveTestKey(env = process.env) {
  for (const v of KEY_VARS) if (env[v]) return env[v].trim();
  return null;
}

/** 키를 못 찾으면 무엇을 넣어야 하는지 알려주고 종료한다. */
export function requireTestKey(env = process.env) {
  const key = resolveTestKey(env);
  if (key && detectProvider(key)) return key;
  console.error(key
    ? `\n✋ 키 형식을 못 알아본다: ${key.slice(0, 8)}...\n   sk-ant-(Anthropic) / sk-(OpenAI) / sk-or-(OpenRouter) 중 하나여야 한다.\n`
    : `\n✋ API 키 없음. ${KEY_VARS.join(' / ')} 중 하나를 넣어라.\n`);
  process.exit(1);
}

// 예산이 넉넉할 때만 쓰는 명시적 탈출구. 실수로 켜지지 않게 이름을 길게 뒀다.
export const OVERRIDE_FLAG = '--i-know-this-costs-real-money';

/**
 * 테스트가 쓸 모델을 확정한다.
 * @param {string|undefined} requested  --model= 로 들어온 값
 * @param {string[]} argv               process.argv (탈출구 플래그 탐지용)
 * @param {string|null} key             쓸 키 (업자 판별용). 없으면 환경변수에서 찾는다
 * @returns {string} 실제로 쓸 모델 id
 */
export function resolveTestModel(requested, argv = process.argv, key = resolveTestKey()) {
  const provider = detectProvider(key) || DEFAULT_PROVIDER;
  const spec = PER_PROVIDER[provider];
  const override = argv.includes(OVERRIDE_FLAG);
  if (!requested) return spec.model;
  if (spec.allowed.test(requested)) return requested;

  if (!override) {
    console.error(
      `\n✋ 테스트는 ${provider}의 하위 등급만 쓴다. 요청한 모델: ${requested}\n` +
      `   이유: Opus로 밸런싱 한 라운드가 $6.6다. 기본 크레딧으로 두 라운드를 못 버틴다.\n` +
      `   그래도 돌리려면: ${OVERRIDE_FLAG} 를 함께 넘겨라.\n`);
    process.exit(1);
  }
  console.warn(`\n⚠ 비싼 모델을 명시적으로 승인했다: ${requested} — 크레딧 소모에 주의하라.\n`);
  return requested;
}
