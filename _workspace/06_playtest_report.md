# 06 · 플레이테스트 리포트 — 크리스탈 가드

담당: playtester (opus 세션)

---

## [v2 라운드] GitHub Pages 라이브 플레이테스트 시도 — 2026-07-06

대상: https://revfactory.github.io/tower-defense/
기준: `.claude/skills/td-playtest-qa/SKILL.md` Part B, GDD v2.1 AC-01~37

### 결론 요약

| 구분 | 판정 |
|------|------|
| 실브라우저 플레이테스트 (AC-20/27/29/31/33/34/35) | **NOT TESTED** (환경 제약) |
| 배포 정적 검증 (AC-36 겸) | **GREEN** |

---

### 1. 실브라우저 검증 — NOT TESTED (환경 제약, 확정)

**사유:** playtester 서브에이전트 세션에 브라우저 자동화 도구가 하나도 주입되지 않음.
- 부재 도구: `ToolSearch`, `tabs_context`, `navigate`, `computer`, `read_page`, `tabs_create`, `read_console_messages`, `gif_creator`, `javascript_tool`.
- 가용 도구: 파일/Bash/Agent + Blender MCP뿐.
- 메인 세션에서도 Chrome 확장이 누적 3라운드 미연결로 확인됨 → **환경 제약으로 확정 불가**. 지시대로 재시도 2회 내 중단, 대체 실플레이 시도 안 함.

**미검증 AC (실브라우저 의존):**

| AC | 항목 | 판정 | 헤드리스 대체 근거 (QA 회차) |
|----|------|------|------------------------------|
| AC-20 | 로드 콘솔 에러 0건 | NOT TESTED | 회차 18-3: `headless_smoke_v2.mjs` 25/25 + `console.error 0`. 단, 실브라우저 런타임 콘솔(모듈 로드/이미지 디코드/DPR)은 미확인 |
| AC-27 | 타워 레벨별 외형 변화 (화염 장판·빙결 파동·속사 가속·과충전) | NOT TESTED | 회차 19-1/-2: 타워 lv1~3 스프라이트 42키 실파일 대조 + 회차 17: 메커니즘 로직(장판 생성/만료·nova 발동) 헤드리스 통과. 육안 외형 확인만 미완 |
| AC-29 | 적 걷기 애니메이션 | NOT TESTED | 회차 16-8: 개체 누적시간 `t+=dt×slowFactor`·`frame=floor(t×fps)%frames`·진행각 회전·HP바 비회전 로직 통과. 회차 19-2: 아틀라스 JSON `frames 4·fps 8·walk[0,1,2,3]` 5종 1:1 파싱 대조. 실렌더 육안만 미완 |
| AC-31 | 맵 비주얼 (잔디 변형·길 방향·장식) | NOT TESTED | 회차 15: `levels.js` D11 불변 데이터 대조 통과. 실렌더 육안 미완 |
| AC-33 | 터치 1탭 프리뷰·2탭 확정 | NOT TESTED | 회차 16-7: Pointer 단일 경로(mouse/touch 리스너 0)·탭<8px·롱프레스 contextmenu 무시·터치 상태머신 로직 통과. 실기 탭 동작만 미완 |
| AC-34 | 세로 390×844 스크롤 없음 | NOT TESTED | 회차 16-7: 논리 960×640 불변·§11 모바일 계약 통과. 실뷰포트 레이아웃 미완 |
| AC-35 | DPR 선명도 | NOT TESTED | 회차 16-7: `DPR=min(dpr,2)` 백킹스토어·기저 변환·논리 좌표 불변 통과. 실화면 선명도 미완 |

즉 위 항목들은 **로직·데이터·아틀라스 계약 레벨에서는 QA 회차 14~19에서 헤드리스로 이미 GREEN**이며, 잔여 미검증분은 오직 "실브라우저 렌더 육안/실기 조작" 국면뿐이다.

---

### 2. 배포 정적 검증 — GREEN (AC-36 배포 검증 겸)

방법: `curl` HTTP 프로브 (실브라우저 아님 — 정적 도달성/구조 확인).

| 검사 | 결과 |
|------|------|
| Pages 루트 응답 | **HTTP 200** (`https://revfactory.github.io/tower-defense/`) |
| index.html 구조 | `<title>크리스탈 가드 — Crystal Guard</title>`, `<canvas id="game-canvas" width="960" height="640">`, `<script type="module" src="src/main.js">` 정상 |
| 엔트리 모듈 | `src/main.js` → 200 |
| 모듈 그래프 | main.js 1차 import 26개 경로 확인 (core 5 / map 3 / systems 3 / ui 5 / fx 3 / audio 1 / data 5 + manifest) |
| 매니페스트 | `assets/manifest.js` → 200 (**참고: `assets/manifest.json` 404는 정상** — 코드는 `.json`이 아닌 `manifest.js`를 import) |
| 걷기 아틀라스 png+json 쌍 도달 | `enemy_goblin_walk.png`/`.json`, `enemy_orc_walk.png`/`.json` 전부 200 |
| 정적 스프라이트 도달 | `enemy_goblin.png`, `enemy_orc.png` 200 |
| 타워 레벨 경로 존재 | manifest에 `tower_{arrow,cannon,frost,arcane}_lv{1,2,3}.png` 12키 전량 명시 |

**판정:** 배포 자체와 에셋 경로 무결성 GREEN. 단, 이는 정적 200 확인일 뿐이며 **런타임 로드 성공/콘솔 청결(AC-20)/실제 draw**는 브라우저 없이는 검증 불가.

---

### 3. 재호출 조건

이 라운드의 NOT TESTED 항목(AC-20/27/29/31/33/34/35)을 종결하려면 **Chrome 확장이 연결되고 playtester 세션에 브라우저 자동화 도구(navigate/computer/read_page/read_console_messages/gif_creator/javascript_tool)가 주입된 환경**에서 재호출 필요.

재호출 시 우선순위:
1. Pages URL 접속 → 로드 즉시 `read_console_messages` 전량 수집 (AC-20)
2. 타워 4종 Lv3까지 업그레이드 → 레벨별 외형·메커니즘 육안 (AC-27) — nova 육안은 **프로스트 단독 국면** 권장(혼성 배치 시 volley가 타겟 선점 — engine-dev 실측)
3. 걷기 애니메이션 육안 (AC-29), 맵 비주얼 육안 (AC-31)
4. 390×844 세로 뷰포트 → 스크롤 없음(AC-34)·1탭/2탭 터치(AC-33)·DPR 선명도(AC-35). 합성 클릭은 발행 안 됨 → **PointerEvent 주입 필요**
5. 파괴적 플레이: 길/장식 타일 건설·골드 부족 연타·웨이브/배속/음소거 연타
6. 주요 구간 스크린샷·GIF, 세션 전체 콘솔 로그 요약

---
