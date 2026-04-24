# 프로젝트 규칙

## 목표

이 문서는 `가야의 연결점` 프로젝트에서 파일과 라벨 이름을 일관되게 유지하기 위한 기준이다.

## Ren'Py 스크립트 구조

- `game/core/`: 설정, GUI, 공용 선언
- `game/story/`: 프롤로그, 챕터, 엔딩
- `game/images/`: 배경, 캐릭터, CG
- `game/audio/`: BGM, SFX, Voice

## 파일명 규칙

- 모두 소문자 스네이크 케이스 사용
- 순서가 중요한 `.rpy` 파일은 앞에 숫자 프리픽스 사용
- 권장 형식: `00_start.rpy`, `10_prologue.rpy`, `20_chapter_01.rpy`

## 라벨 규칙

- 시작점: `start`
- 프롤로그: `prologue_intro`, `prologue_choice_a`
- 챕터: `chapter_01_scene_01`, `chapter_01_scene_02`
- 엔딩: `ending_a`, `ending_b`, `ending_true`

한 파일 안에서만 통하는 짧은 라벨 이름보다, 전체 검색에서 바로 의미가 드러나는 이름을 우선한다.

## 캐릭터 정의 규칙

- `game/core/10_defines.rpy`에 공용 캐릭터 선언 배치
- 캐릭터 id는 짧고 충돌 없게 유지
- 예시:
  - `define mc = Character("주인공")`
  - `define clerk = Character("역무원")`

## 이미지 파일 규칙

### 배경

- 위치: `game/images/backgrounds/`
- 형식: `bg_<location>_<time>.png`
- 예시:
  - `bg_station_day.png`
  - `bg_platform_night.png`

### 캐릭터 스프라이트

- 위치: `game/images/characters/`
- 형식: `ch_<name>_<emotion>.png`
- 예시:
  - `ch_mc_neutral.png`
  - `ch_clerk_smile.png`

### CG

- 위치: `game/images/cg/`
- 형식: `cg_<event_name>.png`
- 예시:
  - `cg_first_meeting.png`

## 오디오 파일 규칙

### BGM

- 위치: `game/audio/bgm/`
- 형식: `bgm_<mood_or_place>.ogg`

### 효과음

- 위치: `game/audio/sfx/`
- 형식: `sfx_<action>.ogg`

### 보이스

- 위치: `game/audio/voice/`
- 형식: `voice_<character>_<line_id>.ogg`

## 작업 원칙

- 아직 정해지지 않은 설정은 코드보다 문서에서 먼저 합의
- 임시 인물명과 임시 설정은 본편 파일에 넣지 않음
- 새 파일을 만들 때는 기존 규칙에 맞춰 바로 이름을 정함
