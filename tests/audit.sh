#!/usr/bin/env bash
# audit.sh — 「프롬프트 하이어아키」 구조도가 코드에 아직 살아 있는가.
#
#   npm run audit
#
# 기능 테스트(npm test)와 목적이 다르다. 여기서 보는 건 "그 구조가 아직 지켜지는가"다.
# 프롬프트 한 줄을 지웠는데 테스트가 안 깨지는 경우가 있다 — 그런 걸 잡으려고 둔다.
# 「폐지된 것」 절은 특히 지우지 마라. 그건 요청받은 게 아니라 **금지당한 것들**이다.
set +e
cd "$(dirname "$0")/.."
ok(){ printf '  ✅ %s\n' "$1"; }
no(){ printf '  ❌ %s\n' "$1"; }
chk(){ if eval "$2" >/dev/null 2>&1; then ok "$1"; else no "$1"; fi; }

echo "── 구조: 블록은 넷뿐이다 ──"
chk "프롬프트 빌더가 A · B-1 · B-2 · C 넷이다" "node -e \"import('./js/prompts.js').then(m=>{const s=Object.keys(m).filter(k=>k.endsWith('_SCHEMA')).sort();process.exit(JSON.stringify(s)===JSON.stringify(['EPILOGUE_SCHEMA','JUDGE_SCHEMA','STYLING_SCHEMA','TALK_SCHEMA'])?0:1)})\""
chk "게이지는 무드·러브 둘뿐이다" "node -e \"import('./js/points.js').then(m=>{const s=m.initialPoints();process.exit(('mood' in s)&&('love' in s)&&!('vibe' in s)&&!('leverage' in s)?0:1)})\""
chk "페이즈는 텍스팅·토킹 둘이다" "node -e \"import('./js/points.js').then(m=>process.exit(m.PHASES.map(p=>p.key).join()==='text,talk'?0:1))\""
chk "요원이 쓰는 곳은 셋이다 (스타일링·동기부여·코칭)" "grep -q \"orders: { styling: '', motivation: '', coaching: '' }\" js/game.js"

echo
echo "── S · 스크리닝: 여덟 항목이 전부고, 감춘 게 없다 ──"
chk "노출 목록의 원본이 prompts.js 한 곳이다" "grep -q 'export const SCREEN_FIELDS' js/prompts.js && grep -q 'P.SCREEN_FIELDS\[which\]' js/game.js"
chk "고객은 외모·성격·성장환경·반한 이유" "node -e \"import('./js/prompts.js').then(m=>process.exit(m.SCREEN_FIELDS.client.map(f=>f.key).join()==='look,personality,upbringing,fell'?0:1))\""
chk "타겟은 외모·성격·성장환경·취향" "node -e \"import('./js/prompts.js').then(m=>process.exit(m.SCREEN_FIELDS.target.map(f=>f.key).join()==='look,personality,upbringing,taste'?0:1))\""
chk "인물 스키마가 일곱 필드로 닫혀 있다 (노출 넷 + 이름·성별·조형)" "grep -q \"CLIENT_FIELDS = new Set(\\['name', 'gender', 'look', 'personality', 'upbringing', 'fell', 'spec'\\])\" js/couples.js"
chk "취향이 평평한 문자열 목록이다 (공개/미공개·지뢰 플래그 없음)" "node -e \"import('./js/couples.js').then(m=>process.exit(m.COUPLES.every(c=>c.target.taste.every(t=>typeof t==='string'))?0:1))\""

echo
echo "── A · 스타일링 / 동기부여 ──"
chk "스타일링은 외모만, 동기부여는 성격만 건드린다" "grep -q 'rewrites the client'\\''s \\*\\*외모\\*\\* and nothing else' js/prompts.js && grep -q 'rewrites the client'\\''s \\*\\*성격\\*\\* and nothing else' js/prompts.js"
chk "가위손은 거절하지 않는다" "grep -q 'Never refuse, never soften, never grade' js/prompts.js"
chk "출력은 수정된 외모·성격 둘 (+조형)" "node -e \"import('./js/prompts.js').then(m=>process.exit(Object.keys(m.STYLING_SCHEMA.properties).sort().join()==='look,personality,spec'?0:1))\""
chk "시공을 안 하면 테이블 값이 그대로 시트가 된다" "grep -q 'export function dressOf' js/engine.js"
chk "A는 타겟을 보지 않는다" "node -e \"import('./js/prompts.js').then(m=>process.exit(/타겟|target/i.test(m.STYLING_SYSTEM.split('[CONTENT')[0])?1:0))\""

