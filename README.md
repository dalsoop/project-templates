# Infocutter

Manifest V3 Chrome extension for hiding page elements with saved per-site selectors.

## What It Does

- Hide any element on the current site through picker mode
- Save selectors per hostname
- Remove saved selectors one by one
- Disable hiding for a site without deleting its rules
- Disable the extension globally without clearing saved data

## Development Rules

- Keep selector generation centralized in `src/shared/selector.ts`
- Keep storage normalization centralized in `src/shared/storage.ts`
- Keep popup as an operator surface, not a second business-logic layer
- Keep the extension dependency-light and inspectable

## Commands

- `npm run bootstrap` 의존성 설치
- `npm run doctor` 환경, manifest, 아이콘, dist 상태 점검
- `npm run dev` 개발용 빌드 후 로드 경로 안내
- `npm run watch` 파일 변경 시 자동 재빌드
- `npm run rebuild` 전체 산출물 정리 후 재빌드 + 진단
- `npm run check` lint + typecheck + test
- `npm run build:zip` zip 패키지 생성
- `npm run rc` 재빌드 + 점검 + 패키지까지 한 번에 실행
- `npm run reset` dist, dist-package 정리

같은 명령은 `make doctor`, `make watch`, `make rc` 같은 형태로도 실행할 수 있습니다.

## Load In Chrome

1. Run `npm install`
2. Run `npm run build`
3. Open `chrome://extensions`
4. Enable `Developer mode`
5. Click `Load unpacked`
6. Select the `dist` directory

## Package For Distribution

- Run `npm run build:zip`
- The packaged archive is created in `dist-package/infocutter-v0.1.0.zip`

## Layout

- `src/background` service worker and badge updates
- `src/content` selector application and picker mode
- `src/popup` toolbar management UI
- `src/shared` schema, storage, selector, and message contracts
- `public` manifest, popup markup, and icons
- `tests` selector and storage migration tests
