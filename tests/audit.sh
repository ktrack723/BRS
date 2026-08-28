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
bad=0
ok(){ printf '  ✅ %s\n' "$1"; }
no(){ printf '  ❌ %s\n' "$1"; bad=$((bad + 1)); }
chk(){ if eval "$2" >/dev/null 2>&1; then ok "$1"; else no "$1"; fi; }

echo "── 구조: 데이터 블록은 넷뿐이다 (그리고 데이터가 아닌 반응 하나) ──"
chk "프롬프트 빌더가 A-1 · A-2 · B-1 · B-2 · C + R 여섯이다" "node -e \"import('./js/prompts.js').then(m=>{const s=Object.keys(m).filter(k=>k.endsWith('_SCHEMA')).sort();process.exit(JSON.stringify(s)===JSON.stringify(['EPILOGUE_SCHEMA','JUDGE_SCHEMA','MOTIVATION_SCHEMA','REACT_SCHEMA','STYLING_SCHEMA','TALK_SCHEMA'])?0:1)})\""
chk "R의 출력은 대사·표정 둘뿐이다 — 점수도 판정도 없다" "node -e \"import('./js/prompts.js').then(m=>process.exit(Object.keys(m.REACT_SCHEMA.properties).sort().join()==='face,reaction'?0:1))\""
chk "반응은 어디로도 흘러가지 않는다 (엔진도 점수도 모른다)" "! grep -qiE 'reaction' js/engine.js js/points.js"
chk "반응 문장이 엔진으로 넘어가지 않는다" "! grep -A3 -E 'new Engine[(]' js/game.js | grep -qi 'reaction'"
chk "반응을 받는 프롬프트 빌더는 R뿐이다" "node -e \"import('./js/prompts.js').then(m=>process.exit(['clientSystem','targetSystem','judgeSystem','epilogueSystem','stylingUser','motivationUser'].filter(k=>/reaction/i.test(String(m[k]))).length?1:0))\""
chk "게이지는 무드·러브 둘뿐이다" "node -e \"import('./js/points.js').then(m=>{const s=m.initialPoints();process.exit(('mood' in s)&&('love' in s)&&!('vibe' in s)&&!('leverage' in s)?0:1)})\""
chk "페이즈는 텍스팅·토킹 둘이다" "node -e \"import('./js/points.js').then(m=>process.exit(m.PHASES.map(p=>p.key).join()==='text,talk'?0:1))\""
chk "출격 전 요원이 쓰는 곳은 셋이다 (스타일링·동기부여·코칭)" "grep -q \"orders: { styling: '', motivation: '', coaching: '' }\" js/game.js"
chk "판 도중 쓰는 곳은 무전 하나다" "node -e \"import('./js/points.js').then(m=>process.exit(Object.keys(m.RADIO).join()==='perPhase'?0:1))\""

echo
echo "── S · 스크리닝: 일곱 항목이 전부고, 감춘 게 없다 ──"
chk "노출 목록의 원본이 prompts.js 한 곳이다" "grep -q 'export const SCREEN_FIELDS' js/prompts.js && grep -q 'P.SCREEN_FIELDS\[which\]' js/game.js"
chk "노출 목록이 화면 라벨과 프롬프트 라벨을 **다르게** 들고 있다" "node -e \"import('./js/prompts.js').then(m=>process.exit([...m.SCREEN_FIELDS.client,...m.SCREEN_FIELDS.target].every(f=>f.label&&f.en&&f.label!==f.en&&!/[\\\\u1100-\\\\u11ff\\\\u3130-\\\\u318f\\\\ua960-\\\\ua97f\\\\uac00-\\\\ud7ff\\\\uffa0-\\\\uffdc]/.test(f.en))?0:1))\""
chk "고객은 외모·성격·성장환경 셋뿐 — 반한 이유는 폐지" "node -e \"import('./js/prompts.js').then(m=>process.exit(m.SCREEN_FIELDS.client.map(f=>f.key).join()==='look,personality,upbringing'?0:1))\""
chk "타겟은 외모·성격·성장환경·취향" "node -e \"import('./js/prompts.js').then(m=>process.exit(m.SCREEN_FIELDS.target.map(f=>f.key).join()==='look,personality,upbringing,taste'?0:1))\""
chk "인물 스키마가 여섯 필드로 닫혀 있다 (노출 셋 + 이름·성별·조형)" "grep -q \"CLIENT_FIELDS = new Set(\\['name', 'gender', 'look', 'personality', 'upbringing', 'spec'\\])\" js/couples.js"
chk "반한 이유가 프롬프트 계층에서 사라졌다" "! grep -q 'fell' js/prompts.js"
chk "취향이 평평한 문자열 목록이다 (공개/미공개·지뢰 플래그 없음)" "node -e \"import('./js/couples.js').then(m=>process.exit(m.COUPLES.every(c=>c.target.taste.every(t=>typeof t==='string'))?0:1))\""

