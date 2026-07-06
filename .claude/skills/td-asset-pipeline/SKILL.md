---
name: td-asset-pipeline
description: "codex-cli(codex exec)의 image_generation 툴로 타워 디펜스 게임 에셋을 생성하는 파이프라인 v2 — 다각도·애니메이션 레퍼런스 시트 생성, 프레임 슬라이싱, 스프라이트 아틀라스 제작, 타워 레벨별 외형까지. 게임 에셋 생성, 스프라이트 시트, 애니메이션 프레임, 레퍼런스 시트, 이미지 재생성/추가, 에셋 퀄리티 향상, codex 이미지 관련 요청 시 반드시 사용. 오디오는 범위 아님(Web Audio 합성)."
---

# TD Asset Pipeline v2 — 레퍼런스 시트 기반 에셋 생성

핵심 원리: **한 캐릭터의 모든 각도·프레임을 한 장의 시트로 생성한다.** 이미지 모델은 호출마다 캐릭터가 달라지지만, 한 이미지 안에서는 일관성이 보장된다. 시트를 생성한 뒤 균등 셀로 슬라이싱해 게임용 아틀라스를 만든다.

## 0. 사전 점검 (배치 시작 전 1회)

```bash
codex --version && codex login status          # 미로그인 시 즉시 중단·보고
python3 -c "import PIL" 2>/dev/null || pip3 install --user pillow   # 슬라이싱 의존성
```

## 1. 에셋 스펙 표 작성

생성 전 매니페스트 키 전체를 표로 확정한다: `키 | 시트 구성(행×열) | 셀 내용 | 최종 규격`. 즉흥 생성 금지 — 시트 구성이 곧 슬라이싱 파라미터다.

| 카테고리 | 시트 구성 | 비고 |
|---|---|---|
| 적 걷기 | 1행 × 4열 (걷기 사이클 4프레임, 옆모습 없이 탑다운 3/4 고정) | 프레임당 256px 셀 |
| 적 다각도 레퍼런스 | 1행 × 3열 (정면/측면/후면 3/4) | 게임 적용은 선택, 문서·QA 기준 |
| 타워 레벨 | 1행 × 3열 (Lv1→Lv2→Lv3, 같은 타워의 점진적 강화 외형) | 레벨별 실루엣 변화 필수 |
| 타워 발사 | 1행 × 2열 (대기/발사 섬광 프레임) | 선택 |
| 보스 | 걷기 4프레임 + 등장 포즈 1 | 2행 구성 가능 |
| 맵 타일 | 단일 (풀 2종·길 직선/코너·장식 3종+) | 시트 아님, 개별 생성 |
| 투사체/UI | 단일 | v1 방식 유지 |

## 2. 시트 프롬프트 규칙

공통 프리픽스(v1 스타일 유지 — 기존 에셋과 톤 일치):

```
2D game sprite sheet for a top-down tower defense game, clean vibrant cartoon style,
bold outlines, isolated on a fully transparent background, no text, no watermark
```

시트 지시는 **셀 구조를 명시적으로**:

```
..., a sheet of exactly 4 frames in a single horizontal row, each frame in an equal
square cell, the same goblin character in a walking animation cycle (contact, down,
passing, up poses), identical size and style across frames, centered in each cell,
seen from a high three-quarter top-down angle
```

- 프레임 수는 4를 기본으로 한다 — 이미지 모델이 안정적으로 지키는 상한이고, 걷기 사이클에 충분하다.
- 타워 레벨 시트: `the same watchtower evolving through 3 upgrade levels, left to right, progressively taller and more ornate, same base footprint`
- 결과 셀 경계가 어긋나는 것은 정상이다 — 슬라이싱 단계에서 보정한다. 셀이 3개만 나오거나 캐릭터가 겹치면 그 시트만 재생성(최대 2회).

## 3. 병렬 배치 생성

v1과 동일: 5장 단위 배치, 파일명 전부 상이, Bash `run_in_background: true`, `sleep` 폴링 금지, `--ask-for-approval` 금지.

