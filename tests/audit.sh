# audit.sh — 이 게임에 내려진 지시가 코드에 실제로 남아 있는지 훑는다.
#
#   npm run audit
#
# 기능 테스트(npm test)와 목적이 다르다. 여기서 보는 건 "그 규칙이 아직 살아 있는가"다.
# 프롬프트 한 줄을 지웠는데 테스트가 안 깨지는 경우가 있다 — 그런 걸 잡으려고 둔다.
# 「절대 들어가면 안 되는 것」 절은 특히 지우지 마라. 그건 요청받은 게 아니라 금지당한 것들이다.
set +e
cd "$(dirname "$0")/.."
ok(){ printf '  ✅ %s\n' "$1"; }
no(){ printf '  ❌ %s\n' "$1"; }
chk(){ if eval "$2" >/dev/null 2>&1; then ok "$1"; else no "$1"; fi; }

echo "── 스키마: 대칭과 축소 ──"
chk "인물 스키마가 8필드로 닫혀 있다 (이게 전부여야 한다)" "grep -q \"CH_FIELDS = new Set(\\['name', 'gender', 'look', 'history', 'personality', 'keys', 'prefs', 'spec'\\])\" js/couples.js"
chk "의뢰인·상대가 완전히 동일한 카테고리를 가진다 (검증이 로드에서 돈다)" "grep -q '스키마 밖 필드' js/couples.js"
chk "want/urge/nerve/regard가 제거됐다" "! grep -qE 'flaw\\.want|\\.urge|\\.nerve|\\.regard' js/prompts.js js/engine.js js/game.js"
chk "만남+아젠다가 relation 하나로 묶였다" "node -e \"import('./js/couples.js').then(m=>process.exit(m.COUPLES.every(c=>c.relation&&c.relation.includes('현안'))?0:1))\""
chk "성향이 전원에게 있다 — 상대만 있는 게 아니다" "node -e \"import('./js/couples.js').then(m=>process.exit(m.COUPLES.every(c=>c.client.prefs.length>=3&&c.target.prefs.length>=3)?0:1))\""
chk "의뢰인 성향은 미공개분까지 요원에게 전부 보인다" "grep -q 'sheetHtml(c.client, { mine: true })' js/game.js && grep -q '미공개분 포함 전부' js/game.js"
chk "특별 키워드 4종 (상대관심·공기읽기·명령수용·어긋남) — 조건반사는 폐지" "grep -q \"KEYS = \\['interest', 'air', 'comply', 'wreck'\\]\" tests/sheets.test.mjs && ! grep -q 'reflex: \"' js/couples.js"

echo
echo "── 판정: 합 단위, 상대 시점, 호감 단일 게이지 ──"
chk "판정이 합(서로 대여섯 마디) 단위다" "node -e \"import('./js/scoring.js').then(m=>process.exit(m.BOUT.size>=4&&m.BOUT.size<=6?0:1))\""
chk "합의 경계는 심판이 자른다 (carry)" "grep -q 'carry' js/prompts.js && grep -q 'carryMax' js/scoring.js"
chk "수치 분위기가 없다 — 공기는 텍스트뿐이다" "! grep -qE 'moodMultiplier|moodFloor|startMood|moodDrift' js/scoring.js && ! grep -q 'meter-mood' index.html"
chk "공기 텍스트가 판정 입력이자 양쪽 전달 컨텍스트다" "grep -q 'handed to' js/prompts.js && grep -q \"injectVibe('target')\" js/engine.js"
chk "자리 파탄은 심판의 walkout 판단이다" "grep -q 'walkout' js/prompts.js && grep -q \"'walkout'\" js/scoring.js"
chk "심판이 철저히 상대 시점에서만 본다" "grep -qE \"behind .{0,20}eyes\" js/prompts.js && grep -q 'Fairness is not your job' js/prompts.js"
chk "호감의 기준선이 0 — 회사원 예시" "grep -q 'office worker' js/prompts.js && grep -q 'zero' js/prompts.js"
chk "잘 굴러간 대화는 0점 (flat/nudge 밴드 0)" "node -e \"import('./js/scoring.js').then(m=>process.exit([m.bandLove('flat',9),m.bandLove('nudge',9)].every(x=>x===0)?0:1))\""
chk "서로 자기 욕심만 얘기하면 0점" "grep -q 'their own appetites' js/prompts.js"
chk "warm의 유일한 출처가 상대의 시트" "grep -q 'something on \\*\\*their\\*\\* sheet' js/prompts.js"
chk "warm에 부정 목록이 있다 (남발 방지)" "grep -q 'Never warm' js/prompts.js"
chk "분포 가드가 양방향이다" "grep -q 'appreciating, not adjudicating' js/prompts.js && grep -q 'you are hiding' js/prompts.js"
chk "합 예산이 숫자로 박혀 있다 (br 1 · warm 2)" "grep -q 'ZERO breakthrough bouts' js/prompts.js && grep -q 'at most 2 warm' js/prompts.js"
chk "패턴 파괴는 한 번만 사건" "grep -q 'It happens \\*\\*once\\*\\*' js/prompts.js"
chk "하자가 사람을 향하는 것은 이동이 아니다" "grep -q 'pattern running, not the person moving' js/prompts.js"
chk "자리 길이는 모델이 정한다 (keepGoing)" "grep -q 'keepGoing' js/prompts.js && grep -q 'cutShort' js/scoring.js"
chk "호감 포화·손실 완충이 남아 있다" "grep -q 'loveSaturation' js/scoring.js && grep -q 'lossCushion' js/scoring.js"
chk "협박·약점 잡기 — leverage 판정과 강압 성사" "grep -q 'leverage' js/prompts.js && grep -q 'coerceMin' js/scoring.js && grep -q \"'coerced'\" js/scoring.js"
chk "환경 사망 — 의뢰인/상대/양쪽" "grep -q 'casualty' js/prompts.js && grep -q 'CASUALTY_KO' js/scoring.js"
chk "규칙 계층에 준비 점수 개념이 없다" "! grep -qiE 'coaching|speech|styling|outfit|prepScore' js/scoring.js"