echo
echo "── A · 스타일링 / 동기부여 ──"
chk "미용실은 외모만, 취조실은 성격만 건드린다" "node -e \"import('./js/prompts.js').then(m=>{const L=/rewrites the client.s [*][*]look[*][*] and nothing else/,P=/rewrites the client.s [*][*]personality[*][*] and nothing else/;process.exit(L.test(m.STYLING_SYSTEM)&&P.test(m.MOTIVATION_SYSTEM)&&!P.test(m.STYLING_SYSTEM)&&!L.test(m.MOTIVATION_SYSTEM)?0:1)})\""
chk "가위손은 거절하지 않는다" "grep -q 'Never refuse, never soften, never grade' js/prompts.js"
chk "A-1의 출력은 외모 하나 (+조형)" "node -e \"import('./js/prompts.js').then(m=>process.exit(Object.keys(m.STYLING_SCHEMA.properties).sort().join()==='look,spec'?0:1))\""
chk "A-2의 출력은 성격 하나뿐이다" "node -e \"import('./js/prompts.js').then(m=>process.exit(Object.keys(m.MOTIVATION_SCHEMA.properties).sort().join()==='personality'?0:1))\""
chk "미용실은 성격을 안 본다" "node -e \"import('./js/prompts.js').then(async m=>{const c=(await import('./js/couples.js')).COUPLES[0];const s=m.STYLING_SYSTEM+m.stylingUser(c,{species:'human'},'x');process.exit(s.includes(c.client.personality[0])?1:0)})\""
chk "취조실은 외모도 조형도 안 본다" "node -e \"import('./js/prompts.js').then(async m=>{const c=(await import('./js/couples.js')).COUPLES[0];const s=m.MOTIVATION_SYSTEM+m.motivationUser(c,'x');process.exit(s.includes(c.client.look[0])||/AVATAR SPEC/.test(s)?1:0)})\""
chk "시공을 안 하면 테이블 값이 그대로 시트가 된다" "grep -q 'export function dressOf' js/engine.js"
chk "A는 타겟을 보지 않는다 (system도 user도)" "node -e \"import('./js/prompts.js').then(async m=>{const c=(await import('./js/couples.js')).COUPLES[0];const a=m.STYLING_SYSTEM+m.stylingUser(c,{species:'human'},'x')+m.MOTIVATION_SYSTEM+m.motivationUser(c,'y');process.exit(/타겟|target/i.test(a.split(m.WORLD).join(''))?1:0)})\""

echo
echo "── B · 텍스팅 & 토킹 ──"
chk "대화는 배우 둘이 각자 제 시점에서 한 줄씩 쓴다" "node -e \"import('./js/prompts.js').then(async m=>{const c=(await import('./js/couples.js')).COUPLES[0];const d={look:'x',personality:'y'};const cs=m.clientSystem(c,d,''),ts=m.targetSystem(c);const leak=cs.includes(c.target.taste[0])||cs.includes(c.target.personality[0])||ts.includes(c.client.personality[0]);const one=Object.keys(m.TALK_SCHEMA.properties).join()==='text';process.exit(!leak&&one?0:1)})\""
chk "대화 프롬프트에 흐름 지시가 없다 (시트와 코칭이 전부)" "! grep -qiE 'drop a hint|leak a clue|reveal something|must mention|should bring up' js/prompts.js"
chk "대화하는 쪽은 점수를 모른다 (한글 표기도 영어 표기도)" "node -e \"import('./js/prompts.js').then(async m=>{const c=(await import('./js/couples.js')).COUPLES[0];const s=m.clientSystem(c,{look:'x',personality:'y'},'z')+m.targetSystem(c);process.exit(/러브 포인트|무드 포인트|\\\\blove\\\\b|\\\\bmood\\\\b|love[- ]point|mood[- ]point/i.test(s)?1:0)})\""
chk "코칭은 고객에게만 간다 — 타겟은 못 듣는다" "grep -q 'never heard' js/prompts.js && grep -q 'must never react as if they had' js/prompts.js"
chk "코칭이 비면 그 사실이 그대로 전달된다" "node -e \"import('./js/prompts.js').then(async m=>{const c=(await import('./js/couples.js')).COUPLES[0];process.exit(/[(]none — nobody briefed you/.test(m.clientSystem(c,{look:'x',personality:'y'},''))?0:1)})\""
chk "system은 판 내내 동일하다 (캐시 breakpoint가 붙는 자리)" "grep -q 'client: P.clientSystem' js/engine.js && grep -q 'target: P.targetSystem' js/engine.js && grep -q 'system: this.sys\[side\], cache: true' js/engine.js"