echo
echo "── B · 텍스팅 & 토킹 ──"
chk "대화는 한 번의 호출이 양쪽 몫을 다 쓴다" "grep -q 'You write the conversation between these two people' js/prompts.js && grep -q '\\*\\*Both voices' js/prompts.js"
chk "대화 프롬프트에 흐름 지시가 없다 (시트와 코칭이 전부)" "! grep -qiE 'drop a hint|leak a clue|reveal something|must mention|should bring up' js/prompts.js"
chk "대화하는 쪽은 점수를 모른다" "node -e \"import('./js/prompts.js').then(async m=>{const c=(await import('./js/couples.js')).COUPLES[0];const s=m.talkSystem(c,{look:'x',personality:'y'},'z');process.exit(/러브 포인트|무드 포인트/.test(s)?1:0)})\""
chk "코칭은 고객에게만 간다 — 타겟은 못 듣는다" "grep -q 'never heard a word of it' js/prompts.js"
chk "코칭이 비면 그 사실이 그대로 전달된다" "node -e \"import('./js/prompts.js').then(async m=>{const c=(await import('./js/couples.js')).COUPLES[0];process.exit(/없음/.test(m.talkSystem(c,{look:'x',personality:'y'},''))?0:1)})\""
chk "system은 판 내내 동일하다 (캐시 breakpoint가 붙는 자리)" "grep -q 'this.talkSys = P.talkSystem' js/engine.js && grep -q 'system: this.talkSys, cache: true' js/engine.js"

echo
echo "── B-2 · 판정: 내보내는 건 증감 여부뿐이다 ──"
chk "출력이 mood·love 둘뿐이다" "node -e \"import('./js/prompts.js').then(m=>process.exit(Object.keys(m.JUDGE_SCHEMA.properties).sort().join()==='love,mood'?0:1))\""
chk "값은 up/down/same 셋뿐이다" "node -e \"import('./js/prompts.js').then(m=>process.exit(m.JUDGE_SCHEMA.properties.love.enum.join()==='up,down,same'?0:1))\""
chk "폭은 코드가 정한다" "grep -q 'moodStep' js/points.js && grep -q 'loveStep' js/points.js"
chk "심판은 타겟의 눈 뒤에서만 본다" "grep -q \"behind \\\${t.name}'s eyes\" js/prompts.js && grep -q 'Fairness is not your job' js/prompts.js"
chk "러브의 기준선이 same — 회사원 예시" "grep -q 'office worker' js/prompts.js && grep -q 'base rate for two people talking is same' js/prompts.js"
chk "무드와 러브를 따로 읽으라고 못박는다" "grep -q 'Read them separately, every time' js/prompts.js"
chk "심판은 코칭도 고객 성격도 못 본다 (규칙: 요원이 쓴 글은 채점되지 않는다)" "node -e \"import('./js/prompts.js').then(async m=>{const c=(await import('./js/couples.js')).COUPLES[0];const s=m.judgeSystem(c,{look:'LOOK표식',personality:'PERS표식'});process.exit(s.includes('PERS표식')||!s.includes('LOOK표식')?1:0)})\""
chk "무드가 0이면 자리가 깨진다" "grep -q 'isBroken' js/engine.js && grep -q 'broken: mood <= POINTS.min' js/points.js"

echo
echo "── C · 후일담: 성사 여부를 정하는 건 러브 포인트다 ──"
chk "출력이 성사 여부와 후일담 텍스트 둘이다" "node -e \"import('./js/prompts.js').then(m=>process.exit(Object.keys(m.EPILOGUE_SCHEMA.properties).sort().join()==='epilogue,success'?0:1))\""
chk "러브 포인트를 먼저 보고 대화를 나중에 본다" "grep -q 'Decide from that' js/prompts.js && grep -q 'Never overturn a' js/prompts.js"
chk "C는 두 성격만 받는다 — 외모도 취향도 안 받는다" "node -e \"import('./js/prompts.js').then(async m=>{const c=(await import('./js/couples.js')).COUPLES[0];const s=m.epilogueSystem(c,{look:'LOOK표식',personality:'PERS표식'});process.exit(s.includes('LOOK표식')||!s.includes('PERS표식')?1:0)})\""
chk "성사 문턱이 코드에 없다" "! grep -qE 'threshold|성공선' js/points.js js/engine.js"