echo
echo "── 인물: 하자·어긋남·정보 게이트 ──"
chk "어긋남 7종이 전부 실제로 쓰인다" "node -e \"import('./js/couples.js').then(m=>{const k=new Set(m.COUPLES.flatMap(c=>[c.client.keys.wreck.kind,c.target.keys.wreck.kind]));process.exit(k.size===7?0:1)})\""
chk "문체 강제 장치가 되살아나지 않았다 (프롬프트 최소주의)" "! grep -q 'THE LAST THING YOU READ' js/prompts.js && ! grep -q 'WRECK_STYLE' js/prompts.js && ! grep -q 'THIS COSTS YOU SOMETHING' js/prompts.js && ! grep -q 'sitcom' js/prompts.js"
chk "행동 명령은 한 줄뿐 — 이기적·욕망 충실·찐따면 진짜 찐따" "grep -q 'loyal' js/prompts.js && grep -q 'actual social' js/prompts.js"
chk "어긋남은 키워드 데이터로 실린다" "grep -q '어긋남(\${k.wreck.kind})' js/prompts.js"
chk "상대관심이 정보량을 깎는다 (지시가 아니라 게이트)" "grep -q 'interest !==' js/prompts.js"
chk "공기읽기가 양쪽 다 작동한다" "grep -q \"air === 'none'\" js/engine.js"
chk "심판이 어긋남을 알고 최소 응답을 냉대로 안 읽는다" "grep -q 'How each fails at conversation' js/prompts.js"
chk "지침 흐름 연출 지시가 되살아나지 않았다" "! grep -q 'the wanting does not go with' js/prompts.js && ! grep -q 'not making up as you go' js/prompts.js"
chk "지침 이행의 결 3종 (obeys/argues/drifts)" "grep -q 'drift back' js/prompts.js"

echo
echo "── 세계관·수위 (압축에서 손실 금지) ──"
chk "프롬프트 지시문 영어 · 출력 한국어 고정 (블록마다)" "grep -q 'output in Korean' js/prompts.js && test \$(grep -c '\${KO}' js/prompts.js) -ge 5"
chk "추악한 기본값 — 이득이 기본" "grep -q 'default is profit' js/prompts.js"
chk "임자 있는 사람도 뺏는다" "grep -q \"else's partner\" js/prompts.js"
chk "훈계 금지" "grep -q 'DO NOT PLAY RIGHTEOUS' js/prompts.js"
chk "성적 묘사 상한 제거 (페이드아웃 금지·신체 명명)" "grep -q 'No fade-to-black' js/prompts.js && grep -q 'Name the body' js/prompts.js"
chk "장소·시점 제약 없음" "grep -q 'does not wait for a bedroom' js/prompts.js"
chk "심판이 야한 전개를 같은 잣대로 잰다" "grep -q 'sexual is also correct operation' js/prompts.js"
chk "성인만 등장한다" "grep -q 'adult' js/prompts.js && grep -q 'minor' js/prompts.js"
chk "강압·협박까지 허가서에 명시된다 (압축 손실 금지)" "grep -q 'coercion and blackmail' js/prompts.js"
chk "데이트 장소를 요원이 문자로 잡을 수 있다" "grep -q 'If a place was named and not refused' js/prompts.js"
chk "장소의 위험이 실재한다 (허가서에 명시)" "grep -q 'hazards are real' js/prompts.js"