echo
echo "── B · 무전: 페이즈마다 한 번, 반드시 이행된다 ──"
chk "배급은 페이즈당 1회다" "node -e \"import('./js/points.js').then(m=>process.exit(m.RADIO.perPhase===1?0:1))\""
chk "무전은 조언이 아니라 명령이다" "grep -q 'Not advice, not a suggestion, not an option' js/prompts.js"
chk "명령받았다고 고객이 유능해지진 않는다" "grep -q 'does not make you good at it' js/prompts.js"
chk "고객에게 거부·보류·희석의 여지가 없다" "grep -q 'Refusing, ignoring, postponing, or watering it down is not available' js/prompts.js"
chk "바로 다음 대사부터 이행한다" "grep -q 'starting with your very next line' js/prompts.js"
chk "타겟은 무전을 못 듣는다 (코칭과 같은 자리다)" "grep -q 'They heard nothing' js/prompts.js"
chk "무전은 system이 아니라 messages에 실린다 (캐시가 안 깨진다)" "node -e \"import('./js/prompts.js').then(async m=>{const c=(await import('./js/couples.js')).COUPLES[0];const d={look:'x',personality:'y'};const s=m.clientSystem(c,d,'코칭');const u=m.actorUser(c,{side:'client',radio:'무전표식'});const t=m.actorUser(c,{side:'target',radio:'무전표식'});process.exit(u.includes('무전표식')&&!s.includes('무전표식')&&!t.includes('무전표식')?0:1)})\""
chk "무전은 판정에도 후일담에도 안 실린다" "node -e \"import('./js/prompts.js').then(async m=>{const c=(await import('./js/couples.js')).COUPLES[0];const d={look:'x',personality:'y'};const j=m.judgeSystem(c,d)+m.judgeUser(c,'a','b');const e=m.epilogueSystem(c,d)+m.epilogueUser(c,10,'t');process.exit(!/HQ RADIO|무전/.test(j+e)?0:1)})\""
chk "무전 문장은 대화 기록에 안 남는다 (원장은 따로 든다)" "grep -q 'radioLog' js/engine.js && ! grep -qE \"transcript.push\\(\\{ *who: *'radio'\" js/engine.js"
chk "누르면 대화가 선다 (게이트가 줄 경계와 구간 경계에 있다)" "grep -q 'await this.#gate(.line.)' js/engine.js && grep -q 'await this.#gate(.beat.)' js/engine.js"
chk "명령은 바로 다음 줄에 실린다 (버릴 대사도 재판정도 없다)" "grep -q '잘라낼 것이 없다' js/engine.js && ! grep -q '재판정' js/engine.js"
chk "화면에 무전 버튼과 회선이 있다" "grep -q 'id=\"btn-radio\"' index.html && grep -q 'id=\"radio-panel\"' index.html"

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
# 무전만 이 목록에서 빠졌다. 명시적으로 되살려 달라고 요청받았고, 배급이 다르다
# (옛것 3회 상시 → 지금 페이즈당 1회). 대신 위의 「B · 무전」 절이 그 규칙을 지킨다.
code(){ cat js/*.js | grep -vE '^[[:space:]]*(//|\*|/\*)'; }
gone(){ if code | grep -qiE "$2"; then no "$1"; else ok "$1"; fi; }
gone "지뢰·미공개 성향이 없다" '지뢰|hiddenPrefs|dossierPrefs|open: (true|false)'
gone "공기(vibe)가 없다" 'vibe'
gone "합(bout)·carry·첫인상 판정이 없다" 'BOUT\.|carryMax|firstImpression|applyBout'
gone "등급·티어·호감 포화가 없다" 'TIER_BANDS|loveSaturation|gainScale|lossCushion|flutterRepeat'
gone "강압·사망·자리이탈 판정이 없다" 'leverage|casualty|walkout|coerce'
gone "난이도가 없다" 'DIFFICULTIES|diffOf|difficulty'
gone "새로 드러난 것(revealed)·비밀 집계가 없다" 'revealed|surfacedSecrets|secretLeft'
gone "어긋남·상대관심·공기읽기·명령수용 키워드가 없다" 'wreck:|keys\.wreck|WRECK_|keyReport|KEY_LABELS|interest:|comply:'
chk "규칙 계층(scoring.js)이 통째로 사라졌다 — points.js가 대신한다" "test ! -f js/scoring.js && test -f js/points.js"
# 미용실·취조실은 지시로 되살아났다. 금지선은 **정문 배웅** 하나로 좁힌다.
chk "화면은 여덟, 그 여덟뿐이다 (정문 배웅이 낄 자리가 없다)" "node -e \"const s=require('fs').readFileSync('index.html','utf8');const got=[...s.matchAll(/id=.screen-([a-z]+)./g)].map(m=>m[1]).sort().join();process.exit(got==='boot,chat,coaching,intro,motivation,result,roster,styling'?0:1)\""
chk "배웅 어휘가 코드에 없다" "! grep -qiE 'screen-gate|정문 계단|배웅|farewell|send-?off' js/game.js js/prompts.js js/engine.js index.html css/style.css"
chk "대면 상황 생성(situation)이 없다" "! grep -qE 'situationSystem|SITUATION_SCHEMA|runTalking' js/*.js"

echo
echo "── 세계관·수위 (압축에서 손실 금지) ──"
chk "세계관 한 벌만 있고 넷이 공유한다" "grep -c 'export const WORLD' js/prompts.js | grep -q '^1$'"
chk "수위 허가서가 살아 있다 (성인 B급, 미화 금지)" "grep -q 'DO NOT SANITIZE' js/prompts.js && grep -q 'sexual jokes and plain crude phrasing' js/prompts.js"
chk "금지선 한 줄이 살아 있다 (실존 인물·미성년 금지)" "grep -q 'THE ONE LINE' js/prompts.js && grep -q 'could read as a minor' js/prompts.js"
chk "출력 언어 고정이 블록마다 반복된다" "test \$(grep -c '\${KO}' js/prompts.js) -ge 5"
chk "지시는 영어, 출력은 한국어" "grep -q 'Instructions and labels are English' js/prompts.js && grep -q 'Output is Korean, always' js/prompts.js"
# ASCII 인물로 프롬프트를 지으면 남는 한글은 전부 지시문이다. 한 글자도 없어야 한다.
chk "다섯 프롬프트의 지시문에 한글이 한 글자도 없다" "node --test tests/orders.test.mjs 2>&1 | grep -q '^ok .*다섯 프롬프트의 지시문에 한글이 한 글자도 없다'"

echo
echo "── 화면이 구조도를 그대로 그리는가 ──"
chk "색 규약이 구조도 범례와 같다 (static·user·cached·once·code)" "grep -q -- '--tone-static' css/style.css && grep -q -- '--tone-cached' css/style.css && grep -q -- '--tone-once' css/style.css"
chk "A-1·A-2·B 세 준비 화면에 흐름 띠가 있다" "grep -c 'flow-diagram' index.html | grep -q '^3$'"
chk "준비가 미용실 → 취조실 → 코칭 세 화면이다" "grep -q 'id=\"screen-styling\"' index.html && grep -q 'id=\"screen-motivation\"' index.html && grep -q 'id=\"screen-coaching\"' index.html"
chk "주문 셋마다 반응 자리가 하나씩 있다" "test \$(grep -c 'id=\".*-react\"' index.html) -eq 3 && grep -q 'gotoMotivation' js/game.js"
chk "시공은 칸마다 한 호출이다 — 미용실과 취조실이 따로 돈다" "grep -q 'P.STYLING_SYSTEM' js/game.js && grep -q 'P.MOTIVATION_SYSTEM' js/game.js && grep -q 'function syncSheet' js/game.js"
chk "지운 주문도 어긋난 것으로 본다 (되돌릴 자리가 있다)" "grep -q 'function clearSheet' js/game.js && grep -q 'state.styledFrom[[]kind[]] !== state.orders[[]kind[]].trim()' js/game.js"
chk "판정 원장에 증감 기호만 뜬다" "grep -q 'MARK\\[v.dMood\\]' js/game.js && ! grep -q 'judge-line' js/game.js"
chk "계기판에 게이지가 둘뿐이다" "grep -c 'class=\"meter\"' index.html | grep -q '^2$'"
chk "스크리닝 상세가 노출 항목을 그린다" "grep -q 'fieldRows(c.client, .client.)' js/game.js && grep -q 'fieldRows(c.target, .target.)' js/game.js"


echo
if [ "$bad" -eq 0 ]; then
  printf '✅ 전 항목 통과\n'
else
  printf '❌ 실패 %d건 — 구조도에서 벗어난 자리가 있다\n' "$bad"
fi
exit $((bad > 0))