echo
echo "── 폐지된 것 (되살리면 실패한다) ──"
# 주석은 보지 않는다. "이건 폐지됐다"고 적어둔 문장까지 걸리면 기록을 못 남긴다.
# 여기서 잡으려는 건 **코드로 되살아난 것**이다.
code(){ cat js/*.js | grep -vE '^[[:space:]]*(//|\*|/\*)'; }
gone(){ if code | grep -qiE "$2"; then no "$1"; else ok "$1"; fi; }
gone "무전이 없다" 'radio|무전|submitRadio'
gone "지뢰·미공개 성향이 없다" '지뢰|hiddenPrefs|dossierPrefs|open: (true|false)'
gone "공기(vibe)가 없다" 'vibe'
gone "합(bout)·carry·첫인상 판정이 없다" 'BOUT\.|carryMax|firstImpression|applyBout'
gone "등급·티어·호감 포화가 없다" 'TIER_BANDS|loveSaturation|gainScale|lossCushion|flutterRepeat'
gone "강압·사망·자리이탈 판정이 없다" 'leverage|casualty|walkout|coerce'
gone "난이도가 없다" 'DIFFICULTIES|diffOf|difficulty'
gone "새로 드러난 것(revealed)·비밀 집계가 없다" 'revealed|surfacedSecrets|secretLeft'
gone "어긋남·상대관심·공기읽기·명령수용 키워드가 없다" 'wreck:|keys\.wreck|WRECK_|keyReport|KEY_LABELS|interest:|comply:'
chk "규칙 계층(scoring.js)이 통째로 사라졌다 — points.js가 대신한다" "test ! -f js/scoring.js && test -f js/points.js"
chk "준비 3화면(미용실·취조실·정문)이 없다" "! grep -qE 'screen-salon|screen-interro|screen-gate|prepReaction' js/*.js index.html"
chk "대면 상황 생성(situation)이 없다" "! grep -qE 'situationSystem|SITUATION_SCHEMA|runTalking' js/*.js"

echo
echo "── 세계관·수위 (압축에서 손실 금지) ──"
chk "세계관 한 벌만 있고 넷이 공유한다" "grep -c 'export const WORLD' js/prompts.js | grep -q '^1$'"
chk "수위 허가서가 살아 있다 (성인 B급, 미화 금지)" "grep -q 'DO NOT SANITIZE' js/prompts.js && grep -q 'THESE PEOPLE HAVE BODIES' js/prompts.js"
chk "금지선 한 줄이 살아 있다 (실존 인물·미성년 금지)" "grep -q 'THE ONE LINE' js/prompts.js && grep -q 'could read as a minor' js/prompts.js"
chk "출력 언어 고정이 블록마다 반복된다" "test \$(grep -c '\${KO}' js/prompts.js) -ge 4"
chk "지시는 영어, 출력은 한국어" "grep -q 'Instructions are English. Output is Korean' js/prompts.js"

echo
echo "── 화면이 구조도를 그대로 그리는가 ──"
chk "색 규약이 구조도 범례와 같다 (static·user·cached·once·code)" "grep -q -- '--tone-static' css/style.css && grep -q -- '--tone-cached' css/style.css && grep -q -- '--tone-once' css/style.css"
chk "A·B 화면에 데이터 흐름 띠가 있다" "grep -c 'flow-diagram' index.html | grep -q '^2$'"
chk "판정 원장에 증감 기호만 뜬다" "grep -q 'MARK\\[v.dMood\\]' js/game.js && ! grep -q 'judge-line' js/game.js"
chk "계기판에 게이지가 둘뿐이다" "grep -c 'class=\"meter\"' index.html | grep -q '^2$'"
chk "스크리닝 상세가 여덟 항목을 그린다" "grep -q 'fieldRows(c.client, .client.)' js/game.js && grep -q 'fieldRows(c.target, .target.)' js/game.js"