echo
echo "── 하네스·데이터 위생 ──"
chk "의뢰 대장 40건 이상" "node -e \"import('./js/couples.js').then(m=>process.exit(m.COUPLES.length>=40?0:1))\""
chk "합 판정이 완전 비동기다 — 대화가 심판을 기다리지 않는다 + 타임아웃 페일세이프" "grep -q 'drainJudge' js/engine.js && grep -q 'JUDGE_TIMEOUT_MS' js/engine.js"
chk "페이즈 경계에서 합을 비운다" "grep -q 'flushBout' js/engine.js"
chk "심판이 죽어도 중립(nudge)으로 흐른다" "grep -A5 'neutralJudge(reason)' js/engine.js | grep -q \"tier: 'nudge'\""
chk "여캐 조형 보정" "grep -q 'spec.femme' js/avatar.js"
chk "판정 수치가 플레이어에게 보인다 (합 카운터·포화)" "grep -q 'hud-bout' js/game.js && grep -q 'hud-sat' js/game.js"
chk "effort·단가를 접두사로 잡는다 (날짜 붙은 id)" "node -e \"import('./js/llm.js').then(m=>process.exit(!m.supportsEffort('claude-haiku-4-5-20251001')&&m.priceOf('claude-haiku-4-5-20251001')[0]===1?0:1))\""
chk "테스트 하네스는 하이쿠만 쓴다" "grep -q 'claude-haiku' tests/test-model.mjs"

echo
echo "── 밸런스 정책 (README ⚖️) ──"
chk "기준선 = 손수 쓴 이상적 지시서(gold)가 아슬아슬 클리어" "test -f tests/ace-book.mjs && grep -q \"profile === 'gold'\" tests/live.mjs && grep -q '아슬아슬' README.md"
chk "gold 지시서가 5커플 이상 채워져 있다" "node -e \"import('./tests/ace-book.mjs').then(m=>process.exit(Object.keys(m.ACE_BOOK).length>=5?0:1))\""
chk "gold는 플레이어 가시 정보로만 — 미공개 성향 누출 없음" "node -e \"import('./tests/ace-book.mjs').then(async m=>{const c=await import('./js/couples.js');let bad=0;for(const id of Object.keys(m.ACE_BOOK)){const t=c.COUPLE_BY_ID[id].target;const blob=m.ACE_BOOK[id].coaching+' '+m.ACE_BOOK[id].speech;for(const p of t.prefs.filter(p=>!p.open))if(blob.includes(p.t))bad++;}process.exit(bad?1:0)})\""
chk "지뢰가 성향 공략 경로 위 — 전 커플에 지뢰(neg)가 실재" "node -e \"import('./js/couples.js').then(m=>process.exit(m.COUPLES.every(c=>c.target.prefs.some(p=>p.neg)&&c.client.prefs.length>=3)?0:1))\""
chk "성공선이 gold 기준 정책을 명시한다" "grep -q '밸런스 정책' js/scoring.js"

echo
echo "── 절대 들어가면 안 되는 것 ──"
chk "저장소 어디에도 실제 API 키 없음 (자리표시자는 허용)" "! grep -rnE 'sk-ant-api03-[A-Za-z0-9_-]{20,}' --exclude-dir=.git ."
chk "무전에 반항하라는 지시가 프롬프트에 없다" "! grep -niE 'rebel|disobey|refuse the order|defy|report (it|them) to|tell (someone|others|them) (about )?(the|that) (radio|order|threat)' js/prompts.js"
chk "협박당한다고 남에게 이르라는 지시가 없다" "! grep -niE 'blow the whistle|tell (the )?(police|authorities)|expose (the )?(bureau|headquarters)' js/prompts.js"
chk "거부 자체가 선택지가 아니다 (레버가 살아 있다)" "grep -q 'cannot refuse' js/prompts.js"
