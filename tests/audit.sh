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

echo "── 이번 세션에서 내린 지시가 코드에 남아 있는가 ──"
chk "프롬프트 지시문 영어 · 출력 한국어 고정 (블록마다)" "test \$(grep -c '\${KO}' js/prompts.js) -ge 5"
chk "특성 4축이 서로 다른 말 (want/urge/nerve/weakness)" "grep -q 'WHAT YOUR BODY WANTS' js/prompts.js && grep -q 'LINES YOU HAVE ALREADY CROSSED' js/prompts.js"
chk "데이트 장소를 요원이 문자로 잡을 수 있다" "grep -q 'If a place was actually named in those texts' js/prompts.js"
chk "마지막 발언은 의뢰인 것 — 페이즈 경계에서 판정을 비운다" "grep -q 'flushJudge' js/engine.js"
chk "환경 사망 — 의뢰인/상대/양쪽" "grep -q \"casualty\" js/prompts.js && grep -q 'CASUALTY_KO' js/scoring.js"
chk "대면에서만 몸이 위험하다는 블록" "grep -q 'PHYSICAL' js/prompts.js"
chk "버릇은 그냥 거슬리는 수준 (조건반사 아님)" "grep -q 'A tic, not a decision' js/prompts.js"
chk "성향 충돌이 지뢰를 밟는다 (COLLISION)" "grep -q 'COLLISION' js/couples.js"
chk "버릇이 금지 항목을 그대로 옮기면 로드 실패" "grep -q 'echoes' js/couples.js"
chk "정보 흐름 그래프 생성기" "test -f tests/graph.mjs && grep -q '\"graph\"' package.json"
chk "의뢰 대장 40건 이상" "node -e \"import('./js/couples.js').then(m=>process.exit(m.COUPLES.length>=40?0:1))\""
chk "쉬움 조합이 10건 이상" "node -e \"import('./js/couples.js').then(m=>process.exit(m.COUPLES.filter(x=>x.difficulty==='쉬움').length>=10?0:1))\""
chk "보통 조합이 10건 이상" "node -e \"import('./js/couples.js').then(m=>process.exit(m.COUPLES.filter(x=>x.difficulty==='보통').length>=10?0:1))\""
chk "추악한 기본값 — 착한 선택지와 이득이 갈리면 이득" "grep -q 'the default is profit' js/prompts.js"
chk "임자 있는 사람도 뺏는다" "grep -q \"TAKING SOMEONE ELSE'S PARTNER\" js/prompts.js"
chk "훈계 금지 (요구에 계산부터)" "grep -q 'DO NOT PLAY RIGHTEOUS' js/prompts.js"
chk "협박·약점 잡기 — leverage 판정" "grep -q 'leverage' js/prompts.js && grep -q 'coerceMin' js/scoring.js"
chk "강압 성사 엔딩" "grep -q \"'coerced'\" js/scoring.js && grep -q '강압 성사' js/game.js"
chk "좋아해도 못 사귀는 엔딩 (차임)" "grep -q \"'barrier'\" js/scoring.js && grep -q '호감 초과 · 성사 불가' js/game.js"
chk "성적 묘사 상한 제거 (페이드아웃 금지)" "grep -q 'do not fade to black' js/prompts.js"
chk "장소·시점 제약 없음 (침실도 끝도 안 기다린다)" "grep -q 'does not have to wait for a bedroom' js/prompts.js"
chk "강압당하는 쪽에게는 몸을 사지 못한다 (내가 거절한 항목)" "grep -q 'it does not buy a body' js/prompts.js"
chk "턴 1.5배 (문자6+대면8=14)" "node -e \"import('./js/scoring.js').then(m=>{const d=m.DIFFICULTIES['보통'];process.exit(d.textTurns+d.talkTurns===14?0:1)})\""
chk "케미 연장 유지 (최대 +5)" "node -e \"import('./js/scoring.js').then(m=>process.exit(m.EXTENSION.maxExtra.text+m.EXTENSION.maxExtra.talk===5?0:1))\""
chk "여캐 조형 보정" "grep -q 'spec.femme' js/avatar.js"
echo
echo "── 절대 들어가면 안 되는 것 ──"
chk "저장소 어디에도 실제 API 키 없음 (자리표시자는 허용)" "! grep -rnE 'sk-ant-api03-[A-Za-z0-9_-]{20,}' --exclude-dir=.git ."
chk "무전에 반항하라는 지시가 프롬프트에 없다" "! grep -niE 'rebel|disobey|refuse the order|defy|report (it|them) to|tell (someone|others|them) (about )?(the|that) (radio|order|threat)' js/prompts.js"
chk "협박당한다고 남에게 이르라는 지시가 없다" "! grep -niE 'blow the whistle|tell (the )?(police|authorities)|expose (the )?(bureau|headquarters)' js/prompts.js"
chk "거부 자체가 선택지가 아니다 (레버가 살아 있다)" "grep -q 'you cannot refuse' js/prompts.js"
