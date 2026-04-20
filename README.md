# 가야의 연결점

Ren'Py 프로젝트의 최소 실행 골격만 남겨둔 상태다.

## 지금은 여기만 수정

- 시나리오 작성: `game/story/`
- 캐릭터/공용 변수 정의: `game/core/10_defines.rpy`
- 배경 이미지 넣기: `game/images/backgrounds/`
- 캐릭터 스프라이트 넣기: `game/images/characters/`
- CG 넣기: `game/images/cg/`
- 배경음/효과음 넣기: `game/audio/`

## 지금은 건드리지 않기

- `game/core/00_options.rpy`
- `game/core/01_gui.rpy`
- `game/core/02_screens.rpy`
- `game/gui/`
- `game/fonts/`

위 파일과 폴더는 현재 실행용 기본값이므로, UI를 직접 손보기 전까지는 그대로 두는 편이 낫다.

## 다음에 정할 것

1. 주인공이 누구인지
2. 첫 장면이 어디서 시작하는지
3. 프롤로그 끝에서 플레이어가 무엇을 궁금해해야 하는지

## 현재 상태

- 스토리, 캐릭터, 장면 설정은 비워 둠
- 한글 폰트는 Pretendard로 연결
- 기본 GUI와 스크린만 유지
- Ren'Py SDK는 `/Users/jeonghan/Documents/tools/renpy-8.5.2-sdk/`에 분리

## 폴더 구조

```text
game/
├── audio/
│   ├── bgm/
│   ├── sfx/
│   └── voice/
├── core/
│   ├── 00_options.rpy
│   ├── 01_gui.rpy
│   ├── 02_screens.rpy
│   └── 10_defines.rpy
├── fonts/
│   ├── Pretendard-Regular.otf
│   └── Pretendard-SemiBold.otf
├── gui/
├── images/
│   ├── backgrounds/
│   ├── cg/
│   └── characters/
└── story/
    ├── 00_start.rpy
    ├── 10_prologue.rpy
    └── 20_chapter_01.rpy
```

정리 기준:

- `core/`: 시스템 설정과 UI 스크립트
- `story/`: 시나리오와 분기
- `images/`: 배경, 캐릭터, CG
- `audio/`: 배경음, 효과음, 보이스
- `fonts/`, `gui/`: 현재 Ren'Py가 직접 참조하는 리소스

파일명 규칙:

- 앞 숫자는 로드 순서와 작업 순서를 맞추기 위한 프리픽스
- `00_`: 진입점 또는 필수 설정
- `10_`, `20_`: 본편 시나리오나 확장 파일
- 파일명은 소문자 스네이크 케이스 유지

현재 실행 흐름:

- `start`
- `prologue_intro`
- `prologue_scene_01`
- `prologue_outro`
- `chapter_01_intro`

## 실행

```bash
cd "/Users/jeonghan/Documents/tools/renpy-8.5.2-sdk"
./renpy.sh "/Users/jeonghan/Documents/가야의연결점" lint
./renpy.sh "/Users/jeonghan/Documents/가야의연결점" compile
```

런처 앱:

- `/Users/jeonghan/Documents/tools/renpy-8.5.2-sdk/renpy.app`

파일명과 라벨 규칙은 `docs/project_conventions.md` 기준으로 유지한다.
