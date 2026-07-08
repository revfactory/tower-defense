/**
 * @module data/scoring (wave-balancer) — v3
 * 종합 점수 배점값의 단일 출처. 스키마·필드명은 계약 §4.10 — 문자 단위 준수.
 * score.js는 이 값만 읽고 하드코딩하지 않는다 (매직 넘버 금지 원칙).
 *
 * @typedef {Object} ScoringDef
 * @property {Object<string, number>} killPoints  적 종류별 처치 점수 — ENEMIES 5키 전부 필수.
 *                                                처치 어려운 적일수록 높게, 보스 단일 최고 (GDD §13.2).
 *                                                누수 사망은 처치 아님(가산 안 함). 미정의 type=0+경고.
 * @property {number} waveClearBonus              웨이브 클리어당 기본 가산 점수
 * @property {number} waveScale                   후반 가중 배수(≥1). 웨이브 점수 =
 *                                                waveClearBonus × (1 + (index-1) × (waveScale-1)). 1.0=균등
 * @property {number} lifeBonusPerLife            남은 라이프 보너스 계수 — 클리어 시 livesLeft × 이 값 (패배 0)
 * @property {number} goldBonusPer                (v3.1) 잔여 골드 보너스 계수 — 클리어 시 floor(goldLeft × 이 값) (패배 0)
 *
 * 점수 규칙 구속(GDD §13.2): 판매·업그레이드 점수 무영향, 배속 페널티 없음, 스테이지 독립.
 *
 * 배점 의도 (GDD §13.2 3요소):
 *  ① 처치 점수 — 난이도(처치 저항: EHP·armor·회피) 순 차등, 보스 단일 최고.
 *     goblin 5(최저·기준) < wasp 8(HP는 orc↓지만 고속 회피=frost 강요 프리미엄) <
 *     orc 10(기준 EHP 2배) < steel_brute 25(고armor·고HP 탱크=arcane 강요) <<
 *     stone_golem 200(보스 — 단일 최고, 2위 25의 8배).
 *  ② 웨이브 클리어 보너스 — 40/웨이브, waveScale 1.12로 후반 가중(W1 40 → W10 83.2).
 *     중도 패배도 도달 웨이브만큼 인정 → 재도전 진전 체감.
 *  ③ 남은 라이프 보너스 — 30/라이프. 무피해(20) 600 vs 밴드 클리어(8~11) 240~330 —
 *     "이미 이긴 판을 더 잘 이기려는" 재플레이 동기의 핵심 스윙 요소.
 *  ④ 잔여 골드 보너스 (v3.1) — 0.15/골드. 클리어 시 floor(goldLeft × 0.15), 패배 0.
 *     ③ 라이프 보너스와 동형(승리 완성도)이나 **명백히 작은 스윙**이어야 한다(계약 §4.10 구속):
 *     GDD §6 "골드는 쓰라고 주는 것"·§13.2 "판매·업글 무영향"과 긴장 관계 — 골드 보너스가 크면
 *     "덜 짓고 골드 쥐는" 소극 방어를 보상해 라이프·처치 의도를 훼손한다. 0.15는 실측 잔여골드
 *     (킬존 봇 스테이지 1 클리어 시 258골드 → 38점)로 total의 ≈1.4%, 극단 hoarder(600골드)도 90점 <
 *     라이프 보너스 최대 600 — 상한 안전. 소극 방어 유인 없음.
 *
 * 스테이지 1 풀클리어 요소 비중(sim §9, 무피해 20라·잔여 258골드): 처치 1463 / 웨이브 616 /
 *   라이프 600 / 골드 38 = total 2717 → 54% / 23% / 22% / 1.4%. 처치가 기반, 웨이브가 진행도,
 *   라이프가 완벽도 주 스윙, 골드는 미세 보정 — 4요소 모두 의도대로. (골드 ≤10% 구속 충족)
 *
 * 주: SCORING은 전역(스테이지 공유 — 계약 §4.10). killPoints는 기본 난이도 기준이며
 *     hpScale 미반영 — 스테이지 간 점수 차는 웨이브 구성 물량·라이프·웨이브 보너스로 자연 발생.
 */

/** @type {ScoringDef} */
export const SCORING = {
  killPoints: {
    goblin: 5,        // 최저 — 기준 (다수·저체력)
    orc: 10,          // 기준 EHP 2배
    wasp_runner: 8,   // HP는 orc↓지만 고속 회피(frost 강요) 프리미엄으로 goblin↑
    steel_brute: 25,  // 고armor·고HP 탱크 (arcane 강요)
    stone_golem: 200  // 보스 — 단일 최고 (2위 25의 8배)
  },
  waveClearBonus: 40,    // 웨이브 클리어당 기본
  waveScale: 1.12,       // 후반 가중 (W1 40 → W10 40×(1+9×0.12)=83.2)
  lifeBonusPerLife: 30,  // 무피해 20라이프 = 600, 밴드 8라이프 = 240
  goldBonusPer: 0.15     // (v3.1) 잔여골드 보너스 — 클리어 시 floor(goldLeft×0.15). 258골드=38점(≈1.4%)
};