```bash
codex exec --sandbox workspace-write --skip-git-repo-check \
  --cd <스테이징 디렉토리> -o /tmp/codex-sheet-<key>.md \
  "이미지 생성 도구로 '<시트 프롬프트>' 이미지를 생성하고 ./<key>_sheet.png 로 저장. 경로만 한 줄로 보고."
```

시트는 원본이 크므로(1254px+) 스테이징에서 작업 후 최종본만 assets/로 이관한다.

## 4. 슬라이싱 → 아틀라스

번들 스크립트 사용: `.claude/skills/td-asset-pipeline/scripts/slice_sheet.py`

```bash
python3 .claude/skills/td-asset-pipeline/scripts/slice_sheet.py \
  <sheet.png> --cols 4 --rows 1 --out assets/images/enemies/goblin_walk.png \
  --atlas assets/atlas/goblin_walk.json --frame-size 128 --fps 8
```

동작: ①균등 분할 ②셀별 알파 바운딩박스로 캐릭터 중심 정렬(셀 경계 어긋남 보정) ③균일 프레임 스트립으로 재조립 ④아틀라스 JSON 생성.

**아틀라스 규약** (계약 문서 §5와 1:1 — engine-dev의 로더가 이 형식을 파싱):

```json
{ "frameW": 128, "frameH": 128, "frames": 4, "fps": 8, "sequences": { "walk": [0,1,2,3] } }
```

- 스트립 PNG와 아틀라스 JSON은 같은 basename을 쓴다 (`goblin_walk.png` + `goblin_walk.json`).
- 타워 레벨 시트는 애니메이션이 아니라 **개별 파일로 분리 저장**: `tower_arrow_lv1.png` ~ `_lv3.png` (로더가 단일 이미지로 취급).

## 5. 검수 (배치마다)

v1 검수(파일 유효성·알파·육안·스타일 일관)에 시트 항목 추가:

- 슬라이싱 후 **각 프레임을 Read로 육안 확인** — 프레임 간 캐릭터 동일성, 걷기 포즈 진행, 잘림 여부
- 프레임 크기 편차가 심하면(바운딩박스 면적 차 30%+) 시트 재생성 — 프레임 정렬 보정으로는 못 살린다
- 투명 배경 실패 시 마젠타(#FF00FF) 배경으로 재생성 (엔진 크로마키 폴백)

## 6. 맵 타일 퀄리티 기준

- 풀 타일 2종 이상(변형) + 길 직선/코너 세트 — 단일 타일 반복은 밋밋함의 주범
- `seamless tileable` 명시, 밝기·채도가 유닛 스프라이트보다 낮아야 함 (배경이 튀면 유닛이 안 보인다)
- 장식(바위·나무·수정 조각) 3종 이상 — map-designer가 밀도·배치를 소유

## 7. 산출물 리포트

`_workspace/03_artist_asset-report.md` 갱신: `키 | 유형(단일/시트→프레임 N) | 상태 | 아틀라스 | 비고`. 매니페스트 전 키 + 아틀라스 전 파일이 표에 있어야 완료. 레퍼런스 시트 원본은 `assets/reference/`에 보존 (재생성·QA 기준).

## 알려진 함정 (v1 + v2 추가)

| 증상 | 조치 |
|---|---|
| 파일이 스테이징에 없고 `~/.codex/generated_images/`에만 있음 | "./<파일> 로 저장" 문구 강화 후 재실행 |
| 시트 프레임 수 불일치(3개/5개) | 해당 시트만 재생성, "exactly 4 frames" + "equal square cells" 강조 |
| 프레임 간 캐릭터 크기 널뛰기 | 슬라이서의 `--normalize` 사용, 심하면 재생성 |
| 배치 전체 비정상 지연(300초+/장) | 배치를 3장으로 축소, 오케스트레이터 보고 |
| Pillow 미설치 | `pip3 install --user pillow` 후 재시도 |
